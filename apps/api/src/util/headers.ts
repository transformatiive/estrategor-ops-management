/**
 * Content-Disposition seguro para HTTP. O header só aceita ASCII, por isso
 * nomes de ficheiro com acentos / travessões ("ã", "ç", "–") rebentavam com
 * ERR_INVALID_CHAR. Segue a RFC 5987: fallback ASCII em `filename="..."` +
 * `filename*=UTF-8''<percent-encoded>` para os clientes que o suportam.
 */
export function contentDisposition(
  filename: string,
  disposition: "inline" | "attachment" = "inline",
): string {
  const fallback = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_") // só ASCII imprimível
    .replace(/["\\]/g, ""); // sem aspas/barras que partam o header
  const encoded = encodeURIComponent(filename).replace(
    /['()*!]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
