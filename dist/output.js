"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.table = table;
exports.json = json;
exports.keyValue = keyValue;
exports.formatCents = formatCents;
exports.formatCreditsOnly = formatCreditsOnly;
exports.formatUsdAsCredits = formatUsdAsCredits;
exports.formatStatus = formatStatus;
function table(headers, rows, options) {
    const maxWidth = options?.maxWidth || process.stdout.columns || 120;
    // Calculate column widths
    const colWidths = headers.map((h, i) => {
        const maxData = Math.max(...rows.map((r) => (r[i] || "").length), 0);
        return Math.max(h.length, maxData);
    });
    // Truncate columns if total exceeds terminal width
    const totalWidth = colWidths.reduce((a, b) => a + b, 0) + (headers.length - 1) * 3;
    if (totalWidth > maxWidth) {
        const lastCol = colWidths.length - 1;
        const excess = totalWidth - maxWidth;
        colWidths[lastCol] = Math.max(10, colWidths[lastCol] - excess);
    }
    const formatRow = (cells) => {
        return cells
            .map((cell, i) => {
            const width = colWidths[i];
            const str = cell || "";
            return str.length > width ? str.slice(0, width - 1) + "\u2026" : str.padEnd(width);
        })
            .join("   ");
    };
    console.log(formatRow(headers));
    console.log(colWidths.map((w) => "\u2500".repeat(w)).join("   "));
    rows.forEach((row) => console.log(formatRow(row)));
}
function json(data) {
    console.log(JSON.stringify(data, null, 2));
}
function keyValue(pairs) {
    const maxKeyLen = Math.max(...pairs.map(([k]) => k.length));
    pairs.forEach(([key, value]) => {
        const displayValue = value === null || value === undefined ? "-" : String(value);
        console.log(`${key.padEnd(maxKeyLen)}   ${displayValue}`);
    });
}
function formatCents(cents) {
    if (cents === null || cents === undefined)
        return "-";
    return `${cents.toLocaleString()} Credits ($${(cents / 100).toFixed(2)})`;
}
function formatCreditsOnly(cents) {
    if (cents === null || cents === undefined)
        return "-";
    return `${cents.toLocaleString()} Credits`;
}
function formatUsdAsCredits(usd) {
    if (usd === null || usd === undefined)
        return "-";
    return `${Math.round(usd * 100).toLocaleString()} Credits`;
}
function formatStatus(status) {
    return status;
}
//# sourceMappingURL=output.js.map