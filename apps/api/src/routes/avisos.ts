import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  canManageUsers,
  hasPermission,
  meritGridDataSchema,
  accessConditionSchema,
  parseMeritGrid,
  type AccessCondition,
  type AvisoAdminListItemDTO,
  type AvisoElegibilidadeLike,
  type AvisoFullDTO,
  type MeritGridData,
} from "@estrategor/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { extrairGrelhaDoAviso } from "../extraction/grelha.js";

// ─── Validação do corpo (metadados + grelha + condições + elegibilidade) ─────
const eligibilidadeSchema = z.object({
  caeElegiveis: z.array(z.string()).default([]),
  nuts2Elegiveis: z.array(z.string()).default([]),
  exigeBaixaDensidade: z.boolean().default(false),
  naturezasElegiveis: z.array(z.string()).default([]),
  estado: z.enum(["por_validar", "validado"]).default("por_validar"),
  notas: z.string().nullable().optional(),
  fonteUrl: z.string().nullable().optional(),
});

const avisoBodySchema = z.object({
  programCode: z.string().trim().min(1, "Indique o programa."),
  measure: z.string().trim().min(1, "Indique a medida."),
  codigoAviso: z.string().trim().min(1, "Indique o código do aviso."),
  regiao: z.string().trim().min(1).nullable().optional(),
  versao: z.string().trim().min(1, "Indique a versão."),
  fonteUrl: z.string().trim().nullable().optional(),
  mpMinimo: z.number().finite().nullable().optional(),
  minimoPorCriterio: z.number().finite().nullable().optional(),
  formulaMp: z.string().trim().nullable().optional(),
  grid: meritGridDataSchema,
  accessConditions: z.array(accessConditionSchema).default([]),
  eligibilidade: eligibilidadeSchema.nullable().optional(),
  extracted: z.boolean().default(false),
});

type AvisoBody = z.infer<typeof avisoBodySchema>;

// Linha do MeritGrid tal como vem do Prisma (campos que usamos).
type GridRow = {
  id: string;
  programCode: string;
  measure: string;
  codigoAviso: string;
  regiao: string | null;
  versao: string;
  fonteUrl: string | null;
  mpMinimo: Prisma.Decimal | null;
  minimoPorCriterio: Prisma.Decimal | null;
  formulaMp: string | null;
  grid: Prisma.JsonValue;
  accessConditions: Prisma.JsonValue;
  eligibilidade: Prisma.JsonValue;
  extracted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function lerCondicoes(raw: Prisma.JsonValue): AccessCondition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const key = typeof o.key === "string" ? o.key : "";
      const label = typeof o.label === "string" ? o.label : "";
      return key && label ? { key, label } : null;
    })
    .filter((c): c is AccessCondition => !!c);
}

function lerElegibilidade(
  raw: Prisma.JsonValue,
): AvisoElegibilidadeLike | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  return {
    caeElegiveis: arr(e.caeElegiveis),
    nuts2Elegiveis: arr(e.nuts2Elegiveis),
    exigeBaixaDensidade: e.exigeBaixaDensidade === true,
    naturezasElegiveis: arr(e.naturezasElegiveis),
    estado: e.estado === "validado" ? "validado" : "por_validar",
    notas: typeof e.notas === "string" ? e.notas : null,
    fonteUrl: typeof e.fonteUrl === "string" ? e.fonteUrl : null,
  };
}

function toListItem(g: GridRow): AvisoAdminListItemDTO {
  const grid = (g.grid ?? null) as unknown as MeritGridData | null;
  const elig = lerElegibilidade(g.eligibilidade);
  return {
    id: g.id,
    programCode: g.programCode,
    measure: g.measure,
    codigoAviso: g.codigoAviso,
    regiao: g.regiao,
    versao: g.versao,
    fonteUrl: g.fonteUrl,
    extracted: g.extracted,
    mpMinimo: g.mpMinimo === null ? null : Number(g.mpMinimo),
    nCriterios: Array.isArray(grid?.criterios) ? grid!.criterios.length : 0,
    nCondicoes: lerCondicoes(g.accessConditions).length,
    eligibilidadeEstado: elig ? elig.estado : "nenhuma",
    updatedAt: g.updatedAt ? g.updatedAt.toISOString() : null,
  };
}

function toFullDTO(g: GridRow): AvisoFullDTO {
  return {
    id: g.id,
    programCode: g.programCode,
    measure: g.measure,
    codigoAviso: g.codigoAviso,
    regiao: g.regiao,
    versao: g.versao,
    fonteUrl: g.fonteUrl,
    mpMinimo: g.mpMinimo === null ? null : Number(g.mpMinimo),
    minimoPorCriterio:
      g.minimoPorCriterio === null ? null : Number(g.minimoPorCriterio),
    formulaMp: g.formulaMp,
    grid: (g.grid ?? { criterios: [] }) as unknown as MeritGridData,
    accessConditions: lerCondicoes(g.accessConditions),
    eligibilidade: lerElegibilidade(g.eligibilidade),
    extracted: g.extracted,
    createdAt: g.createdAt ? g.createdAt.toISOString() : null,
    updatedAt: g.updatedAt ? g.updatedAt.toISOString() : null,
  };
}

/** Constrói os dados a persistir a partir do corpo validado. */
function toPersist(body: AvisoBody) {
  // Mantém a grelha coerente com os metadados (a grelha é a fonte para o motor).
  const grid: MeritGridData = {
    ...body.grid,
    programa: body.programCode,
    medida: body.measure,
    codigo_aviso: body.codigoAviso,
    regiao: body.regiao ?? null,
    versao: body.versao,
    fonte_url: body.fonteUrl ?? body.grid.fonte_url,
  };
  const elig: AvisoElegibilidadeLike | null = body.eligibilidade
    ? {
        caeElegiveis: body.eligibilidade.caeElegiveis
          .map((s) => s.trim())
          .filter(Boolean),
        nuts2Elegiveis: body.eligibilidade.nuts2Elegiveis,
        exigeBaixaDensidade: body.eligibilidade.exigeBaixaDensidade,
        naturezasElegiveis: body.eligibilidade.naturezasElegiveis
          .map((s) => s.trim())
          .filter(Boolean),
        estado: body.eligibilidade.estado,
        notas: body.eligibilidade.notas ?? null,
        fonteUrl: body.eligibilidade.fonteUrl ?? body.fonteUrl ?? null,
      }
    : null;
  return {
    programCode: body.programCode,
    measure: body.measure,
    codigoAviso: body.codigoAviso,
    regiao: body.regiao ?? null,
    versao: body.versao,
    fonteUrl: body.fonteUrl ?? null,
    mpMinimo: body.mpMinimo ?? grid.mp_minimo ?? null,
    minimoPorCriterio:
      body.minimoPorCriterio ?? grid.minimo_por_criterio ?? null,
    formulaMp: body.formulaMp ?? grid.formula_mp ?? null,
    grid: grid as unknown as Prisma.InputJsonValue,
    accessConditions: body.accessConditions as unknown as Prisma.InputJsonValue,
    eligibilidade: (elig ?? undefined) as Prisma.InputJsonValue | undefined,
    extracted: body.extracted,
  };
}

export async function avisosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Guarda: todas as rotas do catálogo são só de admin.
  function exigeAdmin(
    req: { user?: { role: import("@estrategor/shared").Role; permissions?: string[] } },
    reply: { code: (c: number) => { send: (b: unknown) => unknown } },
  ): boolean {
    // Papel de gestão OU permissão explícita "gerir_avisos" (TRNSF-1056).
    const u = req.user;
    if (!u || (!canManageUsers(u.role) && !hasPermission(u, "gerir_avisos"))) {
      reply
        .code(403)
        .send({
          error: "Só um administrador pode gerir o catálogo de avisos.",
        });
      return false;
    }
    return true;
  }

  // Lista de avisos (rascunhos + publicados), mais recentes primeiro.
  app.get("/api/avisos", async (req, reply) => {
    if (!exigeAdmin(req, reply)) return;
    const grids = (await prisma.meritGrid.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    })) as unknown as GridRow[];
    return grids.map(toListItem);
  });

  // Detalhe completo (editor).
  app.get<{ Params: { id: string } }>("/api/avisos/:id", async (req, reply) => {
    if (!exigeAdmin(req, reply)) return;
    const g = (await prisma.meritGrid.findUnique({
      where: { id: req.params.id },
    })) as unknown as GridRow | null;
    if (!g) return reply.code(404).send({ error: "Aviso não encontrado." });
    return toFullDTO(g);
  });

  // Criar aviso (rascunho por defeito; a IA propõe, o admin valida).
  app.post("/api/avisos", async (req, reply) => {
    if (!exigeAdmin(req, reply)) return;
    const parsed = avisoBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const data = toPersist(parsed.data);
    try {
      const created = (await prisma.meritGrid.create({
        data: { ...data, createdByUserId: req.user!.id },
      })) as unknown as GridRow;
      return reply.code(201).send(toFullDTO(created));
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return reply
          .code(409)
          .send({
            error:
              "Já existe um aviso com o mesmo programa·medida·código·região·versão.",
          });
      }
      throw e;
    }
  });

  // Atualizar aviso (metadados + grelha + condições + elegibilidade + estado).
  app.put<{ Params: { id: string } }>("/api/avisos/:id", async (req, reply) => {
    if (!exigeAdmin(req, reply)) return;
    const exists = await prisma.meritGrid.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!exists)
      return reply.code(404).send({ error: "Aviso não encontrado." });
    const parsed = avisoBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const data = toPersist(parsed.data);
    try {
      const updated = (await prisma.meritGrid.update({
        where: { id: req.params.id },
        data,
      })) as unknown as GridRow;
      return toFullDTO(updated);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return reply
          .code(409)
          .send({
            error:
              "Já existe um aviso com o mesmo programa·medida·código·região·versão.",
          });
      }
      throw e;
    }
  });

  // Apagar — bloqueado se algum projeto já o referencia (despublicar em vez de apagar).
  app.delete<{ Params: { id: string } }>(
    "/api/avisos/:id",
    async (req, reply) => {
      if (!exigeAdmin(req, reply)) return;
      const g = await prisma.meritGrid.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!g) return reply.code(404).send({ error: "Aviso não encontrado." });
      const emUso = await prisma.diagnostic.count({
        where: { meritGridId: req.params.id },
      });
      if (emUso > 0) {
        return reply
          .code(409)
          .send({
            error:
              "Aviso em uso por projetos — desative-o (despublique) em vez de apagar.",
          });
      }
      await prisma.meritGrid.delete({ where: { id: req.params.id } });
      return { ok: true };
    },
  );

  // Importar a grelha do PDF do aviso (a IA PROPÕE; NÃO persiste). Devolve a
  // proposta para o admin editar e só depois criar. Falhas → 200 com esqueleto.
  app.post<{ Body: { fonteUrl?: string } }>(
    "/api/avisos/importar",
    async (req, reply) => {
      if (!exigeAdmin(req, reply)) return;
      const fonteUrl =
        typeof req.body?.fonteUrl === "string" ? req.body.fonteUrl.trim() : "";
      const proposta = await extrairGrelhaDoAviso(fonteUrl);
      void parseMeritGrid; // validação corre dentro do extractor (nota se inválida)
      return proposta;
    },
  );
}
