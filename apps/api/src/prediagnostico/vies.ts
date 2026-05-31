import type { FaixaEstado } from "@estrategor/shared";
import { env } from "../env.js";

export interface ViesResult {
  estado: FaixaEstado; // ok | falhou
  valid: boolean;
  nome: string | null;
  morada: string | null;
  bruto: unknown;
}

/**
 * Faixa A — VIES (Comissão Europeia, REST, sem chave). Valida o NIF/NIPC e
 * obtém nome + morada oficiais. NIF inválido é assinalado, sem inventar dados.
 */
export async function consultarVies(nif: string): Promise<ViesResult> {
  const clean = nif.replace(/[^0-9]/g, "");
  if (clean.length < 9) {
    return { estado: "falhou", valid: false, nome: null, morada: null, bruto: { erro: "NIF inválido (menos de 9 dígitos)" } };
  }
  try {
    const res = await fetch(`${env.VIES_BASE}/ms/PT/vat/${clean}`, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return { estado: "falhou", valid: false, nome: null, morada: null, bruto: { status: res.status } };
    }
    const json = (await res.json()) as { isValid?: boolean; name?: string; address?: string; userError?: string };
    const valid = Boolean(json.isValid);
    return {
      estado: "ok",
      valid,
      nome: valid && json.name ? json.name.trim() || null : null,
      morada: valid && json.address ? json.address.replace(/\s+/g, " ").trim() || null : null,
      bruto: json,
    };
  } catch (e) {
    return { estado: "falhou", valid: false, nome: null, morada: null, bruto: { erro: e instanceof Error ? e.message : String(e) } };
  }
}
