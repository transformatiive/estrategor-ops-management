import { describe, expect, it } from "vitest";
import {
  escolherRegulamento,
  extrairCodigo,
  extrairTitulo,
  parseCompeteDetail,
  parseListingSlugs,
  pareceAberto,
} from "../avisos2030/compete.js";

describe("adaptador Compete2030 (TRNSF-1072)", () => {
  it("parseListingSlugs extrai os slugs (e ignora feed/page)", () => {
    const html = `
      <a href="https://compete2030.gov.pt/avisos/sice-pme-mpr-2025-14/">x</a>
      <a href="/avisos/siid-id-industrial_mpr-2026-4/">y</a>
      <a href="/avisos/feed/">feed</a>
      <a href="/avisos/page/2/">2</a>`;
    const s = parseListingSlugs(html);
    expect(s).toContain("sice-pme-mpr-2025-14");
    expect(s).toContain("siid-id-industrial_mpr-2026-4");
    expect(s).not.toContain("feed");
    expect(s).not.toContain("page");
  });

  it("extrairCodigo lê do slug e, em fallback, do corpo", () => {
    expect(extrairCodigo("sice-pme-mpr-2025-14", "")).toBe("MPR-2025-14");
    expect(extrairCodigo("assistencia-tecnica_compete2030-2026-05", "")).toBe("COMPETE2030-2026-05");
    expect(extrairCodigo("sem-codigo-no-slug", "Aviso MPr-2026-01 aberto")).toBe("MPR-2026-01");
    expect(extrairCodigo("nada", "texto sem código")).toBeNull();
  });

  it("escolherRegulamento escolhe o Aviso-*.pdf e ignora guias", () => {
    const html = `
      <a href="/wp-content/uploads/2025/12/Guia-Preenchimento-MPr-2025-14.pdf">guia</a>
      <a href="/wp-content/uploads/2024/09/Aviso-Proj-Conjuntos_MPr-2025-14-publicacao.pdf">aviso</a>
      <a href="/wp-content/uploads/2025/12/Aviso-Proj-Conjuntos_MPr-2025-14-republicacao-VF.pdf">republic</a>`;
    const url = escolherRegulamento(html);
    expect(url).toContain("Aviso-Proj-Conjuntos_MPr-2025-14-republicacao");
    expect(url!.startsWith("https://")).toBe(true);
  });

  it("pareceAberto deteta o estado", () => {
    expect(pareceAberto("<span>Aberto</span>")).toBe(true);
    expect(pareceAberto("estado: Encerrado")).toBe(false);
  });

  it("parseCompeteDetail devolve null se fechado ou sem regulamento", () => {
    const aberto = `<meta property="og:title" content="SICE – Internacionalização | Compete 2030"/>
      Aberto <a href="/wp-content/uploads/Aviso-mpr-2025-14.pdf">a</a>`;
    const r = parseCompeteDetail(aberto, "sice-mpr-2025-14");
    expect(r?.codigo).toBe("MPR-2025-14");
    expect(r?.titulo).toBe("SICE – Internacionalização");
    expect(r?.regulamentoUrl).toContain("Aviso-mpr-2025-14.pdf");

    expect(parseCompeteDetail("Encerrado <a href='/Aviso-x.pdf'>", "x-mpr-2025-1")).toBeNull();
    expect(parseCompeteDetail("Aberto sem pdf", "x-mpr-2025-1")).toBeNull();
  });
});
