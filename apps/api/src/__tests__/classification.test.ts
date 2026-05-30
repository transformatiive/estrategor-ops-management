import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { confidenceBand, stubClassify } from "@estrategor/shared";
import { countPages, extractPages } from "../ai/pdf.js";

describe("stubClassify (TRNSF-938)", () => {
  it("classifica por nome de ficheiro com confiança alta", () => {
    const r = stubClassify("IES_2024.pdf", 1);
    expect(r.proposedTypeKey).toBe("IES");
    expect(r.multiDocument).toBe(false);
    expect(confidenceBand(r.confidence)).toBe("ALTA");
  });

  it("deteta multi-documento e devolve 2 partes", () => {
    const r = stubClassify("lote_documentos.pdf", 4);
    expect(r.multiDocument).toBe(true);
    expect(r.parts).toHaveLength(2);
    expect(r.parts![0]!.startPage).toBe(1);
    expect(r.parts![1]!.endPage).toBe(4);
  });

  it("sem correspondência → confiança baixa (assinalada)", () => {
    const r = stubClassify("scan001.pdf", 1);
    expect(confidenceBand(r.confidence)).toBe("BAIXA");
  });

  it("restringe a proposta aos candidateKeys", () => {
    const r = stubClassify("documento.pdf", 1, ["RCBE"]);
    expect(r.proposedTypeKey).toBe("RCBE");
  });
});

describe("PDF utils (divisão física E-03)", () => {
  async function makePdf(pages: number): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) doc.addPage([300, 300]);
    return Buffer.from(await doc.save());
  }

  it("conta páginas de um PDF", async () => {
    const pdf = await makePdf(5);
    expect(await countPages(pdf, "application/pdf")).toBe(5);
  });

  it("não-PDF conta como 1 página", async () => {
    expect(await countPages(Buffer.from("x"), "image/jpeg")).toBe(1);
  });

  it("extractPages devolve um PDF só com o intervalo pedido", async () => {
    const pdf = await makePdf(6);
    const part = await extractPages(pdf, 2, 4);
    expect(await countPages(part, "application/pdf")).toBe(3);
  });
});
