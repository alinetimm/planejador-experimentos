// Folha de campo em PDF: o registro do ensaio que vai para o Drive e para download.
//
// Montado com texto e tabelas do jsPDF (não é imagem): o texto é nítido e
// pesquisável, a tabela quebra de página sem cortar linha e repete o cabeçalho.
// A folha não é mais preenchida à mão, então não há linhas em branco para caneta —
// só o que foi registrado no app. As bibliotecas só são baixadas ao gerar.

const AZUL = [30, 64, 175];
const AZUL_CLARO = [239, 246, 255];
const CINZA = [100, 116, 139];
const CINZA_CLARO = [241, 245, 249];
const TEXTO = [30, 41, 59];
const VERDE = [4, 120, 87];
const VERMELHO = [190, 18, 60];
const MARGEM = 12;

// A Helvetica embutida no PDF só cobre o conjunto WinAnsi (acentos do português,
// travessões, aspas). O que estiver fora vira equivalente em texto ou some, em vez
// de sair como caractere quebrado.
const EQUIVALENTES = { "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "≠": "!=", "≈": "~", "Δ": "Delta ", "✓": "OK" };
const WIN_ANSI_EXTRA = new Set([0x152, 0x153, 0x160, 0x161, 0x178, 0x17d, 0x17e, 0x192, 0x2c6, 0x2dc, 0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122]);
const t = (s) => [...String(s ?? "")]
  .map(ch => EQUIVALENTES[ch] ?? ch)
  .join("")
  .replace(/[^\n\t\x20-\x7e\xa0-\xff]/gu, ch => (WIN_ANSI_EXTRA.has(ch.codePointAt(0)) ? ch : ""));

const dataBR = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : t(iso); };

async function carregarLogo() {
  try {
    const blob = await (await fetch("/hydrone-mark.png")).blob();
    return await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(blob); });
  } catch { return null; }
}

const COR_ESTADO = { ok: VERDE, falha: VERMELHO, vazio: CINZA, neutro: TEXTO };

/**
 * @param {object} d dados da folha, montados por dadosFolha() no App:
 *   { titulo, categoria, modo, descricao, responsavel, data, local, equipamento, notas,
 *     resumo: { verificados, total, falhas, medidas, ensaios },
 *     vacuo: null | { realizado, inicial, final, minutos, queda, limite, status, statusId, obs },
 *     checklist: [{ titulo, fonte, itens: [{ titulo, valor, estado: "ok"|"falha"|"vazio"|"neutro" }] }],
 *     planilha: null | { colunas: string[], linhas: { valores: string[], obs: string }[] },
 *     assinaturas: { montou, preencheu }, geradoEm }
 * @returns {Promise<Blob>}
 */
export async function gerarPdfFolha(d) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), carregarLogo()]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  doc.setProperties({ title: t(`Folha de Campo — ${d.titulo}`), creator: "Planejador de Experimentos Hydrone" });
  const largura = () => doc.internal.pageSize.getWidth();
  const altura = () => doc.internal.pageSize.getHeight();
  let y = MARGEM;

  const cabe = (mm) => { if (y + mm > altura() - MARGEM - 6) { doc.addPage("a4", "portrait"); y = MARGEM; } };
  const secao = (titulo) => {
    cabe(14);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...AZUL);
    doc.text(t(titulo).toUpperCase(), MARGEM, y);
    y += 2.5;
  };
  const tabela = (opcoes) => {
    autoTable(doc, {
      startY: y, margin: { left: MARGEM, right: MARGEM, bottom: MARGEM + 6 },
      styles: { font: "helvetica", fontSize: 8.5, textColor: TEXTO, cellPadding: { top: 1.4, bottom: 1.4, left: 2, right: 2 }, lineColor: [226, 232, 240], lineWidth: 0.2, overflow: "linebreak" },
      headStyles: { fillColor: CINZA_CLARO, textColor: TEXTO, fontStyle: "bold", fontSize: 8 },
      rowPageBreak: "avoid",
      ...opcoes,
    });
    y = doc.lastAutoTable.finalY + 2;
  };

  // Cabeçalho
  if (logo) doc.addImage(logo, "PNG", MARGEM, y - 1, 9, 9);
  const xTitulo = MARGEM + (logo ? 11 : 0);
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...AZUL).text("Folha de Campo", xTitulo, y + 4.5);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA).text(dataBR(d.data), largura() - MARGEM, y + 4.5, { align: "right" });
  y += 11;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TEXTO);
  const linhasTitulo = doc.splitTextToSize(t(d.titulo), largura() - 2 * MARGEM);
  doc.text(linhasTitulo, MARGEM, y);
  y += linhasTitulo.length * 4.6;
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA).text(t([d.categoria, d.modo].filter(Boolean).join(" · ")), MARGEM, y);
  y += 2.5;
  doc.setDrawColor(...AZUL).setLineWidth(0.5).line(MARGEM, y, largura() - MARGEM, y);
  y += 3;

  // Dados do ensaio, em duas colunas de pares rótulo/valor
  const pares = [["Responsável", d.responsavel], ["Data", dataBR(d.data)], ["Local", d.local], ["Equipamento", d.equipamento]].filter(([, v]) => v);
  const linhasInfo = [];
  for (let i = 0; i < pares.length; i += 2) linhasInfo.push([...pares[i], ...(pares[i + 1] || ["", ""])].map(t));
  if (d.descricao) linhasInfo.push([t("Descrição"), { content: t(d.descricao), colSpan: 3 }]);
  const r = d.resumo;
  linhasInfo.push([t("Resumo"), { content: t(`${r.verificados}/${r.total} itens verificados${r.falhas ? ` · ${r.falhas} ${r.falhas === 1 ? "falhou" : "falharam"}` : ""} · ${r.medidas} ${r.medidas === 1 ? "medida" : "medidas"} · ${r.ensaios} ${r.ensaios === 1 ? "ensaio" : "ensaios"}`), colSpan: 3, styles: { fontStyle: "bold" } }]);
  tabela({
    body: linhasInfo, theme: "plain",
    styles: { fontSize: 8.5, textColor: TEXTO, cellPadding: { top: 0.9, bottom: 0.9, left: 0, right: 2 } },
    columnStyles: { 0: { textColor: CINZA, cellWidth: 24 }, 2: { textColor: CINZA, cellWidth: 24 } },
  });

  // Teste de vácuo
  if (d.vacuo) {
    const v = d.vacuo;
    secao("Teste de vácuo da cápsula");
    const corStatus = v.statusId === "aprovado" ? VERDE : v.statusId === "reprovado" ? VERMELHO : v.statusId === "suspeito" ? [180, 83, 9] : CINZA;
    tabela({
      head: [["Executado", "Pressão inicial", `Pressão final (${t(v.minutos)} min)`, "Queda de pressão", "Tolerância", "Estanqueidade"].map(t)],
      body: [[v.realizado ? "Sim" : "Não", v.inicial || "—", v.final || "—", v.queda || "—", v.limite, { content: t(v.status), styles: { fontStyle: "bold", textColor: corStatus } }].map(c => (typeof c === "string" ? t(c) : c))],
    });
    if (v.obs) {
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TEXTO);
      const linhas = doc.splitTextToSize(t(`Observações: ${v.obs}`), largura() - 2 * MARGEM);
      cabe(linhas.length * 3.8);
      doc.text(linhas, MARGEM, y + 2.5);
      y += linhas.length * 3.8 + 1;
    }
  }

  // Checklist: um bloco por linha de grupo, itens com o resultado ao lado
  if (d.checklist.length) {
    secao("Checklist");
    const corpo = [];
    for (const g of d.checklist) {
      corpo.push([{ content: t(g.fonte ? `${g.titulo}  ·  ${g.fonte}` : g.titulo), colSpan: 2, styles: { fillColor: AZUL_CLARO, textColor: AZUL, fontStyle: "bold" } }]);
      for (const it of g.itens) {
        corpo.push([t(it.titulo), { content: t(it.valor || "—"), styles: { textColor: COR_ESTADO[it.estado] || TEXTO, fontStyle: it.estado === "falha" || it.estado === "ok" ? "bold" : "normal" } }]);
      }
    }
    tabela({ head: [["Item", "Resultado"]], body: corpo, columnStyles: { 1: { cellWidth: 48 } } });
  }

  // Planilha de campo: só as linhas registradas, com "O que foi feito" na própria tabela
  if (d.planilha) {
    const { colunas, linhas } = d.planilha;
    const temObs = linhas.some(l => l.obs);
    const nCols = colunas.length + 1 + (temObs ? 1 : 0);
    // Com muitas colunas a tabela não cabe legível em retrato: ganha página deitada.
    const deitar = nCols > 7 && linhas.length > 0;
    if (deitar) { doc.addPage("a4", "landscape"); y = MARGEM; }
    secao("Planilha de campo");
    if (!linhas.length) {
      doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(...CINZA).text("Nenhum ensaio registrado.", MARGEM, y + 3);
      y += 6;
    } else {
      tabela({
        head: [["#", ...colunas, ...(temObs ? ["O que foi feito"] : [])].map(t)],
        body: linhas.map((l, i) => [String(i + 1), ...l.valores, ...(temObs ? [l.obs] : [])].map(t)),
        styles: { fontSize: nCols > 9 ? 7 : 8, textColor: TEXTO, cellPadding: 1.3, lineColor: [203, 213, 225], lineWidth: 0.2, overflow: "linebreak" },
        headStyles: { fillColor: CINZA_CLARO, textColor: TEXTO, fontStyle: "bold", fontSize: nCols > 9 ? 6.8 : 7.5 },
        columnStyles: { 0: { cellWidth: 7, halign: "center", textColor: CINZA }, ...(temObs ? { [nCols - 1]: { cellWidth: deitar ? 60 : 45 } } : {}) },
      });
    }
    if (deitar) { doc.addPage("a4", "portrait"); y = MARGEM; }
  }

  if (d.notas) {
    secao("Observações");
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TEXTO);
    const linhas = doc.splitTextToSize(t(d.notas), largura() - 2 * MARGEM);
    cabe(linhas.length * 3.8);
    doc.text(linhas, MARGEM, y + 2.5);
    y += linhas.length * 3.8 + 1;
  }

  // Assinaturas: nome impresso e uma linha curta, lado a lado
  secao("Assinaturas");
  cabe(16);
  const metade = (largura() - 2 * MARGEM - 8) / 2;
  [["Montou o checklist", d.assinaturas.montou], ["Preencheu o checklist", d.assinaturas.preencheu]].forEach(([rotulo, nome], i) => {
    const x = MARGEM + i * (metade + 8);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA).text(t(rotulo), x, y + 3);
    doc.setFontSize(9).setTextColor(...TEXTO).text(t(nome || ""), x, y + 7.5);
    doc.setDrawColor(148, 163, 184).setLineWidth(0.2).line(x, y + 13, x + metade, y + 13);
    doc.setFontSize(6.5).setTextColor(...CINZA).text("Assinatura", x, y + 15.5);
  });
  y += 17;

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const w = largura(), h = altura();
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...CINZA);
    const [rodape, ...resto] = doc.splitTextToSize(t(`Folha de Campo · ${d.titulo}`), w / 2);
    doc.text(resto.length ? `${rodape.replace(/\s*\S*$/, "")}…` : rodape, MARGEM, h - 6);
    doc.text(t(`Gerado em ${d.geradoEm} · Página ${p} de ${total}`), w - MARGEM, h - 6, { align: "right" });
  }
  return doc.output("blob");
}
