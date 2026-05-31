import {
  INDUSTRIA40_AMBITOS,
  temIndicadoresRpa,
  type Industria40Ambito,
  type InovacaoExtraDTO,
  type UpdateInovacaoExtraRequest,
} from "@estrategor/shared";
import { prisma } from "../db.js";

const SEC_I40 = "industria_40";
const SEC_TC = "transicao_climatica";

async function cand(projectId: string) {
  return prisma.candidatura.findUnique({ where: { projectId } });
}

function readAmbitos40(value: unknown): Record<Industria40Ambito, boolean> {
  const v = (value ?? {}) as Record<string, boolean>;
  return Object.fromEntries(INDUSTRIA40_AMBITOS.map((a) => [a, Boolean(v[a])])) as Record<Industria40Ambito, boolean>;
}

async function loadField(candidaturaId: string, section: string, key: string) {
  return prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId, section, key } } });
}

async function saveField(candidaturaId: string, section: string, key: string, value: unknown, userId: string) {
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section, key } },
    update: { value: value as object, origin: "intake", state: "validado", updatedById: userId },
    create: { candidaturaId, section, key, value: value as object, origin: "intake", state: "validado", updatedById: userId },
  });
}

/** Códigos de indicador da candidatura (para detetar RPA). */
async function indicadorCodigos(candidaturaId: string): Promise<string[]> {
  const f = await loadField(candidaturaId, "indicadores", "linhas");
  const list = Array.isArray(f?.value) ? (f!.value as { codigo: string }[]) : [];
  return list.map((i) => i.codigo);
}

export async function buildInovacaoExtraDTO(projectId: string): Promise<InovacaoExtraDTO | null> {
  const c = await cand(projectId);
  if (!c) return null;
  const i40 = await loadField(c.id, SEC_I40, "ambitos");
  const tc = await loadField(c.id, SEC_TC, "ambitos");
  const ambitosTc = Array.isArray(tc?.value) ? (tc!.value as string[]) : [];
  return {
    industria40: { ambitos: readAmbitos40(i40?.value) },
    transicaoClimatica: { ambitos: ambitosTc, temIndicadoresRpa: temIndicadoresRpa(await indicadorCodigos(c.id)) },
  };
}

export async function updateInovacaoExtra(projectId: string, input: UpdateInovacaoExtraRequest, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  if (input.industria40Ambitos) {
    const cur = readAmbitos40((await loadField(c.id, SEC_I40, "ambitos"))?.value);
    for (const a of INDUSTRIA40_AMBITOS) if (a in input.industria40Ambitos) cur[a] = Boolean(input.industria40Ambitos[a]);
    await saveField(c.id, SEC_I40, "ambitos", cur, userId);
  }
  if (input.transicaoAmbitos) {
    await saveField(c.id, SEC_TC, "ambitos", input.transicaoAmbitos.map((s) => String(s).trim()).filter(Boolean), userId);
  }
}
