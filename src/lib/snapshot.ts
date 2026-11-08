import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getDb } from "./db";
import {
  SNAPSHOT_PRESETS,
  normalizeSnapshotScope,
  type SnapshotPreset,
  type SnapshotScope,
} from "./snapshot-options";

type Row = Record<string, unknown>;

const TABLE_ORDER = [
  "movies",
  "episodes",
  "personal",
  "episode_progress",
  "lists",
  "list_items",
  "settings",
] as const;

const SETTINGS_BLOCKLIST = /(tmdb|api|token|secret|key)/i;

export type SnapshotResult = {
  path: string;
  directory: string;
  filename: string;
  bytes: number;
  counts: Record<string, number>;
};

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function selectedTables(scope: SnapshotScope) {
  const tables = new Set<string>(["movies"]);
  if (scope.includeEpisodes) tables.add("episodes");
  if (scope.includePersonal) {
    tables.add("personal");
    if (scope.includeEpisodes) tables.add("episode_progress");
  }
  if (scope.includeLists) {
    tables.add("lists");
    tables.add("list_items");
  }
  if (scope.includeSettings) tables.add("settings");
  return tables;
}

function tableColumns(db: Database.Database, table: string) {
  return (
    db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as {
      name: string;
    }[]
  ).map((row) => row.name);
}

function copyRows(
  target: Database.Database,
  table: string,
  rows: Row[],
  overrides: Record<string, null> = {},
) {
  if (rows.length === 0) return;
  const columns = tableColumns(target, table);
  const statement = target.prepare(
    `INSERT INTO ${quoteIdentifier(table)} (${columns
      .map(quoteIdentifier)
      .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
  );
  const insert = target.transaction((entries: Row[]) => {
    for (const row of entries) {
      statement.run(
        ...columns.map((column) =>
          column in overrides ? overrides[column] : (row[column] ?? null),
        ),
      );
    }
  });
  insert(rows);
}

function createSchema(
  source: Database.Database,
  target: Database.Database,
  tables: Set<string>,
) {
  for (const table of TABLE_ORDER) {
    if (!tables.has(table)) continue;
    const row = source
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) as { sql: string | null } | undefined;
    if (row?.sql) target.exec(row.sql);
  }
}

/**
 * Build a standalone SQLite file from the live archive. IDs are preserved so
 * list items and personal rows keep pointing at the right titles.
 */
export function buildDatabaseSnapshot(
  input: Partial<SnapshotScope>,
): SnapshotResult {
  const scope = normalizeSnapshotScope(input);
  const source = getDb();
  const tables = selectedTables(scope);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "filmgold-snapshot-"));
  const file = path.join(directory, "filmgold.db");
  const target = new Database(file);
  let closed = false;

  try {
    target.pragma("journal_mode = DELETE");
    target.pragma("foreign_keys = OFF");
    createSchema(source, target, tables);

    const mediaWhere = scope.media === "all" ? "" : " WHERE media_type = ?";
    const movieRows = source
      .prepare(`SELECT * FROM movies${mediaWhere} ORDER BY id ASC`)
      .all(...(scope.media === "all" ? [] : [scope.media])) as Row[];
    const movieIds = new Set(movieRows.map((row) => Number(row.id)));
    for (const row of movieRows) {
      if (!scope.includeMediaPaths) {
        row.poster_local = null;
        row.backdrop_local = null;
      }
    }
    copyRows(target, "movies", movieRows);

    let episodeRows: Row[] = [];
    if (scope.includeEpisodes) {
      episodeRows = (
        source.prepare("SELECT * FROM episodes ORDER BY id ASC").all() as Row[]
      ).filter((row) => movieIds.has(Number(row.movie_id)));
      for (const row of episodeRows) {
        if (!scope.includeMediaPaths) row.still_local = null;
      }
      copyRows(target, "episodes", episodeRows);
    }
    const episodeIds = new Set(episodeRows.map((row) => Number(row.id)));

    let personalRows: Row[] = [];
    if (scope.includePersonal) {
      personalRows = (
        source.prepare("SELECT * FROM personal").all() as Row[]
      ).filter((row) => movieIds.has(Number(row.movie_id)));
      copyRows(target, "personal", personalRows);

      if (scope.includeEpisodes) {
        const progressRows = (
          source.prepare("SELECT * FROM episode_progress").all() as Row[]
        ).filter((row) => episodeIds.has(Number(row.episode_id)));
        copyRows(target, "episode_progress", progressRows);
      }
    }

    let listRows: Row[] = [];
    let listItemRows: Row[] = [];
    if (scope.includeLists) {
      listRows = source.prepare("SELECT * FROM lists ORDER BY id ASC").all() as Row[];
      const listIds = new Set(listRows.map((row) => Number(row.id)));
      listItemRows = (
        source
          .prepare("SELECT * FROM list_items ORDER BY list_id ASC, position ASC")
          .all() as Row[]
      ).filter(
        (row) =>
          listIds.has(Number(row.list_id)) && movieIds.has(Number(row.movie_id)),
      );
      copyRows(target, "lists", listRows);
      copyRows(target, "list_items", listItemRows);
    }

    let settingsRows: Row[] = [];
    if (scope.includeSettings) {
      settingsRows = (
        source.prepare("SELECT * FROM settings ORDER BY key ASC").all() as Row[]
      ).filter((row) => !SETTINGS_BLOCKLIST.test(String(row.key ?? "")));
      copyRows(target, "settings", settingsRows);
    }

    target.exec("VACUUM");
    const bytes = fs.statSync(file).size;
    return {
      path: file,
      directory,
      filename: `filmgold-archive-${new Date().toISOString().slice(0, 10)}.db`,
      bytes,
      counts: {
        movies: movieRows.length,
        episodes: episodeRows.length,
        personal: personalRows.length,
        lists: listRows.length,
        listItems: listItemRows.length,
        settings: settingsRows.length,
      },
    };
  } catch (error) {
    closed = true;
    target.close();
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  } finally {
    if (!closed) target.close();
  }
}

export function cleanupSnapshot(result: SnapshotResult) {
  fs.rmSync(result.directory, { recursive: true, force: true });
}

export type SnapshotComparison = {
  preset: SnapshotPreset;
  bytes: number;
  counts: Record<string, number>;
};

/** Build the three presets once so the admin page can show real file sizes. */
export function compareSnapshots(): SnapshotComparison[] {
  return (Object.keys(SNAPSHOT_PRESETS) as SnapshotPreset[]).map((preset) => {
    const result = buildDatabaseSnapshot(SNAPSHOT_PRESETS[preset]);
    try {
      return {
        preset,
        bytes: result.bytes,
        counts: result.counts,
      };
    } finally {
      cleanupSnapshot(result);
    }
  });
}
