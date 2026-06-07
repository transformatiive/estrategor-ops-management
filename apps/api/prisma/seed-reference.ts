/**
 * Seed de REFERÊNCIA (catálogo) — seguro para produção e idempotente.
 *
 * Popula apenas dados de referência que a app precisa para funcionar:
 *   - Programas (PT2030, RFAI, SIFIDE, Formação)
 *   - Tipos de documento (taxonomia §6)
 *   - Grelha de mérito real (SICE Qualificação MPr-2025-2) + condições de acesso
 *
 * NÃO cria utilizadores, clientes nem projetos de demonstração. Pode ser
 * executado várias vezes sem duplicar (upsert por chave natural).
 *
 *   pnpm --filter @estrategor/api prisma:seed:ref
 */
import { PrismaClient } from "@prisma/client";
import {
  ACCESS_CONDITIONS_MPR_2025_9,
  ANEXOS,
  CAE_AMOSTRA,
  CATEGORIAS_CUSTO,
  CONCELHOS,
  DOCUMENT_TAXONOMY,
  DOMINIOS_INTL,
  INDICADORES,
  PAISES,
  QUALIFICACAO_MPR_2025_2,
  RUBRICAS_SNC,
  type ProgramCode,
} from "@estrategor/shared";

const prisma = new PrismaClient();

const PROGRAMS: { code: ProgramCode; name: string }[] = [
  { code: "PT2030", name: "Portugal 2030" },
  { code: "RFAI", name: "Regime Fiscal de Apoio ao Investimento" },
  { code: "SIFIDE", name: "Sistema de Incentivos Fiscais à I&D Empresarial" },
  { code: "FORMACAO", name: "Formação Financiada" },
];

/** Popula/atualiza os dados de referência. Idempotente. */
export async function seedReference(): Promise<void> {
  console.log("→ Referência: programas…");
  for (const p of PROGRAMS) {
    await prisma.program.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: p,
    });
  }

  console.log("→ Referência: tipos de documento (taxonomia §6)…");
  for (const d of DOCUMENT_TAXONOMY) {
    await prisma.documentType.upsert({
      where: { key: d.key },
      update: {
        name: d.name,
        purpose: d.purpose,
        appliesTo: d.appliesTo === "all" ? ["ALL"] : d.appliesTo,
        targetFolder: d.targetFolder,
        hasExpiry: d.hasExpiry ?? false,
      },
      create: {
        key: d.key,
        name: d.name,
        purpose: d.purpose,
        appliesTo: d.appliesTo === "all" ? ["ALL"] : d.appliesTo,
        targetFolder: d.targetFolder,
        hasExpiry: d.hasExpiry ?? false,
      },
    });
  }

  console.log("→ Referência: grelha de mérito (SICE Qualificação MPr-2025-2)…");
  const g = QUALIFICACAO_MPR_2025_2;
  const gridData = {
    programCode: g.programa,
    measure: g.medida,
    codigoAviso: g.codigo_aviso,
    regiao: g.regiao,
    versao: g.versao,
    fonteUrl: g.fonte_url,
    mpMinimo: g.mp_minimo,
    minimoPorCriterio: g.minimo_por_criterio,
    formulaMp: g.formula_mp,
    grid: g as object,
    accessConditions: ACCESS_CONDITIONS_MPR_2025_9 as object,
    extracted: true,
  };
  // Prisma não permite upsert numa chave única composta com componente null
  // (regiao é null aqui), por isso fazemos find-then-create/update manual.
  const existingGrid = await prisma.meritGrid.findFirst({
    where: {
      programCode: g.programa,
      measure: g.medida,
      codigoAviso: g.codigo_aviso,
      regiao: g.regiao,
      versao: g.versao,
    },
  });
  if (existingGrid) {
    await prisma.meritGrid.update({ where: { id: existingGrid.id }, data: gridData });
  } else {
    await prisma.meritGrid.create({ data: gridData });
  }

  // ── Catálogos / Rulebook (TRNSF-953) — idempotente ──
  console.log("→ Referência: catálogos (rulebook)…");
  for (const c of CAE_AMOSTRA) {
    await prisma.catalogoCae.upsert({ where: { codigo: c.codigo }, update: { designacao: c.designacao }, create: c });
  }
  for (const p of PAISES) {
    await prisma.catalogoPais.upsert({ where: { codigo: p.codigo }, update: { nome: p.nome }, create: p });
  }
  for (const g of CONCELHOS) {
    const existing = await prisma.catalogoGeo.findFirst({
      where: { nuts2: g.nuts2, nuts3: g.nuts3, concelho: g.concelho, freguesia: null },
    });
    const data = {
      nuts2: g.nuts2,
      nuts3: g.nuts3,
      concelho: g.concelho,
      freguesia: null,
      baixaDensidade: g.baixaDensidade,
      regiaoPrograma: g.nuts2,
    };
    if (existing) await prisma.catalogoGeo.update({ where: { id: existing.id }, data });
    else await prisma.catalogoGeo.create({ data });
  }
  for (const r of RUBRICAS_SNC) {
    await prisma.catalogoRubricaSnc.upsert({
      where: { tipo_codigo: { tipo: r.tipo, codigo: r.codigo } },
      update: { designacao: r.designacao, vidaUtil: r.vidaUtil ?? null },
      create: { tipo: r.tipo, codigo: r.codigo, designacao: r.designacao, vidaUtil: r.vidaUtil ?? null },
    });
  }
  for (const c of CATEGORIAS_CUSTO) {
    await prisma.catalogoCategoriaCusto.upsert({
      where: { familia_codigo: { familia: c.familia, codigo: c.codigo } },
      update: { designacao: c.designacao },
      create: c,
    });
  }
  for (const i of INDICADORES) {
    await prisma.catalogoIndicador.upsert({
      where: { codigo: i.codigo },
      update: { designacao: i.designacao, unidade: i.unidade ?? null, dominio: i.dominio ?? null },
      create: { codigo: i.codigo, designacao: i.designacao, unidade: i.unidade ?? null, dominio: i.dominio ?? null },
    });
  }
  for (const d of DOMINIOS_INTL) {
    await prisma.catalogoDominioIntl.upsert({ where: { numero: d.numero }, update: { designacao: d.designacao }, create: d });
  }
  // tipos de documento: deriva do mesmo catálogo da taxonomia (937/938)
  for (const dt of DOCUMENT_TAXONOMY) {
    await prisma.catalogoTipoDocumento.upsert({
      where: { codigo: dt.key },
      update: { designacao: dt.name, subpastaWorkdrive: dt.targetFolder },
      create: { codigo: dt.key, designacao: dt.name, subpastaWorkdrive: dt.targetFolder },
    });
  }
  for (const a of ANEXOS) {
    await prisma.catalogoAnexo.upsert({
      where: { familia_codigo: { familia: a.familia, codigo: a.codigo } },
      update: { nivel: a.nivel, designacao: a.designacao, condicao: a.condicao ?? null, obrigatorio: a.obrigatorio },
      create: { familia: a.familia, nivel: a.nivel, codigo: a.codigo, designacao: a.designacao, condicao: a.condicao ?? null, obrigatorio: a.obrigatorio },
    });
  }

  const programs = await prisma.program.count();
  const docTypes = await prisma.documentType.count();
  const grids = await prisma.meritGrid.count();
  const cae = await prisma.catalogoCae.count();
  const geo = await prisma.catalogoGeo.count();
  const indic = await prisma.catalogoIndicador.count();
  console.log(
    `✓ Referência: ${programs} programas, ${docTypes} tipos de documento, ${grids} grelha(s) de mérito.`,
  );
  console.log(
    `✓ Catálogos: ${cae} CAE, ${geo} concelhos, ${indic} indicadores, ${PAISES.length} países, ${RUBRICAS_SNC.length} rubricas SNC, ${CATEGORIAS_CUSTO.length} categorias custo, ${DOMINIOS_INTL.length} domínios intl, ${ANEXOS.length} anexos.`,
  );
}

// Permite correr diretamente: tsx prisma/seed-reference.ts
const isMain =
  process.argv[1]?.endsWith("seed-reference.ts") ||
  process.argv[1]?.endsWith("seed-reference.js");
if (isMain) {
  seedReference()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
