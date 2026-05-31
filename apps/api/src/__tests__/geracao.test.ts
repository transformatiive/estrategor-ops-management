import { describe, expect, it } from "vitest";
import {
  GEN_DOC_TYPES,
  countPlaceholders,
  genDocType,
  genDocTypeByTarget,
  genDocTypesForFamily,
  stubDraft,
} from "@estrategor/shared";

describe("catálogo de doc_types de geração (TRNSF-943)", () => {
  it("inclui os campos comuns das duas famílias", () => {
    const comuns = GEN_DOC_TYPES.filter((d) => d.scope === "comum").map((d) => d.docType);
    for (const k of [
      "descricao_operacao_resumo_pt",
      "descricao_operacao_resumo_en",
      "descricao_operacao_objetivos",
      "descricao_operacao_descricao_tecnica",
      "descricao_operacao_diagnostico",
      "enquadramento_tematico_fundamentacao",
    ]) {
      expect(comuns).toContain(k);
    }
  });

  it("a família A vê comuns + específicos; não vê os da família B", () => {
    const a = genDocTypesForFamily("inovacao_produtiva").map((d) => d.docType);
    expect(a).toContain("descricao_operacao_resumo_pt"); // comum
    expect(a).toContain("analise_mercado_estrategia_captacao"); // família A
    expect(a).not.toContain("intl_action_descricao"); // família B
  });

  it("a família B vê comuns + específicos de internacionalização", () => {
    const b = genDocTypesForFamily("internacionalizacao").map((d) => d.docType);
    expect(b).toContain("intl_action_descricao");
    expect(b).not.toContain("tipologia_fundamentacao");
  });

  it("o campo de enquadramento temático é o maior (9000)", () => {
    expect(genDocType("enquadramento_tematico_fundamentacao")?.charLimit).toBe(9000);
  });

  it("campos longos vão a opus, curtos a sonnet", () => {
    expect(genDocType("enquadramento_tematico_fundamentacao")?.model).toBe("opus");
    expect(genDocType("industria_40_inovacao_produto")?.model).toBe("sonnet");
  });

  it("doc_types têm targets (section,key) únicos", () => {
    const seen = new Set<string>();
    for (const d of GEN_DOC_TYPES) {
      const k = `${d.section}::${d.key}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it("resolve doc_type por target (section,key)", () => {
    const def = genDocTypeByTarget("enquadramento_tematico", "fundamentacao");
    expect(def?.docType).toBe("enquadramento_tematico_fundamentacao");
  });
});

describe("marcadores e minuta-stub", () => {
  it("conta marcadores [A PREENCHER: ...]", () => {
    expect(countPlaceholders("texto [A PREENCHER: x] e [A PREENCHER: y]")).toBe(2);
    expect(countPlaceholders("sem marcadores")).toBe(0);
  });

  it("a minuta-stub não inventa: usa [A PREENCHER] com os ingredientes", () => {
    const def = genDocType("descricao_operacao_resumo_pt")!;
    const draft = stubDraft(def);
    expect(countPlaceholders(draft)).toBeGreaterThanOrEqual(1);
    expect(draft).toContain(def.ingredientes);
  });
});
