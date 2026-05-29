/**
 * Seed de desenvolvimento — recria os dados do protótipo estático para a SPA ter
 * conteúdo realista enquanto os Épicos A–G não estão completos.
 *
 * NOTA: os utilizadores recebem um placeholder de password_hash. O hashing real
 * (argon2) é introduzido no Épico A; até lá o login ainda não está implementado.
 */
import { PrismaClient } from "@prisma/client";
import {
  DOCUMENT_TAXONOMY,
  documentTypesForProgram,
  type ProgramCode,
} from "@estrategor/shared";

const prisma = new PrismaClient();

const PLACEHOLDER_HASH = "PLACEHOLDER_DEFINIR_NO_EPICO_A";

const USERS = [
  { fullName: "Joana Sequeira", email: "joana@estrategor.pt", initials: "JS", color: "green", role: "ADMIN" as const },
  { fullName: "Tiago Ferreira", email: "tiago@estrategor.pt", initials: "TF", color: "blue", role: "PADRAO" as const },
  { fullName: "Miguel Alves", email: "miguel@estrategor.pt", initials: "MA", color: "orange", role: "PADRAO" as const },
  { fullName: "Diana Ribeiro", email: "diana@estrategor.pt", initials: "DM", color: "orange", role: "PADRAO" as const },
  { fullName: "Maria Pinto", email: "maria@estrategor.pt", initials: "MP", color: "teal", role: "PADRAO" as const },
  { fullName: "Jerónimo Rocha", email: "jeronimo@estrategor.pt", initials: "JR", color: "purple", role: "PADRAO" as const },
  { fullName: "Nuno Sousa", email: "nuno@estrategor.pt", initials: "NS", color: "teal", role: "PADRAO" as const },
];

const PROGRAMS: { code: ProgramCode; name: string }[] = [
  { code: "PT2030", name: "Portugal 2030" },
  { code: "RFAI", name: "Regime Fiscal de Apoio ao Investimento" },
  { code: "SIFIDE", name: "Sistema de Incentivos Fiscais à I&D Empresarial" },
  { code: "FORMACAO", name: "Formação Financiada" },
];

interface SeedProject {
  code: string;
  title: string;
  clientName: string;
  nif?: string;
  program: ProgramCode;
  state: "A0" | "A1" | "A2" | "A3" | "A4" | "B0" | "B1" | "B2";
  investment?: number;
  incentive?: number;
  nextAction?: string;
  progress: number;
  responsibles: string[]; // iniciais
}

const PROJECTS: SeedProject[] = [
  { code: "PT2030-2024-0182", title: "DIRSIL — Transformação Digital", clientName: "DIRSIL, S.A.", nif: "PT2030-2024-0182", program: "PT2030", state: "B1", investment: 1850000, incentive: 925000, nextAction: "02 Jun 2026 — Pedido Pagamento #3", progress: 62, responsibles: ["TF", "JS"] },
  { code: "PT2030-2024-0095", title: "GEPACK — Eficiência Energética", clientName: "GEPACK Embalagens, Lda", nif: "PT2030-2024-0095", program: "PT2030", state: "B1", investment: 620000, incentive: 310000, nextAction: "10 Jun 2026 — Relatório Intercalar", progress: 38, responsibles: ["MA"] },
  { code: "PT2030-2023-0410", title: "Lingote Indústria — Inovação", clientName: "Lingote Indústria, S.A.", program: "PT2030", state: "B2", nextAction: "30 Jun 2026 — Encerramento Administrativo", progress: 91, responsibles: ["JS"] },
  { code: "RFAI-2023-0341", title: "KEMI — I&D Aplicado 2023", clientName: "KEMI Portugal, S.A.", nif: "RFAI-2023-0341", program: "RFAI", state: "B0", investment: 1200000, incentive: 360000, nextAction: "15 Jul 2026 — Mapa de Investimento Final", progress: 80, responsibles: ["JR", "NS"] },
  { code: "PT2030-2024-0233", title: "STRIX — Automação Produção", clientName: "STRIX Componentes, Lda", program: "PT2030", state: "B1", nextAction: "20 Set 2026", progress: 55, responsibles: ["TF"] },
  { code: "PT2030-2025-0011", title: "Borges & Irmãos — Internacionalização", clientName: "Borges & Irmãos, Lda", program: "PT2030", state: "A4", progress: 25, responsibles: ["JS"] },
  { code: "FORM-2026-A9", title: "Formação STCP — Condução de Veículos", clientName: "STCP", program: "FORMACAO", state: "B1", nextAction: "15 Jun 2026 — Dossier Técnico Pedagógico", progress: 70, responsibles: ["MP", "DM"] },
];

async function main() {
  console.log("→ Seed: limpar dados existentes…");
  // ordem respeita FKs
  await prisma.activityLog.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.collectionLink.deleteMany();
  await prisma.document.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.stateTransition.deleteMany();
  await prisma.deadline.deleteMany();
  await prisma.task.deleteMany();
  await prisma.diagnostic.deleteMany();
  await prisma.projectResponsible.deleteMany();
  await prisma.project.deleteMany();
  await prisma.meritGrid.deleteMany();
  await prisma.aviso.deleteMany();
  await prisma.client.deleteMany();
  await prisma.documentType.deleteMany();
  await prisma.program.deleteMany();
  await prisma.user.deleteMany();

  console.log("→ Seed: utilizadores…");
  const usersByInitials = new Map<string, string>();
  for (const u of USERS) {
    const created = await prisma.user.create({
      data: { ...u, passwordHash: PLACEHOLDER_HASH },
    });
    usersByInitials.set(u.initials, created.id);
  }

  console.log("→ Seed: programas…");
  const programByCode = new Map<string, string>();
  for (const p of PROGRAMS) {
    const created = await prisma.program.create({ data: p });
    programByCode.set(p.code, created.id);
  }

  console.log("→ Seed: tipos de documento (taxonomia oficial)…");
  const docTypeByKey = new Map<string, string>();
  for (const d of DOCUMENT_TAXONOMY) {
    const created = await prisma.documentType.create({
      data: {
        key: d.key,
        name: d.name,
        purpose: d.purpose,
        appliesTo: d.appliesTo === "all" ? ["ALL"] : d.appliesTo,
        targetFolder: d.targetFolder,
        hasExpiry: d.hasExpiry ?? false,
      },
    });
    docTypeByKey.set(d.key, created.id);
  }

  console.log("→ Seed: projetos + clientes + checklist…");
  for (const proj of PROJECTS) {
    const client = await prisma.client.create({
      data: { name: proj.clientName, nif: proj.nif },
    });
    const programId = programByCode.get(proj.program)!;
    const project = await prisma.project.create({
      data: {
        code: proj.code,
        title: proj.title,
        clientId: client.id,
        programId,
        state: proj.state,
        investmentTotal: proj.investment,
        incentiveValue: proj.incentive,
        nextAction: proj.nextAction,
        progress: proj.progress,
        responsibles: {
          create: proj.responsibles
            .map((i) => usersByInitials.get(i))
            .filter((id): id is string => Boolean(id))
            .map((userId) => ({ userId })),
        },
      },
    });

    // checklist gerada a partir do programa (D-01)
    for (const dt of documentTypesForProgram(proj.program)) {
      await prisma.checklistItem.create({
        data: {
          projectId: project.id,
          documentTypeId: docTypeByKey.get(dt.key)!,
          status: "EM_FALTA",
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        type: "projeto_criado",
        description: `Projeto ${proj.title} criado (seed).`,
      },
    });
  }

  const count = await prisma.project.count();
  console.log(`✓ Seed concluído: ${count} projetos, ${USERS.length} utilizadores.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
