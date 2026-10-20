/**
 * functions/index.js — Espelhamento de anexos para o Google Drive
 * ================================================================
 *
 * Fluxo
 * -----
 *   navegador → Firebase Storage (resumable, com progresso)
 *             → [onObjectFinalized] esta função
 *             → Google Drive: Hydrone / {data do ensaio} / {tipo de experimento}
 *             → grava fileId, name, mimeType e webViewLink no doc do anexo
 *
 * O usuário nunca faz OAuth individual: a identidade usada é a service account
 * da própria função, e a pasta de destino é compartilhada com ela.
 *
 * ATENÇÃO — cota de armazenamento
 * -------------------------------
 * Uma service account NÃO tem cota de armazenamento própria no Drive. Se
 * GOOGLE_DRIVE_ROOT_FOLDER_ID apontar para uma pasta dentro do "Meu Drive" de
 * uma pessoa, o upload falha com `storageQuotaExceeded` assim que a função tenta
 * criar o arquivo (os vídeos de ensaio batem nisso de imediato). A pasta Hydrone
 * precisa estar em um **Drive compartilhado** (Shared Drive), onde os arquivos
 * pertencem ao drive e não ao autor. O código já envia supportsAllDrives.
 *
 * Preparação (uma vez)
 * --------------------
 *   1. Crie o Drive compartilhado "Hydrone" e, dentro dele, a pasta raiz.
 *   2. Descubra a service account da função:
 *        gcloud run services describe <fn> --region=<região> --format='value(spec.template.spec.serviceAccountName)'
 *      (por padrão, <project>@appspot.gserviceaccount.com)
 *   3. Compartilhe o Drive compartilhado com esse e-mail como **Gerenciador de
 *      conteúdo** (Content manager).
 *   4. Habilite a Drive API no projeto:  gcloud services enable drive.googleapis.com
 *   5. Defina a variável de ambiente em functions/.env:
 *        GOOGLE_DRIVE_ROOT_FOLDER_ID=<id da pasta raiz>
 *
 * Deploy
 * ------
 *   firebase deploy --only functions
 */

const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { setGlobalOptions, logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { google } = require("googleapis");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"];
// Flags obrigatórias para operar dentro de um Drive compartilhado.
const SHARED = { supportsAllDrives: true, includeItemsFromAllDrives: true };

let _drive = null;
async function driveClient() {
  if (_drive) return _drive;
  // ADC: usa a identidade da própria função. Nenhuma chave JSON no repositório.
  const auth = new google.auth.GoogleAuth({ scopes: DRIVE_SCOPE });
  _drive = google.drive({ version: "v3", auth: await auth.getClient() });
  return _drive;
}

/** Escapa aspas simples em nomes usados na query do Drive. */
const q = (s) => String(s).replace(/'/g, "\\'");

/**
 * Devolve o id da subpasta `nome` dentro de `paiId`, criando-a se não existir.
 *
 * Idempotência: uploads simultâneos de duas pessoas no mesmo ensaio criariam
 * duas pastas com o mesmo nome (o Drive permite homônimos). Por isso o id fica
 * cacheado num doc do Firestore e a criação acontece dentro de uma transação —
 * quem perder a corrida reaproveita o id de quem ganhou.
 */
async function pastaIdempotente(paiId, nome) {
  const chave = `${paiId}:${nome}`.replace(/\//g, "_");
  const cacheRef = db.collection("drive_folders").doc(chave);

  const cache = await cacheRef.get();
  if (cache.exists && cache.data().folderId) return cache.data().folderId;

  const drive = await driveClient();
  // Alguém pode ter criado a pasta fora do app: procure antes de criar.
  const achou = await drive.files.list({
    q: `name='${q(nome)}' and '${q(paiId)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)", pageSize: 1, ...SHARED,
  });

  let folderId = achou.data.files?.[0]?.id;
  if (!folderId) {
    const criada = await drive.files.create({
      requestBody: { name: nome, mimeType: "application/vnd.google-apps.folder", parents: [paiId] },
      fields: "id", ...SHARED,
    });
    folderId = criada.data.id;
  }

  await db.runTransaction(async (tx) => {
    const atual = await tx.get(cacheRef);
    if (atual.exists && atual.data().folderId) { folderId = atual.data().folderId; return; }
    tx.set(cacheRef, { folderId, parentId: paiId, nome, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });

  return folderId;
}

/**
 * Rótulo da categoria, para nomear a subpasta de nível 2. Cópia de CATEGORIAS
 * (src/lib/requisitos.js): o deploy da função só envia functions/, então não dá
 * para importar de lá. Renomear lá exige renomear aqui.
 */
const LABEL_CATEGORIA = {
  manobra: "Manobra de pouso · HUAUV/USV",
  bancada: "Bancada de propulsão bimodal",
  veiculo: "Experimento de campo",
};
const rotuloTipo = (modo) => LABEL_CATEGORIA[modo] || "Outros";

/** YYYY-MM-DD, caindo na data do upload se o experimento não tiver data. */
const pastaData = (data) => (/^\d{4}-\d{2}-\d{2}$/.test(data || "") ? data : new Date().toISOString().slice(0, 10));

// ──────────────────────────────────────────────────────────────────────────
// Trigger principal: arquivo finalizado no Storage → cópia no Drive
// ──────────────────────────────────────────────────────────────────────────
exports.espelharAnexoNoDrive = onObjectFinalized(
  { memory: "1GiB", timeoutSeconds: 540, cpu: 1 },
  async (event) => {
    const objeto = event.data;
    const caminho = objeto.name || "";
    if (!caminho.startsWith("attachments/")) return;

    if (!ROOT_FOLDER_ID) {
      logger.error("GOOGLE_DRIVE_ROOT_FOLDER_ID não definido — cópia para o Drive ignorada.", { caminho });
      return;
    }

    const expId = objeto.metadata?.expId;
    if (!expId) { logger.warn("Anexo sem expId no customMetadata", { caminho }); return; }

    // Localiza o doc de metadados criado pelo cliente (chave natural: storagePath).
    const anexos = db.collection("experiments").doc(expId).collection("attachments");
    const achado = await anexos.where("storagePath", "==", caminho).limit(1).get();
    if (achado.empty) { logger.warn("Doc de anexo ainda não existe", { caminho }); return; }
    const anexoRef = achado.docs[0].ref;

    // Reentrância: um retry do Storage não deve duplicar o arquivo no Drive.
    if (achado.docs[0].data()?.drive?.status === "ok") return;

    await anexoRef.update({ "drive.status": "enviando" });

    try {
      const expSnap = await db.collection("experiments").doc(expId).get();
      const exp = expSnap.data() || {};

      const pastaDataId = await pastaIdempotente(ROOT_FOLDER_ID, pastaData(exp.data));
      const pastaTipoId = await pastaIdempotente(pastaDataId, rotuloTipo(exp.modo));

      const nomeArquivo = caminho.split("/").pop();
      const bucket = admin.storage().bucket(objeto.bucket);

      // Stream direto do Storage para o Drive: o arquivo nunca é carregado
      // inteiro em memória, então vídeo de ensaio não estoura a função.
      const drive = await driveClient();
      const criado = await drive.files.create({
        requestBody: { name: nomeArquivo, parents: [pastaTipoId] },
        media: {
          mimeType: objeto.contentType || "application/octet-stream",
          body: bucket.file(caminho).createReadStream(),
        },
        fields: "id,name,mimeType,webViewLink",
        ...SHARED,
      });

      const { id, name, mimeType, webViewLink } = criado.data;
      await anexoRef.update({
        drive: { status: "ok", fileId: id, name, mimeType, webViewLink, erro: null },
        driveSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Espelha o metadado no documento do experimento, como pedido: um array
      // de anexos legível sem abrir a subcoleção.
      await db.collection("experiments").doc(expId).update({
        driveAttachments: admin.firestore.FieldValue.arrayUnion({ fileId: id, name, mimeType, webViewLink }),
      });

      logger.info("Anexo espelhado no Drive", { expId, fileId: id, nomeArquivo });
    } catch (e) {
      logger.error("Falha ao espelhar anexo no Drive", { caminho, erro: e.message });
      await anexoRef.update({ drive: { status: "erro", erro: String(e.message).slice(0, 300) } });
    }
  });

// ──────────────────────────────────────────────────────────────────────────
// Remoção: apagar o anexo no app manda o arquivo para a lixeira do Drive
// ──────────────────────────────────────────────────────────────────────────
exports.removerAnexoDoDrive = onDocumentDeleted(
  "experiments/{expId}/attachments/{anexoId}",
  async (event) => {
    const dados = event.data?.data();
    const fileId = dados?.drive?.fileId;
    if (!fileId) return;
    try {
      const drive = await driveClient();
      // trashed em vez de delete: remoção acidental continua recuperável.
      await drive.files.update({ fileId, requestBody: { trashed: true }, ...SHARED });
      await db.collection("experiments").doc(event.params.expId).update({
        driveAttachments: admin.firestore.FieldValue.arrayRemove({
          fileId, name: dados.drive.name, mimeType: dados.drive.mimeType, webViewLink: dados.drive.webViewLink,
        }),
      });
    } catch (e) {
      logger.error("Falha ao enviar arquivo do Drive para a lixeira", { fileId, erro: e.message });
    }
  });
