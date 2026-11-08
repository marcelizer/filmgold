import { getDb } from "./db";
import { SEED_MOVIES, SEED_SERIES, type SeedEntry } from "./seed-list";
import type { MediaType } from "./types";

/**
 * Normalise a title so casing, punctuation and accents do not matter when a
 * starter-package entry is matched against what is already in the archive.
 */
function normalizeTitle(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type TitleRow = {
  id: number;
  title_de: string | null;
  title_en: string | null;
  title_original: string | null;
  year: number | null;
  source: string;
  starter_index: number | null;
};

type PreparedTitle = {
  id: number;
  year: number | null;
  titles: Set<string>;
};

function seedEntries(media: MediaType): SeedEntry[] {
  return media === "movie" ? SEED_MOVIES : SEED_SERIES;
}

function titleRows(media: MediaType): TitleRow[] {
  return getDb()
    .prepare(
      `SELECT id, title_de, title_en, title_original, year, source, starter_index
       FROM movies WHERE media_type = ?`,
    )
    .all(media) as TitleRow[];
}

function prepare(rows: TitleRow[]): PreparedTitle[] {
  return rows.map((row) => ({
    id: Number(row.id),
    year: row.year === null ? null : Number(row.year),
    titles: new Set(
      [row.title_de, row.title_en, row.title_original]
        .map((value) => normalizeTitle(value))
        .filter(Boolean),
    ),
  }));
}

/**
 * Best archive match for one seed entry. Titles have to match exactly after
 * normalisation and the year may differ by one (TMDB premieres occasionally
 * differ between countries). When duplicates exist, the closest year wins.
 */
function bestMatch(entry: SeedEntry, rows: PreparedTitle[]): number | null {
  const needle = normalizeTitle(entry.title);
  if (!needle) return null;
  let best: { id: number; distance: number } | null = null;
  for (const row of rows) {
    if (row.year === null) continue;
    const distance = Math.abs(row.year - entry.year);
    if (distance > 1) continue;
    if (!row.titles.has(needle)) continue;
    if (!best || distance < best.distance) {
      best = { id: row.id, distance };
    }
  }
  return best?.id ?? null;
}

/** Package indices that already have a matching title in the archive. */
export function matchStarterEntries(media: MediaType): Map<number, number> {
  const rows = prepare(titleRows(media));
  const result = new Map<number, number>();
  seedEntries(media).forEach((entry, index) => {
    const id = bestMatch(entry, rows);
    if (id !== null) result.set(index, id);
  });
  return result;
}

export type StarterPresence = {
  /** Indexed through the starter package itself (`source = 'starter'`). */
  imported: number[];
  /** Any package entry that already has a matching title in the archive. */
  present: number[];
};

export function getStarterPresence(media: MediaType): StarterPresence {
  const imported = new Set<number>();
  for (const row of titleRows(media)) {
    if (row.source === "starter" && row.starter_index !== null) {
      imported.add(Number(row.starter_index));
    }
  }
  const present = new Set(imported);
  for (const index of matchStarterEntries(media).keys()) present.add(index);
  return {
    imported: [...imported].sort((a, b) => a - b),
    present: [...present].sort((a, b) => a - b),
  };
}

/**
 * Archive ids for the selected package entries. This deliberately matches by
 * title + year, so titles that are already in the archive but were added
 * manually (or before starter indices existed) can be removed as well.
 */
export function findStarterMovieIds(
  media: MediaType,
  indices: number[],
): number[] {
  const entries = seedEntries(media);
  const rows = prepare(titleRows(media));
  const ids = new Set<number>();
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= entries.length) {
      continue;
    }
    const id = bestMatch(entries[index], rows);
    if (id !== null) ids.add(id);
  }
  return [...ids];
}
