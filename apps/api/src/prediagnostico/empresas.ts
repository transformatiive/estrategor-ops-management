import type { FaixaEstado } from "@estrategor/shared";
import { env } from "../env.js";

export interface EmpresasResult {
  estado: FaixaEstado; // ok | falhou | sem_chave
  cae: string | null;
  caeDescricao: string | null;
  naturezaJuridica: string | null;
  capitalSocial: number | null;
  concelho: string | null;
  distrito: string | null;
  bruto: unknown;
}

const VAZIO = { cae: null, caeDescricao: null, naturezaJuridica: null, capitalSocial: null, concelho: null, distrito: null };

/**
 * Faixa B — API de empresas PT (nif.pt no arranque). Adaptador substituível
 * (bizapis/Racius como evolução). Sem chave → faixa "sem_chave" (degradação
 * graciosa). O mapeamento de campos é defensivo: o JSON em bruto fica guardado
 * para auditoria e para afinar o mapeamento contra respostas reais.
 */
export async function consultarEmpresas(nif: string): Promise<EmpresasResult> {
  if (!env.NIF_PT_API_KEY) return { estado: "sem_chave", ...VAZIO, bruto: null };
  const clean = nif.replace(/[^0-9]/g, "");
  try {
    const res = await fetch(`${env.NIF_PT_BASE}/?json=1&q=${clean}&key=${env.NIF_PT_API_KEY}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return { estado: "falhou", ...VAZIO, bruto: { status: res.status } };
    const json = (await res.json()) as { result?: string; records?: Record<string, Record<string, unknown>> };
    const records = json.records ?? {};
    const rec = (records[clean] ?? Object.values(records)[0]) as Record<string, unknown> | undefined;
    if (!rec) return { estado: "falhou", ...VAZIO, bruto: json };

    // Esquema real nif.pt: cae (string), activity (descrição), structure.{nature,capital},
    // geo.{region=distrito, county=concelho, parish}.
    const structure = rec.structure as Record<string, unknown> | undefined;
    const geo = rec.geo as Record<string, unknown> | undefined;
    const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
    const num = (v: unknown): number | null => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[^\d.,]/g, "").replace(",", ".")) || null : null);

    return {
      estado: "ok",
      cae: str(rec.cae),
      caeDescricao: str(rec.activity),
      naturezaJuridica: str(structure?.nature),
      capitalSocial: num(structure?.capital),
      concelho: str(geo?.county),
      distrito: str(geo?.region),
      bruto: json,
    };
  } catch (e) {
    return { estado: "falhou", ...VAZIO, bruto: { erro: e instanceof Error ? e.message : String(e) } };
  }
}
