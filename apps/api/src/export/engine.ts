import ExcelJS from "exceljs";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import { resolveTargetFolderPath, type FinanceiroDTO, type InvestimentosDTO, type VerificacaoDTO } from "@estrategor/shared";
import { prisma } from "../db.js";
import { getWorkDrive } from "../workdrive/adapter.js";
import { buildFinanceiroDTO } from "../financial/engine.js";
import { buildInvestimentosDTO } from "../investimentos/engine.js";
import { buildGeracaoDTO } from "../generation/engine.js";
import { lastVerificacao } from "../verificacao/engine.js";

export type ExportFormat = "xlsx" | "docx" | "pdf";

export interface ExportData {
  candidaturaId: string;
  family: string;
  familyLabel: string;
  projectTitle: string;
  clientName: string;
  programCode: string;
  codigoAviso: string | null;
  fields: { section: string; key: string; value: unknown; origin: string; state: string }[];
  financeiro: FinanceiroDTO | null;
  investimentos: InvestimentosDTO | null;
  textos: { label: string; section: string; conteudo: string; placeholders: number; excede: boolean }[];
  verificacao: VerificacaoDTO | null;
}

export interface ExportStatus {
  porValidar: number;
  placeholders: number;
  mpPrevisto: number | null;
  avisos: string[];
}

async function gather(projectId: string): Promise<ExportData | null> {
  const cand = await prisma.candidatura.findUnique({
    where: { projectId },
    include: { project: { include: { client: true, program: true } } },
  });
  if (!cand) return null;

  const fields = (await prisma.candField.findMany({ where: { candidaturaId: cand.id }, orderBy: [{ section: "asc" }, { key: "asc" }] })).map((f) => ({
    section: f.section,
    key: f.key,
    value: f.value,
    origin: f.origin as string,
    state: f.state as string,
  }));

  const ger = await buildGeracaoDTO(projectId);
  const byKey = new Map(fields.map((f) => [`${f.section}::${f.key}`, f]));
  const textos = (ger?.campos ?? [])
    .filter((c) => c.estado !== null)
    .map((c) => {
      const cf = byKey.get(`${c.section}::${c.key}`);
      const conteudo = cf && typeof cf.value === "string" ? cf.value : "";
      return { label: c.label, section: c.section, conteudo, placeholders: c.placeholders, excede: c.excedeLimite };
    })
    .filter((t) => t.conteudo);

  return {
    candidaturaId: cand.id,
    family: cand.family,
    familyLabel: cand.family,
    projectTitle: cand.project.title,
    clientName: cand.project.client.name,
    programCode: cand.project.program.code,
    codigoAviso: cand.codigoAviso,
    fields,
    financeiro: await buildFinanceiroDTO(projectId),
    investimentos: await buildInvestimentosDTO(projectId),
    textos,
    verificacao: await lastVerificacao(projectId),
  };
}

/** Verificação leve antes de exportar (campos por validar / [A PREENCHER]). */
export async function exportStatus(projectId: string): Promise<ExportStatus | null> {
  const cand = await prisma.candidatura.findUnique({ where: { projectId } });
  if (!cand) return null;
  const porValidar = await prisma.candField.count({
    where: { candidaturaId: cand.id, origin: { in: ["extraido", "gerado"] }, state: "por_validar" },
  });
  const ger = await buildGeracaoDTO(projectId);
  const placeholders = (ger?.campos ?? []).reduce((s, c) => s + (c.estado !== null ? c.placeholders : 0), 0);
  const verif = await lastVerificacao(projectId);
  const avisos: string[] = [];
  if (porValidar > 0) avisos.push(`${porValidar} campo(s) por validar (extraídos/gerados).`);
  if (placeholders > 0) avisos.push(`${placeholders} marcador(es) [A PREENCHER] por resolver.`);
  return { porValidar, placeholders, mpPrevisto: verif?.mpPrevisto ?? null, avisos };
}

export function exportFilename(d: ExportData, format: ExportFormat): string {
  const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${slug(d.clientName)}_${slug(d.programCode)}_Candidatura_${date}.${format}`;
}

// ─── Excel: tabelas estruturadas ─────────────────────────────────────────────
export async function buildXlsx(d: ExportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Estrategor";

  if (d.financeiro && d.financeiro.anos.length) {
    const f = d.financeiro;
    const addTabela = (nome: string, linhas: typeof f.balanco) => {
      const ws = wb.addWorksheet(nome);
      ws.addRow(["Rubrica", ...f.anos.map(String)]);
      for (const l of linhas) ws.addRow([l.label, ...f.anos.map((a) => l.valores[String(a)] ?? 0)]);
    };
    addTabela("Balanço", f.balanco);
    addTabela("Demonstração Resultados", f.dr);
    addTabela("Financiamento", f.financiamento);
    const wi = wb.addWorksheet("Indicadores");
    wi.addRow(["Indicador", ...f.anos.map(String)]);
    for (const i of f.indicadores) wi.addRow([i.label, ...f.anos.map((a) => i.valores[String(a)] ?? null)]);
  }

  if (d.investimentos && d.investimentos.linhas.length) {
    const ws = wb.addWorksheet("Custos");
    ws.addRow(["Designação", "Categoria", "Atividade/Ação", "Data", "Elegível", "EF"]);
    for (const l of d.investimentos.linhas) {
      ws.addRow([l.designacao, l.categoria, l.atividade ?? "", l.dataAquisicao ?? "", l.elegivel, l.ef ? "Sim" : "Não"]);
    }
    ws.addRow(["Total elegível", "", "", "", d.investimentos.totalElegivel, ""]);
  }

  const mercado = d.fields.find((f) => f.section === "mercado_linhas" && f.key === "vendas_por_mercado");
  const linhasMercado = mercado && (mercado.value as { linhas?: unknown[] })?.linhas;
  if (Array.isArray(linhasMercado) && linhasMercado.length) {
    const ws = wb.addWorksheet("Mercado");
    ws.addRow(["Mercado", "Produto", "Ano", "Valor"]);
    for (const l of linhasMercado as { mercado?: string; produto?: string; ano?: number; valor?: number }[]) {
      ws.addRow([l.mercado ?? "", l.produto ?? "", l.ano ?? "", l.valor ?? 0]);
    }
  }

  if (wb.worksheets.length === 0) wb.addWorksheet("Candidatura").addRow(["Sem tabelas estruturadas ainda."]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── Word: campos de texto ───────────────────────────────────────────────────
export async function buildDocx(d: ExportData): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: "Estrategor — Candidatura", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `${d.projectTitle} · ${d.clientName} · ${d.programCode}` }),
    new Paragraph({ text: d.codigoAviso ? `Aviso: ${d.codigoAviso}` : "", spacing: { after: 200 } }),
  ];
  if (d.textos.length === 0) {
    children.push(new Paragraph({ text: "Ainda não há campos de texto gerados." }));
  }
  for (const t of d.textos) {
    children.push(new Paragraph({ text: t.label, heading: HeadingLevel.HEADING_2 }));
    if (t.placeholders > 0 || t.excede) {
      children.push(new Paragraph({ children: [new TextRun({ text: `[${t.placeholders} marcador(es) [A PREENCHER]${t.excede ? "; excede o limite" : ""}]`, italics: true, color: "B00000" })] }));
    }
    for (const linha of t.conteudo.split(/\r?\n/)) children.push(new Paragraph({ text: linha }));
  }
  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── PDF: vista consolidada + relatório do Verificador ───────────────────────
export async function buildPdf(d: ExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Estrategor — Candidatura", { continued: false });
    doc.moveDown(0.3).fontSize(11).fillColor("#444").text(`${d.projectTitle} · ${d.clientName} · ${d.programCode}`);
    if (d.codigoAviso) doc.text(`Aviso: ${d.codigoAviso}`);
    doc.fillColor("#000").moveDown();

    const v = d.verificacao;
    doc.fontSize(14).text("Mérito previsto");
    doc.fontSize(11).text(v?.mpPrevisto == null ? "MP: — (sem grelha)" : `MP previsto: ${v.mpPrevisto}${v.mpMinimo != null ? ` (mínimo ${v.mpMinimo})` : ""} — ${v.atingeMinimo ? "atinge" : "abaixo"} do mínimo`);
    for (const c of v?.mpPorCriterio ?? []) doc.text(`  ${c.codigo} ${c.nome}: ${c.score}`);
    doc.moveDown();

    doc.fontSize(14).text("Verificação (não-conformidades)");
    doc.fontSize(10);
    const ncs = v?.naoConformidades ?? [];
    if (ncs.length === 0) doc.text("Sem não-conformidades registadas.");
    for (const n of ncs) doc.fillColor(n.gravidade === "erro" ? "#B00000" : "#946C00").text(`• [${n.eixo}] ${n.mensagem}`);
    doc.fillColor("#000").moveDown();

    if (d.investimentos) {
      doc.fontSize(14).text("Investimento");
      doc.fontSize(11).text(`Total elegível: ${d.investimentos.totalElegivel.toLocaleString("pt-PT")} €`);
      doc.moveDown();
    }

    doc.fontSize(14).text("Campos de texto");
    doc.fontSize(9).fillColor("#444");
    for (const t of d.textos) doc.text(`• ${t.label} (${t.conteudo.length} car.${t.placeholders ? `, ${t.placeholders} [A PREENCHER]` : ""})`);
    if (d.textos.length === 0) doc.text("Ainda sem textos gerados.");

    doc.end();
  });
}

/** Gera o ficheiro do formato pedido e tenta arquivá-lo na pasta Candidatura. */
export async function buildExport(projectId: string, format: ExportFormat): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await gather(projectId);
  if (!data) return null;
  const buffer = format === "xlsx" ? await buildXlsx(data) : format === "docx" ? await buildDocx(data) : await buildPdf(data);
  const filename = exportFilename(data, format);
  await archiveToWorkdrive(projectId, filename, buffer).catch(() => {/* best-effort */});
  return { buffer, filename };
}

const MIME: Record<ExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

export function mimeFor(format: ExportFormat): string {
  return MIME[format];
}

/** Guarda o ficheiro exportado na subpasta Candidatura do WorkDrive. */
async function archiveToWorkdrive(projectId: string, filename: string, buffer: Buffer): Promise<void> {
  const folders = await prisma.folder.findMany({ where: { projectId } });
  const path = resolveTargetFolderPath("INCENTIVOS/Candidatura", folders.map((f) => f.path));
  const folder = folders.find((f) => f.path === path) ?? folders.find((f) => f.isRoot);
  if (!folder?.workdriveId) return;
  const ext = filename.split(".").pop() ?? "";
  await getWorkDrive().uploadFile(folder.workdriveId, filename, buffer, MIME[(ext as ExportFormat)] ?? "application/octet-stream");
}
