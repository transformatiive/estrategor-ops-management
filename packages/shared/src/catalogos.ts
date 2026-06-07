/**
 * Catálogos / Rulebook (TRNSF-953) — datasets canónicos como DADOS.
 *
 * Estas listas são a fonte de verdade versionável. O seed carrega-as na BD; a
 * app e a extração leem da BD (não destas constantes diretamente, exceto o
 * próprio seed). Onde a fonte oficial completa não está embebida (CAE integral,
 * todas as freguesias), começamos com a lista conhecida — completável sem
 * alterar código (basta acrescentar linhas e re-correr o seed de referência).
 */

// ─── Domínios de internacionalização (Família B) — fixos do formulário 1..6 ──
export const DOMINIOS_INTL: { numero: number; designacao: string }[] = [
  { numero: 1, designacao: "Conhecimento dos mercados externos" },
  { numero: 2, designacao: "Presença na web e economia digital" },
  { numero: 3, designacao: "Desenvolvimento e promoção internacional da marca" },
  { numero: 4, designacao: "Prospeção e presença em mercados internacionais" },
  { numero: 5, designacao: "Marketing internacional" },
  { numero: 6, designacao: "Introdução de novo método de organização nas práticas comerciais ou relações externas" },
];

// ─── Indicadores (códigos oficiais referidos no ticket) ──────────────────────
// designações/unidades indicativas; a designação oficial completa pode ser
// afinada quando confirmada na fonte do aviso.
export const INDICADORES: { codigo: string; designacao: string; unidade: string; dominio?: string }[] = [
  { codigo: "RPO008", designacao: "Empresas apoiadas (subvenções)", unidade: "empresas" },
  { codigo: "RCR01", designacao: "Postos de trabalho criados em entidades apoiadas", unidade: "ETI" },
  { codigo: "RPR003", designacao: "Volume de negócios das empresas apoiadas", unidade: "€" },
  { codigo: "RSR23", designacao: "Empresas com inovação de produto ou processo apoiadas", unidade: "empresas" },
  { codigo: "RPR001", designacao: "Vendas ao exterior (exportações)", unidade: "€" },
  { codigo: "RPR031", designacao: "Intensidade exportadora", unidade: "%" },
  { codigo: "RPR002", designacao: "Valor acrescentado bruto das empresas apoiadas", unidade: "€" },
  { codigo: "RPR080", designacao: "Produtividade (VAB por trabalhador)", unidade: "€/ETI" },
  { codigo: "RPA001", designacao: "Investimento elegível", unidade: "€" },
  { codigo: "RPA002", designacao: "Investimento total", unidade: "€" },
  { codigo: "RPA003", designacao: "Incentivo aprovado", unidade: "€" },
  { codigo: "RPA004", designacao: "Mercados de destino", unidade: "n.º" },
];

// ─── Categorias de custo por família (do ticket) ─────────────────────────────
export const CATEGORIAS_CUSTO: { familia: "inovacao_produtiva" | "internacionalizacao"; codigo: string; designacao: string }[] = [
  // Família A — Inovação Produtiva
  { familia: "inovacao_produtiva", codigo: "CONSTRUCAO", designacao: "Construção / reabilitação" },
  { familia: "inovacao_produtiva", codigo: "MAQUINAS", designacao: "Máquinas e equipamentos" },
  { familia: "inovacao_produtiva", codigo: "SOFTWARE", designacao: "Software e licenças" },
  { familia: "inovacao_produtiva", codigo: "OUTROS", designacao: "Outros" },
  { familia: "inovacao_produtiva", codigo: "ESTUDOS_DNSH", designacao: "Estudos / Relatórios DNSH" },
  { familia: "inovacao_produtiva", codigo: "CC_ROC", designacao: "CC / ROC" },
  { familia: "inovacao_produtiva", codigo: "PLANO_MARKETING", designacao: "Planos de marketing" },
  // Família B — Internacionalização (rubricas de feiras/ações)
  { familia: "internacionalizacao", codigo: "ALUGUER_ESPACO", designacao: "Aluguer de espaço" },
  { familia: "internacionalizacao", codigo: "MONTAGEM_STAND", designacao: "Montagem de stand" },
  { familia: "internacionalizacao", codigo: "DESMONTAGEM", designacao: "Desmontagem / desinstalação" },
  { familia: "internacionalizacao", codigo: "VIAGENS", designacao: "Viagens" },
  { familia: "internacionalizacao", codigo: "ESTADIAS", designacao: "Estadias" },
  { familia: "internacionalizacao", codigo: "OUTROS", designacao: "Outros custos da ação" },
];

// ─── Rubricas SNC (essenciais; completável) ──────────────────────────────────
export const RUBRICAS_SNC: { tipo: "balanco" | "dr" | "financiamento"; codigo: string; designacao: string; vidaUtil?: number }[] = [
  // Balanço — ativo não corrente
  { tipo: "balanco", codigo: "431", designacao: "Edifícios e outras construções", vidaUtil: 50 },
  { tipo: "balanco", codigo: "433", designacao: "Equipamento básico", vidaUtil: 8 },
  { tipo: "balanco", codigo: "434", designacao: "Equipamento de transporte", vidaUtil: 4 },
  { tipo: "balanco", codigo: "435", designacao: "Equipamento administrativo", vidaUtil: 8 },
  { tipo: "balanco", codigo: "441", designacao: "Programas de computador (software)", vidaUtil: 3 },
  // Balanço — corrente
  { tipo: "balanco", codigo: "11", designacao: "Caixa" },
  { tipo: "balanco", codigo: "12", designacao: "Depósitos à ordem" },
  { tipo: "balanco", codigo: "21", designacao: "Clientes" },
  { tipo: "balanco", codigo: "22", designacao: "Fornecedores" },
  // Demonstração de resultados
  { tipo: "dr", codigo: "71", designacao: "Vendas" },
  { tipo: "dr", codigo: "72", designacao: "Prestações de serviços" },
  { tipo: "dr", codigo: "61", designacao: "Custo das mercadorias vendidas e matérias consumidas" },
  { tipo: "dr", codigo: "63", designacao: "Gastos com o pessoal" },
  { tipo: "dr", codigo: "64", designacao: "Gastos de depreciação e de amortização" },
  // Financiamento
  { tipo: "financiamento", codigo: "25", designacao: "Financiamentos obtidos" },
  { tipo: "financiamento", codigo: "26", designacao: "Acionistas/sócios" },
];

// ─── Geografia: NUTS II → NUTS III (Portugal continental + RA) ───────────────
// Concelhos/freguesias e flag de baixa densidade são completados no seed a
// partir da lista conhecida (amostra representativa); a estrutura suporta a
// lista integral sem alterar código.
export const NUTS: { nuts2: string; nuts3: string[] }[] = [
  { nuts2: "Norte", nuts3: ["Alto Minho", "Cávado", "Ave", "Área Metropolitana do Porto", "Alto Tâmega", "Tâmega e Sousa", "Douro", "Terras de Trás-os-Montes"] },
  { nuts2: "Centro", nuts3: ["Região de Aveiro", "Região de Coimbra", "Região de Leiria", "Viseu Dão Lafões", "Beira Baixa", "Médio Tejo", "Beiras e Serra da Estrela", "Oeste"] },
  { nuts2: "Área Metropolitana de Lisboa", nuts3: ["Área Metropolitana de Lisboa"] },
  { nuts2: "Alentejo", nuts3: ["Alentejo Litoral", "Baixo Alentejo", "Lezíria do Tejo", "Alto Alentejo", "Alentejo Central"] },
  { nuts2: "Algarve", nuts3: ["Algarve"] },
  { nuts2: "Região Autónoma dos Açores", nuts3: ["Região Autónoma dos Açores"] },
  { nuts2: "Região Autónoma da Madeira", nuts3: ["Região Autónoma da Madeira"] },
];

/**
 * Catálogo completo dos 308 concelhos de Portugal → NUTS II / NUTS III
 * (classificação NUTS 2024, INE). A flag `baixaDensidade` segue a lista oficial
 * de territórios do interior/baixa densidade (Deliberação CIC Portugal 2020
 * n.º 55/2020) ao nível do concelho integralmente classificado; casos parciais
 * (ao nível da freguesia) ficam `false` e confirmam-se caso a caso.
 */
const BAIXA_DENSIDADE = new Set<string>([
  // Norte
  "Melgaço", "Monção", "Arcos de Valdevez", "Paredes de Coura", "Ponte da Barca", "Valença", "Vila Nova de Cerveira",
  "Terras de Bouro", "Vila Verde", "Cabeceiras de Basto", "Mondim de Basto", "Vieira do Minho",
  "Boticas", "Chaves", "Montalegre", "Ribeira de Pena", "Valpaços", "Vila Pouca de Aguiar",
  "Baião", "Celorico de Basto", "Cinfães", "Resende",
  "Alijó", "Armamar", "Carrazeda de Ansiães", "Freixo de Espada à Cinta", "Lamego", "Mesão Frio", "Moimenta da Beira",
  "Murça", "Penedono", "Peso da Régua", "Sabrosa", "Santa Marta de Penaguião", "São João da Pesqueira", "Sernancelhe",
  "Tabuaço", "Tarouca", "Torre de Moncorvo", "Vila Nova de Foz Côa", "Vila Real",
  "Alfândega da Fé", "Bragança", "Macedo de Cavaleiros", "Miranda do Douro", "Mirandela", "Mogadouro", "Vila Flor", "Vimioso", "Vinhais",
  // Centro
  "Sever do Vouga",
  "Arganil", "Góis", "Mortágua", "Oliveira do Hospital", "Pampilhosa da Serra", "Penacova", "Penela", "Tábua", "Vila Nova de Poiares",
  "Alvaiázere", "Ansião", "Castanheira de Pera", "Figueiró dos Vinhos", "Pedrógão Grande",
  "Aguiar da Beira", "Carregal do Sal", "Castro Daire", "Mangualde", "Nelas", "Oliveira de Frades", "Penalva do Castelo",
  "Santa Comba Dão", "São Pedro do Sul", "Sátão", "Tondela", "Vila Nova de Paiva", "Vouzela",
  "Castelo Branco", "Idanha-a-Nova", "Oleiros", "Penamacor", "Proença-a-Nova", "Vila Velha de Ródão",
  "Ferreira do Zêzere", "Mação", "Sardoal", "Sertã", "Vila de Rei",
  "Almeida", "Belmonte", "Celorico da Beira", "Covilhã", "Figueira de Castelo Rodrigo", "Fornos de Algodres", "Fundão",
  "Gouveia", "Guarda", "Manteigas", "Mêda", "Pinhel", "Sabugal", "Seia", "Trancoso",
  // Alentejo
  "Alcácer do Sal", "Grândola", "Odemira", "Santiago do Cacém",
  "Aljustrel", "Almodôvar", "Alvito", "Barrancos", "Beja", "Castro Verde", "Cuba", "Ferreira do Alentejo", "Mértola",
  "Moura", "Ourique", "Serpa", "Vidigueira",
  "Alter do Chão", "Arronches", "Avis", "Campo Maior", "Castelo de Vide", "Crato", "Elvas", "Fronteira", "Gavião",
  "Marvão", "Monforte", "Nisa", "Ponte de Sor", "Portalegre", "Sousel",
  "Alandroal", "Arraiolos", "Borba", "Estremoz", "Évora", "Montemor-o-Novo", "Mora", "Mourão", "Portel", "Redondo",
  "Reguengos de Monsaraz", "Vendas Novas", "Viana do Alentejo", "Vila Viçosa",
  "Chamusca", "Coruche", "Golegã",
  // Algarve
  "Alcoutim", "Aljezur", "Castro Marim", "Monchique", "Vila do Bispo",
]);

const CONCELHOS_POR_NUTS: { nuts2: string; nuts3: string; concelhos: string[] }[] = [
  // ── NORTE (86) ──
  { nuts2: "Norte", nuts3: "Alto Minho", concelhos: ["Arcos de Valdevez", "Caminha", "Melgaço", "Monção", "Paredes de Coura", "Ponte da Barca", "Ponte de Lima", "Valença", "Viana do Castelo", "Vila Nova de Cerveira"] },
  { nuts2: "Norte", nuts3: "Cávado", concelhos: ["Amares", "Barcelos", "Braga", "Esposende", "Terras de Bouro", "Vila Verde"] },
  { nuts2: "Norte", nuts3: "Ave", concelhos: ["Cabeceiras de Basto", "Fafe", "Guimarães", "Mondim de Basto", "Póvoa de Lanhoso", "Vieira do Minho", "Vila Nova de Famalicão", "Vizela"] },
  { nuts2: "Norte", nuts3: "Área Metropolitana do Porto", concelhos: ["Arouca", "Espinho", "Gondomar", "Maia", "Matosinhos", "Oliveira de Azeméis", "Paredes", "Porto", "Póvoa de Varzim", "Santa Maria da Feira", "Santo Tirso", "São João da Madeira", "Trofa", "Vale de Cambra", "Valongo", "Vila do Conde", "Vila Nova de Gaia"] },
  { nuts2: "Norte", nuts3: "Alto Tâmega", concelhos: ["Boticas", "Chaves", "Montalegre", "Ribeira de Pena", "Valpaços", "Vila Pouca de Aguiar"] },
  { nuts2: "Norte", nuts3: "Tâmega e Sousa", concelhos: ["Amarante", "Baião", "Castelo de Paiva", "Celorico de Basto", "Cinfães", "Felgueiras", "Lousada", "Marco de Canaveses", "Paços de Ferreira", "Penafiel", "Resende"] },
  { nuts2: "Norte", nuts3: "Douro", concelhos: ["Alijó", "Armamar", "Carrazeda de Ansiães", "Freixo de Espada à Cinta", "Lamego", "Mesão Frio", "Moimenta da Beira", "Murça", "Penedono", "Peso da Régua", "Sabrosa", "Santa Marta de Penaguião", "São João da Pesqueira", "Sernancelhe", "Tabuaço", "Tarouca", "Torre de Moncorvo", "Vila Nova de Foz Côa", "Vila Real"] },
  { nuts2: "Norte", nuts3: "Terras de Trás-os-Montes", concelhos: ["Alfândega da Fé", "Bragança", "Macedo de Cavaleiros", "Miranda do Douro", "Mirandela", "Mogadouro", "Vila Flor", "Vimioso", "Vinhais"] },
  // ── CENTRO (100) ──
  { nuts2: "Centro", nuts3: "Região de Aveiro", concelhos: ["Águeda", "Albergaria-a-Velha", "Anadia", "Aveiro", "Estarreja", "Ílhavo", "Murtosa", "Oliveira do Bairro", "Ovar", "Sever do Vouga", "Vagos"] },
  { nuts2: "Centro", nuts3: "Região de Coimbra", concelhos: ["Arganil", "Cantanhede", "Coimbra", "Condeixa-a-Nova", "Figueira da Foz", "Góis", "Lousã", "Mealhada", "Mira", "Miranda do Corvo", "Montemor-o-Velho", "Mortágua", "Oliveira do Hospital", "Pampilhosa da Serra", "Penacova", "Penela", "Soure", "Tábua", "Vila Nova de Poiares"] },
  { nuts2: "Centro", nuts3: "Região de Leiria", concelhos: ["Alvaiázere", "Ansião", "Batalha", "Castanheira de Pera", "Figueiró dos Vinhos", "Leiria", "Marinha Grande", "Pedrógão Grande", "Pombal", "Porto de Mós"] },
  { nuts2: "Centro", nuts3: "Viseu Dão Lafões", concelhos: ["Aguiar da Beira", "Carregal do Sal", "Castro Daire", "Mangualde", "Nelas", "Oliveira de Frades", "Penalva do Castelo", "Santa Comba Dão", "São Pedro do Sul", "Sátão", "Tondela", "Vila Nova de Paiva", "Viseu", "Vouzela"] },
  { nuts2: "Centro", nuts3: "Beira Baixa", concelhos: ["Castelo Branco", "Idanha-a-Nova", "Oleiros", "Penamacor", "Proença-a-Nova", "Vila Velha de Ródão"] },
  { nuts2: "Centro", nuts3: "Médio Tejo", concelhos: ["Abrantes", "Alcanena", "Constância", "Entroncamento", "Ferreira do Zêzere", "Mação", "Ourém", "Sardoal", "Sertã", "Tomar", "Torres Novas", "Vila de Rei", "Vila Nova da Barquinha"] },
  { nuts2: "Centro", nuts3: "Beiras e Serra da Estrela", concelhos: ["Almeida", "Belmonte", "Celorico da Beira", "Covilhã", "Figueira de Castelo Rodrigo", "Fornos de Algodres", "Fundão", "Gouveia", "Guarda", "Manteigas", "Mêda", "Pinhel", "Sabugal", "Seia", "Trancoso"] },
  { nuts2: "Centro", nuts3: "Oeste", concelhos: ["Alcobaça", "Alenquer", "Arruda dos Vinhos", "Bombarral", "Cadaval", "Caldas da Rainha", "Lourinhã", "Nazaré", "Óbidos", "Peniche", "Sobral de Monte Agraço", "Torres Vedras"] },
  // ── ÁREA METROPOLITANA DE LISBOA (18) ──
  { nuts2: "Área Metropolitana de Lisboa", nuts3: "Área Metropolitana de Lisboa", concelhos: ["Alcochete", "Almada", "Amadora", "Barreiro", "Cascais", "Lisboa", "Loures", "Mafra", "Moita", "Montijo", "Odivelas", "Oeiras", "Palmela", "Seixal", "Sesimbra", "Setúbal", "Sintra", "Vila Franca de Xira"] },
  // ── ALENTEJO (58) ──
  { nuts2: "Alentejo", nuts3: "Alentejo Litoral", concelhos: ["Alcácer do Sal", "Grândola", "Odemira", "Santiago do Cacém", "Sines"] },
  { nuts2: "Alentejo", nuts3: "Baixo Alentejo", concelhos: ["Aljustrel", "Almodôvar", "Alvito", "Barrancos", "Beja", "Castro Verde", "Cuba", "Ferreira do Alentejo", "Mértola", "Moura", "Ourique", "Serpa", "Vidigueira"] },
  { nuts2: "Alentejo", nuts3: "Alto Alentejo", concelhos: ["Alter do Chão", "Arronches", "Avis", "Campo Maior", "Castelo de Vide", "Crato", "Elvas", "Fronteira", "Gavião", "Marvão", "Monforte", "Nisa", "Ponte de Sor", "Portalegre", "Sousel"] },
  { nuts2: "Alentejo", nuts3: "Alentejo Central", concelhos: ["Alandroal", "Arraiolos", "Borba", "Estremoz", "Évora", "Montemor-o-Novo", "Mora", "Mourão", "Portel", "Redondo", "Reguengos de Monsaraz", "Vendas Novas", "Viana do Alentejo", "Vila Viçosa"] },
  { nuts2: "Alentejo", nuts3: "Lezíria do Tejo", concelhos: ["Almeirim", "Alpiarça", "Azambuja", "Benavente", "Cartaxo", "Chamusca", "Coruche", "Golegã", "Rio Maior", "Salvaterra de Magos", "Santarém"] },
  // ── ALGARVE (16) ──
  { nuts2: "Algarve", nuts3: "Algarve", concelhos: ["Albufeira", "Alcoutim", "Aljezur", "Castro Marim", "Faro", "Lagoa", "Lagos", "Loulé", "Monchique", "Olhão", "Portimão", "São Brás de Alportel", "Silves", "Tavira", "Vila do Bispo", "Vila Real de Santo António"] },
  // ── R.A. AÇORES (19) ──
  { nuts2: "Região Autónoma dos Açores", nuts3: "Região Autónoma dos Açores", concelhos: ["Angra do Heroísmo", "Calheta (São Jorge)", "Corvo", "Horta", "Lagoa (Açores)", "Lajes das Flores", "Lajes do Pico", "Madalena", "Nordeste", "Ponta Delgada", "Povoação", "Ribeira Grande", "Santa Cruz da Graciosa", "Santa Cruz das Flores", "São Roque do Pico", "Velas", "Vila Franca do Campo", "Vila do Porto", "Vila Praia da Vitória"] },
  // ── R.A. MADEIRA (11) ──
  { nuts2: "Região Autónoma da Madeira", nuts3: "Região Autónoma da Madeira", concelhos: ["Calheta (Madeira)", "Câmara de Lobos", "Funchal", "Machico", "Ponta do Sol", "Porto Moniz", "Porto Santo", "Ribeira Brava", "Santa Cruz", "Santana", "São Vicente"] },
];

/** Os 308 concelhos com NUTS II/III e flag de baixa densidade (TRNSF-1037). */
export const CONCELHOS: { nuts2: string; nuts3: string; concelho: string; baixaDensidade: boolean }[] =
  CONCELHOS_POR_NUTS.flatMap(({ nuts2, nuts3, concelhos }) =>
    concelhos.map((concelho) => ({ nuts2, nuts3, concelho, baixaDensidade: BAIXA_DENSIDADE.has(concelho) })),
  );

/** Países / mercados (ISO-3166 alpha-2, principais mercados de exportação). */
export const PAISES: { codigo: string; nome: string }[] = [
  { codigo: "PT", nome: "Portugal" },
  { codigo: "ES", nome: "Espanha" },
  { codigo: "FR", nome: "França" },
  { codigo: "DE", nome: "Alemanha" },
  { codigo: "GB", nome: "Reino Unido" },
  { codigo: "IT", nome: "Itália" },
  { codigo: "NL", nome: "Países Baixos" },
  { codigo: "BE", nome: "Bélgica" },
  { codigo: "US", nome: "Estados Unidos" },
  { codigo: "BR", nome: "Brasil" },
  { codigo: "AO", nome: "Angola" },
  { codigo: "MZ", nome: "Moçambique" },
  { codigo: "CN", nome: "China" },
  { codigo: "MA", nome: "Marrocos" },
  { codigo: "PL", nome: "Polónia" },
  { codigo: "CH", nome: "Suíça" },
];

/** Amostra de CAE Rev.3 (completável com a lista integral). */
export const CAE_AMOSTRA: { codigo: string; designacao: string }[] = [
  { codigo: "10110", designacao: "Abate de gado (produção de carne)" },
  { codigo: "13105", designacao: "Fabricação de fios e fibras têxteis" },
  { codigo: "22220", designacao: "Fabricação de embalagens de plástico" },
  { codigo: "25500", designacao: "Forjamento, estampagem e laminagem de metais" },
  { codigo: "25734", designacao: "Fabricação de moldes metálicos" },
  { codigo: "26110", designacao: "Fabricação de componentes eletrónicos" },
  { codigo: "28290", designacao: "Fabricação de outras máquinas para uso geral" },
  { codigo: "46690", designacao: "Comércio por grosso de outras máquinas e equipamentos" },
  { codigo: "47190", designacao: "Comércio a retalho em estabelecimentos não especializados" },
  { codigo: "62010", designacao: "Atividades de programação informática" },
  { codigo: "62090", designacao: "Outras atividades relacionadas com as TI" },
  { codigo: "71120", designacao: "Atividades de engenharia e técnicas afins" },
];

/** Anexos por família e nível (transversal / tipologia / condicional). */
export const ANEXOS: { familia: "inovacao_produtiva" | "internacionalizacao"; nivel: "transversal" | "tipologia" | "condicional"; codigo: string; designacao: string; condicao?: string; obrigatorio: boolean }[] = [
  // Transversais (ambas as famílias)
  { familia: "inovacao_produtiva", nivel: "transversal", codigo: "IES", designacao: "IES (3 anos)", obrigatorio: true },
  { familia: "inovacao_produtiva", nivel: "transversal", codigo: "CERTIDAO_PME", designacao: "Certificado PME (IAPMEI)", obrigatorio: true },
  { familia: "inovacao_produtiva", nivel: "transversal", codigo: "CERTIDAO_NAO_DIVIDA", designacao: "Certidão de não dívida (AT e SS)", obrigatorio: true },
  { familia: "inovacao_produtiva", nivel: "tipologia", codigo: "MEMORIA_DESCRITIVA", designacao: "Memória descritiva do investimento", obrigatorio: true },
  { familia: "inovacao_produtiva", nivel: "tipologia", codigo: "ORCAMENTOS", designacao: "Orçamentos / intenções de investimento", obrigatorio: true },
  { familia: "inovacao_produtiva", nivel: "condicional", codigo: "LICENCIAMENTO", designacao: "Licenciamento (se aplicável ao setor)", condicao: "setor_licenciado", obrigatorio: false },
  { familia: "internacionalizacao", nivel: "transversal", codigo: "IES", designacao: "IES (3 anos)", obrigatorio: true },
  { familia: "internacionalizacao", nivel: "transversal", codigo: "CERTIDAO_PME", designacao: "Certificado PME (IAPMEI)", obrigatorio: true },
  { familia: "internacionalizacao", nivel: "transversal", codigo: "CERTIDAO_NAO_DIVIDA", designacao: "Certidão de não dívida (AT e SS)", obrigatorio: true },
  { familia: "internacionalizacao", nivel: "tipologia", codigo: "PLANO_INTERNACIONALIZACAO", designacao: "Plano de internacionalização", obrigatorio: true },
  { familia: "internacionalizacao", nivel: "tipologia", codigo: "ORCAMENTOS_ACOES", designacao: "Orçamentos das ações (feiras/missões)", obrigatorio: true },
];

// ─── DTO do rulebook (lido pela app a partir da BD) ──────────────────────────
export interface RulebookDTO {
  cae: { codigo: string; designacao: string }[];
  paises: { codigo: string; nome: string }[];
  geo: { nuts2: string; nuts3: string; concelho: string; baixaDensidade: boolean }[];
  rubricasSnc: { tipo: string; codigo: string; designacao: string; vidaUtil: number | null }[];
  categoriasCusto: { familia: string; codigo: string; designacao: string }[];
  indicadores: { codigo: string; designacao: string; unidade: string | null; dominio: string | null }[];
  dominiosIntl: { numero: number; designacao: string }[];
  tiposDocumento: { codigo: string; designacao: string; subpastaWorkdrive: string }[];
  anexos: { familia: string; nivel: string; codigo: string; designacao: string; condicao: string | null; obrigatorio: boolean }[];
}
