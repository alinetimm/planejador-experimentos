import { useState, useMemo, useEffect } from "react";
import {
  Waves, ClipboardList, ClipboardCheck, Download, Upload, Plus, Trash2, Info, BookOpen, ChevronDown,
  CheckCircle2, User, LogOut, Save, FolderOpen, RotateCcw, AlertTriangle, X, FileJson, FileText,
  DownloadCloud, FunctionSquare, Pencil, ArrowLeft, LogIn, Users, Share2, Lock, Table2,
} from "lucide-react";
import * as cloud from "./cloud";
import { download, toCSV } from "./lib/stats";
import { loadBlocos, saveBlocos, resetBlocos, novoItemVazio, novoBlocoVazio, ORDEM_SUGERIDA, CAPTURAS } from "./lib/requisitos";
import AnalisarDados from "./AnalisarDados";

const today = () => new Date().toISOString().slice(0, 10);
const META_DEF = { nome: "", descricao: "", responsavel: "", data: today(), equipamento: "", local: "", notas: "" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cloudList, setCloudList] = useState([]);
  const [currentExp, setCurrentExp] = useState(null);
  const [profilesList, setProfilesList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [listFilter, setListFilter] = useState("todos");
  const [showSaves, setShowSaves] = useState(false);
  const [showSaveDlg, setShowSaveDlg] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [showAnalise, setShowAnalise] = useState(false);
  const [toast, setToast] = useState("");
  const [deferred, setDeferred] = useState(null);

  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState({ ...META_DEF });

  const [blocos, setBlocos] = useState(() => loadBlocos());
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [ensaioRows, setEnsaioRows] = useState([]);
  const [sessaoValores, setSessaoValores] = useState({});
  const [detalheAbertos, setDetalheAbertos] = useState(() => new Set());
  const [libEditMode, setLibEditMode] = useState(false);
  const [itemDraft, setItemDraft] = useState(null);
  const [blocoDraft, setBlocoDraft] = useState(null);

  useEffect(() => { saveBlocos(blocos); }, [blocos]);

  const bundle = () => ({ meta, selecionados: [...selecionados], ensaioRows, sessaoValores });
  const applyBundle = (b) => {
    setMeta(b?.meta ? { ...META_DEF, ...b.meta } : { ...META_DEF });
    setSelecionados(new Set(b?.selecionados || []));
    setEnsaioRows(b?.ensaioRows || []);
    setSessaoValores(b?.sessaoValores || {});
  };
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  useEffect(() => { const h = (e) => { e.preventDefault(); setDeferred(e); }; window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h); }, []);
  const installApp = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; setDeferred(null); };

  // ── AUTH (Google via Firebase) ──
  useEffect(() => {
    const unsub = cloud.watchAuth(async (user) => {
      if (user) {
        setCurrentUser({ uid: user.uid, name: user.displayName || (user.email || "").split("@")[0] || "Sem nome", email: user.email || "", photoURL: user.photoURL || "" });
        try { setIsAdmin(await cloud.isAdminAsync()); } catch { setIsAdmin(false); }
      } else { setCurrentUser(null); setIsAdmin(false); setCurrentExp(null); }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUser) { setCloudList([]); setProfilesList([]); return; }
    const unsub = cloud.watchExperiments(setCloudList);
    cloud.listProfiles().then(setProfilesList).catch(() => {});
    return unsub;
  }, [currentUser]);

  const doLogin = async () => { setBusy(true); try { await cloud.signInGoogle(); } catch { flash("Falha no login com Google"); } setBusy(false); };
  const switchUser = async () => { try { await cloud.signOutUser(); } catch {} setCurrentExp(null); applyBundle(null); setStep(1); };
  const resetForm = () => { setCurrentExp(null); applyBundle({ meta: { ...META_DEF, responsavel: currentUser?.name || "" } }); setStep(1); flash("Novo rascunho"); };

  // ── Persistência na nuvem (Firestore), por pessoa ──
  const canEditCurrent = currentExp ? cloud.canEdit(currentExp, currentUser?.uid, isAdmin) : true;
  const readOnly = !!currentExp && !canEditCurrent;
  const isOwnerCurrent = currentExp ? (isAdmin || currentExp.ownerId === currentUser?.uid) : true;

  const persist = async (title) => {
    if (!currentUser) return;
    setBusy(true);
    try {
      const t = (title || currentExp?.title || meta.nome || "Sem título").toString().trim().slice(0, 120) || "Sem título";
      const id = await cloud.saveExperiment({ id: currentExp?.id, title: t, modo: "protocolo", kind: "protocolo", bundle: bundle() });
      setCurrentExp(prev => ({ id, title: t, ownerId: prev?.ownerId || currentUser.uid, ownerName: prev?.ownerName || currentUser.name, editors: prev?.editors || [] }));
      flash("Salvo na nuvem");
    } catch { flash("Não foi possível salvar (sem permissão?)"); }
    setBusy(false); setShowSaveDlg(false); setSaveTitle("");
  };
  const onSaveClick = () => { if (currentExp?.id && canEditCurrent) persist(); else setShowSaveDlg(true); };

  const openExperiment = async (summary) => {
    setBusy(true);
    try {
      const full = await cloud.getExperiment(summary.id);
      if (full?.bundle) applyBundle(full.bundle);
      setCurrentExp({ id: full.id, title: full.title, ownerId: full.ownerId, ownerName: full.ownerName, editors: full.editors || [] });
      setStep(1); flash(`"${full.title}" aberto${cloud.canEdit({ ownerId: full.ownerId, editors: full.editors }, currentUser?.uid, isAdmin) ? "" : " (somente leitura)"}`);
    } catch { flash("Erro ao abrir o experimento"); }
    setBusy(false); setShowSaves(false);
  };
  const removeExperiment = async (summary) => {
    if (!window.confirm(`Excluir "${summary.title}"? Esta ação não pode ser desfeita.`)) return;
    try { await cloud.deleteExperiment(summary.id); if (currentExp?.id === summary.id) setCurrentExp(null); flash("Excluído"); }
    catch { flash("Sem permissão para excluir"); }
  };
  const addEditor = async (uid) => { if (!currentExp?.id || !uid) return; try { await cloud.grantEditor(currentExp.id, uid); setCurrentExp(p => ({ ...p, editors: [...(p.editors || []), uid] })); flash("Permissão concedida"); } catch { flash("Sem permissão"); } };
  const removeEditor = async (uid) => { try { await cloud.revokeEditor(currentExp.id, uid); setCurrentExp(p => ({ ...p, editors: (p.editors || []).filter(x => x !== uid) })); } catch {} };

  const exportJSON = () => download(`protocolo_${(currentUser?.name || "user").replace(/\s/g, "_")}.json`, JSON.stringify({ app: "hydrone-protocolo", user: currentUser?.name, state: bundle() }, null, 2), "application/json");
  const importJSON = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (d.state) { setCurrentExp(null); applyBundle(d.state); flash("Protocolo importado (rascunho novo)"); } } catch { flash("Arquivo inválido"); } }; r.readAsText(f); };

  // ── Biblioteca de requisitos ──
  const toggleItem = (id) => setSelecionados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleBlocoInteiro = (bloco) => {
    const ids = bloco.itens.map(i => i.id);
    const todosMarcados = ids.length > 0 && ids.every(id => selecionados.has(id));
    setSelecionados(s => { const n = new Set(s); ids.forEach(id => todosMarcados ? n.delete(id) : n.add(id)); return n; });
  };
  const toggleDetalhe = (id) => setDetalheAbertos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openNewItem = (blocoId) => setItemDraft({ blocoId, itemId: null, titulo: "", simples: "", gera: "", porque: "", captura: "valor", unidade: "", escopo: "ensaio" });
  const openEditItem = (blocoId, item) => setItemDraft({ blocoId, itemId: item.id, ...item });
  const saveItemDraft = () => {
    if (!itemDraft.titulo.trim()) { flash("Dê um título ao requisito"); return; }
    const { blocoId, itemId, ...campos } = itemDraft;
    setBlocos(bs => bs.map(b => {
      if (b.id !== blocoId) return b;
      if (itemId) return { ...b, itens: b.itens.map(i => i.id === itemId ? { ...i, ...campos } : i) };
      const novo = { ...novoItemVazio(), ...campos };
      return { ...b, itens: [...b.itens, novo] };
    }));
    setItemDraft(null);
  };
  const removeItem = (blocoId, itemId) => {
    if (!window.confirm("Remover este requisito da biblioteca?")) return;
    setBlocos(bs => bs.map(b => b.id === blocoId ? { ...b, itens: b.itens.filter(i => i.id !== itemId) } : b));
    setSelecionados(s => { const n = new Set(s); n.delete(itemId); return n; });
  };

  const openNewBloco = () => setBlocoDraft({ id: null, titulo: "", resumo: "", fonte: "" });
  const openEditBloco = (bloco) => setBlocoDraft({ id: bloco.id, titulo: bloco.titulo, resumo: bloco.resumo || "", fonte: bloco.fonte || "" });
  const saveBlocoDraft = () => {
    if (!blocoDraft.titulo.trim()) { flash("Dê um título ao bloco"); return; }
    if (blocoDraft.id) setBlocos(bs => bs.map(b => b.id === blocoDraft.id ? { ...b, titulo: blocoDraft.titulo, resumo: blocoDraft.resumo, fonte: blocoDraft.fonte } : b));
    else setBlocos(bs => [...bs, { ...novoBlocoVazio(), titulo: blocoDraft.titulo, resumo: blocoDraft.resumo, fonte: blocoDraft.fonte }]);
    setBlocoDraft(null);
  };
  const removeBloco = (blocoId) => {
    if (!window.confirm("Remover este bloco inteiro da biblioteca?")) return;
    const bloco = blocos.find(b => b.id === blocoId);
    setBlocos(bs => bs.filter(b => b.id !== blocoId));
    setSelecionados(s => { const n = new Set(s); (bloco?.itens || []).forEach(i => n.delete(i.id)); return n; });
  };
  const restaurarPadrao = () => { if (!window.confirm("Restaurar a biblioteca de requisitos para o padrão? Seus itens e blocos personalizados serão perdidos.")) return; setBlocos(resetBlocos()); flash("Biblioteca restaurada"); };

  // ── Plano gerado a partir do que foi marcado ──
  const selectedFlat = useMemo(() => blocos.flatMap(b => b.itens.filter(i => selecionados.has(i.id)).map(i => ({ ...i, blocoId: b.id, blocoTitulo: b.titulo, blocoFonte: b.fonte }))), [blocos, selecionados]);
  const sessaoItems = selectedFlat.filter(i => i.escopo === "sessao");
  const ensaioItems = selectedFlat.filter(i => i.escopo === "ensaio");
  const blocosComSelecao = blocos.filter(b => selectedFlat.some(i => i.blocoId === b.id));

  const setSessaoValor = (itemId, patch) => setSessaoValores(v => ({ ...v, [itemId]: { ...(v[itemId] || {}), ...patch } }));
  const addEnsaioRow = () => setEnsaioRows(rs => [...rs, Object.fromEntries(ensaioItems.map(i => [i.id, ""]))]);
  const setEnsaioCell = (rowIdx, itemId, val) => setEnsaioRows(rs => rs.map((r, i) => i === rowIdx ? { ...r, [itemId]: val } : r));
  const delEnsaioRow = (rowIdx) => setEnsaioRows(rs => rs.filter((_, i) => i !== rowIdx));
  const exportPlanilha = () => {
    const cols = ensaioItems.map(i => i.titulo);
    const rowsForCSV = ensaioRows.map(r => Object.fromEntries(ensaioItems.map(i => [i.titulo, r[i.id] ?? ""])));
    download("planilha_de_campo.csv", toCSV(rowsForCSV, cols));
  };

  // ── Relatório (PDF) ──
  const buildReportHTML = () => {
    const ordem = ORDEM_SUGERIDA.filter(o => blocosComSelecao.some(b => b.id === o.bloco))
      .map(o => { const b = blocos.find(x => x.id === o.bloco); return `<li><b>${esc(b?.titulo || o.bloco)}</b> — ${esc(o.nota)}</li>`; }).join("");
    const requisitosHTML = blocosComSelecao.map(b => {
      const itens = selectedFlat.filter(i => i.blocoId === b.id);
      return `<h3 style="font-size:13px;color:#334155;margin:14px 0 4px">${esc(b.titulo)}${b.fonte ? ` <span style="font-weight:400;color:#94a3b8;font-size:11px">· ${esc(b.fonte)}</span>` : ""}</h3><ul style="margin:0 0 8px;padding-left:18px">${itens.map(i => `<li style="margin-bottom:6px"><b>${esc(i.titulo)}</b> — ${esc(i.simples)}<br><span style="color:#64748b;font-size:11px">Por que isso é importante: ${esc(i.porque)}</span></li>`).join("")}</ul>`;
    }).join("");
    const sessaoHTML = sessaoItems.length ? `<h2>Checklist da sessão</h2><table><tr><th>Item</th><th>Resultado</th></tr>${sessaoItems.map(i => { const v = sessaoValores[i.id] || {}; const val = i.captura === "valor" ? (v.valor || "—") : (v.resultado || "—"); return `<tr><td>${esc(i.titulo)}</td><td>${esc(val)}${i.unidade && v.valor ? " " + esc(i.unidade) : ""}</td></tr>`; }).join("")}</table>` : "";
    const planilhaHTML = ensaioItems.length && ensaioRows.length ? `<h2>Planilha de campo</h2><table><tr><th>#</th>${ensaioItems.map(i => `<th>${esc(i.titulo)}${i.unidade ? ` (${esc(i.unidade)})` : ""}</th>`).join("")}</tr>${ensaioRows.map((r, idx) => `<tr><td>${idx + 1}</td>${ensaioItems.map(i => `<td>${esc(r[i.id] ?? "")}</td>`).join("")}</tr>`).join("")}</table>` : "";
    return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Protocolo de Ensaio — Hydrone</title><style>body{font-family:Arial,sans-serif;color:#1e293b;max-width:760px;margin:24px auto;padding:0 24px}h1{font-size:20px;color:#1e40af;border-bottom:2px solid #1d4ed8;padding-bottom:6px;margin-bottom:2px}.sub{font-size:12px;color:#64748b;margin:0 0 16px}h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#1e40af;margin:20px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #e2e8f0}.meta td:first-child{color:#64748b;width:160px}p{font-size:13px;line-height:1.5;margin:4px 0}ul{font-size:13px;color:#334155}.foot{font-size:11px;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px}@media print{body{margin:0}}</style></head><body>
<div style="display:flex;align-items:center;gap:10px;border-bottom:2px solid #1d4ed8;padding-bottom:6px;margin-bottom:2px"><img src="/hydrone-mark.png" alt="Hydrone" style="height:34px;width:34px"><h1 style="border:0;margin:0;padding:0">Protocolo de Ensaio</h1></div><p class="sub">${esc(meta.nome || "Sem nome")} · Planejador de Experimentos Hydrone</p>
${meta.descricao ? `<h2>Descrição</h2><p>${esc(meta.descricao)}</p>` : ""}
<table class="meta"><tr><td>Responsável</td><td>${esc(meta.responsavel || currentUser?.name || "")}</td></tr><tr><td>Data</td><td>${esc(meta.data)}</td></tr>${meta.equipamento ? `<tr><td>Equipamento</td><td>${esc(meta.equipamento)}</td></tr>` : ""}${meta.local ? `<tr><td>Local</td><td>${esc(meta.local)}</td></tr>` : ""}</table>
${ordem ? `<h2>Sugestão de ordem em campo</h2><ol style="font-size:13px;padding-left:18px">${ordem}</ol>` : ""}
<h2>Requisitos marcados</h2>${requisitosHTML || "<p>Nenhum requisito marcado.</p>"}
${sessaoHTML}${planilhaHTML}
${meta.notas ? `<h2>Observações</h2><p>${esc(meta.notas)}</p>` : ""}
<p class="foot">Gerado em ${esc(new Date().toLocaleString("pt-BR"))}</p></body></html>`;
  };
  const printReport = () => {
    const html = buildReportHTML();
    try { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch {} }, 400); return; } } catch {}
    try { const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0;"; document.body.appendChild(f); const d = f.contentWindow.document; d.open(); d.write(html); d.close(); setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch {} setTimeout(() => f.remove(), 800); }, 400); return; } catch {}
    download("protocolo_de_ensaio.html", html, "text/html");
  };

  const userChip = (<span className="flex items-center gap-1.5 bg-white/15 rounded-full pl-1 pr-3 py-1">{currentUser?.photoURL ? <img src={currentUser.photoURL} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" /> : <User size={14} />}<span className="max-w-[8rem] truncate">{currentUser?.name}</span>{isAdmin && <span className="text-[9px] font-bold bg-amber-400 text-blue-950 rounded px-1 leading-tight">ADMIN</span>}</span>);
  const headerActions = (<div className="flex items-center gap-1.5 text-sm flex-wrap">
    {userChip}
    {deferred && <button onClick={installApp} title="Instalar app" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><DownloadCloud size={15} /></button>}
    <button onClick={() => setShowAnalise(true)} title="Analisar dados (ferramenta opcional)" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><FunctionSquare size={15} /></button>
    <button onClick={() => setShowSaves(true)} title="Experimentos do time" className="bg-white/15 hover:bg-white/25 rounded-lg p-2 relative"><FolderOpen size={15} />{cloudList.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-400 text-blue-950 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{cloudList.length}</span>}</button>
    <button onClick={resetForm} title="Novo rascunho" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><RotateCcw size={15} /></button>
    <button onClick={switchUser} title="Sair" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><LogOut size={15} /></button>
  </div>);

  if (showAnalise) return <AnalisarDados onClose={() => setShowAnalise(false)} dadosIniciais={ensaioItems.length && ensaioRows.length ? { headers: ensaioItems.map(i => i.titulo), rows: ensaioRows.map(r => Object.fromEntries(ensaioItems.map(i => [i.titulo, r[i.id] ?? ""]))) } : null} />;

  // LOGIN
  if (!currentUser) {
    return (<div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-blue-800 flex flex-col items-center justify-center p-4" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <img src="/hydrone-logo.png" alt="Hydrone" className="w-44 mb-6 drop-shadow-lg select-none" draggable="false" />
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h1 className="text-lg font-bold text-slate-800 mb-1">Planejador de Experimentos</h1>
        <p className="text-sm text-slate-500 mb-5">Hydrone · entre com sua conta Google para montar e compartilhar protocolos de ensaio com o time.</p>
        <button onClick={doLogin} disabled={busy} className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-lg text-sm"><LogIn size={16} /> {busy ? "Entrando…" : "Entrar com Google"}</button>
        <p className="text-xs text-slate-400 mt-5">Seus protocolos ficam salvos na nuvem do projeto e acessíveis de qualquer dispositivo.</p>
      </div>
    </div>);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-blue-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-3"><img src="/hydrone-mark.png" alt="Hydrone" className="h-9 w-9 shrink-0" /><div><h1 className="text-lg font-bold leading-tight">Planejador de Experimentos</h1><p className="text-xs text-blue-100">Hydrone · montador de protocolo</p></div></div>
            {headerActions}
          </div>
          <nav className="flex gap-1 flex-wrap">
            <button onClick={() => setStep(1)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${step === 1 ? "bg-white text-blue-800 shadow" : "text-blue-50 hover:bg-blue-600/40"}`}><span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === 1 ? "bg-blue-700 text-white" : "bg-blue-600/50 text-white"}`}>1</span><ClipboardCheck size={16} /><span className="hidden sm:inline">Sobre o experimento</span></button>
            <button onClick={() => setStep(2)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${step === 2 ? "bg-white text-blue-800 shadow" : "text-blue-50 hover:bg-blue-600/40"}`}><span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === 2 ? "bg-blue-700 text-white" : "bg-blue-600/50 text-white"}`}>2</span><ClipboardList size={16} /><span className="hidden sm:inline">Requisitos do protocolo</span></button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {readOnly && (<div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm"><Lock size={15} className="shrink-0" /> Somente leitura — você não é dono nem editor deste experimento. As alterações não serão salvas.</div>)}

        {/* TELA 1 — SOBRE O EXPERIMENTO */}
        {step === 1 && (<div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Waves size={15} className="text-blue-700" /> Sobre o experimento</h2>
            <label className="text-xs text-slate-500 font-medium">Nome do experimento</label>
            <input value={meta.nome} onChange={e => setMeta({ ...meta, nome: e.target.value })} placeholder="ex.: Resposta do casco ao pouso — série 1" className="w-full mt-1 mb-3 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" />
            <label className="text-xs text-slate-500 font-medium">O que você vai fazer e por quê</label>
            <textarea value={meta.descricao} onChange={e => setMeta({ ...meta, descricao: e.target.value })} placeholder="ex.: Medir como o casco reage ao pousar na água em diferentes velocidades verticais, para caracterizar o impacto do pouso." className="w-full mt-1 mb-3 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 h-20" />
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500">Responsável</label><input value={meta.responsavel} onChange={e => setMeta({ ...meta, responsavel: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
              <div><label className="text-xs text-slate-500">Data do ensaio</label><input type="date" value={meta.data} onChange={e => setMeta({ ...meta, data: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
              <div><label className="text-xs text-slate-500">Equipamento / veículo</label><input value={meta.equipamento} onChange={e => setMeta({ ...meta, equipamento: e.target.value })} placeholder="ex.: Hydrone v2" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
              <div><label className="text-xs text-slate-500">Local</label><input value={meta.local} onChange={e => setMeta({ ...meta, local: e.target.value })} placeholder="ex.: tanque Nautec" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
            </div>
          </section>

          {currentExp?.id && isOwnerCurrent && (<section className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Share2 size={13} className="text-blue-700" /> Compartilhar edição</h3>
            <div className="flex gap-2">
              <select id="editorSel" className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white outline-none focus:border-blue-400"><option value="">Escolher pessoa…</option>{profilesList.filter(p => p.uid !== currentExp.ownerId && !(currentExp.editors || []).includes(p.uid)).map(p => <option key={p.uid} value={p.uid}>{p.name}</option>)}</select>
              <button onClick={() => { const el = document.getElementById("editorSel"); if (el?.value) { addEditor(el.value); el.value = ""; } }} className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-3 rounded-lg font-medium">Conceder</button>
            </div>
            {(currentExp.editors || []).length > 0 && (<div className="flex flex-wrap gap-1.5 mt-2">{currentExp.editors.map(uid => { const p = profilesList.find(x => x.uid === uid); return (<span key={uid} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-800 rounded-full pl-2 pr-1 py-0.5">{p?.name || uid.slice(0, 6)}<button onClick={() => removeEditor(uid)} className="hover:text-rose-500"><X size={12} /></button></span>); })}</div>)}
          </section>)}

          <button onClick={() => setStep(2)} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition">Próximo: Requisitos do protocolo →</button>
        </div>)}

        {/* TELA 2 — BIBLIOTECA DE REQUISITOS + PLANO GERADO */}
        {step === 2 && (<div className="space-y-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft size={14} /> Sobre o experimento</button>
            <div className="flex gap-2">
              <button onClick={() => setLibEditMode(v => !v)} className={`text-sm px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${libEditMode ? "bg-blue-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}><Pencil size={14} /> {libEditMode ? "Concluir edição" : "Editar biblioteca"}</button>
              {libEditMode && <button onClick={restaurarPadrao} className="text-sm px-3 py-1.5 rounded-lg font-medium bg-white border border-slate-200 text-slate-600 flex items-center gap-1.5"><RotateCcw size={14} /> Restaurar padrão</button>}
            </div>
          </div>

          <section className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-slate-700">
            <p className="flex items-center gap-1.5 font-semibold text-blue-900"><Info size={15} /> Sugestão de ordem em campo</p>
            <ol className="mt-1.5 list-decimal list-inside space-y-0.5 text-slate-600">
              {ORDEM_SUGERIDA.map((o, i) => { const b = blocos.find(x => x.id === o.bloco); if (!b) return null; return <li key={i}><b className="text-slate-700">{b.titulo}</b> — {o.nota}</li>; })}
            </ol>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Marque o que se aplica</h2>
            <p className="text-xs text-slate-500 mb-3">Cada requisito já vem com uma explicação simples. Toque em "detalhe técnico" para ver o rigor por trás.</p>
            <div className="space-y-3">
              {blocos.map(bloco => {
                const ids = bloco.itens.map(i => i.id);
                const todos = ids.length > 0 && ids.every(id => selecionados.has(id));
                const algum = ids.some(id => selecionados.has(id));
                return (<div key={bloco.id} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <button onClick={() => toggleBlocoInteiro(bloco)} className="flex items-start gap-2 text-left flex-1">
                      <span className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${todos ? "bg-blue-700 border-blue-700" : algum ? "bg-blue-200 border-blue-400" : "border-slate-300"}`}>{todos && <CheckCircle2 size={12} className="text-white" />}</span>
                      <span><span className="font-bold text-slate-800">{bloco.titulo}</span>{bloco.fonte && <span className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 ml-2">{bloco.fonte}</span>}<div className="text-xs text-slate-500 mt-0.5">{bloco.resumo}</div></span>
                    </button>
                    {libEditMode && <div className="flex gap-1 shrink-0"><button onClick={() => openEditBloco(bloco)} className="text-slate-400 hover:text-blue-600 p-1"><Pencil size={14} /></button><button onClick={() => removeBloco(bloco.id)} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={14} /></button></div>}
                  </div>
                  <div className="mt-2 space-y-1.5 pl-6">
                    {bloco.itens.map(item => {
                      const marcado = selecionados.has(item.id);
                      const aberto = detalheAbertos.has(item.id);
                      return (<div key={item.id} onClick={() => toggleItem(item.id)} className={`rounded-lg border p-2.5 cursor-pointer ${marcado ? "border-blue-300 bg-blue-50/50" : "border-slate-100 hover:border-slate-200"}`}>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" checked={marcado} onChange={() => toggleItem(item.id)} onClick={e => e.stopPropagation()} className="mt-1 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800">{item.titulo || <span className="text-slate-300">(sem título)</span>}</div>
                            <p className="text-sm text-slate-600 mt-0.5">{item.simples}</p>
                            <button onClick={e => { e.stopPropagation(); toggleDetalhe(item.id); }} className="text-xs text-blue-700 font-medium flex items-center gap-1 mt-1.5"><ChevronDown size={13} className={`transition-transform ${aberto ? "rotate-180" : ""}`} /> detalhe técnico</button>
                            {aberto && (<div className="mt-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg p-2 space-y-1.5">
                              <p><b className="text-slate-600">O que isso gera:</b> <span className="text-slate-500">{item.gera || "—"}</span></p>
                              <p><b className="text-slate-600">Por que isso é importante?</b> <span className="text-slate-500">{item.porque || "—"}</span></p>
                            </div>)}
                          </div>
                          {libEditMode && <div onClick={e => e.stopPropagation()} className="flex gap-1 shrink-0"><button onClick={() => openEditItem(bloco.id, item)} className="text-slate-400 hover:text-blue-600 p-1"><Pencil size={13} /></button><button onClick={() => removeItem(bloco.id, item.id)} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={13} /></button></div>}
                        </div>
                      </div>);
                    })}
                    {libEditMode && <button onClick={() => openNewItem(bloco.id)} className="text-xs text-blue-700 font-medium flex items-center gap-1 mt-1"><Plus size={13} /> Novo requisito neste bloco</button>}
                  </div>
                </div>);
              })}
            </div>
            {libEditMode && <button onClick={openNewBloco} className="mt-3 text-sm text-blue-700 font-medium flex items-center gap-1"><Plus size={15} /> Novo bloco</button>}
          </section>

          {selectedFlat.length === 0 ? (
            <p className="text-sm text-slate-500 bg-slate-100 rounded-lg p-4">Marque pelo menos um requisito acima para gerar o checklist da sessão e a planilha de campo.</p>
          ) : (<>
            {sessaoItems.length > 0 && (<section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ClipboardCheck size={15} className="text-blue-700" /> Checklist da sessão</h2>
              <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                {sessaoItems.map(item => { const v = sessaoValores[item.id] || {}; const cap = CAPTURAS[item.captura] || CAPTURAS.valor; return (
                  <div key={item.id} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-slate-800 flex-1 min-w-40">{item.titulo}</span>
                    {item.captura === "valor" ? (<div className="flex items-center gap-1"><input value={v.valor || ""} onChange={e => setSessaoValor(item.id, { valor: e.target.value })} placeholder="valor" className="w-28 px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" />{item.unidade && <span className="text-xs text-slate-400 w-10">{item.unidade}</span>}</div>)
                      : (<div className="flex gap-1.5">{cap.opcoes.map(op => { const on = v.resultado === op; return <button key={op} onClick={() => setSessaoValor(item.id, { resultado: on ? "" : op })} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${on ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{op}</button>; })}</div>)}
                  </div>); })}
              </div>
            </section>)}

            {ensaioItems.length > 0 && (<section>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><Table2 size={15} className="text-blue-700" /> Planilha de campo</h2>
                <div className="flex gap-2"><button onClick={addEnsaioRow} className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Plus size={15} /> Adicionar ensaio</button>{ensaioRows.length > 0 && <button onClick={exportPlanilha} className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Download size={15} /> Baixar CSV</button>}</div>
              </div>
              <p className="text-xs text-slate-500 mb-2">Uma linha por ensaio — preencha durante a execução.</p>
              {ensaioRows.length === 0 ? <p className="text-sm text-slate-500 bg-slate-100 rounded-lg p-4">Clique em <b>Adicionar ensaio</b> para começar a preencher.</p> : (
                <div className="overflow-auto rounded-lg border border-slate-200 max-h-96"><table className="w-full text-sm"><thead className="bg-slate-100 sticky top-0"><tr><th className="px-2 py-2 text-left font-semibold text-slate-500 w-10">#</th>{ensaioItems.map(i => <th key={i.id} className="px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{i.titulo}{i.unidade ? ` (${i.unidade})` : ""}</th>)}<th className="w-8"></th></tr></thead>
                  <tbody>{ensaioRows.map((r, idx) => (<tr key={idx} className={idx % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className="px-2 py-1 text-slate-400">{idx + 1}</td>
                    {ensaioItems.map(i => { const cap = CAPTURAS[i.captura] || CAPTURAS.valor; return (<td key={i.id} className="px-1 py-1">{i.captura === "valor" ? (<input value={r[i.id] ?? ""} onChange={e => setEnsaioCell(idx, i.id, e.target.value)} className="w-full min-w-24 px-2 py-1 text-sm border border-transparent hover:border-slate-200 focus:border-blue-400 rounded outline-none bg-transparent" />) : (<select value={r[i.id] ?? ""} onChange={e => setEnsaioCell(idx, i.id, e.target.value)} className="w-full min-w-24 px-1 py-1 text-sm border border-transparent hover:border-slate-200 focus:border-blue-400 rounded outline-none bg-transparent"><option value=""></option>{cap.opcoes.map(op => <option key={op} value={op}>{op}</option>)}</select>)}</td>); })}
                    <td className="px-1"><button onClick={() => delEnsaioRow(idx)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button></td>
                  </tr>))}</tbody></table></div>
              )}
            </section>)}
          </>)}

          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={onSaveClick} disabled={busy || readOnly} title={readOnly ? "Somente leitura" : "Salvar na nuvem"} className="text-sm bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-3 py-2 rounded-lg flex items-center gap-1.5">{readOnly ? <Lock size={15} /> : <Save size={15} />} Salvar</button>
            <button onClick={() => setShowReport(true)} className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg flex items-center gap-1.5"><FileText size={15} /> Gerar relatório (PDF)</button>
            <button onClick={exportJSON} className="text-sm bg-white border border-slate-200 hover:border-blue-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5"><FileJson size={15} className="text-blue-700" /> Exportar (.json)</button>
            <label className="text-sm bg-white border border-slate-200 hover:border-blue-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"><Upload size={15} className="text-blue-700" /> Importar<input type="file" accept=".json" onChange={importJSON} className="hidden" /></label>
          </div>
        </div>)}
      </main>

      {/* Modal: editar/adicionar requisito */}
      {itemDraft && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setItemDraft(null)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[88vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">{itemDraft.itemId ? "Editar requisito" : "Novo requisito"}</h3><button onClick={() => setItemDraft(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-500 font-medium">Título</label><input value={itemDraft.titulo} onChange={e => setItemDraft({ ...itemDraft, titulo: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
          <div><label className="text-xs text-slate-500 font-medium">Explicação simples (sempre visível)</label><textarea value={itemDraft.simples} onChange={e => setItemDraft({ ...itemDraft, simples: e.target.value })} placeholder="Explique em linguagem do dia a dia, sem jargão." className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 h-16" /></div>
          <div><label className="text-xs text-slate-500 font-medium">O que isso gera (detalhe técnico)</label><textarea value={itemDraft.gera} onChange={e => setItemDraft({ ...itemDraft, gera: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 h-14" /></div>
          <div><label className="text-xs text-slate-500 font-medium">Por que isso é importante? (detalhe técnico)</label><textarea value={itemDraft.porque} onChange={e => setItemDraft({ ...itemDraft, porque: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 h-14" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs text-slate-500 font-medium">Captura</label><select value={itemDraft.captura} onChange={e => setItemDraft({ ...itemDraft, captura: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white outline-none focus:border-blue-400">{Object.entries(CAPTURAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="text-xs text-slate-500 font-medium">Unidade</label><input value={itemDraft.unidade} onChange={e => setItemDraft({ ...itemDraft, unidade: e.target.value })} placeholder="ex.: m/s" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
            <div><label className="text-xs text-slate-500 font-medium">Escopo</label><select value={itemDraft.escopo} onChange={e => setItemDraft({ ...itemDraft, escopo: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white outline-none focus:border-blue-400"><option value="ensaio">Por ensaio (planilha)</option><option value="sessao">Da sessão (uma vez)</option></select></div>
          </div>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={() => setItemDraft(null)} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-600">Cancelar</button><button onClick={saveItemDraft} className="flex-1 text-sm py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold">Salvar</button></div>
      </div></div>)}

      {/* Modal: editar/adicionar bloco */}
      {blocoDraft && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setBlocoDraft(null)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 mb-3">{blocoDraft.id ? "Editar bloco" : "Novo bloco"}</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-500 font-medium">Título</label><input value={blocoDraft.titulo} onChange={e => setBlocoDraft({ ...blocoDraft, titulo: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
          <div><label className="text-xs text-slate-500 font-medium">Resumo</label><textarea value={blocoDraft.resumo} onChange={e => setBlocoDraft({ ...blocoDraft, resumo: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 h-16" /></div>
          <div><label className="text-xs text-slate-500 font-medium">Fonte (opcional)</label><input value={blocoDraft.fonte} onChange={e => setBlocoDraft({ ...blocoDraft, fonte: e.target.value })} placeholder="ex.: Guia HAUV · M1" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={() => setBlocoDraft(null)} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-600">Cancelar</button><button onClick={saveBlocoDraft} className="flex-1 text-sm py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold">Salvar</button></div>
      </div></div>)}

      {showSaves && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowSaves(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[82vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-blue-700" /> Experimentos do time</h3><button onClick={() => setShowSaves(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        <div className="flex gap-1.5 mb-3 text-xs">{[["todos", "Todos"], ["meus", "Meus"]].map(([k, lb]) => <button key={k} onClick={() => setListFilter(k)} className={`px-3 py-1 rounded-full font-medium ${listFilter === k ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>{lb}</button>)}</div>
        {(() => { const lst = cloudList.filter(x => listFilter === "meus" ? (x.ownerId === currentUser?.uid || (x.editors || []).includes(currentUser?.uid)) : true); return lst.length === 0 ? <p className="text-sm text-slate-500 py-6 text-center">Nenhum experimento ainda. Salve o primeiro pelo botão de salvar.</p> : (
          <ul className="space-y-2 overflow-auto">{lst.map(x => { const mine = x.ownerId === currentUser?.uid; const editable = isAdmin || mine || (x.editors || []).includes(currentUser?.uid); const dt = x.updatedAt?.toDate ? x.updatedAt.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""; return (
            <li key={x.id} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2.5">
              <button onClick={() => openExperiment(x)} className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{x.title}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5"><User size={11} /> {mine ? "você" : x.ownerName} · {dt}{!editable && <span className="flex items-center gap-0.5 text-slate-400"><Lock size={10} /> leitura</span>}{editable && !mine && <span className="text-blue-600">editor</span>}</div>
              </button>
              {(isAdmin || mine) && <button onClick={() => removeExperiment(x)} title="Excluir" className="text-slate-300 hover:text-rose-500 p-1 shrink-0"><Trash2 size={15} /></button>}
            </li>); })}</ul>); })()}
      </div></div>)}

      {showSaveDlg && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowSaveDlg(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}><h3 className="font-bold text-slate-800 mb-1">Salvar experimento</h3><p className="text-xs text-slate-500 mb-3">Dê um nome para salvar na nuvem do time.</p><input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && persist(saveTitle)} placeholder="Nome do experimento" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-400" autoFocus /><div className="flex gap-2 mt-4"><button onClick={() => setShowSaveDlg(false)} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-600">Cancelar</button><button onClick={() => persist(saveTitle)} disabled={busy} className="flex-1 text-sm py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold">Salvar</button></div></div></div>)}

      {showReport && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowReport(false)}><div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[88vh] overflow-auto" onClick={e => e.stopPropagation()}><div className="p-6 text-slate-800">
        <div className="flex items-center gap-2 border-b-2 border-blue-700 pb-2 mb-4"><img src="/hydrone-mark.png" alt="Hydrone" className="h-6 w-6 shrink-0" /><div><h2 className="text-lg font-bold">Protocolo de Ensaio</h2><p className="text-xs text-slate-500">{meta.nome || "Sem nome"} · Hydrone</p></div></div>
        {meta.descricao && <><h3 className="font-bold text-blue-800 text-sm uppercase tracking-wide mb-1">Descrição</h3><p className="text-sm mb-3">{meta.descricao}</p></>}
        <table className="w-full text-sm mb-3"><tbody><tr><td className="py-1 pr-3 text-slate-500 w-36">Responsável</td><td className="py-1 font-medium">{meta.responsavel || currentUser.name}</td></tr><tr><td className="py-1 pr-3 text-slate-500">Data</td><td className="py-1 font-medium">{meta.data}</td></tr>{meta.equipamento && <tr><td className="py-1 pr-3 text-slate-500">Equipamento</td><td className="py-1 font-medium">{meta.equipamento}</td></tr>}{meta.local && <tr><td className="py-1 pr-3 text-slate-500">Local</td><td className="py-1 font-medium">{meta.local}</td></tr>}</tbody></table>
        <h3 className="font-bold text-blue-800 text-sm uppercase tracking-wide mb-1">Requisitos marcados</h3>
        {blocosComSelecao.length === 0 ? <p className="text-sm text-slate-500">Nenhum requisito marcado.</p> : blocosComSelecao.map(b => (<div key={b.id} className="mb-3">
          <h4 className="font-semibold text-sm text-slate-700 mt-2">{b.titulo}{b.fonte && <span className="text-slate-400 font-normal text-xs"> · {b.fonte}</span>}</h4>
          <ul className="text-sm mt-1 space-y-1">{selectedFlat.filter(i => i.blocoId === b.id).map(i => <li key={i.id}><b>{i.titulo}</b> — {i.simples}</li>)}</ul>
        </div>))}
        {meta.notas && <><h3 className="font-bold text-blue-800 text-sm uppercase tracking-wide mb-1 mt-3">Observações</h3><p className="text-sm">{meta.notas}</p></>}
        <p className="text-xs text-slate-400 mt-4 pt-2 border-t border-slate-200">Gerado em {new Date().toLocaleString("pt-BR")}</p>
      </div><div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex gap-2 justify-end"><button onClick={() => setShowReport(false)} className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600">Fechar</button><button onClick={printReport} className="text-sm px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold flex items-center gap-1.5"><FileText size={15} /> Imprimir / Salvar PDF</button></div></div></div>)}

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}
    </div>
  );
}
