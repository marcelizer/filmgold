import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_WEIGHTS } from "./scoring";
import type { ScoreWeights } from "./types";

const globalForDb = globalThis as unknown as {
  __filmgoldDb?: Database.Database;
};

function databasePath() {
  if (process.env.DATABASE_PATH) {
    return path.isAbsolute(process.env.DATABASE_PATH)
      ? process.env.DATABASE_PATH
      : path.join(/* turbopackIgnore: true */ process.cwd(), process.env.DATABASE_PATH);
  }
  return path.join(process.cwd(), "data", "filmgold.db");
}

const MOVIE_COLUMNS = [
  "id",
  "tmdb_id",
  "slug",
  "title_de",
  "title_original",
  "year",
  "release_date",
  "overview_de",
  "tagline_de",
  "poster_path",
  "backdrop_path",
  "genres",
  "runtime",
  "director",
  "cast_list",
  "country",
  "original_language",
  "age_rating",
  "imdb_id",
  "imdb_rating",
  "imdb_votes",
  "rt_rating",
  "metacritic",
  "tmdb_rating",
  "tmdb_votes",
  "box_office",
  "budget",
  "popularity",
  "oscar_wins",
  "oscar_nominations",
  "awards",
  "critics_score",
  "audience_score",
  "boxoffice_score",
  "popularity_score",
  "renown_score",
  "total_score",
  "source",
  "created_at",
  "updated_at",
] as const;

function createMoviesTable(name = "movies") {
  return `
    CREATE TABLE IF NOT EXISTS ${name} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_type TEXT NOT NULL DEFAULT 'movie' CHECK (media_type IN ('movie', 'serie')),
      tmdb_id INTEGER,
      slug TEXT NOT NULL UNIQUE,
      title_de TEXT NOT NULL,
      title_en TEXT,
      title_original TEXT NOT NULL DEFAULT '',
      year INTEGER,
      end_year INTEGER,
      seasons INTEGER,
      episodes INTEGER,
      series_status TEXT,
      release_date TEXT,
      overview_de TEXT,
      overview_en TEXT,
      tagline_de TEXT,
      tagline_en TEXT,
      poster_path TEXT,
      poster_local TEXT,
      backdrop_path TEXT,
      backdrop_local TEXT,
      genres TEXT NOT NULL DEFAULT '[]',
      genres_en TEXT NOT NULL DEFAULT '[]',
      runtime INTEGER,
      director TEXT,
      cast_list TEXT NOT NULL DEFAULT '[]',
      country TEXT,
      original_language TEXT,
      age_rating TEXT,
      imdb_id TEXT,
      imdb_rating REAL,
      imdb_votes INTEGER,
      rt_rating INTEGER,
      metacritic INTEGER,
      tmdb_rating REAL,
      tmdb_votes INTEGER,
      box_office INTEGER,
      budget INTEGER,
      popularity REAL,
      oscar_wins INTEGER NOT NULL DEFAULT 0,
      oscar_nominations INTEGER NOT NULL DEFAULT 0,
      awards TEXT,
      critics_score REAL,
      audience_score REAL,
      boxoffice_score REAL,
      popularity_score REAL,
      renown_score REAL,
      total_score REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;
}

function hasColumn(db: Database.Database, table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return rows.some((row) => row.name === column);
}

/** Introduce the movie/series split without losing existing rows or personal data. */
function migrateMediaType(db: Database.Database) {
  if (hasColumn(db, "movies", "media_type")) return;
  db.pragma("foreign_keys = OFF");
  const transaction = db.transaction(() => {
    db.exec(createMoviesTable("movies_new"));
    const columns = MOVIE_COLUMNS.join(", ");
    db.exec(
      `INSERT INTO movies_new (media_type, ${columns})
       SELECT 'movie', ${columns} FROM movies`,
    );
    db.exec("DROP TABLE movies");
    db.exec("ALTER TABLE movies_new RENAME TO movies");
  });
  try {
    transaction();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

function migrate(db: Database.Database) {
  db.exec(createMoviesTable("movies"));

  migrateMediaType(db);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_media_tmdb
      ON movies(media_type, tmdb_id) WHERE tmdb_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_movies_media ON movies(media_type, total_score DESC);

    CREATE TABLE IF NOT EXISTS personal (
      movie_id INTEGER PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
      seen INTEGER NOT NULL DEFAULT 0,
      rating REAL,
      favorite INTEGER NOT NULL DEFAULT 0,
      watched_at TEXT,
      note TEXT,
      rewatch_active INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS list_items (
      list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (list_id, movie_id)
    );

    CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id, position);
    CREATE INDEX IF NOT EXISTS idx_list_items_movie ON list_items(movie_id);

    CREATE INDEX IF NOT EXISTS idx_movies_score ON movies(total_score DESC);
    CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year DESC);
    CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title_de COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      season_number INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      tmdb_id INTEGER,
      title TEXT NOT NULL DEFAULT '',
      title_en TEXT,
      overview TEXT,
      overview_en TEXT,
      air_date TEXT,
      runtime INTEGER,
      still_path TEXT,
      still_local TEXT,
      UNIQUE(movie_id, season_number, episode_number)
    );

    CREATE TABLE IF NOT EXISTS episode_progress (
      episode_id INTEGER PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
      watched INTEGER NOT NULL DEFAULT 0,
      rewatched INTEGER NOT NULL DEFAULT 0,
      rewatches INTEGER NOT NULL DEFAULT 0,
      watched_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_episodes_series
      ON episodes(movie_id, season_number, episode_number);
  `);

  /*
   * Bilingual content. Existing archives keep their German copy and get the
   * English columns filled by the TMDB backfill in Admin → Import.
   */
  const addColumn = (table: string, column: string, definition: string) => {
    if (!hasColumn(db, table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  addColumn("movies", "title_en", "TEXT");
  addColumn("movies", "overview_en", "TEXT");
  addColumn("movies", "tagline_en", "TEXT");
  addColumn("movies", "genres_en", "TEXT NOT NULL DEFAULT '[]'");
  addColumn("episodes", "title_en", "TEXT");
  addColumn("episodes", "overview_en", "TEXT");

  /*
   * Local media cache: relative paths below data/media. Kept separate from the
   * TMDB path columns so a missing file can always fall back to TMDB.
   */
  addColumn("movies", "poster_local", "TEXT");
  addColumn("movies", "backdrop_local", "TEXT");
  addColumn("episodes", "still_local", "TEXT");

  /*
   * Remembers which starter-package entry a title came from. That makes it
   * possible to remove only a chosen subset instead of the whole package.
   */
  addColumn("movies", "starter_index", "INTEGER");

  /* Additive columns for series progress tracking (safe on existing files). */
  if (!hasColumn(db, "personal", "rewatch_active")) {
    db.exec(
      "ALTER TABLE personal ADD COLUMN rewatch_active INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!hasColumn(db, "episode_progress", "rewatched")) {
    db.exec(
      "ALTER TABLE episode_progress ADD COLUMN rewatched INTEGER NOT NULL DEFAULT 0",
    );
    if (hasColumn(db, "episode_progress", "rewatches")) {
      db.exec(
        "UPDATE episode_progress SET rewatched = CASE WHEN rewatches > 0 THEN 1 ELSE 0 END",
      );
    }
  }

  const defaults: Record<string, string> = {
    score_weights: JSON.stringify(DEFAULT_WEIGHTS),
    tmdb_api_key: "",
    demo_seeded: "",
    site_title: "Filmgold",
  };
  const insert = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
  );
  for (const [key, value] of Object.entries(defaults)) insert.run(key, value);
}

export function getDb(): Database.Database {
  if (!globalForDb.__filmgoldDb) {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    /*
     * A repository can ship a curated archive as `seed/filmgold.db`. Copy it
     * only on the very first start, so the committed seed stays untouched and
     * all personal changes go into data/filmgold.db.
     */
    if (
      !process.env.DATABASE_PATH &&
      !fs.existsSync(/* turbopackIgnore: true */ file)
    ) {
      const seed = path.join(process.cwd(), "seed", "filmgold.db");
      if (fs.existsSync(seed)) fs.copyFileSync(seed, file);
    }
    const db = new Database(file);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    globalForDb.__filmgoldDb = db;
  }
  return globalForDb.__filmgoldDb;
}

export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export function getWeights(): ScoreWeights {
  const raw = getSetting("score_weights");
  if (!raw) return { ...DEFAULT_WEIGHTS };
  try {
    const parsed = JSON.parse(raw) as Partial<ScoreWeights>;
    return {
      critics: Number(parsed.critics ?? DEFAULT_WEIGHTS.critics),
      audience: Number(parsed.audience ?? DEFAULT_WEIGHTS.audience),
      boxoffice: Number(parsed.boxoffice ?? DEFAULT_WEIGHTS.boxoffice),
      popularity: Number(parsed.popularity ?? DEFAULT_WEIGHTS.popularity),
      renown: Number(parsed.renown ?? DEFAULT_WEIGHTS.renown),
    };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export function saveWeights(weights: ScoreWeights) {
  setSetting("score_weights", JSON.stringify(weights));
}

export type TmdbCredentials = {
  apiKey: string | null;
  accessToken: string | null;
  source: "env" | "db" | "none";
};

export function getTmdbCredentials(): TmdbCredentials {
  const envKey = process.env.TMDB_API_KEY?.trim();
  const envToken = process.env.TMDB_ACCESS_TOKEN?.trim();
  if (envKey || envToken) {
    return {
      apiKey: envKey || null,
      accessToken: envToken || null,
      source: "env",
    };
  }
  const stored = getSetting("tmdb_api_key")?.trim();
  if (stored) {
    return {
      apiKey: stored.startsWith("eyJ") ? null : stored,
      accessToken: stored.startsWith("eyJ") ? stored : null,
      source: "db",
    };
  }
  return { apiKey: null, accessToken: null, source: "none" };
}

export function hasTmdbCredentials() {
  return getTmdbCredentials().source !== "none";
}
