import type { FastifyInstance } from "fastify";
import type { RulebookDTO } from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";

/**
 * Catálogos / Rulebook (TRNSF-953) — leitura. As secções da candidatura, a
 * checklist e a extração consomem destes endpoints (sem listas hard-coded).
 */
export async function catalogosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Rulebook completo (catálogos de referência)
  app.get("/api/catalogos", async () => {
    const [cae, paises, geo, rubricas, categorias, indicadores, dominios, tiposDoc, anexos] =
      await Promise.all([
        prisma.catalogoCae.findMany({ orderBy: { codigo: "asc" } }),
        prisma.catalogoPais.findMany({ orderBy: { nome: "asc" } }),
        prisma.catalogoGeo.findMany({ orderBy: [{ nuts2: "asc" }, { concelho: "asc" }] }),
        prisma.catalogoRubricaSnc.findMany({ orderBy: [{ tipo: "asc" }, { codigo: "asc" }] }),
        prisma.catalogoCategoriaCusto.findMany({ orderBy: [{ familia: "asc" }, { codigo: "asc" }] }),
        prisma.catalogoIndicador.findMany({ orderBy: { codigo: "asc" } }),
        prisma.catalogoDominioIntl.findMany({ orderBy: { numero: "asc" } }),
        prisma.catalogoTipoDocumento.findMany({ orderBy: { codigo: "asc" } }),
        prisma.catalogoAnexo.findMany({ orderBy: [{ familia: "asc" }, { nivel: "asc" }, { codigo: "asc" }] }),
      ]);

    const dto: RulebookDTO = {
      cae: cae.map((c) => ({ codigo: c.codigo, designacao: c.designacao })),
      paises: paises.map((p) => ({ codigo: p.codigo, nome: p.nome })),
      geo: geo.map((g) => ({ nuts2: g.nuts2, nuts3: g.nuts3, concelho: g.concelho, baixaDensidade: g.baixaDensidade })),
      rubricasSnc: rubricas.map((r) => ({ tipo: r.tipo, codigo: r.codigo, designacao: r.designacao, vidaUtil: r.vidaUtil })),
      categoriasCusto: categorias.map((c) => ({ familia: c.familia, codigo: c.codigo, designacao: c.designacao })),
      indicadores: indicadores.map((i) => ({ codigo: i.codigo, designacao: i.designacao, unidade: i.unidade, dominio: i.dominio })),
      dominiosIntl: dominios.map((d) => ({ numero: d.numero, designacao: d.designacao })),
      tiposDocumento: tiposDoc.map((t) => ({ codigo: t.codigo, designacao: t.designacao, subpastaWorkdrive: t.subpastaWorkdrive })),
      anexos: anexos.map((a) => ({ familia: a.familia, nivel: a.nivel, codigo: a.codigo, designacao: a.designacao, condicao: a.condicao, obrigatorio: a.obrigatorio })),
    };
    return dto;
  });

  // Checklist de anexos por 3 níveis, derivada do catálogo conforme família (AC #3)
  app.get<{ Params: { familia: string } }>("/api/catalogos/anexos/:familia", async (req, reply) => {
    const familia = req.params.familia;
    if (familia !== "inovacao_produtiva" && familia !== "internacionalizacao") {
      return reply.code(400).send({ error: "Família inválida." });
    }
    const anexos = await prisma.catalogoAnexo.findMany({
      where: { familia: familia as never },
      orderBy: [{ nivel: "asc" }, { codigo: "asc" }],
    });
    return {
      transversal: anexos.filter((a) => a.nivel === "transversal"),
      tipologia: anexos.filter((a) => a.nivel === "tipologia"),
      condicional: anexos.filter((a) => a.nivel === "condicional"),
    };
  });
}
