import { db, auth } from "./firebase";
import {
  GoogleAuthProvider, signInWithPopup, reauthenticateWithPopup, signOut, onAuthStateChanged,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { normalizarVacuo, migrarCategoria } from "./lib/vacuo";


export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) await ensureProfile(user);
    callback(user || null);
  });
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  const { user } = await signInWithPopup(auth, provider);
  await ensureProfile(user);
  return user;
}

export function signOutUser() { return signOut(auth); }

export function currentUid() { return auth.currentUser?.uid || null; }

// Checagem confiável de admin: lê a custom claim do token decodificado.
// Chame uma vez após o login e guarde o booleano no estado do app.
// (Logo após conceder o claim, peça à pessoa para sair e entrar para o token recarregar.)
export async function isAdminAsync() {
  const u = auth.currentUser;
  if (!u) return false;
  const t = await u.getIdTokenResult();
  return t.claims.admin === true;
}

// (Opcional) Magic link por e-mail. Requer habilitar "Email link" no console
// e configurar o domínio. Deixe Google sign-in como caminho principal.
export async function sendMagicLink(email) {
  const actionCodeSettings = { url: window.location.origin + "/finishSignIn", handleCodeInApp: true };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem("emailForSignIn", email);
}
export async function completeMagicLinkIfPresent() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  let email = window.localStorage.getItem("emailForSignIn");
  if (!email) email = window.prompt("Confirme seu e-mail para entrar:");
  const { user } = await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem("emailForSignIn");
  await ensureProfile(user);
  return user;
}

// ──────────────────────── PERFIS ────────────────────────

async function ensureProfile(user) {
  const refp = doc(db, "profiles", user.uid);
  const snap = await getDoc(refp);
  const base = {
    uid: user.uid,
    name: user.displayName || (user.email ? user.email.split("@")[0] : "Sem nome"),
    email: user.email || "",
    photoURL: user.photoURL || "",
  };
  if (!snap.exists()) {
    // role só é definida na criação; NUNCA pelo cliente depois (regras bloqueiam).
    await setDoc(refp, { ...base, role: "member", createdAt: serverTimestamp() });
  } else {
    // Mantém nome/email/foto atualizados, sem tocar em role.
    await updateDoc(refp, base);
  }
}

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "profiles", uid));
  return snap.exists() ? snap.data() : null;
}

export async function listProfiles() {
  const qs = await getDocs(query(collection(db, "profiles"), orderBy("name")));
  return qs.docs.map((d) => d.data());
}

// ────────────────────── EXPERIMENTOS ──────────────────────

const expCol = () => collection(db, "experiments");

// Lista resumida para a tabela compartilhada (todos os usuários autenticados leem tudo).
// `statusEstanqueidade` fica no topo do doc para a lista mostrar o resultado do
// teste de vácuo sem precisar baixar o bundle inteiro.
function expSummary(d) {
  const x = d.data();
  return {
    id: d.id, title: x.title, modo: migrarCategoria(x.modo), kind: x.kind,
    responsavel: x.responsavel || "", data: x.data || "", resumoModo: x.resumoModo || "",
    statusEstanqueidade: x.statusEstanqueidade || null,
    ownerId: x.ownerId, ownerName: x.ownerName, editors: x.editors || [],
    createdAt: x.createdAt, updatedAt: x.updatedAt,
  };
}

export async function listExperiments() {
  const qs = await getDocs(query(expCol(), orderBy("updatedAt", "desc")));
  return qs.docs.map(expSummary);
}

// Versão em tempo real (a lista se atualiza sozinha quando alguém salva).
export function watchExperiments(callback) {
  return onSnapshot(query(expCol(), orderBy("updatedAt", "desc")),
    (qs) => callback(qs.docs.map(expSummary)));
}

// Carrega o experimento completo e devolve o bundle já parseado.
export async function getExperiment(id) {
  const snap = await getDoc(doc(db, "experiments", id));
  if (!snap.exists()) return null;
  const x = snap.data();
  let bundle = null;
  try { bundle = x.bundleJson ? JSON.parse(x.bundleJson) : null; } catch { bundle = null; }
  if (bundle) bundle.categoria = migrarCategoria(bundle.categoria);
  return { id: snap.id, ...x, bundle };
}

// Cria (sem id) ou atualiza (com id). `bundle` é o objeto de estado do app.
// title/modo/kind ficam no topo do doc para alimentar a lista sem baixar o bundle inteiro.
// `testeVacuo` é gravado DESNORMALIZADO (números, não strings) além de dentro do
// bundle, para consultas por vazamento sem abrir o bundle.
export async function saveExperiment({ id, title, modo, kind, responsavel, data, resumoModo, bundle }) {
  const bundleJson = JSON.stringify(bundle ?? {});
  const vacuo = normalizarVacuo(bundle?.testeVacuo);
  const campos = {
    title, modo, kind, responsavel, data, resumoModo, bundleJson,
    testeVacuo: vacuo,
    statusEstanqueidade: vacuo ? vacuo.statusEstanqueidade : null,
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await updateDoc(doc(db, "experiments", id), campos);
    return id;
  }
  const u = auth.currentUser;
  const profile = u ? await getProfile(u.uid) : null;
  const refd = await addDoc(expCol(), {
    ownerId: u.uid,
    ownerName: profile?.name || u.displayName || "Sem nome",
    editors: [],
    createdAt: serverTimestamp(),
    ...campos,
  });
  return refd.id;
}

export function deleteExperiment(id) { return deleteDoc(doc(db, "experiments", id)); }

// Conceder / revogar permissão de edição a outro usuário (só owner/admin pelas regras).
export function grantEditor(expId, uid) {
  return updateDoc(doc(db, "experiments", expId), { editors: arrayUnion(uid) });
}
export function revokeEditor(expId, uid) {
  return updateDoc(doc(db, "experiments", expId), { editors: arrayRemove(uid) });
}

// Helper de UI: a pessoa pode editar este experimento?
export function canEdit(exp, uid, admin) {
  if (!uid) return false;
  if (admin) return true;
  return exp.ownerId === uid || (exp.editors || []).includes(uid);
}

// ──────────────────────── ANEXOS ────────────────────────
// Fotos, vídeos e logs ligados a um experimento (e, opcionalmente, a um item de
// checklist via itemId). O navegador envia o arquivo direto para o Google Drive,
// com o token Google de quem está enviando, nesta árvore:
//
//   Hydrone / DD-MM-AAAA / {nome do experimento} / Folha_de_Campo.pdf
//                                                / Fotos / …
//                                                / Logs / …
//
// Firebase Storage e Cloud Functions ficaram de fora porque exigem o plano Blaze.
// O doc do anexo só é criado depois que o Drive confirma o arquivo, então não
// existe anexo "pendente" no Firestore.

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
// Aceita o id ou o link inteiro da pasta: colar "…/folders/<id>?usp=sharing" é
// o engano mais comum, e qualquer sobra no id faz o Drive responder 404.
const idDaPasta = (v) => String(v).match(/folders\/([\w-]+)/)?.[1] || String(v).match(/[\w-]+/)?.[0] || "";
const PASTA_RAIZ = idDaPasta(import.meta.env.VITE_DRIVE_FOLDER_ID || "1d7cf-uRqeBp0wQSEmFe2HJtkRR1X3zuV");
const TIPO_PASTA = "application/vnd.google-apps.folder";
const SEM_PROGRESSO_MS = 60_000;

// Só em memória: o token dá acesso ao Drive inteiro de quem anexa, então não vai
// para localStorage. O Google o emite com validade de 1 h.
let tokenDrive = null;   // { valor, expiraEm }

/** Anexar exige login Google: é a conta Google que grava no Drive. */
export const podeUsarDrive = () => !!auth.currentUser?.providerData.some(p => p.providerId === "google.com");
export const driveConectado = () => !!tokenDrive && Date.now() < tokenDrive.expiraEm;

/** Pede ao Google o acesso ao Drive. Abre popup, então só pode ser chamado a partir de um clique. */
export async function conectarDrive() {
  const u = auth.currentUser;
  if (!podeUsarDrive()) throw new Error("para anexar, entre no app com a conta Google.");
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  provider.setCustomParameters({ login_hint: u.email || "" });
  const res = await reauthenticateWithPopup(u, provider);
  const cred = GoogleAuthProvider.credentialFromResult(res);
  if (!cred?.accessToken) throw new Error("o Google não devolveu o acesso ao Drive.");
  // 55 min em vez de 60: não começar um upload com o token prestes a expirar.
  tokenDrive = { valor: cred.accessToken, expiraEm: Date.now() + 55 * 60_000 };
}

/** Mensagem legível para falhas de conexão ou de envio ao Drive. */
export function explicarErroDrive(e) {
  if (e?.code === "auth/popup-blocked") return "o navegador bloqueou a janela do Google — libere popups para este site.";
  if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return "a janela do Google foi fechada antes de liberar o acesso.";
  if (e?.code === "auth/user-mismatch") return "escolha na janela do Google a mesma conta com que você entrou no app.";
  if (e?.code === "permission-denied") return "o Firestore recusou o registro — as regras de firestore.rules foram publicadas? Se sim, confira se você é dono ou editor deste experimento.";
  if (e?.status === 401) return "o acesso ao Drive expirou — clique em Conectar ao Drive de novo.";
  if (e?.status === 403 && /scope|insufficient/i.test(e.message)) return "o acesso ao Drive não foi liberado — marque a caixa do Google Drive na janela do Google.";
  if (e?.status === 403 && /storageQuota|quota/i.test(e.message)) return "o Drive da sua conta está sem espaço.";
  if (e?.status === 404) return "a pasta Hydrone não foi encontrada — ela precisa estar compartilhada com a sua conta como editor.";
  return e?.message || String(e);
}

async function erroDaResposta(r) {
  let msg = "";
  try { msg = (await r.json()).error?.message || ""; } catch { /* corpo sem JSON */ }
  const e = new Error(msg || `o Drive respondeu HTTP ${r.status}.`);
  e.status = r.status;
  if (r.status === 401) tokenDrive = null;
  return e;
}

async function driveApi(caminho, { metodo = "GET", corpo, params = {} } = {}) {
  if (!driveConectado()) { const e = new Error("sem acesso ao Drive."); e.status = 401; throw e; }
  const url = new URL(DRIVE_API + caminho);
  for (const [k, v] of Object.entries({ supportsAllDrives: "true", ...params })) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${tokenDrive.valor}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw await erroDaResposta(r);
  return r.status === 204 ? null : r.json();
}

const aspasQuery = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/**
 * Id da pasta `folderName` dentro de `parentFolderId`, criando-a só se ainda não
 * existir — enviar mais arquivos no mesmo dia reaproveita as pastas do dia.
 */
export async function findOrCreateFolder(folderName, parentFolderId) {
  const achou = await driveApi("/files", { params: {
    q: `name='${aspasQuery(folderName)}' and '${aspasQuery(parentFolderId)}' in parents and mimeType='${TIPO_PASTA}' and trashed=false`,
    fields: "files(id)", pageSize: "1", includeItemsFromAllDrives: "true",
  } });
  if (achou.files?.[0]?.id) return achou.files[0].id;
  const criada = await driveApi("/files", { metodo: "POST", corpo: { name: folderName, mimeType: TIPO_PASTA, parents: [parentFolderId] }, params: { fields: "id" } });
  return criada.id;
}

/** "2026-10-21" → "21-10-2026"; sem data válida, usa o dia de hoje. */
export function nomePastaData(dataIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso || "");
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

export const linkPastaDrive = (pastaId) => `https://drive.google.com/drive/folders/${pastaId}`;

/**
 * Pasta do experimento dentro da pasta do dia. É reconhecida pelo id do
 * experimento gravado nela (appProperties), não pelo nome: assim um experimento
 * renomeado continua na mesma pasta, e dois experimentos com o mesmo nome no
 * mesmo dia não misturam arquivos — o segundo ganha " (2)" no nome.
 */
async function pastaDoExperimento(dataId, nome, expId) {
  const daqui = `'${aspasQuery(dataId)}' in parents and mimeType='${TIPO_PASTA}' and trashed=false`;
  const [minha, irmas] = await Promise.all([
    driveApi("/files", { params: { q: `${daqui} and appProperties has { key='expId' and value='${aspasQuery(expId)}' }`, fields: "files(id,name)", pageSize: "1", includeItemsFromAllDrives: "true" } }),
    driveApi("/files", { params: { q: daqui, fields: "files(name)", pageSize: "1000", includeItemsFromAllDrives: "true" } }),
  ]);
  const usados = new Set((irmas.files || []).map(f => f.name));
  const achada = minha.files?.[0];
  if (achada) {
    if (achada.name !== nome && !usados.has(nome)) await driveApi(`/files/${achada.id}`, { metodo: "PATCH", corpo: { name: nome } });
    return achada.id;
  }
  let livre = nome;
  for (let n = 2; usados.has(livre); n++) livre = `${nome} (${n})`;
  const criada = await driveApi("/files", { metodo: "POST", corpo: { name: livre, mimeType: TIPO_PASTA, parents: [dataId], appProperties: { expId } }, params: { fields: "id" } });
  return criada.id;
}

/**
 * Pastas de destino de um envio: a do dia na raiz Hydrone, a do experimento
 * dentro dela e, na do experimento, Fotos e Logs. As duas subpastas são criadas
 * sempre, para todo experimento ter a mesma forma.
 * @returns {Promise<{dataId, experimentoId, fotosId, logsId, nomeData}>}
 */
export async function pastasDoEnvio(dataIso, nomeExperimento, expId) {
  const nomeData = nomePastaData(dataIso);
  const dataId = await findOrCreateFolder(nomeData, PASTA_RAIZ);
  const experimentoId = await pastaDoExperimento(dataId, nomeExperimento, expId);
  const [fotosId, logsId] = await Promise.all([findOrCreateFolder("Fotos", experimentoId), findOrCreateFolder("Logs", experimentoId)]);
  return { dataId, experimentoId, fotosId, logsId, nomeData };
}

function inferKind(file) {
  const n = (file.name || "").toLowerCase();
  if (file.type?.startsWith("image/")) return "photo";
  if (file.type?.startsWith("video/")) return "video";
  if (n.endsWith(".bin") || n.endsWith(".tlog") || n.endsWith(".log")) return "log";
  return "outro";
}

async function abrirSessaoDeUpload(metadados, tipo, tamanho) {
  const r = await fetch(`${DRIVE_UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenDrive.valor}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": tipo,
      "X-Upload-Content-Length": String(tamanho),
    },
    body: JSON.stringify(metadados),
  });
  if (!r.ok) throw await erroDaResposta(r);
  const sessao = r.headers.get("Location");
  if (!sessao) throw new Error("o Drive não informou a URL da sessão de upload.");
  return sessao;
}

// XHR em vez de fetch: fetch não informa o progresso do envio.
function enviarComProgresso(sessao, file, tipo, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let vigia;
    const rearmar = () => {
      clearTimeout(vigia);
      vigia = setTimeout(() => { xhr.abort(); reject(new Error(`o envio parou por ${SEM_PROGRESSO_MS / 1000} s — confira a conexão.`)); }, SEM_PROGRESSO_MS);
    };
    xhr.open("PUT", sessao);
    xhr.setRequestHeader("Content-Type", tipo);
    xhr.upload.onprogress = (ev) => { rearmar(); if (ev.lengthComputable) onProgress?.(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => {
      clearTimeout(vigia);
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("resposta inesperada do Drive.")); }
      } else {
        let msg = "";
        try { msg = JSON.parse(xhr.responseText).error?.message || ""; } catch { /* corpo sem JSON */ }
        const e = new Error(msg || `o Drive respondeu HTTP ${xhr.status}.`);
        e.status = xhr.status;
        reject(e);
      }
    };
    xhr.onerror = () => { clearTimeout(vigia); reject(new Error("a conexão caiu durante o envio.")); };
    rearmar();
    xhr.send(file);
  });
}

/** Fotos e vídeos vão para "fotos"; qualquer outro arquivo é log. */
export const grupoDoAnexo = (att) => att.grupo || (att.kind === "photo" || att.kind === "video" ? "fotos" : "logs");

/**
 * Envia o arquivo para `pastaId` no Drive e registra o anexo no Firestore.
 * Exige conectarDrive() antes.
 * @param {string} expId
 * @param {File} file
 * @param {{pastaId: string, grupo: "fotos"|"logs", itemId?: string|null, onProgress?: (pct:number)=>void}} opts
 */
export async function uploadAttachment(expId, file, { pastaId, grupo, itemId = null, onProgress } = {}) {
  const u = auth.currentUser;
  if (!u) throw new Error("não autenticado.");
  const kind = inferKind(file);
  const tipo = file.type || "application/octet-stream";

  const sessao = await abrirSessaoDeUpload({
    name: file.name || "arquivo",
    parents: [pastaId],
    appProperties: { expId, itemId: itemId || "", uid: u.uid },
  }, tipo, file.size);
  const criado = await enviarComProgresso(sessao, file, tipo, onProgress);
  const drive = { status: "ok", fileId: criado.id, name: criado.name, mimeType: criado.mimeType, webViewLink: criado.webViewLink };

  try {
    const refd = await addDoc(collection(db, "experiments", expId, "attachments"), {
      type: file.type?.startsWith("image/") ? "photo" : "file",
      kind, grupo, itemId,
      fileName: file.name || "arquivo",
      contentType: tipo,
      size: file.size || 0,
      uploadedBy: u.uid,
      drive,
      createdAt: serverTimestamp(),
    });
    // Cópia no doc do experimento: lista de anexos legível sem abrir a subcoleção.
    await updateDoc(doc(db, "experiments", expId), {
      driveAttachments: arrayUnion({ fileId: drive.fileId, name: drive.name, mimeType: drive.mimeType, webViewLink: drive.webViewLink }),
    }).catch(() => { /* a subcoleção já tem o registro */ });
    return { id: refd.id, kind, fileName: file.name, drive };
  } catch (e) {
    // Sem o registro no app o arquivo ficaria órfão no Drive.
    await driveApi(`/files/${drive.fileId}`, { metodo: "PATCH", corpo: { trashed: true } }).catch(() => {});
    throw e;
  }
}

export async function listAttachments(expId) {
  const qs = await getDocs(query(
    collection(db, "experiments", expId, "attachments"), orderBy("createdAt", "asc")));
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchAttachments(expId, callback) {
  return onSnapshot(query(
    collection(db, "experiments", expId, "attachments"), orderBy("createdAt", "asc")),
    (qs) => callback(qs.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/**
 * Remove o anexo do app e manda o arquivo para a lixeira do Drive (recuperável).
 * Devolve um aviso quando o arquivo não pôde ir para a lixeira — por exemplo,
 * sem conexão ao Drive ou por ser de outra pessoa (no Drive pessoal, só o dono
 * do arquivo pode mandá-lo para a lixeira).
 */
export async function deleteAttachment(expId, att) {
  let aviso = null;
  const d = att.drive;
  if (d?.fileId) {
    try { await driveApi(`/files/${d.fileId}`, { metodo: "PATCH", corpo: { trashed: true } }); }
    catch (e) { aviso = `o arquivo continua no Drive (${explicarErroDrive(e)})`; }
    await updateDoc(doc(db, "experiments", expId), {
      driveAttachments: arrayRemove({ fileId: d.fileId, name: d.name, mimeType: d.mimeType, webViewLink: d.webViewLink }),
    }).catch(() => {});
  }
  await deleteDoc(doc(db, "experiments", expId, "attachments", att.id));
  return aviso;
}

// ──────────────────────── FOLHA DE CAMPO EM PDF ────────────────────────

/**
 * Grava a folha de campo em PDF em `pastaId` (a pasta do experimento). Na primeira vez
 * cria o arquivo; nas seguintes substitui o conteúdo do MESMO arquivo, então o
 * link não muda e as versões anteriores ficam no histórico de versões do Drive.
 * Exige conectarDrive() antes.
 * @returns {Promise<{fileId, webViewLink, pastaId, nome}>}
 */
export async function salvarFolhaNoDrive(expId, pdf, nomeArquivo, pastaId) {
  const exp = (await getDoc(doc(db, "experiments", expId))).data() || {};
  const anterior = exp.folhaPdf;

  let arquivo = null;
  if (anterior?.fileId) {
    try {
      const params = new URLSearchParams({ uploadType: "media", supportsAllDrives: "true", fields: "id,webViewLink,trashed" });
      // A data ou a pasta mudaram desde o último envio: o PDF muda de pasta junto.
      if (anterior.pastaId && anterior.pastaId !== pastaId) {
        params.set("addParents", pastaId);
        params.set("removeParents", anterior.pastaId);
      }
      const r = await fetch(`${DRIVE_UPLOAD}/${anterior.fileId}?${params}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenDrive.valor}`, "Content-Type": "application/pdf" },
        body: pdf,
      });
      if (!r.ok) throw await erroDaResposta(r);
      arquivo = await r.json();
      // Alguém mandou o PDF para a lixeira no Drive: recomeça com um arquivo novo em vez de ressuscitá-lo.
      if (arquivo.trashed) arquivo = null;
      else if (anterior.nome !== nomeArquivo) await driveApi(`/files/${arquivo.id}`, { metodo: "PATCH", corpo: { name: nomeArquivo } });
    } catch (e) {
      // 404: apagado de vez no Drive. Qualquer outro erro é real e sobe.
      if (e.status !== 404) throw e;
      arquivo = null;
    }
  }
  if (!arquivo) {
    const sessao = await abrirSessaoDeUpload({
      name: nomeArquivo,
      parents: [pastaId],
      appProperties: { expId, folhaDeCampo: "1" },
    }, "application/pdf", pdf.size);
    arquivo = await enviarComProgresso(sessao, pdf, "application/pdf");
  }

  const folhaPdf = { fileId: arquivo.id, webViewLink: arquivo.webViewLink, pastaId, nome: nomeArquivo };
  await updateDoc(doc(db, "experiments", expId), { folhaPdf: { ...folhaPdf, atualizadoEm: serverTimestamp() } });
  return folhaPdf;
}
