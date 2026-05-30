import { buildFolderTree, type ProgramCode } from "@estrategor/shared";
import { prisma } from "../db.js";
import { getWorkDrive } from "./adapter.js";

/**
 * Provisiona (idempotentemente) a árvore de pastas de um projecto no WorkDrive
 * e persiste-a na tabela `folders` (TRNSF-936).
 *
 * - Cria a pasta-raiz do projecto (nomeada pelo cliente) sob a root configurada.
 * - Cria a subárvore conforme o programa (spec §6), pai antes dos filhos.
 * - Reexecuções não duplicam: pastas já registadas são reaproveitadas.
 */
export async function provisionProjectFolders(
  projectId: string,
  measureLabelOverride?: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true, program: true },
  });
  if (!project) throw new Error("Projeto não encontrado.");

  const wd = getWorkDrive();
  const program = project.program.code as ProgramCode;

  // pasta-raiz do projecto (nome = cliente + código), idempotente
  const rootName = `${project.client.name} · ${project.code}`;
  let root = await prisma.folder.findUnique({
    where: { projectId_path: { projectId, path: "" } },
  });
  if (!root) {
    const created = await wd.createFolder(wd.rootFolderId(), rootName);
    root = await prisma.folder.create({
      data: {
        projectId,
        path: "",
        name: rootName,
        parentPath: null,
        isRoot: true,
        workdriveId: created.workdriveId,
        workdriveUrl: created.workdriveUrl,
      },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { client: { update: { workdriveFolderId: created.workdriveId } } },
    });
  }

  // mapa caminho → workdriveId (inclui a raiz como "")
  const idByPath = new Map<string, string>();
  idByPath.set("", root.workdriveId ?? "");

  // subárvore conforme o programa
  const measureLabel =
    program === "PT2030"
      ? (measureLabelOverride?.trim() || `SI nº ${project.code.split("-").pop()}`)
      : undefined;
  const tree = buildFolderTree(program, measureLabel);

  for (const node of tree) {
    const existing = await prisma.folder.findUnique({
      where: { projectId_path: { projectId, path: node.path } },
    });
    if (existing) {
      if (existing.workdriveId) idByPath.set(node.path, existing.workdriveId);
      continue;
    }
    const parentWdId = idByPath.get(node.parentPath ?? "") ?? root.workdriveId ?? "";
    const created = await wd.createFolder(parentWdId, node.name);
    await prisma.folder.create({
      data: {
        projectId,
        path: node.path,
        name: node.name,
        parentPath: node.parentPath,
        isRoot: false,
        workdriveId: created.workdriveId,
        workdriveUrl: created.workdriveUrl,
      },
    });
    idByPath.set(node.path, created.workdriveId);
  }

  await prisma.activityLog.create({
    data: {
      projectId,
      type: "folders_provisioned",
      description: `Estrutura de pastas criada no WorkDrive (${wd.mode}).`,
    },
  });
}
