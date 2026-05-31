import {
  type ChecklistAConfirmar,
  type FaixaEstado,
  type PreDiagCampo,
  type PreDiagnosticoDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { consultarVies } from "./vies.js";
import { consultarEmpresas } from "./empresas.js";
import { consultarSonar } from "./sonar.js";
import { estruturarSonnet } from "./sonnet.js";

/** Checklist obrigatória (linha vermelha): nunca dada como facto pela IA/API. */
const CHECKLIST_BASE: ChecklistAConfirmar[] = [
  { item: "Escalão PME (micro/pequena/média)", nota: "Confirmar oficialmente (Certificado PME / IAPMEI)." },
  { item: "Situação fiscal e contributiva", nota: "Confirmar com certidões AT e Segurança Social." },
  { item: "Rácios financeiros (autonomia financeira, etc.)", nota: "Calcular a partir da IES validada (TRNSF-944)." },
];

/**
 * Corre o pré-diagnóstico (TRNSF-967) em segundo plano, tolerante a falhas por
 * faixa. Nunca decide elegibilidade; tudo entra como rascunho com proveniência.
 */
export async function runPreDiagnostico(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { client: true } });
  if (!project) return;
  const nif = project.client.nif?.trim();

  await prisma.preDiagnostico.upsert({
    where: { projectId },
    update: { estado: "pendente", estadoVies: "pendente", estadoApiEmpresas: "pendente", estadoSonar: "pendente", estadoSonnet: "pendente" },
    create: { projectId, estado: "pendente" },
  });

  if (!nif) {
    await prisma.preDiagnostico.update({
      where: { projectId },
      data: { estado: "falhou", checklistAConfirmar: CHECKLIST_BASE as object, executadoEm: new Date() },
    });
    return;
  }

  const campos: PreDiagCampo[] = [];

  // Faixa A — VIES (oficial, nasce validado)
  const vies = await consultarVies(nif);
  if (vies.estado === "ok" && vies.valid) {
    if (vies.nome) campos.push({ key: "nome", label: "Denominação social", value: vies.nome, origem: "oficial_vies", estado: "validado", fonte: "VIES (Comissão Europeia)" });
    if (vies.morada) campos.push({ key: "morada", label: "Morada", value: vies.morada, origem: "oficial_vies", estado: "validado", fonte: "VIES (Comissão Europeia)" });
  }

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
    if (emp.distrito) campos.push({ key: "distrito", label: "Distrito", value: emp.distrito, origem: "api_empresas", estado: "por_validar", fonte: "nif.pt" });
  }

  // Faixa C — Sonar (contexto + fontes) e Sonnet (juízo estruturado)
  const sonar = await consultarSonar(nif, vies.nome);
  const sonnet = await estruturarSonnet({ nif, nome: vies.nome, caeApi: emp.cae, caeDescricao: emp.caeDescricao, contextoSonar: sonar.contexto });
  if (sonnet.estado === "ok") {
    const fonte = "Pré-diagnóstico IA (Sonar + Sonnet 4.6)";
    if (sonnet.leitura.setor) campos.push({ key: "setor", label: "Setor (leitura)", value: sonnet.leitura.setor, origem: "pre_diagnostico_ia", estado: "por_validar", fonte });
    if (sonnet.leitura.caeProvavel) campos.push({ key: "cae_provavel", label: "CAE provável (leitura)", value: sonnet.leitura.caeProvavel, origem: "pre_diagnostico_ia", estado: "por_validar", fonte });
    if (sonnet.leitura.tipologiaAviso) campos.push({ key: "tipologia_aviso", label: "Tipologia de aviso aparente", value: sonnet.leitura.tipologiaAviso, origem: "pre_diagnostico_ia", estado: "por_validar", fonte });
    if (sonnet.leitura.sinais) campos.push({ key: "sinais", label: "Sinais de candidatabilidade", value: sonnet.leitura.sinais, origem: "pre_diagnostico_ia", estado: "por_validar", fonte });
  }

  const checklist = [...CHECKLIST_BASE, ...sonnet.checklistExtra];
  // se nenhuma faixa correu, marca falhou; senão concluído
  const algumaOk = [vies.estado, emp.estado, sonar.estado, sonnet.estado].includes("ok");

  await prisma.preDiagnostico.update({
    where: { projectId },
    data: {
      estado: algumaOk ? "concluido" : "falhou",
      estadoVies: vies.estado,
      estadoApiEmpresas: emp.estado,
      estadoSonar: sonar.estado,
      estadoSonnet: sonnet.estado,
      campos: campos as object,
      checklistAConfirmar: checklist as object,
      fontesSonar: sonar.fontes as object,
      brutoVies: vies.bruto as object,
      brutoApiEmpresas: emp.bruto as object,
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
  campos: unknown;
  checklistAConfirmar: unknown;
  fontesSonar: unknown;
  executadoEm: Date | null;
};

function toDTO(row: Row): PreDiagnosticoDTO {
  return {
    projectId: row.projectId,
    estado: row.estado as PreDiagnosticoDTO["estado"],
    faixas: {
      vies: row.estadoVies as FaixaEstado,
      apiEmpresas: row.estadoApiEmpresas as FaixaEstado,
      sonar: row.estadoSonar as FaixaEstado,
      sonnet: row.estadoSonnet as FaixaEstado,
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
    return { projectId, estado: "inexistente", faixas: { vies: "pendente", apiEmpresas: "pendente", sonar: "pendente", sonnet: "pendente" }, campos: [], checklistAConfirmar: [], fontesSonar: [], executadoEm: null };
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
