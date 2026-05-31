import type {
  CandidaturaDTO,
  CandFamily,
  ChecklistItemDTO,
  CollectionRequestDTO,
  CreateCollectionRequest,
  CreateProjectRequest,
  CreateUserRequest,
  CandidaturaGeracaoDTO,
  DiagnosticDTO,
  FinanceiroDTO,
  GeneratedFieldDTO,
  HealthDTO,
  InvestimentosDTO,
  NovaInvestimentoLinha,
  ResumoExecutivoDTO,
  VerificacaoDTO,
  TipologiasDTO,
  TipologiaTipo,
  AtividadesIndicadoresDTO,
  InovacaoExtraDTO,
  Industria40Ambito,
  InovacaoCondDTO,
  DescricaoFisicaDados,
  NovaSubstituicaoLinha,
  IntakeInovacaoDTO,
  IntakeInovacaoAnswers,
  IntakeIntlDTO,
  IntakeIntlAnswers,
  IntlAcoesDTO,
  NovaIntlAcao,
  IntlDetalheDTO,
  NovoIntlCusto,
  NovaIntlDeslocacao,
  NovoIntlRh,
  PipelineDTO,
  DashboardDTO,
  ProjectExtracoesDTO,
  ValidateExtracaoRequest,
  ProjectCollectionDTO,
  ProjectDetailDTO,
  ProjectDocumentsDTO,
  ProjectFoldersDTO,
  ProjectListItemDTO,
  ProjectTrackingDTO,
  PublicCollectionDTO,
  SaveDiagnosticRequest,
  UpdateUserRequest,
  UrgentDeadlineDTO,
  DeadlineDTO,
  NovoDeadline,
  ClientListItemDTO,
  ClientDetailDTO,
  UserDTO,
} from "@estrategor/shared";

// Em dev usamos o proxy do Vite (caminhos relativos). Em produção a SPA e a API
// podem estar em domínios diferentes — define VITE_API_URL nesse caso.
const BASE = import.meta.env.VITE_API_URL ?? "";

/** Erro HTTP com a mensagem devolvida pela API (campo `error`). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });

export const api = {
  health: () => get<HealthDTO>("/health"),

  // auth (TRNSF-934)
  login: (email: string, password: string) =>
    post<UserDTO>("/api/auth/login", { email, password }),
  logout: () => post<{ ok: boolean }>("/api/auth/logout"),
  session: () => get<{ user: null } | UserDTO>("/api/auth/session"),

  // utilizadores (gestor/admin)
  users: () => get<UserDTO[]>("/api/users"),
  createUser: (data: CreateUserRequest) => post<UserDTO>("/api/users", data),
  updateUser: (id: string, data: UpdateUserRequest) =>
    patch<UserDTO>(`/api/users/${id}`, data),
  resetPassword: (id: string, password: string) =>
    post<{ ok: boolean }>(`/api/users/${id}/reset-password`, { password }),

  // projetos
  projects: () => get<ProjectListItemDTO[]>("/api/projects"),
  project: (id: string) => get<ProjectDetailDTO>(`/api/projects/${id}`),
  checklist: (id: string) => get<ChecklistItemDTO[]>(`/api/projects/${id}/checklist`),
  createProject: (data: CreateProjectRequest) =>
    post<{ id: string; code: string; foldersError: string | null }>("/api/projects", data),

  // pastas WorkDrive (TRNSF-936)
  folders: (id: string) => get<ProjectFoldersDTO>(`/api/projects/${id}/folders`),
  createFolders: (id: string) => post<ProjectFoldersDTO>(`/api/projects/${id}/folders`),

  // recolha ao cliente (TRNSF-937)
  collections: (id: string) => get<ProjectCollectionDTO>(`/api/projects/${id}/collections`),
  createCollection: (id: string, data: CreateCollectionRequest) =>
    post<CollectionRequestDTO>(`/api/projects/${id}/collections`, data),

  // rastreio e seguimento (TRNSF-939)
  tracking: (id: string) => get<ProjectTrackingDTO>(`/api/projects/${id}/tracking`),
  urgentDeadlines: () => get<UrgentDeadlineDTO[]>("/api/deadlines/urgent"),

  // clientes (Configuração)
  clients: () => get<ClientListItemDTO[]>("/api/clients"),
  client: (id: string) => get<ClientDetailDTO>(`/api/clients/${id}`),

  // prazos do projeto (CRUD)
  deadlines: (id: string) => get<DeadlineDTO[]>(`/api/projects/${id}/deadlines`),
  addDeadline: (id: string, body: NovoDeadline) => post<DeadlineDTO>(`/api/projects/${id}/deadlines`, body),
  updateDeadline: (did: string, body: Partial<NovoDeadline> & { status?: "pendente" | "completado" }) =>
    patch<DeadlineDTO>(`/api/deadlines/${did}`, body),
  deleteDeadline: (did: string) => request<{ ok: boolean }>(`/api/deadlines/${did}`, { method: "DELETE" }),

  // documentos / classificação IA (TRNSF-938)
  documents: (id: string) => get<ProjectDocumentsDTO>(`/api/projects/${id}/documents`),
  validateDocument: (docId: string, documentTypeKey: string) =>
    post<{ ok: boolean }>(`/api/documents/${docId}/validate`, { documentTypeKey }),
  rejectDocument: (docId: string) => post<{ ok: boolean }>(`/api/documents/${docId}/reject`),
  documentFileUrl: (docId: string) => `${BASE}/api/documents/${docId}/file`,
  uploadManualDocument: async (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/projects/${projectId}/documents`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        const b = (await res.json()) as { error?: string };
        if (b?.error) msg = b.error;
      } catch {
        /* não-JSON */
      }
      throw new ApiError(res.status, msg);
    }
    return (await res.json()) as { ok: boolean; documentId: string; status: string };
  },

  // diagnóstico A0 (TRNSF-940)
  diagnostic: (id: string) => get<DiagnosticDTO>(`/api/projects/${id}/diagnostic`),
  saveDiagnostic: (id: string, data: SaveDiagnosticRequest) =>
    put<DiagnosticDTO>(`/api/projects/${id}/diagnostic`, data),
  advanceDiagnostic: (id: string) =>
    post<{ ok: boolean; state: string }>(`/api/projects/${id}/diagnostic/advance`),

  // candidatura (TRNSF-942)
  candidatura: (id: string) =>
    get<CandidaturaDTO | { candidatura: null; familyChosen: CandFamily | null }>(
      `/api/projects/${id}/candidatura`,
    ),
  startCandidatura: (id: string, family: CandFamily, codigoAviso?: string, medida?: string) =>
    post<CandidaturaDTO>(`/api/projects/${id}/candidatura`, { family, codigoAviso, medida }),
  updateCandField: (
    id: string,
    body: { section: string; key: string; value?: unknown; action: "validar" | "corrigir" },
  ) => patch<CandidaturaDTO>(`/api/projects/${id}/candidatura/field`, body),
  candidaturaStage: (id: string, to: "A3" | "A2") =>
    post<{ ok: boolean; stage: string }>(`/api/projects/${id}/candidatura/stage`, { to }),

  // motor de extração de dados (TRNSF-952)
  extracoes: (id: string) => get<ProjectExtracoesDTO>(`/api/projects/${id}/extracoes`),
  runExtracoes: (id: string) =>
    post<{ ok: boolean; processados: number }>(`/api/projects/${id}/extracoes/run`),
  validateExtracao: (eid: string, body: ValidateExtracaoRequest) =>
    post<{ ok: boolean }>(`/api/extracoes/${eid}/validate`, body),
  rejectExtracao: (eid: string) => post<{ ok: boolean }>(`/api/extracoes/${eid}/reject`),

  // geração IA dos campos de texto (TRNSF-943)
  geracao: (id: string) => get<CandidaturaGeracaoDTO>(`/api/projects/${id}/candidatura/geracao`),
  gerarMinuta: (id: string, docType: string) =>
    post<GeneratedFieldDTO>(`/api/projects/${id}/candidatura/gerar`, { docType }),

  // componente financeira (TRNSF-944)
  financeiro: (id: string) => get<FinanceiroDTO>(`/api/projects/${id}/candidatura/financeiro`),
  seedFinanceiro: (id: string) => post<FinanceiroDTO>(`/api/projects/${id}/candidatura/financeiro/seed`),
  updateFinanceiroCell: (id: string, mapa: string, rubrica: string, ano: number, valor: number) =>
    patch<FinanceiroDTO>(`/api/projects/${id}/candidatura/financeiro/cell`, { mapa, rubrica, ano, valor }),
  validarFinanceiro: (id: string) => post<FinanceiroDTO>(`/api/projects/${id}/candidatura/financeiro/validar`),

  // custos / investimentos + resumo executivo (TRNSF-945)
  investimentos: (id: string) => get<InvestimentosDTO>(`/api/projects/${id}/candidatura/investimentos`),
  addInvestimento: (id: string, linha: NovaInvestimentoLinha) =>
    post<InvestimentosDTO>(`/api/projects/${id}/candidatura/investimentos`, linha),
  updateInvestimento: (id: string, linhaId: string, linha: NovaInvestimentoLinha) =>
    patch<InvestimentosDTO>(`/api/projects/${id}/candidatura/investimentos/${linhaId}`, linha),
  deleteInvestimento: (id: string, linhaId: string) =>
    request<InvestimentosDTO>(`/api/projects/${id}/candidatura/investimentos/${linhaId}`, { method: "DELETE" }),
  resumoExecutivo: (id: string) => get<ResumoExecutivoDTO>(`/api/projects/${id}/candidatura/resumo`),

  // verificador + mérito (TRNSF-946)
  verificacao: (id: string) => get<VerificacaoDTO>(`/api/projects/${id}/candidatura/verificacao`),
  verificar: (id: string) => post<VerificacaoDTO>(`/api/projects/${id}/candidatura/verificacao`),

  // vista de pipeline da página de projeto (TRNSF-963)
  pipeline: (id: string) => get<PipelineDTO>(`/api/projects/${id}/pipeline`),

  // dashboard de trabalho (TRNSF-964)
  dashboard: (consultor?: string) =>
    get<DashboardDTO>(`/api/dashboard${consultor ? `?consultor=${encodeURIComponent(consultor)}` : ""}`),

  // exportação estruturada (TRNSF-954)
  exportStatus: (id: string) =>
    get<{ porValidar: number; placeholders: number; mpPrevisto: number | null; avisos: string[] }>(`/api/projects/${id}/candidatura/export/status`),
  exportUrl: (id: string, format: "xlsx" | "docx" | "pdf") => `${BASE}/api/projects/${id}/candidatura/export/${format}`,

  // Família A — tipologias de investimento (TRNSF-955)
  tipologias: (id: string) => get<TipologiasDTO>(`/api/projects/${id}/candidatura/tipologias`),
  addTipologia: (id: string, tipo: TipologiaTipo, dados?: Record<string, string | number | null>) =>
    post<TipologiasDTO>(`/api/projects/${id}/candidatura/tipologias`, { tipo, dados }),
  updateTipologia: (id: string, tid: string, dados: Record<string, string | number | null>) =>
    patch<TipologiasDTO>(`/api/projects/${id}/candidatura/tipologias/${tid}`, { dados }),
  deleteTipologia: (id: string, tid: string) =>
    request<TipologiasDTO>(`/api/projects/${id}/candidatura/tipologias/${tid}`, { method: "DELETE" }),

  // Família A — atividades de inovação + indicadores (TRNSF-956)
  atividades: (id: string) => get<AtividadesIndicadoresDTO>(`/api/projects/${id}/candidatura/atividades`),
  addAtividade: (id: string, designacao: string) =>
    post<AtividadesIndicadoresDTO>(`/api/projects/${id}/candidatura/atividades`, { designacao }),
  deleteAtividade: (id: string, aid: string) =>
    request<AtividadesIndicadoresDTO>(`/api/projects/${id}/candidatura/atividades/${aid}`, { method: "DELETE" }),
  addIndicador: (id: string, codigo: string) =>
    post<AtividadesIndicadoresDTO>(`/api/projects/${id}/candidatura/indicadores`, { codigo }),
  updateIndicador: (id: string, iid: string, valorPre: number | null, valorMeta: number | null) =>
    patch<AtividadesIndicadoresDTO>(`/api/projects/${id}/candidatura/indicadores/${iid}`, { valorPre, valorMeta }),
  deleteIndicador: (id: string, iid: string) =>
    request<AtividadesIndicadoresDTO>(`/api/projects/${id}/candidatura/indicadores/${iid}`, { method: "DELETE" }),
  sugerirIndicadores: (id: string) =>
    post<AtividadesIndicadoresDTO & { adicionados: number }>(`/api/projects/${id}/candidatura/indicadores/sugerir`),

  // Família A — Indústria 4.0 + Transição Climática (TRNSF-957)
  inovacaoExtra: (id: string) => get<InovacaoExtraDTO>(`/api/projects/${id}/candidatura/inovacao-extra`),
  updateInovacaoExtra: (id: string, body: { industria40Ambitos?: Partial<Record<Industria40Ambito, boolean>>; transicaoAmbitos?: string[] }) =>
    patch<InovacaoExtraDTO>(`/api/projects/${id}/candidatura/inovacao-extra`, body),

  // Família A — substituição de importações + descrição física (TRNSF-958)
  inovacaoCond: (id: string) => get<InovacaoCondDTO>(`/api/projects/${id}/candidatura/inovacao-cond`),
  addSubstituicao: (id: string, linha: NovaSubstituicaoLinha) =>
    post<InovacaoCondDTO>(`/api/projects/${id}/candidatura/substituicao`, linha),
  deleteSubstituicao: (id: string, sid: string) =>
    request<InovacaoCondDTO>(`/api/projects/${id}/candidatura/substituicao/${sid}`, { method: "DELETE" }),
  updateDescricaoFisica: (id: string, dados: DescricaoFisicaDados) =>
    patch<InovacaoCondDTO>(`/api/projects/${id}/candidatura/descricao-fisica`, dados),

  // intake diferenciado Inovação no formulário público (TRNSF-959)
  intakeInovacao: (token: string) => get<IntakeInovacaoDTO>(`/api/recolha/${token}/intake`),
  submitIntakeInovacao: (token: string, answers: IntakeInovacaoAnswers) =>
    post<{ ok: boolean }>(`/api/recolha/${token}/intake`, answers),

  // intake diferenciado Internacionalização (TRNSF-962)
  intakeIntl: (token: string) => get<IntakeIntlDTO>(`/api/recolha/${token}/intake-intl`),
  submitIntakeIntl: (token: string, answers: IntakeIntlAnswers) =>
    post<{ ok: boolean }>(`/api/recolha/${token}/intake-intl`, answers),

  // Família B — ações de internacionalização (TRNSF-960)
  intlAcoes: (id: string) => get<IntlAcoesDTO>(`/api/projects/${id}/candidatura/intl-acoes`),
  updateIntlDominio: (id: string, numero: number, body: { aplicavel?: boolean; contributo?: string | null }) =>
    patch<IntlAcoesDTO>(`/api/projects/${id}/candidatura/intl-dominios`, { numero, ...body }),
  addIntlAcao: (id: string, acao: NovaIntlAcao) =>
    post<IntlAcoesDTO>(`/api/projects/${id}/candidatura/intl-acoes`, acao),
  deleteIntlAcao: (id: string, aid: string) =>
    request<IntlAcoesDTO>(`/api/projects/${id}/candidatura/intl-acoes/${aid}`, { method: "DELETE" }),

  // Família B — detalhe da ação (custos/deslocações) + RH (TRNSF-961)
  intlDetalhe: (id: string) => get<IntlDetalheDTO>(`/api/projects/${id}/candidatura/intl-detalhe`),
  addIntlCusto: (id: string, c: NovoIntlCusto) => post<IntlDetalheDTO>(`/api/projects/${id}/candidatura/intl-custos`, c),
  deleteIntlCusto: (id: string, cid: string) => request<IntlDetalheDTO>(`/api/projects/${id}/candidatura/intl-custos/${cid}`, { method: "DELETE" }),
  addIntlDeslocacao: (id: string, d: NovaIntlDeslocacao) => post<IntlDetalheDTO>(`/api/projects/${id}/candidatura/intl-deslocacoes`, d),
  deleteIntlDeslocacao: (id: string, did: string) => request<IntlDetalheDTO>(`/api/projects/${id}/candidatura/intl-deslocacoes/${did}`, { method: "DELETE" }),
  addIntlRh: (id: string, r: NovoIntlRh) => post<IntlDetalheDTO>(`/api/projects/${id}/candidatura/intl-rh`, r),
  deleteIntlRh: (id: string, rid: string) => request<IntlDetalheDTO>(`/api/projects/${id}/candidatura/intl-rh/${rid}`, { method: "DELETE" }),

  // formulário público do cliente (sem login)
  publicCollection: (token: string) =>
    get<PublicCollectionDTO>(`/api/recolha/${token}`),
  uploadDocument: async (token: string, file: File, typeKey?: string) => {
    const form = new FormData();
    form.append("file", file);
    const qs = typeKey ? `?type=${encodeURIComponent(typeKey)}` : "";
    const res = await fetch(
      `${BASE}/api/recolha/${token}/upload${qs}`,
      { method: "POST", body: form },
    );
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        const b = (await res.json()) as { error?: string };
        if (b?.error) msg = b.error;
      } catch {
        /* não-JSON */
      }
      throw new ApiError(res.status, msg);
    }
    return (await res.json()) as { ok: boolean; storedFilename: string };
  },
};
