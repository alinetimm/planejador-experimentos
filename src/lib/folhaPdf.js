// Gera o PDF da folha de campo a partir do mesmo HTML usado na impressão.
//
// O navegador não expõe o próprio "Salvar como PDF" para o código, então a folha
// é desenhada com html2canvas e montada em páginas A4 com jsPDF. O texto vira
// imagem (não dá para selecionar no PDF), mas o visual é o mesmo da impressão.
// As bibliotecas só são baixadas quando um PDF é gerado.

const PX_POR_MM = 96 / 25.4;
const RETRATO = { formato: "portrait", larguraMm: 210, alturaMm: 297, margemMm: 14 };
const PAISAGEM = { formato: "landscape", larguraMm: 297, alturaMm: 210, margemMm: 10 };

// Blocos que não podem ser cortados entre duas páginas. Os maiores que uma página
// inteira são ignorados (não há como evitar o corte), e aí valem os de dentro.
const INDIVISIVEIS = ".fs-grupo, .fs-texto, .fs-item, .fs-obs, .fs-assin-bloco, .fs-assinaturas, tr, p, h1, h3, li, table.meta";

async function abrirEmIframe(html, larguraPx) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${larguraPx}px;height:1000px;border:0;visibility:hidden`;
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open(); doc.write(html); doc.close();
  // A largura útil da página é a do iframe: sem margem nem largura máxima da versão de tela.
  const ajuste = doc.createElement("style");
  ajuste.textContent = "html,body{margin:0!important;padding:0!important;max-width:none!important;background:#fff}";
  doc.head.appendChild(ajuste);
  await Promise.all([...doc.images].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
  await doc.fonts?.ready;
  return { iframe, doc };
}

/** Posições (px) onde dá para virar a página sem cortar um bloco indivisível. */
function pontosDeQuebra(doc, alturaPaginaPx) {
  const blocos = [...doc.querySelectorAll(INDIVISIVEIS)]
    .map(el => { const r = el.getBoundingClientRect(); return { topo: r.top, base: r.bottom }; })
    .filter(b => b.base - b.topo > 0 && b.base - b.topo < alturaPaginaPx);
  const candidatos = new Set();
  for (const b of blocos) { candidatos.add(Math.floor(b.topo)); candidatos.add(Math.ceil(b.base)); }
  return [...candidatos].filter(y => !blocos.some(b => b.topo < y - 1 && y + 1 < b.base)).sort((a, b) => a - b);
}

function fatiar(alturaTotal, alturaPagina, pontos) {
  const fatias = [];
  let inicio = 0;
  while (inicio < alturaTotal - 1) {
    const limite = inicio + alturaPagina;
    let fim = alturaTotal;
    if (limite < alturaTotal) {
      // Página muito curta deixa buraco em branco; abaixo de 40% da altura, corta no limite.
      const melhor = pontos.filter(y => y > inicio + alturaPagina * 0.4 && y <= limite).pop();
      fim = melhor ?? limite;
    }
    fatias.push([inicio, fim]);
    inicio = fim;
  }
  return fatias;
}

async function desenharSecao(pdf, html2canvas, html, pagina, primeira) {
  const larguraUtilMm = pagina.larguraMm - 2 * pagina.margemMm;
  const alturaUtilMm = pagina.alturaMm - 2 * pagina.margemMm;
  const larguraPx = Math.round(larguraUtilMm * PX_POR_MM);
  const alturaPaginaPx = Math.floor(alturaUtilMm * PX_POR_MM);
  const { iframe, doc } = await abrirEmIframe(html, larguraPx);
  try {
    const alturaTotal = Math.ceil(doc.documentElement.scrollHeight);
    const fatias = fatiar(alturaTotal, alturaPaginaPx, pontosDeQuebra(doc, alturaPaginaPx));
    for (let i = 0; i < fatias.length; i++) {
      const [ini, fim] = fatias[i];
      // Uma fatia por vez: um canvas único da folha inteira estoura o limite de
      // memória de canvas do Safari no iPhone.
      const canvas = await html2canvas(doc.documentElement, {
        x: 0, y: ini, width: larguraPx, height: fim - ini,
        windowWidth: larguraPx, windowHeight: alturaTotal,
        scale: 2, backgroundColor: "#ffffff", logging: false,
      });
      if (!(primeira && i === 0)) pdf.addPage("a4", pagina.formato);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG",
        pagina.margemMm, pagina.margemMm, larguraUtilMm, (fim - ini) / PX_POR_MM, undefined, "FAST");
    }
  } finally {
    iframe.remove();
  }
}

/**
 * @param {string} html documento completo devolvido por buildReportHTML()
 * @returns {Promise<Blob>} PDF A4; a planilha (.fs-paisagem) sai em páginas deitadas
 */
export async function gerarPdfFolha(html) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  // Como na impressão: retrato até a planilha, a planilha deitada e, depois dela,
  // de volta ao retrato (observações e assinaturas). Cada trecho vira uma seção.
  const modelo = new DOMParser().parseFromString(html, "text/html");
  const secoes = [];
  for (const no of [...modelo.body.childNodes]) {
    const pagina = no.nodeType === 1 && no.matches(".fs-paisagem") ? PAISAGEM : RETRATO;
    if (secoes.at(-1)?.pagina !== pagina) secoes.push({ pagina, nos: [] });
    secoes.at(-1).nos.push(no);
  }

  const comConteudo = secoes.filter(s => s.nos.some(n => n.nodeType === 1 || n.textContent.trim()));
  if (!comConteudo.length) throw new Error("a folha de campo está vazia.");

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: comConteudo[0].pagina.formato, compress: true });
  for (let i = 0; i < comConteudo.length; i++) {
    const { pagina, nos } = comConteudo[i];
    const doc = modelo.cloneNode(false);
    doc.appendChild(modelo.documentElement.cloneNode(false));
    doc.documentElement.append(modelo.head.cloneNode(true), modelo.createElement("body"));
    doc.body.append(...nos.map(n => n.cloneNode(true)));
    // A quebra de página antes da planilha já é feita pelo addPage.
    doc.querySelectorAll(".fs-paisagem").forEach(s => { s.style.breakBefore = "auto"; s.style.pageBreakBefore = "auto"; });
    await desenharSecao(pdf, html2canvas, "<!doctype html>" + doc.documentElement.outerHTML, pagina, i === 0);
  }
  return pdf.output("blob");
}
