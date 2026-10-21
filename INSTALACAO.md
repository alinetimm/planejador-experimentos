# Planejador de Experimentos — Teste de Vácuo, Firestore e anexos no Drive

Tudo roda no plano **Spark** (gratuito) do Firebase: Auth e Firestore. Não há Firebase
Storage nem Cloud Functions — os dois exigem o plano Blaze.

## 1. Como os anexos chegam ao Drive

```
navegador ── token Google de quem anexa ──► Google Drive
                                              Hydrone / {data do ensaio} / {tipo de experimento}
    │
    └─ depois que o Drive confirma ──► Firestore: experiments/{id}/attachments/{id}
                                         drive = { fileId, name, mimeType, webViewLink }
```

- O arquivo vai **direto do navegador para o Drive**, por upload resumível com barra de
  progresso. Vídeo grande não passa por servidor nenhum.
- Quem grava é a **conta Google de quem está anexando**: o arquivo pertence a essa pessoa e
  ocupa a cota dela no Drive.
- O doc do anexo só é criado quando o Drive devolve o `fileId`. Se o envio falhar, não sobra
  registro pela metade.
- As pastas `{data}/{tipo}` são criadas na primeira vez e o id fica em `drive_folders/` no
  Firestore, para dois uploads simultâneos não criarem pastas homônimas.
- Remover um anexo no app manda o arquivo para a **lixeira** do Drive (recuperável). Na pasta
  de uma conta pessoal, só o dono do arquivo pode mandá-lo para a lixeira; quando outra pessoa
  remove, o registro sai do app e o app avisa que o arquivo continua no Drive.

### O que quem usa precisa saber

- **Anexar exige ter entrado com Google.** Quem entra por link de e-mail usa o resto do app
  normalmente, mas vê um aviso no lugar do botão de anexar.
- Na seção **Fotos e vídeos**, o botão começa como **Conectar ao Drive**: abre a janela do
  Google pedindo acesso ao Drive. Depois vira **Anexar**. O acesso vale 1 hora e fica só na
  memória da aba; ao recarregar a página ou depois de 1 hora, é preciso conectar de novo.
- Na primeira vez aparece **"O Google não verificou este app"** → *Avançado › Acessar*. Na
  tela seguinte, **marque a caixa do Google Drive**, senão o envio falha por falta de permissão.
- **Não feche a aba** enquanto um vídeo estiver subindo: o envio é feito pela própria aba.

## 2. Configuração (uma vez, tudo gratuito)

1. **Ativar a Google Drive API** no projeto — GCP Console › APIs e serviços › Biblioteca ›
   *Google Drive API* › Ativar. Ou:
   ```bash
   gcloud services enable drive.googleapis.com --project hydrone-6ca76
   ```
2. **Tela de consentimento** (GCP Console › APIs e serviços › Tela de permissão OAuth ›
   Público-alvo): já existe, criada pelo Firebase para o login Google. Se o status for
   **"Em produção"**, nada a fazer. Se for **"Teste"**, só as contas listadas em *Usuários de
   teste* conseguem liberar o Drive — adicione a equipe ou clique em *Publicar app*. O app não
   precisa passar por verificação; o limite sem verificação é de 100 pessoas.
3. **Compartilhar a pasta Hydrone** (`1d7cf-uRqeBp0wQSEmFe2HJtkRR1X3zuV`) com cada pessoa que
   vai anexar, como **Editor**.
4. **Publicar as regras do Firestore** (gratuito no Spark):
   ```bash
   npm install -g firebase-tools && firebase login
   firebase deploy --only firestore:rules
   ```
   Ou cole o conteúdo de `firestore.rules` em Firebase Console › Firestore › Regras.

Para usar outra pasta raiz, defina `VITE_DRIVE_FOLDER_ID` nas variáveis de ambiente da Vercel
(ou num `.env` local) e faça um novo deploy. O id é o trecho depois de `/folders/` na URL.

## 3. Schema

### `experiments/{id}`

```js
{
  ownerId, ownerName, editors: [uid],
  title, modo: "veiculo", kind, responsavel, data: "2026-10-20", resumoModo,

  bundleJson: "...",            // estado completo do app, com bundle.testeVacuo

  // desnormalizado: números de verdade, legível sem abrir o bundle
  testeVacuo: {
    realizado: true,
    pressaoInicial: 250,        // mmHg (magnitude de vácuo)
    pressaoFinal: 238,          // mmHg após tempoDecorridoMinutos
    quedaPressao: 12,           // = inicial - final, calculado
    unidade: "mmHg",
    tempoDecorridoMinutos: 10,
    limiteQueda: 10,
    vazamentoDetectado: true,
    statusEstanqueidade: "reprovado",   // pendente | aprovado | reprovado | suspeito
    observacoes, responsavel,
  },
  statusEstanqueidade: "reprovado",     // espelhado no topo p/ a lista do time

  driveAttachments: [ { fileId, name, mimeType, webViewLink } ],
  createdAt, updatedAt,
}
```

### `experiments/{id}/attachments/{id}`

```js
{
  type, kind: "photo"|"video"|"log"|"outro", itemId,
  fileName, contentType, size,
  uploadedBy,
  drive: { status: "ok", fileId, name, mimeType, webViewLink },
  createdAt,
}
```

Registros de antes da troca para o Drive direto, sem `drive.webViewLink`, aparecem como
"envio não concluído" e podem ser removidos.

### `drive_folders/{pastaPai}:{nome}`

```js
{ folderId, nome, parentId, createdAt }   // criado uma vez, nunca alterado
```

### Renomeação "Experimento de campo"

Em `CATEGORIAS` (`src/lib/requisitos.js`) só o rótulo mudou; o id `"veiculo"` continua o
mesmo, porque é ele que está gravado em `bundle.categoria` e no campo `modo` dos documentos
já salvos. A UI lê o rótulo por `categoriaMeta(id).label`, então experimentos antigos exibem
o nome novo sem migração. O rótulo também nomeia a subpasta de tipo no Drive.

### Convenção de sinal do vácuo

As pressões são lidas como **magnitude de vácuo** (quanto abaixo da atmosfera), que é como o
vacuômetro é lido na bancada. Por isso `quedaPressao = pressaoInicial − pressaoFinal` e
`ΔP > 0` significa perda de vácuo, isto é, ar entrando. `ΔP < 0` não é esperado em sistema
isolado e vira status `suspeito` em vez de ser lido como aprovação — se a sua instrumentação
registrar pressão absoluta, inverta a subtração em `lib/vacuo.js`.

O cronômetro de 10 min deriva de um timestamp gravado no estado (`cronometroIniciadoEm`),
então continua correto se a pessoa trocar de tela ou recarregar o app. Reprovado pinta o
card, entra na folha de campo e vira etiqueta na lista do time, mas não bloqueia o fluxo.
