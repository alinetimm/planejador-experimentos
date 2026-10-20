import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, ExternalLink, Loader2, CloudUpload, CheckCircle2, AlertCircle, FileVideo, FileText, Image as ImageIcon } from "lucide-react";
import * as cloud from "./cloud";

const ICONE_KIND = { photo: ImageIcon, video: FileVideo, log: FileText, outro: FileText };

const tamanho = (b) => {
  if (!b) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

const ESTADO_DRIVE = {
  pendente: { txt: "aguardando envio ao Drive", cls: "text-slate-400", Icone: Loader2, girar: true },
  enviando: { txt: "enviando ao Drive…",        cls: "text-blue-600",  Icone: Loader2, girar: true },
  ok:       { txt: "no Drive",                   cls: "text-emerald-600", Icone: CheckCircle2 },
  erro:     { txt: "falhou no Drive",            cls: "text-rose-600",  Icone: AlertCircle },
};

/**
 * Galeria de fotos, vídeos e logs do experimento.
 *
 * O arquivo sobe para o Firebase Storage com progresso real (resumable), e uma
 * Cloud Function o copia para Hydrone/{data}/{tipo} no Google Drive. O estado
 * dessa cópia chega sozinho pelo listener do Firestore — por isso não há
 * polling nem botão de "atualizar" aqui.
 *
 * Só aparece depois que o experimento tem id: o caminho do arquivo e o doc de
 * metadados são filhos do experimento.
 */
export default function Anexos({ expId, readOnly = false, onFlash }) {
  const [itens, setItens] = useState([]);
  const [enviando, setEnviando] = useState({});   // { [nomeArquivo]: pct }
  const inputRef = useRef(null);

  useEffect(() => {
    if (!expId) { setItens([]); return; }
    return cloud.watchAttachments(expId, setItens);
  }, [expId]);

  if (!expId) {
    return (
      <section className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
          <ImagePlus size={15} className="text-blue-700" /> Fotos e vídeos
        </h2>
        <p className="text-xs text-slate-500">
          Salve o experimento uma vez para liberar os anexos — as mídias são arquivadas na pasta do
          experimento no Drive do projeto.
        </p>
      </section>
    );
  }

  const enviar = async (files) => {
    for (const file of files) {
      const chave = `${file.name}-${file.size}`;
      setEnviando(s => ({ ...s, [chave]: 0 }));
      try {
        await cloud.uploadAttachment(expId, file, {
          onProgress: (pct) => setEnviando(s => ({ ...s, [chave]: pct })),
        });
      } catch (e) {
        onFlash?.(`Falha ao enviar ${file.name}`);
      } finally {
        setEnviando(s => { const n = { ...s }; delete n[chave]; return n; });
      }
    }
  };

  const remover = async (att) => {
    if (!window.confirm(`Remover "${att.fileName}"? O arquivo sai do app e vai para a lixeira do Drive.`)) return;
    try { await cloud.deleteAttachment(expId, att); } catch { onFlash?.("Sem permissão para remover"); }
  };

  const emProgresso = Object.entries(enviando);

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <ImagePlus size={15} className="text-blue-700" /> Fotos e vídeos
          {itens.length > 0 && <span className="text-blue-700">({itens.length})</span>}
        </h2>
        {!readOnly && (
          <button onClick={() => inputRef.current?.click()}
            className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <CloudUpload size={15} /> Anexar
          </button>
        )}
        <input ref={inputRef} type="file" multiple accept="image/*,video/*,.bin,.tlog,.log" className="hidden"
          onChange={e => { enviar([...e.target.files]); e.target.value = ""; }} />
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Cada arquivo é arquivado em <b>Hydrone › data do ensaio › tipo de experimento</b> no Drive do projeto.
      </p>

      {emProgresso.length > 0 && (
        <div className="space-y-2 mb-3">
          {emProgresso.map(([chave, pct]) => (
            <div key={chave}>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="truncate pr-2">{chave.split("-").slice(0, -1).join("-")}</span>
                <span className="tabular-nums shrink-0">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {itens.length === 0 && emProgresso.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4">Nenhum anexo ainda.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {itens.map(att => {
            const est = ESTADO_DRIVE[att.drive?.status || "pendente"];
            const Icone = ICONE_KIND[att.kind] || FileText;
            const EstadoIcone = est.Icone;
            return (
              <li key={att.id} className="flex items-center gap-2.5 border border-slate-200 rounded-lg p-2">
                {att.kind === "photo" && att.url
                  ? <img src={att.url} alt="" className="w-12 h-12 rounded object-cover shrink-0 bg-slate-100" />
                  : <span className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center shrink-0"><Icone size={18} className="text-slate-400" /></span>}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{att.fileName}</div>
                  <div className="text-xs text-slate-400">{tamanho(att.size)}</div>
                  <div className={`text-[11px] flex items-center gap-1 ${est.cls}`}>
                    <EstadoIcone size={11} className={est.girar ? "animate-spin" : ""} /> {est.txt}
                    {att.drive?.status === "erro" && att.drive?.erro && (
                      <span className="text-slate-400 truncate" title={att.drive.erro}>· {att.drive.erro}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {att.drive?.webViewLink && (
                    <a href={att.drive.webViewLink} target="_blank" rel="noreferrer" title="Abrir no Google Drive"
                      className="text-slate-400 hover:text-blue-600 p-1"><ExternalLink size={15} /></a>
                  )}
                  {!readOnly && (
                    <button onClick={() => remover(att)} title="Remover" className="text-slate-300 hover:text-rose-500 p-1">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
