import { useEffect, useState } from "react";
import { Timer, Play, RotateCcw, ShieldCheck, ShieldAlert, ShieldQuestion, Droplets } from "lucide-react";
import {
  VACUO_DEF, UNIDADE_PRESSAO, quedaPressao, statusEstanqueidade, ROTULO_STATUS, num,
} from "./lib/vacuo";

const CORES = {
  aprovado:  { card: "border-emerald-200 bg-emerald-50/40", pill: "bg-emerald-600 text-white",  Icone: ShieldCheck },
  reprovado: { card: "border-rose-300 bg-rose-50/60",        pill: "bg-rose-600 text-white",     Icone: ShieldAlert },
  suspeito:  { card: "border-amber-300 bg-amber-50/50",      pill: "bg-amber-500 text-white",    Icone: ShieldQuestion },
  pendente:  { card: "border-slate-200 bg-white",            pill: "bg-slate-200 text-slate-600", Icone: ShieldQuestion },
};

const mmss = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/**
 * Teste de vácuo da cápsula — seção acoplada ao Experimento de campo.
 * Pré-check de bancada: evacuar, isolar a bomba, reler após 10 min.
 *
 * Por decisão de projeto, reprovar NÃO bloqueia o fluxo: o status fica visível
 * aqui, na folha de campo e na lista de experimentos do time, e o operador
 * segue preenchendo (mesmo comportamento do "Falhou" do checklist).
 */
export default function TesteVacuo({ valor, onChange, readOnly = false }) {
  const v = { ...VACUO_DEF, ...(valor || {}) };
  const set = (patch) => !readOnly && onChange({ ...v, ...patch });

  const status = statusEstanqueidade(v);
  const delta = quedaPressao(v);
  const { card, pill, Icone } = CORES[status];

  // ── Cronômetro regressivo ──────────────────────────────────────────────
  // A contagem deriva do instante de início gravado no estado, não de um
  // contador em memória: sobrevive a re-render, troca de tela e reload.
  const totalSeg = Math.round((Number.isFinite(num(v.tempoDecorridoMinutos)) ? num(v.tempoDecorridoMinutos) : 10) * 60);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!v.cronometroIniciadoEm) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [v.cronometroIniciadoEm]);

  const decorrido = v.cronometroIniciadoEm ? Math.floor((agora - v.cronometroIniciadoEm) / 1000) : 0;
  const restante = v.cronometroIniciadoEm ? totalSeg - decorrido : totalSeg;
  const rodando = !!v.cronometroIniciadoEm && restante > 0;
  const terminou = !!v.cronometroIniciadoEm && restante <= 0;
  const progresso = v.cronometroIniciadoEm ? Math.min(100, (decorrido / totalSeg) * 100) : 0;

  return (
    <section className={`rounded-xl border-2 p-4 transition ${card}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
          <Droplets size={15} className="text-blue-700" />
          Teste de vácuo da cápsula ({v.tempoDecorridoMinutos} min)
        </h2>
        <span className={`text-xs font-bold rounded-full px-2.5 py-1 flex items-center gap-1.5 ${pill}`}>
          <Icone size={13} /> {ROTULO_STATUS[status]}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Pré-check de estanqueidade antes de ir para a água. Evacue a cápsula, isole a bomba, anote a
        leitura inicial, aguarde {v.tempoDecorridoMinutos} min e releia. Valores em magnitude de vácuo ({UNIDADE_PRESSAO}).
      </p>

      <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
        <input type="checkbox" disabled={readOnly} checked={!!v.realizado} onChange={e => set({ realizado: e.target.checked })} />
        Teste de vácuo executado neste ensaio
      </label>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500 font-medium">Pressão inicial ({UNIDADE_PRESSAO})</label>
          <input type="number" inputMode="decimal" step="any" disabled={readOnly}
            value={v.pressaoInicial} onChange={e => set({ pressaoInicial: e.target.value })}
            placeholder="ex.: 250"
            className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium">Pressão final ({UNIDADE_PRESSAO})</label>
          <input type="number" inputMode="decimal" step="any" disabled={readOnly}
            value={v.pressaoFinal} onChange={e => set({ pressaoFinal: e.target.value })}
            placeholder={`após ${v.tempoDecorridoMinutos} min`}
            className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium">Queda tolerada ({UNIDADE_PRESSAO})</label>
          <input type="number" inputMode="decimal" step="any" disabled={readOnly}
            value={v.limiteQueda} onChange={e => set({ limiteQueda: e.target.value })}
            className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400" />
        </div>
      </div>

      {/* ΔP em tempo real */}
      <div className="mt-3 flex items-baseline gap-3 flex-wrap bg-white/70 border border-slate-200 rounded-lg px-3 py-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Queda de pressão</span>
        <span className={`text-xl font-bold tabular-nums ${status === "reprovado" ? "text-rose-700" : status === "aprovado" ? "text-emerald-700" : "text-slate-400"}`}>
          {delta === null ? "—" : `ΔP = ${delta.toFixed(1)} ${UNIDADE_PRESSAO}`}
        </span>
        {delta !== null && (
          <span className="text-xs text-slate-500">
            em {v.tempoDecorridoMinutos} min · limite {num(v.limiteQueda)} {UNIDADE_PRESSAO}
          </span>
        )}
      </div>
      {status === "reprovado" && (
        <p className="mt-2 text-sm bg-rose-100 text-rose-900 rounded-lg px-3 py-2">
          Vazamento detectado: a queda excede a tolerância. Reinspecione o-rings, passagens de cabo e
          o fechamento da cápsula antes de levar o veículo à água.
        </p>
      )}
      {status === "suspeito" && (
        <p className="mt-2 text-sm bg-amber-100 text-amber-900 rounded-lg px-3 py-2">
          A leitura final indica vácuo maior que o inicial. Em sistema isolado isso não é esperado —
          confira a unidade, a escala do vacuômetro e se a bomba foi de fato isolada.
        </p>
      )}

      {/* Cronômetro de 10 min */}
      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Timer size={16} className={terminou ? "text-emerald-600" : "text-slate-400"} />
          <span className={`text-2xl font-bold tabular-nums ${terminou ? "text-emerald-700" : rodando ? "text-blue-800" : "text-slate-400"}`}>
            {mmss(restante)}
          </span>
          {!rodando && !terminou && (
            <button disabled={readOnly} onClick={() => { setAgora(Date.now()); set({ cronometroIniciadoEm: Date.now() }); }}
              className="text-sm bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Play size={14} /> Iniciar contagem
            </button>
          )}
          {(rodando || terminou) && (
            <button disabled={readOnly} onClick={() => set({ cronometroIniciadoEm: null })}
              className="text-sm bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <RotateCcw size={14} /> Reiniciar
            </button>
          )}
          {terminou && <span className="text-sm font-semibold text-emerald-700">Tempo cumprido — faça a releitura.</span>}
        </div>
        <div className="h-1.5 mt-2 rounded-full bg-slate-200 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${terminou ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: `${progresso}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          A contagem usa o horário de início, então continua correta se você trocar de tela ou recarregar o app.
        </p>
      </div>

      <div className="mt-3">
        <label className="text-xs text-slate-500 font-medium">Observações do teste</label>
        <textarea disabled={readOnly} value={v.observacoes} onChange={e => set({ observacoes: e.target.value })}
          placeholder="ex.: o-ring da tampa traseira substituído antes do teste"
          className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 h-16" />
      </div>
    </section>
  );
}
