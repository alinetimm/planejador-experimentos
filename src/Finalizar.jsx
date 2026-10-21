import { useEffect, useMemo, useRef, useState } from "react";
import {
  Images, FileVideo, FileText, Activity, Folder, FolderOpen, CloudUpload, CheckCircle2, Loader2, Circle,
  AlertCircle, ExternalLink, Trash2, Download, FileJson, Upload, Plus,
} from "lucide-react";
import * as cloud from "./cloud";
import { gerarPdfFolha } from "./lib/folhaPdf";

const tamanho = (b) => {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

export const chaveArquivo = (f) => `${f.name}-${f.size}-${f.lastModified}`;

// Cada experimento tem a própria pasta, então o nome do PDF não precisa distinguir nada.
const NOME_PDF = "Folha_de_Campo.pdf";

function Miniatura({ arquivo, att, iconePadrao: IconePadrao }) {
  const [falhou, setFalhou] = useState(false);
  // URL local para a prévia do que ainda não subiu; revogada ao sair da tela.
  const urlLocal = useMemo(() => (arquivo?.type?.startsWith("image/") ? URL.createObjectURL(arquivo) : null), [arquivo]);
  useEffect(() => () => { if (urlLocal) URL.revokeObjectURL(urlLocal); }, [urlLocal]);
  // Já no Drive: a miniatura usa a sessão Google do navegador de quem está vendo.
  const src = urlLocal || (att?.kind === "photo" && att.drive?.fileId ? `https://drive.google.com/thumbnail?id=${att.drive.fileId}&sz=w160` : null);
  const Icone = (arquivo?.type || att?.contentType || "").startsWith("video/") ? FileVideo : IconePadrao;
  if (src && !falhou) return <img src={src} alt="" onError={() => setFalhou(true)} className="w-11 h-11 rounded object-cover shrink-0 bg-slate-100" />;
  return <span className="w-11 h-11 rounded bg-slate-100 flex items-center justify-center shrink-0"><Icone size={18} className="text-slate-400" /></span>;
}

/** Card de seleção de arquivos: o que vai subir no próximo envio e o que já está no Drive. */
function CardArquivos({ titulo, descricao, Icone, accept, pendentes, onAdicionar, onRemoverPendente, progresso, enviados, onRemoverEnviado, bloqueado }) {
  const inputRef = useRef(null);
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <Icone size={15} className="text-blue-700" /> {titulo}
          {pendentes.length + enviados.length > 0 && <span className="text-blue-700">({pendentes.length + enviados.length})</span>}
        </h2>
        {!bloqueado && (
          <button onClick={() => inputRef.current?.click()} className="text-sm bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Plus size={15} /> Adicionar arquivos
          </button>
        )}
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
          onChange={e => { onAdicionar([...e.target.files]); e.target.value = ""; }} />
      </div>
      <p className="text-xs text-slate-500 mb-3">{descricao}</p>

      {pendentes.length === 0 && enviados.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4">Nenhum arquivo ainda.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {pendentes.map((f, idx) => {
            const pct = progresso[chaveArquivo(f)];
            return (
              <li key={chaveArquivo(f)} className="flex items-center gap-2.5 border border-dashed border-blue-200 bg-blue-50/40 rounded-lg p-2">
                <Miniatura arquivo={f} iconePadrao={Icone} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate" title={f.name}>{f.name}</div>
                  <div className="text-xs text-slate-400">{tamanho(f.size)}</div>
                  {pct === undefined
                    ? <div className="text-[11px] text-blue-700">aguardando envio</div>
                    : <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1"><div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>}
                </div>
                {!bloqueado && (
                  <button onClick={() => onRemoverPendente(idx)} title="Tirar da lista" className="text-slate-300 hover:text-rose-500 p-1 shrink-0"><Trash2 size={15} /></button>
                )}
              </li>
            );
          })}
          {enviados.map(att => (
            <li key={att.id} className="flex items-center gap-2.5 border border-slate-200 rounded-lg p-2">
              <Miniatura att={att} iconePadrao={Icone} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800 truncate" title={att.fileName}>{att.fileName}</div>
                <div className="text-xs text-slate-400">{tamanho(att.size)}</div>
                {att.drive?.webViewLink
                  ? <div className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 size={11} /> no Drive</div>
                  : <div className="text-[11px] text-rose-600 flex items-center gap-1"><AlertCircle size={11} /> envio não concluído — remova</div>}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {att.drive?.webViewLink && <a href={att.drive.webViewLink} target="_blank" rel="noreferrer" title="Abrir no Google Drive" className="text-slate-400 hover:text-blue-600 p-1"><ExternalLink size={15} /></a>}
                {!bloqueado && <button onClick={() => onRemoverEnviado(att)} title="Remover" className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={15} /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ICONE_ETAPA = {
  espera: <Circle size={14} className="text-slate-300 shrink-0" />,
  andamento: <Loader2 size={14} className="text-blue-600 animate-spin shrink-0" />,
  ok: <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />,
  erro: <AlertCircle size={14} className="text-rose-600 shrink-0" />,
};

/**
 * Etapa 3 — fechamento do ensaio. Fotos/vídeos e logs são escolhidos aqui e só
 * sobem no envio final, junto com a folha de campo em PDF, para a pasta do
 * experimento: Hydrone / DD-MM-AAAA / {nome do experimento} / (PDF, Fotos/, Logs/).
 *
 * Os arquivos escolhidos ficam no estado do App (`pendentes`), não aqui, para não
 * se perderem quando a pessoa volta à Etapa 2 e retorna.
 */
export default function Finalizar({
  expId, readOnly, nomeExperimento, dataIso, folhaPdf, resumo,
  pendentes, setPendentes,
  onSalvarExperimento, gerarDadosFolha, onFolhaSalva,
  onBaixarPdf, onBaixarCsv, onExportarJson, onImportarJson,
}) {
  const [enviados, setEnviados] = useState([]);
  const [etapas, setEtapas] = useState(null);
  const [progresso, setProgresso] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [pastaEnviada, setPastaEnviada] = useState(null);   // { id, nome } da pasta do experimento no último envio
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!expId) { setEnviados([]); return; }
    return cloud.watchAttachments(expId, setEnviados);
  }, [expId]);

  const enviadosPor = (g) => enviados.filter(a => cloud.grupoDoAnexo(a) === g);
  const fotosEnviadas = enviadosPor("fotos");
  const logsEnviados = enviadosPor("logs");
  const podeEnviar = cloud.podeUsarDrive() && !readOnly && !!nomeExperimento;
  const nomeData = cloud.nomePastaData(dataIso);

  const adicionar = (grupo) => (files) => setPendentes(p => {
    const ja = new Set(p[grupo].map(chaveArquivo));
    return { ...p, [grupo]: [...p[grupo], ...files.filter(f => !ja.has(chaveArquivo(f)))] };
  });
  const tirarPendente = (grupo) => (idx) => setPendentes(p => ({ ...p, [grupo]: p[grupo].filter((_, i) => i !== idx) }));

  const removerEnviado = async (att) => {
    if (!window.confirm(`Remover "${att.fileName}"? O arquivo sai do app e vai para a lixeira do Drive.`)) return;
    setErro(""); setAviso("");
    try {
      const msg = await cloud.deleteAttachment(expId, att);
      if (msg) setAviso(`"${att.fileName}" foi removido do app, mas ${msg}.`);
    } catch { setErro("Sem permissão para remover este anexo."); }
  };

  const marcar = (id, mudancas) => setEtapas(es => es.map(e => (e.id === id ? { ...e, ...mudancas } : e)));

  const enviarTudo = async () => {
    setErro(""); setAviso(""); setPastaEnviada(null);
    const fotos = [...pendentes.fotos];
    const logs = [...pendentes.logs];
    setEtapas([
      { id: "conectar", rotulo: "Conectando ao Google Drive", estado: "andamento" },
      { id: "salvar", rotulo: "Salvando o experimento", estado: "espera" },
      { id: "pastas", rotulo: "Verificando/criando pastas", estado: "espera" },
      { id: "pdf", rotulo: "Enviando PDF da folha de campo", estado: "espera" },
      { id: "fotos", rotulo: fotos.length ? `Enviando fotos e vídeos (0/${fotos.length})` : "Fotos e vídeos: nada novo para enviar", estado: "espera" },
      { id: "logs", rotulo: logs.length ? `Enviando logs (0/${logs.length})` : "Logs: nada novo para enviar", estado: "espera" },
    ]);
    setEnviando(true);
    let etapaAtual = "conectar";
    try {
      // O popup do Google precisa nascer do clique: nenhuma outra espera antes dele.
      if (!cloud.driveConectado()) await cloud.conectarDrive();
      marcar("conectar", { estado: "ok" });

      etapaAtual = "salvar"; marcar("salvar", { estado: "andamento" });
      const salvo = await onSalvarExperimento();
      if (!salvo) throw new Error("não foi possível salvar o experimento (sem permissão?).");
      marcar("salvar", { estado: "ok" });

      etapaAtual = "pastas"; marcar("pastas", { estado: "andamento" });
      const pastas = await cloud.pastasDoEnvio(dataIso, salvo.title, salvo.id);
      setPastaEnviada({ id: pastas.experimentoId, nome: salvo.title });
      marcar("pastas", { estado: "ok", rotulo: `Pastas prontas: ${pastas.nomeData} / ${salvo.title} / Fotos, Logs` });
      // Falhar aqui não impede o envio: os arquivos sobem e o aviso explica o que faltou.
      try { await cloud.liberarEdicaoComLink(pastas.experimentoId); }
      catch (e) { setAviso(`Os arquivos foram enviados, mas não deu para liberar a edição para qualquer pessoa com o link: ${cloud.explicarErroDrive(e)}. Ajuste o compartilhamento da pasta no Drive.`); }

      // Daqui em diante uma falha não interrompe o resto: cada parte é independente.
      let falhas = 0;
      etapaAtual = "pdf"; marcar("pdf", { estado: "andamento", rotulo: "Gerando e enviando o PDF da folha de campo" });
      try {
        const pdf = await gerarPdfFolha(gerarDadosFolha());
        const salva = await cloud.salvarFolhaNoDrive(salvo.id, pdf, NOME_PDF, pastas.experimentoId);
        onFolhaSalva?.(salva);
        marcar("pdf", { estado: "ok", rotulo: "PDF da folha de campo enviado" });
      } catch (e) {
        falhas++;
        marcar("pdf", { estado: "erro", rotulo: `PDF da folha de campo: ${cloud.explicarErroDrive(e)}` });
      }

      for (const [grupo, lista, pastaId, nome] of [["fotos", fotos, pastas.fotosId, "fotos e vídeos"], ["logs", logs, pastas.logsId, "logs"]]) {
        if (!lista.length) { marcar(grupo, { estado: "ok" }); continue; }
        etapaAtual = grupo;
        let erros = 0;
        for (let i = 0; i < lista.length; i++) {
          const f = lista[i];
          marcar(grupo, { estado: "andamento", rotulo: `Enviando ${nome} (${i + 1}/${lista.length})` });
          setProgresso(p => ({ ...p, [chaveArquivo(f)]: 0 }));
          try {
            await cloud.uploadAttachment(salvo.id, f, {
              grupo, pastaId,
              onProgress: (pct) => setProgresso(p => ({ ...p, [chaveArquivo(f)]: pct })),
            });
            setPendentes(p => ({ ...p, [grupo]: p[grupo].filter(x => chaveArquivo(x) !== chaveArquivo(f)) }));
          } catch (e) {
            erros++;
            setErro(`Falha ao enviar ${f.name}: ${cloud.explicarErroDrive(e)}`);
          } finally {
            setProgresso(p => { const n = { ...p }; delete n[chaveArquivo(f)]; return n; });
          }
        }
        falhas += erros;
        marcar(grupo, erros
          ? { estado: "erro", rotulo: `${nome[0].toUpperCase() + nome.slice(1)}: ${lista.length - erros} de ${lista.length} enviados — os que falharam continuam na lista` }
          : { estado: "ok", rotulo: `${nome[0].toUpperCase() + nome.slice(1)}: ${lista.length} enviados` });
      }

      setEtapas(es => [...es, falhas
        ? { id: "fim", rotulo: "Concluído com falhas — confira os itens em vermelho e envie de novo", estado: "erro" }
        : { id: "fim", rotulo: "Concluído!", estado: "ok" }]);
    } catch (e) {
      marcar(etapaAtual, { estado: "erro" });
      setErro(cloud.explicarErroDrive(e));
    } finally {
      setEnviando(false);
    }
  };

  const pastaLink = pastaEnviada?.id || folhaPdf?.pastaId;
  const totalFotos = pendentes.fotos.length + fotosEnviadas.length;
  const totalLogs = pendentes.logs.length + logsEnviados.length;

  return (
    <div className="space-y-6">
      <CardArquivos
        titulo="Fotos e vídeos do experimento" Icone={Images} accept="image/*,video/*"
        descricao="Escolha as fotos e os vídeos do ensaio. Eles sobem para a pasta Fotos quando você clicar em enviar, no fim da página."
        pendentes={pendentes.fotos} onAdicionar={adicionar("fotos")} onRemoverPendente={tirarPendente("fotos")}
        progresso={progresso} enviados={fotosEnviadas} onRemoverEnviado={removerEnviado} bloqueado={enviando || readOnly} />

      <CardArquivos
        titulo="Logs do ensaio / voo" Icone={Activity} accept="*/*"
        descricao="Logs do veículo em qualquer formato (.bin, .tlog, .ulg, .csv, .bag, .db3, .zip…). Eles sobem para a pasta Logs."
        pendentes={pendentes.logs} onAdicionar={adicionar("logs")} onRemoverPendente={tirarPendente("logs")}
        progresso={progresso} enviados={logsEnviados} onRemoverEnviado={removerEnviado} bloqueado={enviando || readOnly} />

      <section className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><FileText size={15} className="text-blue-700" /> Folha de campo e exportação</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {[
            ["Checklist verificado", `${resumo.verificados}/${resumo.totalChecklist}`, resumo.falhas ? `${resumo.falhas} ${resumo.falhas === 1 ? "falhou" : "falharam"}` : null],
            ["Ensaios na planilha", resumo.ensaios],
            ["Fotos e vídeos", totalFotos, pendentes.fotos.length ? `${pendentes.fotos.length} a enviar` : null],
            ["Logs", totalLogs, pendentes.logs.length ? `${pendentes.logs.length} a enviar` : null],
          ].map(([rotulo, valor, extra]) => (
            <div key={rotulo} className="bg-slate-50 rounded-lg px-3 py-2">
              <div className="text-xs text-slate-500">{rotulo}</div>
              <div className="text-lg font-bold text-slate-800 tabular-nums">{valor}</div>
              {extra && <div className={`text-[11px] ${rotulo === "Checklist verificado" ? "text-rose-600" : "text-blue-700"}`}>{extra}</div>}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onBaixarPdf} className="text-sm bg-white border border-slate-200 hover:border-blue-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5"><FileText size={15} className="text-blue-700" /> Baixar folha de campo (PDF)</button>
          {onBaixarCsv && <button onClick={onBaixarCsv} className="text-sm bg-white border border-slate-200 hover:border-blue-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5"><Download size={15} className="text-blue-700" /> Baixar CSV</button>}
          <button onClick={onExportarJson} className="text-sm bg-white border border-slate-200 hover:border-blue-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5"><FileJson size={15} className="text-blue-700" /> Exportar (.json)</button>
          <label className="text-sm bg-white border border-slate-200 hover:border-blue-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"><Upload size={15} className="text-blue-700" /> Importar (.json)<input type="file" accept=".json" onChange={onImportarJson} className="hidden" /></label>
          {folhaPdf?.webViewLink && <a href={folhaPdf.webViewLink} target="_blank" rel="noreferrer" className="text-sm bg-white border border-slate-200 hover:border-blue-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5"><ExternalLink size={15} className="text-blue-700" /> Folha no Drive</a>}
        </div>
      </section>

      <section className="bg-white rounded-xl border-2 border-blue-200 p-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><CloudUpload size={15} className="text-blue-700" /> Envio para o Google Drive</h2>
        <div className="text-sm bg-slate-50 rounded-lg p-3 mb-4 font-mono leading-7 overflow-x-auto">
          <div className="flex items-center gap-1.5 whitespace-nowrap"><Folder size={15} className="text-blue-700 shrink-0" /> Hydrone</div>
          <div className="flex items-center gap-1.5 whitespace-nowrap pl-5"><Folder size={15} className="text-blue-700 shrink-0" /> {nomeData}</div>
          <div className="flex items-center gap-1.5 whitespace-nowrap pl-10"><FolderOpen size={15} className="text-blue-700 shrink-0" /> {nomeExperimento || <span className="text-rose-600 font-sans">(sem nome — obrigatório)</span>}</div>
          <div className="flex items-center gap-1.5 whitespace-nowrap pl-15"><FileText size={15} className="text-slate-500 shrink-0" /> {NOME_PDF}</div>
          <div className="flex items-center gap-1.5 whitespace-nowrap pl-15"><Folder size={15} className="text-slate-500 shrink-0" /> Fotos <span className="text-slate-400 font-sans text-xs">({totalFotos})</span></div>
          <div className="flex items-center gap-1.5 whitespace-nowrap pl-15"><Folder size={15} className="text-slate-500 shrink-0" /> Logs <span className="text-slate-400 font-sans text-xs">({totalLogs})</span></div>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          A pasta do dia vem da data do ensaio, e cada experimento tem a própria pasta dentro dela, com edição liberada para qualquer pessoa com o link. Enviar de novo atualiza a folha de campo (o Drive guarda as versões anteriores) e sobe só os arquivos novos.
          Não feche a aba durante o envio: os arquivos saem direto deste navegador.
        </p>

        {!cloud.podeUsarDrive() && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            Para enviar ao Drive, saia e entre de novo usando <b>Entrar com Google</b> — os arquivos são gravados pela sua conta Google.
          </p>
        )}
        {!nomeExperimento && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">
            Dê um nome ao experimento na etapa <b>Sobre</b> antes de enviar — ele vira o nome da pasta do experimento no Drive.
          </p>
        )}
        {readOnly && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">Somente leitura: só o dono ou um editor deste experimento pode enviar.</p>
        )}

        {erro && (
          <div className="mb-3 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
            <AlertCircle size={15} className="shrink-0 mt-0.5" /><span className="flex-1">{erro}</span>
            <button onClick={() => setErro("")} className="text-rose-400 hover:text-rose-600 text-xs">fechar</button>
          </div>
        )}
        {aviso && (
          <div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
            <AlertCircle size={15} className="shrink-0 mt-0.5" /><span className="flex-1">{aviso}</span>
            <button onClick={() => setAviso("")} className="text-amber-500 hover:text-amber-700 text-xs">fechar</button>
          </div>
        )}

        {etapas && (
          <ol className="space-y-1.5 mb-4">
            {etapas.map(e => (
              <li key={e.id} className={`flex items-center gap-2 text-sm ${e.estado === "erro" ? "text-rose-700" : e.estado === "espera" ? "text-slate-400" : "text-slate-700"}`}>
                {ICONE_ETAPA[e.estado]} {e.rotulo}
              </li>
            ))}
          </ol>
        )}

        <button onClick={enviarTudo} disabled={!podeEnviar || enviando}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2">
          {enviando ? <Loader2 size={18} className="animate-spin" /> : <CloudUpload size={18} />}
          {enviando ? "Enviando…" : "Salvar tudo e enviar para o Google Drive"}
        </button>

        {pastaLink && !enviando && (
          <a href={cloud.linkPastaDrive(pastaLink)} target="_blank" rel="noreferrer"
            className="mt-3 w-full text-sm text-blue-700 hover:text-blue-900 border border-blue-200 hover:bg-blue-50 rounded-xl py-2.5 flex items-center justify-center gap-1.5">
            <FolderOpen size={15} /> Abrir a pasta {pastaEnviada?.nome || nomeExperimento ? `"${pastaEnviada?.nome || nomeExperimento}"` : "do experimento"} no Google Drive
          </a>
        )}
      </section>
    </div>
  );
}
