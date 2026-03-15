export function table(
  headers: string[],
  rows: string[][],
  options?: { maxWidth?: number }
): void {
  const maxWidth = options?.maxWidth || process.stdout.columns || 120;

  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxData = Math.max(...rows.map((r) => (r[i] || "").length), 0);
    return Math.max(h.length, maxData);
  });

  // Truncate columns if total exceeds terminal width
  const totalWidth =
    colWidths.reduce((a, b) => a + b, 0) + (headers.length - 1) * 3;
  if (totalWidth > maxWidth) {
    const lastCol = colWidths.length - 1;
    const excess = totalWidth - maxWidth;
    colWidths[lastCol] = Math.max(10, colWidths[lastCol] - excess);
  }

  const formatRow = (cells: string[]): string => {
    return cells
      .map((cell, i) => {
        const width = colWidths[i];
        const str = cell || "";
        return str.length > width ? str.slice(0, width - 1) + "\u2026" : str.padEnd(width);
      })
      .join("   ");
  };

  console.log(formatRow(headers));
  console.log(
    colWidths.map((w) => "\u2500".repeat(w)).join("   ")
  );
  rows.forEach((row) => console.log(formatRow(row)));
}

export function json(data: any): void {
  console.log(JSON.stringify(data, null, 2));
}

export function keyValue(pairs: [string, any][]): void {
  const maxKeyLen = Math.max(...pairs.map(([k]) => k.length));
  pairs.forEach(([key, value]) => {
    const displayValue =
      value === null || value === undefined ? "-" : String(value);
    console.log(`${key.padEnd(maxKeyLen)}   ${displayValue}`);
  });
}

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "-";
  return `${cents.toLocaleString()} Credits ($${(cents / 100).toFixed(2)})`;
}

export function formatCreditsOnly(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "-";
  return `${cents.toLocaleString()} Credits`;
}

export function formatUsdAsCredits(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return "-";
  return `${Math.round(usd * 100).toLocaleString()} Credits`;
}

export function formatStatus(status: string): string {
  return status;
}
