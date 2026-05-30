import { DOCUMENT_TAXONOMY } from "./taxonomy.js";

/**
 * Classificação de documentos (TRNSF-938). Os tipos vivem aqui (partilhados
 * entre API e Web); o classificador real (OpenRouter/Claude) corre na API.
 * Este ficheiro inclui um classificador-stub determinístico por nome de ficheiro,
 * usado em dev/CI/testes e como fallback quando não há OPENROUTER_API_KEY.
 */

/** Parte proposta quando um ficheiro contém vários documentos (E-02/E-03). */
export interface ProposedPart {
  typeKey: string;
  startPage: number; // 1-based, inclusivo
  endPage: number; // 1-based, inclusivo
}

export interface ClassificationResult {
  /** tipo proposto para o ficheiro inteiro (null se multi-documento) */
  proposedTypeKey: string | null;
  /** confiança 0..1 */
  confidence: number;
  /** ficheiro contém vários documentos? */
  multiDocument: boolean;
  /** partes propostas (quando multiDocument) */
  parts?: ProposedPart[];
  /** justificação curta (opcional) */
  rationale?: string;
}

/** Limiar abaixo do qual a confiança é considerada BAIXA (assinalada). */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

export function confidenceBand(score: number): "ALTA" | "BAIXA" {
  return score >= LOW_CONFIDENCE_THRESHOLD ? "ALTA" : "BAIXA";
}

// Heurística por palavras-chave → key da taxonomia (apenas para o stub).
const KEYWORD_MAP: { match: RegExp; key: string }[] = [
  { match: /certidao.?permanente|permanente/i, key: "CERTIDAO_PERMANENTE" },
  { match: /pme|iapmei/i, key: "CERTIFICADO_PME" },
  { match: /nao.?divida|at.?ss|seguranca.?social|financas/i, key: "CERTIDAO_NAO_DIVIDA" },
  { match: /rcbe|beneficiario/i, key: "RCBE" },
  { match: /ies/i, key: "IES" },
  { match: /modelo.?22|balancete/i, key: "MODELO_22" },
  { match: /deprecia|anexo.?a|anexo.?b/i, key: "MAPA_DEPRECIACOES" },
  { match: /seg.?social|pessoal|eti/i, key: "MAPAS_SEG_SOCIAL" },
  { match: /vendas|mercado/i, key: "MAPA_VENDAS" },
  { match: /investimento|orcamento|pgi/i, key: "INTENCOES_INVESTIMENTO" },
  { match: /licenc|financiamento/i, key: "LICENCIAMENTOS" },
  { match: /turismo|memoria|pecas/i, key: "TURISMO_MEMORIA" },
];

/**
 * Classificador-stub determinístico (sem rede). Identifica o tipo por nome de
 * ficheiro; deteta multi-documento quando o nome contém "lote"/"multi" e devolve
 * 2 partes. Restringe as propostas aos `candidateKeys` quando fornecido.
 */
export function stubClassify(
  originalFilename: string,
  pageCount = 1,
  candidateKeys?: string[],
): ClassificationResult {
  const name = originalFilename.toLowerCase();
  const allowed = (k: string) => !candidateKeys || candidateKeys.includes(k);

  const multi = /(lote|multi|varios|conjunto)/i.test(name) && pageCount >= 2;
  if (multi) {
    // divide as páginas em 2 metades; tenta dois tipos distintos do nome
    const hits = KEYWORD_MAP.filter((m) => m.match.test(name) && allowed(m.key)).map((m) => m.key);
    const mid = Math.max(1, Math.floor(pageCount / 2));
    const k1 = hits[0] ?? firstCandidate(candidateKeys) ?? "CERTIDAO_PERMANENTE";
    const k2 = hits[1] ?? hits[0] ?? firstCandidate(candidateKeys) ?? "IES";
    return {
      proposedTypeKey: null,
      confidence: 0.5,
      multiDocument: true,
      parts: [
        { typeKey: k1, startPage: 1, endPage: mid },
        { typeKey: k2, startPage: mid + 1, endPage: pageCount },
      ],
      rationale: "Nome sugere múltiplos documentos (stub).",
    };
  }

  const hit = KEYWORD_MAP.find((m) => m.match.test(name) && allowed(m.key));
  if (hit) {
    return {
      proposedTypeKey: hit.key,
      confidence: 0.8,
      multiDocument: false,
      rationale: "Correspondência por nome de ficheiro (stub).",
    };
  }
  // sem correspondência → primeiro candidato com confiança baixa (assinalada)
  return {
    proposedTypeKey: firstCandidate(candidateKeys) ?? DOCUMENT_TAXONOMY[0]!.key,
    confidence: 0.3,
    multiDocument: false,
    rationale: "Sem correspondência clara — requer revisão (stub).",
  };
}

function firstCandidate(keys?: string[]): string | undefined {
  return keys && keys.length > 0 ? keys[0] : undefined;
}
