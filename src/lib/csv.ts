/** Small dependency-free CSV reader/writer (RFC 4180 + semicolon support). */

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length,
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 1 ? counts[0].delimiter : ",";
}

export function parseCsv(text: string, delimiter?: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const sep = delimiter ?? detectDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // ignore, handled by \n
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ""));
}

export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, index) => {
      obj[key] = (row[index] ?? "").trim();
    });
    return obj;
  });
}

function escapeCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function objectsToCsv(
  rows: Record<string, unknown>[],
  columns: string[],
  delimiter = ";",
) {
  const lines = [columns.join(delimiter)];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(row[column])).join(delimiter));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** CSV with arbitrary header labels and already ordered rows. */
export function rowsToCsv(
  header: string[],
  rows: unknown[][],
  delimiter = ";",
) {
  const lines = [header.map(escapeCell).join(delimiter)];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(delimiter));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Accepts "1.234,5", "1,234.5" and plain numbers. */
export function parseLooseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/[^\d.,\-]/g, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String).map((v) => v.trim()).filter(Boolean);
    } catch {
      // fall through
    }
  }
  return text
    .split(/\s*\|\s*|\s*;\s*/)
    .map((v) => v.trim())
    .filter(Boolean);
}
