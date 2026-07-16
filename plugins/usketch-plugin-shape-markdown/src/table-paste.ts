/**
 * Pure helpers to detect tabular clipboard content (HTML `<table>` from
 * Excel/Google Sheets/web, or delimited TSV/CSV text) and turn it into a GFM
 * markdown table string. Used by the table external-content handler so a paste
 * of a spreadsheet selection becomes a rendered markdown table shape.
 */

/** Cheap check for `match`: does the HTML payload contain a table element? */
export function htmlHasTable(html: string | null | undefined): boolean {
	return !!html && /<table[\s>]/i.test(html);
}

/**
 * Parse an HTML `<table>` (e.g. Excel / Google Sheets rich clipboard) into a
 * grid of cell strings. Browser-only (uses DOMParser); returns null otherwise.
 */
export function parseHtmlTable(html: string | null | undefined): string[][] | null {
	if (!html || typeof DOMParser === "undefined") return null;
	const doc = new DOMParser().parseFromString(html, "text/html");
	const table = doc.querySelector("table");
	if (!table) return null;
	const rows: string[][] = [];
	for (const tr of Array.from(table.querySelectorAll("tr"))) {
		const cells = Array.from(tr.querySelectorAll("th,td")).map((c) =>
			(c.textContent ?? "").trim().replace(/\s+/g, " "),
		);
		if (cells.length > 0) rows.push(cells);
	}
	return rows.length > 0 ? rows : null;
}

/**
 * Parse delimited plain text (TSV preferred, else CSV) into a grid. Conservative
 * to avoid turning prose into a table: requires ≥2 non-empty lines, ≥2 columns,
 * the delimiter present on *every* line, and a consistent column count.
 * (No CSV quote handling — a pragmatic v1 for spreadsheet copies.)
 */
export function parseDelimited(text: string | null | undefined): string[][] | null {
	if (!text) return null;
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
	if (lines.length < 2) return null;
	if (lines.some((l) => l.trim() === "")) return null;

	const delim = lines.every((l) => l.includes("\t"))
		? "\t"
		: lines.every((l) => l.includes(","))
			? ","
			: null;
	if (!delim) return null;

	const rows = lines.map((l) => l.split(delim).map((c) => c.trim()));
	const cols = rows[0].length;
	if (cols < 2) return null;
	if (!rows.every((r) => r.length === cols)) return null;
	return rows;
}

/** Render a grid as a GFM table. First row is the header. */
export function toMarkdownTable(rows: string[][]): string {
	const cols = Math.max(...rows.map((r) => r.length));
	const escapeCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
	const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => escapeCell(r[i] ?? ""));
	const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
	const header = pad(rows[0]);
	const sep = header.map(() => "---");
	const body = rows.slice(1).map(pad);
	return [line(header), line(sep), ...body.map(line)].join("\n");
}
