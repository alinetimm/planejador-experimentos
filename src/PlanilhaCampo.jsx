import { useEffect, useRef, useState } from "react";
import { Table2, LayoutGrid, Plus, Download, Trash2, ChevronDown, Clock } from "lucide-react";
import { respostaDe, opcoesDe } from "./lib/requisitos";

const CAMPO = "w-full min-h-10 px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-400";
const CHAVE_VISUALIZACAO = "hep:planilha:visualizacao";
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const horaAgora = () => {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
};

const ajustarAltura = (el) => { if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + 2 + "px"; };
const autoGrow = (e) => ajustarAltura(e.target);

// O campo continua editável para corrigir uma marcação feita atrasada.
export function CampoHora({ value, onChange, disabled, compacto = false }) {
  return (
    <div className="flex items-center gap-1">
      <input disabled={disabled} value={value || ""} onChange={e => onChange(e.target.value)} placeholder="hh:mm:ss"
        className={compacto
          ? "w-24 px-2 py-1 text-sm tabular-nums border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
          : `${CAMPO} tabular-nums min-w-0`} />
      {!disabled && (
        <button type="button" onClick={() => onChange(horaAgora())} title="Registrar agora" aria-label="Registrar agora"
          className={compacto
            ? "text-slate-400 hover:text-blue-600 p-1"
            : "shrink-0 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}>
          <Clock size={compacto ? 14 : 16} />
        </button>
      )}
    </div>
  );
}

const ehIdentificador = (item) => /^ensaio_id/i.test(item.titulo);
const tituloCurto = (item) => item.titulo.replace(/\s*\(.*\)\s*$/, "");

// Confirmação dentro da própria linha: confirm() do navegador é bloqueante e
// destoa no celular, e a lixeira fica perto demais da seta de abrir/fechar.
function ConfirmarRemocao({ numero, onCancelar, onConfirmar }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap" onClick={e => e.stopPropagation()}>
      <span className="text-xs text-rose-700 font-medium hidden sm:inline">Remover #{numero}?</span>
      <button onClick={onCancelar} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300">Cancelar</button>
      <button onClick={onConfirmar} className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium">Remover</button>
    </div>
  );
}

/** Um campo da linha, igual nos cards e na tabela. */
function Campo({ item, value, onChange, disabled, id }) {
  const r = respostaDe(item);
  const v = value ?? "";
  // O identificador é curto; mesmo cadastrado como "texto", cabe numa linha.
  if (ehIdentificador(item)) return <input id={id} disabled={disabled} value={v} onChange={e => onChange(e.target.value)} className={CAMPO} />;
  if (r === "hora") return <CampoHora value={v} onChange={onChange} disabled={disabled} />;
  // Data digitada antes do calendário (ex.: "20/10") seria apagada visualmente
  // pelo <input type="date">, então só usa o calendário quando o valor é ISO.
  if (r === "data" && (!v || DATA_ISO.test(v))) return <input id={id} type="date" disabled={disabled} value={v} onChange={e => onChange(e.target.value)} className={CAMPO} />;
  if (r === "texto") return <textarea id={id} ref={ajustarAltura} disabled={disabled} value={v} onChange={e => onChange(e.target.value)} onInput={autoGrow} rows={1} className={`${CAMPO} block resize-none`} />;
  const opts = opcoesDe(item);
  if (r !== "valor" && r !== "data" && opts.length) {
    return (
      <select id={id} disabled={disabled} value={v} onChange={e => onChange(e.target.value)} className={CAMPO}>
        <option value=""></option>
        {opts.map(op => <option key={op} value={op}>{op}</option>)}
        {v && !opts.includes(v) && <option value={v}>{v}</option>}
      </select>
    );
  }
  return <input id={id} disabled={disabled} value={v} onChange={e => onChange(e.target.value)} className={CAMPO} />;
}

// Celular: hora, data e listas ocupam meia linha; o resto, a linha inteira.
function larguraNoCard(item) {
  const r = respostaDe(item);
  if (r === "texto" && !ehIdentificador(item)) return "col-span-2";
  if (r === "hora" || r === "data" || (r !== "valor" && opcoesDe(item).length)) return "col-span-1";
  return "col-span-2 md:col-span-1";
}

function resumoDaLinha(itens, row) {
  const partes = [];
  const horas = [];
  for (const i of itens) {
    const v = (row[i.id] ?? "").toString().trim();
    if (!v || ehIdentificador(i)) continue;
    const r = respostaDe(i);
    if (r === "hora") horas.push(v);
    else if (r === "texto") continue;
    else if (r !== "valor" && r !== "data" && opcoesDe(i).length) partes.push(`${tituloCurto(i)} ${v}`);
    else partes.push(v);
  }
  if (horas.length) partes.push(horas.join(" – "));
  return partes.slice(0, 5);
}

function useTelaLarga() {
  const consulta = "(min-width: 768px)";
  const [larga, setLarga] = useState(() => typeof window !== "undefined" && window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const ouvir = () => setLarga(mq.matches);
    mq.addEventListener("change", ouvir);
    return () => mq.removeEventListener("change", ouvir);
  }, []);
  return larga;
}

/**
 * Planilha de campo: uma linha por ensaio (ou por etapa, no Experimento de campo).
 * Cards no celular e por padrão; tabela opcional a partir de 768px.
 * O estado das linhas continua no App — aqui só se decide como mostrar.
 */
export default function PlanilhaCampo({ itens, rows, readOnly, onAdd, onSetCell, onDel, onExport }) {
  const telaLarga = useTelaLarga();
  const [visualizacao, setVisualizacao] = useState(() => {
    try { return window.localStorage.getItem(CHAVE_VISUALIZACAO) || "cards"; } catch { return "cards"; }
  });
  const escolher = (v) => {
    setVisualizacao(v);
    try { window.localStorage.setItem(CHAVE_VISUALIZACAO, v); } catch { /* localStorage indisponível */ }
  };
  const modoTabela = telaLarga && visualizacao === "tabela";

  // Com 8 etapas por execução a lista cresce rápido: ao abrir, só a última linha
  // fica expandida; ao adicionar, as anteriores recolhem e a nova abre.
  const [recolhidos, setRecolhidos] = useState(() => new Set(rows.slice(0, -1).map((_, i) => i)));
  const [confirmando, setConfirmando] = useState(null);
  const ultimoCard = useRef(null);
  const acabouDeAdicionar = useRef(false);

  useEffect(() => {
    if (!acabouDeAdicionar.current) return;
    acabouDeAdicionar.current = false;
    ultimoCard.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [rows.length]);

  const adicionar = () => {
    setRecolhidos(new Set(rows.map((_, i) => i)));
    setConfirmando(null);
    acabouDeAdicionar.current = true;
    onAdd();
  };
  const remover = (idx) => {
    setRecolhidos(s => new Set([...s].filter(i => i !== idx).map(i => (i > idx ? i - 1 : i))));
    setConfirmando(null);
    onDel(idx);
  };
  const alternar = (idx) => setRecolhidos(s => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });

  const idItem = itens.find(ehIdentificador);
  const colunas = idItem ? [idItem, ...itens.filter(i => i !== idItem)] : itens;

  return (
    <section>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><Table2 size={15} className="text-blue-700" /> Planilha de campo</h2>
        <div className="flex gap-2 flex-wrap">
          {telaLarga && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Visualização">
              {[["cards", "Cards", LayoutGrid], ["tabela", "Tabela", Table2]].map(([v, rotulo, Icone]) => (
                <button key={v} onClick={() => escolher(v)} aria-pressed={visualizacao === v}
                  className={`text-sm px-2.5 py-1 rounded-md flex items-center gap-1.5 ${visualizacao === v ? "bg-blue-50 text-blue-800 font-medium" : "text-slate-500 hover:text-slate-700"}`}>
                  <Icone size={14} /> {rotulo}
                </button>
              ))}
            </div>
          )}
          {!readOnly && <button onClick={adicionar} className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Plus size={15} /> Adicionar ensaio</button>}
          {rows.length > 0 && <button onClick={onExport} className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Download size={15} /> Baixar CSV</button>}
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-2">Uma linha por ensaio — preencha quando for possível durante a execução.</p>

      {rows.length === 0 ? <p className="text-sm text-slate-500 bg-slate-100 rounded-lg p-4">Clique em <b>Adicionar ensaio</b> para começar a preencher.</p>
        : modoTabela ? (
          <div className="overflow-auto rounded-lg border border-slate-200 max-h-[70vh]">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="bg-slate-100 sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-100 px-2 py-2 text-left font-semibold text-slate-500 w-10 min-w-10">#</th>
                  {colunas.map((i, k) => (
                    <th key={i.id} className={`px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap ${k === 0 && idItem ? "sticky left-10 z-30 bg-slate-100 border-r border-slate-200" : ""}`}>
                      {i.titulo}{i.unidade ? ` (${i.unidade})` : ""}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">O que foi feito</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const fundo = idx % 2 ? "bg-slate-50" : "bg-white";
                  return (
                    <tr key={idx} className={fundo}>
                      <td className={`sticky left-0 z-10 ${fundo} px-2 py-1.5 text-slate-400 align-top w-10 min-w-10`}>{idx + 1}</td>
                      {colunas.map((i, k) => (
                        <td key={i.id} className={`px-1 py-1.5 align-top ${k === 0 && idItem ? `sticky left-10 z-10 ${fundo} border-r border-slate-200` : ""} ${respostaDe(i) === "texto" && !ehIdentificador(i) ? "min-w-56" : respostaDe(i) === "hora" ? "min-w-40" : "min-w-36"}`}>
                          <Campo item={i} value={r[i.id]} onChange={val => onSetCell(idx, i.id, val)} disabled={readOnly} />
                        </td>
                      ))}
                      <td className="px-1 py-1.5 align-top min-w-56">
                        <textarea disabled={readOnly} value={r._obs ?? ""} onChange={e => onSetCell(idx, "_obs", e.target.value)} ref={ajustarAltura} onInput={autoGrow} rows={1} placeholder="O que foi feito, observações…" className={`${CAMPO} block resize-none`} />
                      </td>
                      <td className="px-1 align-top pt-1.5">{!readOnly && (confirmando === idx
                        ? <ConfirmarRemocao numero={idx + 1} onCancelar={() => setConfirmando(null)} onConfirmar={() => remover(idx)} />
                        : <button onClick={() => setConfirmando(idx)} title="Remover ensaio" className="text-slate-300 hover:text-rose-500 p-1 mt-1"><Trash2 size={15} /></button>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, idx) => {
              const aberto = !recolhidos.has(idx);
              const resumo = resumoDaLinha(colunas, r);
              const idValor = idItem ? (r[idItem.id] ?? "").toString().trim() : "";
              return (
                <div key={idx} ref={idx === rows.length - 1 ? ultimoCard : null} className="bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={() => alternar(idx)}>
                    <span className="shrink-0 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 tabular-nums">#{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      {idItem && <div className={`text-sm truncate ${idValor ? "font-semibold text-slate-800" : "text-slate-400"}`}>{idValor || `sem ${idItem.titulo}`}</div>}
                      {!aberto && resumo.length > 0 && <div className="text-xs text-slate-500 truncate tabular-nums">{resumo.join(" | ")}</div>}
                    </div>
                    {!readOnly && (confirmando === idx
                      ? <ConfirmarRemocao numero={idx + 1} onCancelar={() => setConfirmando(null)} onConfirmar={() => remover(idx)} />
                      : <button onClick={e => { e.stopPropagation(); setConfirmando(idx); }} title="Remover ensaio" className="shrink-0 text-slate-300 hover:text-rose-500 p-1.5"><Trash2 size={16} /></button>)}
                    <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
                  </div>
                  {aberto && (
                    <div className="border-t border-slate-100 p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {colunas.map(i => {
                        const htmlId = `planilha-${idx}-${i.id}`;
                        return (
                          <div key={i.id} className={`min-w-0 ${larguraNoCard(i)}`}>
                            <label htmlFor={htmlId} className="block text-xs font-medium text-slate-600 mb-1 truncate" title={i.titulo}>{i.titulo}{i.unidade ? ` (${i.unidade})` : ""}</label>
                            <Campo id={htmlId} item={i} value={r[i.id]} onChange={val => onSetCell(idx, i.id, val)} disabled={readOnly} />
                          </div>
                        );
                      })}
                      <div className="col-span-2 md:col-span-3 lg:col-span-4">
                        <label htmlFor={`planilha-${idx}-_obs`} className="block text-xs font-medium text-slate-600 mb-1">O que foi feito</label>
                        <textarea id={`planilha-${idx}-_obs`} disabled={readOnly} value={r._obs ?? ""} onChange={e => onSetCell(idx, "_obs", e.target.value)} ref={ajustarAltura} onInput={autoGrow} rows={2} placeholder="O que foi feito, observações…" className={`${CAMPO} block resize-none`} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!readOnly && (
              <button onClick={adicionar} className="w-full text-sm text-blue-700 hover:bg-blue-50 border border-dashed border-blue-200 rounded-xl py-3 flex items-center justify-center gap-1.5">
                <Plus size={15} /> Adicionar ensaio
              </button>
            )}
          </div>
        )}
    </section>
  );
}
