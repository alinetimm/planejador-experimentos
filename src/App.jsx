import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ErrorBar, ResponsiveContainer, ScatterChart, Scatter, Legend, ReferenceLine } from "recharts";
import { Waves, Target, ClipboardList, BarChart3, Download, Upload, Plus, Trash2, FlaskConical, Sigma, Info, Lightbulb, BookOpen, ChevronDown, HelpCircle, CheckCircle2, User, LogOut, Save, FolderOpen, RotateCcw, AlertTriangle, X, FileJson, LayoutTemplate, FileText, DownloadCloud, ClipboardCheck, Monitor, FunctionSquare, Table2, Pencil, ArrowLeft } from "lucide-react";

const LS = (() => { const mem = {}; return { get: k => { try { return window.localStorage.getItem(k); } catch { return k in mem ? mem[k] : null; } }, set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { mem[k] = v; } }, del: k => { try { window.localStorage.removeItem(k); } catch { delete mem[k]; } } }; })();
const readJSON = (k, fb) => { try { const v = LS.get(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const writeJSON = (k, v) => LS.set(k, JSON.stringify(v));
const USERS_KEY = "hep:users";

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const variance = a => { const m = mean(a); return a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1); };
const std = a => a.length > 1 ? Math.sqrt(variance(a)) : 0;
const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
function gammaln(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let ser = 1.000000000190015; for (let j = 0; j < 6; j++) { y++; ser += c[j] / y; } return -tmp + Math.log(2.5066282746310005 * ser / x); }
function betacf(a, b, x) { const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d; for (let m = 1; m <= MAXIT; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break; } return h; }
function betai(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
const fPValue = (F, d1, d2) => F <= 0 ? 1 : betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F));
function gammp(a, x) { if (x <= 0 || a <= 0) return 0; if (x < a + 1) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 300; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-13) break; } return sum * Math.exp(-x + a * Math.log(x) - gammaln(a)); } const FPMIN = 1e-300; let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d; for (let i = 1; i <= 300; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN; c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-13) break; } return 1 - Math.exp(-x + a * Math.log(x) - gammaln(a)) * h; }
const chiSqP = (x, df) => x <= 0 || df <= 0 ? 1 : 1 - gammp(df / 2, x / 2);
function oneWayAnova(groups) { const keys = Object.keys(groups); const all = keys.flatMap(k => groups[k]); const N = all.length, k = keys.length, grand = mean(all); let ssb = 0, ssw = 0; keys.forEach(key => { const g = groups[key], gm = mean(g); ssb += g.length * (gm - grand) ** 2; g.forEach(v => ssw += (v - gm) ** 2); }); const dfb = k - 1, dfw = N - k, msb = ssb / dfb, msw = ssw / dfw, F = msb / msw; return { ssb, ssw, sst: ssb + ssw, dfb, dfw, msb, msw, F, p: fPValue(F, dfb, dfw), k, N }; }
function kruskalWallis(groups) { const keys = Object.keys(groups); const all = []; keys.forEach(k => groups[k].forEach(v => all.push({ v, k }))); const N = all.length; all.sort((a, b) => a.v - b.v); let i = 0; while (i < N) { let j = i; while (j + 1 < N && all[j + 1].v === all[i].v) j++; const rank = (i + j + 2) / 2; for (let m = i; m <= j; m++) all[m].rank = rank; i = j + 1; } const Rsum = {}, ns = {}; keys.forEach(k => { Rsum[k] = 0; ns[k] = 0; }); all.forEach(o => { Rsum[o.k] += o.rank; ns[o.k]++; }); let H = 0; keys.forEach(k => H += Rsum[k] ** 2 / ns[k]); H = 12 / (N * (N + 1)) * H - 3 * (N + 1); const df = keys.length - 1; return { H, df, p: chiSqP(H, df), N, k: keys.length }; }
function chiSquareTest(groups) { const gKeys = Object.keys(groups); const cats = [...new Set(gKeys.flatMap(g => groups[g]))]; const obs = {}, rowTot = {}, colTot = {}; let N = 0; gKeys.forEach(g => { obs[g] = {}; rowTot[g] = 0; cats.forEach(c => obs[g][c] = 0); groups[g].forEach(v => { obs[g][v]++; rowTot[g]++; N++; }); }); cats.forEach(c => colTot[c] = gKeys.reduce((s, g) => s + obs[g][c], 0)); let X2 = 0; gKeys.forEach(g => cats.forEach(c => { const E = rowTot[g] * colTot[c] / N; if (E > 0) X2 += (obs[g][c] - E) ** 2 / E; })); const df = (gKeys.length - 1) * (cats.length - 1); return { X2, df, p: df > 0 ? chiSqP(X2, df) : 1, obs, cats, gKeys, rowTot, colTot, N }; }
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
function toCSV(rows, cols) { const esc = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n"); }
function download(name, content, type) { const blob = new Blob([content], { type: type || "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
const coerce = v => { const t = String(v).trim(); return t !== "" && !isNaN(Number(t)) ? Number(t) : v; };

const MODOS = {
  comparar: { label: "Comparar / otimizar", Icon: Target, family: "analise", desc: "Você controla fatores e quer ver qual configuração é melhor (ou achar o melhor ajuste).", ex: "qual de três hélices gera mais empuxo?" },
  validar: { label: "Validar modelo", Icon: FunctionSquare, family: "analise", desc: "Comparar a previsão de um modelo com o que foi medido na realidade.", ex: "o modelo 6-DOF acerta a trajetória medida?" },
  monitorar: { label: "Monitorar / observar", Icon: Monitor, family: "analise", desc: "Você não controla nada: só registra e descreve o comportamento (ex.: logs).", ex: "como a corrente varia por fase de voo nos logs?" },
  inspecao: { label: "Checklist / Protocolo", Icon: ClipboardCheck, family: "checklist", desc: "Rodar checklists de pré-ensaio, segurança e pós-ensaio — verificar conformidade e registrar evidências. Sem estatística.", ex: "pré-voo mecânico + eletrônico antes de armar?" },
};
const FAMILIAS = {
  analise: { label: "Analisar dados de um ensaio", desc: "Você tem (ou vai coletar) medições e quer extrair estatística: comparar, validar modelo ou descrever um log.", Icon: BarChart3 },
  checklist: { label: "Rodar um checklist / protocolo", desc: "Verificação de conformidade antes/depois do ensaio — pré-voo, segurança, pós-ensaio. Marca-se item a item; não há análise estatística.", Icon: ClipboardCheck },
};
const STEP2 = { comparar: "Plano", validar: "Variáveis", monitorar: "O que observar", inspecao: "Montar checklist" };
const STEP3 = { comparar: "Dados & análise", validar: "Dados & análise", monitorar: "Dados & análise", inspecao: "Execução" };

const OBJETIVOS = [
  { id: "comparar", label: "Comparar configurações / tratamentos", pergunta: "Qual é melhor? Faz diferença?", design: "Delineamento completamente aleatorizado · ANOVA de um fator", interpreta: "Se a variável for quantitativa, usa-se a ANOVA: valor-p < 0,05 indica diferença real. Para dados categóricos/ordinais o app aplica o teste adequado.", ref: "Montgomery (2017), cap. 3" },
  { id: "triar", label: "Triar fatores (quais importam?)", pergunta: "Quais variáveis realmente afetam o resultado?", design: "Fatorial fracionado 2^(k−p) · Plackett–Burman", interpreta: "Olhe a magnitude dos efeitos principais: os maiores são os que importam.", ref: "Montgomery (2017), cap. 8" },
  { id: "caracterizar", label: "Caracterizar efeitos e interações", pergunta: "Como as variáveis se combinam?", design: "Fatorial completo 2^k", interpreta: "ANOVA com efeitos principais e de interação.", ref: "Montgomery (2017), cap. 5–6" },
  { id: "otimizar", label: "Otimizar uma resposta", pergunta: "Qual o melhor ajuste possível?", design: "Superfície de Resposta (RSM) · CCD / Box–Behnken", interpreta: "Ajusta-se um modelo quadrático para localizar o ponto ótimo.", ref: "Montgomery (2017), cap. 11" },
];
const CONTEXTOS = {
  campo: { label: "Campo", Icon: Waves, nota: "Ensaios caros e arriscados → priorize delineamentos econômicos e replicação mínima viável." },
  simulado: { label: "Simulado", Icon: Monitor, nota: "Custo por ensaio baixo → fatorial completo e mais réplicas são viáveis." },
  matematico: { label: "Matemático", Icon: FunctionSquare, nota: "Em geral determinístico → foque em varredura de parâmetros e validação de hipóteses." },
};
const TIPOS = {
  quantitativa: { label: "Quantitativa", def: "Número que mede uma quantidade, com unidade. Dá para tirar média.", ex: "empuxo 12,3 N · tempo 4,5 s", analise: "média, desvio-padrão e ANOVA" },
  ordinal: { label: "Ordinal", def: "Categorias COM ordem, mas sem distância igual. Não faz sentido tirar média.", ex: "1–5 · baixo / médio / alto", analise: "mediana e Kruskal–Wallis" },
  categorica: { label: "Categórica", def: "Rótulos SEM ordem. Você conta quantas vezes cada um aparece.", ex: "passou / falhou · A / B / C", analise: "contagens, proporções e qui-quadrado" },
  evidencia: { label: "Evidência / nota", def: "Registro descritivo: observação, link de foto/vídeo ou trecho de log.", ex: "“vibração aos 10 s” · arquivo .bin", analise: "registro, sem estatística" },
};
const TERMOS = {
  anova: { def: "Compara as médias de vários grupos de uma vez.", ex: "as três hélices têm empuxo médio diferente?" },
  p: { def: "Probabilidade de ver essa diferença por puro acaso. Abaixo de 0,05 = provavelmente real.", ex: "p = 0,01 → diferença real" },
  kw: { def: "Versão da ANOVA para dados ordinais; compara as ordens (postos), não as médias.", ex: "comparar notas 1–5" },
  qui: { def: "Testa se a categoria do resultado depende do grupo.", ex: "a taxa de falha muda entre A/B/C?" },
  r2: { def: "Quão bem o modelo explica os dados (0 a 1; perto de 1 é melhor).", ex: "R² = 0,98 → ótimo" },
  rmse: { def: "Erro típico entre predito e medido, na mesma unidade do dado.", ex: "RMSE = 0,2 m" },
  residuo: { def: "Diferença entre o valor medido e o previsto pelo modelo.", ex: "medido − média do grupo" },
};
const REFERENCIAS = [
  { t: "Montgomery, D. C. (2017). Design and Analysis of Experiments (9ª ed.). Wiley.", u: "https://www.wiley.com/en-us/Design+and+Analysis+of+Experiments,+10th+Edition-p-9781119492443" },
  { t: "Fisher, R. A. (1935). The Design of Experiments. Oliver & Boyd.", u: null },
  { t: "Stevens, S. S. (1946). On the Theory of Scales of Measurement. Science.", u: null },
  { t: "NIST/SEMATECH (2012). e-Handbook of Statistical Methods (Handbook 151).", u: "https://www.itl.nist.gov/div898/handbook/" },
  { t: "Y. Jin, Y. Bi, C. Lyu, Y. Bai, Z. Zeng e L. Lian. Nezha-IV: A hybrid aerial underwater vehicle in real ocean environments.", u: "https://doi.org/10.1109/LRA.2025.3568568" },
  { t: "M. Aili, X. Song, Y. Wang, Z. Zeng e L. Lian. Nezha-Morphing: Design and experiments of a seabird-inspired hybrid aerial underwater vehicle.", u: "https://doi.org/10.1109/IROS60139.2025.11246152" },
];
const CATALOGO = [
  { name: "Corrente_A", tipo: "quantitativa", descricao: "Corrente elétrica drenada pelos motores, em Ampères (A). Ex.: 8,2 A." },
  { name: "Tensao_V", tipo: "quantitativa", descricao: "Tensão da bateria, em Volts (V). Ex.: 22,2 V." },
  { name: "Potencia_W", tipo: "quantitativa", descricao: "Potência consumida (tensão × corrente), em Watts (W). Ex.: 182 W." },
  { name: "Empuxo_N", tipo: "quantitativa", descricao: "Força de empuxo do propulsor, em Newtons (N). Ex.: 12,3 N." },
  { name: "Tempo_pouso_s", tipo: "quantitativa", descricao: "Tempo até concluir o pouso, em segundos (s). Ex.: 4,5 s." },
  { name: "Profundidade_m", tipo: "quantitativa", descricao: "Profundidade de submersão, em metros (m). Ex.: 1,8 m." },
  { name: "Erro_RMS_m", tipo: "quantitativa", descricao: "Erro quadrático médio de rastreio, em metros (m). Menor é melhor." },
  { name: "Vibracao_g", tipo: "quantitativa", descricao: "Amplitude de vibração pela IMU, em g. Ex.: 0,3 g." },
  { name: "Estabilidade", tipo: "ordinal", descricao: "Estabilidade percebida, em escala ordenada. Ex.: baixa / média / alta." },
  { name: "Status", tipo: "categorica", descricao: "Resultado do ensaio, sem ordem. Ex.: passou / falhou." },
  { name: "Tipo_falha", tipo: "categorica", descricao: "Categoria da falha. Ex.: vazamento / superaquecimento / nenhuma." },
  { name: "Evidencia", tipo: "evidencia", descricao: "Nota, link de foto/vídeo ou arquivo de log (.bin/.tlog)." },
];
// Checklists prontos — extraídos do Guia de Experimentos HAUV (Módulos M1 e M7 + Segurança).
// captura "status" = verificação (Passou/Falhou/N/A); "tarefa" = ação do operador (Feito/Pendente/N/A);
// "valor" = registro numérico/texto (unidade opcional). Itens com `unidade` ganham campo de valor adicional.
const CHECKLISTS_LIB = [
  {
    id: "seguranca", titulo: "Segurança (ler e confirmar antes de armar)", fonte: "Guia HAUV · M1",
    itens: [
      { nome: "Distância mínima de 5 m entre operadores e o veículo durante o armamento", captura: "tarefa" },
      { nome: "Não há pessoas nem tráfego marítimo na área de operação", captura: "status" },
      { nome: "Estanqueidade dos compartimentos verificada antes da imersão", captura: "status" },
      { nome: "Operador dedicado de recuperação aquática presente (ensaios subaquáticos/transição)", captura: "tarefa" },
      { nome: "Bateria carregada ≥ 90% no início do ensaio", captura: "status", unidade: "%" },
      { nome: "Todos os materiais necessários disponíveis e preparados", captura: "tarefa" },
    ],
  },
  {
    id: "mec", titulo: "Pré-ensaio — Estrutura mecânica", fonte: "Guia HAUV · M1",
    itens: [
      { nome: "Parafusos e juntas dos braços apertados" },
      { nome: "Hélices aéreas sem danos / folga" },
      { nome: "Hélices subaquáticas sem danos / folga" },
      { nome: "Mecanismo de dobramento funcional (se aplicável)" },
      { nome: "Material de flutuação (espuma) íntegro" },
      { nome: "Vedações dos compartimentos eletrônicos" },
      { nome: "Cabos e conectores livres de corrosão" },
      { nome: "Distribuição de massa simétrica" },
      { nome: "CG abaixo do CB (verificar no tanque)" },
      { nome: "Braços dobráveis — ângulo de dobra correto (se aplicável)" },
    ],
  },
  {
    id: "elet", titulo: "Pré-ensaio — Sistema eletrônico", fonte: "Guia HAUV · M1",
    itens: [
      { nome: "Tensão da bateria ≥ 90%", captura: "status", unidade: "V" },
      { nome: "Calibração do IMU aéreo" },
      { nome: "Calibração do IMU subaquático" },
      { nome: "Calibração da bússola" },
      { nome: "Fix de GPS (≥ 8 satélites)", captura: "status", unidade: "sats" },
      { nome: "Parâmetros PID aéreo carregados" },
      { nome: "Parâmetros S-plane / PID subaquático carregados" },
      { nome: "Sensor de profundidade — zero em superfície" },
      { nome: "Log de dados habilitado (SD / telemetria)" },
      { nome: "Link de rádio / Bluetooth operacional" },
      { nome: "ESCs aéreos — armamento testado em terra" },
      { nome: "ESCs subaquáticos — rotação testada em água" },
    ],
  },
  {
    id: "ambiente", titulo: "Condições ambientais (registro)", fonte: "Guia HAUV · M1",
    itens: [
      { nome: "Data e hora", captura: "valor" },
      { nome: "Local (coordenadas GPS)", captura: "valor" },
      { nome: "Velocidade do vento", captura: "valor", unidade: "m/s" },
      { nome: "Direção do vento", captura: "valor", unidade: "°" },
      { nome: "Temperatura do ar", captura: "valor", unidade: "°C" },
      { nome: "Temperatura da água (superfície)", captura: "valor", unidade: "°C" },
      { nome: "Estado do mar (escala WMO)", captura: "valor" },
      { nome: "Altura de ondas (estimada)", captura: "valor", unidade: "m" },
      { nome: "Salinidade", captura: "valor", unidade: "PSU" },
      { nome: "Corrente de superfície", captura: "valor", unidade: "m/s" },
    ],
  },
  {
    id: "pos", titulo: "Pós-ensaio", fonte: "Guia HAUV · M7",
    itens: [
      { nome: "Lavar o veículo com água doce (ensaios em água salgada)", captura: "tarefa" },
      { nome: "Verificar integridade dos vedantes e caixas eletrônicas", captura: "status" },
      { nome: "Descarregar baterias para armazenamento (~50%)", captura: "tarefa" },
      { nome: "Exportar e fazer backup de todos os logs", captura: "tarefa" },
      { nome: "Inspecionar hélices e propulsores por danos", captura: "status" },
      { nome: "Lubrificar pontos de giro dos braços dobráveis (se aplicável)", captura: "tarefa" },
      { nome: "Registrar falhas ou anomalias no diário", captura: "tarefa" },
    ],
  },
];
let _cid = 0;
const cuid = () => `c${Date.now().toString(36)}${(_cid++).toString(36)}`;
const novoItem = (it = {}) => ({ id: cuid(), nome: it.nome || "", captura: it.captura || "status", unidade: it.unidade || "", resultado: "", valor: "", obs: "" });
const instanciarSecao = (tpl) => ({ id: cuid(), tplId: tpl.id, titulo: tpl.titulo, fonte: tpl.fonte || "", itens: tpl.itens.map(novoItem) });
const secaoVazia = () => ({ id: cuid(), tplId: null, titulo: "Nova seção", fonte: "", itens: [novoItem()] });
// Vocabulário e semântica de cada tipo de item.
const CAPTURAS = {
  status: { label: "Verificação", dropdown: "Verificação", opcoes: ["Passou", "Falhou", "N/A"] },
  tarefa: { label: "Tarefa", dropdown: "Tarefa", opcoes: ["Feito", "Pendente", "N/A"] },
  valor: { label: "Valor", dropdown: "Valor", opcoes: [] },
};
// Cor de cada estado (verde = resolvido ok, vermelho = bloqueio, âmbar = pendência, cinza = neutro).
const COR_RESULTADO = { Passou: "bg-teal-600", Feito: "bg-teal-600", Falhou: "bg-rose-500", Pendente: "bg-amber-500", "N/A": "bg-slate-400" };
// Migra checklist no formato antigo (lista plana de {nome,resultado,obs}) para seções.
const migraChecklist = (cl) => {
  if (!Array.isArray(cl) || cl.length === 0) return [];
  if (cl[0] && Array.isArray(cl[0].itens)) return cl; // já está em seções
  return [{ id: cuid(), titulo: "Itens", fonte: "", itens: cl.map(it => novoItem({ nome: it.nome })) .map((n, i) => ({ ...n, resultado: cl[i].resultado || "", obs: cl[i].obs || "" })) }];
};
const EXEMPLO = [{ Config: "Hélice A", Empuxo_N: 12.1 }, { Config: "Hélice A", Empuxo_N: 11.8 }, { Config: "Hélice A", Empuxo_N: 12.4 }, { Config: "Hélice B", Empuxo_N: 14.2 }, { Config: "Hélice B", Empuxo_N: 13.9 }, { Config: "Hélice B", Empuxo_N: 14.6 }, { Config: "Hélice C", Empuxo_N: 13.1 }, { Config: "Hélice C", Empuxo_N: 12.7 }, { Config: "Hélice C", Empuxo_N: 13.4 }];
const PALETTE = ["#0d9488", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#ea580c"];
const today = () => new Date().toISOString().slice(0, 10);
const META_DEF = { responsavel: "", data: today(), equipamento: "", local: "", descricao: "", notas: "" };
const DEF = { modo: null, contexto: "campo", objetivo: "comparar", factors: [{ id: 1, name: "Fator A", levelsRaw: "baixo, alto" }], medidas: [{ id: 1, name: "Resultado", tipo: "quantitativa", descricao: "" }], grupoVar: "", checklist: [], replicates: 2, matrix: [], rows: [], headers: [], groupCol: "", respCol: "", predX: "", predY: "", meta: { ...META_DEF } };
const TEMPLATES = [
  { id: "potencia", nome: "Verificação de potência nos motores", desc: "Comparar a corrente exigida por cada manobra.", state: { modo: "comparar", objetivo: "comparar", contexto: "campo", factors: [{ id: 1, name: "Manobra", levelsRaw: "Submergir, Mergulhar, Voar" }], medidas: [{ id: 1, name: "Corrente_A", tipo: "quantitativa", descricao: "Corrente do motor na manobra, em Ampères (A)." }], replicates: 3 } },
  { id: "validacao", nome: "Validação de modelo 6-DOF", desc: "Comparar o modelo 6-DOF com experimentos reais.", state: { modo: "validar", contexto: "matematico", factors: [], medidas: [{ id: 1, name: "Predito", tipo: "quantitativa", descricao: "Valor previsto pelo modelo 6-DOF." }, { id: 2, name: "Medido", tipo: "quantitativa", descricao: "Valor real medido." }], replicates: 1 } },
  { id: "logs", nome: "Análise de logs (tlog / .bin)", desc: "Verificar o comportamento por fase de voo.", state: { modo: "monitorar", contexto: "campo", grupoVar: "Fase_voo", medidas: [{ id: 1, name: "Corrente_A", tipo: "quantitativa", descricao: "Corrente do motor no trecho do log, em A." }] } },
  { id: "montagem", nome: "Configuração de montagem mais eficiente", desc: "Comparar configurações mecânicas.", state: { modo: "comparar", objetivo: "comparar", contexto: "campo", factors: [{ id: 1, name: "Config_montagem", levelsRaw: "A, B, C" }], medidas: [{ id: 1, name: "Eficiencia_energetica", tipo: "quantitativa", descricao: "Eficiência energética da configuração." }], replicates: 3 } },
];

function Termo({ children, def, ex }) {
  const [o, setO] = useState(false);
  return (<span className="relative inline-block"><button type="button" onClick={() => setO(!o)} className="text-teal-700 underline decoration-dotted decoration-teal-400 underline-offset-2 cursor-help font-medium">{children}</button>{o && (<span onClick={() => setO(false)} className="absolute z-50 left-0 top-full mt-1 w-56 bg-slate-800 text-white text-xs rounded-lg p-2.5 shadow-lg normal-case text-left leading-snug" style={{ fontWeight: 400 }}>{def}{ex && <span className="block mt-1 text-slate-300"><b>Ex.:</b> {ex}</span>}</span>)}</span>);
}

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
  const [showLib, setShowLib] = useState(false);
  const [toast, setToast] = useState("");
  const [deferred, setDeferred] = useState(null);

  const [modo, setModo] = useState(null);
  const [step, setStep] = useState(1);
  const [contexto, setContexto] = useState(DEF.contexto);
  const [objetivo, setObjetivo] = useState(DEF.objetivo);
  const [factors, setFactors] = useState(DEF.factors);
  const [medidas, setMedidas] = useState(DEF.medidas);
  const [grupoVar, setGrupoVar] = useState("");
  const [checklist, setChecklist] = useState([]);
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
  const [entryMode, setEntryMode] = useState("inserir");

  const bundle = () => ({ modo, contexto, objetivo, factors, medidas, grupoVar, checklist, replicates, matrix, rows, headers, groupCol, respCol, predX, predY, meta });
  const applyBundle = (b) => {
    setModo(b.modo ?? null); setContexto(b.contexto ?? DEF.contexto); setObjetivo(b.objetivo ?? DEF.objetivo);
    setFactors(b.factors ?? DEF.factors);
    setMedidas(b.medidas ?? (b.responses ? b.responses.map((n, i) => ({ id: i + 1, name: n, tipo: "quantitativa", descricao: "" })) : DEF.medidas));
    setGrupoVar(b.grupoVar ?? ""); setChecklist(migraChecklist(b.checklist ?? []));
    setReplicates(b.replicates ?? DEF.replicates); setMatrix(b.matrix ?? []);
    setRows(b.rows ?? []); setHeaders(b.headers ?? []); setGroupCol(b.groupCol ?? ""); setRespCol(b.respCol ?? "");
    setPredX(b.predX ?? ""); setPredY(b.predY ?? ""); setMeta(b.meta ? { ...META_DEF, ...b.meta } : { ...META_DEF });
  };
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  useEffect(() => { const h = (e) => { e.preventDefault(); setDeferred(e); }; window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h); }, []);
  const installApp = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; setDeferred(null); };

  const login = (name) => {
    const n = name.trim(); if (!n) return;
    let u = users.find(x => x.name.toLowerCase() === n.toLowerCase());
    if (!u) { u = { id: Date.now().toString(36), name: n }; const nu = [...users, u]; setUsers(nu); writeJSON(USERS_KEY, nu); }
    setCurrentUser(u);
    const work = readJSON(`hep:work:${u.id}`, null);
    applyBundle(work || { ...DEF, meta: { ...META_DEF, responsavel: u.name } });
    setSaves(readJSON(`hep:saves:${u.id}`, [])); setStep(1); setLoginName("");
  };
  const switchUser = () => { setCurrentUser(null); applyBundle(DEF); setStep(1); };
  const removeUser = (id) => { const nu = users.filter(u => u.id !== id); setUsers(nu); writeJSON(USERS_KEY, nu); LS.del(`hep:work:${id}`); LS.del(`hep:saves:${id}`); };
  const resetForm = () => { applyBundle({ ...DEF, modo, meta: { ...META_DEF, responsavel: currentUser?.name || "" } }); setLoadErr(""); setStep(1); flash("Formulário limpo"); };
  const pickModo = (m) => {
    setModo(m); setStep(1);
    if (m === "validar" && !medidas.some(x => x.name === "Predito") && !medidas.some(x => x.name === "Medido")) setMedidas([{ id: 1, name: "Predito", tipo: "quantitativa", descricao: "Valor previsto pelo modelo." }, { id: 2, name: "Medido", tipo: "quantitativa", descricao: "Valor real medido." }]);
    if (m === "inspecao" && checklist.length === 0) setChecklist([instanciarSecao(CHECKLISTS_LIB[0])]);
  };
  const applyTemplate = (t) => { applyBundle({ ...DEF, ...t.state, meta }); setShowTemplates(false); setStep(1); flash(`Template "${t.nome}" aplicado`); };
  const addFromCatalog = (item) => { setMedidas(ms => [...ms, { id: Date.now(), name: item.name, tipo: item.tipo, descricao: item.descricao }]); flash(`+ ${item.name}`); };

  useEffect(() => { if (!currentUser) return; writeJSON(`hep:work:${currentUser.id}`, bundle()); }, [currentUser, modo, contexto, objetivo, factors, medidas, grupoVar, checklist, replicates, matrix, rows, headers, groupCol, respCol, predX, predY, meta]);

  const saveAnalysis = (title) => { if (!currentUser) return; const s = { id: Date.now().toString(36), title: title.trim() || `Análise ${saves.length + 1}`, savedAt: new Date().toISOString(), state: bundle() }; const ns = [s, ...saves]; setSaves(ns); writeJSON(`hep:saves:${currentUser.id}`, ns); setShowSaveDlg(false); setSaveTitle(""); flash("Análise salva"); };
  const loadAnalysis = (s) => { applyBundle(s.state); setShowSaves(false); flash(`"${s.title}" carregada`); };
  const deleteAnalysis = (id) => { const ns = saves.filter(x => x.id !== id); setSaves(ns); writeJSON(`hep:saves:${currentUser.id}`, ns); };
  const exportJSON = () => download(`analise_${(currentUser?.name || "user").replace(/\s/g, "_")}.json`, JSON.stringify({ app: "hydrone-exp", user: currentUser?.name, state: bundle() }, null, 2), "application/json");
  const importJSON = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (d.state) { applyBundle(d.state); flash("Análise importada"); } } catch { flash("Arquivo inválido"); } }; r.readAsText(f); };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const parsedFactors = factors.map(f => ({ ...f, levels: f.levelsRaw.split(",").map(s => s.trim()).filter(Boolean) })).filter(f => f.name.trim() && f.levels.length);
  const cleanMedidas = medidas.filter(m => m.name.trim());
  const gridCols = modo === "comparar" ? [...parsedFactors.map(f => f.name), ...cleanMedidas.map(m => m.name)] : modo === "monitorar" ? [...(grupoVar.trim() ? [grupoVar.trim()] : []), ...cleanMedidas.map(m => m.name)] : modo === "validar" ? cleanMedidas.map(m => m.name) : [];
  const descMap = Object.fromEntries(cleanMedidas.filter(m => m.descricao).map(m => [m.name, m.descricao]));
  const nRuns = parsedFactors.length ? parsedFactors.reduce((a, f) => a * f.levels.length, 1) * replicates : 0;

  const gerarPlano = () => {
    if (!parsedFactors.length) return;
    let combos = [{}]; parsedFactors.forEach(f => { const next = []; combos.forEach(c => f.levels.forEach(lv => next.push({ ...c, [f.name]: lv }))); combos = next; });
    let runs = []; for (let r = 1; r <= replicates; r++) combos.forEach((c, i) => runs.push({ ...c, _rep: r, _std: i + 1 }));
    runs = runs.map((r, i) => ({ ...r, _ordem: i + 1 }));
    const sh = shuffle(runs).map((r, i) => { const row = { Ensaio: i + 1, OrdemPadrao: r._ordem }; parsedFactors.forEach(f => row[f.name] = r[f.name]); row.Replica = r._rep; cleanMedidas.forEach(m => row[m.name] = ""); return row; });
    setMatrix(sh);
  };
  const matrixCols = matrix.length ? ["Ensaio", "OrdemPadrao", ...parsedFactors.map(f => f.name), "Replica", ...cleanMedidas.map(m => m.name)] : [];

  const setCell = (i, col, val) => setRows(rows.map((r, idx) => idx === i ? { ...r, [col]: coerce(val) } : r));
  const addRow = () => { const cols = gridCols.length ? gridCols : ["Grupo", "Valor"]; setRows([...rows, Object.fromEntries(cols.map(c => [c, ""]))]); setHeaders(cols); };
  const delRow = (i) => setRows(rows.filter((_, idx) => idx !== i));
  const loadPlanIntoGrid = () => {
    const cols = gridCols.length ? gridCols : ["Grupo", "Valor"]; let rs;
    if (modo === "comparar" && matrix.length) rs = matrix.map(m => { const o = {}; parsedFactors.forEach(f => o[f.name] = m[f.name]); cleanMedidas.forEach(md => o[md.name] = ""); return o; });
    else rs = Array.from({ length: 4 }, () => Object.fromEntries(cols.map(c => [c, ""])));
    setRows(rs); setHeaders(cols);
    if (modo === "comparar") { if (parsedFactors[0]) setGroupCol(parsedFactors[0].name); const fr = cleanMedidas.find(m => m.tipo !== "evidencia"); if (fr) setRespCol(fr.name); }
    else if (modo === "monitorar") { setGroupCol(grupoVar.trim() || cols[0]); const fr = cleanMedidas.find(m => m.tipo !== "evidencia"); if (fr) setRespCol(fr.name); }
    else if (modo === "validar") { const nums = cleanMedidas.map(m => m.name); setPredX(nums[0] || ""); setPredY(nums[1] || ""); }
    flash("Tabela preparada");
  };

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

  const numericCols = headers.filter(c => rows.length && rows.every(r => r[c] == null || r[c] === "" || typeof r[c] === "number"));
  const obj = OBJETIVOS.find(o => o.id === objetivo) || OBJETIVOS[0];
  const respMedida = cleanMedidas.find(m => m.name === respCol);
  const tipoResp = respMedida ? respMedida.tipo : (rows.length && rows.every(r => r[respCol] == null || r[respCol] === "" || typeof r[respCol] === "number") ? "quantitativa" : "categorica");
  const respOptions = cleanMedidas.filter(m => m.tipo !== "evidencia").map(m => m.name);
  const respSelectList = respOptions.length ? respOptions : (numericCols.length ? numericCols : headers);
  const checkCounts = useMemo(() => {
    const c = { Passou: 0, Falhou: 0, "N/A": 0, Feito: 0, Pendente: 0, statusTotal: 0, statusResolv: 0, tarefaTotal: 0, tarefaResolv: 0, valorTotal: 0, valorPreenchidos: 0, itensTotal: 0 };
    checklist.forEach(sec => (sec.itens || []).forEach(it => {
      c.itensTotal++;
      if (it.captura === "valor") { c.valorTotal++; if (String(it.valor ?? "").trim() !== "") c.valorPreenchidos++; }
      else if (it.captura === "tarefa") { c.tarefaTotal++; if (c[it.resultado] !== undefined) c[it.resultado]++; if (it.resultado) c.tarefaResolv++; }
      else { c.statusTotal++; if (c[it.resultado] !== undefined) c[it.resultado]++; if (it.resultado) c.statusResolv++; }
    }));
    const verifTarefaTotal = c.statusTotal + c.tarefaTotal;
    const verifTarefaResolv = c.statusResolv + c.tarefaResolv;
    c.status = c.Falhou > 0 ? "reprovado" : c.Pendente > 0 ? "pendente" : (verifTarefaTotal > 0 && verifTarefaResolv === verifTarefaTotal) ? "concluido" : "incompleto";
    return c;
  }, [checklist]);
  const checklistItensTotal = checkCounts.itensTotal;
  // helpers de edição de checklist por seção
  const setSecao = (sid, patch) => setChecklist(cl => cl.map(s => s.id === sid ? { ...s, ...patch } : s));
  const setItem = (sid, iid, patch) => setChecklist(cl => cl.map(s => s.id === sid ? { ...s, itens: s.itens.map(it => it.id === iid ? { ...it, ...patch } : it) } : s));
  const addItem = (sid) => setChecklist(cl => cl.map(s => s.id === sid ? { ...s, itens: [...s.itens, novoItem()] } : s));
  const delItem = (sid, iid) => setChecklist(cl => cl.map(s => s.id === sid ? { ...s, itens: s.itens.filter(it => it.id !== iid) } : s));
  const delSecao = (sid) => setChecklist(cl => cl.filter(s => s.id !== sid));
  // Picker idempotente: clicar adiciona; clicar de novo no mesmo modelo remove (desfaz engano).
  const toggleSecaoPronta = (tpl) => setChecklist(cl => {
    if (cl.some(s => s.tplId === tpl.id)) { flash(`− ${tpl.titulo}`); return cl.filter(s => s.tplId !== tpl.id); }
    flash(`+ ${tpl.titulo}`); return [...cl, instanciarSecao(tpl)];
  });
  const addSecaoVazia = () => setChecklist(cl => [...cl, secaoVazia()]);
  const secCounts = (sec) => {
    let p = 0, f = 0, fe = 0, pe = 0, vt = 0, vp = 0, st = 0, tt = 0;
    (sec.itens || []).forEach(it => {
      if (it.captura === "valor") { vt++; if (String(it.valor ?? "").trim() !== "") vp++; }
      else if (it.captura === "tarefa") { tt++; if (it.resultado === "Feito") fe++; else if (it.resultado === "Pendente") pe++; }
      else { st++; if (it.resultado === "Passou") p++; else if (it.resultado === "Falhou") f++; }
    });
    return { p, f, fe, pe, vt, vp, status: st, tarefa: tt };
  };

  const analysis = useMemo(() => {
    if (!rows.length || !groupCol || !respCol || tipoResp === "evidencia") return null;
    const present = rows.filter(r => r[respCol] !== undefined && r[respCol] !== null && String(r[respCol]).trim() !== "" && r[groupCol] !== undefined && String(r[groupCol]).trim() !== "");
    if (present.length < 2) return null;
    const groupKeys = [...new Set(present.map(r => String(r[groupCol])))];
    if (tipoResp === "categorica") { const groups = {}; groupKeys.forEach(g => groups[g] = present.filter(r => String(r[groupCol]) === g).map(r => String(r[respCol]))); const ct = chiSquareTest(groups); return { kind: "categorica", groupKeys, ct, chartData: ct.cats.map(c => { const o = { categoria: c }; groupKeys.forEach(g => o[g] = ct.obs[g][c]); return o; }) }; }
    const valid = present.filter(r => !isNaN(Number(r[respCol])));
    if (valid.length < 2) { const groups = {}; groupKeys.forEach(g => groups[g] = present.filter(r => String(r[groupCol]) === g).map(r => String(r[respCol]))); const ct = chiSquareTest(groups); return { kind: "categorica", groupKeys, ct, chartData: ct.cats.map(c => { const o = { categoria: c }; groupKeys.forEach(g => o[g] = ct.obs[g][c]); return o; }), coerced: true }; }
    const groups = {}; groupKeys.forEach(g => groups[g] = valid.filter(r => String(r[groupCol]) === g).map(r => Number(r[respCol])));
    const desc = groupKeys.map(g => { const v = groups[g]; return { grupo: g, n: v.length, media: mean(v), dp: std(v), min: Math.min(...v), max: Math.max(...v), mediana: median(v) }; });
    const idx = Object.fromEntries(groupKeys.map((g, i) => [g, i + 1]));
    const scatterByGroup = groupKeys.map((g, gi) => ({ name: g, color: PALETTE[gi % PALETTE.length], data: groups[g].map(v => ({ x: idx[g] + (Math.random() * 0.3 - 0.15), y: v })) }));
    if (tipoResp === "ordinal") { const kw = groupKeys.length >= 2 && valid.length > groupKeys.length ? kruskalWallis(groups) : null; return { kind: "ordinal", groupKeys, desc, scatterByGroup, kw }; }
    const meansData = desc.map(d => ({ grupo: d.grupo, media: +d.media.toFixed(4), dp: +d.dp.toFixed(4) }));
    const okAnova = groupKeys.length >= 2 && valid.length > groupKeys.length;
    const anova = okAnova ? oneWayAnova(groups) : null;
    const zGroups = {}; groupKeys.forEach(g => { const med = median(groups[g]); zGroups[g] = groups[g].map(v => Math.abs(v - med)); });
    const levene = okAnova ? oneWayAnova(zGroups) : null;
    const resid = []; groupKeys.forEach((g, gi) => { const m = mean(groups[g]); groups[g].forEach(v => resid.push({ fitted: +m.toFixed(4), residuo: +(v - m).toFixed(4) })); });
    return { kind: "quant", groupKeys, desc, meansData, scatterByGroup, anova, levene, resid };
  }, [rows, groupCol, respCol, tipoResp]);

  const predData = useMemo(() => {
    if (!rows.length || !predX || !predY || predX === predY) return null;
    const v = rows.filter(r => !isNaN(Number(r[predX])) && !isNaN(Number(r[predY])) && r[predX] !== "" && r[predY] !== "");
    if (v.length < 2) return null;
    const pts = v.map(r => ({ x: Number(r[predX]), y: Number(r[predY]) })); const med = pts.map(p => p.y), mm = mean(med);
    const ssRes = pts.reduce((a, p) => a + (p.y - p.x) ** 2, 0), ssTot = pts.reduce((a, p) => a + (p.y - mm) ** 2, 0);
    const r2 = 1 - ssRes / ssTot, rmse = Math.sqrt(ssRes / pts.length);
    const lo = Math.min(...pts.flatMap(p => [p.x, p.y])), hi = Math.max(...pts.flatMap(p => [p.x, p.y]));
    return { pts, r2, rmse, line: [{ x: lo, y: lo }, { x: hi, y: hi }] };
  }, [rows, predX, predY]);

  const fmtDate = iso => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const anovaConc = analysis?.anova ? (analysis.anova.p < 0.05 ? `Diferença significativa (p ${analysis.anova.p < 0.0001 ? "< 0,0001" : "= " + analysis.anova.p.toFixed(4)}): pelo menos um grupo difere.` : `Sem evidência de diferença ao nível de 5% (p = ${analysis.anova.p.toFixed(4)}).`) : null;

  const buildReportHTML = () => {
    let res = "";
    if (modo === "inspecao") {
      const c = checkCounts;
      const fmtRes = it => it.captura === "valor" ? (String(it.valor ?? "").trim() ? esc(it.valor) + (it.unidade ? " " + esc(it.unidade) : "") : "—") : (esc(it.resultado || "—") + (it.unidade && String(it.valor ?? "").trim() ? ` (${esc(it.valor)} ${esc(it.unidade)})` : ""));
      const secoes = checklist.map(sec => `<h3 style="font-size:13px;color:#334155;margin:14px 0 4px">${esc(sec.titulo)}${sec.fonte ? ` <span style="font-weight:400;color:#94a3b8;font-size:11px">· ${esc(sec.fonte)}</span>` : ""}</h3><table><tr><th>Item</th><th>Resultado</th><th>Observação</th></tr>${sec.itens.map(it => `<tr><td>${esc(it.nome || "—")}</td><td>${fmtRes(it)}</td><td>${esc(it.obs || "")}</td></tr>`).join("")}</table>`).join("");
      const apto = c.status === "concluido" ? "CONCLUÍDO / CONFORME" : c.status === "reprovado" ? "REPROVADO (há verificações com falha)" : c.status === "pendente" ? "PENDENTE (há tarefas não concluídas)" : "INCOMPLETO";
      const resumoVerif = c.statusTotal ? `${c.Passou} passou · ${c.Falhou} falhou · ${c["N/A"]} N/A de ${c.statusTotal} verificações.` : "";
      const resumoTarefa = c.tarefaTotal ? ` ${c.Feito} feito · ${c.Pendente} pendente de ${c.tarefaTotal} tarefas.` : "";
      const resumoValor = c.valorTotal ? ` ${c.valorPreenchidos}/${c.valorTotal} valores registrados.` : "";
      res = `<h2>Checklist / Protocolo</h2>${secoes}<p><b>Resumo:</b> ${resumoVerif}${resumoTarefa}${resumoValor}</p><p><b>Status:</b> ${apto}.</p>`;
    }
    else if (modo === "validar" && predData) res = `<h2>Validação predito × medido</h2><p><b>R²</b> = ${predData.r2.toFixed(4)} · <b>RMSE</b> = ${predData.rmse.toFixed(4)} (n = ${predData.pts.length}).</p>`;
    else if (analysis?.kind === "quant") res = `<h2>Resultados</h2><table><tr><th>Grupo</th><th>n</th><th>Média</th><th>DP</th><th>Mediana</th></tr>${analysis.desc.map(d => `<tr><td>${esc(d.grupo)}</td><td>${d.n}</td><td>${d.media.toFixed(3)}</td><td>${d.dp.toFixed(3)}</td><td>${d.mediana.toFixed(3)}</td></tr>`).join("")}</table>${analysis.anova ? `<p><b>ANOVA:</b> F(${analysis.anova.dfb}, ${analysis.anova.dfw}) = ${analysis.anova.F.toFixed(3)}, p = ${analysis.anova.p < 0.0001 ? "&lt;0,0001" : analysis.anova.p.toFixed(4)}. ${esc(anovaConc || "")}</p>` : ""}${modo === "monitorar" ? "<p><i>Estudo observacional: descreve o comportamento; associação não prova causa.</i></p>" : ""}`;
    else if (analysis?.kind === "ordinal") res = `<h2>Resultados (ordinal)</h2><table><tr><th>Grupo</th><th>n</th><th>Mediana</th></tr>${analysis.desc.map(d => `<tr><td>${esc(d.grupo)}</td><td>${d.n}</td><td>${d.mediana.toFixed(2)}</td></tr>`).join("")}</table>${analysis.kw ? `<p><b>Kruskal–Wallis:</b> H = ${analysis.kw.H.toFixed(3)}, gl = ${analysis.kw.df}, p = ${analysis.kw.p < 0.0001 ? "&lt;0,0001" : analysis.kw.p.toFixed(4)}.</p>` : ""}`;
    else if (analysis?.kind === "categorica") res = `<h2>Resultados (categórico)</h2><table><tr><th>Grupo</th>${analysis.ct.cats.map(c => `<th>${esc(c)}</th>`).join("")}</tr>${analysis.groupKeys.map(g => `<tr><td>${esc(g)}</td>${analysis.ct.cats.map(c => `<td>${analysis.ct.obs[g][c]}</td>`).join("")}</tr>`).join("")}</table><p><b>Qui-quadrado:</b> X² = ${analysis.ct.X2.toFixed(3)}, gl = ${analysis.ct.df}, p = ${analysis.ct.p < 0.0001 ? "&lt;0,0001" : analysis.ct.p.toFixed(4)}.</p>`;
    let plano = "";
    if (modo === "comparar") plano = `<h2>Planejamento</h2><p><b>Delineamento:</b> ${esc(obj.design)}</p><p><b>Fatores:</b> ${parsedFactors.length ? parsedFactors.map(f => `${esc(f.name)} (${esc(f.levels.join(", "))})`).join(" · ") : "—"}</p><p><b>Variáveis medidas:</b> ${esc(cleanMedidas.map(m => `${m.name} [${TIPOS[m.tipo].label}]`).join(", ") || "—")}</p><p><b>Réplicas:</b> ${replicates} · <b>Ensaios previstos:</b> ${nRuns || "—"}</p>`;
    else if (modo === "monitorar") plano = `<h2>Observação</h2><p><b>Variável de agrupamento:</b> ${esc(grupoVar || "—")}</p><p><b>Variáveis medidas:</b> ${esc(cleanMedidas.map(m => `${m.name} [${TIPOS[m.tipo].label}]`).join(", ") || "—")}</p>`;
    else if (modo === "validar") plano = `<h2>Variáveis</h2><p>${esc(cleanMedidas.map(m => m.name).join(" × ") || "Predito × Medido")}</p>`;
    return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Relatório de Ensaio — Hydrone</title><style>body{font-family:Arial,sans-serif;color:#1e293b;max-width:760px;margin:24px auto;padding:0 24px}h1{font-size:20px;color:#0f766e;border-bottom:2px solid #0d9488;padding-bottom:6px;margin-bottom:2px}.sub{font-size:12px;color:#64748b;margin:0 0 16px}h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#0f766e;margin:20px 0 6px}table{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #e2e8f0}.meta td:first-child{color:#64748b;width:160px}p{font-size:13px;line-height:1.5;margin:4px 0}ul{font-size:12px;color:#475569;padding-left:18px}.foot{font-size:11px;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px}@media print{body{margin:0}}</style></head><body>
<h1>Relatório de Ensaio</h1><p class="sub">${esc(MODOS[modo]?.label || "")} · Planejador de Experimentos Hydrone</p>
${meta.descricao ? `<h2>Descrição do ensaio</h2><p>${esc(meta.descricao)}</p>` : ""}
<table class="meta"><tr><td>Responsável</td><td>${esc(meta.responsavel || currentUser.name)}</td></tr><tr><td>Data</td><td>${esc(meta.data)}</td></tr>${meta.equipamento ? `<tr><td>Equipamento</td><td>${esc(meta.equipamento)}</td></tr>` : ""}${meta.local ? `<tr><td>Local</td><td>${esc(meta.local)}</td></tr>` : ""}${modo !== "inspecao" ? `<tr><td>Contexto</td><td>${esc(CONTEXTOS[contexto].label)}</td></tr>` : ""}</table>
${plano}${res}${meta.notas ? `<h2>Observações</h2><p>${esc(meta.notas)}</p>` : ""}
<h2>Referências</h2><ul>${REFERENCIAS.map(r => `<li>${esc(r.t)}</li>`).join("")}</ul><p class="foot">Gerado em ${esc(new Date().toLocaleString("pt-BR"))}</p></body></html>`;
  };
  const printReport = () => {
    const html = buildReportHTML();
    try { const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (e) { } }, 400); return; } } catch (e) { }
    try { const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0;"; document.body.appendChild(f); const d = f.contentWindow.document; d.open(); d.write(html); d.close(); setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { } setTimeout(() => f.remove(), 800); }, 400); return; } catch (e) { }
    download("relatorio_ensaio.html", html, "text/html");
  };

  const headerActions = (<div className="flex items-center gap-1.5 text-sm">
    <span className="flex items-center gap-1.5 bg-white/15 rounded-full pl-2 pr-3 py-1"><User size={14} /> {currentUser?.name}</span>
    {deferred && <button onClick={installApp} title="Instalar app" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><DownloadCloud size={15} /></button>}
    <button onClick={() => setShowTemplates(true)} title="Templates" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><LayoutTemplate size={15} /></button>
    <button onClick={() => setShowSaves(true)} title="Minhas análises" className="bg-white/15 hover:bg-white/25 rounded-lg p-2 relative"><FolderOpen size={15} />{saves.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-400 text-teal-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{saves.length}</span>}</button>
    <button onClick={switchUser} title="Trocar usuário" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><LogOut size={15} /></button>
  </div>);

  // LOGIN
  if (!currentUser) {
    return (<div className="min-h-screen bg-gradient-to-br from-teal-600 to-cyan-700 flex items-center justify-center p-4" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-1"><Waves className="text-teal-600" size={24} /><h1 className="text-lg font-bold text-slate-800">Planejador de Experimentos</h1></div>
        <p className="text-sm text-slate-500 mb-5">Hydrone · identifique-se para salvar e retomar seus ensaios.</p>
        <label className="text-xs font-semibold text-slate-500 uppercase">Seu nome</label>
        <div className="flex gap-2 mt-1"><input value={loginName} onChange={e => setLoginName(e.target.value)} onKeyDown={e => e.key === "Enter" && login(loginName)} placeholder="ex.: Marie" className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-teal-400" /><button onClick={() => login(loginName)} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 rounded-lg text-sm">Entrar</button></div>
        {users.length > 0 && (<div className="mt-5"><p className="text-xs font-semibold text-slate-500 uppercase mb-2">Ou continue como</p><div className="space-y-1.5">{users.map(u => (<div key={u.id} className="flex items-center gap-2"><button onClick={() => login(u.name)} className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-left text-sm"><User size={15} className="text-teal-600" /> {u.name}</button><button onClick={() => removeUser(u.id)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={15} /></button></div>))}</div></div>)}
        <p className="text-xs text-slate-400 mt-5">Seus dados ficam salvos neste navegador/dispositivo.</p>
      </div>
    </div>);
  }

  // SELEÇÃO DE MODO
  if (!modo) {
    return (<div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white"><div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Waves size={26} className="text-cyan-100" /><div><h1 className="text-lg font-bold leading-tight">Planejador de Experimentos</h1><p className="text-xs text-cyan-100">Hydrone · guia de metodologia científica</p></div></div>{headerActions}</div></header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-slate-800">O que você vai fazer?</h2>
        <p className="text-sm text-slate-500 mt-1">Primeiro decida a natureza da tarefa. As duas famílias seguem lógicas diferentes — escolher certo evita misturar premissas.</p>
        {Object.entries(FAMILIAS).map(([fk, fam]) => { const Fi = fam.Icon; const modos = Object.entries(MODOS).filter(([, m]) => m.family === fk); return (
          <div key={fk} className="mt-6">
            <div className="flex items-center gap-2 mb-1"><Fi size={18} className="text-teal-600" /><h3 className="text-base font-bold text-slate-800">{fam.label}</h3></div>
            <p className="text-xs text-slate-500 mb-3">{fam.desc}</p>
            <div className="grid sm:grid-cols-2 gap-4">{modos.map(([k, m]) => { const Ic = m.Icon; return (
              <button key={k} onClick={() => pickModo(k)} className="text-left bg-white border-2 border-slate-200 hover:border-teal-400 hover:shadow-md transition rounded-xl p-5">
                <Ic className="text-teal-600" size={26} /><h4 className="font-bold text-slate-800 mt-2">{m.label}</h4><p className="text-sm text-slate-600 mt-1">{m.desc}</p><p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1 mt-2 inline-block">Ex.: {m.ex}</p>
              </button>); })}</div>
          </div>); })}
        <p className="text-xs text-slate-400 mt-6">Dica: você pode partir de um <button onClick={() => setShowTemplates(true)} className="text-teal-600 font-medium">template</button> ou abrir <button onClick={() => setShowSaves(true)} className="text-teal-600 font-medium">uma análise salva</button>.</p>
      </main>
      {showTemplates && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowTemplates(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800 flex items-center gap-2"><LayoutTemplate size={18} className="text-teal-600" /> Templates</h3><button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div><div className="space-y-2">{TEMPLATES.map(t => (<button key={t.id} onClick={() => applyTemplate(t)} className="w-full text-left border border-slate-200 hover:border-teal-400 hover:bg-teal-50 rounded-lg p-3"><div className="text-sm font-semibold text-slate-800">{t.nome}</div><div className="text-xs text-slate-500 mt-0.5">{t.desc}</div></button>))}</div></div></div>)}
      {showSaves && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowSaves(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">Minhas análises</h3><button onClick={() => setShowSaves(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>{saves.length === 0 ? <p className="text-sm text-slate-500 py-6 text-center">Nenhuma análise salva ainda.</p> : (<ul className="space-y-2 overflow-auto">{saves.map(s => (<li key={s.id} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2.5"><button onClick={() => loadAnalysis(s)} className="flex-1 text-left"><div className="text-sm font-medium text-slate-800">{s.title}</div><div className="text-xs text-slate-400">{fmtDate(s.savedAt)}</div></button><button onClick={() => deleteAnalysis(s.id)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={15} /></button></li>))}</ul>)}</div></div>)}
    </div>);
  }

  const ModoIcon = MODOS[modo].Icon;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-3"><Waves size={26} className="text-cyan-100" /><div><h1 className="text-lg font-bold leading-tight">Planejador de Experimentos</h1><p className="text-xs text-cyan-100 flex items-center gap-1"><ModoIcon size={12} /> {MODOS[modo].label}</p></div></div>
            <div className="flex items-center gap-1.5 text-sm">
              <button onClick={() => setModo(null)} title="Trocar tipo de ensaio" className="bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-2 flex items-center gap-1.5"><ArrowLeft size={14} /><span className="hidden sm:inline">Tipo</span></button>
              <button onClick={() => setShowSaveDlg(true)} title="Salvar" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><Save size={15} /></button>
              <button onClick={() => setShowSaves(true)} title="Minhas análises" className="bg-white/15 hover:bg-white/25 rounded-lg p-2 relative"><FolderOpen size={15} />{saves.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-400 text-teal-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{saves.length}</span>}</button>
              <button onClick={resetForm} title="Limpar" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><RotateCcw size={15} /></button>
              <button onClick={switchUser} title="Trocar usuário" className="bg-white/15 hover:bg-white/25 rounded-lg p-2"><LogOut size={15} /></button>
            </div>
          </div>
          <nav className="flex gap-1 flex-wrap">{[[1, ClipboardCheck, "Sobre o ensaio"], [2, ClipboardList, STEP2[modo]], [3, BarChart3, STEP3[modo]]].map(([n, Icon, label]) => (
            <button key={n} onClick={() => setStep(n)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${step === n ? "bg-white text-teal-700 shadow" : "text-teal-50 hover:bg-teal-500/40"}`}><span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === n ? "bg-teal-600 text-white" : "bg-teal-500/50 text-white"}`}>{n}</span><Icon size={16} /><span className="hidden sm:inline">{label}</span></button>))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* STEP 1 — SOBRE O ENSAIO */}
        {step === 1 && (<div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><ClipboardCheck size={15} className="text-teal-600" /> Sobre o ensaio</h2>
            <label className="text-xs text-slate-500 font-medium">O que você vai fazer neste ensaio e por quê</label>
            <textarea value={meta.descricao} onChange={e => setMeta({ ...meta, descricao: e.target.value })} placeholder="ex.: Medir a corrente dos motores em três manobras (submergir, mergulhar, voar) para identificar qual exige mais potência." className="w-full mt-1 mb-3 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400 h-20" />
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500">Responsável</label><input value={meta.responsavel} onChange={e => setMeta({ ...meta, responsavel: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /></div>
              <div><label className="text-xs text-slate-500">Data do ensaio</label><input type="date" value={meta.data} onChange={e => setMeta({ ...meta, data: e.target.value })} className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /></div>
              <div><label className="text-xs text-slate-500">Equipamento / veículo</label><input value={meta.equipamento} onChange={e => setMeta({ ...meta, equipamento: e.target.value })} placeholder="ex.: Hydrone v2" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /></div>
              <div><label className="text-xs text-slate-500">Local</label><input value={meta.local} onChange={e => setMeta({ ...meta, local: e.target.value })} placeholder="ex.: tanque Nautec" className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /></div>
            </div>
          </section>
          {modo !== "inspecao" && (<section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Contexto</h2>
            <div className="grid grid-cols-3 gap-3">{Object.entries(CONTEXTOS).map(([k, c]) => { const Ic = c.Icon; return (<button key={k} onClick={() => setContexto(k)} className={`rounded-xl border-2 p-4 text-left transition ${contexto === k ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-300"}`}><Ic size={22} className={contexto === k ? "text-teal-600" : "text-slate-500"} /><div className="font-semibold text-sm mt-2">{c.label}</div></button>); })}</div>
            <p className="mt-2 text-sm text-slate-600 flex gap-2 items-start"><Info size={15} className="mt-0.5 text-teal-600 shrink-0" />{CONTEXTOS[contexto].nota}</p>
          </section>)}
          {modo === "comparar" && (<section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Objetivo</h2>
            <div className="space-y-2">{OBJETIVOS.map(o => { const sel = objetivo === o.id; return (<button key={o.id} onClick={() => setObjetivo(o.id)} className={`w-full rounded-xl border-2 p-3 text-left transition flex items-start gap-3 ${sel ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-300"}`}><Target size={18} className={`mt-0.5 shrink-0 ${sel ? "text-teal-600" : "text-slate-400"}`} /><div><div className="font-medium text-sm">{o.label}</div><div className="text-xs text-slate-500 italic">“{o.pergunta}”</div></div></button>); })}</div>
            <div className="mt-3 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white p-4"><div className="flex items-center gap-2 mb-1"><FlaskConical size={16} /><span className="text-xs uppercase tracking-wide font-semibold text-cyan-100">Recomendado</span></div><h3 className="font-bold">{obj.design}</h3><p className="text-sm text-cyan-50 mt-1">{obj.interpreta}</p></div>
          </section>)}
          <button onClick={() => setStep(2)} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition">Próximo: {STEP2[modo]} →</button>
        </div>)}

        {/* STEP 2 */}
        {step === 2 && (<div className="space-y-6">
          {modo === "comparar" && (<>
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Fatores e níveis</h2>
              <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 mb-3 text-sm">
                <p className="text-slate-700"><b className="text-teal-800">Fator</b> = aquilo que você muda de propósito para ver o efeito. <b className="text-teal-800">Nível</b> = cada valor que esse fator assume no teste.</p>
                <div className="mt-2 bg-white rounded-md border border-teal-100 text-xs">
                  <div className="flex px-2 py-1.5 border-b border-teal-50 text-slate-500"><span className="w-32">Fator</span><span>Níveis (valores a testar)</span></div>
                  <div className="flex px-2 py-1.5 border-b border-teal-50"><span className="w-32 font-medium text-slate-700">Hélice</span><span className="text-slate-600">A · B · C</span></div>
                  <div className="flex px-2 py-1.5 border-b border-teal-50"><span className="w-32 font-medium text-slate-700">Potência (%)</span><span className="text-slate-600">50 · 75 · 100</span></div>
                  <div className="flex px-2 py-1.5"><span className="w-32 font-medium text-slate-700">Ângulo (°)</span><span className="text-slate-600">0 · 10 · 20</span></div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Cada combinação de níveis vira um ensaio.</p>
              </div>
              <div className="space-y-2">{factors.map((f) => (<div key={f.id} className="flex gap-2 items-center bg-white rounded-lg border border-slate-200 p-2"><input value={f.name} onChange={e => setFactors(factors.map(x => x.id === f.id ? { ...x, name: e.target.value } : x))} placeholder="ex.: Hélice, Potência" className="w-1/3 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /><input value={f.levelsRaw} onChange={e => setFactors(factors.map(x => x.id === f.id ? { ...x, levelsRaw: e.target.value } : x))} placeholder="níveis separados por vírgula (ex.: A, B, C)" className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /><button onClick={() => setFactors(factors.filter(x => x.id !== f.id))} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={16} /></button></div>))}</div>
              <button onClick={() => setFactors([...factors, { id: Date.now(), name: "", levelsRaw: "" }])} className="mt-2 text-sm text-teal-600 font-medium flex items-center gap-1"><Plus size={15} /> Adicionar fator</button>
            </section>
            {medidasEditor(medidas, setMedidas, () => setShowLib(true))}
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Réplicas</h2>
              <p className="text-xs text-slate-500 mb-2">Repetições de cada combinação (dão confiança estatística).</p>
              <input type="number" min={1} max={20} value={replicates} onChange={e => setReplicates(Math.max(1, Math.min(20, +e.target.value || 1)))} className="w-24 px-3 py-2 text-sm border border-slate-200 rounded bg-white outline-none focus:border-teal-400" />
              <p className="text-xs text-slate-500 mt-2">Total de ensaios previstos: <span className="font-bold text-teal-700">{nRuns}</span></p>
              {replicates < 2 && <p className="mt-2 text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2 flex gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Com 1 réplica não há como estimar o erro experimental. Use ≥ 2.</p>}
            </section>
            <button onClick={gerarPlano} disabled={!parsedFactors.length} className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition">Gerar plano de ensaios (randomizado)</button>
            {matrix.length > 0 && (<section>
              <div className="flex items-center justify-between mb-2"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Plano · {matrix.length} ensaios</h2><button onClick={() => download("plano_de_ensaios.csv", toCSV(matrix, matrixCols))} className="text-sm bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Download size={15} /> CSV</button></div>
              <p className="text-xs text-slate-500 mb-2 flex gap-1.5 items-start"><Info size={13} className="mt-0.5 shrink-0 text-teal-600" />A ordem é embaralhada (aleatorização) para que efeitos de tempo não se confundam com os fatores.</p>
              <div className="overflow-auto rounded-lg border border-slate-200 max-h-72"><table className="w-full text-sm"><thead className="bg-slate-100 sticky top-0"><tr>{matrixCols.map(c => <th key={c} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{c}</th>)}</tr></thead><tbody>{matrix.map((r, i) => <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>{matrixCols.map(c => <td key={c} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{r[c] === "" ? <span className="text-slate-300">—</span> : r[c]}</td>)}</tr>)}</tbody></table></div>
            </section>)}
          </>)}

          {modo === "validar" && (<section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Variáveis a comparar</h2>
            <p className="text-xs text-slate-500 mb-3">Defina a coluna do valor <b>previsto pelo modelo</b> e a do valor <b>medido</b>. Sem fatores, réplicas ou plano — você só registra os pares.</p>
            <div className="space-y-2">{medidas.map((m, i) => (<div key={m.id} className="bg-white rounded-lg border border-slate-200 p-2"><div className="flex gap-2 items-center"><span className="text-xs text-slate-400 w-16">{i === 0 ? "Predito" : i === 1 ? "Medido" : "Extra"}</span><input value={m.name} onChange={e => setMedidas(medidas.map(x => x.id === m.id ? { ...x, name: e.target.value } : x))} placeholder={i === 0 ? "ex.: Predito" : "ex.: Medido"} className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" />{medidas.length > 2 && <button onClick={() => setMedidas(medidas.filter(x => x.id !== m.id))} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={16} /></button>}</div><input value={m.descricao || ""} onChange={e => setMedidas(medidas.map(x => x.id === m.id ? { ...x, descricao: e.target.value } : x))} placeholder="O que é (unidade)? ex.: posição prevista pelo 6-DOF, em metros" className="w-full mt-2 px-2 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-400" /></div>))}</div>
          </section>)}

          {modo === "monitorar" && (<>
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Variável de agrupamento (opcional)</h2>
              <p className="text-xs text-slate-500 mb-2">Se quiser comparar trechos do registro, dê um nome de coluna para agrupar — ex.: fase de voo. Deixe vazio para olhar tudo junto.</p>
              <input value={grupoVar} onChange={e => setGrupoVar(e.target.value)} placeholder="ex.: Fase_voo  (deixe vazio se não houver)" className="w-full sm:w-1/2 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" />
            </section>
            {medidasEditor(medidas, setMedidas, () => setShowLib(true))}
            <p className="text-xs text-slate-500 bg-slate-100 rounded-lg p-3 flex gap-2"><Info size={14} className="mt-0.5 shrink-0 text-teal-600" />Modo observacional: você não controla nada, só registra. A análise descreve o comportamento — não há plano randomizado nem inferência de causa.</p>
          </>)}

          {modo === "inspecao" && (<div className="space-y-4">
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-sm text-slate-700 flex gap-2"><Info size={15} className="mt-0.5 shrink-0 text-teal-600" /><span>Monte o checklist da sessão a partir dos modelos prontos do guia (M1/M7) e/ou adicione seções próprias. Cada sessão carrega só o que for relevante para o ensaio — ex.: voo (M2) = Segurança + Mecânica + Eletrônica + Ambiental.</span></div>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Adicionar checklist pronto (Guia HAUV)</h2>
              <div className="grid sm:grid-cols-2 gap-2">{CHECKLISTS_LIB.map(tpl => { const usado = checklist.some(s => s.tplId === tpl.id); return (
                <button key={tpl.id} onClick={() => toggleSecaoPronta(tpl)} className={`text-left border-2 rounded-lg p-2.5 transition ${usado ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:border-teal-400 hover:bg-teal-50"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-800">{tpl.titulo}</span>{usado ? <CheckCircle2 size={15} className="text-teal-600 shrink-0" /> : <Plus size={15} className="text-slate-300 shrink-0" />}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{tpl.fonte} · {tpl.itens.length} itens{usado && <span className="text-teal-600 font-medium"> · adicionado (toque p/ remover)</span>}</div>
                </button>); })}</div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Seções do checklist {checklist.length > 0 && <span className="text-slate-400 normal-case">· {checklistItensTotal} itens</span>}</h2><button onClick={addSecaoVazia} className="text-sm text-teal-600 font-medium flex items-center gap-1"><Plus size={15} /> Seção em branco</button></div>
              {checklist.length === 0 ? <p className="text-sm text-slate-500 bg-slate-100 rounded-lg p-4">Adicione um checklist pronto acima ou crie uma seção em branco.</p> : (
                <div className="space-y-3">{checklist.map((sec) => (<div key={sec.id} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="flex gap-2 items-center mb-2"><ClipboardList size={16} className="text-teal-600 shrink-0" /><input value={sec.titulo} onChange={e => setSecao(sec.id, { titulo: e.target.value })} placeholder="Nome da seção" className="flex-1 px-2 py-1.5 text-sm font-semibold border border-slate-200 rounded outline-none focus:border-teal-400" />{sec.fonte && <span className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 shrink-0">{sec.fonte}</span>}<button onClick={() => delSecao(sec.id)} className="text-slate-400 hover:text-rose-500 p-1" title="Remover seção"><Trash2 size={16} /></button></div>
                  <div className="space-y-1.5">{sec.itens.map((it, i) => (<div key={it.id} className="flex gap-2 items-center"><span className="text-xs text-slate-400 w-5 shrink-0">{i + 1}</span><input value={it.nome} onChange={e => setItem(sec.id, it.id, { nome: e.target.value })} placeholder="descrição do item" className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /><select value={it.captura} onChange={e => setItem(sec.id, it.id, { captura: e.target.value, resultado: "" })} className="px-1.5 py-1.5 text-xs border border-slate-200 rounded bg-white outline-none focus:border-teal-400 shrink-0">{Object.entries(CAPTURAS).map(([k, v]) => <option key={k} value={k}>{v.dropdown}</option>)}</select><input value={it.unidade} onChange={e => setItem(sec.id, it.id, { unidade: e.target.value })} placeholder="un." className="w-14 px-1.5 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-400 shrink-0" /><button onClick={() => delItem(sec.id, it.id)} className="text-slate-400 hover:text-rose-500 p-1 shrink-0"><Trash2 size={15} /></button></div>))}</div>
                  <button onClick={() => addItem(sec.id)} className="mt-2 text-sm text-teal-600 font-medium flex items-center gap-1"><Plus size={14} /> Adicionar item</button>
                </div>))}</div>)}
            </section>
          </div>)}

          <button onClick={() => setStep(3)} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition">Próximo: {STEP3[modo]} →</button>
        </div>)}

        {/* STEP 3 */}
        {step === 3 && (<div className="space-y-6">
          {modo === "inspecao" ? (<section>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Execução do checklist</h2>{checkCounts.status === "reprovado" ? <span className="text-xs font-semibold bg-rose-50 text-rose-700 rounded-full px-3 py-1 flex items-center gap-1"><AlertTriangle size={13} /> {checkCounts.Falhou} reprovado(s)</span> : checkCounts.status === "pendente" ? <span className="text-xs font-semibold bg-amber-50 text-amber-700 rounded-full px-3 py-1 flex items-center gap-1"><AlertTriangle size={13} /> {checkCounts.Pendente} pendente(s)</span> : checkCounts.status === "concluido" ? <span className="text-xs font-semibold bg-teal-50 text-teal-700 rounded-full px-3 py-1 flex items-center gap-1"><CheckCircle2 size={13} /> Concluído</span> : null}</div>
            {checklistItensTotal === 0 ? <p className="text-sm text-slate-500 bg-slate-100 rounded-lg p-4">Monte o checklist na etapa anterior.</p> : (<>
              <div className="space-y-4">{checklist.map(sec => { const c = secCounts(sec); return (<div key={sec.id} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap"><h3 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5"><ClipboardList size={15} className="text-teal-600" />{sec.titulo}{sec.fonte && <span className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{sec.fonte}</span>}</h3><div className="flex gap-1.5 text-xs flex-wrap">{c.status > 0 && <span className="text-slate-500">{c.p}/{c.status} ok</span>}{c.tarefa > 0 && <span className="text-slate-500">{c.status > 0 ? "· " : ""}{c.fe}/{c.tarefa} feito</span>}{c.f > 0 && <span className="text-rose-600 font-medium">· {c.f} falha</span>}{c.pe > 0 && <span className="text-amber-600 font-medium">· {c.pe} pendente</span>}{c.vt > 0 && <span className="text-slate-500">· {c.vp}/{c.vt} registrados</span>}</div></div>
                <div className="space-y-2">{sec.itens.map(it => (<div key={it.id} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap"><div className="text-sm text-slate-800 flex-1 min-w-40">{it.nome || <span className="text-slate-300">(item sem nome)</span>}</div>
                    {it.captura === "valor" ? (<div className="flex items-center gap-1"><input value={it.valor} onChange={e => setItem(sec.id, it.id, { valor: e.target.value })} placeholder="valor" className="w-28 px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" />{it.unidade && <span className="text-xs text-slate-400 w-10">{it.unidade}</span>}</div>) : (<div className="flex gap-1.5 items-center">{it.unidade && <input value={it.valor} onChange={e => setItem(sec.id, it.id, { valor: e.target.value })} placeholder={it.unidade} className="w-16 px-1.5 py-1 text-xs border border-slate-200 rounded outline-none focus:border-teal-400" />}{(CAPTURAS[it.captura] || CAPTURAS.status).opcoes.map(r => { const on = it.resultado === r; return (<button key={r} onClick={() => setItem(sec.id, it.id, { resultado: on ? "" : r })} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${on ? (COR_RESULTADO[r] || "bg-slate-400") + " text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{r}</button>); })}</div>)}
                  </div>
                  <input value={it.obs} onChange={e => setItem(sec.id, it.id, { obs: e.target.value })} placeholder="observação / link de evidência (foto, log...)" className="w-full mt-1.5 px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:border-teal-400" />
                </div>))}</div>
              </div>); })}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">{checkCounts.statusTotal > 0 && <><span className="bg-teal-50 text-teal-700 rounded-lg px-3 py-1.5 font-medium">{checkCounts.Passou} passou</span><span className="bg-rose-50 text-rose-700 rounded-lg px-3 py-1.5 font-medium">{checkCounts.Falhou} falhou</span></>}{checkCounts.tarefaTotal > 0 && <><span className="bg-teal-50 text-teal-700 rounded-lg px-3 py-1.5 font-medium">{checkCounts.Feito} feito</span><span className="bg-amber-50 text-amber-700 rounded-lg px-3 py-1.5 font-medium">{checkCounts.Pendente} pendente</span></>}{checkCounts["N/A"] > 0 && <span className="bg-slate-100 text-slate-600 rounded-lg px-3 py-1.5 font-medium">{checkCounts["N/A"]} N/A</span>}{checkCounts.valorTotal > 0 && <span className="bg-cyan-50 text-cyan-700 rounded-lg px-3 py-1.5 font-medium">{checkCounts.valorPreenchidos}/{checkCounts.valorTotal} valores</span>}</div>
            </>)}
          </section>) : (<>
            <section>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 mb-3"><button onClick={() => setEntryMode("inserir")} className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 ${entryMode === "inserir" ? "bg-teal-600 text-white" : "text-slate-600"}`}><Pencil size={14} /> Inserir no app</button><button onClick={() => setEntryMode("importar")} className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 ${entryMode === "importar" ? "bg-teal-600 text-white" : "text-slate-600"}`}><Upload size={14} /> Importar CSV</button></div>
              {entryMode === "inserir" && (<div>
                <div className="flex flex-wrap gap-2 mb-2"><button onClick={loadPlanIntoGrid} className="text-sm bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Table2 size={15} /> {modo === "comparar" && matrix.length ? "Preencher do plano" : "Criar tabela"}</button>{rows.length > 0 && <button onClick={addRow} className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Plus size={15} /> Adicionar ensaio</button>}{rows.length > 0 && <button onClick={() => download("dados_ensaios.csv", toCSV(rows, headers))} className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Download size={15} /> Baixar</button>}</div>
                {rows.length === 0 ? (<p className="text-sm text-slate-500 bg-slate-100 rounded-lg p-4">Clique em <b>{modo === "comparar" && matrix.length ? "Preencher do plano" : "Criar tabela"}</b> para montar a tabela e digitar os resultados aqui mesmo.</p>) : (<div className="overflow-auto rounded-lg border border-slate-200 max-h-80"><table className="w-full text-sm"><thead className="bg-slate-100 sticky top-0"><tr><th className="px-2 py-2 text-left font-semibold text-slate-500 w-10">#</th>{headers.map(c => <th key={c} className="px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{descMap[c] ? <Termo def={descMap[c]}>{c}</Termo> : c}</th>)}<th className="w-8"></th></tr></thead><tbody>{rows.map((r, i) => (<tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}><td className="px-2 py-1 text-slate-400">{i + 1}</td>{headers.map(c => <td key={c} className="px-1 py-1"><input value={r[c] ?? ""} onChange={e => setCell(i, c, e.target.value)} className="w-full min-w-20 px-2 py-1 text-sm border border-transparent hover:border-slate-200 focus:border-teal-400 rounded outline-none bg-transparent" /></td>)}<td className="px-1"><button onClick={() => delRow(i)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button></td></tr>))}</tbody></table></div>)}
              </div>)}
              {entryMode === "importar" && (<div><div className="flex flex-wrap gap-3 items-center"><label className="cursor-pointer bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"><Upload size={15} /> Carregar CSV<input type="file" accept=".csv" onChange={handleFile} className="hidden" /></label>{modo === "comparar" && <button onClick={() => ingest(EXEMPLO)} className="text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium">Carregar exemplo</button>}</div><details className="mt-3"><summary className="text-sm text-teal-600 cursor-pointer">ou colar (CSV)</summary><textarea onChange={e => e.target.value.trim() && handlePaste(e.target.value)} placeholder={"Config,Empuxo_N\nHélice A,12.1"} className="mt-2 w-full h-24 p-2 text-sm font-mono border border-slate-200 rounded outline-none focus:border-teal-400" /></details>{loadErr && <p className="text-sm text-rose-600 mt-2">{loadErr}</p>}</div>)}
            </section>

            {rows.length > 0 && modo === "validar" && (<section>
              <div className="grid sm:grid-cols-2 gap-4 mb-3"><div><label className="text-xs font-semibold text-slate-500 uppercase">Predito (X)</label><select value={predX} onChange={e => setPredX(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white"><option value="">—</option>{numericCols.map(h => <option key={h}>{h}</option>)}</select></div><div><label className="text-xs font-semibold text-slate-500 uppercase">Medido (Y)</label><select value={predY} onChange={e => setPredY(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white"><option value="">—</option>{numericCols.map(h => <option key={h}>{h}</option>)}</select></div></div>
              {predData ? (<div className="bg-white rounded-lg border border-slate-200 p-2"><div className="flex gap-4 text-sm px-2 pt-1 pb-2"><span><Termo def={TERMOS.r2.def} ex={TERMOS.r2.ex}>R²</Termo> = <b className="text-teal-700">{predData.r2.toFixed(4)}</b></span><span><Termo def={TERMOS.rmse.def} ex={TERMOS.rmse.ex}>RMSE</Termo> = <b className="text-teal-700">{predData.rmse.toFixed(4)}</b></span></div><ResponsiveContainer width="100%" height={300}><ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="x" name={predX} tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="y" name={predY} tick={{ fontSize: 11 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={v => v.toFixed(3)} /><Scatter data={predData.pts} fill="#2563eb" /><Scatter data={predData.line} line={{ stroke: "#94a3b8", strokeDasharray: "5 5" }} shape={() => null} /></ScatterChart></ResponsiveContainer><p className="text-xs text-slate-500 px-2 pb-1">Linha tracejada = identidade (predito = medido). Quanto mais perto, melhor o modelo.</p></div>) : <p className="text-sm text-slate-500">Preencha pelo menos 2 pares predito/medido para ver o gráfico.</p>}
            </section>)}

            {rows.length > 0 && (modo === "comparar" || modo === "monitorar") && (<>
              <section className="grid sm:grid-cols-2 gap-4 bg-white rounded-xl border border-slate-200 p-4">
                <div><label className="text-xs font-semibold text-slate-500 uppercase">{modo === "monitorar" ? "Agrupar por" : "Fator (grupo)"}</label><select value={groupCol} onChange={e => setGroupCol(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white outline-none focus:border-teal-400">{headers.map(h => <option key={h}>{h}</option>)}</select></div>
                <div><label className="text-xs font-semibold text-slate-500 uppercase">Variável medida</label><select value={respCol} onChange={e => setRespCol(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white outline-none focus:border-teal-400">{respSelectList.map(h => <option key={h}>{h}</option>)}</select><p className="text-xs text-slate-400 mt-1">Tipo: <b className="text-slate-600">{TIPOS[tipoResp].label}</b> → {TIPOS[tipoResp].analise}.</p></div>
              </section>
              {modo === "monitorar" && <p className="text-xs bg-blue-50 text-blue-800 rounded-lg px-3 py-2 flex gap-1.5"><Info size={14} className="mt-0.5 shrink-0" />Observacional: os números descrevem o comportamento e mostram <b>associação</b>, não causa. Diferenças aqui não provam que o agrupamento causou o efeito.</p>}

              {analysis?.kind === "quant" && (<>
                <section><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Sigma size={15} /> Estatística descritiva</h2><div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100"><tr>{["Grupo", "n", "Média", "Desvio-padrão", "Mín", "Máx", "Mediana"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>)}</tr></thead><tbody>{analysis.desc.map((d, i) => <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}><td className="px-3 py-1.5 font-medium">{d.grupo}</td><td className="px-3 py-1.5">{d.n}</td><td className="px-3 py-1.5">{d.media.toFixed(3)}</td><td className="px-3 py-1.5">{d.dp.toFixed(3)}</td><td className="px-3 py-1.5">{d.min.toFixed(3)}</td><td className="px-3 py-1.5">{d.max.toFixed(3)}</td><td className="px-3 py-1.5">{d.mediana.toFixed(3)}</td></tr>)}</tbody></table></div></section>
                {analysis.anova && (<section><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2"><Termo def={TERMOS.anova.def} ex={TERMOS.anova.ex}>ANOVA</Termo> de um fator</h2><div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100"><tr>{["Fonte", "SQ", "gl", "QM", "F", "valor-p"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>)}</tr></thead><tbody><tr className="bg-white"><td className="px-3 py-1.5 font-medium">Entre grupos</td><td className="px-3 py-1.5">{analysis.anova.ssb.toFixed(3)}</td><td className="px-3 py-1.5">{analysis.anova.dfb}</td><td className="px-3 py-1.5">{analysis.anova.msb.toFixed(3)}</td><td className="px-3 py-1.5 font-bold">{analysis.anova.F.toFixed(3)}</td><td className={`px-3 py-1.5 font-bold ${analysis.anova.p < 0.05 ? "text-teal-700" : "text-slate-500"}`}>{analysis.anova.p < 0.0001 ? "<0.0001" : analysis.anova.p.toFixed(4)}</td></tr><tr className="bg-slate-50"><td className="px-3 py-1.5 font-medium">Dentro (erro)</td><td className="px-3 py-1.5">{analysis.anova.ssw.toFixed(3)}</td><td className="px-3 py-1.5">{analysis.anova.dfw}</td><td className="px-3 py-1.5">{analysis.anova.msw.toFixed(3)}</td><td></td><td></td></tr></tbody></table></div><p className={`mt-2 text-sm rounded-lg px-3 py-2 ${analysis.anova.p < 0.05 ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>{anovaConc} <span className="text-xs">(o <Termo def={TERMOS.p.def} ex={TERMOS.p.ex}>valor-p</Termo> é a chance de ser acaso.)</span></p></section>)}
                {analysis.levene && (<section><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ClipboardCheck size={15} className="text-teal-600" /> Pressupostos</h2><div className={`rounded-lg px-3 py-2.5 text-sm mb-3 ${analysis.levene.p < 0.05 ? "bg-rose-50 text-rose-800" : "bg-teal-50 text-teal-800"}`}><p className="font-semibold flex items-center gap-1.5">{analysis.levene.p < 0.05 ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />} Homogeneidade de variâncias: p = {analysis.levene.p < 0.0001 ? "<0,0001" : analysis.levene.p.toFixed(4)}</p><p className="mt-1">{analysis.levene.p < 0.05 ? "Variâncias diferem: a ANOVA fica menos confiável; considere transformar o dado ou Welch." : "Variâncias compatíveis: pressuposto razoável."}</p></div><h3 className="text-sm font-semibold text-slate-600 mb-2"><Termo def={TERMOS.residuo.def} ex={TERMOS.residuo.ex}>Resíduos</Termo> × ajustado</h3><div className="bg-white rounded-lg border border-slate-200 p-2"><ResponsiveContainer width="100%" height={220}><ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="fitted" tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="residuo" tick={{ fontSize: 11 }} /><Tooltip formatter={v => v.toFixed(3)} /><ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" /><Scatter data={analysis.resid} fill="#0d9488" /></ScatterChart></ResponsiveContainer></div></section>)}
                <section className="grid lg:grid-cols-2 gap-6"><div><h3 className="text-sm font-semibold text-slate-600 mb-2">Médias por grupo (± DP)</h3><div className="bg-white rounded-lg border border-slate-200 p-2"><ResponsiveContainer width="100%" height={260}><BarChart data={analysis.meansData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="grupo" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="media" fill="#0d9488" radius={[4, 4, 0, 0]}><ErrorBar dataKey="dp" width={6} strokeWidth={1.5} stroke="#475569" /></Bar></BarChart></ResponsiveContainer></div></div><div><h3 className="text-sm font-semibold text-slate-600 mb-2">Dispersão dos pontos</h3><div className="bg-white rounded-lg border border-slate-200 p-2"><ResponsiveContainer width="100%" height={260}><ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="x" domain={[0.5, analysis.groupKeys.length + 0.5]} ticks={analysis.groupKeys.map((_, i) => i + 1)} tickFormatter={t => analysis.groupKeys[t - 1]} tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => n === "y" ? v.toFixed(3) : v} />{analysis.scatterByGroup.map(g => <Scatter key={g.name} name={g.name} data={g.data} fill={g.color} />)}<Legend wrapperStyle={{ fontSize: 11 }} /></ScatterChart></ResponsiveContainer></div></div></section>
              </>)}

              {analysis?.kind === "ordinal" && (<>
                <section><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Sigma size={15} /> Resumo (ordinal — usa mediana)</h2><div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100"><tr>{["Grupo", "n", "Mediana", "Mín", "Máx"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>)}</tr></thead><tbody>{analysis.desc.map((d, i) => <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}><td className="px-3 py-1.5 font-medium">{d.grupo}</td><td className="px-3 py-1.5">{d.n}</td><td className="px-3 py-1.5">{d.mediana.toFixed(2)}</td><td className="px-3 py-1.5">{d.min}</td><td className="px-3 py-1.5">{d.max}</td></tr>)}</tbody></table></div></section>
                {analysis.kw && (<section><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Teste de <Termo def={TERMOS.kw.def} ex={TERMOS.kw.ex}>Kruskal–Wallis</Termo></h2><p className="text-sm">H = <b>{analysis.kw.H.toFixed(3)}</b> · gl = {analysis.kw.df} · p = <b className={analysis.kw.p < 0.05 ? "text-teal-700" : "text-slate-500"}>{analysis.kw.p < 0.0001 ? "<0,0001" : analysis.kw.p.toFixed(4)}</b></p><p className={`mt-2 text-sm rounded-lg px-3 py-2 ${analysis.kw.p < 0.05 ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>{analysis.kw.p < 0.05 ? "Diferença significativa entre os grupos (p < 0,05)." : "Sem evidência de diferença ao nível de 5%."}</p></section>)}
              </>)}

              {analysis?.kind === "categorica" && (<>
                {analysis.coerced && <p className="text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2 flex gap-1.5"><Info size={14} className="mt-0.5 shrink-0" />Valores não numéricos — analisando como categóricos.</p>}
                <section><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Frequências por grupo</h2><div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="px-3 py-2 text-left font-semibold text-slate-600">Grupo</th>{analysis.ct.cats.map(c => <th key={c} className="px-3 py-2 text-left font-semibold text-slate-600">{c}</th>)}<th className="px-3 py-2 text-left font-semibold text-slate-600">Total</th></tr></thead><tbody>{analysis.groupKeys.map((g, i) => <tr key={g} className={i % 2 ? "bg-slate-50" : "bg-white"}><td className="px-3 py-1.5 font-medium">{g}</td>{analysis.ct.cats.map(c => <td key={c} className="px-3 py-1.5">{analysis.ct.obs[g][c]} <span className="text-slate-400 text-xs">({(100 * analysis.ct.obs[g][c] / analysis.ct.rowTot[g]).toFixed(0)}%)</span></td>)}<td className="px-3 py-1.5 text-slate-500">{analysis.ct.rowTot[g]}</td></tr>)}</tbody></table></div></section>
                <section><h3 className="text-sm font-semibold text-slate-600 mb-2">Contagens por categoria</h3><div className="bg-white rounded-lg border border-slate-200 p-2"><ResponsiveContainer width="100%" height={260}><BarChart data={analysis.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="categoria" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{analysis.groupKeys.map((g, gi) => <Bar key={g} dataKey={g} fill={PALETTE[gi % PALETTE.length]} radius={[3, 3, 0, 0]} />)}</BarChart></ResponsiveContainer></div></section>
                <section><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Teste <Termo def={TERMOS.qui.def} ex={TERMOS.qui.ex}>qui-quadrado</Termo></h2><p className="text-sm">X² = <b>{analysis.ct.X2.toFixed(3)}</b> · gl = {analysis.ct.df} · p = <b className={analysis.ct.p < 0.05 ? "text-teal-700" : "text-slate-500"}>{analysis.ct.p < 0.0001 ? "<0,0001" : analysis.ct.p.toFixed(4)}</b></p><p className={`mt-2 text-sm rounded-lg px-3 py-2 ${analysis.ct.p < 0.05 ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>{analysis.ct.p < 0.05 ? (modo === "monitorar" ? "Associação significativa entre grupo e categoria (p < 0,05)." : "O resultado depende do grupo (p < 0,05).") : "Sem evidência de associação ao nível de 5%."}</p></section>
              </>)}
            </>)}
          </>)}
        </div>)}

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => setShowReport(true)} className="text-sm bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5"><FileText size={15} /> Gerar relatório (PDF)</button>
          <button onClick={exportJSON} className="text-sm bg-white border border-slate-200 hover:border-teal-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5"><FileJson size={15} className="text-teal-600" /> Exportar (.json)</button>
          <label className="text-sm bg-white border border-slate-200 hover:border-teal-400 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"><Upload size={15} className="text-teal-600" /> Importar<input type="file" accept=".json" onChange={importJSON} className="hidden" /></label>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden"><details><summary className="px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer flex items-center gap-2"><BookOpen size={16} className="text-teal-600" /> Referências metodológicas</summary><ul className="px-4 pb-4 space-y-2 text-sm text-slate-600">{REFERENCIAS.map((r, i) => <li key={i} className="flex gap-2"><span className="text-teal-600">•</span>{r.u ? <a href={r.u} target="_blank" rel="noreferrer" className="hover:text-teal-700 hover:underline">{r.t}</a> : <span>{r.t}</span>}</li>)}</ul></details></div>
      </main>

      {showLib && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowLib(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-1"><h3 className="font-bold text-slate-800 flex items-center gap-2"><BookOpen size={18} className="text-teal-600" /> Biblioteca de variáveis</h3><button onClick={() => setShowLib(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div><p className="text-xs text-slate-500 mb-3">Variáveis comuns do Hydrone, com tipo, unidade e exemplo. Toque para adicionar.</p><ul className="space-y-1.5 overflow-auto">{CATALOGO.map(item => (<li key={item.name}><button onClick={() => addFromCatalog(item)} className="w-full text-left border border-slate-200 hover:border-teal-400 hover:bg-teal-50 rounded-lg p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-800">{item.name}</span><span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{TIPOS[item.tipo].label}</span></div><div className="text-xs text-slate-500 mt-0.5">{item.descricao}</div></button></li>))}</ul></div></div>)}

      {showTemplates && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowTemplates(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800 flex items-center gap-2"><LayoutTemplate size={18} className="text-teal-600" /> Templates</h3><button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div><div className="space-y-2">{TEMPLATES.map(t => (<button key={t.id} onClick={() => applyTemplate(t)} className="w-full text-left border border-slate-200 hover:border-teal-400 hover:bg-teal-50 rounded-lg p-3"><div className="text-sm font-semibold text-slate-800">{t.nome}</div><div className="text-xs text-slate-500 mt-0.5">{t.desc}</div></button>))}</div></div></div>)}

      {showSaveDlg && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowSaveDlg(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}><h3 className="font-bold text-slate-800 mb-1">Salvar análise</h3><p className="text-xs text-slate-500 mb-3">Guarda o estado atual para retomar depois.</p><input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && saveAnalysis(saveTitle)} placeholder="Nome do ensaio" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-teal-400" autoFocus /><div className="flex gap-2 mt-4"><button onClick={() => setShowSaveDlg(false)} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 text-slate-600">Cancelar</button><button onClick={() => saveAnalysis(saveTitle)} className="flex-1 text-sm py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold">Salvar</button></div></div></div>)}

      {showSaves && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowSaves(false)}><div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">Minhas análises</h3><button onClick={() => setShowSaves(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>{saves.length === 0 ? <p className="text-sm text-slate-500 py-6 text-center">Nenhuma análise salva ainda.</p> : (<ul className="space-y-2 overflow-auto">{saves.map(s => (<li key={s.id} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2.5"><button onClick={() => loadAnalysis(s)} className="flex-1 text-left"><div className="text-sm font-medium text-slate-800">{s.title}</div><div className="text-xs text-slate-400">{fmtDate(s.savedAt)}</div></button><button onClick={() => deleteAnalysis(s.id)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={15} /></button></li>))}</ul>)}</div></div>)}

      {showReport && (<div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowReport(false)}><div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[88vh] overflow-auto" onClick={e => e.stopPropagation()}><div className="p-6 text-slate-800"><div className="flex items-center gap-2 border-b-2 border-teal-600 pb-2 mb-4"><Waves size={20} className="text-teal-600" /><div><h2 className="text-lg font-bold">Relatório de Ensaio</h2><p className="text-xs text-slate-500">{MODOS[modo].label} · Hydrone</p></div></div>{meta.descricao && <><h3 className="font-bold text-teal-700 text-sm uppercase tracking-wide mb-1">Descrição</h3><p className="text-sm mb-3">{meta.descricao}</p></>}<table className="w-full text-sm mb-3"><tbody><tr><td className="py-1 pr-3 text-slate-500 w-36">Responsável</td><td className="py-1 font-medium">{meta.responsavel || currentUser.name}</td></tr><tr><td className="py-1 pr-3 text-slate-500">Data</td><td className="py-1 font-medium">{meta.data}</td></tr>{meta.equipamento && <tr><td className="py-1 pr-3 text-slate-500">Equipamento</td><td className="py-1 font-medium">{meta.equipamento}</td></tr>}{meta.local && <tr><td className="py-1 pr-3 text-slate-500">Local</td><td className="py-1 font-medium">{meta.local}</td></tr>}{modo !== "inspecao" && <tr><td className="py-1 pr-3 text-slate-500">Contexto</td><td className="py-1 font-medium">{CONTEXTOS[contexto].label}</td></tr>}</tbody></table>
        {modo === "comparar" && <><h3 className="font-bold text-teal-700 text-sm uppercase tracking-wide mb-1">Planejamento</h3><p className="text-sm mb-1"><b>Delineamento:</b> {obj.design}</p><p className="text-sm mb-1"><b>Fatores:</b> {parsedFactors.length ? parsedFactors.map(f => `${f.name} (${f.levels.join(", ")})`).join(" · ") : "—"}</p><p className="text-sm"><b>Réplicas:</b> {replicates} · <b>Ensaios previstos:</b> {nRuns || "—"}</p></>}
        {modo === "inspecao" && <>{checklist.map(sec => (<div key={sec.id} className="mb-3"><h3 className="font-bold text-teal-700 text-sm uppercase tracking-wide mb-1 mt-3">{sec.titulo}{sec.fonte && <span className="text-slate-400 font-normal normal-case text-xs"> · {sec.fonte}</span>}</h3><table className="w-full text-sm border-collapse"><thead><tr className="border-b border-slate-300"><th className="text-left py-1 pr-3 font-semibold">Item</th><th className="text-left py-1 pr-3 font-semibold">Resultado</th></tr></thead><tbody>{sec.itens.map(it => <tr key={it.id} className="border-b border-slate-100"><td className="py-1 pr-3">{it.nome || "—"}</td><td className="py-1 pr-3">{it.captura === "valor" ? (String(it.valor ?? "").trim() ? `${it.valor}${it.unidade ? " " + it.unidade : ""}` : "—") : (it.resultado || "—") + (it.unidade && String(it.valor ?? "").trim() ? ` (${it.valor} ${it.unidade})` : "")}</td></tr>)}</tbody></table></div>))}<p className="text-sm"><b>Resumo:</b> {checkCounts.statusTotal > 0 && <>{checkCounts.Passou} passou · {checkCounts.Falhou} falhou de {checkCounts.statusTotal} verificações. </>}{checkCounts.tarefaTotal > 0 && <>{checkCounts.Feito} feito · {checkCounts.Pendente} pendente de {checkCounts.tarefaTotal} tarefas. </>}{checkCounts.valorTotal > 0 && <>{checkCounts.valorPreenchidos}/{checkCounts.valorTotal} valores registrados.</>}</p></>}
        {modo === "validar" && predData && <p className="text-sm mt-2"><b>Validação predito × medido:</b> R² = {predData.r2.toFixed(4)} · RMSE = {predData.rmse.toFixed(4)}.</p>}
        {(modo === "comparar" || modo === "monitorar") && analysis?.kind === "quant" && analysis.anova && <p className="text-sm mt-2"><b>ANOVA:</b> F = {analysis.anova.F.toFixed(3)}, p = {analysis.anova.p < 0.0001 ? "<0,0001" : analysis.anova.p.toFixed(4)}. {anovaConc}{modo === "monitorar" && " (observacional: associação, não causa.)"}</p>}
        {(modo === "comparar" || modo === "monitorar") && analysis?.kind === "ordinal" && analysis.kw && <p className="text-sm mt-2"><b>Kruskal–Wallis:</b> H = {analysis.kw.H.toFixed(3)}, p = {analysis.kw.p < 0.0001 ? "<0,0001" : analysis.kw.p.toFixed(4)}.</p>}
        {(modo === "comparar" || modo === "monitorar") && analysis?.kind === "categorica" && <p className="text-sm mt-2"><b>Qui-quadrado:</b> X² = {analysis.ct.X2.toFixed(3)}, p = {analysis.ct.p < 0.0001 ? "<0,0001" : analysis.ct.p.toFixed(4)}.</p>}
        {meta.notas && <><h3 className="font-bold text-teal-700 text-sm uppercase tracking-wide mb-1 mt-3">Observações</h3><p className="text-sm">{meta.notas}</p></>}
        <p className="text-xs text-slate-400 mt-4 pt-2 border-t border-slate-200">Gerado em {new Date().toLocaleString("pt-BR")}</p></div><div className="sticky bottom-0 bg-white border-t border-slate-200 p-3 flex gap-2 justify-end"><button onClick={() => setShowReport(false)} className="text-sm px-4 py-2 rounded-lg border border-slate-200 text-slate-600">Fechar</button><button onClick={printReport} className="text-sm px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5"><FileText size={15} /> Imprimir / Salvar PDF</button></div></div></div>)}

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}
    </div>
  );

  function medidasEditor(meds, setMeds, openLib) {
    return (<section>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">O que você vai medir / observar</h2>
      <p className="text-xs text-slate-500 mb-2">Para cada variável, escolha o <b>tipo</b> de dado — isso define como ela será analisada.</p>
      <div className="space-y-2">{meds.map((m) => (<div key={m.id} className="bg-white rounded-lg border border-slate-200 p-2"><div className="flex gap-2 items-center"><input value={m.name} onChange={e => setMeds(meds.map(x => x.id === m.id ? { ...x, name: e.target.value } : x))} placeholder="ex.: Empuxo_N" className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-teal-400" /><select value={m.tipo} onChange={e => setMeds(meds.map(x => x.id === m.id ? { ...x, tipo: e.target.value } : x))} className="px-2 py-1.5 text-sm border border-slate-200 rounded bg-white outline-none focus:border-teal-400">{Object.entries(TIPOS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select><button onClick={() => setMeds(meds.filter(x => x.id !== m.id))} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 size={16} /></button></div><input value={m.descricao || ""} onChange={e => setMeds(meds.map(x => x.id === m.id ? { ...x, descricao: e.target.value } : x))} placeholder="O que é? inclua unidade e exemplo (ex.: corrente do motor em A, ex.: 8,2)" className="w-full mt-2 px-2 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-teal-400" /><p className="text-xs text-slate-500 mt-1.5 px-1">{TIPOS[m.tipo].def} <span className="text-slate-400">Ex.: {TIPOS[m.tipo].ex}.</span> <span className="text-teal-600">Análise: {TIPOS[m.tipo].analise}.</span></p></div>))}</div>
      <div className="mt-2 flex gap-4"><button onClick={() => setMeds([...meds, { id: Date.now(), name: "", tipo: "quantitativa", descricao: "" }])} className="text-sm text-teal-600 font-medium flex items-center gap-1"><Plus size={15} /> Adicionar variável</button><button onClick={openLib} className="text-sm text-teal-600 font-medium flex items-center gap-1"><BookOpen size={15} /> Biblioteca</button></div>
      <div className="mt-3 text-xs text-slate-600 bg-slate-100 rounded-lg p-3 leading-relaxed"><b>Tipos:</b> <Termo def={TIPOS.quantitativa.def} ex={TIPOS.quantitativa.ex}>Quantitativa</Termo> · <Termo def={TIPOS.ordinal.def} ex={TIPOS.ordinal.ex}>Ordinal</Termo> · <Termo def={TIPOS.categorica.def} ex={TIPOS.categorica.ex}>Categórica</Termo> · <Termo def={TIPOS.evidencia.def} ex={TIPOS.evidencia.ex}>Evidência</Termo>.</div>
    </section>);
  }
}