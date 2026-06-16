# Planejador de Experimentos — Hydrone

Aplicativo web (PWA) para **planejar, executar e analisar ensaios** dos veículos do projeto Hydrone (HAUV aéreo-subaquático e USV WhiteBoat). Guia o usuário por um fluxo de metodologia científica adaptado ao tipo de tarefa, roda a estatística adequada automaticamente e gera relatórios — tudo no navegador, sem servidor, com suporte offline.

Pensado para ser usado por uma equipe mista de pesquisadores e alunos de graduação: cada conceito tem explicação em linguagem simples e exemplos do próprio Hydrone.

---

## O que ele faz

O app separa o trabalho em **duas famílias**, porque elas seguem lógicas diferentes. Escolher a família certa na entrada evita misturar premissas (ex.: aplicar "delineamento" a um checklist de pré-voo).

### 1. Analisar dados de um ensaio

Você tem (ou vai coletar) medições e quer extrair estatística. Três modos:

| Modo | Pergunta que responde | Método |
|------|-----------------------|--------|
| **Comparar / otimizar** | Qual configuração é melhor? Faz diferença? | Delineamento aleatorizado + ANOVA de um fator (ou Kruskal–Wallis / qui-quadrado conforme o tipo de dado) |
| **Validar modelo** | A previsão do modelo bate com o medido? | Dispersão predito × medido, R² e RMSE contra a reta identidade |
| **Monitorar / observar** | Como a grandeza varia entre trechos de um log? | Estatística descritiva + teste de associação (observacional, sem inferência de causa) |

Recursos do fluxo de análise:

- **Plano de ensaios randomizado** a partir de fatores e níveis, com cálculo do número de ensaios e exportação em CSV.
- **Tipos de variável** com a análise correta embutida: quantitativa (média/DP/ANOVA), ordinal (mediana/Kruskal–Wallis), categórica (contagens/qui-quadrado) e evidência (registro descritivo, sem estatística).
- **Checagem de pressupostos**: teste de homogeneidade de variâncias (Levene) e gráfico de resíduos × ajustado.
- **Entrada de dados** digitada no app ou importada de CSV (upload ou colar).
- **Biblioteca de variáveis** com grandezas comuns do Hydrone (corrente, tensão, empuxo, profundidade, erro RMS, etc.), já com tipo e unidade.

### 2. Rodar um checklist / protocolo

Verificação de conformidade antes/depois do ensaio — não há estatística. Os checklists prontos vêm direto do **Guia de Experimentos HAUV** (Módulos M1 e M7):

- **Segurança** (ler e confirmar antes de armar)
- **Pré-ensaio — Estrutura mecânica**
- **Pré-ensaio — Sistema eletrônico**
- **Condições ambientais** (registro)
- **Pós-ensaio**

Você monta a sessão só com as seções relevantes (ex.: voo M2 = Segurança + Mecânica + Eletrônica + Ambiental) e/ou cria seções próprias. Cada item tem uma das três naturezas:

| Tipo | Vocabulário | Quando usar |
|------|-------------|-------------|
| **Verificação** | Passou / Falhou / N/A | Condição que se confere (hélices sem dano, fix de GPS) |
| **Tarefa** | Feito / Pendente / N/A | Ação do operador (backup de logs, lavar o veículo) |
| **Valor** | campo numérico + unidade | Registro (vento, temperatura, salinidade) |

O status global da sessão resume em quatro estados: **Concluído / Conforme**, **Reprovado** (falha em verificação), **Pendente** (tarefa não concluída) e **Incompleto**.

### Comum às duas famílias

- **Login local** por nome — cada pessoa retoma seu trabalho naquele navegador/dispositivo.
- **Salvar / carregar** análises e checklists; **templates** prontos.
- **Exportar** dados em CSV e o estado completo em JSON (e importar de volta).
- **Relatório** em PDF (via impressão do navegador) com metadados, resultados e referências.
- **PWA**: instalável e funciona offline.

---

## Stack

- **Vite** + **React 18**
- **Tailwind CSS v4**
- **vite-plugin-pwa** (service worker / instalação offline)
- **recharts** (gráficos), **lucide-react** (ícones), **papaparse** (CSV)

Toda a lógica vive em `src/App.jsx` (componente único, sem backend). Os métodos estatísticos — ANOVA, Kruskal–Wallis, qui-quadrado, distribuições F e qui² — são implementados do zero em JavaScript, sem dependência numérica externa.

---

## Rodando localmente

Requer Node.js (18+).

```bash
npm install      # instalar dependências
npm run dev      # servidor de desenvolvimento (Vite)
npm run build    # build de produção em dist/
npm run preview  # servir o build de produção localmente
```

> Confira os nomes exatos dos scripts no `package.json` do repositório, caso difiram.

---

## Deploy (Vercel)

O projeto está conectado ao Vercel com deploy automático a partir do GitHub.

```bash
# substitua o App.jsx do repositório pela versão nova, então:
git checkout main          # branch de produção
git pull
npm run build              # validar o build antes do push
git add src/App.jsx
git commit -m "descrição da mudança"
git push origin main       # dispara o deploy de produção
```

Para validar antes de promover: faça push em uma branch qualquer e use o **Preview URL** que o Vercel gera; dê merge em `main` quando estiver ok.

O `vite-plugin-pwa` está em modo de atualização automática; se algum usuário ficar preso numa versão antiga por causa do service worker em cache, um hard-reload resolve.

---

## Persistência dos dados

Hoje os dados ficam em **localStorage**, ou seja, presos ao navegador/dispositivo de cada pessoa. Não há sincronização entre dispositivos nem backup central.

**Próximo passo (em desenvolvimento):** backend para o time salvar os ensaios no **Google Drive**, via *Serverless Function* no Vercel (`/api/...`) — o segredo de autenticação fica no servidor, nunca no cliente. O localStorage permanece como cache offline e o Drive vira a camada de sincronização.

---

## Referências metodológicas

- Montgomery, D. C. (2017). *Design and Analysis of Experiments* (9ª ed.). Wiley.
- Fisher, R. A. (1935). *The Design of Experiments*. Oliver & Boyd.
- Stevens, S. S. (1946). *On the Theory of Scales of Measurement*. Science.
- NIST/SEMATECH (2012). *e-Handbook of Statistical Methods* (Handbook 151).

Checklists baseados no Guia de Experimentos HAUV (protótipos de referência Nezha-IV, Nezha-H e Nezha-Morphing).

---

## Estrutura (referência)

```
.
├── index.html
├── package.json
├── vite.config.js          # Vite + plugin React + PWA
├── public/                 # ícones do PWA, manifest
└── src/
    ├── main.jsx            # ponto de entrada
    └── App.jsx             # aplicação completa (UI + lógica + estatística)
```

> Uso interno · Projeto Hydrone.
