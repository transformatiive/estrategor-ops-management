import { randomUUID } from "node:crypto";
import { emptyIntakeIntl, type IntakeIntlAnswers, type IntakeIntlDTO } from "@estrategor/shared";
import { prisma } from "../db.js";

const SEC_INTAKE = "intake_intl";

async function candByToken(token: string) {
  const link = await prisma.collectionLink.findUnique({ where: { token }, include: { project: true } });
  if (!link) return null;
  const cand = await prisma.candidatura.findUnique({ where: { projectId: link.projectId } });
  return { cand: cand && cand.family === "internacionalizacao" ? cand : null };
}

async function readAnswers(candidaturaId: string): Promise<IntakeIntlAnswers> {
  const f = await prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId, section: SEC_INTAKE, key: "respostas" } } });
  return (f?.value as unknown as IntakeIntlAnswers) ?? emptyIntakeIntl();
}

export async function buildIntakeIntlDTO(token: string): Promise<IntakeIntlDTO | null> {
  const resolved = await candByToken(token);
  if (!resolved) return null;
  if (!resolved.cand) return { aplica: false, dominios: [], answers: emptyIntakeIntl() };
  const dominios = (await prisma.catalogoDominioIntl.findMany({ orderBy: { numero: "asc" } })).map((d) => ({ numero: d.numero, designacao: d.designacao }));
  return { aplica: true, dominios, answers: await readAnswers(resolved.cand.id) };
}

async function appendList(candidaturaId: string, section: string, novos: unknown[]) {
  const f = await prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId, section, key: "linhas" } } });
  const atuais = Array.isArray(f?.value) ? (f!.value as unknown[]) : [];
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section, key: "linhas" } },
    update: { value: [...atuais, ...novos] as object, origin: "intake", state: "por_validar" },
    create: { candidaturaId, section, key: "linhas", value: [...atuais, ...novos] as object, origin: "intake", state: "por_validar" },
  });
}

export async function submitIntakeIntl(token: string, answers: IntakeIntlAnswers): Promise<boolean> {
  const resolved = await candByToken(token);
  if (!resolved || !resolved.cand) return false;
  const candidaturaId = resolved.cand.id;

  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section: SEC_INTAKE, key: "respostas" } },
    update: { value: answers as object, origin: "intake", state: "por_validar" },
    create: { candidaturaId, section: SEC_INTAKE, key: "respostas", value: answers as object, origin: "intake", state: "por_validar" },
  });

  // ações por evento/país + certificações → cand_intl_acoes (960)
  const novasAcoes: unknown[] = [];
  for (const a of answers.acoes ?? []) {
    novasAcoes.push({ id: randomUUID(), dominio: Number(a.dominio) || 1, tipoAcao: String(a.designacao ?? "").trim(), mercadoPais: a.mercadoPais ?? null, ano: a.ano ?? null });
  }
  for (const cert of answers.certificacoes ?? []) {
    novasAcoes.push({ id: randomUUID(), dominio: 1, tipoAcao: `Certificação: ${cert}`, mercadoPais: null, ano: null });
  }
  if (novasAcoes.length) await appendList(candidaturaId, "acoes_intl", novasAcoes);

  // RH a contratar → cand_intl_rh (961)
  if (answers.rh?.length) {
    await appendList(candidaturaId, "intl_rh", answers.rh.map((r) => ({ id: randomUUID(), funcao: String(r.funcao ?? "").trim(), custo: r.custo ?? null, periodo: r.periodo ?? null })));
  }

  // mercados-alvo → CandField mercado_linhas/mercados_alvo (942)
  if (answers.mercadosAlvo?.length) {
    await prisma.candField.upsert({
      where: { candidaturaId_section_key: { candidaturaId, section: "mercado_linhas", key: "mercados_alvo" } },
      update: { value: answers.mercadosAlvo as object, origin: "intake", state: "por_validar" },
      create: { candidaturaId, section: "mercado_linhas", key: "mercados_alvo", value: answers.mercadosAlvo as object, origin: "intake", state: "por_validar" },
    });
  }

  return true;
}
