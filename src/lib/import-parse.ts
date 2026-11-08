import { parseCsv, parseLooseNumber } from "./csv";
import type { ImportMatchInput } from "./types";

const TITLE_KEYS = ["title", "titel", "titlede", "title_de", "name", "film", "movie"];
const YEAR_KEYS = ["year", "jahr", "erscheinungsjahr", "releaseyear"];
const ORIGINAL_KEYS = [
  "originaltitle",
  "original_title",
  "originaltitel",
  "titleoriginal",
  "title_original",
];
const TMDB_KEYS = ["tmdbid", "tmdb_id", "tmdb", "themoviedb_id"];

export const MAX_IMPORT_ROWS = 500;

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[\s_-]/g, "");
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find((key) => normalizedKey(key) === normalizedKey(alias));
    if (match !== undefined) {
      const value = row[match];
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
  }
  return "";
}

function yearFrom(value: unknown): number | null {
  const parsed = parseLooseNumber(value);
  if (parsed === null) return null;
  const year = Math.round(parsed);
  return year >= 1800 && year <= 2200 ? year : null;
}

function splitTitleYear(value: string): { title: string; year: number | null } {
  const clean = value.trim();
  const patterns = [
    /^(.*?)\s*[\(\[]\s*(\d{4})\s*[\)\]]\s*$/,
    /^(.*?)\s*[-–—]\s*(\d{4})\s*$/,
    /^(.*?)\s*[,;]\s*(\d{4})\s*$/,
    /^(.*?)\s+(\d{4})$/,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]?.trim()) {
      return { title: match[1].trim(), year: Number(match[2]) };
    }
  }
  return { title: clean, year: null };
}

function looksLikeHeader(row: string[]) {
  const keys = row.map((cell) => normalizedKey(cell));
  return keys.some((key) =>
    [...TITLE_KEYS, ...YEAR_KEYS, ...TMDB_KEYS, ...ORIGINAL_KEYS].some(
      (alias) => key === normalizedKey(alias),
    ),
  );
}

/**
 * True when the pasted block looks like a real table: most rows have a plain
 * year (or a TMDB id) in the second column. Plain title lists frequently
 * contain commas inside the title, so they must not be split into cells.
 */
function looksLikeCsvRows(rows: string[][]): boolean {
  const data = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (data.length === 0) return false;
  const structured = data.filter((row) => {
    if (row.length < 2) return false;
    const second = row[1]?.trim() ?? "";
    if (!second) return false;
    if (/^\d{4}$/.test(second)) {
      const year = Number(second);
      return year >= 1800 && year <= 2200;
    }
    return /^\d{5,}$/.test(second);
  }).length;
  return structured >= Math.ceil(data.length * 0.6);
}

function rowFromObject(row: Record<string, unknown>): ImportMatchInput | null {
  const rawTitle = pick(row, TITLE_KEYS);
  if (!rawTitle) return null;
  const embedded = splitTitleYear(rawTitle);
  return {
    title: embedded.title,
    year: yearFrom(pick(row, YEAR_KEYS)) ?? embedded.year,
    originalTitle: pick(row, ORIGINAL_KEYS) || null,
    tmdbId: parseLooseNumber(pick(row, TMDB_KEYS)),
  };
}

function rowFromCells(cells: string[]): ImportMatchInput | null {
  const [first = "", second = "", third = "", fourth = ""] = cells;
  const rawTitle = first.trim();
  if (!rawTitle) return null;
  const embedded = splitTitleYear(rawTitle);
  const secondYear = yearFrom(second);
  const thirdYear = yearFrom(third);
  const secondLooksLikeTmdbId =
    secondYear === null && /^\d{2,}$/.test(second.trim()) && Number(second) > 2200;
  return {
    title: embedded.title,
    year: secondYear ?? (thirdYear === null ? embedded.year : null),
    originalTitle:
      third.trim() && thirdYear === null
        ? third.trim()
        : fourth.trim() && !secondLooksLikeTmdbId
          ? fourth.trim()
          : null,
    tmdbId: secondLooksLikeTmdbId
      ? Number(second)
      : yearFrom(fourth) === null && /^\d{2,}$/.test(fourth.trim())
        ? Number(fourth)
        : null,
  };
}

function dedupe(rows: ImportMatchInput[]) {
  const seen = new Set<string>();
  const result: ImportMatchInput[] = [];
  for (const row of rows) {
    const key = `${row.tmdbId ?? ""}|${row.title.toLowerCase().trim()}|${row.year ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

export type ParseImportResult = {
  rows: ImportMatchInput[];
  skipped: number;
  duplicates: number;
  format: "json" | "csv" | "text";
};

export function parseImportInput(text: string): ParseImportResult {
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) throw new Error("Bitte eine Titelliste einfügen.");

  const rawRows: ImportMatchInput[] = [];
  let format: ParseImportResult["format"] = "text";

  if (clean.startsWith("[") || clean.startsWith("{")) {
    format = "json";
    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("JSON konnte nicht gelesen werden.");
    }
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { movies?: unknown }).movies)
        ? (parsed as { movies: unknown[] }).movies
        : null;
    if (!list) throw new Error("JSON muss ein Array oder ein Objekt mit „movies“ sein.");
    for (const entry of list) {
      if (typeof entry === "string") {
        const split = splitTitleYear(entry);
        if (split.title) rawRows.push({ title: split.title, year: split.year });
      } else if (entry && typeof entry === "object") {
        const row = rowFromObject(entry as Record<string, unknown>);
        if (row) rawRows.push(row);
      }
    }
  } else {
    const cells = parseCsv(clean);
    if (cells.length === 0) throw new Error("Keine Zeilen erkannt.");
    const hasHeader = looksLikeHeader(cells[0]);
    if (hasHeader) {
      format = "csv";
      const headers = cells[0].map((cell) => cell.trim());
      for (const line of cells.slice(1)) {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = (line[index] ?? "").trim();
        });
        const parsed = rowFromObject(row);
        if (parsed) rawRows.push(parsed);
      }
    } else if (looksLikeCsvRows(cells)) {
      format = "csv";
      for (const line of cells) {
        const parsed = rowFromCells(line);
        if (parsed) rawRows.push(parsed);
      }
    } else {
      // Plain title list: one title per line. Commas stay part of the title.
      format = "text";
      for (const line of clean.split(/\r?\n/)) {
        const entry = line.trim().replace(/^[-*•]\s*/, "");
        if (!entry) continue;
        const parsed = splitTitleYear(entry);
        if (parsed.title) {
          rawRows.push({ title: parsed.title, year: parsed.year });
        }
      }
    }
  }

  const valid = rawRows.filter((row) => row.title.trim().length > 0);
  const rows = dedupe(valid);
  return {
    rows,
    skipped: rawRows.length - valid.length,
    duplicates: valid.length - rows.length,
    format,
  };
}
