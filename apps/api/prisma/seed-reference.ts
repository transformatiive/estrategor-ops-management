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
  DOCUMENT_TAXONOMY,
  QUALIFICACAO_MPR_2025_2,
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

  const programs = await prisma.program.count();
  const docTypes = await prisma.documentType.count();
  const grids = await prisma.meritGrid.count();
  console.log(
    `✓ Referência: ${programs} programas, ${docTypes} tipos de documento, ${grids} grelha(s) de mérito.`,
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
