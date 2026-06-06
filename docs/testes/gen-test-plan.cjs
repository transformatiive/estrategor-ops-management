/* Gera o plano de testes da Plataforma Estrategor em Excel (exceljs).
 * Correr a partir da raiz do repo:  node docs/testes/gen-test-plan.cjs
 * (resolve o exceljs a partir do node_modules da app/api, onde é dependência). */
const path = require("path");
const repoRoot = path.join(__dirname, "..", "..");
const ExcelJS = require(require.resolve("exceljs", { paths: [path.join(repoRoot, "apps/api")] }));

// ---------------------------------------------------------------------------
// Dados do plano: sequência de teste por jornada real do consultor.
// Colunas dos casos: fase, ticket, modulo, cenario, passos, esperado, dados
// ---------------------------------------------------------------------------
const F1 = "1 · Acesso e Navegação";
const F2 = "2 · Cliente, Projeto e Pipeline";
const F3 = "3 · Diagnóstico A0";
const F4 = "4 · WorkDrive e Recolha";
const F5 = "5 · Candidatura (A2)";
const F6 = "6 · Exportação e Revisão";

const casos = [
  // FASE 0 — ambiente
  ["0 · Ambiente", "—", "Deploy / Railway", "Aplicação online",
    "Abrir o URL de produção da app.",
    "O ecrã de login carrega sem erro (deploy verde). Se não carregar, confirmar o último deploy no Railway e a variável NODE_ENV.",
    "URL de produção; último deploy Railway verde."],

  // FASE 1 — Acesso (934)
  [F1, "TRNSF-934", "Acesso e Utilizadores", "Login válido",
    "Introduzir email + password de um utilizador ativo e submeter.",
    "Entra no Dashboard. A sessão persiste ao recarregar a página (cookie httpOnly).",
    "1 utilizador gestor + 1 consultor (perfil padrão)."],
  [F1, "TRNSF-934", "Acesso e Utilizadores", "Login inválido",
    "Introduzir credenciais erradas.",
    "Mensagem de erro clara; não entra; não revela se o email existe.",
    "—"],
  [F1, "TRNSF-934", "Acesso e Utilizadores", "Gestão de utilizadores (gestor)",
    "Como gestor: criar utilizador, editar, desativar e fazer reset de password.",
    "Operações refletem-se na lista; cada ação fica registada na atividade. Utilizador desativado não consegue entrar.",
    "Sessão de gestor."],
  [F1, "TRNSF-934", "Acesso e Utilizadores", "RBAC — consultor",
    "Entrar como consultor (perfil padrão) e observar a navegação.",
    "Não vê a gestão de Utilizadores; vê apenas os seus próprios projetos nas listagens e no dashboard.",
    "Sessão de consultor."],

  // FASE 1 — Navegação (966)
  [F1, "TRNSF-966", "Navegação lateral", "Sidebar limpa",
    "Observar a navegação lateral.",
    "Não existe o grupo 'Programas' (PT2030/Formação/Fiscal) nem 'Definições'. Existe GERAL (Dashboard, Projectos, Prazos, Tarefas) e Clientes (+ Utilizadores se gestor).",
    "—"],

  // FASE 1 — Dashboard (964)
  [F1, "TRNSF-964", "Dashboard de Trabalho", "Secções por ação",
    "Abrir o Dashboard.",
    "Mostra secções por ação: 'À minha espera', 'A aguardar cliente', 'Carteira por fase'. Não há contadores de 'estado da API/uptime'. Saudação com a tese do dia.",
    "Pelo menos 2-3 projetos em fases diferentes."],
  [F1, "TRNSF-964", "Dashboard de Trabalho", "Ação concreta + navegação",
    "Na secção 'À minha espera', ler o 'que falta' de uma linha e clicar.",
    "Cada linha indica o que falta em concreto (ex.: validar financeira, X campos por preencher). Clicar abre a fase certa do projeto.",
    "Projeto com pendências."],
  [F1, "TRNSF-964", "Dashboard de Trabalho", "Filtro por consultor (gestor)",
    "Como gestor, filtrar o dashboard por consultor.",
    "Gestor vê a carteira toda e pode filtrar por consultor; consultor vê só a sua.",
    "Sessão de gestor + projetos de >1 consultor."],

  // FASE 2 — Criar projeto (935)
  [F2, "TRNSF-935", "Base / Criar projeto", "Criar projeto com responsável",
    "Criar projeto novo: cliente, NIF, programa, família e consultor responsável.",
    "Aparece na lista com a fase inicial (Diagnóstico) em linguagem de cliente. O responsável escolhido fica associado e influencia filtros/dashboard.",
    "NIF real de empresa PT para o pré-diagnóstico."],
  [F2, "TRNSF-935", "Base / Estados", "Máquina de estados",
    "Observar a fase do projeto e (onde permitido) a transição.",
    "As fases seguem Diagnóstico → Recolha → Preparação → Revisão → Submissão; sem códigos A0-A4 na interface; transições governadas pelos pré-requisitos.",
    "—"],

  // FASE 2 — Pré-diagnóstico (967)
  [F2, "TRNSF-967", "Pré-diagnóstico IA", "Disparo em segundo plano",
    "Criar projeto com NIF válido e observar o ecrã.",
    "A criação não bloqueia; o pré-diagnóstico corre em segundo plano. Ao reabrir o Diagnóstico passados segundos, os campos aparecem pré-preenchidos com proveniência.",
    "OPENROUTER_API_KEY e NIF_PT_API_KEY ativas no Railway."],
  [F2, "TRNSF-967", "Pré-diagnóstico IA", "Faixa A — VIES",
    "Verificar nome e morada no pré-diagnóstico.",
    "Nome e morada oficiais preenchidos como origem 'oficial' / estado 'validado'. Com NIF inválido, é assinalado claramente e não inventa dados.",
    "NIF válido e (2º teste) NIF inválido."],
  [F2, "TRNSF-967", "Pré-diagnóstico IA", "Faixa B — nif.pt",
    "Verificar CAE, natureza jurídica, capital social, concelho/distrito.",
    "Preenchidos como 'sugerido — confirmar' (api_empresas / por_validar); CAE normalizado contra o catálogo. Sem chave nif.pt, a faixa aparece como 'sem chave' (sem inventar).",
    "NIF_PT_API_KEY ativa."],
  [F2, "TRNSF-967", "Pré-diagnóstico IA", "Faixa C — Sonar + Sonnet",
    "Ler a leitura estruturada e a checklist 'a confirmar'.",
    "Leitura (setor, CAE provável, tipologia de aviso, sinais) com fontes (URLs) visíveis; checklist explícita dos itens a confirmar oficialmente (escalão PME, situação fiscal/SS, rácios).",
    "OPENROUTER_API_KEY ativa."],
  [F2, "TRNSF-967", "Pré-diagnóstico IA", "Linha vermelha + validação",
    "Tentar perceber se algum campo de elegibilidade aparece como facto; validar/corrigir um campo.",
    "Nenhum campo de elegibilidade (PME, fiscal, rácios) surge como facto — só na checklist. Pode validar/corrigir campo a campo. Enquanto não validado, não altera o estado do projeto nem a elegibilidade.",
    "—"],
  [F2, "TRNSF-967", "Pré-diagnóstico IA", "Resiliência (faixa falha)",
    "Criar projeto e simular indisponibilidade de uma fonte (ou observar quando uma falha).",
    "A falha de uma faixa é registada e o pré-diagnóstico continua com as restantes, sem deixar o diagnóstico inconsistente. Brutos (VIES, nif.pt) e fontes guardados para auditoria.",
    "—"],

  // FASE 2 — Clientes
  [F2, "TRNSF-935", "Clientes", "Lista e detalhe de cliente",
    "Abrir a secção Clientes e clicar num cliente.",
    "Lista os clientes com projetos em curso (candidatura ou execução). O detalhe mostra dados do cliente no contexto do projeto, projetos em curso e documentação associada.",
    "Cliente com projeto em curso."],

  // FASE 2 — Pipeline (963)
  [F2, "TRNSF-963", "Pipeline do projeto", "Pipeline em linguagem de cliente",
    "Abrir a página de um projeto.",
    "Mostra o pipeline por ordem em linguagem de cliente (Diagnóstico, Recolha, Preparação, Revisão, Submissão), sem A0-A4. Cada passo reflete o estado real (concluído/em curso/por iniciar).",
    "—"],
  [F2, "TRNSF-963", "Pipeline do projeto", "O que falta para avançar",
    "Ler o bloco abaixo do pipeline na fase em curso.",
    "Lista os pré-requisitos para fechar a fase atual (do Verificador 946 + estado de validação 942), cada um com pendente/concluído.",
    "—"],
  [F2, "TRNSF-963", "Pipeline do projeto", "Bloco Execução (mapa)",
    "Observar o bloco de Execução.",
    "Aparece esbatido ('se aprovado') como mapa, sem ecrãs trabalháveis. As vistas mostradas são só as relevantes à fase atual.",
    "—"],

  // FASE 2 — Listagem (965)
  [F2, "TRNSF-965", "Listagem de Projectos", "Filtros",
    "Na lista de projetos, aplicar filtros: pesquisa, programa, fase, responsável, família.",
    "A lista filtra corretamente; lista vazia e 'sem resultados' têm estado próprio. Filtro de programa cobre o que a navegação 'Programas' fazia.",
    "Vários projetos de programas/fases/responsáveis diferentes."],
  [F2, "TRNSF-965", "Listagem de Projectos", "Toggle Lista/Kanban",
    "Alternar entre vista Lista e Kanban mantendo filtros.",
    "O toggle mantém os filtros; a preferência é recordada por utilizador. Kanban tem seletor Candidatura|Execução, 5 colunas por secção com contagem; clicar num cartão abre o projeto.",
    "—"],

  // FASE 2 — Pesquisa global (feedback)
  [F2, "TRNSF-964", "Pesquisa global", "Pesquisa na topbar",
    "Escrever na caixa de pesquisa da topbar (nome de cliente, projeto ou documento).",
    "Resultados em listagem flutuante junto à caixa, com ícones e separadores por secção (clientes/projetos/documentos); clicar leva ao item.",
    "Dados em clientes, projetos e documentos."],

  // FASE 2 — Prazos (feedback)
  [F2, "TRNSF-935", "Prazos", "Ecrã de prazos com estados",
    "Abrir o ecrã Prazos.",
    "Mostra os prazos por projeto com estado (ultrapassado / esta semana / futuro). Permite criar/editar prazos. Projeto com prazo ultrapassado é assinalado.",
    "Pelo menos 1 projeto com prazo definido (idealmente 1 ultrapassado)."],

  // FASE 3 — Diagnóstico A0 (953, 941, 940)
  [F3, "TRNSF-953", "Catálogos / Rulebook", "Catálogos disponíveis",
    "Em campos que usam catálogo (CAE, NUTS, países, rubricas, indicadores), abrir o seletor.",
    "Os catálogos estão populados (seed) e são usados na seleção/normalização. CAE devolvido por API é mapeado contra o catálogo.",
    "Seed de catálogos aplicado."],
  [F3, "TRNSF-941", "Grelhas de Mérito", "Seed das grelhas PT2030",
    "Confirmar que as grelhas de mérito PT2030 existem (via Diagnóstico/Mérito).",
    "As grelhas de mérito estão seeded e disponíveis para o cálculo de pontuação.",
    "Seed de grelhas aplicado."],
  [F3, "TRNSF-940", "Diagnóstico A0", "Pontuação 0-100% + risco",
    "No Diagnóstico, escolher o programa e calcular.",
    "Em segundos, devolve pontuação 0-100% pela fórmula + pontos de risco. O consultor confirma; o cálculo é determinístico (não IA).",
    "Projeto com dados mínimos preenchidos."],

  // FASE 4 — WorkDrive (936)
  [F4, "TRNSF-936", "Pastas WorkDrive", "Criação idempotente da árvore",
    "Criar um projeto e verificar a estrutura de pastas; criar de novo / reexecutar.",
    "Cria a árvore de pastas no WorkDrive sem duplicar ao reexecutar. Os links abrem a partir da plataforma. Sem credenciais Zoho, corre em modo stub (gera IDs e diretório local).",
    "WORKDRIVE_* no Railway (senão modo stub)."],

  // FASE 4 — Recolha (937)
  [F4, "TRNSF-937", "Recolha / Formulário", "Link de uso único + formulário",
    "Gerar link de recolha; abrir o formulário público; carregar PDF/imagem; submeter.",
    "Token de uso único que expira; o formulário público abre sem conta; o upload confirma; pede apenas os documentos em falta.",
    "—"],

  // FASE 4 — Classificação (938)
  [F4, "TRNSF-938", "Classificação IA", "Classificar / dividir / arquivar",
    "Carregar um ficheiro multi-documento.",
    "É classificado, dividido por documento, renomeado pela convenção e arquivado na pasta certa. Confiança baixa → marcado para revisão. Reclassificar manualmente move o ficheiro.",
    "Documento multi-tipo; OPENROUTER_API_KEY (senão classificador stub determinístico)."],

  // FASE 4 — Seguimento (939)
  [F4, "TRNSF-939", "Rastreio e Seguimento", "Lembretes com cadência",
    "Com itens em falta, disparar o ciclo de lembretes (cron/token).",
    "Lembrete enviado com a lista + link; cadência crescente; após N tentativas escala ao consultor; 'Tudo recebido ✓' ao completar; cada envio registado. Sem SMTP corre em stub (regista, não envia).",
    "SMTP_* no Railway (senão stub) + CRON_TOKEN."],

  // FASE 5 — Candidatura (942)
  [F5, "TRNSF-942", "Núcleo da Candidatura", "Modelo, famílias e preview",
    "Abrir a candidatura de um projeto; escolher a família; ver o preview.",
    "Estrutura de dados por família (Inovação/Internacionalização); preview legível; cada campo mostra a sua proveniência (origem + estado).",
    "Projeto com família definida."],
  [F5, "TRNSF-952", "Motor de Extração", "Extração determinística + IA",
    "Extrair dados a partir de um documento carregado.",
    "Dados extraídos entram como 'extraído — por validar'; usa extração determinística com fallback IA; nada fica final sem validação humana.",
    "Documento com dados estruturados."],
  [F5, "TRNSF-944", "Componente Financeira", "Balanço, DR e rácios",
    "Preencher/extrair balanço e DR; observar os cálculos.",
    "Campos extraídos como 'por validar'; rácios (ex.: autonomia financeira) calculados de forma determinística em código; nunca por IA.",
    "Dados financeiros (IES) do cliente."],
  [F5, "TRNSF-945", "Custos + Resumo", "Custos/investimentos + resumo executivo",
    "Preencher custos/investimentos e gerar o resumo executivo.",
    "Tabela de custos consistente; resumo executivo coerente com os dados; totais corretos.",
    "—"],
  [F5, "TRNSF-955", "Inovação", "Tipologias de investimento",
    "Na família Inovação, preencher tipologias de investimento + sub-tabelas.",
    "Tipologias e sub-tabelas gravam e somam corretamente.",
    "Projeto família Inovação."],
  [F5, "TRNSF-956", "Inovação", "Atividades + indicadores",
    "Preencher atividades de inovação e indicadores.",
    "Atividades e indicadores gravam; ligações coerentes.",
    "—"],
  [F5, "TRNSF-957", "Inovação", "Indústria 4.0 + Transição Climática",
    "Preencher os blocos Indústria 4.0 e Transição Climática.",
    "Campos específicos gravam e aparecem no preview/exportação.",
    "—"],
  [F5, "TRNSF-958", "Inovação", "Substituição de Importações + Descrição Física",
    "Preencher substituição de importações e descrição física do investimento.",
    "Campos gravam corretamente.",
    "—"],
  [F5, "TRNSF-959", "Inovação", "Intake diferenciado",
    "Iniciar uma candidatura de Inovação e percorrer o intake.",
    "O intake apresenta os campos específicos de Inovação (diferente de Internacionalização).",
    "—"],
  [F5, "TRNSF-960", "Internacionalização", "Ações de intervenção + indicadores",
    "Na família Internacionalização, preencher ações de intervenção e indicadores.",
    "Ações e indicadores gravam e somam corretamente.",
    "Projeto família Internacionalização."],
  [F5, "TRNSF-961", "Internacionalização", "Detalhe da ação + RH",
    "Detalhar uma ação (custos + deslocações) e RH a contratar.",
    "Custos, deslocações e RH a contratar gravam; totais corretos.",
    "—"],
  [F5, "TRNSF-962", "Internacionalização", "Intake diferenciado",
    "Iniciar uma candidatura de Internacionalização e percorrer o intake.",
    "O intake apresenta os campos específicos de Internacionalização.",
    "—"],
  [F5, "TRNSF-943", "Geração IA de texto", "Gerar campos argumentativos",
    "Pedir a geração IA de um campo de texto longo da candidatura.",
    "O texto é gerado e entra como 'gerado — por validar'; o consultor pode editar/validar; nada fica final sem validação.",
    "OPENROUTER_API_KEY ativa."],
  [F5, "TRNSF-946", "Verificador + Mérito", "Não-conformidades + mérito",
    "Correr o Verificador e o cálculo de mérito.",
    "Lista as não-conformidades/pré-requisitos em falta; o mérito (MP = 0,2A + 0,3B + 0,1C + 0,4D) é calculado de forma determinística. Alimenta o 'o que falta' do pipeline.",
    "Candidatura preenchida."],

  // FASE 6 — Exportação (954)
  [F6, "TRNSF-954", "Exportação", "Excel / Word / PDF",
    "Exportar a candidatura nos três formatos.",
    "Gera Excel, Word e PDF estruturados e coerentes com os dados da candidatura.",
    "Candidatura preenchida."],
  [F6, "TRNSF-947", "Revisão Interna", "Aprovação e devolução",
    "Submeter a candidatura a revisão interna; aprovar e (noutro teste) devolver com motivo.",
    "Aprovação avança a fase; devolução (Revisão → Preparação) volta o passo a ativo com o motivo visível.",
    "Candidatura pronta a rever."],
];

// ---------------------------------------------------------------------------
const wb = new ExcelJS.Workbook();
wb.creator = "Estrategor";
wb.created = new Date();

const VERDE = "FF1F6F4A";
const VERDE_CLARO = "FFE8F1EC";
const CINZA = "FFF3F4F6";

// ---- Folha 1: Resumo --------------------------------------------------------
const resumo = wb.addWorksheet("Resumo", { properties: { tabColor: { argb: VERDE } } });
resumo.columns = [{ width: 28 }, { width: 95 }];
const addTitulo = (txt) => {
  const r = resumo.addRow([txt, ""]);
  resumo.mergeCells(`A${r.number}:B${r.number}`);
  r.getCell(1).font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  r.height = 22;
};
const addLinha = (k, v) => {
  const r = resumo.addRow([k, v]);
  r.getCell(1).font = { bold: true };
  r.getCell(1).alignment = { vertical: "top" };
  r.getCell(2).alignment = { vertical: "top", wrapText: true };
};

addTitulo("Plataforma Estrategor — Plano de Testes Internos");
addLinha("Data", "2026-06-06");
addLinha("Âmbito", "Tickets TRNSF-934 a TRNSF-967 (em TESTING INTERNAL). Cobrem o ciclo Fase A: Acesso → Projeto/Diagnóstico → Recolha → Candidatura → Exportação/Revisão.");
addLinha("Fora de âmbito", "TRNSF-948 a 951 (A4 Submissão/Análise/Decisão/Webhook) e TRNSF-968/969 (RAG) — ainda não construídos (INBOX). Tickets 970+ são de outros projetos (TB/Agenda, Alfaseguros, Stelic, BV, Unicenter).");
addLinha("Como usar", "Seguir a folha 'Casos de Teste' pela ordem (#). Preencher 'Resultado' (OK / NOK / Parcial) e 'Notas' por linha. A ordem segue a jornada real do consultor, não o número do ticket.");
addLinha("Princípios a confirmar", "PT-PT em toda a interface; 'Transformatiive' (nunca 'Nuno'); cada campo com origem + estado; nada extraído/gerado/de API/IA fica final sem validação humana; cálculos (rácios, mérito) determinísticos em código; sem códigos A0-A4 na interface; responsivo em mobile.");

addTitulo("Pré-requisitos de ambiente (Railway)");
addLinha("OPENROUTER_API_KEY", "Necessária para IA: pré-diagnóstico Sonar/Sonnet (967), geração de texto (943), classificação (938). Sem ela: classificador stub determinístico e faixas IA a 'sem chave'.");
addLinha("NIF_PT_API_KEY", "Faixa B do pré-diagnóstico (967). Sem ela: faixa 'sem chave' (não inventa dados).");
addLinha("VIES", "Sem chave (API pública da Comissão Europeia). Sob chamadas muito rápidas pode devolver inválido transitório — não é erro da app.");
addLinha("WORKDRIVE_* (Zoho)", "Pastas (936) e arquivo (938). Sem credenciais: modo stub (IDs fake + diretório local) — o fluxo é testável, sem ficheiros reais no Zoho.");
addLinha("SMTP_*", "Envio de emails de recolha/lembretes (937/939). Sem SMTP: modo stub (regista, não envia).");
addLinha("Dados de teste", "1 gestor + 1 consultor; 2-3 projetos em fases diferentes; 1 NIF válido de empresa PT (e 1 inválido); idealmente 1 projeto com prazo ultrapassado.");

addTitulo("Fases do plano");
addLinha("1 · Acesso e Navegação", "Login, RBAC, sidebar, dashboard de trabalho (934, 966, 964).");
addLinha("2 · Cliente, Projeto e Pipeline", "Criar projeto + responsável, pré-diagnóstico IA, clientes, pipeline, listagem/kanban, pesquisa, prazos (935, 967, 963, 965).");
addLinha("3 · Diagnóstico A0", "Catálogos, grelhas de mérito, pontuação (953, 941, 940).");
addLinha("4 · WorkDrive e Recolha", "Pastas, formulário de recolha, classificação IA, seguimento (936, 937, 938, 939).");
addLinha("5 · Candidatura (A2)", "Núcleo, extração, financeira, custos, Inovação, Internacionalização, geração IA, verificador/mérito (942, 952, 944, 945, 955-962, 943, 946).");
addLinha("6 · Exportação e Revisão", "Exportar Excel/Word/PDF; revisão interna e aprovação (954, 947).");

// ---- Folha 2: Casos de Teste -----------------------------------------------
const ws = wb.addWorksheet("Casos de Teste", {
  properties: { tabColor: { argb: VERDE } },
  views: [{ state: "frozen", ySplit: 1 }],
});
ws.columns = [
  { header: "#", key: "n", width: 5 },
  { header: "Fase", key: "fase", width: 26 },
  { header: "Ticket", key: "ticket", width: 12 },
  { header: "Módulo", key: "modulo", width: 22 },
  { header: "Cenário", key: "cenario", width: 26 },
  { header: "Passos", key: "passos", width: 52 },
  { header: "Resultado esperado", key: "esperado", width: 60 },
  { header: "Dados / Pré-requisitos", key: "dados", width: 34 },
  { header: "Resultado", key: "res", width: 14 },
  { header: "Notas", key: "notas", width: 34 },
];
const head = ws.getRow(1);
head.font = { bold: true, color: { argb: "FFFFFFFF" } };
head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
head.alignment = { vertical: "middle", wrapText: true };
head.height = 26;

casos.forEach((c, i) => {
  const [fase, ticket, modulo, cenario, passos, esperado, dados] = c;
  const row = ws.addRow({ n: i + 1, fase, ticket, modulo, cenario, passos, esperado, dados, res: "", notas: "" });
  row.alignment = { vertical: "top", wrapText: true };
  if (i % 2 === 1) {
    for (let col = 1; col <= 10; col++) row.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } };
  }
  row.getCell(3).font = { bold: true, color: { argb: VERDE } };
});
ws.autoFilter = { from: "A1", to: "J1" };

// Validação de dados na coluna Resultado (OK / NOK / Parcial / N/A)
for (let r = 2; r <= casos.length + 1; r++) {
  ws.getCell(`I${r}`).dataValidation = {
    type: "list", allowBlank: true, formulae: ['"OK,NOK,Parcial,N/A"'],
    showErrorMessage: true, errorTitle: "Valor inválido", error: "Escolha OK, NOK, Parcial ou N/A.",
  };
}

// borda fina em toda a tabela
const thin = { style: "thin", color: { argb: "FFD0D5DD" } };
for (let r = 1; r <= casos.length + 1; r++) {
  for (let col = 1; col <= 10; col++) {
    ws.getCell(r, col).border = { top: thin, left: thin, bottom: thin, right: thin };
  }
}

// ---- Folha 3: Cobertura por ticket -----------------------------------------
const cob = wb.addWorksheet("Cobertura", { properties: { tabColor: { argb: VERDE } } });
cob.columns = [
  { header: "Ticket", key: "t", width: 12 },
  { header: "Descrição", key: "d", width: 70 },
  { header: "Nº de casos", key: "c", width: 12 },
  { header: "Estado global", key: "e", width: 16 },
];
const ch = cob.getRow(1);
ch.font = { bold: true, color: { argb: "FFFFFFFF" } };
ch.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
const ticketDesc = {
  "TRNSF-934": "Acesso e Utilizadores (login, RBAC, gestão de utilizadores)",
  "TRNSF-935": "Base da Aplicação (criar projeto, estados, clientes, prazos, pesquisa)",
  "TRNSF-936": "Pastas no WorkDrive (criação idempotente)",
  "TRNSF-937": "Recolha e Formulário ao Cliente (link único)",
  "TRNSF-938": "Classificação, Divisão e Arquivo (IA)",
  "TRNSF-939": "Rastreio e Seguimento Automático (lembretes)",
  "TRNSF-940": "A0 Diagnóstico (pontuação 0-100% + risco)",
  "TRNSF-941": "Seeding das Grelhas de Mérito PT2030",
  "TRNSF-942": "Núcleo da Candidatura (modelo, famílias, preview)",
  "TRNSF-943": "Motor de Geração IA dos campos de texto",
  "TRNSF-944": "Componente Financeira (balanço, DR, rácios)",
  "TRNSF-945": "Custos/Investimentos + Resumo Executivo",
  "TRNSF-946": "Verificador + Cálculo de Mérito",
  "TRNSF-947": "Revisão Interna e Aprovação",
  "TRNSF-952": "Motor de Extração (determinístico + fallback IA)",
  "TRNSF-953": "Catálogos / Rulebook (CAE, NUTS, países, rubricas)",
  "TRNSF-954": "Exportação estruturada (Excel/Word/PDF)",
  "TRNSF-955": "Inovação: Tipologias de Investimento + sub-tabelas",
  "TRNSF-956": "Inovação: Atividades + Indicadores",
  "TRNSF-957": "Inovação: Indústria 4.0 + Transição Climática",
  "TRNSF-958": "Inovação: Substituição de Importações + Descrição Física",
  "TRNSF-959": "Inovação: Intake diferenciado",
  "TRNSF-960": "Internacionalização: Ações + Indicadores",
  "TRNSF-961": "Internacionalização: Detalhe da Ação + RH a contratar",
  "TRNSF-962": "Internacionalização: Intake diferenciado",
  "TRNSF-963": "Vista de Pipeline (linguagem de cliente)",
  "TRNSF-964": "Dashboard de Trabalho + Pesquisa global",
  "TRNSF-965": "Listagem de Projectos (filtros + lista/kanban)",
  "TRNSF-966": "Limpeza da navegação lateral",
  "TRNSF-967": "Pré-diagnóstico assistido por IA",
};
const contagem = {};
casos.forEach((c) => { if (c[1] !== "—") contagem[c[1]] = (contagem[c[1]] || 0) + 1; });
Object.keys(ticketDesc).sort().forEach((t) => {
  const r = cob.addRow({ t, d: ticketDesc[t], c: contagem[t] || 0, e: "" });
  r.getCell(1).font = { bold: true, color: { argb: VERDE } };
  r.getCell(4).dataValidation = {
    type: "list", allowBlank: true, formulae: ['"Aprovado,Reprovado,Com observações,Por testar"'],
  };
});

const out = path.join(__dirname, "Plano_de_Testes_Estrategor.xlsx");
wb.xlsx.writeFile(out).then(() => console.log("OK ->", out, "| casos:", casos.length));
