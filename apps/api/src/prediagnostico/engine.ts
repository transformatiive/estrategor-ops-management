import {
  type ChecklistAConfirmar,
  type FaixaEstado,
  type PreDiagCampo,
  type PreDiagnosticoDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { extrairElegibilidadeDoAviso } from "../extraction/aviso.js";
import { consultarVies } from "./vies.js";
import { consultarEmpresas } from "./empresas.js";
import { consultarSonar } from "./sonar.js";
import { estruturarSonnet } from "./sonnet.js";

/** Checklist obrigatória (linha vermelha): nunca dada como facto pela IA/API. */
const CHECKLIST_BASE: ChecklistAConfirmar[] = [
  { item: "Escalão PME (micro/pequena/média)", nota: "Confirmar oficialmente (Certificado PME / IAPMEI)." },
  { item: "Situação fiscal e contributiva", nota: "Confirmar com certidões AT e Segurança Social." },
  { item: "Rácios financeiros (autonomia financeira, etc.)", nota: "Calcular a partir da IES validada." },
];

/**
 * Corre o pré-diagnóstico (TRNSF-967) em segundo plano, tolerante a falhas por
 * faixa. Nunca decide elegibilidade; tudo entra como rascunho com proveniência.
 */
export async function runPreDiagnostico(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { client: true } });
  if (!project) return;
  const nif = project.client.nif?.trim();

  // Arranca tudo pendente e mostra já a checklist de linha vermelha (visível de
  // imediato). Em re-execução, limpa campos/fontes anteriores.
  await prisma.preDiagnostico.upsert({
    where: { projectId },
    update: {
      estado: "pendente", estadoVies: "pendente", estadoApiEmpresas: "pendente", estadoSonar: "pendente", estadoSonnet: "pendente",
      estadoElegibilidade: "pendente", elegibilidadeDetalhe: null,
      campos: [] as object, fontesSonar: [] as object, checklistAConfirmar: CHECKLIST_BASE as object, executadoEm: null,
    },
    create: { projectId, estado: "pendente", checklistAConfirmar: CHECKLIST_BASE as object },
  });

  if (!nif) {
    await prisma.preDiagnostico.update({
      where: { projectId },
      data: { estado: "falhou", estadoVies: "falhou", estadoApiEmpresas: "falhou", estadoSonar: "falhou", estadoSonnet: "falhou", estadoElegibilidade: "indisponivel", checklistAConfirmar: CHECKLIST_BASE as object, executadoEm: new Date() },
    });
    return;
  }

  const campos: PreDiagCampo[] = [];

  // Faixa A — VIES (oficial, nasce validado). Grava o progresso ao terminar.
  const vies = await consultarVies(nif);
  if (vies.estado === "ok" && vies.valid) {
    if (vies.nome) campos.push({ key: "nome", label: "Denominação social", value: vies.nome, origem: "oficial_vies", estado: "validado", fonte: "VIES (Comissão Europeia)" });
    if (vies.morada) campos.push({ key: "morada", label: "Morada", value: vies.morada, origem: "oficial_vies", estado: "validado", fonte: "VIES (Comissão Europeia)" });
  }
  await prisma.preDiagnostico.update({
    where: { projectId },
    data: { estadoVies: vies.estado, campos: campos as object, brutoVies: vies.bruto as object },
  });

  // Faixa B — API de empresas (comercial, por validar) + normalização CAE (953)
  const emp = await consultarEmpresas(nif);
  if (emp.estado === "ok") {
    if (emp.cae) {
      const cat = await prisma.catalogoCae.findUnique({ where: { codigo: emp.cae.replace(/[^0-9]/g, "") } });
      const desc = cat?.designacao ?? emp.caeDescricao;
      campos.push({ key: "cae_principal", label: "CAE principal", value: `${emp.cae}${desc ? ` — ${desc}` : ""}`, origem: "api_empresas", estado: "por_validar", fonte: "nif.pt" });
    }
    if (emp.naturezaJuridica) campos.push({ key: "natureza_juridica", label: "Natureza jurídica", value: emp.naturezaJuridica, origem: "api_empresas", estado: "por_validar", fonte: "nif.pt" });
    if (emp.capitalSocial != null) campos.push({ key: "capital_social", label: "Capital social", value: emp.capitalSocial, origem: "api_empresas", estado: "por_validar", fonte: "nif.pt" });
    if (emp.concelho) campos.push({ key: "concelho", label: "Concelho", value: emp.concelho, origem: "api_empresas", estado: "por_validar", fonte: "nif.pt" });
    // Freguesia (TRNSF-1040): essencial para resolver a baixa densidade em
    // concelhos parciais. Quando a API não a devolve, deixa o campo editável
    // (vazio) para o consultor indicar a freguesia da sede.
    if (emp.concelho) campos.push({ key: "freguesia", label: "Freguesia", value: emp.freguesia, origem: "api_empresas", estado: "por_validar", fonte: "nif.pt" });
    if (emp.distrito) campos.push({ key: "distrito", label: "Distrito", value: emp.distrito, origem: "api_empresas", estado: "por_validar", fonte: "nif.pt" });
  }
  await prisma.preDiagnostico.update({
    where: { projectId },
    data: { estadoApiEmpresas: emp.estado, campos: campos as object, brutoApiEmpresas: emp.bruto as object },
  });

  // Faixa C (recolha) — Sonar (contexto + fontes)
  const sonar = await consultarSonar(nif, vies.nome);
  await prisma.preDiagnostico.update({
    where: { projectId },
    data: { estadoSonar: sonar.estado, fontesSonar: sonar.fontes as object },
  });

  // Faixa C (juízo) — Sonnet estrutura A+B+C
  const sonnet = await estruturarSonnet({ nif, nome: vies.nome, caeApi: emp.cae, caeDescricao: emp.caeDescricao, contextoSonar: sonar.contexto });
  if (sonnet.estado === "ok") {
    const fonte = "Pré-diagnóstico (IA)";
    if (sonnet.leitura.setor) campos.push({ key: "setor", label: "Setor (leitura)", value: sonnet.leitura.setor, origem: "pre_diagnostico_ia", estado: "por_validar", fonte });
    if (sonnet.leitura.caeProvavel) campos.push({ key: "cae_provavel", label: "CAE provável (leitura)", value: sonnet.leitura.caeProvavel, origem: "pre_diagnostico_ia", estado: "por_validar", fonte });
    if (sonnet.leitura.tipologiaAviso) campos.push({ key: "tipologia_aviso", label: "Tipologia de aviso aparente", value: sonnet.leitura.tipologiaAviso, origem: "pre_diagnostico_ia", estado: "por_validar", fonte });
    if (sonnet.leitura.sinais) campos.push({ key: "sinais", label: "Sinais de candidatabilidade", value: sonnet.leitura.sinais, origem: "pre_diagnostico_ia", estado: "por_validar", fonte });
  }

  // Faixa D — Elegibilidade do aviso (do PDF), quando há aviso escolhido.
  // Importa como PROPOSTA (por_validar); não sobrescreve uma já validada.
  let estadoElegibilidade: FaixaEstado = "indisponivel";
  let elegibilidadeDetalhe: string | null = "Sem aviso escolhido — escolha o aviso para importar a elegibilidade.";
  const diag = await prisma.diagnostic.findUnique({ where: { projectId }, select: { meritGridId: true, avisoConfirmado: true } });
  if (diag?.avisoConfirmado && diag.meritGridId) {
    const grid = await prisma.meritGrid.findUnique({ where: { id: diag.meritGridId }, select: { id: true, fonteUrl: true, eligibilidade: true } });
    const eligRaw = (grid?.eligibilidade ?? null) as { estado?: string } | null;
    if (eligRaw?.estado === "validado") {
      estadoElegibilidade = "ok";
      elegibilidadeDetalhe = "Elegibilidade já validada para este aviso.";
    } else if (grid?.fonteUrl) {
      const { proposta, nota } = await extrairElegibilidadeDoAviso(grid.fonteUrl);
      const temAlgo = proposta.caeElegiveis.length > 0 || proposta.nuts2Elegiveis.length > 0 || proposta.exigeBaixaDensidade || proposta.naturezasElegiveis.length > 0;
      await prisma.meritGrid.update({ where: { id: grid.id }, data: { eligibilidade: { ...proposta, fonteUrl: grid.fonteUrl } as object } });
      estadoElegibilidade = temAlgo ? "ok" : "falhou";
      elegibilidadeDetalhe = temAlgo
        ? `${proposta.caeElegiveis.length} CAE · ${proposta.nuts2Elegiveis.length} região(ões) propostos (por validar)`
        : nota;
    } else {
      estadoElegibilidade = "falhou";
      elegibilidadeDetalhe = "Aviso sem URL do PDF — defina a Fonte para importar.";
    }
  }

  const checklist = [...CHECKLIST_BASE, ...sonnet.checklistExtra];
  // se nenhuma faixa correu, marca falhou; senão concluído
  const algumaOk = [vies.estado, emp.estado, sonar.estado, sonnet.estado].includes("ok");

  await prisma.preDiagnostico.update({
    where: { projectId },
    data: {
      estado: algumaOk ? "concluido" : "falhou",
      estadoSonnet: sonnet.estado,
      estadoElegibilidade,
      elegibilidadeDetalhe,
      campos: campos as object,
      checklistAConfirmar: checklist as object,
      executadoEm: new Date(),
    },
  });

  // Notifica a consultora responsável (vista no Diagnóstico)
  await prisma.activityLog.create({
    data: {
      projectId,
      type: "pre_diagnostico",
      description: algumaOk ? "Pré-diagnóstico pronto para validação." : "Pré-diagnóstico falhou em todas as faixas.",
    },
  });
}

type Row = {
  projectId: string;
  estado: string;
  estadoVies: string;
  estadoApiEmpresas: string;
  estadoSonar: string;
  estadoSonnet: string;
  estadoElegibilidade: string;
  elegibilidadeDetalhe: string | null;
  campos: unknown;
  checklistAConfirmar: unknown;
  fontesSonar: unknown;
  brutoVies: unknown;
  brutoApiEmpresas: unknown;
  executadoEm: Date | null;
};

/**
 * Razão curta e legível da falha de uma faixa, a partir do JSON em bruto
 * guardado (status HTTP, erro de rede ou mensagem/result da própria API). Não
 * expõe segredos: o bruto é a *resposta*, nunca o pedido (a chave vai no URL).
 */
function razaoFalha(bruto: unknown): string | null {
  if (!bruto || typeof bruto !== "object") return null;
  const b = bruto as Record<string, unknown>;
  if (typeof b.erro === "string") return b.erro;
  if (typeof b.status === "number") return `HTTP ${b.status}`;
  if (typeof b.message === "string") return b.message;
  if (typeof b.result === "string" && b.result.toLowerCase() !== "success") return `resposta: ${b.result}`;
  return null;
}

function toDTO(row: Row): PreDiagnosticoDTO {
  return {
    projectId: row.projectId,
    estado: row.estado as PreDiagnosticoDTO["estado"],
    faixas: {
      vies: row.estadoVies as FaixaEstado,
      apiEmpresas: row.estadoApiEmpresas as FaixaEstado,
      sonar: row.estadoSonar as FaixaEstado,
      sonnet: row.estadoSonnet as FaixaEstado,
      elegibilidade: row.estadoElegibilidade as FaixaEstado,
    },
    faixasDetalhe: {
      vies: row.estadoVies === "falhou" ? razaoFalha(row.brutoVies) : null,
      apiEmpresas: row.estadoApiEmpresas === "falhou" ? razaoFalha(row.brutoApiEmpresas) : null,
      elegibilidade: row.elegibilidadeDetalhe ?? null,
    },
    campos: Array.isArray(row.campos) ? (row.campos as PreDiagCampo[]) : [],
    checklistAConfirmar: Array.isArray(row.checklistAConfirmar) ? (row.checklistAConfirmar as ChecklistAConfirmar[]) : [],
    fontesSonar: Array.isArray(row.fontesSonar) ? (row.fontesSonar as string[]) : [],
    executadoEm: row.executadoEm?.toISOString() ?? null,
  };
}

export async function buildPreDiagnosticoDTO(projectId: string): Promise<PreDiagnosticoDTO> {
  const row = await prisma.preDiagnostico.findUnique({ where: { projectId } });
  if (!row) {
    return { projectId, estado: "inexistente", faixas: { vies: "pendente", apiEmpresas: "pendente", sonar: "pendente", sonnet: "pendente", elegibilidade: "pendente" }, campos: [], checklistAConfirmar: [], fontesSonar: [], executadoEm: null };
  }
  return toDTO(row as unknown as Row);
}

/** Validar/corrigir um campo do pré-diagnóstico (campo a campo). */
export async function updatePreDiagCampo(
  projectId: string,
  key: string,
  action: "validar" | "corrigir",
  value: string | number | null | undefined,
): Promise<PreDiagnosticoDTO | null> {
  const row = await prisma.preDiagnostico.findUnique({ where: { projectId } });
  if (!row) return null;
  const campos = Array.isArray(row.campos) ? (row.campos as unknown as PreDiagCampo[]) : [];
  const idx = campos.findIndex((c) => c.key === key);
  if (idx < 0) return null;
  const campo = campos[idx]!;
  campos[idx] = action === "corrigir"
    ? { ...campo, value: value ?? null, estado: "corrigido" }
    : { ...campo, estado: "validado" };
  await prisma.preDiagnostico.update({ where: { projectId }, data: { campos: campos as object } });
  return buildPreDiagnosticoDTO(projectId);
}
