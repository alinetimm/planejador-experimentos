import { useState, useMemo, useEffect, useRef } from "react";
import {
  Waves, Gauge, Rocket, ClipboardList, ClipboardCheck, Plus, Trash2, ChevronDown,
  User, LogOut, Save, FolderOpen, RotateCcw, AlertTriangle, X, FileText,
  DownloadCloud, FunctionSquare, Pencil, ArrowLeft, LogIn, Users, Share2, Lock, Copy, CloudUpload, Menu,
} from "lucide-react";
import * as cloud from "./cloud";
import { download, toCSV } from "./lib/stats";
import { loadBlocos, saveBlocos, resetBlocos, novoItemVazio, novoBlocoVazio, ORDEM_SUGERIDA, RESPOSTAS, respostaDe, opcoesDe, CATEGORIAS, CATEGORIA_PADRAO, FASES_MISSAO, novaLinhaPlanilha } from "./lib/requisitos";
import AnalisarDados from "./AnalisarDados";
import TesteVacuo from "./TesteVacuo";
import Finalizar from "./Finalizar";
import { gerarPdfFolha } from "./lib/folhaPdf";
import PlanilhaCampo, { CampoHora } from "./PlanilhaCampo";
import { VACUO_DEF, exigeTesteVacuo, migrarCategoria, statusEstanqueidade, quedaPressao, ROTULO_STATUS, UNIDADE_PRESSAO, num } from "./lib/vacuo";

// Data local: toISOString é UTC e, depois das 21h no Brasil, já devolve o dia seguinte.
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const META_DEF = { nome: "", descricao: "", responsavel: "", data: today(), equipamento: "", local: "", notas: "", modoEnsaio: "os_dois", fases: [] };
const ICONES_CATEGORIA = { Waves, Gauge, Rocket };
const categoriaMeta = (id) => CATEGORIAS.find(c => c.id === id) || CATEGORIAS[0];
const MODOS_ENSAIO = [{ id: "voo", label: "Voo" }, { id: "sub", label: "Subaquático" }, { id: "os_dois", label: "Os dois" }];
const modoMeta = (id) => MODOS_ENSAIO.find(m => m.id === id) || MODOS_ENSAIO[2];
// Conjunto de meios (voo/sub) ativos: para o Hydrone-J vem das fases marcadas (vazio = missão
// completa = tudo); para as outras categorias vem do seletor de modo de sempre.
const meiosDeFases = (fases) => (!fases || !fases.length) ? ["voo", "sub"] : [...new Set(FASES_MISSAO.filter(f => fases.includes(f.id)).flatMap(f => f.meios))];
const meiosAtivosDe = (categoria, meta) => categoria === "veiculo" ? meiosDeFases(meta.fases) : (meta.modoEnsaio === "os_dois" ? ["voo", "sub"] : [meta.modoEnsaio]);
const itemAplicaAosMeios = (item, meios) => !(item.modos && item.modos.length) || item.modos.some(m => meios.includes(m));
const resumoModoFases = (categoria, meta) => {
  if (categoria !== "veiculo") return modoMeta(meta.modoEnsaio).label;
  if (!meta.fases || !meta.fases.length || meta.fases.length === FASES_MISSAO.length) return "Missão completa";
  if (meta.fases.length <= 2) return meta.fases.map(id => FASES_MISSAO.find(f => f.id === id)?.label || id).join(" + ");
  return `${meta.fases.length} fases`;
};

// Linha compacta de um item: [left] título [right] "?" — explicação simples fica escondida
// atrás do "?"; "detalhe técnico" é um nível a mais dentro do painel que o "?" abre.
function ItemCompacto({ item, aberto, tecAberto, onToggleExplicacao, onToggleDetalhe, left, right, abaixo, onClickRow, className = "" }) {
  return (
    <div className={`rounded-lg border ${className}`}>
      <div className={`flex items-center gap-2 px-2.5 py-2 ${onClickRow ? "cursor-pointer" : ""}`} onClick={onClickRow}>
        {left}
        <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">{item.titulo || <span className="text-slate-300">(sem título)</span>}</span>
        {right}
        <button onClick={e => { e.stopPropagation(); onToggleExplicacao(); }} title="O que é isso?" className="w-5 h-5 rounded-full border border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600 text-[11px] font-bold flex items-center justify-center shrink-0">?</button>
      </div>
      {abaixo && <div className="px-2.5 pb-2.5" onClick={e => e.stopPropagation()}>{abaixo}</div>}
      {aberto && (<div className="px-2.5 pb-2.5" onClick={e => e.stopPropagation()}>
        <div className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-2 space-y-1.5">
          <p className="text-slate-600">{item.simples || "—"}</p>
          <button onClick={onToggleDetalhe} className="text-[11px] text-blue-700 font-medium flex items-center gap-1"><ChevronDown size={12} className={`transition-transform ${tecAberto ? "rotate-180" : ""}`} /> detalhe técnico</button>
          {tecAberto && (<div className="pt-1 space-y-1">
            <p><b className="text-slate-600">O que isso gera:</b> <span className="text-slate-500">{item.gera || "—"}</span></p>
            <p><b className="text-slate-600">Por que isso é importante?</b> <span className="text-slate-500">{item.porque || "—"}</span></p>
          </div>)}
        </div>
      </div>)}
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cloudList, setCloudList] = useState([]);
  const [currentExp, setCurrentExp] = useState(null);
  const [profilesList, setProfilesList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  useEffect(() => {
    if (!menuAberto) return;
    const fechar = (e) => { if (e.key === "Escape") setMenuAberto(false); };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [menuAberto]);
  const [listFilter, setListFilter] = useState("todos");
  const [showSaves, setShowSaves] = useState(false);
  const [showSaveDlg, setShowSaveDlg] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [showAnalise, setShowAnalise] = useState(false);
  const [toast, setToast] = useState("");
  const [deferred, setDeferred] = useState(null);

  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState({ ...META_DEF });
  const [categoriaAtiva, setCategoriaAtiva] = useState(CATEGORIA_PADRAO);

  const [blocos, setBlocos] = useState(() => loadBlocos());
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [ensaioRows, setEnsaioRows] = useState([]);
  const [sessaoValores, setSessaoValores] = useState({});
  const [testeVacuo, setTesteVacuo] = useState({ ...VACUO_DEF });
  // Fotos/vídeos e logs escolhidos na Etapa 3 e ainda não enviados ao Drive. São
  // objetos File, que não sobrevivem a recarregar a página nem vão para o bundle.
  const [pendentes, setPendentes] = useState({ fotos: [], logs: [] });
  const [detalheAbertos, setDetalheAbertos] = useState(() => new Set());
  const [explicacaoAbertos, setExplicacaoAbertos] = useState(() => new Set());
  const [gruposAlternados, setGruposAlternados] = useState(() => new Set());
  const [ordemAberta, setOrdemAberta] = useState(false);
  const [libEditMode, setLibEditMode] = useState(false);
  const [itemDraft, setItemDraft] = useState(null);
  const [blocoDraft, setBlocoDraft] = useState(null);

  useEffect(() => { saveBlocos(blocos); }, [blocos]);

  const bundle = () => ({ meta, categoria: categoriaAtiva, selecionados: [...selecionados], ensaioRows, sessaoValores, testeVacuo });
  const applyBundle = (b) => {
    setMeta(b?.meta ? { ...META_DEF, ...b.meta } : { ...META_DEF });
    // migrarCategoria mantém compatíveis os bundles salvos antes da renomeação.
    setCategoriaAtiva(migrarCategoria(b?.categoria) || CATEGORIA_PADRAO);
    setSelecionados(new Set(b?.selecionados || []));
    setEnsaioRows(b?.ensaioRows || []);
    setSessaoValores(b?.sessaoValores || {});
    setTesteVacuo({ ...VACUO_DEF, ...(b?.testeVacuo || {}) });
    setPendentes({ fotos: [], logs: [] });
  };
  const toastTimer = useRef(null);
  const flash = (m, ms = 2200) => { clearTimeout(toastTimer.current); setToast(m); toastTimer.current = setTimeout(() => setToast(""), ms); };

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
  const resetForm = () => { setCurrentExp(null); applyBundle({ meta: { ...META_DEF, responsavel: currentUser?.name || "" }, categoria: CATEGORIA_PADRAO }); setStep(1); flash("Novo rascunho"); };

  // ── Persistência na nuvem (Firestore), por pessoa ──
  const canEditCurrent = currentExp ? cloud.canEdit(currentExp, currentUser?.uid, isAdmin) : true;
  const readOnly = !!currentExp && !canEditCurrent;
  const isOwnerCurrent = currentExp ? (isAdmin || currentExp.ownerId === currentUser?.uid) : true;

  // O nome é obrigatório: é o título na lista do time e o nome da pasta do
  // experimento no Drive. O campo "Nome do experimento" é a única fonte dele.
  const [nomeFaltando, setNomeFaltando] = useState(false);
  const pedirNome = () => {
    setNomeFaltando(true); setStep(1);
    flash("Dê um nome ao experimento antes de salvar", 4000);
    setTimeout(() => document.getElementById("campo-nome-experimento")?.focus(), 50);
  };
  const persist = async (nomeInformado) => {
    if (!currentUser) return null;
    const t = (nomeInformado ?? meta.nome ?? "").toString().trim().slice(0, 120);
    if (!t) { pedirNome(); return null; }
    if (t !== meta.nome) setMeta(m => ({ ...m, nome: t }));
    setBusy(true);
    try {
      const b = bundle();
      const id = await cloud.saveExperiment({ id: currentExp?.id, title: t, modo: categoriaAtiva, kind: "protocolo", responsavel: meta.responsavel || "", data: meta.data || "", resumoModo: resumoModoFases(categoriaAtiva, meta), bundle: { ...b, meta: { ...b.meta, nome: t } } });
      setCurrentExp(prev => ({ id, title: t, ownerId: prev?.ownerId || currentUser.uid, ownerName: prev?.ownerName || currentUser.name, editors: prev?.editors || [], folhaPdf: prev?.id === id ? prev.folhaPdf : undefined }));
      flash("Salvo na nuvem");
      return { id, title: t };
    } catch { flash("Não foi possível salvar (sem permissão?)"); return null; }
    finally { setBusy(false); setShowSaveDlg(false); setSaveTitle(""); }
  };
  const onSaveClick = () => { if ((meta.nome || "").trim()) persist(); else { setSaveTitle(""); setShowSaveDlg(true); } };

  const openExperiment = async (summary) => {
    setBusy(true);
    try {
      const full = await cloud.getExperiment(summary.id);
      if (full?.bundle) applyBundle({ ...full.bundle, meta: { ...full.bundle.meta, nome: full.bundle.meta?.nome || (full.title !== "Sem título" ? full.title : "") || "" } });
      setCurrentExp({ id: full.id, title: full.title, ownerId: full.ownerId, ownerName: full.ownerName, editors: full.editors || [], folhaPdf: full.folhaPdf });
      setStep(1); flash(`"${full.title}" aberto${cloud.canEdit({ ownerId: full.ownerId, editors: full.editors }, currentUser?.uid, isAdmin) ? "" : " (somente leitura)"}`);
    } catch { flash("Erro ao abrir o experimento"); }
    setBusy(false); setShowSaves(false);
  };
  const duplicarComoModelo = async (summary) => {
    setBusy(true);
    try {
      const full = await cloud.getExperiment(summary.id);
      if (full?.bundle) {
        // Modelo = checklist reaproveitado, medições zeradas. As leituras do
        // teste de vácuo são de uma cápsula num dia específico: não se herdam.
        applyBundle({ ...full.bundle, ensaioRows: [], sessaoValores: {}, testeVacuo: null, meta: { ...full.bundle.meta, nome: full.bundle.meta?.nome ? `${full.bundle.meta.nome} (cópia)` : "", data: today() } });
      }
      setCurrentExp(null);
      setStep(1); setShowSaves(false);
      flash("Modelo duplicado — checklist pronto, dados em branco");
    } catch { flash("Erro ao duplicar"); }
    setBusy(false);
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
  const toggleExplicacao = (id) => setExplicacaoAbertos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleGrupo = (id) => setGruposAlternados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const grupoAberto = (id, idx, total) => { const padraoAberto = idx === 0 || total <= 4; return gruposAlternados.has(id) ? !padraoAberto : padraoAberto; };

  const openNewItem = (blocoId) => setItemDraft({ blocoId, itemId: null, titulo: "", simples: "", gera: "", porque: "", captura: "valor", unidade: "", escopo: "ensaio", modos: [], resposta: "verificacao", opcoes: [] });
  const openEditItem = (blocoId, item) => setItemDraft({ blocoId, itemId: item.id, modos: [], ...item, resposta: respostaDe(item), opcoes: opcoesDe(item) });
  const toggleModoDraft = (modo) => setItemDraft(d => { const cur = d.modos || []; return { ...d, modos: cur.includes(modo) ? cur.filter(m => m !== modo) : [...cur, modo] }; });
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
    else setBlocos(bs => [...bs, { ...novoBlocoVazio(categoriaAtiva), titulo: blocoDraft.titulo, resumo: blocoDraft.resumo, fonte: blocoDraft.fonte }]);
    setBlocoDraft(null);
  };
  const removeBloco = (blocoId) => {
    if (!window.confirm("Remover este bloco inteiro da biblioteca?")) return;
    const bloco = blocos.find(b => b.id === blocoId);
    setBlocos(bs => bs.filter(b => b.id !== blocoId));
    setSelecionados(s => { const n = new Set(s); (bloco?.itens || []).forEach(i => n.delete(i.id)); return n; });
  };
  const restaurarPadrao = () => { if (!window.confirm("Restaurar a biblioteca de requisitos para o padrão? Seus itens e blocos personalizados serão perdidos.")) return; setBlocos(resetBlocos()); flash("Biblioteca restaurada"); };

  // ── Plano gerado a partir do que foi marcado, sempre restrito à categoria ativa ──
  const meiosAtivos = meiosAtivosDe(categoriaAtiva, meta);
  const blocosAtivos = useMemo(() => blocos.filter(b => (b.categoria || CATEGORIA_PADRAO) === categoriaAtiva)
    .map(b => ({ ...b, itens: b.itens.filter(i => itemAplicaAosMeios(i, meiosAtivos)) })), [blocos, categoriaAtiva, meiosAtivos.join(",")]);
  const selectedFlat = useMemo(() => blocosAtivos.flatMap(b => b.itens.filter(i => selecionados.has(i.id)).map(i => ({ ...i, blocoId: b.id, blocoTitulo: b.titulo, blocoFonte: b.fonte }))), [blocosAtivos, selecionados]);
  const sessaoItems = selectedFlat.filter(i => i.escopo === "sessao");
  const ensaioItems = selectedFlat.filter(i => i.escopo === "ensaio");
  const blocosComSelecao = blocos.filter(b => selectedFlat.some(i => i.blocoId === b.id));

  const itemVerificado = (item) => { const v = sessaoValores[item.id] || {}; const r = respostaDe(item); return (r === "valor" || r === "texto" || r === "hora" || r === "data") ? !!(v.valor && v.valor.trim()) : !!v.resultado; };
  const corPilula = (opcao, ativo) => {
    if (!ativo) return "bg-slate-100 text-slate-600 hover:bg-slate-200";
    if (["Falhou", "Não", "Refazer"].includes(opcao)) return "bg-rose-600 text-white";
    if (opcao === "Ajustar") return "bg-amber-500 text-white";
    return "bg-blue-700 text-white";
  };
  const autoGrow = (e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; };
  const sessaoPorBloco = useMemo(() => {
    const map = new Map();
    sessaoItems.forEach(i => { if (!map.has(i.blocoId)) map.set(i.blocoId, { id: i.blocoId, titulo: i.blocoTitulo, fonte: i.blocoFonte, itens: [] }); map.get(i.blocoId).itens.push(i); });
    return [...map.values()];
  }, [sessaoItems]);
  const sessaoVerificados = sessaoItems.filter(itemVerificado).length;
  const sessaoFalhas = sessaoItems.filter(i => ["Falhou", "Não", "Refazer"].includes((sessaoValores[i.id] || {}).resultado)).length;

  const setSessaoValor = (itemId, patch) => setSessaoValores(v => ({ ...v, [itemId]: { ...(v[itemId] || {}), ...patch } }));
  const addEnsaioRow = () => setEnsaioRows(rs => [...rs, novaLinhaPlanilha(ensaioItems, rs[rs.length - 1], today())]);
  const setEnsaioCell = (rowIdx, itemId, val) => setEnsaioRows(rs => rs.map((r, i) => i === rowIdx ? { ...r, [itemId]: val } : r));
  const delEnsaioRow = (rowIdx) => setEnsaioRows(rs => rs.filter((_, i) => i !== rowIdx));
  const exportPlanilha = () => {
    const cols = [...ensaioItems.map(i => i.titulo), "O que foi feito"];
    const rowsForCSV = ensaioRows.map(r => Object.fromEntries([...ensaioItems.map(i => [i.titulo, r[i.id] ?? ""]), ["O que foi feito", r._obs ?? ""]]));
    download("planilha_de_campo.csv", toCSV(rowsForCSV, cols));
  };

  // ── Folha de campo (PDF) ──
  // Dados do registro do ensaio, na mesma ordem de blocos sugerida para o campo.
  // O PDF em si é montado em lib/folhaPdf.js.
  const dadosFolha = () => {
    const ordemIds = (ORDEM_SUGERIDA[categoriaAtiva] || []).map(o => o.bloco).filter(id => blocosComSelecao.some(b => b.id === id));
    const restantes = blocosComSelecao.map(b => b.id).filter(id => !ordemIds.includes(id));
    const resultado = (item) => {
      const v = sessaoValores[item.id] || {};
      const r = respostaDe(item);
      if (["valor", "texto", "hora", "data"].includes(r)) {
        const val = (v.valor || "").trim();
        if (!val) return { valor: "", estado: "vazio" };
        return { valor: r === "valor" && item.unidade ? `${val} ${item.unidade}` : val, estado: "neutro" };
      }
      if (!v.resultado) return { valor: "", estado: "vazio" };
      const estado = ["Falhou", "Não", "Refazer"].includes(v.resultado) ? "falha" : ["Passou", "OK", "Sim", "Feito"].includes(v.resultado) ? "ok" : "neutro";
      return { valor: v.resultado, estado };
    };
    const checklist = [...ordemIds, ...restantes].map(id => {
      const b = blocosComSelecao.find(x => x.id === id);
      const itens = selectedFlat.filter(i => i.blocoId === id && i.escopo === "sessao");
      return b && itens.length ? { titulo: b.titulo, fonte: b.fonte || "", itens: itens.map(i => ({ titulo: i.titulo, ...resultado(i) })) } : null;
    }).filter(Boolean);
    const vacuoStatus = statusEstanqueidade(testeVacuo);
    const vacuoQueda = quedaPressao(testeVacuo);
    const comUnidade = (x) => (x !== "" && x != null ? `${x} ${UNIDADE_PRESSAO}` : "");
    return {
      titulo: (meta.nome || "").trim() || "Sem nome",
      categoria: categoriaMeta(categoriaAtiva).label,
      modo: resumoModoFases(categoriaAtiva, meta),
      descricao: meta.descricao, responsavel: meta.responsavel || currentUser?.name || "", data: meta.data,
      local: meta.local, equipamento: meta.equipamento, notas: meta.notas,
      resumo: { verificados: sessaoVerificados, total: sessaoItems.length, falhas: sessaoFalhas, medidas: selectedFlat.filter(i => respostaDe(i) === "valor").length, ensaios: ensaioRows.length },
      vacuo: exigeTesteVacuo(categoriaAtiva) ? {
        realizado: !!testeVacuo.realizado,
        inicial: comUnidade(testeVacuo.pressaoInicial), final: comUnidade(testeVacuo.pressaoFinal),
        minutos: testeVacuo.tempoDecorridoMinutos,
        queda: vacuoQueda === null ? "" : `${vacuoQueda.toFixed(1)} ${UNIDADE_PRESSAO}`,
        limite: comUnidade(num(testeVacuo.limiteQueda)),
        status: ROTULO_STATUS[vacuoStatus], statusId: vacuoStatus, obs: testeVacuo.observacoes || "",
      } : null,
      checklist,
      planilha: ensaioItems.length ? {
        colunas: ensaioItems.map(i => `${i.titulo}${i.unidade ? ` (${i.unidade})` : ""}`),
        linhas: ensaioRows
          .map(r => ({ valores: ensaioItems.map(i => String(r[i.id] ?? "")), obs: r._obs || "" }))
          .filter(l => l.obs.trim() || l.valores.some(v => v.trim())),
      } : null,
      assinaturas: { montou: currentExp?.ownerName || currentUser?.name || "", preencheu: meta.responsavel || "" },
      geradoEm: new Date().toLocaleString("pt-BR"),
    };
  };
  const baixarFolhaPdf = async () => {
    flash("Gerando a folha de campo em PDF…", 60000);
    try {
      const pdf = await gerarPdfFolha(dadosFolha());
      download(`Folha_de_Campo - ${(meta.nome || "Sem nome").trim()}.pdf`, pdf, "application/pdf");
      flash("Folha de campo baixada");
    } catch { flash("Não foi possível gerar o PDF"); }
  };

  const avatar = (tamanho) => currentUser?.photoURL
    ? <img src={currentUser.photoURL} alt="" className={`${tamanho} rounded-full shrink-0 object-cover`} referrerPolicy="no-referrer" />
    : <span className={`${tamanho} rounded-full shrink-0 bg-blue-100 text-blue-800 flex items-center justify-center`}><User size={16} /></span>;
  const itemMenu = (Icone, rotulo, onClick, { disabled = false, extra = null, perigo = false } = {}) => (
    <button onClick={() => { setMenuAberto(false); onClick(); }} disabled={disabled}
      className={`w-full flex items-center gap-3 px-5 py-3 text-sm text-left transition disabled:opacity-50 ${perigo ? "text-rose-700 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"}`}>
      <Icone size={17} className={perigo ? "text-rose-600 shrink-0" : "text-blue-700 shrink-0"} />
      <span className="flex-1">{rotulo}</span>
      {extra}
    </button>
  );
  const menuUsuario = menuAberto && (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu do usuário">
      <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAberto(false)} />
      <aside className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col">
        <div className="bg-gradient-to-r from-[#12185a] via-[#1e1b78] to-[#3a3ad8] text-white px-5 pt-5 pb-4" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-start justify-between gap-2">
            {avatar("w-12 h-12 ring-2 ring-white/40")}
            <button onClick={() => setMenuAberto(false)} aria-label="Fechar menu" className="text-white/70 hover:text-white p-1 -mr-1"><X size={20} /></button>
          </div>
          <div className="mt-3 font-semibold truncate">{currentUser?.name}</div>
          {currentUser?.email && <div className="text-xs text-blue-100 truncate">{currentUser.email}</div>}
          {isAdmin && <span className="inline-block mt-2 text-[10px] font-bold bg-amber-400 text-blue-950 rounded px-1.5 py-0.5">ADMIN</span>}
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {itemMenu(readOnly ? Lock : Save, readOnly ? "Somente leitura" : "Salvar", onSaveClick, { disabled: busy || readOnly })}
          {itemMenu(FolderOpen, "Experimentos do time", () => setShowSaves(true), { extra: cloudList.length > 0 && <span className="bg-amber-400 text-blue-950 text-[11px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">{cloudList.length}</span> })}
          {itemMenu(FunctionSquare, "Analisar dados", () => setShowAnalise(true))}
          {itemMenu(RotateCcw, "Novo rascunho", resetForm)}
          {deferred && itemMenu(DownloadCloud, "Instalar app", installApp)}
        </nav>
        <div className="border-t border-slate-100 py-2" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}>
          {itemMenu(LogOut, "Sair", switchUser, { perigo: true })}
        </div>
      </aside>
    </div>
  );

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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="bg-gradient-to-r from-[#12185a] via-[#1e1b78] to-[#3a3ad8] text-white">
        {/* Grade: no celular as etapas ganham a linha inteira embaixo; a partir de sm,
            ficam sob o título, com logo e menu ocupando as duas linhas. */}
        <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 sm:gap-x-4 gap-y-2">
          <img src="/hydrone-mark.png" alt="Hydrone" className="sm:row-span-2 h-14 w-14 sm:h-20 sm:w-20 shrink-0 -my-1 drop-shadow" />
          <h1 className="min-w-0 font-titulo text-xl sm:text-3xl leading-tight">Planejador de Experimentos Hydrone</h1>
          <button onClick={() => setMenuAberto(true)} aria-label="Abrir menu do usuário" aria-expanded={menuAberto}
            className="sm:row-span-2 justify-self-end shrink-0 flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full pl-1 pr-3 py-1 transition relative">
            {avatar("w-8 h-8")}
            <Menu size={20} />
            {cloudList.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-400 text-blue-950 text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{cloudList.length}</span>}
          </button>
          <nav aria-label="Etapas" className="col-span-3 sm:col-span-1 sm:col-start-2 flex flex-wrap gap-2">
            {[[1, "Sobre"], [2, "Experimento"], [3, "Finalizar e enviar para o drive"]].map(([n, rotulo]) => (
              <button key={n} onClick={() => setStep(n)} aria-current={step === n ? "step" : undefined}
                className={`font-titulo whitespace-nowrap text-sm sm:text-lg leading-none px-4 sm:px-6 py-1.5 rounded-full transition shadow-sm ${step === n ? "bg-red-600 text-white" : "bg-white text-slate-900 hover:bg-sky-100"}`}>
                {rotulo}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="w-full flex-1 max-w-6xl mx-auto px-4 py-6">
        {readOnly && (<div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm"><Lock size={15} className="shrink-0" /> Somente leitura — você não é dono nem editor deste experimento. As alterações não serão salvas.</div>)}

        {/* ETAPA 1 — SOBRE: configuração do ensaio e montagem do checklist */}
        {step === 1 && (<div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Categoria do experimento</h2>
            <div className="grid sm:grid-cols-3 gap-2">
              {CATEGORIAS.map(cat => {
                const Icone = ICONES_CATEGORIA[cat.icone] || Waves;
                const ativo = categoriaAtiva === cat.id;
                return (<button key={cat.id} onClick={() => setCategoriaAtiva(cat.id)}
                  className={`text-left rounded-xl border-2 p-3 transition ${ativo ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icone size={16} className={ativo ? "text-blue-700" : "text-slate-400"} />
                    <span className={`text-sm font-bold ${ativo ? "text-blue-800" : "text-slate-700"}`}>{cat.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">{cat.descricao}</p>
                </button>);
              })}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-4">
            {categoriaAtiva === "veiculo" ? (<>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Fases da missão</h2>
                <button onClick={() => setMeta({ ...meta, fases: (meta.fases || []).length === FASES_MISSAO.length ? [] : FASES_MISSAO.map(f => f.id) })} className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                  {(meta.fases || []).length === FASES_MISSAO.length ? "Limpar seleção" : "Missão completa"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {FASES_MISSAO.map(f => { const on = (meta.fases || []).includes(f.id); return (
                  <button key={f.id} onClick={() => setMeta({ ...meta, fases: on ? meta.fases.filter(x => x !== f.id) : [...(meta.fases || []), f.id] })}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition ${on ? "bg-blue-700 border-blue-700 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}>{f.label}</button>
                ); })}
              </div>
              <p className="text-xs text-slate-500 mt-2">Nenhuma fase marcada = missão completa (nada é escondido). O meio (aéreo/subaquático) de cada fase filtra os itens nas próximas telas e no impresso.</p>
            </>) : (<>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Modo do ensaio</h2>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                {MODOS_ENSAIO.map(m => (<button key={m.id} onClick={() => setMeta({ ...meta, modoEnsaio: m.id })}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${meta.modoEnsaio === m.id ? "bg-blue-700 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`}>{m.label}</button>))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Esconde, nas próximas telas, o que não se aplica ao modo escolhido. Itens sem modo específico continuam aparecendo sempre.</p>
            </>)}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Waves size={15} className="text-blue-700" /> Sobre o experimento</h2>
            <label htmlFor="campo-nome-experimento" className="text-xs text-slate-500 font-medium">Nome do experimento <span className="text-rose-600">*</span></label>
            <input id="campo-nome-experimento" value={meta.nome} onChange={e => { setMeta({ ...meta, nome: e.target.value }); if (e.target.value.trim()) setNomeFaltando(false); }} placeholder="ex.: Resposta do casco ao pouso — série 1" className={`w-full mt-1 px-2 py-1.5 text-sm border rounded outline-none focus:border-blue-400 ${nomeFaltando && !meta.nome.trim() ? "border-rose-400 bg-rose-50/40" : "border-slate-200"}`} />
            <p className={`text-xs mt-1 mb-3 ${nomeFaltando && !meta.nome.trim() ? "text-rose-600" : "text-slate-400"}`}>Obrigatório para salvar. Também é o nome da pasta do experimento no Google Drive.</p>
            <label className="text-xs text-slate-500 font-medium">O que você vai fazer e por quê</label>
            <textarea value={meta.descricao} onChange={e => setMeta({ ...meta, descricao: e.target.value })} placeholder="ex.: Medir como o casco reage ao pousar na água em diferentes velocidades verticais, para caracterizar o impacto do pouso." className="w-full mt-1 mb-3 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 h-20" />
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500">Responsável</label><input value={meta.responsavel} onChange={e => setMeta({ ...meta, responsavel: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
              <div><label className="text-xs text-slate-500">Data do ensaio</label><input type="date" value={meta.data} onChange={e => setMeta({ ...meta, data: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
              <div><label className="text-xs text-slate-500">Equipamento / veículo</label><input value={meta.equipamento} onChange={e => setMeta({ ...meta, equipamento: e.target.value })} placeholder="ex.: Hydrone v2" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
              <div><label className="text-xs text-slate-500">Local</label><input value={meta.local} onChange={e => setMeta({ ...meta, local: e.target.value })} placeholder="ex.: tanque Nautec" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><ClipboardList size={15} className="text-blue-700" /> Montar o checklist</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setLibEditMode(v => !v)} className={`text-sm px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${libEditMode ? "bg-blue-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}><Pencil size={14} /> {libEditMode ? "Concluir edição" : "Editar biblioteca"}</button>
                {libEditMode && <button onClick={restaurarPadrao} className="text-sm px-3 py-1.5 rounded-lg font-medium bg-white border border-slate-200 text-slate-600 flex items-center gap-1.5"><RotateCcw size={14} /> Restaurar padrão</button>}
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-3">Marque o que vai entrar no checklist deste experimento — você preenche os resultados na etapa Experimento, durante o ensaio. Toque no "?" de um item para ver a explicação; dentro dela, "detalhe técnico" mostra o rigor por trás.</p>
            <div className="space-y-3">
              {blocosAtivos.map((bloco, idx) => {
                const ids = bloco.itens.map(i => i.id);
                const todos = ids.length > 0 && ids.every(id => selecionados.has(id));
                const marcados = ids.filter(id => selecionados.has(id)).length;
                const aberto = grupoAberto(bloco.id, idx, blocosAtivos.length);
                return (<div key={bloco.id} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => toggleGrupo(bloco.id)} className="flex items-start gap-2 text-left flex-1 min-w-0">
                      <ChevronDown size={15} className={`mt-1 text-slate-400 transition-transform shrink-0 ${aberto ? "rotate-180" : ""}`} />
                      <span className="min-w-0">
                        <span className="font-bold text-slate-800">{bloco.titulo}</span>
                        {bloco.fonte && <span className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 ml-2">{bloco.fonte}</span>}
                        <span className={`text-xs font-semibold ml-2 ${ids.length > 0 && todos ? "text-emerald-700" : "text-blue-700"}`}>{marcados}/{ids.length}</span>
                        <div className="text-xs text-slate-500 mt-0.5">{bloco.resumo}</div>
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {ids.length > 0 && <button onClick={e => { e.stopPropagation(); toggleBlocoInteiro(bloco); }} className="text-[11px] font-medium text-blue-700 hover:text-blue-900 px-1.5 py-1 whitespace-nowrap">{todos ? "desmarcar tudo" : "marcar tudo"}</button>}
                      {libEditMode && <><button onClick={() => openEditBloco(bloco)} className="text-slate-400 hover:text-blue-600 p-1"><Pencil size={14} /></button><button onClick={() => removeBloco(bloco.id)} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={14} /></button></>}
                    </div>
                  </div>
                  {aberto && (<div className="mt-2 space-y-1.5 pl-6">
                    {bloco.itens.map(item => {
                      const marcado = selecionados.has(item.id);
                      return (<ItemCompacto key={item.id} item={item}
                        aberto={explicacaoAbertos.has(item.id)} tecAberto={detalheAbertos.has(item.id)}
                        onToggleExplicacao={() => toggleExplicacao(item.id)} onToggleDetalhe={() => toggleDetalhe(item.id)}
                        onClickRow={() => toggleItem(item.id)}
                        className={marcado ? "border-blue-300 bg-blue-50/50" : "border-slate-100 hover:border-slate-200"}
                        left={<input type="checkbox" checked={marcado} onChange={() => toggleItem(item.id)} onClick={e => e.stopPropagation()} className="shrink-0" />}
                        right={libEditMode && <div onClick={e => e.stopPropagation()} className="flex gap-1 shrink-0"><button onClick={() => openEditItem(bloco.id, item)} className="text-slate-400 hover:text-blue-600 p-1"><Pencil size={13} /></button><button onClick={() => removeItem(bloco.id, item.id)} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={13} /></button></div>}
                      />);
                    })}
                    {libEditMode && <button onClick={() => openNewItem(bloco.id)} className="text-xs text-blue-700 font-medium flex items-center gap-1 mt-1"><Plus size={13} /> Novo requisito neste bloco</button>}
                  </div>)}
                </div>);
              })}
            </div>
            {libEditMode && <button onClick={openNewBloco} className="mt-3 text-sm text-blue-700 font-medium flex items-center gap-1"><Plus size={15} /> Novo bloco</button>}
          </section>

          <button onClick={() => setStep(2)} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition">Ir para o Experimento (Campo) →</button>
        </div>)}

        {/* ETAPA 2 — EXPERIMENTO: execução em campo */}
        {step === 2 && (<div className="space-y-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft size={14} /> Sobre</button>
            <button onClick={() => setStep(1)} title="Trocar modo do ensaio" className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-full px-2.5 py-1">{resumoModoFases(categoriaAtiva, meta)}</button>
          </div>

          {/* Pré-check de estanqueidade, feito no local antes da água — por isso fica
              na etapa de campo. Reprovar sinaliza, mas não bloqueia. */}
          {exigeTesteVacuo(categoriaAtiva) && (
            <TesteVacuo valor={testeVacuo} onChange={setTesteVacuo} readOnly={readOnly} />
          )}

          {selectedFlat.length === 0 ? (
            <div className="text-center bg-white rounded-xl border border-slate-200 p-8">
              <ClipboardList size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 mb-4">Você ainda não montou o checklist deste experimento. Volte para <b>Sobre</b> e marque as variáveis do ensaio em <b>Montar o checklist</b>.</p>
              <button onClick={() => setStep(1)} className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg font-medium">Montar o checklist</button>
            </div>
          ) : (<>
            {sessaoItems.length > 0 && (<section className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm font-semibold text-slate-700">Prontidão</span>
                <span className={`text-sm font-bold flex items-center gap-1.5 ${sessaoFalhas > 0 ? "text-rose-600" : "text-slate-700"}`}>
                  Verificado: {sessaoVerificados}/{sessaoItems.length}
                  {sessaoFalhas > 0 && <span className="flex items-center gap-1"><AlertTriangle size={13} /> {sessaoFalhas} {sessaoFalhas === 1 ? "falhou" : "falharam"}</span>}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${sessaoFalhas > 0 ? "bg-rose-500" : "bg-blue-600"}`} style={{ width: `${sessaoItems.length ? Math.round(sessaoVerificados / sessaoItems.length * 100) : 0}%` }} />
              </div>
            </section>)}

            <section className="bg-blue-50 border border-blue-100 rounded-lg">
              <button onClick={() => setOrdemAberta(v => !v)} className="w-full flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-900 text-left">
                <span className="w-3 inline-block">{ordemAberta ? "▾" : "▸"}</span> Sugestão de ordem em campo
              </button>
              {ordemAberta && (<ol className="px-3 pb-3 -mt-1 list-decimal list-inside space-y-0.5 text-sm text-slate-600">
                {(ORDEM_SUGERIDA[categoriaAtiva] || []).map((o, i) => { const b = blocosAtivos.find(x => x.id === o.bloco); if (!b) return null; return <li key={i}><b className="text-slate-700">{b.titulo}</b> — {o.nota}</li>; })}
              </ol>)}
            </section>

            {sessaoItems.length > 0 && (<section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ClipboardCheck size={15} className="text-blue-700" /> Preencher o checklist</h2>
              <p className="text-xs text-slate-500 -mt-1.5 mb-2">Preencha aqui, durante o ensaio.</p>
              <div className="space-y-3">
                {sessaoPorBloco.map((grupo, idx) => {
                  const verificados = grupo.itens.filter(itemVerificado).length;
                  const aberto = grupoAberto(grupo.id, idx, sessaoPorBloco.length);
                  return (<div key={grupo.id} className="bg-white rounded-xl border border-slate-200 p-3">
                    <button onClick={() => toggleGrupo(grupo.id)} className="w-full flex items-center justify-between gap-2 text-left">
                      <span className="flex items-center gap-2 min-w-0"><ChevronDown size={15} className={`text-slate-400 transition-transform shrink-0 ${aberto ? "rotate-180" : ""}`} /><span className="font-bold text-slate-800 truncate">{grupo.titulo}</span>{grupo.fonte && <span className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 shrink-0">{grupo.fonte}</span>}</span>
                      <span className={`text-xs font-semibold shrink-0 ${verificados === grupo.itens.length ? "text-emerald-700" : "text-slate-500"}`}>{verificados}/{grupo.itens.length}</span>
                    </button>
                    {aberto && (<div className="mt-2 space-y-1.5">
                      {grupo.itens.map(item => { const v = sessaoValores[item.id] || {}; const r = respostaDe(item); const opts = opcoesDe(item); return (
                        <ItemCompacto key={item.id} item={item}
                          aberto={explicacaoAbertos.has(item.id)} tecAberto={detalheAbertos.has(item.id)}
                          onToggleExplicacao={() => toggleExplicacao(item.id)} onToggleDetalhe={() => toggleDetalhe(item.id)}
                          className={["Falhou", "Não", "Refazer"].includes(v.resultado) ? "border-rose-200 bg-rose-50/50" : "border-slate-100"}
                          right={r === "valor" ? (<div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><input disabled={readOnly} value={v.valor || ""} onChange={e => setSessaoValor(item.id, { valor: e.target.value })} placeholder="valor" className="w-24 px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400" />{item.unidade && <span className="text-xs text-slate-400 w-8">{item.unidade}</span>}</div>)
                            : r === "hora" ? (<div onClick={e => e.stopPropagation()}><CampoHora compacto disabled={readOnly} value={v.valor} onChange={val => setSessaoValor(item.id, { valor: val })} /></div>)
                            : r === "data" ? (<div onClick={e => e.stopPropagation()}><input type="date" disabled={readOnly} value={v.valor || ""} onChange={e => setSessaoValor(item.id, { valor: e.target.value })} className="px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400" /></div>)
                            : r === "texto" ? null
                            : (<div className="flex gap-1 flex-wrap justify-end" onClick={e => e.stopPropagation()}>{opts.map(op => { const on = v.resultado === op; return <button key={op} disabled={readOnly} onClick={() => setSessaoValor(item.id, { resultado: on ? "" : op })} className={`text-xs px-2 py-1 rounded-lg font-medium disabled:opacity-50 ${corPilula(op, on)}`}>{op}</button>; })}</div>)}
                          abaixo={r === "texto" ? (<textarea disabled={readOnly} value={v.valor || ""} onChange={e => setSessaoValor(item.id, { valor: e.target.value })} onInput={autoGrow} placeholder="Descreva em detalhe o que foi feito…" rows={3} className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400 resize-none min-h-[4.5rem]" />) : null}
                        />); })}
                    </div>)}
                  </div>);
                })}
              </div>
            </section>)}

            {ensaioItems.length > 0 && (
              <PlanilhaCampo key={currentExp?.id || "novo"} itens={ensaioItems} rows={ensaioRows} readOnly={readOnly}
                onAdd={addEnsaioRow} onSetCell={setEnsaioCell} onDel={delEnsaioRow} onExport={exportPlanilha} />
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button onClick={onSaveClick} disabled={busy || readOnly} title={readOnly ? "Somente leitura" : "Salvar o progresso na nuvem"} className="text-sm bg-white border border-slate-200 hover:border-blue-400 disabled:opacity-50 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5">{readOnly ? <Lock size={15} /> : <Save size={15} className="text-blue-700" />} Salvar progresso</button>
              <span className="text-xs text-slate-500">Grava o que foi preenchido até aqui. O envio ao Drive fica na próxima etapa.</span>
            </div>
            <button onClick={() => setStep(3)} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition">Finalizar ensaio e anexar arquivos →</button>
          </>)}
        </div>)}
        {/* ETAPA 3 — FINALIZAR: evidências e envio ao Drive */}
        {step === 3 && (<div className="space-y-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"><ArrowLeft size={14} /> Experimento</button>
          </div>

          <Finalizar
            expId={currentExp?.id} readOnly={readOnly}
            nomeExperimento={(meta.nome || "").trim().slice(0, 120)}
            dataIso={meta.data} folhaPdf={currentExp?.folhaPdf}
            resumo={{ verificados: sessaoVerificados, totalChecklist: sessaoItems.length, falhas: sessaoFalhas, ensaios: ensaioRows.length }}
            pendentes={pendentes} setPendentes={setPendentes}
            onSalvarExperimento={() => persist()}
            gerarDadosFolha={dadosFolha}
            onFolhaSalva={(folhaPdf) => setCurrentExp(prev => (prev ? { ...prev, folhaPdf } : prev))}
            onBaixarPdf={baixarFolhaPdf}
            onBaixarCsv={ensaioRows.length ? exportPlanilha : null}
            onExportarJson={exportJSON} onImportarJson={importJSON} />

          {currentExp?.id && isOwnerCurrent && (<section className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Share2 size={13} className="text-blue-700" /> Compartilhar edição</h3>
            <div className="flex gap-2">
              <select id="editorSel" className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white outline-none focus:border-blue-400"><option value="">Escolher pessoa…</option>{profilesList.filter(p => p.uid !== currentExp.ownerId && !(currentExp.editors || []).includes(p.uid)).map(p => <option key={p.uid} value={p.uid}>{p.name}</option>)}</select>
              <button onClick={() => { const el = document.getElementById("editorSel"); if (el?.value) { addEditor(el.value); el.value = ""; } }} className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-3 rounded-lg font-medium">Conceder</button>
            </div>
            {(currentExp.editors || []).length > 0 && (<div className="flex flex-wrap gap-1.5 mt-2">{currentExp.editors.map(uid => { const p = profilesList.find(x => x.uid === uid); return (<span key={uid} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-800 rounded-full pl-2 pr-1 py-0.5">{p?.name || uid.slice(0, 6)}<button onClick={() => removeEditor(uid)} className="hover:text-rose-500"><X size={12} /></button></span>); })}</div>)}
          </section>)}

        </div>)}
      </main>

      <footer className="bg-gradient-to-r from-[#12185a] via-[#1e1b78] to-[#3a3ad8] text-white/75">
        <p className="max-w-6xl mx-auto px-4 py-1.5 font-titulo text-[11px] sm:text-xs">
          Projeto Hydrone · Sistema de Planejamento e Ensaios de Campo <span className="hidden sm:inline">|</span><br className="sm:hidden" /> Desenvolvido por Aline Timm
        </p>
      </footer>

      {menuUsuario}

      {/* Modal: editar/adicionar requisito */}
      {itemDraft && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setItemDraft(null)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[88vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">{itemDraft.itemId ? "Editar requisito" : "Novo requisito"}</h3><button onClick={() => setItemDraft(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-500 font-medium">Título</label><input value={itemDraft.titulo} onChange={e => setItemDraft({ ...itemDraft, titulo: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
          <div><label className="text-xs text-slate-500 font-medium">Explicação simples (sempre visível)</label><textarea value={itemDraft.simples} onChange={e => setItemDraft({ ...itemDraft, simples: e.target.value })} placeholder="Explique em linguagem do dia a dia, sem jargão." className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 h-16" /></div>
          <div><label className="text-xs text-slate-500 font-medium">O que isso gera (detalhe técnico)</label><textarea value={itemDraft.gera} onChange={e => setItemDraft({ ...itemDraft, gera: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 h-14" /></div>
          <div><label className="text-xs text-slate-500 font-medium">Por que isso é importante? (detalhe técnico)</label><textarea value={itemDraft.porque} onChange={e => setItemDraft({ ...itemDraft, porque: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 h-14" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-slate-500 font-medium">Tipo de resposta</label><select value={itemDraft.resposta} onChange={e => setItemDraft({ ...itemDraft, resposta: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white outline-none focus:border-blue-400">{Object.entries(RESPOSTAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="text-xs text-slate-500 font-medium">Escopo</label><select value={itemDraft.escopo} onChange={e => setItemDraft({ ...itemDraft, escopo: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white outline-none focus:border-blue-400"><option value="ensaio">Por ensaio (planilha)</option><option value="sessao">Da sessão (uma vez)</option></select></div>
          </div>
          {["verificacao", "ok_ajustar", "sim_nao", "opcoes"].includes(itemDraft.resposta) && (
            <div><label className="text-xs text-slate-500 font-medium">Opções (separadas por vírgula)</label><input value={(itemDraft.opcoes && itemDraft.opcoes.length ? itemDraft.opcoes : RESPOSTAS[itemDraft.resposta]?.padrao || []).join(", ")} onChange={e => setItemDraft({ ...itemDraft, opcoes: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="ex.: Passou, Falhou, N/A" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
          )}
          {itemDraft.resposta === "valor" && (
            <div><label className="text-xs text-slate-500 font-medium">Unidade</label><input value={itemDraft.unidade} onChange={e => setItemDraft({ ...itemDraft, unidade: e.target.value })} placeholder="ex.: m/s" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400" /></div>
          )}
          <div>
            <label className="text-xs text-slate-500 font-medium">Modo do ensaio</label>
            <div className="flex gap-3 mt-1 text-sm text-slate-700">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={(itemDraft.modos || []).includes("voo")} onChange={() => toggleModoDraft("voo")} /> Só voo</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={(itemDraft.modos || []).includes("sub")} onChange={() => toggleModoDraft("sub")} /> Só subaquático</label>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Sem marcar nada, o item aparece em qualquer modo.</p>
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
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">{categoriaMeta(x.modo).label}</span>
                  {x.resumoModo && <span className="inline-block text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">{x.resumoModo}</span>}
                  {x.statusEstanqueidade && x.statusEstanqueidade !== "pendente" && (
                    <span className={`inline-block text-[10px] font-semibold rounded-full px-2 py-0.5 border ${x.statusEstanqueidade === "reprovado" ? "text-rose-700 bg-rose-50 border-rose-200" : x.statusEstanqueidade === "aprovado" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200"}`}>
                      vácuo: {ROTULO_STATUS[x.statusEstanqueidade]}
                    </span>
                  )}
                  {x.data && <span className="text-[10px] text-slate-400">{x.data}</span>}
                  {x.responsavel && <span className="text-[10px] text-slate-400">· {x.responsavel}</span>}
                </div>
              </button>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => duplicarComoModelo(x)} title="Duplicar como modelo (sem os dados preenchidos)" className="text-slate-400 hover:text-blue-600 p-1"><Copy size={15} /></button>
                {(isAdmin || mine) && <button onClick={() => removeExperiment(x)} title="Excluir" className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={15} /></button>}
              </div>
            </li>); })}</ul>); })()}
      </div></div>)}

      {showSaveDlg && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowSaveDlg(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}><h3 className="font-bold text-slate-800 mb-1">Salvar experimento</h3><p className="text-xs text-slate-500 mb-3">O nome é obrigatório: identifica o experimento na lista do time e vira o nome da pasta dele no Google Drive.</p><input autoFocus value={saveTitle} onChange={e => setSaveTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && saveTitle.trim() && persist(saveTitle)} placeholder="Nome do experimento" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-400" autoFocus /><div className="flex gap-2 mt-4"><button onClick={() => setShowSaveDlg(false)} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-600">Cancelar</button><button onClick={() => persist(saveTitle)} disabled={busy || !saveTitle.trim()} className="flex-1 text-sm py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold">Salvar</button></div></div></div>)}

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}
    </div>
  );
}
