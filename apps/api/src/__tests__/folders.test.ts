import { describe, expect, it } from "vitest";
import { buildFolderTree } from "@estrategor/shared";

describe("buildFolderTree (spec §6)", () => {
  it("PT2030 gera a subárvore 1-INCENTIVOS com as 5 subpastas", () => {
    const tree = buildFolderTree("PT2030", "SI Qualificação nº 0182");
    const paths = tree.map((n) => n.path);
    expect(paths).toContain("0-ELEMENTOS");
    expect(paths).toContain("1-INCENTIVOS");
    expect(paths).toContain("1-INCENTIVOS/SI Qualificação nº 0182");
    expect(paths).toContain("1-INCENTIVOS/SI Qualificação nº 0182/Candidatura");
    expect(paths).toContain("1-INCENTIVOS/SI Qualificação nº 0182/Termo de Aceitação");
    expect(paths).toContain("1-INCENTIVOS/SI Qualificação nº 0182/Execução");
  });

  it("RFAI gera 2-BF/RFAI; SIFIDE gera 2-BF/SIFIDE", () => {
    expect(buildFolderTree("RFAI").map((n) => n.path)).toContain("2-BF/RFAI");
    expect(buildFolderTree("SIFIDE").map((n) => n.path)).toContain("2-BF/SIFIDE");
  });

  it("Formação gera 3-FORMAÇÃO", () => {
    expect(buildFolderTree("FORMACAO").map((n) => n.path)).toContain("3-FORMAÇÃO");
  });

  it("cada nó (exceto topo) tem um parentPath que existe na árvore", () => {
    const tree = buildFolderTree("PT2030", "SI nº 1");
    const paths = new Set(tree.map((n) => n.path));
    for (const node of tree) {
      if (node.parentPath !== null) {
        expect(paths.has(node.parentPath)).toBe(true);
      }
    }
  });

  it("pai aparece sempre antes dos filhos (ordem de criação)", () => {
    const tree = buildFolderTree("PT2030", "SI nº 1");
    const seen = new Set<string>();
    for (const node of tree) {
      if (node.parentPath !== null) {
        expect(seen.has(node.parentPath)).toBe(true);
      }
      seen.add(node.path);
    }
  });
});
