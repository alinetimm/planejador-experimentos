import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ErrorBar, ResponsiveContainer, ScatterChart, Scatter, Legend, ReferenceLine } from "recharts";
import { Waves, Target, ClipboardList, BarChart3, Download, Upload, Plus, Trash2, FlaskConical, Sigma, Info, Lightbulb, BookOpen, ChevronDown, HelpCircle, CheckCircle2, User, LogOut, Save, FolderOpen, RotateCcw, AlertTriangle, X, FileJson, LayoutTemplate, FileText, DownloadCloud, ClipboardCheck, Monitor, FunctionSquare } from "lucide-react";

const LS = (() => {
  const mem = {};
  return {
    get: k => { try { return window.localStorage.getItem(k); } catch { return k in mem ? mem[k] : null; } },
    set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { mem[k] = v; } },
    del: k => { try { window.localStorage.removeItem(k); } catch { delete mem[k]; } },
  };
})();
const readJSON = (k, fb) => { try { const v = LS.get(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const writeJSON = (k, v) => LS.set(k, JSON.stringify(v));
const USERS_KEY = "hep:users";

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const variance = a => { const m = mean(a); return a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1); };
const std = a => a.length > 1 ? Math.sqrt(variance(a)) : 0;
const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
function gammaln(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y++; ser += c[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betai(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
const fPValue = (F, d1, d2) => F <= 0 ? 1 : betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F));
function oneWayAnova(groups) {
  const keys = Object.keys(groups); const all = keys.flatMap(k => groups[k]);
  const N = all.length, k = keys.length, grand = mean(all);
  let ssb = 0, ssw = 0;
  keys.forEach(key => { const g = groups[key], gm = mean(g); ssb += g.length * (gm - grand) ** 2; g.forEach(v => ssw += (v - gm) ** 2); });
  const dfb = k - 1, dfw = N - k, msb = ssb / dfb, msw = ssw / dfw, F = msb / msw;
  return { ssb, ssw, sst: ssb + ssw, dfb, dfw, msb, msw, F, p: fPValue(F, dfb, dfw), k, N };
}
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
function toCSV(rows, cols) {
  const esc = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}
function download(name, content, type) {
  const blob = new Blob([content], { type: type || "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

const OBJETIVOS = [
  { id: "comparar", label: "Comparar configurações / tratamentos", pergunta: "Qual é melhor? Faz diferença?", oque: "Você tem 2 ou mais 'jeitos de fazer' a mesma coisa e quer saber qual rende melhor — ou se a diferença é real ou foi só sorte.", exemplo: "Você quer descobrir qual de três hélices gera mais empuxo. Testa cada uma várias vezes e compara as médias.", design: "Delineamento completamente aleatorizado · ANOVA de um fator", princ: ["Aleatorizar a ordem das corridas", "Replicar para medir o acaso", "Blocar ruído conhecido (dia, bateria)"], interpreta: "Use a ANOVA de um fator. Se o valor-p < 0,05, há diferença real entre os grupos (não foi acaso). O app já calcula isso na etapa de Análise.", ref: "Montgomery (2017), cap. 3 · NIST/SEMATECH §5.3.3.1" },
  { id: "triar", label: "Triar fatores (quais importam?)", pergunta: "Quais variáveis realmente afetam o resultado?", oque: "Você tem MUITAS variáveis suspeitas e quer descobrir, com poucos testes, quais de fato pesam — para focar só nelas depois.", exemplo: "Na transição água→ar, 6 fatores podem importar (ângulo, empuxo, velocidade, água residual...). Um fatorial fracionado revela os 2–3 dominantes sem testar todas as combinações.", design: "Fatorial fracionado 2^(k−p) · Plackett–Burman", princ: ["Esparsidade de efeitos: poucos dominam", "Muitos fatores, poucas corridas", "Atenção à resolução do delineamento"], interpreta: "Olhe a magnitude dos efeitos principais: os maiores são os fatores que importam. Parte da ideia de que poucos fatores explicam a maior parte da variação.", ref: "Fisher (1935) · Montgomery (2017), cap. 8 · NIST/SEMATECH §5.3.3.5" },
  { id: "caracterizar", label: "Caracterizar efeitos e interações", pergunta: "Como as variáveis se combinam?", oque: "Você já sabe quais variáveis importam e quer entender a fundo como agem — inclusive quando uma muda o efeito da outra (interação).", exemplo: "Como empuxo e ângulo de ataque, JUNTOS, afetam a estabilidade no pouso sobre a USV? Testa todas as combinações de níveis.", design: "Fatorial completo 2^k (todas as combinações)", princ: ["Cobre todas as combinações de níveis", "Estima efeitos principais E interações", "Cresce rápido com o nº de fatores"], interpreta: "ANOVA com efeitos principais e de interação. Um efeito de interação significativo (p < 0,05) indica que um fator depende do nível do outro.", ref: "Montgomery (2017), cap. 5–6 · NIST/SEMATECH §5.3.3.3" },
  { id: "otimizar", label: "Otimizar uma resposta", pergunta: "Qual o melhor ajuste possível?", oque: "Você quer achar a combinação exata de ajustes que dá o melhor resultado (máximo ou mínimo) — não só comparar opções fixas, mas encontrar o ponto ótimo.", exemplo: "Qual combinação de potência dos thrusters e ângulo MINIMIZA o tempo de pouso na embarcação?", design: "Superfície de Resposta (RSM) · CCD ou Box–Behnken", princ: ["Modela a curvatura da resposta", "Pontos centrais e axiais", "Faça triagem antes se houver muitos fatores"], interpreta: "Ajusta-se um modelo quadrático para localizar o ponto ótimo. Se houver muitos fatores, trie primeiro e otimize depois com um delineamento composto central.", ref: "Montgomery (2017), cap. 11 · NIST/SEMATECH §5.3.3.6" },
  { id: "validar", label: "Validar modelo (predito × medido)", pergunta: "Meu modelo acerta a realidade?", oque: "Você tem um modelo (simulação ou equação) e quer saber o quão bem ele prevê o que acontece de verdade.", exemplo: "O modelo dinâmico 6-DOF do Whiteboat prevê a trajetória medida pela câmera? Compara o valor predito com o medido em cada ponto.", design: "Comparação predito × medido · regressão", princ: ["Reta identidade (predito = medido) como referência", "R² mede o ajuste; RMSE mede o erro típico", "Inspecione o padrão dos resíduos"], interpreta: "Use o painel 'Predito × Medido' na Análise. R² perto de 1 e RMSE baixo = bom modelo. Resíduos com padrão indicam viés sistemático.", ref: "Montgomery (2017), cap. 10 · NIST/SEMATECH §5.2.4" },
];
const CONTEXTOS = {
  campo: { label: "Campo", Icon: Waves, nota: "Corridas caras e arriscadas → priorize delineamentos econômicos (fracionados, blocagem) e a replicação mínima viável." },
  simulado: { label: "Simulado", Icon: Monitor, nota: "Custo por corrida baixo → fatorial completo e mais réplicas são viáveis. Cuide do realismo do ambiente." },
  matematico: { label: "Matemático", Icon: FunctionSquare, nota: "Em geral determinístico → foque em varredura sistemática de parâmetros e na validação das hipóteses do modelo." },
};
const CONCEITOS = [
  { termo: "Fator", cor: "teal", def: "Uma variável que VOCÊ controla e decide testar.", ex: "tipo de hélice · potência do thruster (%) · ângulo de ataque (°)" },
  { termo: "Nível", cor: "cyan", def: "Os valores que um fator pode assumir durante o teste.", ex: "potência → 50, 75, 100   |   hélice → A, B, C" },
  { termo: "Resposta", cor: "blue", def: "O que você MEDE como resultado de cada corrida.", ex: "empuxo (N) · tempo de pouso (s) · erro de posição (m)" },
  { termo: "Réplica", cor: "violet", def: "Quantas vezes cada combinação é repetida. Repetir revela quanto o resultado varia por acaso e dá confiança estatística.", ex: "2 réplicas = cada combinação testada 2 vezes" },
];
const REFERENCIAS = [
  { t: "Montgomery, D. C. (2017). Design and Analysis of Experiments (9ª ed.). Wiley.", u: "https://www.wiley.com/en-us/Design+and+Analysis+of+Experiments,+10th+Edition-p-9781119492443" },
  { t: "Fisher, R. A. (1935). The Design of Experiments. Oliver & Boyd.", u: null },
  { t: "NIST/SEMATECH (2012). e-Handbook of Statistical Methods (Handbook 151), Seção 5.", u: "https://www.itl.nist.gov/div898/handbook/" },
];
const EXEMPLO = [
  { Config: "Hélice A", Empuxo_N: 12.1 }, { Config: "Hélice A", Empuxo_N: 11.8 }, { Config: "Hélice A", Empuxo_N: 12.4 }, { Config: "Hélice A", Empuxo_N: 12.0 },
  { Config: "Hélice B", Empuxo_N: 14.2 }, { Config: "Hélice B", Empuxo_N: 13.9 }, { Config: "Hélice B", Empuxo_N: 14.6 }, { Config: "Hélice B", Empuxo_N: 14.0 },
  { Config: "Hélice C", Empuxo_N: 13.1 }, { Config: "Hélice C", Empuxo_N: 12.7 }, { Config: "Hélice C", Empuxo_N: 13.4 }, { Config: "Hélice C", Empuxo_N: 13.0 },
];
const PALETTE = ["#0d9488", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#ea580c"];
const COR = { teal: "text-teal-700 bg-teal-50", cyan: "text-cyan-700 bg-cyan-50", blue: "text-blue-700 bg-blue-50", violet: "text-violet-700 bg-violet-50" };
const today = () => new Date().toISOString().slice(0, 10);
const META_DEF = { responsavel: "", data: today(), equipamento: "", local: "", notas: "" };
const DEF = { contexto: "campo", objetivo: "comparar", factors: [{ id: 1, name: "Fator A", levelsRaw: "baixo, alto" }], responses: ["Resposta"], replicates: 2, matrix: [], rows: [], headers: [], groupCol: "", respCol: "", predX: "", predY: "", meta: { ...META_DEF } };

const TEMPLATES = [
  { id: "potencia", nome: "Verificação de potência nos motores", desc: "Comparar a corrente exigida por cada manobra (submergir, mergulhar, voar).", state: { objetivo: "comparar", contexto: "campo", factors: [{ id: 1, name: "Manobra", levelsRaw: "Submergir, Mergulhar, Voar" }], responses: ["Corrente_A"], replicates: 3 } },
  { id: "validacao", nome: "Validação de modelo 6-DOF", desc: "Comparar o modelo matemático 6-DOF com experimentos reais (predito × medido).", state: { objetivo: "validar", contexto: "matematico", factors: [], responses: ["Predito", "Medido"], replicates: 1 } },
  { id: "logs", nome: "Análise de logs (tlog / .bin)", desc: "Verificar o comportamento do drone a partir dos logs da Pixhawk, por fase de voo.", state: { objetivo: "caracterizar", contexto: "campo", factors: [{ id: 1, name: "Fase_voo", levelsRaw: "Submersao, Transicao, Voo" }], responses: ["Corrente_A"], replicates: 2 } },
  { id: "montagem", nome: "Configuração de montagem mais eficiente", desc: "Comparar configurações mecânicas quanto à eficiência energética, aerodinâmica e hidrodinâmica.", state: { objetivo: "comparar", contexto: "campo", factors: [{ id: 1, name: "Config_montagem", levelsRaw: "A, B, C" }], responses: ["Eficiencia_energetica", "Arrasto_aero", "Arrasto_hidro"], replicates: 3 } },
];

export default function App() {
  const [users, setUsers] = useState(() => readJSON(USERS_KEY, []));
  const [currentUser, setCurrentUser] = useState(null);
  const [loginName, setLoginName] = useState("");
  const [saves, setSaves] = useState([]);
  const [showSaves, setShowSaves] = useState(false);
  const [showSaveDlg, setShowSaveDlg] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [toast, setToast] = useState("");
  const [deferred, setDeferred] = useState(null);

  const [step, setStep] = useState(1);
  const [contexto, setContexto] = useState(DEF.contexto);
  const [objetivo, setObjetivo] = useState(DEF.objetivo);
  const [openEx, setOpenEx] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showRefs, setShowRefs] = useState(false);
  const [factors, setFactors] = useState(DEF.factors);
  const [responses, setResponses] = useState(DEF.responses);
  const [replicates, setReplicates] = useState(DEF.replicates);
  const [matrix, setMatrix] = useState([]);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [groupCol, setGroupCol] = useState("");
  const [respCol, setRespCol] = useState("");
  const [predX, setPredX] = useState("");
  const [predY, setPredY] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [meta, setMeta] = useState({ ...META_DEF });

  const bundle = () => ({ contexto, objetivo, factors, responses, replicates, matrix, rows, headers, groupCol, respCol, predX, predY, meta });
  const applyBundle = (b) => {
    setContexto(b.contexto ?? DEF.contexto); setObjetivo(b.objetivo ?? DEF.objetivo);
    setFactors(b.factors ?? DEF.factors); setResponses(b.responses ?? DEF.responses);
    setReplicates(b.replicates ?? DEF.replicates); setMatrix(b.matrix ?? []);
    setRows(b.rows ?? []); setHeaders(b.headers ?? []); setGroupCol(b.groupCol ?? "");
    setRespCol(b.respCol ?? ""); setPredX(b.predX ?? ""); setPredY(b.predY ?? "");
    setMeta(b.meta ?? { ...META_DEF });
  };
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  const installApp = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; setDeferred(null); };

  const login = (name) => {
    const n = name.trim(); if (!n) return;
    let u = users.find(x => x.name.toLowerCase() === n.toLowerCase());
    if (!u) { u = { id: Date.now().toString(36), name: n }; const nu = [...users, u]; setUsers(nu); writeJSON(USERS_KEY, nu); }
    setCurrentUser(u);
    const work = readJSON(`hep:work:${u.id}`, null);
    applyBundle(work || { ...DEF, meta: { ...META_DEF, responsavel: u.name } });
    setSaves(readJSON(`hep:saves:${u.id}`, []));
    setStep(1); setLoginName("");
  };
  const switchUser = () => { setCurrentUser(null); applyBundle(DEF); setStep(1); };
  const removeUser = (id) => { const nu = users.filter(u => u.id !== id); setUsers(nu); writeJSON(USERS_KEY, nu); LS.del(`hep:work:${id}`); LS.del(`hep:saves:${id}`); };
  const resetForm = () => { applyBundle({ ...DEF, meta: { ...META_DEF, responsavel: currentUser?.name || "" } }); setLoadErr(""); flash("Formulário limpo"); };
  const applyTemplate = (t) => { applyBundle({ ...DEF, ...t.state, meta }); setShowTemplates(false); setStep(1); flash(`Template "${t.nome}" aplicado`); };

  useEffect(() => {
    if (!currentUser) return;
    writeJSON(`hep:work:${currentUser.id}`, bundle());
  }, [currentUser, contexto, objetivo, factors, responses, replicates, matrix, rows, headers, groupCol, respCol, predX, predY, meta]);

  const saveAnalysis = (title) => {
    if (!currentUser) return;
    const s = { id: Date.now().toString(36), title: title.trim() || `Análise ${saves.length + 1}`, savedAt: new Date().toISOString(), state: bundle() };
    const ns = [s, ...saves]; setSaves(ns); writeJSON(`hep:saves:${currentUser.id}`, ns);
    setShowSaveDlg(false); setSaveTitle(""); flash("Análise salva");
  };
  const loadAnalysis = (s) => { applyBundle(s.state); setShowSaves(false); flash(`"${s.title}" carregada`); };
  const deleteAnalysis = (id) => { const ns = saves.filter(x => x.id !== id); setSaves(ns); writeJSON(`hep:saves:${currentUser.id}`, ns); };
  const exportJSON = () => download(`analise_${(currentUser?.name || "user").replace(/\s/g, "_")}.json`, JSON.stringify({ app: "hydrone-exp", user: currentUser?.name, state: bundle() }, null, 2), "application/json");
  const importJSON = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); if (d.state) { applyBundle(d.state); flash("Análise importada"); } } catch { flash("Arquivo inválido"); } };
    r.readAsText(f);
  };

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const buildReportHTML = () => {
    const descBloco = analysis ? `<h2>Resultados</h2><table><tr><th>Grupo</th><th>n</th><th>Média</th><th>DP</th><th>Mediana</th></tr>${analysis.desc.map(d => `<tr><td>${esc(d.grupo)}</td><td>${d.n}</td><td>${d.media.toFixed(3)}</td><td>${d.dp.toFixed(3)}</td><td>${d.mediana.toFixed(3)}</td></tr>`).join("")}</table>${analysis.anova ? `<p><b>ANOVA:</b> F(${analysis.anova.dfb}, ${analysis.anova.dfw}) = ${analysis.anova.F.toFixed(3)}, p = ${analysis.anova.p < 0.0001 ? "&lt;0,0001" : analysis.anova.p.toFixed(4)}. ${esc(anovaConc || "")}</p>` : ""}${analysis.levene ? `<p><b>Pressuposto (Brown–Forsythe):</b> F = ${analysis.levene.F.toFixed(3)}, p = ${analysis.levene.p < 0.0001 ? "&lt;0,0001" : analysis.levene.p.toFixed(4)} — ${analysis.levene.p < 0.05 ? "variâncias heterogêneas; interpretar a ANOVA com cautela." : "variâncias homogêneas; pressuposto razoável."}</p>` : ""}` : "";
    const predBloco = predData ? `<p><b>Validação predito × medido:</b> R² = ${predData.r2.toFixed(4)} · RMSE = ${predData.rmse.toFixed(4)}.</p>` : "";
    const fatores = parsedFactors.length ? parsedFactors.map(f => `${esc(f.name)} (${esc(f.levels.join(", "))})`).join(" · ") : "—";
    return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Relatório de Experimento — Hydrone</title><style>
body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:760px;margin:24px auto;padding:0 24px;}
h1{font-size:20px;color:#0f766e;border-bottom:2px solid #0d9488;padding-bottom:6px;margin-bottom:2px;}
.sub{font-size:12px;color:#64748b;margin:0 0 16px;}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#0f766e;margin:20px 0 6px;}
table{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0;}
td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #e2e8f0;}
.meta td:first-child{color:#64748b;width:160px;}
p{font-size:13px;line-height:1.5;margin:4px 0;}
ul{font-size:12px;color:#475569;padding-left:18px;}
.foot{font-size:11px;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;}
@media print{body{margin:0;}}
</style></head><body>
<h1>Relatório de Experimento</h1><p class="sub">Planejador de Experimentos · Hydrone</p>
<table class="meta">
<tr><td>Responsável</td><td>${esc(meta.responsavel || currentUser.name)}</td></tr>
<tr><td>Data</td><td>${esc(meta.data)}</td></tr>
${meta.equipamento ? `<tr><td>Equipamento</td><td>${esc(meta.equipamento)}</td></tr>` : ""}
${meta.local ? `<tr><td>Local</td><td>${esc(meta.local)}</td></tr>` : ""}
<tr><td>Contexto</td><td>${esc(CONTEXTOS[contexto].label)}</td></tr>
<tr><td>Objetivo</td><td>${esc(obj.label)}</td></tr>
</table>
<h2>Planejamento</h2>
<p><b>Delineamento:</b> ${esc(obj.design)}</p>
<p><b>Fatores:</b> ${fatores}</p>
<p><b>Respostas:</b> ${esc(cleanResp.join(", ") || "—")}</p>
<p><b>Réplicas:</b> ${replicates} · <b>Corridas previstas:</b> ${nRuns || "—"}</p>
${descBloco}${predBloco}
${meta.notas ? `<h2>Observações</h2><p>${esc(meta.notas)}</p>` : ""}
<h2>Referências</h2><ul>${REFERENCIAS.map(r => `<li>${esc(r.t)}</li>`).join("")}</ul>
<p class="foot">Gerado em ${esc(new Date().toLocaleString("pt-BR"))} · Planejador de Experimentos Hydrone</p>
</body></html>`;
  };
  const printReport = () => {
    const html = buildReportHTML();
    try { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (e) { } }, 400); return; } } catch (e) { }
    try {
      const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0;";
      document.body.appendChild(f); const d = f.contentWindow.document; d.open(); d.write(html); d.close();
      setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { } setTimeout(() => f.remove(), 800); }, 400); return;
    } catch (e) { }
    download("relatorio_experimento.html", html, "text/html");
  };

  const parsedFactors = factors.map(f => ({ ...f, levels: f.levelsRaw.split(",").map(s => s.trim()).filter(Boolean) })).filter(f => f.name.trim() && f.levels.length);
  const cleanResp = responses.map(r => r.trim()).filter(Boolean);
  const nRuns = parsedFactors.length ? parsedFactors.reduce((a, f) => a * f.levels.length, 1) * replicates : 0;
  const gerarMatriz = () => {
    if (!parsedFactors.length) return;
    let combos = [{}];
    parsedFactors.forEach(f => { const next = []; combos.forEach(c => f.levels.forEach(lv => next.push({ ...c, [f.name]: lv }))); combos = next; });
    let runs = [];
    for (let r = 1; r <= replicates; r++) combos.forEach((c, i) => runs.push({ ...c, _rep: r, _std: i + 1 }));
    runs = runs.map((r, i) => ({ ...r, _ordem: i + 1 }));
    const sh = shuffle(runs).map((r, i) => {
      const row = { Corrida: i + 1, OrdemPadrao: r._ordem };
      parsedFactors.forEach(f => row[f.name] = r[f.name]); row.Replica = r._rep;
      cleanResp.forEach(rp => row[rp] = ""); return row;
    });
    setMatrix(sh);
  };
  const matrixCols = matrix.length ? ["Corrida", "OrdemPadrao", ...parsedFactors.map(f => f.name), "Replica", ...cleanResp] : [];

  const ingest = (data) => {
    const norm = data.map(r => { const o = {}; Object.keys(r).forEach(k => o[k.trim()] = r[k]); return o; }).filter(r => Object.values(r).some(v => v !== null && v !== ""));
    if (!norm.length) { setLoadErr("Nenhuma linha de dados encontrada."); return; }
    const h = Object.keys(norm[0]); setRows(norm); setHeaders(h); setLoadErr("");
    const numeric = h.filter(c => norm.every(r => r[c] == null || r[c] === "" || typeof r[c] === "number"));
    const cat = h.find(c => !numeric.includes(c)) || h[0];
    setGroupCol(cat); setRespCol(numeric[0] || h[0]); setPredX(numeric[0] || ""); setPredY(numeric[1] || "");
  };
  const parseWith = (file, Papa) => { const P = Papa || window.Papa; P.parse(file, { header: true, dynamicTyping: true, skipEmptyLines: true, complete: r => ingest(r.data), error: () => setLoadErr("Erro ao ler o arquivo.") }); };
  const handleFile = (e) => { const file = e.target.files[0]; if (!file) return; window.Papa ? parseWith(file) : import("papaparse").then(m => parseWith(file, m.default)); };
  const handlePaste = (text) => { import("papaparse").then(m => m.default.parse(text.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true, complete: r => ingest(r.data) })); };

  const analysis = useMemo(() => {
    if (!rows.length || !groupCol || !respCol) return null;
    const valid = rows.filter(r => r[respCol] != null && r[respCol] !== "" && !isNaN(Number(r[respCol])));
    if (valid.length < 2) return null;
    const groupKeys = [...new Set(valid.map(r => String(r[groupCol])))];
    const groups = {}; groupKeys.forEach(g => groups[g] = valid.filter(r => String(r[groupCol]) === g).map(r => Number(r[respCol])));
    const desc = groupKeys.map(g => { const v = groups[g]; return { grupo: g, n: v.length, media: mean(v), dp: std(v), min: Math.min(...v), max: Math.max(...v), mediana: median(v) }; });
    const meansData = desc.map(d => ({ grupo: d.grupo, media: +d.media.toFixed(4), dp: +d.dp.toFixed(4) }));
    const idx = Object.fromEntries(groupKeys.map((g, i) => [g, i + 1]));
    const scatterByGroup = groupKeys.map((g, gi) => ({ name: g, color: PALETTE[gi % PALETTE.length], data: groups[g].map(v => ({ x: idx[g] + (Math.random() * 0.3 - 0.15), y: v })) }));
    const okAnova = groupKeys.length >= 2 && valid.length > groupKeys.length;
    const anova = okAnova ? oneWayAnova(groups) : null;
    // Brown–Forsythe (Levene com mediana) — homogeneidade de variâncias
    const zGroups = {}; groupKeys.forEach(g => { const med = median(groups[g]); zGroups[g] = groups[g].map(v => Math.abs(v - med)); });
    const levene = okAnova ? oneWayAnova(zGroups) : null;
    // resíduos vs ajustado
    const resid = []; groupKeys.forEach((g, gi) => { const m = mean(groups[g]); groups[g].forEach(v => resid.push({ fitted: +m.toFixed(4), residuo: +(v - m).toFixed(4), grupo: g, color: PALETTE[gi % PALETTE.length] })); });
    return { groupKeys, desc, meansData, scatterByGroup, anova, levene, resid };
  }, [rows, groupCol, respCol]);

  const predData = useMemo(() => {
    if (!rows.length || !predX || !predY || predX === predY) return null;
    const v = rows.filter(r => !isNaN(Number(r[predX])) && !isNaN(Number(r[predY])) && r[predX] !== "" && r[predY] !== "");
    if (v.length < 2) return null;
    const pts = v.map(r => ({ x: Number(r[predX]), y: Number(r[predY]) }));
    const med = pts.map(p => p.y), mm = mean(med);
    const ssRes = pts.reduce((a, p) => a + (p.y - p.x) ** 2, 0);
    const ssTot = pts.reduce((a, p) => a + (p.y - mm) ** 2, 0);
    const r2 = 1 - ssRes / ssTot, rmse = Math.sqrt(ssRes / pts.length);
    const lo = Math.min(...pts.flatMap(p => [p.x, p.y])), hi = Math.max(...pts.flatMap(p => [p.x, p.y]));
    return { pts, r2, rmse, line: [{ x: lo, y: lo }, { x: hi, y: hi }] };
  }, [rows, predX, predY]);

  const numericCols = headers.filter(c => rows.every(r => r[c] == null || r[c] === "" || typeof r[c] === "number"));
  const obj = OBJETIVOS.find(o => o.id === objetivo);
  const fmtDate = iso => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const anovaConc = analysis?.anova ? (analysis.anova.p < 0.05 ? `Diferença significativa entre os grupos (p ${analysis.anova.p < 0.0001 ? "< 0,0001" : "= " + analysis.anova.p.toFixed(4)}): pelo menos um tratamento difere dos demais.` : `Sem evidência de diferença entre os grupos ao nível de 5% (p = ${analysis.anova.p.toFixed(4)}).`) : null;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 to-cyan-700 flex items-center justify-center p-4" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center gap-2 mb-1"><Waves className="text-teal-600" size={24} /><h1 className="text-lg font-bold text-slate-800">Planejador de Experimentos</h1></div>
          <p className="text-sm text-slate-500 mb-5">Hydrone · identifique-se para salvar e retomar suas análises.</p>
          <label className="text-xs font-semibold text-slate-500 uppercase">Seu nome</label>
          <div className="flex gap-2 mt-1">
            <input value={loginName} onChange={e => setLoginName(e.target.value)} onKeyDown={e => e.key === "Enter" && login(loginName)} placeholder="ex.: Aline" className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-teal-400" />
            <button onClick={() => login(loginName)} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 rounded-lg text-sm">Entrar</button>
          </div>
          {users.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Ou continue como</p>
              <div className="space-y-1.5">
                {users.map(u => (
                  <div key={u.id} className="flex items-center gap-2">
                    <button onClick={() => login(u.name)} className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-left text-sm"><User size={15} className="text-teal-600" /> {u.name}</button>
                    <button onClick={() => removeUser(u.id)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-5">Seus dados ficam salvos neste navegador/dispositivo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Waves size={26} className="text-cyan-100" />
              <div><h1 className="text-lg font-bold leading-tight">Planejador de Experimentos</h1><p className="text-xs text-cyan-100">Hydrone · DOE guiado (Montgomery · Fisher · NIST)</p></div>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="flex items-center gap-1.5 bg-white/15 rounded-full pl-2 pr-3 py-1"><User size={14} /> {currentUser.name}</span>
              {deferred && <button onClick={installApp} title="Instalar app" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><DownloadCloud size={15} /></button>}
              <button onClick={() => setShowTemplates(true)} title="Templates" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><LayoutTemplate size={15} /></button>
              <button onClick={() => setShowSaveDlg(true)} title="Salvar análise" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><Save size={15} /></button>
              <button onClick={() => setShowSaves(true)} title="Minhas análises" className="bg-white/15 hover:bg-white/25 rounded-lg p-2 relative"><FolderOpen size={15} />{saves.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-400 text-teal-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{saves.length}</span>}</button>
              <button onClick={resetForm} title="Limpar formulário" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><RotateCcw size={15} /></button>
              <button onClick={switchUser} title="Trocar usuário" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><LogOut size={15} /></button>
            </div>
          </div>
          <nav className="flex gap-1 flex-wrap">
            {[[1, Target, "Mapear"], [2, ClipboardList, "Plano de execução"], [3, BarChart3, "Análise"]].map(([n, Icon, label]) => (
              <button key={n} onClick={() => setStep(n)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${step === n ? "bg-white text-teal-700 shadow" : "text-teal-50 hover:bg-teal-500/40"}`}>
                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === n ? "bg-teal-600 text-white" : "bg-teal-500/50 text-white"}`}>{n}</span>
                <Icon size={16} /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {step === 1 && (
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><ClipboardCheck size={15} className="text-teal-600" /> Identificação & rastreabilidade</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-500">Responsável</label><input value={meta.responsavel} onChange={e => setMeta({ ...meta, responsavel: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /></div>
                <div><label className="text-xs text-slate-500">Data do experimento</label><input type="date" value={meta.data} onChange={e => setMeta({ ...meta, data: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /></div>
                <div><label className="text-xs text-slate-500">Equipamento / veículo</label><input value={meta.equipamento} onChange={e => setMeta({ ...meta, equipamento: e.target.value })} placeholder="ex.: Hydrone v2, Whiteboat" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /></div>
                <div><label className="text-xs text-slate-500">Local</label><input value={meta.local} onChange={e => setMeta({ ...meta, local: e.target.value })} placeholder="ex.: tanque Nautec, Lagoa dos Patos" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /></div>
                <div className="sm:col-span-2"><label className="text-xs text-slate-500">Observações</label><input value={meta.notas} onChange={e => setMeta({ ...meta, notas: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /></div>
              </div>
              <button onClick={() => setShowTemplates(true)} className="mt-3 text-sm text-teal-600 font-medium flex items-center gap-1.5"><LayoutTemplate size={15} /> Começar a partir de um template</button>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">1 · Contexto do experimento</h2>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(CONTEXTOS).map(([k, c]) => { const Ic = c.Icon; return (
                  <button key={k} onClick={() => setContexto(k)} className={`rounded-xl border-2 p-4 text-left transition ${contexto === k ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-300"}`}>
                    <Ic size={22} className={contexto === k ? "text-teal-600" : "text-slate-500"} /><div className="font-semibold text-sm mt-2">{c.label}</div>
                  </button>
                ); })}
              </div>
              <p className="mt-2 text-sm text-slate-600 flex gap-2 items-start"><Info size={15} className="mt-0.5 text-teal-600 shrink-0" />{CONTEXTOS[contexto].nota}</p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">2 · Qual é o seu objetivo?</h2>
              <p className="text-xs text-slate-500 mb-3">Não sabe qual escolher? Toque em <span className="font-medium text-teal-600">"Ver exemplo"</span> em cada um.</p>
              <div className="space-y-2">
                {OBJETIVOS.map(o => {
                  const sel = objetivo === o.id, open = openEx === o.id;
                  return (
                    <div key={o.id} className={`rounded-xl border-2 transition ${sel ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white"}`}>
                      <div onClick={() => setObjetivo(o.id)} className="p-3 flex items-start gap-3 cursor-pointer">
                        <Target size={18} className={`mt-0.5 shrink-0 ${sel ? "text-teal-600" : "text-slate-400"}`} />
                        <div className="flex-1"><div className="font-medium text-sm">{o.label}</div><div className="text-xs text-slate-500 italic">“{o.pergunta}”</div></div>
                        <button onClick={(e) => { e.stopPropagation(); setOpenEx(open ? null : o.id); }} className="text-xs text-teal-600 font-medium flex items-center gap-1 shrink-0 hover:underline"><Lightbulb size={13} /> Ver exemplo <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} /></button>
                      </div>
                      {open && (
                        <div className="px-4 pb-4 pt-1 ml-9 space-y-2 text-sm">
                          <p className="text-slate-700"><span className="font-semibold text-slate-800">O que é:</span> {o.oque}</p>
                          <p className="bg-amber-50 text-amber-900 rounded-lg px-3 py-2 flex gap-2"><Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-500" /><span><span className="font-semibold">Exemplo:</span> {o.exemplo}</span></p>
                          <p className="text-slate-600"><span className="font-semibold">Como interpretar:</span> {o.interpreta}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1"><BookOpen size={12} /> {o.ref}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white p-5">
              <div className="flex items-center gap-2 mb-2"><FlaskConical size={18} /><span className="text-xs uppercase tracking-wide font-semibold text-cyan-100">Delineamento recomendado</span></div>
              <h3 className="text-lg font-bold">{obj.design}</h3>
              <p className="text-sm text-cyan-50 mt-1">{obj.oque}</p>
              <div className="mt-3 flex flex-wrap gap-2">{obj.princ.map((p, i) => <span key={i} className="text-xs bg-white/20 rounded-full px-3 py-1">{p}</span>)}</div>
              <div className="mt-3 bg-white/10 rounded-lg px-3 py-2 text-sm text-cyan-50"><span className="font-semibold text-white">Como ler os resultados:</span> {obj.interpreta}</div>
              <p className="mt-2 text-xs text-cyan-100/80 flex items-center gap-1"><BookOpen size={12} /> {obj.ref}</p>
            </section>

            <button onClick={() => setStep(2)} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition">Montar plano de execução →</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button onClick={() => setShowGuide(!showGuide)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><HelpCircle size={16} className="text-teal-600" /> Não sei o que preencher (guia rápido com exemplo)</span>
                <ChevronDown size={18} className={`text-slate-400 transition ${showGuide ? "rotate-180" : ""}`} />
              </button>
              {showGuide && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-2">
                    {CONCEITOS.map(c => (
                      <div key={c.termo} className="rounded-lg border border-slate-100 p-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${COR[c.cor]}`}>{c.termo}</span>
                        <p className="text-sm text-slate-700 mt-1.5">{c.def}</p>
                        <p className="text-xs text-slate-500 mt-1"><span className="font-medium">Ex.:</span> {c.ex}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-teal-50 rounded-lg px-3 py-2.5 text-sm text-teal-900 flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-teal-600" /><span><span className="font-semibold">Exemplo montado:</span> comparar 3 hélices → <b>Fator</b> "Hélice" com <b>níveis</b> A, B, C · <b>Resposta</b> "Empuxo_N" · <b>2 réplicas</b> → 6 corridas.</span></div>
                </div>
              )}
            </div>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Fatores e níveis</h2>
              <p className="text-xs text-slate-500 mb-2">O que você controla (fator) e os valores que vai testar (níveis, separados por vírgula).</p>
              <div className="space-y-2">
                {factors.map((f) => (
                  <div key={f.id} className="flex gap-2 items-center bg-white rounded-lg border border-slate-200 p-2">
                    <input value={f.name} onChange={e => setFactors(factors.map(x => x.id === f.id ? { ...x, name: e.target.value } : x))} placeholder="Nome do fator" className="w-1/3 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" />
                    <input value={f.levelsRaw} onChange={e => setFactors(factors.map(x => x.id === f.id ? { ...x, levelsRaw: e.target.value } : x))} placeholder="níveis separados por vírgula" className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" />
                    <button onClick={() => setFactors(factors.filter(x => x.id !== f.id))} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setFactors([...factors, { id: Date.now(), name: "", levelsRaw: "" }])} className="mt-2 text-sm text-teal-600 font-medium flex items-center gap-1"><Plus size={15} /> Adicionar fator</button>
            </section>

            <section className="grid sm:grid-cols-2 gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Respostas</h2>
                <p className="text-xs text-slate-500 mb-2">O que você mede em cada corrida.</p>
                <div className="space-y-2">
                  {responses.map((r, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={r} onChange={e => setResponses(responses.map((x, j) => j === i ? e.target.value : x))} placeholder="ex.: Empuxo_N" className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white outline-none focus:border-teal-400" />
                      <button onClick={() => setResponses(responses.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  <button onClick={() => setResponses([...responses, ""])} className="text-sm text-teal-600 font-medium flex items-center gap-1"><Plus size={15} /> Adicionar resposta</button>
                </div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Réplicas</h2>
                <p className="text-xs text-slate-500 mb-2">Repetições de cada combinação (dá confiança estatística).</p>
                <input type="number" min={1} max={20} value={replicates} onChange={e => setReplicates(Math.max(1, Math.min(20, +e.target.value || 1)))} className="w-24 px-3 py-2 text-sm border border-slate-200 rounded bg-white outline-none focus:border-teal-400" />
                <p className="text-xs text-slate-500 mt-2">Total de corridas previstas: <span className="font-bold text-teal-700">{nRuns}</span></p>
                {replicates < 2 && <p className="mt-2 text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2 flex gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Com 1 réplica não há como estimar o erro experimental. Use ≥ 2 sempre que possível (princípio da replicação).</p>}
              </div>
            </section>

            <button onClick={gerarMatriz} disabled={!parsedFactors.length} className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition">Gerar matriz experimental (randomizada)</button>

            {matrix.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Matriz · {matrix.length} corridas</h2>
                  <button onClick={() => download("matriz_experimental.csv", toCSV(matrix, matrixCols))} className="text-sm bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Download size={15} /> Exportar CSV</button>
                </div>
                <p className="text-xs text-slate-500 mb-2 flex gap-1.5 items-start"><Info size={13} className="mt-0.5 shrink-0 text-teal-600" />A ordem das corridas é embaralhada de propósito (aleatorização): isso evita que efeitos de tempo — aquecimento, maré, descarga da bateria — se confundam com os fatores.</p>
                <div className="overflow-auto rounded-lg border border-slate-200 max-h-80">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 sticky top-0"><tr>{matrixCols.map(c => <th key={c} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{c}</th>)}</tr></thead>
                    <tbody>{matrix.map((r, i) => <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>{matrixCols.map(c => <td key={c} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{r[c] === "" ? <span className="text-slate-300">—</span> : r[c]}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-2">Preencha a coluna de resposta após coletar os dados e carregue o arquivo na etapa de Análise.</p>
              </section>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Carregar dados</h2>
              <div className="flex flex-wrap gap-3 items-center">
                <label className="cursor-pointer bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"><Upload size={15} /> Carregar CSV<input type="file" accept=".csv" onChange={handleFile} className="hidden" /></label>
                <button onClick={() => ingest(EXEMPLO)} className="text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium">Carregar exemplo</button>
              </div>
              <details className="mt-3">
                <summary className="text-sm text-teal-600 cursor-pointer">ou colar dados (CSV)</summary>
                <textarea onChange={e => e.target.value.trim() && handlePaste(e.target.value)} placeholder={"Config,Empuxo_N\nHélice A,12.1\nHélice B,14.2"} className="mt-2 w-full h-28 p-2 text-sm font-mono border border-slate-200 rounded outline-none focus:border-teal-400" />
              </details>
              {loadErr && <p className="text-sm text-rose-600 mt-2">{loadErr}</p>}
            </section>

            {rows.length > 0 && (
              <>
                <section className="grid sm:grid-cols-2 gap-4 bg-white rounded-xl border border-slate-200 p-4">
                  <div><label className="text-xs font-semibold text-slate-500 uppercase">Fator (grupo)</label><select value={groupCol} onChange={e => setGroupCol(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white outline-none focus:border-teal-400">{headers.map(h => <option key={h}>{h}</option>)}</select></div>
                  <div><label className="text-xs font-semibold text-slate-500 uppercase">Resposta (numérica)</label><select value={respCol} onChange={e => setRespCol(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white outline-none focus:border-teal-400">{(numericCols.length ? numericCols : headers).map(h => <option key={h}>{h}</option>)}</select></div>
                </section>

                {analysis && (
                  <>
                    <section>
                      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Sigma size={15} /> Estatística descritiva</h2>
                      <div className="overflow-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100"><tr>{["Grupo", "n", "Média", "Desvio-padrão", "Mín", "Máx", "Mediana"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>)}</tr></thead>
                          <tbody>{analysis.desc.map((d, i) => <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}><td className="px-3 py-1.5 font-medium">{d.grupo}</td><td className="px-3 py-1.5">{d.n}</td><td className="px-3 py-1.5">{d.media.toFixed(3)}</td><td className="px-3 py-1.5">{d.dp.toFixed(3)}</td><td className="px-3 py-1.5">{d.min.toFixed(3)}</td><td className="px-3 py-1.5">{d.max.toFixed(3)}</td><td className="px-3 py-1.5">{d.mediana.toFixed(3)}</td></tr>)}</tbody>
                        </table>
                      </div>
                    </section>

                    {analysis.anova && (
                      <section>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">ANOVA de um fator</h2>
                        <div className="overflow-auto rounded-lg border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100"><tr>{["Fonte", "SQ", "gl", "QM", "F", "valor-p"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>)}</tr></thead>
                            <tbody>
                              <tr className="bg-white"><td className="px-3 py-1.5 font-medium">Entre grupos</td><td className="px-3 py-1.5">{analysis.anova.ssb.toFixed(3)}</td><td className="px-3 py-1.5">{analysis.anova.dfb}</td><td className="px-3 py-1.5">{analysis.anova.msb.toFixed(3)}</td><td className="px-3 py-1.5 font-bold">{analysis.anova.F.toFixed(3)}</td><td className={`px-3 py-1.5 font-bold ${analysis.anova.p < 0.05 ? "text-teal-700" : "text-slate-500"}`}>{analysis.anova.p < 0.0001 ? "<0.0001" : analysis.anova.p.toFixed(4)}</td></tr>
                              <tr className="bg-slate-50"><td className="px-3 py-1.5 font-medium">Dentro (erro)</td><td className="px-3 py-1.5">{analysis.anova.ssw.toFixed(3)}</td><td className="px-3 py-1.5">{analysis.anova.dfw}</td><td className="px-3 py-1.5">{analysis.anova.msw.toFixed(3)}</td><td></td><td></td></tr>
                              <tr className="bg-white"><td className="px-3 py-1.5 font-medium">Total</td><td className="px-3 py-1.5">{analysis.anova.sst.toFixed(3)}</td><td className="px-3 py-1.5">{analysis.anova.dfb + analysis.anova.dfw}</td><td></td><td></td><td></td></tr>
                            </tbody>
                          </table>
                        </div>
                        <p className={`mt-2 text-sm rounded-lg px-3 py-2 ${analysis.anova.p < 0.05 ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>{anovaConc}</p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><BookOpen size={12} /> Interpretação conforme Montgomery (2017), cap. 3 · NIST/SEMATECH §5.4.5.</p>
                      </section>
                    )}

                    {analysis.levene && (
                      <section>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ClipboardCheck size={15} className="text-teal-600" /> Verificação de pressupostos</h2>
                        <div className={`rounded-lg px-3 py-2.5 text-sm mb-3 ${analysis.levene.p < 0.05 ? "bg-rose-50 text-rose-800" : "bg-teal-50 text-teal-800"}`}>
                          <p className="font-semibold flex items-center gap-1.5">{analysis.levene.p < 0.05 ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />} Homogeneidade de variâncias (Brown–Forsythe): F = {analysis.levene.F.toFixed(3)}, p = {analysis.levene.p < 0.0001 ? "<0,0001" : analysis.levene.p.toFixed(4)}</p>
                          <p className="mt-1">{analysis.levene.p < 0.05 ? "As variâncias diferem entre os grupos (p < 0,05) — um pressuposto da ANOVA clássica é violado. Considere transformar a resposta (ex.: log) ou usar ANOVA de Welch. Interprete o valor-p da ANOVA com cautela." : "Variâncias compatíveis entre os grupos (p ≥ 0,05): o pressuposto de homogeneidade da ANOVA é razoável."}</p>
                          <p className="text-xs opacity-70 mt-1">Teste de Brown–Forsythe (Levene com mediana) · NIST/SEMATECH §5.2.4.</p>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-600 mb-2">Resíduos × valor ajustado</h3>
                        <div className="bg-white rounded-lg border border-slate-200 p-2">
                          <ResponsiveContainer width="100%" height={240}>
                            <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="fitted" name="ajustado" tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="residuo" name="resíduo" tick={{ fontSize: 11 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={v => v.toFixed(3)} /><ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                              <Scatter data={analysis.resid} fill="#0d9488" />
                            </ScatterChart>
                          </ResponsiveContainer>
                          <p className="text-xs text-slate-500 px-2 pb-1">Resíduos devem espalhar-se aleatoriamente em torno de zero. Padrão em funil = variância não constante; curvatura = falta um termo no modelo.</p>
                        </div>
                      </section>
                    )}

                    <section className="grid lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-600 mb-2">Médias por tratamento (± DP)</h3>
                        <div className="bg-white rounded-lg border border-slate-200 p-2">
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={analysis.meansData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="grupo" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
                              <Bar dataKey="media" fill="#0d9488" radius={[4, 4, 0, 0]}><ErrorBar dataKey="dp" width={6} strokeWidth={1.5} stroke="#475569" /></Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-600 mb-2">Dispersão dos pontos por grupo</h3>
                        <div className="bg-white rounded-lg border border-slate-200 p-2">
                          <ResponsiveContainer width="100%" height={260}>
                            <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="x" domain={[0.5, analysis.groupKeys.length + 0.5]} ticks={analysis.groupKeys.map((_, i) => i + 1)} tickFormatter={t => analysis.groupKeys[t - 1]} tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => n === "y" ? v.toFixed(3) : v} />
                              {analysis.scatterByGroup.map(g => <Scatter key={g.name} name={g.name} data={g.data} fill={g.color} />)}<Legend wrapperStyle={{ fontSize: 11 }} />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </section>

                    <button onClick={() => download("estatistica_descritiva.csv", toCSV(analysis.desc, ["grupo", "n", "media", "dp", "min", "max", "mediana"]))} className="text-sm bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5"><Download size={15} /> Exportar resultados (CSV)</button>
                  </>
                )}

                <section className="border-t border-slate-200 pt-5">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Predito × Medido (opcional)</h2>
                  <p className="text-xs text-slate-500 mb-3">Para validar um modelo: selecione a coluna prevista (modelo) e a medida (real).</p>
                  <div className="grid sm:grid-cols-2 gap-4 mb-3">
                    <div><label className="text-xs font-semibold text-slate-500 uppercase">Predito (X)</label><select value={predX} onChange={e => setPredX(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white"><option value="">—</option>{numericCols.map(h => <option key={h}>{h}</option>)}</select></div>
                    <div><label className="text-xs font-semibold text-slate-500 uppercase">Medido (Y)</label><select value={predY} onChange={e => setPredY(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white"><option value="">—</option>{numericCols.map(h => <option key={h}>{h}</option>)}</select></div>
                  </div>
                  {predData && (
                    <div className="bg-white rounded-lg border border-slate-200 p-2">
                      <div className="flex gap-4 text-sm px-2 pt-1 pb-2"><span>R² = <b className="text-teal-700">{predData.r2.toFixed(4)}</b></span><span>RMSE = <b className="text-teal-700">{predData.rmse.toFixed(4)}</b></span></div>
                      <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="x" name={predX} tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="y" name={predY} tick={{ fontSize: 11 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={v => v.toFixed(3)} />
                          <Scatter data={predData.pts} fill="#2563eb" /><Scatter data={predData.line} line={{ stroke: "#94a3b8", strokeDasharray: "5 5" }} shape={() => null} />
                        </ScatterChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-slate-500 px-2 pb-1">Linha tracejada = identidade (predito = medido). Quanto mais perto os pontos dela, melhor o modelo.</p>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => setShowReport(true)} className="text-sm bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5"><FileText size={15} /> Gerar relatório (PDF)</button>
          <button onClick={exportJSON} className="text-sm bg-white border border-slate-200 hover:border-teal-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5"><FileJson size={15} className="text-teal-600" /> Exportar análise (.json)</button>
          <label className="text-sm bg-white border border-slate-200 hover:border-teal-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"><Upload size={15} className="text-teal-600" /> Importar análise<input type="file" accept=".json" onChange={importJSON} className="hidden" /></label>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button onClick={() => setShowRefs(!showRefs)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-600"><BookOpen size={16} className="text-teal-600" /> Referências metodológicas</span>
            <ChevronDown size={18} className={`text-slate-400 transition ${showRefs ? "rotate-180" : ""}`} />
          </button>
          {showRefs && <ul className="px-4 pb-4 space-y-2 text-sm text-slate-600">{REFERENCIAS.map((r, i) => <li key={i} className="flex gap-2"><span className="text-teal-600">•</span>{r.u ? <a href={r.u} target="_blank" rel="noreferrer" className="hover:text-teal-700 hover:underline">{r.t}</a> : <span>{r.t}</span>}</li>)}</ul>}
        </div>
      </main>

      {/* MODAL: templates */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowTemplates(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800 flex items-center gap-2"><LayoutTemplate size={18} className="text-teal-600" /> Templates de experimento</h3><button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
            <p className="text-xs text-slate-500 mb-3">Aplica um modelo pré-preenchido (mantém seus metadados). Você pode ajustar tudo depois.</p>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)} className="w-full text-left border border-slate-200 hover:border-teal-400 hover:bg-teal-50 rounded-lg p-3">
                  <div className="text-sm font-semibold text-slate-800">{t.nome}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: salvar */}
      {showSaveDlg && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowSaveDlg(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-1">Salvar análise</h3>
            <p className="text-xs text-slate-500 mb-3">Guarda o estado atual (metadados, objetivo, plano e dados) para retomar depois.</p>
            <input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && saveAnalysis(saveTitle)} placeholder="Nome da análise (ex.: Empuxo hélices v1)" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-teal-400" autoFocus />
            <div className="flex gap-2 mt-4"><button onClick={() => setShowSaveDlg(false)} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-600">Cancelar</button><button onClick={() => saveAnalysis(saveTitle)} className="flex-1 text-sm py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold">Salvar</button></div>
          </div>
        </div>
      )}

      {/* MODAL: minhas análises */}
      {showSaves && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowSaves(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">Minhas análises</h3><button onClick={() => setShowSaves(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
            {saves.length === 0 ? <p className="text-sm text-slate-500 py-6 text-center">Nenhuma análise salva ainda. Use o botão <Save size={13} className="inline" /> no topo.</p> : (
              <ul className="space-y-2 overflow-auto">
                {saves.map(s => (
                  <li key={s.id} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2.5">
                    <button onClick={() => loadAnalysis(s)} className="flex-1 text-left"><div className="text-sm font-medium text-slate-800">{s.title}</div><div className="text-xs text-slate-400">{fmtDate(s.savedAt)}</div></button>
                    <button onClick={() => deleteAnalysis(s.id)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* MODAL: relatório */}
      {showReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[88vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="print-area p-6 text-slate-800">
              <div className="flex items-center gap-2 border-b-2 border-teal-600 pb-2 mb-4"><Waves size={20} className="text-teal-600" /><div><h2 className="text-lg font-bold">Relatório de Experimento</h2><p className="text-xs text-slate-500">Planejador de Experimentos · Hydrone</p></div></div>

              <table className="w-full text-sm mb-4"><tbody>
                <tr><td className="py-1 pr-3 text-slate-500 w-36">Responsável</td><td className="py-1 font-medium">{meta.responsavel || currentUser.name}</td></tr>
                <tr><td className="py-1 pr-3 text-slate-500">Data</td><td className="py-1 font-medium">{meta.data}</td></tr>
                {meta.equipamento && <tr><td className="py-1 pr-3 text-slate-500">Equipamento</td><td className="py-1 font-medium">{meta.equipamento}</td></tr>}
                {meta.local && <tr><td className="py-1 pr-3 text-slate-500">Local</td><td className="py-1 font-medium">{meta.local}</td></tr>}
                <tr><td className="py-1 pr-3 text-slate-500">Contexto</td><td className="py-1 font-medium">{CONTEXTOS[contexto].label}</td></tr>
                <tr><td className="py-1 pr-3 text-slate-500">Objetivo</td><td className="py-1 font-medium">{obj.label}</td></tr>
              </tbody></table>

              <h3 className="font-bold text-teal-700 text-sm uppercase tracking-wide mb-1 mt-4">Planejamento</h3>
              <p className="text-sm mb-1"><b>Delineamento:</b> {obj.design}</p>
              <p className="text-sm mb-1"><b>Fatores:</b> {parsedFactors.length ? parsedFactors.map(f => `${f.name} (${f.levels.join(", ")})`).join(" · ") : "—"}</p>
              <p className="text-sm mb-1"><b>Respostas:</b> {cleanResp.join(", ") || "—"}</p>
              <p className="text-sm"><b>Réplicas:</b> {replicates} · <b>Corridas previstas:</b> {nRuns || "—"}</p>

              {analysis && (
                <>
                  <h3 className="font-bold text-teal-700 text-sm uppercase tracking-wide mb-1 mt-4">Resultados</h3>
                  <table className="w-full text-sm border-collapse mb-3"><thead><tr className="border-b border-slate-300">{["Grupo", "n", "Média", "DP", "Mediana"].map(h => <th key={h} className="text-left py-1 pr-3 font-semibold">{h}</th>)}</tr></thead>
                    <tbody>{analysis.desc.map((d, i) => <tr key={i} className="border-b border-slate-100"><td className="py-1 pr-3">{d.grupo}</td><td className="py-1 pr-3">{d.n}</td><td className="py-1 pr-3">{d.media.toFixed(3)}</td><td className="py-1 pr-3">{d.dp.toFixed(3)}</td><td className="py-1 pr-3">{d.mediana.toFixed(3)}</td></tr>)}</tbody>
                  </table>
                  {analysis.anova && <p className="text-sm mb-1"><b>ANOVA:</b> F({analysis.anova.dfb}, {analysis.anova.dfw}) = {analysis.anova.F.toFixed(3)}, p = {analysis.anova.p < 0.0001 ? "<0,0001" : analysis.anova.p.toFixed(4)}. {anovaConc}</p>}
                  {analysis.levene && <p className="text-sm"><b>Pressuposto (Brown–Forsythe):</b> F = {analysis.levene.F.toFixed(3)}, p = {analysis.levene.p < 0.0001 ? "<0,0001" : analysis.levene.p.toFixed(4)} — {analysis.levene.p < 0.05 ? "variâncias heterogêneas; interpretar a ANOVA com cautela." : "variâncias homogêneas; pressuposto razoável."}</p>}
                </>
              )}

              {predData && <p className="text-sm mt-2"><b>Validação predito × medido:</b> R² = {predData.r2.toFixed(4)} · RMSE = {predData.rmse.toFixed(4)}.</p>}
              {meta.notas && <><h3 className="font-bold text-teal-700 text-sm uppercase tracking-wide mb-1 mt-4">Observações</h3><p className="text-sm">{meta.notas}</p></>}

              <h3 className="font-bold text-teal-700 text-sm uppercase tracking-wide mb-1 mt-4">Referências</h3>
              <ul className="text-xs text-slate-600 space-y-0.5">{REFERENCIAS.map((r, i) => <li key={i}>• {r.t}</li>)}</ul>
              <p className="text-xs text-slate-400 mt-4 pt-2 border-t border-slate-200">Gerado em {new Date().toLocaleString("pt-BR")} · Planejador de Experimentos Hydrone</p>
            </div>
            <div className="no-print sticky bottom-0 bg-white border-t border-slate-200 p-3 flex gap-2 justify-end">
              <button onClick={() => setShowReport(false)} className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600">Fechar</button>
              <button onClick={printReport} className="text-sm px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5"><FileText size={15} /> Imprimir / Salvar PDF</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 no-print">{toast}</div>}
    </div>
  );
}