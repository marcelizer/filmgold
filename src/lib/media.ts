import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { getDb } from "./db";

/**
 * Local media cache.
 *
 * Posters, backdrops and episode stills are downloaded next to the SQLite
 * archive so the app does not depend on image.tmdb.org for titles that are
 * already in the library. Only relative paths are stored in the database
 * (e.g. `posters/3f9c…jpg`); `localMediaUrl()` turns that into `/media/…`.
 */
export type MediaKind = "posters" | "backdrops" | "stills";
export type MediaCacheMode = "missing" | "all";

const IMAGE_SIZE: Record<MediaKind, string> = {
  posters: "w780",
  backdrops: "w1280",
  stills: "w300",
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function resolveAgainstCwd(value: string) {
  return path.isAbsolute(value)
    ? value
    : path.join(/* turbopackIgnore: true */ process.cwd(), value);
}

/**
 * Media follows the database by default. A custom `DATABASE_PATH` (for example
 * a temporary copy used by tests) therefore also gets its own media folder.
 */
export function mediaRoot(): string {
  const custom = process.env.MEDIA_PATH?.trim();
  if (custom) return resolveAgainstCwd(custom);
  const database = process.env.DATABASE_PATH?.trim();
  if (database) return path.join(path.dirname(resolveAgainstCwd(database)), "media");
  return path.join(process.cwd(), "data", "media");
}

export function localMediaUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  return `/media/${relativePath
    .split(/[\\/]/)
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

/** Resolve a stored relative media path without allowing directory traversal. */
export function resolveMediaFile(relativePath: string): string | null {
  if (!relativePath) return null;
  const root = path.resolve(/* turbopackIgnore: true */ mediaRoot());
  const file = path.resolve(root, relativePath);
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return file;
}

function extensionFor(remotePath: string) {
  const ext = path.extname(remotePath.split("?")[0] ?? "").toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) ? ext : ".jpg";
}

function relativePathFor(kind: MediaKind, remotePath: string) {
  const hash = crypto.createHash("sha1").update(remotePath).digest("hex").slice(0, 32);
  return `${kind}/${hash}${extensionFor(remotePath)}`;
}

function remoteUrl(kind: MediaKind, remotePath: string) {
  if (/^https?:\/\//i.test(remotePath)) return remotePath;
  return `https://image.tmdb.org/t/p/${IMAGE_SIZE[kind]}${
    remotePath.startsWith("/") ? "" : "/"
  }${remotePath}`;
}

function fileExists(absolutePath: string) {
  try {
    return fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

export function storedMediaExists(relativePath: string | null | undefined) {
  if (!relativePath) return false;
  const file = resolveMediaFile(relativePath);
  return Boolean(file && fileExists(file));
}

/**
 * Download one image and store it under its content-independent TMDB path
 * hash. Existing files are reused unless `overwrite` is requested.
 */
export async function downloadMediaImage(
  kind: MediaKind,
  remotePath: string,
  options: { overwrite?: boolean } = {},
): Promise<string> {
  const clean = remotePath.trim();
  if (!clean) throw new Error("Kein Bildpfad vorhanden.");
  if (clean.startsWith("/demo-posters")) {
    throw new Error("Demo-Bilder liegen bereits lokal vor.");
  }

  const relative = relativePathFor(kind, clean);
  const target = resolveMediaFile(relative);
  if (!target) throw new Error("Ungültiger Zielpfad.");

  if (!options.overwrite && fileExists(target)) return relative;

  const response = await fetch(remoteUrl(kind, clean), {
    cache: "no-store",
    headers: { accept: "image/*" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error("TMDB hat kein Bild geliefert.");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("Leere Bilddatei.");

  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temporary, bytes);
  try {
    await fsp.rename(temporary, target);
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    throw error;
  }
  return relative;
}

export function removeMediaFile(relativePath: string | null | undefined) {
  if (!relativePath) return;
  const file = resolveMediaFile(relativePath);
  if (!file) return;
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // Best effort: a locked file should never break a deletion.
  }
}

export function removeMediaFiles(paths: (string | null | undefined)[]) {
  for (const relative of paths) removeMediaFile(relative);
}

type MovieMediaRow = {
  id: number;
  media_type: string;
  title_de: string;
  poster_path: string | null;
  poster_local: string | null;
  backdrop_path: string | null;
  backdrop_local: string | null;
};

type EpisodeStillRow = {
  id: number;
  title: string;
  still_path: string | null;
  still_local: string | null;
  movie_title: string;
  season_number: number;
  episode_number: number;
};

type CacheResult = {
  downloaded: number;
  skipped: number;
  failed: string[];
};

/**
 * Cache poster and backdrop for one title. Safe to call after an import:
 * network errors are reported instead of aborting the add operation.
 */
export async function cacheMovieMedia(
  movieId: number,
  options: { overwrite?: boolean } = {},
): Promise<CacheResult> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, media_type, title_de, poster_path, poster_local,
              backdrop_path, backdrop_local
       FROM movies WHERE id = ?`,
    )
    .get(movieId) as MovieMediaRow | undefined;
  if (!row) throw new Error("Titel nicht gefunden.");

  const result: CacheResult = { downloaded: 0, skipped: 0, failed: [] };
  const jobs: {
    kind: MediaKind;
    remote: string | null;
    local: string | null;
    column: "poster_local" | "backdrop_local";
    label: string;
  }[] = [
    {
      kind: "posters",
      remote: row.poster_path,
      local: row.poster_local,
      column: "poster_local",
      label: "Poster",
    },
    {
      kind: "backdrops",
      remote: row.backdrop_path,
      local: row.backdrop_local,
      column: "backdrop_local",
      label: "Backdrop",
    },
  ];

  for (const job of jobs) {
    if (!job.remote) {
      result.skipped += 1;
      continue;
    }
    if (
      !options.overwrite &&
      job.local &&
      storedMediaExists(job.local)
    ) {
      result.skipped += 1;
      continue;
    }
    try {
      const relative = await downloadMediaImage(job.kind, job.remote, {
        overwrite: options.overwrite,
      });
      db.prepare(`UPDATE movies SET ${job.column} = ? WHERE id = ?`).run(
        relative,
        movieId,
      );
      result.downloaded += 1;
    } catch (error) {
      result.failed.push(
        `${row.title_de} – ${job.label}: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`,
      );
    }
  }
  return result;
}

/** Download the stills of one series. */
export async function cacheSeriesStills(
  movieId: number,
  options: { overwrite?: boolean } = {},
): Promise<CacheResult> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, still_path, still_local FROM episodes
       WHERE movie_id = ? AND still_path IS NOT NULL AND still_path <> ''
       ORDER BY season_number ASC, episode_number ASC`,
    )
    .all(movieId) as Pick<EpisodeStillRow, "id" | "still_path" | "still_local">[];

  const result: CacheResult = { downloaded: 0, skipped: 0, failed: [] };
  for (const row of rows) {
    if (!options.overwrite && row.still_local && storedMediaExists(row.still_local)) {
      result.skipped += 1;
      continue;
    }
    try {
      const relative = await downloadMediaImage("stills", row.still_path!, {
        overwrite: options.overwrite,
      });
      db.prepare("UPDATE episodes SET still_local = ? WHERE id = ?").run(
        relative,
        row.id,
      );
      result.downloaded += 1;
    } catch (error) {
      result.failed.push(
        `Folge ${row.id}: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`,
      );
    }
  }
  return result;
}

export type MediaBatchResult = {
  nextOffset: number;
  total: number;
  done: boolean;
  processed: number;
  downloaded: number;
  skipped: number;
  failed: string[];
};

function emptyBatch(offset: number, total: number, processed: number): MediaBatchResult {
  return {
    nextOffset: offset + processed,
    total,
    done: offset + processed >= total,
    processed,
    downloaded: 0,
    skipped: 0,
    failed: [],
  };
}

/** Download posters/backdrops for a page of the archive. */
export async function cacheMovieMediaBatch(options: {
  offset?: number;
  limit?: number;
  mode?: MediaCacheMode;
}): Promise<MediaBatchResult> {
  const db = getDb();
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const limit = Math.min(20, Math.max(1, Math.floor(options.limit ?? 6)));
  const overwrite = options.mode === "all";

  const total = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM movies
           WHERE (poster_path IS NOT NULL AND poster_path <> '')
              OR (backdrop_path IS NOT NULL AND backdrop_path <> '')`,
        )
        .get() as { count: number }
    ).count,
  );
  const rows = db
    .prepare(
      `SELECT id, media_type, title_de, poster_path, poster_local,
              backdrop_path, backdrop_local
       FROM movies
       WHERE (poster_path IS NOT NULL AND poster_path <> '')
          OR (backdrop_path IS NOT NULL AND backdrop_path <> '')
       ORDER BY id ASC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as MovieMediaRow[];

  const result = emptyBatch(offset, total, rows.length);
  for (const row of rows) {
    const jobs: {
      kind: MediaKind;
      remote: string | null;
      local: string | null;
      column: "poster_local" | "backdrop_local";
      label: string;
    }[] = [
      {
        kind: "posters",
        remote: row.poster_path,
        local: row.poster_local,
        column: "poster_local",
        label: "Poster",
      },
      {
        kind: "backdrops",
        remote: row.backdrop_path,
        local: row.backdrop_local,
        column: "backdrop_local",
        label: "Backdrop",
      },
    ];
    for (const job of jobs) {
      if (!job.remote) continue;
      if (!overwrite && job.local && storedMediaExists(job.local)) {
        result.skipped += 1;
        continue;
      }
      try {
        const relative = await downloadMediaImage(job.kind, job.remote, {
          overwrite,
        });
        db.prepare(`UPDATE movies SET ${job.column} = ? WHERE id = ?`).run(
          relative,
          row.id,
        );
        result.downloaded += 1;
      } catch (error) {
        result.failed.push(
          `${row.title_de} – ${job.label}: ${
            error instanceof Error ? error.message : "Unbekannter Fehler"
          }`,
        );
      }
    }
  }
  return result;
}

/** Download episode stills for a page of all tracked episodes. */
export async function cacheEpisodeStillsBatch(options: {
  offset?: number;
  limit?: number;
  mode?: MediaCacheMode;
}): Promise<MediaBatchResult> {
  const db = getDb();
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const limit = Math.min(30, Math.max(1, Math.floor(options.limit ?? 10)));
  const overwrite = options.mode === "all";

  const total = Number(
    (
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM episodes WHERE still_path IS NOT NULL AND still_path <> ''",
        )
        .get() as { count: number }
    ).count,
  );
  const rows = db
    .prepare(
      `SELECT e.id, e.title, e.still_path, e.still_local,
              m.title_de AS movie_title, e.season_number, e.episode_number
       FROM episodes e JOIN movies m ON m.id = e.movie_id
       WHERE e.still_path IS NOT NULL AND e.still_path <> ''
       ORDER BY e.id ASC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as EpisodeStillRow[];

  const result = emptyBatch(offset, total, rows.length);
  for (const row of rows) {
    if (!overwrite && row.still_local && storedMediaExists(row.still_local)) {
      result.skipped += 1;
      continue;
    }
    try {
      const relative = await downloadMediaImage("stills", row.still_path!, {
        overwrite,
      });
      db.prepare("UPDATE episodes SET still_local = ? WHERE id = ?").run(
        relative,
        row.id,
      );
      result.downloaded += 1;
    } catch (error) {
      result.failed.push(
        `${row.movie_title} S${String(row.season_number).padStart(2, "0")}E${String(
          row.episode_number,
        ).padStart(2, "0")}: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`,
      );
    }
  }
  return result;
}

export type MediaStats = {
  movies: number;
  postersCached: number;
  backdropsCached: number;
  episodes: number;
  episodeStills: number;
  stillsCached: number;
  files: number;
  bytes: number;
};

function diskUsage(): { files: number; bytes: number } {
  const root = mediaRoot();
  let files = 0;
  let bytes = 0;

  const walk = (directory: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && !entry.name.includes(".tmp-")) {
        try {
          files += 1;
          bytes += fs.statSync(full).size;
        } catch {
          // ignore unreadable files
        }
      }
    }
  };
  walk(root);
  return { files, bytes };
}

export function getMediaStats(): MediaStats {
  const db = getDb();
  const movies = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN poster_local IS NOT NULL AND poster_local <> '' THEN 1 ELSE 0 END), 0) AS posters,
              COALESCE(SUM(CASE WHEN backdrop_local IS NOT NULL AND backdrop_local <> '' THEN 1 ELSE 0 END), 0) AS backdrops
       FROM movies`,
    )
    .get() as { total: number; posters: number; backdrops: number };
  const episodes = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN still_path IS NOT NULL AND still_path <> '' THEN 1 ELSE 0 END), 0) AS stills,
              COALESCE(SUM(CASE WHEN still_local IS NOT NULL AND still_local <> '' THEN 1 ELSE 0 END), 0) AS cached
       FROM episodes`,
    )
    .get() as { total: number; stills: number; cached: number };
  const disk = diskUsage();
  return {
    movies: Number(movies.total),
    postersCached: Number(movies.posters),
    backdropsCached: Number(movies.backdrops),
    episodes: Number(episodes.total),
    episodeStills: Number(episodes.stills),
    stillsCached: Number(episodes.cached),
    files: disk.files,
    bytes: disk.bytes,
  };
}

/**
 * Remove every cached file and clear the local columns. Metadata and TMDB
 * paths stay untouched, so images fall back to TMDB afterwards.
 */
export function clearMediaCache(): { files: number; bytes: number } {
  const before = diskUsage();
  for (const kind of ["posters", "backdrops", "stills"] as MediaKind[]) {
    try {
      fs.rmSync(path.join(/* turbopackIgnore: true */ mediaRoot(), kind), {
        recursive: true,
        force: true,
      });
    } catch {
      // best effort
    }
  }
  const db = getDb();
  db.exec("UPDATE movies SET poster_local = NULL, backdrop_local = NULL");
  db.exec("UPDATE episodes SET still_local = NULL");
  return before;
}

/** Remove all files that belong to one title (used when it is deleted). */
export function removeMovieMediaFiles(movieId: number) {
  const db = getDb();
  const row = db
    .prepare("SELECT poster_local, backdrop_local FROM movies WHERE id = ?")
    .get(movieId) as
    | { poster_local: string | null; backdrop_local: string | null }
    | undefined;
  const stills = db
    .prepare("SELECT still_local FROM episodes WHERE movie_id = ?")
    .all(movieId) as { still_local: string | null }[];
  removeMediaFiles([
    row?.poster_local,
    row?.backdrop_local,
    ...stills.map((entry) => entry.still_local),
  ]);
}

/** Used by the media route when a restored backup references a missing file. */
export function remotePathForLocal(relativePath: string): {
  kind: MediaKind;
  remote: string;
} | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 'posters' AS kind, poster_path AS remote FROM movies WHERE poster_local = ?
       UNION ALL
       SELECT 'backdrops' AS kind, backdrop_path AS remote FROM movies WHERE backdrop_local = ?
       UNION ALL
       SELECT 'stills' AS kind, still_path AS remote FROM episodes WHERE still_local = ?
       LIMIT 1`,
    )
    .get(relativePath, relativePath, relativePath) as
    | { kind: MediaKind; remote: string | null }
    | undefined;
  if (!row?.remote) return null;
  return { kind: row.kind, remote: row.remote };
}
