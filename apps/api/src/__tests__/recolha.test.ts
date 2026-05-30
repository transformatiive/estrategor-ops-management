import { describe, expect, it } from "vitest";
import {
  buildDocumentFilename,
  buildFolderTree,
  resolveTargetFolderPath,
} from "@estrategor/shared";

describe("buildDocumentFilename (§11)", () => {
  it("segue {Cliente}_{Programa}_{Tipo}_{Data} com data AAAA-MM-DD", () => {
    const name = buildDocumentFilename({
      clientName: "DIRSIL, S.A.",
      programCode: "PT2030",
      documentTypeKey: "CERTIDAO_PERMANENTE",
      date: new Date("2026-05-30T10:00:00Z"),
      extension: "pdf",
    });
    expect(name).toBe("DIRSIL-S-A_PT2030_CERTIDAO-PERMANENTE_2026-05-30.pdf");
  });

  it("funciona sem extensão", () => {
    const name = buildDocumentFilename({
      clientName: "ACME",
      programCode: "RFAI",
      documentTypeKey: "IES",
      date: new Date("2026-01-02T00:00:00Z"),
    });
    expect(name).toBe("ACME_RFAI_IES_2026-01-02");
  });
});

describe("resolveTargetFolderPath (TRNSF-937)", () => {
  const paths = buildFolderTree("PT2030", "SI nº 0182").map((n) => n.path);

  it("ELEMENTOS resolve para 0-ELEMENTOS", () => {
    expect(resolveTargetFolderPath("ELEMENTOS", paths)).toBe("0-ELEMENTOS");
  });

  it("INCENTIVOS/Candidatura resolve para a subpasta da medida", () => {
    expect(resolveTargetFolderPath("INCENTIVOS/Candidatura", paths)).toBe(
      "1-INCENTIVOS/SI nº 0182/Candidatura",
    );
  });

  it("alvo desconhecido cai na raiz (\"\")", () => {
    expect(resolveTargetFolderPath("QUALQUER", paths)).toBe("");
  });
});
