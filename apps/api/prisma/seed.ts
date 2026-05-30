/**
 * Seed de desenvolvimento — recria os dados do protótipo estático para a SPA ter
 * conteúdo realista enquanto os Épicos A–G não estão completos.
 *
 * NOTA: os utilizadores recebem um placeholder de password_hash. O hashing real
 * (argon2) é introduzido no Épico A; até lá o login ainda não está implementado.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import {
  DOCUMENT_TAXONOMY,
  documentTypesForProgram,
  type ProgramCode,
} from "@estrategor/shared";

const prisma = new PrismaClient();

// Palavra-passe de demonstração para todos os utilizadores do seed.
// Em produção usa-se o bootstrap por ADMIN_EMAIL/ADMIN_PASSWORD (ver README).
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "estrategor2026";

const USERS = [
  { fullName: "Joana Sequeira", email: "joana@estrategor.pt", initials: "JS", color: "green", role: "ADMIN" as const },
  { fullName: "Tiago Ferreira", email: "tiago@estrategor.pt", initials: "TF", color: "blue", role: "GESTOR" as const },
  { fullName: "Miguel Alves", email: "miguel@estrategor.pt", initials: "MA", color: "orange", role: "GESTOR" as const },
  { fullName: "Diana Ribeiro", email: "diana@estrategor.pt", initials: "DM", color: "orange", role: "CONSULTOR" as const },
  { fullName: "Maria Pinto", email: "maria@estrategor.pt", initials: "MP", color: "teal", role: "CONSULTOR" as const },
  { fullName: "Jerónimo Rocha", email: "jeronimo@estrategor.pt", initials: "JR", color: "purple", role: "GESTOR" as const },
  { fullName: "Nuno Sousa", email: "nuno@estrategor.pt", initials: "NS", color: "teal", role: "CONSULTOR" as const },
];

const PROGRAMS: { code: ProgramCode; name: string }[] = [
  { code: "PT2030", name: "Portugal 2030" },
  { code: "RFAI", name: "Regime Fiscal de Apoio ao Investimento" },
  { code: "SIFIDE", name: "Sistema de Incentivos Fiscais à I&D Empresarial" },
  { code: "FORMACAO", name: "Formação Financiada" },
];

interface SeedMilestone {
  name: string;
  date?: string;
  status: "FEITO" | "ATIVO" | "POR_FAZER";
}

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
  milestones?: SeedMilestone[];
}

// Timeline genérica da máquina de estados (spec §8), usada quando o projeto não
// tem uma timeline específica do protótipo.
function genericMilestones(
  state: SeedProject["state"],
): SeedMilestone[] {
  const order = ["A0", "A1", "A2", "A3", "A4", "B0", "B1", "B2"];
  const names: Record<string, string> = {
    A0: "Diagnóstico A0",
    A1: "Recolha de documentos",
    A2: "Preparação da candidatura",
    A3: "Revisão",
    A4: "Submissão",
    B0: "Arranque",
    B1: "Execução",
    B2: "Encerramento",
  };
  const idx = order.indexOf(state);
  return order.map((s, i) => ({
    name: names[s]!,
    status: i < idx ? "FEITO" : i === idx ? "ATIVO" : "POR_FAZER",
  }));
}

const PROJECTS: SeedProject[] = [
  // ── PT2030 — distribuídos pelas colunas do kanban (§8) ──
  {
    code: "PT2030-2024-0182", title: "DIRSIL — Transformação Digital", clientName: "DIRSIL, S.A.", nif: "PT2030-2024-0182",
    program: "PT2030", state: "B1", investment: 1850000, incentive: 925000,
    nextAction: "02 Jun 2026 — Pedido Pagamento #3", progress: 62, responsibles: ["TF", "JS"],
    milestones: [
      { name: "Candidatura submetida", date: "Mar 2024", status: "FEITO" },
      { name: "Aprovação comunicada", date: "Set 2024", status: "FEITO" },
      { name: "Pedido Pagamento #1", date: "Dez 2024", status: "FEITO" },
      { name: "Pedido Pagamento #2", date: "Mar 2025", status: "FEITO" },
      { name: "Pedido Pagamento #3", date: "02 Jun 2026", status: "ATIVO" },
      { name: "Encerramento", date: "Dez 2026", status: "POR_FAZER" },
    ],
  },
  {
    code: "PT2030-2024-0095", title: "GEPACK — Eficiência Energética", clientName: "GEPACK Embalagens, Lda", nif: "PT2030-2024-0095",
    program: "PT2030", state: "B1", investment: 620000, incentive: 310000,
    nextAction: "10 Jun 2026 — Relatório Intercalar", progress: 38, responsibles: ["MA"],
    milestones: [
      { name: "Candidatura submetida", date: "Jun 2024", status: "FEITO" },
      { name: "Aprovação comunicada", date: "Nov 2024", status: "FEITO" },
      { name: "Relatório Intercalar", date: "10 Jun 2026", status: "ATIVO" },
      { name: "Encerramento", date: "2027", status: "POR_FAZER" },
    ],
  },
  {
    code: "PT2030-2023-0410", title: "Lingote Indústria — Inovação", clientName: "Lingote Indústria, S.A.",
    program: "PT2030", state: "B2", nextAction: "30 Jun 2026 — Encerramento Administrativo", progress: 91, responsibles: ["JS"],
    milestones: [
      { name: "Candidatura submetida", date: "Fev 2023", status: "FEITO" },
      { name: "Aprovação comunicada", date: "Jul 2023", status: "FEITO" },
      { name: "Execução concluída", date: "Abr 2026", status: "FEITO" },
      { name: "Encerramento Administrativo", date: "30 Jun 2026", status: "ATIVO" },
    ],
  },
  {
    code: "PT2030-2024-0233", title: "STRIX — Automação Produção", clientName: "STRIX Componentes, Lda",
    program: "PT2030", state: "B0", nextAction: "Arranque da execução", progress: 30, responsibles: ["TF"],
  },
  {
    code: "PT2030-2025-0011", title: "Borges & Irmãos — Internacionalização", clientName: "Borges & Irmãos, Lda",
    program: "PT2030", state: "A1", nextAction: "Recolha de documentos ao cliente", progress: 18, responsibles: ["JS"],
  },
  {
    code: "PT2030-2025-0044", title: "FERTERRA — Inovação Produtiva", clientName: "FERTERRA Agro, Lda",
    program: "PT2030", state: "A0", nextAction: "Diagnóstico A0", progress: 5, responsibles: ["TF"],
  },
  {
    code: "PT2030-2025-0052", title: "NOVAMAQ — Capacidade Produtiva", clientName: "NOVAMAQ Máquinas, S.A.",
    program: "PT2030", state: "A2", nextAction: "Preparação da memória descritiva", progress: 40, responsibles: ["MA"],
  },
  {
    code: "PT2030-2024-0301", title: "TecnoLub — Eficiência de Processos", clientName: "TecnoLub, Lda",
    program: "PT2030", state: "A4", nextAction: "Aguarda decisão", progress: 60, responsibles: ["NS"],
  },
  {
    code: "PT2030-2024-0118", title: "METALGEST — Digitalização Fabril", clientName: "METALGEST, S.A.",
    program: "PT2030", state: "B1", nextAction: "Execução em curso", progress: 50, responsibles: ["JS"],
  },
  // ── RFAI / SIFIDE — benefícios fiscais (fora do kanban PT2030) ──
  {
    code: "RFAI-2023-0341", title: "KEMI — I&D Aplicado 2023", clientName: "KEMI Portugal, S.A.", nif: "RFAI-2023-0341",
    program: "RFAI", state: "B0", investment: 1200000, incentive: 360000,
    nextAction: "15 Jul 2026 — Mapa de Investimento Final", progress: 80, responsibles: ["JR", "NS"],
  },
  // ── Formação ──
  {
    code: "FORM-2026-A9", title: "Formação STCP — Condução de Veículos", clientName: "STCP",
    program: "FORMACAO", state: "B1", nextAction: "15 Jun 2026 — Dossier Técnico Pedagógico", progress: 70, responsibles: ["MP", "DM"],
  },
];

async function main() {
  console.log("→ Seed: limpar dados existentes…");
  // ordem respeita FKs
  await prisma.session.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.collectionLink.deleteMany();
  await prisma.document.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.stateTransition.deleteMany();
  await prisma.milestone.deleteMany();
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
  const demoHash = await hash(DEMO_PASSWORD);
  const usersByInitials = new Map<string, string>();
  for (const u of USERS) {
    const created = await prisma.user.create({
      data: { ...u, email: u.email.toLowerCase(), passwordHash: demoHash },
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

    // milestones (timeline do drawer) — específica do protótipo ou genérica do §8
    const milestones = proj.milestones ?? genericMilestones(proj.state);
    await prisma.milestone.createMany({
      data: milestones.map((m, i) => ({
        projectId: project.id,
        name: m.name,
        date: m.date ?? null,
        status: m.status,
        order: i,
      })),
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
