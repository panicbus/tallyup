/**
 * RFC 4180 serialization: quote a field only when it needs it (contains a
 * comma, quote, or newline), doubling any embedded quote. Rows join on
 * CRLF, per spec — not just `\n`.
 */
function quoteField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(quoteField).join(',')).join('\r\n');
}
