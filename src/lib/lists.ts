import { getDb } from "./db";
import { getMovieById, mapMovie } from "./movies";
import type {
  ListSearchCandidate,
  Movie,
  MovieListDetail,
  MovieListMembership,
  MovieListSummary,
} from "./types";

const SELECT_LIST_MOVIES = `
  SELECT m.*, p.seen AS seen, p.rating AS my_rating, p.favorite AS favorite,
         p.watched_at AS watched_at, p.note AS my_note,
         (SELECT json_group_array(name) FROM (
            SELECT l.name AS name
            FROM list_items li2 JOIN lists l ON l.id = li2.list_id
            WHERE li2.movie_id = m.id
            ORDER BY l.name COLLATE NOCASE
          )) AS list_names
  FROM list_items li
  JOIN movies m ON m.id = li.movie_id
  LEFT JOIN personal p ON p.movie_id = m.id
`;

type ListRow = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  count: number;
};

function mapList(row: ListRow): MovieListSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    count: Number(row.count ?? 0),
    coverMovies: [],
  };
}

function listMovies(listId: number, limit?: number): Movie[] {
  const db = getDb();
  const sql = `${SELECT_LIST_MOVIES} WHERE li.list_id = ? ORDER BY li.position ASC, li.added_at ASC${
    limit ? " LIMIT ?" : ""
  }`;
  const rows = (
    limit
      ? db.prepare(sql).all(listId, limit)
      : db.prepare(sql).all(listId)
  ) as Record<string, unknown>[];
  return rows.map(mapMovie);
}

function withCovers(list: MovieListSummary): MovieListSummary {
  return { ...list, coverMovies: listMovies(list.id, 4) };
}

export function getLists(): MovieListSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS count
       FROM lists l
       ORDER BY l.updated_at DESC, l.id DESC`,
    )
    .all() as ListRow[];
  return rows.map((row) => withCovers(mapList(row)));
}

export function getListDetail(id: number): MovieListDetail | null {
  const row = getDb()
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS count
       FROM lists l WHERE l.id = ?`,
    )
    .get(id) as ListRow | undefined;
  if (!row) return null;
  const list = withCovers(mapList(row));
  return { ...list, movies: listMovies(id) };
}

export function getListsForMovie(movieId: number): MovieListMembership[] {
  const rows = getDb()
    .prepare(
      `SELECT l.id, l.name, l.description,
              (SELECT COUNT(*) FROM list_items li2 WHERE li2.list_id = l.id) AS count,
              EXISTS(SELECT 1 FROM list_items li WHERE li.list_id = l.id AND li.movie_id = ?) AS contains
       FROM lists l
       ORDER BY l.updated_at DESC, l.id DESC`,
    )
    .all(movieId) as {
    id: number;
    name: string;
    description: string | null;
    count: number;
    contains: number;
  }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    count: Number(row.count ?? 0),
    contains: Boolean(row.contains),
  }));
}

function cleanName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Bitte einen Listennamen eingeben.");
  return name.slice(0, 80);
}

function cleanDescription(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const description = value.trim().slice(0, 400);
  return description || null;
}

function ensureList(id: number) {
  const row = getDb().prepare("SELECT id FROM lists WHERE id = ?").get(id);
  if (!row) throw new Error("Liste nicht gefunden.");
}

export function createList(name: string, description?: string | null): number {
  const db = getDb();
  const clean = cleanName(name);
  const exists = db
    .prepare("SELECT id FROM lists WHERE name = ? COLLATE NOCASE")
    .get(clean);
  if (exists) throw new Error("Eine Liste mit diesem Namen existiert bereits.");
  const info = db
    .prepare("INSERT INTO lists (name, description) VALUES (?, ?)")
    .run(clean, cleanDescription(description));
  return Number(info.lastInsertRowid);
}

export function updateList(
  id: number,
  patch: { name?: string; description?: string | null },
): void {
  const db = getDb();
  ensureList(id);
  const current = db
    .prepare("SELECT name, description FROM lists WHERE id = ?")
    .get(id) as { name: string; description: string | null };
  const name = patch.name !== undefined ? cleanName(patch.name) : current.name;
  const description =
    patch.description !== undefined
      ? cleanDescription(patch.description)
      : current.description;
  const clash = db
    .prepare("SELECT id FROM lists WHERE name = ? COLLATE NOCASE AND id != ?")
    .get(name, id);
  if (clash) throw new Error("Eine Liste mit diesem Namen existiert bereits.");
  db.prepare(
    "UPDATE lists SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(name, description, id);
}

export function deleteList(id: number): void {
  getDb().prepare("DELETE FROM lists WHERE id = ?").run(id);
}

export function addMovieToList(listId: number, movieId: number): boolean {
  const db = getDb();
  ensureList(listId);
  const movie = getMovieById(movieId);
  if (!movie) throw new Error("Titel nicht gefunden.");
  const existing = db
    .prepare("SELECT 1 FROM list_items WHERE list_id = ? AND movie_id = ?")
    .get(listId, movieId);
  if (existing) return false;
  const { next } = db
    .prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM list_items WHERE list_id = ?",
    )
    .get(listId) as { next: number };
  db.prepare(
    "INSERT INTO list_items (list_id, movie_id, position) VALUES (?, ?, ?)",
  ).run(listId, movieId, next);
  db.prepare("UPDATE lists SET updated_at = datetime('now') WHERE id = ?").run(listId);
  return true;
}

export function removeMovieFromList(listId: number, movieId: number): void {
  const db = getDb();
  db.prepare("DELETE FROM list_items WHERE list_id = ? AND movie_id = ?").run(
    listId,
    movieId,
  );
  normalizePositions(listId);
  db.prepare("UPDATE lists SET updated_at = datetime('now') WHERE id = ?").run(listId);
}

function normalizePositions(listId: number) {
  const db = getDb();
  const items = db
    .prepare(
      "SELECT movie_id FROM list_items WHERE list_id = ? ORDER BY position ASC, added_at ASC",
    )
    .all(listId) as { movie_id: number }[];
  const update = db.prepare(
    "UPDATE list_items SET position = ? WHERE list_id = ? AND movie_id = ?",
  );
  const transaction = db.transaction(() => {
    items.forEach((item, index) => update.run(index, listId, item.movie_id));
  });
  transaction();
}

export function moveListItem(
  listId: number,
  movieId: number,
  direction: "up" | "down",
): void {
  const db = getDb();
  ensureList(listId);
  normalizePositions(listId);
  const items = db
    .prepare(
      "SELECT movie_id FROM list_items WHERE list_id = ? ORDER BY position ASC",
    )
    .all(listId) as { movie_id: number }[];
  const index = items.findIndex((item) => item.movie_id === movieId);
  if (index < 0) throw new Error("Titel ist nicht in dieser Liste.");
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return;
  const update = db.prepare(
    "UPDATE list_items SET position = ? WHERE list_id = ? AND movie_id = ?",
  );
  const transaction = db.transaction(() => {
    update.run(target, listId, items[index].movie_id);
    update.run(index, listId, items[target].movie_id);
    db.prepare("UPDATE lists SET updated_at = datetime('now') WHERE id = ?").run(listId);
  });
  transaction();
}

export function isMovieInList(listId: number, movieId: number): boolean {
  return Boolean(
    getDb()
      .prepare("SELECT 1 FROM list_items WHERE list_id = ? AND movie_id = ?")
      .get(listId, movieId),
  );
}

/** All movie ids that belong to a list – used to filter year/genre views. */
export function getListMovieIds(listId: number): number[] {
  const rows = getDb()
    .prepare("SELECT movie_id FROM list_items WHERE list_id = ?")
    .all(listId) as { movie_id: number }[];
  return rows.map((row) => row.movie_id);
}

/** Compact list catalogue for filter dropdowns. */
export function getListOptions(): { id: number; name: string; count: number }[] {
  return (
    getDb()
      .prepare(
        `SELECT l.id, l.name,
                (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS count
         FROM lists l
         ORDER BY l.name COLLATE NOCASE ASC`,
      )
      .all() as { id: number; name: string; count: number }[]
  ).map((row) => ({ id: row.id, name: row.name, count: Number(row.count ?? 0) }));
}

/** Search the local archive for movies to place on a list. */
export function searchArchiveCandidates(
  query: string,
  limit = 8,
): ListSearchCandidate[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const rows = getDb()
    .prepare(
      `SELECT id, media_type, tmdb_id, title_de, title_original, year, poster_path, tmdb_rating
       FROM movies
       WHERE title_de LIKE @q OR title_original LIKE @q OR director LIKE @q
       ORDER BY total_score DESC, title_de COLLATE NOCASE ASC
       LIMIT @limit`,
    )
    .all({ q: `%${trimmed}%`, limit }) as {
    id: number;
    media_type: string;
    tmdb_id: number | null;
    title_de: string;
    title_original: string;
    year: number | null;
    poster_path: string | null;
    tmdb_rating: number | null;
  }[];
  return rows.map((row) => ({
    key: `db-${row.id}`,
    movieId: row.id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type === "serie" ? "serie" : "movie",
    title: row.title_de,
    originalTitle: row.title_original,
    year: row.year,
    posterPath: row.poster_path,
    rating: row.tmdb_rating,
    inList: false,
    inArchive: true,
  }));
}
