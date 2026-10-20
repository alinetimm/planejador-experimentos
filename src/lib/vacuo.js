/**
 * lib/vacuo.js — Teste de vácuo da cápsula (detecção de vazamento)
 * ================================================================
 * Procedimento: a cápsula é evacuada até uma leitura de vácuo inicial, a bomba
 * é isolada e a leitura é repetida após `tempoDecorridoMinutos` (padrão 10).
 *
 * Convenção de sinal — IMPORTANTE
 * -------------------------------
 * As pressões são registradas como MAGNITUDE DE VÁCUO em mmHg (quanto abaixo da
 * atmosfera), que é como o vacuômetro analógico do laboratório é lido. Logo:
 *
 *     quedaPressao = pressaoInicial - pressaoFinal
 *
 * e `queda > 0` significa PERDA de vácuo, isto é, ar entrando na cápsula. Uma
 * queda negativa (vácuo "aumentou") não é fisicamente esperada em sistema
 * isolado; é sinalizada como leitura suspeita em vez de ser lida como aprovação.
 *
 * Critério: a estanqueidade é aprovada enquanto a queda não exceder
 * `limiteQueda` no intervalo declarado. O limite é por experimento porque
 * depende do volume interno da cápsula e da classe do vacuômetro.
 */

export const UNIDADE_PRESSAO = "mmHg";

/** Tolerância padrão: 10 mmHg em 10 min. Ajustável por experimento. */
export const LIMITE_QUEDA_PADRAO = 10;
export const TEMPO_PADRAO_MIN = 10;

export const VACUO_DEF = {
  realizado: false,            // a seção foi efetivamente executada neste ensaio
  pressaoInicial: "",          // mmHg (string no formulário; número ao ler)
  pressaoFinal: "",            // mmHg após tempoDecorridoMinutos
  tempoDecorridoMinutos: TEMPO_PADRAO_MIN,
  limiteQueda: LIMITE_QUEDA_PADRAO,
  cronometroIniciadoEm: null,  // epoch ms — permite recuperar a contagem após re-render/reload
  observacoes: "",
  responsavel: "",
};

/** Converte entrada de formulário em número, tolerando vírgula decimal. */
export const num = (v) => {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(",", ".");
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** ΔP em mmHg, ou null enquanto uma das leituras não existir. */
export function quedaPressao(v) {
  const pi = num(v?.pressaoInicial);
  const pf = num(v?.pressaoFinal);
  if (!Number.isFinite(pi) || !Number.isFinite(pf)) return null;
  return pi - pf;
}

/**
 * Status da estanqueidade.
 * "pendente"  — faltam leituras
 * "aprovado"  — 0 <= ΔP <= limite
 * "reprovado" — ΔP > limite (vazamento)
 * "suspeito"  — ΔP < 0 (ganho de vácuo: leitura ou procedimento inconsistente)
 */
export function statusEstanqueidade(v) {
  const d = quedaPressao(v);
  if (d === null) return "pendente";
  const limite = Number.isFinite(num(v?.limiteQueda)) ? num(v.limiteQueda) : LIMITE_QUEDA_PADRAO;
  if (d < 0) return "suspeito";
  return d > limite ? "reprovado" : "aprovado";
}

/** Booleano exigido no payload: houve vazamento detectado? */
export function vazamentoDetectado(v) {
  return statusEstanqueidade(v) === "reprovado";
}

export const ROTULO_STATUS = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  suspeito: "Leitura inconsistente",
};

/**
 * Objeto normalizado que vai para o Firestore. Números são gravados como
 * números (a planilha e os filtros dependem disso), nunca como string.
 */
export function normalizarVacuo(v) {
  if (!v) return null;
  const base = { ...VACUO_DEF, ...v };
  const pi = num(base.pressaoInicial);
  const pf = num(base.pressaoFinal);
  const queda = quedaPressao(base);
  return {
    realizado: !!base.realizado,
    pressaoInicial: Number.isFinite(pi) ? pi : null,
    pressaoFinal: Number.isFinite(pf) ? pf : null,
    quedaPressao: queda,
    unidade: UNIDADE_PRESSAO,
    tempoDecorridoMinutos: Number.isFinite(num(base.tempoDecorridoMinutos)) ? num(base.tempoDecorridoMinutos) : TEMPO_PADRAO_MIN,
    limiteQueda: Number.isFinite(num(base.limiteQueda)) ? num(base.limiteQueda) : LIMITE_QUEDA_PADRAO,
    vazamentoDetectado: vazamentoDetectado(base),
    statusEstanqueidade: statusEstanqueidade(base),
    observacoes: base.observacoes || "",
    responsavel: base.responsavel || "",
  };
}

/* ───────────────────────── Renomeação do experimento ─────────────────────────
 * "Veículo Hydrone-J em campo" → "Experimento de campo".
 *
 * O id da categoria ("veiculo") NÃO muda: é ele que está gravado nos bundles e
 * no campo `modo` dos documentos já salvos no Firestore. Só o rótulo de exibição
 * muda, em CATEGORIAS (src/lib/requisitos.js), e toda a UI o lê via
 * categoriaMeta(id).label — portanto experimentos antigos passam a exibir o nome
 * novo sem migração de dados.
 *
 * O mapa abaixo cobre o caso em que algum bundle antigo tenha gravado um id
 * diferente para a mesma categoria (ex.: salvo antes de "veiculo" existir).
 */
export const CATEGORIA_LEGADA = {
  veiculo_hydrone_j: "veiculo",
  hydrone_j: "veiculo",
  veiculo_campo: "veiculo",
};

export const ID_CATEGORIA_CAMPO = "veiculo";

/** Normaliza o id de categoria vindo de um bundle salvo. */
export const migrarCategoria = (id) => CATEGORIA_LEGADA[id] || id;

/** O teste de vácuo só se aplica ao Experimento de campo (pré-check antes da água). */
export const exigeTesteVacuo = (categoriaId) => migrarCategoria(categoriaId) === ID_CATEGORIA_CAMPO;
