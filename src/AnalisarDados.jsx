import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ErrorBar, ResponsiveContainer, ScatterChart, Scatter, Legend, ReferenceLine } from "recharts";
import { ArrowLeft, Upload, Sigma, Info, FunctionSquare } from "lucide-react";
import { mean, std, median, oneWayAnova, kruskalWallis, chiSquareTest } from "./lib/stats";

const PALETTE = ["#1d4ed8", "#2563eb", "#0891b2", "#7c3aed", "#db2777", "#ea580c"];

// Ferramenta opcional de análise estatística — fora do fluxo principal do protocolo.
// Recebe qualquer tabela (colada, importada de CSV, ou a planilha de campo do experimento
// aberto) e deixa a pessoa escolher o que comparar.
export default function AnalisarDados({ onClose, dadosIniciais }) {
  const [rows, setRows] = useState(dadosIniciais?.rows || []);
  const [headers, setHeaders] = useState(dadosIniciais?.headers || []);
  const [loadErr, setLoadErr] = useState("");
  const [groupCol, setGroupCol] = useState(dadosIniciais?.groupCol || "");
  const [respCol, setRespCol] = useState(dadosIniciais?.respCol || "");
  const [ordinal, setOrdinal] = useState(false);
  const [predX, setPredX] = useState("");
  const [predY, setPredY] = useState("");

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
  const tipoResp = ordinal ? "ordinal" : (numericCols.includes(respCol) ? "quantitativa" : "categorica");

  const analysis = useMemo(() => {
    if (!rows.length || !groupCol || !respCol) return null;
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
    return { kind: "quant", groupKeys, desc, meansData, scatterByGroup, anova };
  }, [rows, groupCol, respCol, tipoResp]);

  const anovaConc = analysis?.anova ? (analysis.anova.p < 0.05 ? `Diferença significativa (p ${analysis.anova.p < 0.0001 ? "< 0,0001" : "= " + analysis.anova.p.toFixed(4)}): pelo menos um grupo difere.` : `Sem evidência de diferença ao nível de 5% (p = ${analysis.anova.p.toFixed(4)}).`) : null;

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

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 overflow-auto text-slate-800" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-blue-800 text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><FunctionSquare size={20} /><div><h1 className="text-lg font-bold leading-tight">Analisar dados</h1><p className="text-xs text-blue-100">Ferramenta opcional, fora do protocolo</p></div></div>
          <button onClick={onClose} className="bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 text-sm flex items-center gap-1.5"><ArrowLeft size={14} /> Voltar ao protocolo</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Dados</h2>
          <p className="text-xs text-slate-500 mb-3">Cole uma tabela, importe um CSV, ou use a planilha de campo de um experimento salvo.</p>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="cursor-pointer bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"><Upload size={15} /> Carregar CSV<input type="file" accept=".csv" onChange={handleFile} className="hidden" /></label>
            {rows.length > 0 && <span className="text-xs text-slate-500">{rows.length} linhas carregadas</span>}
          </div>
          <details className="mt-3"><summary className="text-sm text-blue-700 cursor-pointer">ou colar (CSV)</summary><textarea onChange={e => e.target.value.trim() && handlePaste(e.target.value)} placeholder={"Grupo,Valor\nA,12.1"} className="mt-2 w-full h-24 p-2 text-sm font-mono border border-slate-200 rounded outline-none focus:border-blue-400" /></details>
          {loadErr && <p className="text-sm text-rose-600 mt-2">{loadErr}</p>}
        </section>

        {rows.length > 0 && (<>
          <section className="grid sm:grid-cols-2 gap-4 bg-white rounded-xl border border-slate-200 p-4">
            <div><label className="text-xs font-semibold text-slate-500 uppercase">Agrupar por</label><select value={groupCol} onChange={e => setGroupCol(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white outline-none focus:border-blue-400">{headers.map(h => <option key={h}>{h}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase">Coluna a comparar</label><select value={respCol} onChange={e => setRespCol(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white outline-none focus:border-blue-400">{headers.map(h => <option key={h}>{h}</option>)}</select>
              {numericCols.includes(respCol) && <label className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5"><input type="checkbox" checked={ordinal} onChange={e => setOrdinal(e.target.checked)} /> tratar como ordinal (usar Kruskal–Wallis em vez de ANOVA)</label>}
            </div>
          </section>

          {analysis?.kind === "quant" && (<>
            <section className="bg-white rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Sigma size={15} /> Estatística descritiva</h2><div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100"><tr>{["Grupo", "n", "Média", "Desvio-padrão", "Mín", "Máx", "Mediana"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>)}</tr></thead><tbody>{analysis.desc.map((d, i) => <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}><td className="px-3 py-1.5 font-medium">{d.grupo}</td><td className="px-3 py-1.5">{d.n}</td><td className="px-3 py-1.5">{d.media.toFixed(3)}</td><td className="px-3 py-1.5">{d.dp.toFixed(3)}</td><td className="px-3 py-1.5">{d.min.toFixed(3)}</td><td className="px-3 py-1.5">{d.max.toFixed(3)}</td><td className="px-3 py-1.5">{d.mediana.toFixed(3)}</td></tr>)}</tbody></table></div></section>
            {analysis.anova && (<section className="bg-white rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">ANOVA de um fator</h2><div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100"><tr>{["Fonte", "SQ", "gl", "QM", "F", "valor-p"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>)}</tr></thead><tbody><tr className="bg-white"><td className="px-3 py-1.5 font-medium">Entre grupos</td><td className="px-3 py-1.5">{analysis.anova.ssb.toFixed(3)}</td><td className="px-3 py-1.5">{analysis.anova.dfb}</td><td className="px-3 py-1.5">{analysis.anova.msb.toFixed(3)}</td><td className="px-3 py-1.5 font-bold">{analysis.anova.F.toFixed(3)}</td><td className={`px-3 py-1.5 font-bold ${analysis.anova.p < 0.05 ? "text-blue-800" : "text-slate-500"}`}>{analysis.anova.p < 0.0001 ? "<0.0001" : analysis.anova.p.toFixed(4)}</td></tr><tr className="bg-slate-50"><td className="px-3 py-1.5 font-medium">Dentro (erro)</td><td className="px-3 py-1.5">{analysis.anova.ssw.toFixed(3)}</td><td className="px-3 py-1.5">{analysis.anova.dfw}</td><td className="px-3 py-1.5">{analysis.anova.msw.toFixed(3)}</td><td></td><td></td></tr></tbody></table></div><p className={`mt-2 text-sm rounded-lg px-3 py-2 ${analysis.anova.p < 0.05 ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-800"}`}>{anovaConc}</p></section>)}
            <section className="grid lg:grid-cols-2 gap-6"><div className="bg-white rounded-lg border border-slate-200 p-2"><h3 className="text-sm font-semibold text-slate-600 mb-2 px-1">Médias por grupo (± DP)</h3><ResponsiveContainer width="100%" height={260}><BarChart data={analysis.meansData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="grupo" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="media" fill="#1d4ed8" radius={[4, 4, 0, 0]}><ErrorBar dataKey="dp" width={6} strokeWidth={1.5} stroke="#475569" /></Bar></BarChart></ResponsiveContainer></div><div className="bg-white rounded-lg border border-slate-200 p-2"><h3 className="text-sm font-semibold text-slate-600 mb-2 px-1">Dispersão dos pontos</h3><ResponsiveContainer width="100%" height={260}><ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="x" domain={[0.5, analysis.groupKeys.length + 0.5]} ticks={analysis.groupKeys.map((_, i) => i + 1)} tickFormatter={t => analysis.groupKeys[t - 1]} tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => n === "y" ? v.toFixed(3) : v} />{analysis.scatterByGroup.map(g => <Scatter key={g.name} name={g.name} data={g.data} fill={g.color} />)}<Legend wrapperStyle={{ fontSize: 11 }} /></ScatterChart></ResponsiveContainer></div></section>
          </>)}

          {analysis?.kind === "ordinal" && (<>
            <section className="bg-white rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Sigma size={15} /> Resumo (ordinal — usa mediana)</h2><div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100"><tr>{["Grupo", "n", "Mediana", "Mín", "Máx"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>)}</tr></thead><tbody>{analysis.desc.map((d, i) => <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}><td className="px-3 py-1.5 font-medium">{d.grupo}</td><td className="px-3 py-1.5">{d.n}</td><td className="px-3 py-1.5">{d.mediana.toFixed(2)}</td><td className="px-3 py-1.5">{d.min}</td><td className="px-3 py-1.5">{d.max}</td></tr>)}</tbody></table></div></section>
            {analysis.kw && (<section className="bg-white rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Teste de Kruskal–Wallis</h2><p className="text-sm">H = <b>{analysis.kw.H.toFixed(3)}</b> · gl = {analysis.kw.df} · p = <b className={analysis.kw.p < 0.05 ? "text-blue-800" : "text-slate-500"}>{analysis.kw.p < 0.0001 ? "<0,0001" : analysis.kw.p.toFixed(4)}</b></p><p className={`mt-2 text-sm rounded-lg px-3 py-2 ${analysis.kw.p < 0.05 ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-800"}`}>{analysis.kw.p < 0.05 ? "Diferença significativa entre os grupos (p < 0,05)." : "Sem evidência de diferença ao nível de 5%."}</p></section>)}
          </>)}

          {analysis?.kind === "categorica" && (<>
            {analysis.coerced && <p className="text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2 flex gap-1.5"><Info size={14} className="mt-0.5 shrink-0" />Valores não numéricos — analisando como categóricos.</p>}
            <section className="bg-white rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Frequências por grupo</h2><div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="px-3 py-2 text-left font-semibold text-slate-600">Grupo</th>{analysis.ct.cats.map(c => <th key={c} className="px-3 py-2 text-left font-semibold text-slate-600">{c}</th>)}<th className="px-3 py-2 text-left font-semibold text-slate-600">Total</th></tr></thead><tbody>{analysis.groupKeys.map((g, i) => <tr key={g} className={i % 2 ? "bg-slate-50" : "bg-white"}><td className="px-3 py-1.5 font-medium">{g}</td>{analysis.ct.cats.map(c => <td key={c} className="px-3 py-1.5">{analysis.ct.obs[g][c]} <span className="text-slate-400 text-xs">({(100 * analysis.ct.obs[g][c] / analysis.ct.rowTot[g]).toFixed(0)}%)</span></td>)}<td className="px-3 py-1.5 text-slate-500">{analysis.ct.rowTot[g]}</td></tr>)}</tbody></table></div></section>
            <section className="bg-white rounded-lg border border-slate-200 p-2"><h3 className="text-sm font-semibold text-slate-600 mb-2 px-1">Contagens por categoria</h3><ResponsiveContainer width="100%" height={260}><BarChart data={analysis.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="categoria" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{analysis.groupKeys.map((g, gi) => <Bar key={g} dataKey={g} fill={PALETTE[gi % PALETTE.length]} radius={[3, 3, 0, 0]} />)}</BarChart></ResponsiveContainer></section>
            <section className="bg-white rounded-xl border border-slate-200 p-4"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Teste qui-quadrado</h2><p className="text-sm">X² = <b>{analysis.ct.X2.toFixed(3)}</b> · gl = {analysis.ct.df} · p = <b className={analysis.ct.p < 0.05 ? "text-blue-800" : "text-slate-500"}>{analysis.ct.p < 0.0001 ? "<0,0001" : analysis.ct.p.toFixed(4)}</b></p><p className={`mt-2 text-sm rounded-lg px-3 py-2 ${analysis.ct.p < 0.05 ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-800"}`}>{analysis.ct.p < 0.05 ? "O resultado depende do grupo (p < 0,05)." : "Sem evidência de associação ao nível de 5%."}</p></section>
          </>)}

          <section className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Comparar duas colunas (ex.: previsto × medido)</h2>
            <p className="text-xs text-slate-500 mb-3">Útil para validar um modelo contra dados reais.</p>
            <div className="grid sm:grid-cols-2 gap-4 mb-3"><div><label className="text-xs font-semibold text-slate-500 uppercase">Coluna X (ex.: previsto)</label><select value={predX} onChange={e => setPredX(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white"><option value="">—</option>{numericCols.map(h => <option key={h}>{h}</option>)}</select></div><div><label className="text-xs font-semibold text-slate-500 uppercase">Coluna Y (ex.: medido)</label><select value={predY} onChange={e => setPredY(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded bg-white"><option value="">—</option>{numericCols.map(h => <option key={h}>{h}</option>)}</select></div></div>
            {predData ? (<div><div className="flex gap-4 text-sm px-1 pb-2"><span>R² = <b className="text-blue-800">{predData.r2.toFixed(4)}</b></span><span>RMSE = <b className="text-blue-800">{predData.rmse.toFixed(4)}</b></span></div><ResponsiveContainer width="100%" height={300}><ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" dataKey="x" name={predX} tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="y" name={predY} tick={{ fontSize: 11 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={v => v.toFixed(3)} /><Scatter data={predData.pts} fill="#2563eb" /><Scatter data={predData.line} line={{ stroke: "#94a3b8", strokeDasharray: "5 5" }} shape={() => null} /></ScatterChart></ResponsiveContainer><p className="text-xs text-slate-500 px-1 pb-1">Linha tracejada = identidade (X = Y). Quanto mais perto, melhor a concordância.</p></div>) : <p className="text-sm text-slate-500">Escolha duas colunas numéricas para ver o gráfico.</p>}
          </section>
        </>)}
      </main>
    </div>
  );
}
