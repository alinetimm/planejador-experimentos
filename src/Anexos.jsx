import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, ExternalLink, CloudUpload, CheckCircle2, AlertCircle, FileVideo, FileText, Image as ImageIcon, Link2 } from "lucide-react";
import * as cloud from "./cloud";

const ICONE_KIND = { photo: ImageIcon, video: FileVideo, log: FileText, outro: FileText };

const tamanho = (b) => {
  if (!b) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

// A miniatura usa a sessão Google do navegador de quem está vendo, não o token
// do app: funciona para quem tem acesso à pasta e cai no ícone para quem não tem.
function Miniatura({ att }) {
  const [falhou, setFalhou] = useState(false);
  const Icone = ICONE_KIND[att.kind] || FileText;
  if (att.kind === "photo" && att.drive?.fileId && !falhou) {
    return <img src={`https://drive.google.com/thumbnail?id=${att.drive.fileId}&sz=w160`} alt="" onError={() => setFalhou(true)}
      className="w-12 h-12 rounded object-cover shrink-0 bg-slate-100" />;
  }
  return <span className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center shrink-0"><Icone size={18} className="text-slate-400" /></span>;
}

/**
 * Galeria de fotos, vídeos e logs do experimento.
 *
 * O arquivo vai do navegador direto para Hydrone/{data}/{tipo} no Google Drive,
 * gravado pela conta Google de quem anexa. O acesso ao Drive é pedido num clique
 * próprio ("Conectar ao Drive") porque o popup do Google é bloqueado se não
 * nascer de um clique — e a escolha de arquivo não conta como clique.
 *
 * Só aparece depois que o experimento tem id: o doc de metadados é filho do
 * experimento, e a data e o tipo que nomeiam as pastas vêm dele.
 */
export default function Anexos({ expId, readOnly = false }) {
  const [itens, setItens] = useState([]);
  const [enviando, setEnviando] = useState({});   // { [nomeArquivo-tamanho]: pct }
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [conectado, setConectado] = useState(cloud.driveConectado());
  const [conectando, setConectando] = useState(false);
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

  const podeAnexar = cloud.podeUsarDrive();

  const conectar = async () => {
    setErro(""); setConectando(true);
    try { await cloud.conectarDrive(); setConectado(true); }
    catch (e) { setErro(`Não foi possível conectar ao Drive: ${cloud.explicarErroDrive(e)}`); }
    finally { setConectando(false); }
  };

  const escolherArquivos = () => {
    // O token vale 55 min; se expirou, volta para o botão de conectar.
    if (!cloud.driveConectado()) { setConectado(false); return; }
    inputRef.current?.click();
  };

  const enviar = async (files) => {
    setErro(""); setAviso("");
    for (const file of files) {
      const chave = `${file.name}-${file.size}`;
      setEnviando(s => ({ ...s, [chave]: 0 }));
      try {
        await cloud.uploadAttachment(expId, file, {
          onProgress: (pct) => setEnviando(s => ({ ...s, [chave]: pct })),
        });
      } catch (e) {
        setErro(`Falha ao enviar ${file.name}: ${cloud.explicarErroDrive(e)}`);
        if (!cloud.driveConectado()) setConectado(false);
      } finally {
        setEnviando(s => { const n = { ...s }; delete n[chave]; return n; });
      }
    }
  };

  const remover = async (att) => {
    if (!window.confirm(`Remover "${att.fileName}"? O arquivo sai do app e vai para a lixeira do Drive.`)) return;
    setErro(""); setAviso("");
    try {
      const msg = await cloud.deleteAttachment(expId, att);
      if (msg) setAviso(`"${att.fileName}" foi removido do app, mas ${msg}.`);
    } catch { setErro("Sem permissão para remover este anexo."); }
  };

  const emProgresso = Object.entries(enviando);

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <ImagePlus size={15} className="text-blue-700" /> Fotos e vídeos
          {itens.length > 0 && <span className="text-blue-700">({itens.length})</span>}
        </h2>
        {!readOnly && podeAnexar && (conectado ? (
          <button onClick={escolherArquivos}
            className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <CloudUpload size={15} /> Anexar
          </button>
        ) : (
          <button onClick={conectar} disabled={conectando}
            className="text-sm bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Link2 size={15} /> {conectando ? "Conectando…" : "Conectar ao Drive"}
          </button>
        ))}
        <input ref={inputRef} type="file" multiple accept="image/*,video/*,.bin,.tlog,.log" className="hidden"
          onChange={e => { enviar([...e.target.files]); e.target.value = ""; }} />
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Cada arquivo vai direto para <b>Hydrone › data do ensaio › tipo de experimento</b> no Drive do projeto, gravado pela sua conta Google.
        {!readOnly && podeAnexar && !conectado && " O Google pede a liberação do Drive uma vez a cada hora de uso."}
      </p>
      {!readOnly && !podeAnexar && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          Para anexar, saia e entre de novo usando <b>Entrar com Google</b> — os arquivos são gravados no Drive pela sua conta Google.
        </p>
      )}

      {erro && (
        <div className="mb-3 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro("")} className="text-rose-400 hover:text-rose-600 text-xs">fechar</button>
        </div>
      )}
      {aviso && (
        <div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{aviso}</span>
          <button onClick={() => setAviso("")} className="text-amber-500 hover:text-amber-700 text-xs">fechar</button>
        </div>
      )}

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
            const noDrive = !!att.drive?.webViewLink;
            return (
              <li key={att.id} className="flex items-center gap-2.5 border border-slate-200 rounded-lg p-2">
                <Miniatura att={att} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{att.fileName}</div>
                  <div className="text-xs text-slate-400">{tamanho(att.size)}</div>
                  {/* Sem link: registro de antes da troca para o Drive direto, cujo arquivo nunca subiu. */}
                  <div className={`text-[11px] flex items-center gap-1 ${noDrive ? "text-emerald-600" : "text-rose-600"}`}>
                    {noDrive ? <><CheckCircle2 size={11} /> no Drive</> : <><AlertCircle size={11} /> envio não concluído — remova e anexe de novo</>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {noDrive && (
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
