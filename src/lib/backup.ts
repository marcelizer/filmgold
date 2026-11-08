import { getDb } from "./db";
import { recomputeAllScores } from "./movies";
import { slugify, uniqueSlug } from "./slug";
import type { MediaType } from "./types";

export const BACKUP_FORMAT = "filmgold-backup";
export const BACKUP_VERSION = 1;

type Row = Record<string, unknown>;

export type BackupScope =
  | { type: "all" }
  | { type: "list"; listId: number; listName: string };

export type BackupList = {
  name: string;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  movieKeys: string[];
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  generatedAt: string;
  scope: BackupScope;
  counts: {
    movies: number;
    personal: number;
    episodes: number;
    episodeProgress: number;
    lists: number;
  };
  movies: Row[];
  personal: Row[];
  episodes: Row[];
  episodeProgress: Row[];
  lists: BackupList[];
};

export type RestoreSummary = {
  moviesAdded: number;
  moviesUpdated: number;
  personal: number;
  episodes: number;
  episodeProgress: number;
  listsAdded: number;
  listItems: number;
};

function normalizeTitle(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function keyFor(
  media: unknown,
  tmdbId: unknown,
  title: unknown,
  year: unknown,
) {
  const type: MediaType = media === "serie" ? "serie" : "movie";
  const tmdb = Number(tmdbId);
  if (Number.isFinite(tmdb) && tmdb > 0) return `tmdb:${type}:${Math.round(tmdb)}`;
  const normalized = normalizeTitle(title) || "untitled";
  const yearValue = Number(year);
  const yearPart = Number.isFinite(yearValue) && yearValue > 0 ? yearValue : "";
  return `title:${type}:${normalized}:${yearPart}`;
}

function movieRowKey(row: Row) {
  return keyFor(row.media_type, row.tmdb_id, row.title_de, row.year);
}

function idsClause(ids: number[]) {
  return ids.map(() => "?").join(", ");
}

function scopedMovieRows(listId?: number) {
  const db = getDb();
  if (typeof listId === "number" && Number.isFinite(listId) && listId > 0) {
    return db
      .prepare(
        `SELECT m.* FROM list_items li
         JOIN movies m ON m.id = li.movie_id
         WHERE li.list_id = ?
         ORDER BY li.position ASC, li.added_at ASC`,
      )
      .all(listId) as Row[];
  }
  return db.prepare("SELECT * FROM movies ORDER BY id ASC").all() as Row[];
}

function stripId(row: Row) {
  const copy: Row = {};
  for (const [column, value] of Object.entries(row)) {
    if (column === "id") continue;
    copy[column] = value;
  }
  return copy;
}

function omit(row: Row, keys: string[]) {
  const copy: Row = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

export function buildBackup(options: { listId?: number } = {}): BackupFile {
  const db = getDb();
  const listId =
    typeof options.listId === "number" && Number.isFinite(options.listId)
      ? Math.round(options.listId)
      : undefined;

  let scope: BackupScope = { type: "all" };
  if (listId) {
    const list = db
      .prepare("SELECT id, name FROM lists WHERE id = ?")
      .get(listId) as { id: number; name: string } | undefined;
    if (!list) throw new Error("Liste nicht gefunden.");
    scope = { type: "list", listId: list.id, listName: list.name };
  }

  const movieRows = scopedMovieRows(listId);
  const movieIds = movieRows
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));
  const keyById = new Map<number, string>();
  const movies: Row[] = movieRows.map((row) => {
    const key = movieRowKey(row);
    keyById.set(Number(row.id), key);
    return { ...stripId(row), key };
  });

  let personal: Row[] = [];
  let episodes: Row[] = [];
  let episodeProgress: Row[] = [];
  if (movieIds.length > 0) {
    personal = (
      db
        .prepare(
          `SELECT p.movie_id, p.seen, p.rating, p.favorite, p.watched_at,
                  p.note, p.rewatch_active, p.updated_at,
                  m.media_type AS movie_media_type, m.tmdb_id AS movie_tmdb_id,
                  m.title_de AS movie_title_de, m.year AS movie_year
           FROM personal p JOIN movies m ON m.id = p.movie_id
           WHERE p.movie_id IN (${idsClause(movieIds)})`,
        )
        .all(...movieIds) as Row[]
    ).map((row) => {
      return {
        ...omit(row, ["movie_id"]),
        movieKey: keyFor(
          row.movie_media_type,
          row.movie_tmdb_id,
          row.movie_title_de,
          row.movie_year,
        ),
      };
    });

    episodes = (
      db
        .prepare(
          `SELECT e.*, m.media_type AS movie_media_type,
                  m.tmdb_id AS movie_tmdb_id, m.title_de AS movie_title_de,
                  m.year AS movie_year
           FROM episodes e JOIN movies m ON m.id = e.movie_id
           WHERE e.movie_id IN (${idsClause(movieIds)})
           ORDER BY e.movie_id ASC, e.season_number ASC, e.episode_number ASC`,
        )
        .all(...movieIds) as Row[]
    ).map((row) => {
      return {
        ...omit(row, ["id", "movie_id"]),
        movieKey: keyFor(
          row.movie_media_type,
          row.movie_tmdb_id,
          row.movie_title_de,
          row.movie_year,
        ),
      };
    });

    episodeProgress = (
      db
        .prepare(
          `SELECT ep.episode_id, ep.watched, ep.rewatched, ep.rewatches,
                  ep.watched_at, ep.updated_at,
                  e.season_number, e.episode_number,
                  m.media_type AS movie_media_type, m.tmdb_id AS movie_tmdb_id,
                  m.title_de AS movie_title_de, m.year AS movie_year
           FROM episode_progress ep
           JOIN episodes e ON e.id = ep.episode_id
           JOIN movies m ON m.id = e.movie_id
           WHERE e.movie_id IN (${idsClause(movieIds)})`,
        )
        .all(...movieIds) as Row[]
    ).map((row) => {
      return {
        ...omit(row, ["episode_id"]),
        movieKey: keyFor(
          row.movie_media_type,
          row.movie_tmdb_id,
          row.movie_title_de,
          row.movie_year,
        ),
      };
    });
  }

  const listRows = (
    listId
      ? db.prepare("SELECT * FROM lists WHERE id = ?").all(listId)
      : db.prepare("SELECT * FROM lists ORDER BY id ASC").all()
  ) as Row[];
  const listIds = listRows.map((row) => Number(row.id));
  const items =
    listIds.length > 0
      ? (db
          .prepare(
            `SELECT list_id, movie_id, position FROM list_items
             WHERE list_id IN (${idsClause(listIds)})
             ORDER BY list_id ASC, position ASC, added_at ASC`,
          )
          .all(...listIds) as Row[])
      : [];
  const itemsByList = new Map<number, string[]>();
  for (const item of items) {
    const id = Number(item.movie_id);
    const key = keyById.get(id);
    if (!key) continue;
    const list = Number(item.list_id);
    const keys = itemsByList.get(list) ?? [];
    keys.push(key);
    itemsByList.set(list, keys);
  }
  const lists: BackupList[] = listRows.map((row) => ({
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    movieKeys: itemsByList.get(Number(row.id)) ?? [],
  }));

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    generatedAt: new Date().toISOString(),
    scope,
    counts: {
      movies: movies.length,
      personal: personal.length,
      episodes: episodes.length,
      episodeProgress: episodeProgress.length,
      lists: lists.length,
    },
    movies,
    personal,
    episodes,
    episodeProgress,
    lists,
  };
}

function asRowArray(value: unknown, label: string, max: number): Row[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`Backup: „${label}“ ist ungültig.`);
  if (value.length > max) throw new Error(`Backup: „${label}“ ist zu groß.`);
  return value.filter(
    (entry): entry is Row => Boolean(entry) && typeof entry === "object",
  ) as Row[];
}

export type ParsedBackup = {
  movies: Row[];
  personal: Row[];
  episodes: Row[];
  episodeProgress: Row[];
  lists: BackupList[];
  scope: BackupScope | null;
};

export function parseBackup(value: unknown): ParsedBackup {
  let data: unknown = value;
  if (typeof value === "string") {
    try {
      data = JSON.parse(value);
    } catch {
      throw new Error("Die Backup-Datei ist kein gültiges JSON.");
    }
  }
  if (!data || typeof data !== "object") {
    throw new Error("Die Backup-Datei ist ungültig.");
  }
  const record = data as Record<string, unknown>;
  if (record.format !== BACKUP_FORMAT) {
    throw new Error("Diese Datei ist kein Filmgold-Backup.");
  }
  if (Number(record.version) !== BACKUP_VERSION) {
    throw new Error(
      `Nicht unterstützte Backup-Version: ${String(record.version)}.`,
    );
  }
  const movies = asRowArray(record.movies, "movies", 20000);
  const listsRaw = record.lists;
  const lists: BackupList[] = Array.isArray(listsRaw)
    ? listsRaw
        .filter((entry): entry is Row => Boolean(entry) && typeof entry === "object")
        .slice(0, 2000)
        .map((entry) => ({
          name: String(entry.name ?? "").trim(),
          description: (entry.description as string | null) ?? null,
          createdAt: (entry.createdAt as string | null) ?? null,
          updatedAt: (entry.updatedAt as string | null) ?? null,
          movieKeys: Array.isArray(entry.movieKeys)
            ? entry.movieKeys.map(String).slice(0, 20000)
            : [],
        }))
        .filter((entry) => entry.name.length > 0)
    : [];
  const scopeRaw = record.scope as Record<string, unknown> | undefined;
  const scope: BackupScope | null =
    scopeRaw?.type === "list" && Number(scopeRaw.listId) > 0
      ? {
          type: "list",
          listId: Number(scopeRaw.listId),
          listName: String(scopeRaw.listName ?? ""),
        }
      : scopeRaw?.type === "all"
        ? { type: "all" }
        : null;
  return {
    movies,
    personal: asRowArray(record.personal, "personal", 20000),
    episodes: asRowArray(record.episodes, "episodes", 100000),
    episodeProgress: asRowArray(record.episodeProgress, "episodeProgress", 100000),
    lists,
    scope,
  };
}

function movieColumns() {
  const rows = getDb()
    .prepare("PRAGMA table_info(movies)")
    .all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

function boolInt(value: unknown) {
  return value === true || value === 1 || value === "1" ? 1 : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function nullableText(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length ? text : null;
}

export function restoreBackup(value: unknown): RestoreSummary {
  const db = getDb();
  const parsed = parseBackup(value);
  const columns = movieColumns();
  const summary: RestoreSummary = {
    moviesAdded: 0,
    moviesUpdated: 0,
    personal: 0,
    episodes: 0,
    episodeProgress: 0,
    listsAdded: 0,
    listItems: 0,
  };

  const keyToId = new Map<string, number>();
  const findByTmdb = db.prepare(
    "SELECT id FROM movies WHERE media_type = ? AND tmdb_id = ?",
  );
  const findByTitle = db.prepare(
    `SELECT id FROM movies WHERE media_type = ? AND title_de = ? COLLATE NOCASE
     AND COALESCE(year, 0) = COALESCE(?, 0)`,
  );
  const findBySlug = db.prepare("SELECT id FROM movies WHERE slug = ?");
  const slugExists = db.prepare("SELECT 1 FROM movies WHERE slug = ?");

  const transaction = db.transaction(() => {
    for (const movie of parsed.movies) {
      const media: MediaType = movie.media_type === "serie" ? "serie" : "movie";
      const tmdbId = nullableNumber(movie.tmdb_id);
      const title = String(movie.title_de ?? movie.title_original ?? "").trim();
      if (!title) continue;
      const year = nullableNumber(movie.year);
      const key =
        typeof movie.key === "string" && movie.key
          ? movie.key
          : keyFor(media, tmdbId, title, year);

      let existingId: number | null = null;
      const byTmdb =
        tmdbId !== null
          ? (findByTmdb.get(media, tmdbId) as { id: number } | undefined)
          : undefined;
      if (byTmdb) existingId = byTmdb.id;
      if (existingId === null) {
        const byTitle = findByTitle.get(media, title, year) as
          | { id: number }
          | undefined;
        if (byTitle) existingId = byTitle.id;
      }
      if (existingId === null && typeof movie.slug === "string" && movie.slug) {
        const bySlug = findBySlug.get(movie.slug) as { id: number } | undefined;
        if (bySlug) existingId = bySlug.id;
      }

      if (existingId !== null) {
        const entries = Object.entries(movie).filter(
          ([column, value]) =>
            column !== "key" &&
            column !== "id" &&
            column !== "slug" &&
            column !== "created_at" &&
            column !== "updated_at" &&
            value !== undefined &&
            columns.has(column),
        );
        if (entries.length > 0) {
          db.prepare(
            `UPDATE movies SET ${entries
              .map(([column]) => `${column} = @${column}`)
              .join(", ")}, updated_at = datetime('now') WHERE id = @id`,
          ).run({ ...Object.fromEntries(entries), id: existingId });
        }
        summary.moviesUpdated += 1;
        keyToId.set(key, existingId);
        keyToId.set(
          keyFor(media, tmdbId, title, year),
          existingId,
        );
        continue;
      }

      let slug = typeof movie.slug === "string" ? movie.slug.trim() : "";
      if (!slug || slugExists.get(slug)) {
        slug = uniqueSlug(
          slugify(`${title} ${year ?? ""}`.trim()),
          (candidate) => Boolean(slugExists.get(candidate)),
        );
      }
      const record: Row = { ...movie, title_de: title, slug, key: undefined };
      const entries = Object.entries(record).filter(
        ([column, value]) =>
          column !== "key" &&
          column !== "id" &&
          value !== undefined &&
          columns.has(column),
      );
      const info = db
        .prepare(
          `INSERT INTO movies (${entries.map(([column]) => column).join(", ")})
           VALUES (${entries.map(([column]) => `@${column}`).join(", ")})`,
        )
        .run(Object.fromEntries(entries));
      const id = Number(info.lastInsertRowid);
      summary.moviesAdded += 1;
      keyToId.set(key, id);
      keyToId.set(keyFor(media, tmdbId, title, year), id);
    }

    const personalUpsert = db.prepare(
      `INSERT INTO personal
         (movie_id, seen, rating, favorite, watched_at, note, rewatch_active, updated_at)
       VALUES
         (@movieId, @seen, @rating, @favorite, @watchedAt, @note, @rewatchActive, datetime('now'))
       ON CONFLICT(movie_id) DO UPDATE SET
         seen = excluded.seen,
         rating = excluded.rating,
         favorite = excluded.favorite,
         watched_at = excluded.watched_at,
         note = excluded.note,
         rewatch_active = excluded.rewatch_active,
         updated_at = datetime('now')`,
    );
    for (const row of parsed.personal) {
      const movieId = keyToId.get(String(row.movieKey ?? ""));
      if (!movieId) continue;
      personalUpsert.run({
        movieId,
        seen: boolInt(row.seen),
        rating: nullableNumber(row.rating),
        favorite: boolInt(row.favorite),
        watchedAt: nullableText(row.watched_at),
        note: nullableText(row.note),
        rewatchActive: boolInt(row.rewatch_active),
      });
      summary.personal += 1;
    }

    const episodeUpsert = db.prepare(
      `INSERT INTO episodes
         (movie_id, season_number, episode_number, tmdb_id, title, title_en,
          overview, overview_en, air_date, runtime, still_path, still_local)
       VALUES
         (@movieId, @seasonNumber, @episodeNumber, @tmdbId, @title, @titleEn,
          @overview, @overviewEn, @airDate, @runtime, @stillPath, @stillLocal)
       ON CONFLICT(movie_id, season_number, episode_number) DO UPDATE SET
         tmdb_id = COALESCE(excluded.tmdb_id, episodes.tmdb_id),
         title = excluded.title,
         title_en = COALESCE(excluded.title_en, episodes.title_en),
         overview = COALESCE(excluded.overview, episodes.overview),
         overview_en = COALESCE(excluded.overview_en, episodes.overview_en),
         air_date = COALESCE(excluded.air_date, episodes.air_date),
         runtime = COALESCE(excluded.runtime, episodes.runtime),
         still_path = COALESCE(excluded.still_path, episodes.still_path),
         still_local = COALESCE(excluded.still_local, episodes.still_local)`,
    );
    const findEpisode = db.prepare(
      `SELECT id FROM episodes
       WHERE movie_id = ? AND season_number = ? AND episode_number = ?`,
    );
    const episodeKeyToId = new Map<string, number>();
    for (const row of parsed.episodes) {
      const movieId = keyToId.get(String(row.movieKey ?? ""));
      const season = nullableNumber(row.season_number);
      const episode = nullableNumber(row.episode_number);
      if (!movieId || season === null || episode === null) continue;
      episodeUpsert.run({
        movieId,
        seasonNumber: season,
        episodeNumber: episode,
        tmdbId: nullableNumber(row.tmdb_id),
        title: String(row.title ?? ""),
        titleEn: nullableText(row.title_en),
        overview: nullableText(row.overview),
        overviewEn: nullableText(row.overview_en),
        airDate: nullableText(row.air_date),
        runtime: nullableNumber(row.runtime),
        stillPath: nullableText(row.still_path),
        stillLocal: nullableText(row.still_local),
      });
      const found = findEpisode.get(movieId, season, episode) as
        | { id: number }
        | undefined;
      if (found) {
        episodeKeyToId.set(
          `${String(row.movieKey ?? "")}::${season}::${episode}`,
          found.id,
        );
      }
      summary.episodes += 1;
    }

    const progressUpsert = db.prepare(
      `INSERT INTO episode_progress
         (episode_id, watched, rewatched, rewatches, watched_at, updated_at)
       VALUES
         (@episodeId, @watched, @rewatched, @rewatches, @watchedAt, datetime('now'))
       ON CONFLICT(episode_id) DO UPDATE SET
         watched = excluded.watched,
         rewatched = excluded.rewatched,
         rewatches = excluded.rewatches,
         watched_at = excluded.watched_at,
         updated_at = datetime('now')`,
    );
    for (const row of parsed.episodeProgress) {
      const season = nullableNumber(row.season_number);
      const episode = nullableNumber(row.episode_number);
      const movieId = keyToId.get(String(row.movieKey ?? ""));
      let episodeId = episodeKeyToId.get(
        `${String(row.movieKey ?? "")}::${season}::${episode}`,
      );
      if (!episodeId && movieId && season !== null && episode !== null) {
        const found = findEpisode.get(movieId, season, episode) as
          | { id: number }
          | undefined;
        if (found) episodeId = found.id;
      }
      if (!episodeId) continue;
      progressUpsert.run({
        episodeId,
        watched: boolInt(row.watched),
        rewatched: boolInt(row.rewatched),
        rewatches: nullableNumber(row.rewatches) ?? 0,
        watchedAt: nullableText(row.watched_at),
      });
      summary.episodeProgress += 1;
    }

    const findList = db.prepare("SELECT id FROM lists WHERE name = ? COLLATE NOCASE");
    const createList = db.prepare(
      "INSERT INTO lists (name, description) VALUES (?, ?)",
    );
    const nextPosition = db.prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM list_items WHERE list_id = ?",
    );
    const insertItem = db.prepare(
      "INSERT OR IGNORE INTO list_items (list_id, movie_id, position) VALUES (?, ?, ?)",
    );
    const touchList = db.prepare(
      "UPDATE lists SET updated_at = datetime('now') WHERE id = ?",
    );
    for (const list of parsed.lists) {
      let listId = (findList.get(list.name) as { id: number } | undefined)?.id;
      if (!listId) {
        const info = createList.run(list.name, list.description ?? null);
        listId = Number(info.lastInsertRowid);
        summary.listsAdded += 1;
      }
      for (const key of list.movieKeys) {
        const movieId = keyToId.get(key);
        if (!movieId) continue;
        const row = nextPosition.get(listId) as { next: number };
        const info = insertItem.run(listId, movieId, row.next);
        if (info.changes > 0) summary.listItems += 1;
      }
      touchList.run(listId);
    }
  });
  transaction();
  recomputeAllScores();
  return summary;
}
