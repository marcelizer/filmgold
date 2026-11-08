import { getDb, getSetting, getWeights, setSetting } from "./db";
import { DEMO_MOVIES } from "./demo-data";
import { parseList, parseLooseNumber } from "./csv";
import { slugify, uniqueSlug } from "./slug";
import { removeMediaFile, removeMovieMediaFiles } from "./media";
import { findStarterMovieIds } from "./starter";
import {
  DEFAULT_WEIGHTS,
  computeScores,
  votesFor,
  type ComputedScores,
  type ScoreMaxima,
} from "./scoring";
import type {
  Episode,
  EpisodeInput,
  ListResult,
  MediaType,
  Movie,
  MovieFilters,
  MovieInput,
  SeriesProgress,
  SeriesStateSummary,
  SortKey,
  Stats,
  WatchState,
} from "./types";

const SELECT_MOVIE = `
  SELECT m.*, p.seen AS seen, p.rating AS my_rating, p.favorite AS favorite,
         p.watched_at AS watched_at, p.note AS my_note,
         (SELECT json_group_array(name) FROM (
            SELECT l.name AS name
            FROM list_items li JOIN lists l ON l.id = li.list_id
            WHERE li.movie_id = m.id
            ORDER BY l.name COLLATE NOCASE
          )) AS list_names
  FROM movies m
  LEFT JOIN personal p ON p.movie_id = m.id
`;

function camelizeKey(key: string) {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function safeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function mapMovie(row: Record<string, unknown>): Movie {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) raw[camelizeKey(key)] = value;
  const movie = {
    ...raw,
    mediaType: raw.mediaType === "serie" ? ("serie" as const) : ("movie" as const),
    endYear: numberOrNull(raw.endYear),
    seasons: numberOrNull(raw.seasons),
    episodes: numberOrNull(raw.episodes),
    seriesStatus: (raw.seriesStatus as string | null) ?? null,
    genres: safeArray(raw.genres),
    genresEn: safeArray(raw.genresEn),
    cast: safeArray(raw.castList),
    seen: Boolean(raw.seen),
    favorite: Boolean(raw.favorite),
    listNames: safeArray(raw.listNames),
    starterIndex: numberOrNull(raw.starterIndex),
    myRating: numberOrNull(raw.myRating),
    oscarWins: Number(raw.oscarWins ?? 0),
    oscarNominations: Number(raw.oscarNominations ?? 0),
    totalScore: Number(raw.totalScore ?? 0),
    criticsScore: numberOrNull(raw.criticsScore),
    audienceScore: numberOrNull(raw.audienceScore),
    boxofficeScore: numberOrNull(raw.boxofficeScore),
    popularityScore: numberOrNull(raw.popularityScore),
    renownScore: numberOrNull(raw.renownScore),
    runtime: numberOrNull(raw.runtime),
    year: numberOrNull(raw.year),
    imdbRating: numberOrNull(raw.imdbRating),
    imdbVotes: numberOrNull(raw.imdbVotes),
    rtRating: numberOrNull(raw.rtRating),
    metacritic: numberOrNull(raw.metacritic),
    tmdbRating: numberOrNull(raw.tmdbRating),
    tmdbVotes: numberOrNull(raw.tmdbVotes),
    boxOffice: numberOrNull(raw.boxOffice),
    budget: numberOrNull(raw.budget),
    popularity: numberOrNull(raw.popularity),
  };
  delete (movie as Record<string, unknown>).castList;
  delete (movie as Record<string, unknown>).myNote;
  return {
    ...(movie as unknown as Movie),
    myNote: (raw.myNote as string | null) ?? null,
    watchedAt: (raw.watchedAt as string | null) ?? null,
    myRating: numberOrNull(raw.myRating),
  };
}

function orderBy(sort: SortKey = "score_desc") {
  switch (sort) {
    case "score_asc":
      return "m.total_score ASC, m.title_de COLLATE NOCASE ASC";
    case "year_desc":
      return "m.year IS NULL, m.year DESC, m.total_score DESC";
    case "year_asc":
      return "m.year IS NULL, m.year ASC, m.total_score DESC";
    case "title_asc":
      return "m.title_de COLLATE NOCASE ASC";
    case "boxoffice_desc":
      return "m.box_office IS NULL, m.box_office DESC";
    case "popularity_desc":
      return "m.popularity IS NULL, m.popularity DESC";
    case "myrating_desc":
      return "p.rating IS NULL, p.rating DESC, m.total_score DESC";
    case "added_desc":
      return "m.created_at DESC, m.id DESC";
    case "score_desc":
    default:
      return "m.total_score DESC, m.year DESC, m.title_de COLLATE NOCASE ASC";
  }
}

function buildWhere(filters: MovieFilters) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  clauses.push("m.media_type = @mediaType");
  params.mediaType = filters.media ?? "movie";

  if (filters.q?.trim()) {
    clauses.push(
      "(m.title_de LIKE @q OR m.title_en LIKE @q OR m.title_original LIKE @q OR m.director LIKE @q)",
    );
    params.q = `%${filters.q.trim()}%`;
  }
  if (filters.year) {
    clauses.push("m.year = @year");
    params.year = filters.year;
  }
  if (filters.decade) {
    clauses.push("m.year BETWEEN @decadeFrom AND @decadeTo");
    params.decadeFrom = filters.decade;
    params.decadeTo = filters.decade + 9;
  }
  if (filters.genre) {
    clauses.push(
      "EXISTS (SELECT 1 FROM json_each(m.genres) WHERE value = @genre COLLATE NOCASE)",
    );
    params.genre = filters.genre;
  }
  if (filters.listId) {
    clauses.push(
      "EXISTS (SELECT 1 FROM list_items li WHERE li.movie_id = m.id AND li.list_id = @listId)",
    );
    params.listId = filters.listId;
  }
  if (filters.seen === "seen") clauses.push("p.seen = 1");
  if (filters.seen === "unseen") clauses.push("(p.seen IS NULL OR p.seen = 0)");
  if (filters.favorite) clauses.push("p.favorite = 1");
  if (typeof filters.minScore === "number") {
    clauses.push("m.total_score >= @minScore");
    params.minScore = filters.minScore;
  }
  if (typeof filters.minMyRating === "number") {
    clauses.push("p.rating >= @minMyRating");
    params.minMyRating = filters.minMyRating;
  }
  if (filters.sort === "myrating_desc") {
    clauses.push("p.rating IS NOT NULL");
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function getMovies(filters: MovieFilters = {}): ListResult {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const { sql: where, params } = buildWhere(filters);

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM movies m LEFT JOIN personal p ON p.movie_id = m.id ${where}`,
      )
      .get(params) as { count: number }
  ).count;

  // `0` means "show everything". Any other size may be a custom number.
  const requested = filters.pageSize ?? 24;
  const all = requested === 0;
  const pageSize = all
    ? Math.max(1, total)
    : Math.min(1000, Math.max(1, requested));
  const totalPages = all ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const safePage = all ? 1 : Math.min(page, totalPages);
  const rows = db
    .prepare(
      `${SELECT_MOVIE} ${where} ORDER BY ${orderBy(filters.sort)} LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: pageSize, offset: (safePage - 1) * pageSize }) as Record<
    string,
    unknown
  >[];

  return {
    movies: rows.map(mapMovie),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function getMovieBySlug(slug: string, media?: MediaType): Movie | null {
  const row = (
    media
      ? getDb()
          .prepare(`${SELECT_MOVIE} WHERE m.slug = ? AND m.media_type = ?`)
          .get(slug, media)
      : getDb().prepare(`${SELECT_MOVIE} WHERE m.slug = ?`).get(slug)
  ) as Record<string, unknown> | undefined;
  return row ? mapMovie(row) : null;
}

export function getMovieById(id: number): Movie | null {
  const row = getDb()
    .prepare(`${SELECT_MOVIE} WHERE m.id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapMovie(row) : null;
}

export function getMovieByTmdbId(
  tmdbId: number,
  media: MediaType = "movie",
): Movie | null {
  const row = getDb()
    .prepare(`${SELECT_MOVIE} WHERE m.tmdb_id = ? AND m.media_type = ?`)
    .get(tmdbId, media) as Record<string, unknown> | undefined;
  return row ? mapMovie(row) : null;
}

export function getMovieRank(movie: Movie): { rank: number; total: number } {
  const total = (
    getDb()
      .prepare("SELECT COUNT(*) AS count FROM movies WHERE media_type = ?")
      .get(movie.mediaType) as { count: number }
  ).count;
  const rank = (
    getDb()
      .prepare(
        "SELECT COUNT(*) AS count FROM movies WHERE media_type = ? AND (total_score > ? OR (total_score = ? AND id < ?))",
      )
      .get(movie.mediaType, movie.totalScore, movie.totalScore, movie.id) as {
      count: number;
    }
  ).count;
  return { rank: rank + 1, total };
}

export function getStats(media: MediaType = "movie"): Stats {
  const rows = getDb()
    .prepare(
      `SELECT m.*, p.seen AS seen, p.rating AS my_rating, p.favorite AS favorite
       FROM movies m LEFT JOIN personal p ON p.movie_id = m.id
       WHERE m.media_type = ?`,
    )
    .all(media) as Record<string, unknown>[];

  const genres = new Map<string, number>();
  const decades = new Map<number, number>();
  let seenCount = 0;
  let ratedCount = 0;
  let favoriteCount = 0;
  let scoreSum = 0;
  let myRatingSum = 0;
  let yearMin: number | null = null;
  let yearMax: number | null = null;

  for (const row of rows) {
    const year = numberOrNull(row.year);
    const genreList = safeArray(row.genres);
    for (const genre of genreList) genres.set(genre, (genres.get(genre) ?? 0) + 1);
    if (year) {
      const decade = Math.floor(year / 10) * 10;
      decades.set(decade, (decades.get(decade) ?? 0) + 1);
      yearMin = yearMin === null ? year : Math.min(yearMin, year);
      yearMax = yearMax === null ? year : Math.max(yearMax, year);
    }
    if (row.seen) seenCount += 1;
    if (row.favorite) favoriteCount += 1;
    const myRating = numberOrNull(row.my_rating);
    if (myRating !== null) {
      ratedCount += 1;
      myRatingSum += myRating;
    }
    scoreSum += Number(row.total_score ?? 0);
  }

  return {
    count: rows.length,
    seenCount,
    ratedCount,
    favoriteCount,
    avgScore: rows.length ? Math.round((scoreSum / rows.length) * 10) / 10 : 0,
    avgMyRating:
      ratedCount > 0 ? Math.round((myRatingSum / ratedCount) * 10) / 10 : null,
    yearMin,
    yearMax,
    genreCount: genres.size,
    decades: [...decades.entries()]
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => b.decade - a.decade),
    genres: [...genres.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de")),
    recentYear: yearMax,
  };
}

export function getAllMovies(limit = 500, media: MediaType = "movie"): Movie[] {
  const rows = getDb()
    .prepare(`${SELECT_MOVIE} WHERE m.media_type = ? ORDER BY m.total_score DESC LIMIT ?`)
    .all(media, limit) as Record<string, unknown>[];
  return rows.map(mapMovie);
}

/**
 * Every title matching the export filters, across movies and series. Unlike
 * `getMovies` this is not paginated because a download should contain the
 * whole selection.
 */
export function getMoviesForExport(
  filters: {
    media?: MediaType | "all";
    seen?: MovieFilters["seen"];
    favorite?: boolean;
    listId?: number;
    q?: string;
    genre?: string;
    year?: number;
  } = {},
  limit = 10000,
): Movie[] {
  const db = getDb();
  const mediaList: MediaType[] =
    filters.media && filters.media !== "all"
      ? [filters.media]
      : ["movie", "serie"];
  const rows: Record<string, unknown>[] = [];
  for (const media of mediaList) {
    const { sql, params } = buildWhere({
      media,
      q: filters.q,
      genre: filters.genre,
      year: filters.year,
      listId: filters.listId,
      seen: filters.seen,
      favorite: filters.favorite,
      sort: "title_asc",
    });
    const chunk = db
      .prepare(
        `${SELECT_MOVIE} ${sql} ORDER BY m.title_de COLLATE NOCASE ASC LIMIT @limit`,
      )
      .all({ ...params, limit }) as Record<string, unknown>[];
    rows.push(...chunk);
  }
  return rows.map(mapMovie);
}

export type LocalizedContentPatch = {
  titleEn?: string | null;
  overviewEn?: string | null;
  taglineEn?: string | null;
  genresEn?: string[];
};

export function saveLocalizedContent(
  movieId: number,
  patch: LocalizedContentPatch,
): void {
  getDb()
    .prepare(
      `UPDATE movies SET
         title_en = COALESCE(@titleEn, title_en),
         overview_en = COALESCE(@overviewEn, overview_en),
         tagline_en = COALESCE(@taglineEn, tagline_en),
         genres_en = COALESCE(@genresEn, genres_en),
         updated_at = datetime('now')
       WHERE id = @movieId`,
    )
    .run({
      movieId,
      titleEn: patch.titleEn ?? null,
      overviewEn: patch.overviewEn ?? null,
      taglineEn: patch.taglineEn ?? null,
      genresEn: patch.genresEn ? JSON.stringify(patch.genresEn) : null,
    });
}

export type ContentBackfillTarget = {
  id: number;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
};

/** Movies/series that still lack English copy from TMDB. */
export function getContentBackfillTargets(limit = 5): {
  total: number;
  targets: ContentBackfillTarget[];
} {
  const db = getDb();
  const where = `
    tmdb_id IS NOT NULL AND (title_en IS NULL OR title_en = '')`;
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM movies WHERE ${where}`).get() as {
      count: number;
    }
  ).count;
  const rows = db
    .prepare(
      `SELECT id, tmdb_id, media_type, title_de FROM movies WHERE ${where}
       ORDER BY media_type ASC, id ASC LIMIT ?`,
    )
    .all(Math.max(1, limit)) as {
    id: number;
    tmdb_id: number;
    media_type: string;
    title_de: string;
  }[];
  return {
    total,
    targets: rows.map((row) => ({
      id: row.id,
      tmdbId: row.tmdb_id,
      mediaType: row.media_type === "serie" ? "serie" : "movie",
      title: row.title_de,
    })),
  };
}

/** Episodes whose English title/overview is still missing. */
export function getEpisodeBackfillTargets(limit = 5): {
  total: number;
  targets: { id: number; tmdbId: number; movieId: number }[];
} {
  const db = getDb();
  const where = `
    e.tmdb_id IS NOT NULL AND (e.title_en IS NULL OR e.title_en = '')`;
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM episodes e WHERE ${where}`)
      .get() as { count: number }
  ).count;
  const rows = db
    .prepare(
      `SELECT e.id, e.tmdb_id, e.movie_id FROM episodes e WHERE ${where}
       ORDER BY e.movie_id ASC, e.season_number ASC, e.episode_number ASC LIMIT ?`,
    )
    .all(Math.max(1, limit)) as {
    id: number;
    tmdb_id: number;
    movie_id: number;
  }[];
  return {
    total,
    targets: rows.map((row) => ({
      id: row.id,
      tmdbId: row.tmdb_id,
      movieId: row.movie_id,
    })),
  };
}

export function saveEpisodeLocalizedContent(
  episodeId: number,
  patch: { titleEn?: string | null; overviewEn?: string | null },
): void {
  getDb()
    .prepare(
      `UPDATE episodes SET
         title_en = COALESCE(@titleEn, title_en),
         overview_en = COALESCE(@overviewEn, overview_en)
       WHERE id = @episodeId`,
    )
    .run({
      episodeId,
      titleEn: patch.titleEn ?? null,
      overviewEn: patch.overviewEn ?? null,
    });
}

export function getSimilarMovies(movie: Movie, limit = 6): Movie[] {
  const rows = getDb()
    .prepare(`${SELECT_MOVIE} WHERE m.id != ? AND m.media_type = ?`)
    .all(movie.id, movie.mediaType) as Record<string, unknown>[];
  const candidates = rows.map(mapMovie);
  const scored = candidates.map((candidate) => {
    const sharedGenres = candidate.genres.filter((genre) =>
      movie.genres.includes(genre),
    ).length;
    const sameDirector =
      movie.director && candidate.director
        ? candidate.director
            .split(",")
            .map((part) => part.trim())
            .some((part) => movie.director?.includes(part))
        : false;
    const sameDecade =
      movie.year && candidate.year
        ? Math.floor(movie.year / 10) === Math.floor(candidate.year / 10)
        : false;
    return {
      movie: candidate,
      affinity:
        sharedGenres * 10 +
        (sameDirector ? 14 : 0) +
        (sameDecade ? 4 : 0) +
        candidate.totalScore / 100,
    };
  });
  return scored
    .filter((entry) => entry.affinity > 0)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, limit)
    .map((entry) => entry.movie);
}

export type HomeData = {
  top10: Movie[];
  spotlight: Movie | null;
  latestYear: number | null;
  latestYearMovies: Movie[];
  recentYears: { year: number; movie: Movie }[];
  decadeHighlights: { decade: number; movie: Movie }[];
  genreHighlights: { genre: string; movies: Movie[]; count: number }[];
  seenMovies: Movie[];
  favorites: Movie[];
  stats: Stats;
};

export function getHomeData(media: MediaType = "movie"): HomeData {
  const all = getAllMovies(600, media);
  const stats = getStats(media);
  const latestYear = stats.recentYear;
  const latestYearMovies = latestYear
    ? all.filter((movie) => movie.year === latestYear).slice(0, 4)
    : [];

  const yearMap = new Map<number, Movie>();
  for (const movie of all) {
    if (movie.year && !yearMap.has(movie.year)) yearMap.set(movie.year, movie);
  }
  const recentYears = [...yearMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 5)
    .map(([year, movie]) => ({ year, movie }));

  const decadeMap = new Map<number, Movie>();
  for (const movie of all) {
    if (!movie.year) continue;
    const decade = Math.floor(movie.year / 10) * 10;
    if (!decadeMap.has(decade)) decadeMap.set(decade, movie);
  }
  const decadeHighlights = [...decadeMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([decade, movie]) => ({ decade, movie }));

  const genreHighlights = stats.genres.slice(0, 6).map(({ name, count }) => ({
    genre: name,
    count,
    movies: all.filter((movie) => movie.genres.includes(name)).slice(0, 3),
  }));

  const seenMovies = all
    .filter((movie) => movie.seen)
    .sort((a, b) => (b.myRating ?? 0) - (a.myRating ?? 0) || b.totalScore - a.totalScore);
  const favorites = all.filter((movie) => movie.favorite);

  return {
    top10: all.slice(0, 10),
    spotlight: all[0] ?? null,
    latestYear,
    latestYearMovies,
    recentYears,
    decadeHighlights,
    genreHighlights,
    seenMovies,
    favorites,
    stats,
  };
}

export type DetailData = {
  movie: Movie;
  rank: number;
  total: number;
  similar: Movie[];
};

export function getDetailData(
  slug: string,
  media: MediaType = "movie",
): DetailData | null {
  const movie = getMovieBySlug(slug, media);
  if (!movie) return null;
  const { rank, total } = getMovieRank(movie);
  return { movie, rank, total, similar: getSimilarMovies(movie) };
}

export function getYearsWithMovies(
  media: MediaType = "movie",
): { year: number; movies: Movie[] }[] {
  const all = getAllMovies(1000, media);
  const map = new Map<number, Movie[]>();
  for (const movie of all) {
    if (!movie.year) continue;
    const list = map.get(movie.year) ?? [];
    list.push(movie);
    map.set(movie.year, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, movies]) => ({ year, movies }));
}

export function getDemoCount(): number {
  return (
    getDb().prepare("SELECT COUNT(*) AS c FROM movies WHERE source = 'demo'").get() as {
      c: number;
    }
  ).c;
}

export function getStarterCount(media?: MediaType): number {
  const db = getDb();
  if (media) {
    return (
      db
        .prepare(
          "SELECT COUNT(*) AS c FROM movies WHERE source = 'starter' AND media_type = ?",
        )
        .get(media) as { c: number }
    ).c;
  }
  return (
    db.prepare("SELECT COUNT(*) AS c FROM movies WHERE source = 'starter'").get() as {
      c: number;
    }
  ).c;
}

/**
 * Remove titles from the archive.
 *
 * With `indices`, the selected starter-package entries are resolved against
 * the archive by title + year, so titles that were added manually are removed
 * too. Without `indices`, every title imported through the package itself is
 * removed and manually added titles stay untouched.
 */
export function removeStarterData(media?: MediaType, indices?: number[]): number {
  const db = getDb();
  const selecting = indices !== undefined;
  const clean = selecting
    ? [...new Set(indices.map((value) => Math.round(Number(value))))].filter(
        (value) => Number.isFinite(value) && value >= 0,
      )
    : [];
  if (selecting && clean.length === 0) return 0;

  const ids = new Set<number>();

  if (!selecting) {
    const info = media
      ? db
          .prepare("DELETE FROM movies WHERE source = 'starter' AND media_type = ?")
          .run(media)
      : db.prepare("DELETE FROM movies WHERE source = 'starter'").run();
    recomputeAllScores();
    return info.changes;
  }

  const importedRows = (
    media
      ? db
          .prepare(
            `SELECT id, starter_index FROM movies
             WHERE source = 'starter' AND media_type = ?`,
          )
          .all(media)
      : db
          .prepare("SELECT id, starter_index FROM movies WHERE source = 'starter'")
          .all()
  ) as { id: number; starter_index: number | null }[];
  for (const row of importedRows) {
    if (row.starter_index !== null && clean.includes(Number(row.starter_index))) {
      ids.add(Number(row.id));
    }
  }
  if (media) {
    for (const id of findStarterMovieIds(media, clean)) ids.add(id);
  }
  if (ids.size === 0) return 0;

  const movieIds = [...ids];
  const info = db
    .prepare(
      `DELETE FROM movies WHERE id IN (${movieIds.map(() => "?").join(", ")})`,
    )
    .run(...movieIds);
  recomputeAllScores();
  return info.changes;
}

/**
 * Clear the archive: titles (with episodes and personal state) and lists.
 * Settings such as the TMDB key and score weights survive unless explicitly
 * requested. `DELETE FROM movies` cascades to personal, episodes and list items.
 */
export function resetArchive(
  options: { includeSettings?: boolean } = {},
): { movies: number; lists: number } {
  const db = getDb();
  let movies = 0;
  let lists = 0;
  const transaction = db.transaction(() => {
    movies = db.prepare("DELETE FROM movies").run().changes;
    lists = db.prepare("DELETE FROM lists").run().changes;
    if (options.includeSettings) {
      db.prepare("DELETE FROM settings").run();
      const insert = db.prepare(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      );
      insert.run("score_weights", JSON.stringify(DEFAULT_WEIGHTS));
      insert.run("tmdb_api_key", "");
      // Keep the archive empty after a reset: without this flag the demo
      // seeder would repopulate a fresh DB on the next server start. Demo data
      // can still be loaded explicitly from Import & Export.
      insert.run("demo_seeded", "1");
      insert.run("site_title", "Filmgold");
    }
  });
  transaction();
  return { movies, lists };
}

export function getAdminMovies(
  query = "",
  limit = 500,
  media?: MediaType,
): Movie[] {
  const db = getDb();
  const mediaClause = media ? " AND m.media_type = @mediaType" : "";
  if (query.trim()) {
    const rows = db
      .prepare(
        `${SELECT_MOVIE} WHERE (m.title_de LIKE @q OR m.title_en LIKE @q OR m.title_original LIKE @q OR m.director LIKE @q)${mediaClause} ORDER BY m.total_score DESC LIMIT @limit`,
      )
      .all({ q: `%${query.trim()}%`, limit, mediaType: media }) as Record<
      string,
      unknown
    >[];
    return rows.map(mapMovie);
  }
  const rows = db
    .prepare(
      `${SELECT_MOVIE} WHERE 1 = 1${mediaClause} ORDER BY m.media_type ASC, m.title_de COLLATE NOCASE ASC LIMIT @limit`,
    )
    .all({ limit, mediaType: media }) as Record<string, unknown>[];
  return rows.map(mapMovie);
}

/* ------------------------------- mutations ------------------------------- */

function readMaxima(media: MediaType = "movie"): ScoreMaxima {
  const rows = getDb()
    .prepare("SELECT * FROM movies WHERE media_type = ?")
    .all(media) as Record<string, unknown>[];
  return maximaForRows(rows);
}

function maximaForRows(rows: Record<string, unknown>[]): ScoreMaxima {
  let maxBoxOffice = 0;
  let maxPopularity = 0;
  let maxVotes = 0;
  for (const row of rows) {
    maxBoxOffice = Math.max(maxBoxOffice, Number(row.box_office ?? 0));
    maxPopularity = Math.max(maxPopularity, Number(row.popularity ?? 0));
    maxVotes = Math.max(
      maxVotes,
      Number(
        votesFor({
          imdbVotes: numberOrNull(row.imdb_votes),
          tmdbVotes: numberOrNull(row.tmdb_votes),
        }) ?? 0,
      ),
    );
  }
  return { maxBoxOffice, maxPopularity, maxVotes };
}

function scoresFor(input: MovieInput, maxima: ScoreMaxima): ComputedScores {
  return computeScores(
    {
      rtRating: input.rtRating ?? null,
      metacritic: input.metacritic ?? null,
      imdbRating: input.imdbRating ?? null,
      tmdbRating: input.tmdbRating ?? null,
      imdbVotes: input.imdbVotes ?? null,
      tmdbVotes: input.tmdbVotes ?? null,
      boxOffice: input.boxOffice ?? null,
      popularity: input.popularity ?? null,
    },
    maxima,
    getWeights(),
  );
}

export function recomputeAllScores() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM movies").all() as Record<string, unknown>[];
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const media = row.media_type === "serie" ? "serie" : "movie";
    const group = groups.get(media) ?? [];
    group.push(row);
    groups.set(media, group);
  }
  const weights = getWeights();
  const update = db.prepare(`
    UPDATE movies SET critics_score = @criticsScore, audience_score = @audienceScore,
      boxoffice_score = @boxofficeScore, popularity_score = @popularityScore,
      renown_score = @renownScore, total_score = @totalScore WHERE id = @id
  `);
  const transaction = db.transaction(() => {
    for (const group of groups.values()) {
      const maxima = maximaForRows(group);
      for (const row of group) {
        const scores = computeScores(
          {
            rtRating: numberOrNull(row.rt_rating),
            metacritic: numberOrNull(row.metacritic),
            imdbRating: numberOrNull(row.imdb_rating),
            tmdbRating: numberOrNull(row.tmdb_rating),
            imdbVotes: numberOrNull(row.imdb_votes),
            tmdbVotes: numberOrNull(row.tmdb_votes),
            boxOffice: numberOrNull(row.box_office),
            popularity: numberOrNull(row.popularity),
          },
          maxima,
          weights,
        );
        update.run({ ...scores, id: row.id });
      }
    }
  });
  transaction();
  return rows.length;
}

function slugExists(slug: string, excludeId?: number) {
  const row = excludeId
    ? getDb().prepare("SELECT id FROM movies WHERE slug = ? AND id != ?").get(slug, excludeId)
    : getDb().prepare("SELECT id FROM movies WHERE slug = ?").get(slug);
  return Boolean(row);
}

function rowFromInput(input: MovieInput, slug: string, scores: ComputedScores) {
  const titleDe = input.titleDe.trim();
  return {
    media_type: input.mediaType ?? "movie",
    tmdb_id: input.tmdbId ?? null,
    slug,
    title_de: titleDe,
    title_en: input.titleEn?.trim() || null,
    title_original: (input.titleOriginal?.trim() || titleDe).trim(),
    year: input.year ?? null,
    end_year: input.endYear ?? null,
    seasons: input.seasons ?? null,
    episodes: input.episodes ?? null,
    series_status: input.seriesStatus ?? null,
    release_date: input.releaseDate ?? null,
    overview_de: input.overviewDe ?? null,
    overview_en: input.overviewEn ?? null,
    tagline_de: input.taglineDe ?? null,
    tagline_en: input.taglineEn ?? null,
    poster_path: input.posterPath ?? null,
    backdrop_path: input.backdropPath ?? null,
    genres: JSON.stringify(input.genres ?? []),
    genres_en: JSON.stringify(input.genresEn ?? []),
    runtime: input.runtime ?? null,
    director: input.director ?? null,
    cast_list: JSON.stringify(input.cast ?? []),
    country: input.country ?? null,
    original_language: input.originalLanguage ?? null,
    age_rating: input.ageRating ?? null,
    imdb_id: input.imdbId ?? null,
    imdb_rating: input.imdbRating ?? null,
    imdb_votes: input.imdbVotes ?? null,
    rt_rating: input.rtRating ?? null,
    metacritic: input.metacritic ?? null,
    tmdb_rating: input.tmdbRating ?? null,
    tmdb_votes: input.tmdbVotes ?? null,
    box_office: input.boxOffice ?? null,
    budget: input.budget ?? null,
    popularity: input.popularity ?? null,
    oscar_wins: input.oscarWins ?? 0,
    oscar_nominations: input.oscarNominations ?? 0,
    awards: input.awards ?? null,
    critics_score: scores.criticsScore,
    audience_score: scores.audienceScore,
    boxoffice_score: scores.boxofficeScore,
    popularity_score: scores.popularityScore,
    renown_score: scores.renownScore,
    total_score: scores.totalScore,
    source: input.source ?? "manual",
  };
}

export function insertMovie(
  input: MovieInput,
  options: { recompute?: boolean } = {},
): number {
  const db = getDb();
  if (!input.titleDe?.trim()) throw new Error("Titel fehlt.");
  const base = slugify(`${input.titleDe} ${input.year ?? ""}`.trim());
  const slug = uniqueSlug(base, (candidate) => slugExists(candidate));
  const scores = scoresFor(input, readMaxima(input.mediaType ?? "movie"));
  const row = rowFromInput(input, slug, scores);
  const columns = Object.keys(row);
  const info = db
    .prepare(
      `INSERT INTO movies (${columns.join(", ")}) VALUES (${columns
        .map((column) => `@${column}`)
        .join(", ")})`,
    )
    .run(row);
  if (options.recompute !== false) recomputeAllScores();
  return Number(info.lastInsertRowid);
}

export function updateMovie(
  id: number,
  input: Partial<MovieInput>,
  options: { recompute?: boolean } = {},
): void {
  const existing = getMovieById(id);
  if (!existing) throw new Error("Film nicht gefunden.");
  const merged: MovieInput = {
    mediaType: input.mediaType ?? existing.mediaType,
    tmdbId: input.tmdbId !== undefined ? input.tmdbId : existing.tmdbId,
    titleDe: input.titleDe?.trim() || existing.titleDe,
    titleEn: input.titleEn !== undefined ? input.titleEn : existing.titleEn,
    titleOriginal:
      input.titleOriginal !== undefined ? input.titleOriginal : existing.titleOriginal,
    year: input.year !== undefined ? input.year : existing.year,
    endYear: input.endYear !== undefined ? input.endYear : existing.endYear,
    seasons: input.seasons !== undefined ? input.seasons : existing.seasons,
    episodes: input.episodes !== undefined ? input.episodes : existing.episodes,
    seriesStatus:
      input.seriesStatus !== undefined ? input.seriesStatus : existing.seriesStatus,
    releaseDate: input.releaseDate !== undefined ? input.releaseDate : existing.releaseDate,
    overviewDe: input.overviewDe !== undefined ? input.overviewDe : existing.overviewDe,
    overviewEn: input.overviewEn !== undefined ? input.overviewEn : existing.overviewEn,
    taglineDe: input.taglineDe !== undefined ? input.taglineDe : existing.taglineDe,
    taglineEn: input.taglineEn !== undefined ? input.taglineEn : existing.taglineEn,
    posterPath: input.posterPath !== undefined ? input.posterPath : existing.posterPath,
    backdropPath:
      input.backdropPath !== undefined ? input.backdropPath : existing.backdropPath,
    genres: input.genres !== undefined ? input.genres : existing.genres,
    genresEn: input.genresEn !== undefined ? input.genresEn : existing.genresEn,
    runtime: input.runtime !== undefined ? input.runtime : existing.runtime,
    director: input.director !== undefined ? input.director : existing.director,
    cast: input.cast !== undefined ? input.cast : existing.cast,
    country: input.country !== undefined ? input.country : existing.country,
    originalLanguage:
      input.originalLanguage !== undefined
        ? input.originalLanguage
        : existing.originalLanguage,
    ageRating: input.ageRating !== undefined ? input.ageRating : existing.ageRating,
    imdbId: input.imdbId !== undefined ? input.imdbId : existing.imdbId,
    imdbRating: input.imdbRating !== undefined ? input.imdbRating : existing.imdbRating,
    imdbVotes: input.imdbVotes !== undefined ? input.imdbVotes : existing.imdbVotes,
    rtRating: input.rtRating !== undefined ? input.rtRating : existing.rtRating,
    metacritic: input.metacritic !== undefined ? input.metacritic : existing.metacritic,
    tmdbRating: input.tmdbRating !== undefined ? input.tmdbRating : existing.tmdbRating,
    tmdbVotes: input.tmdbVotes !== undefined ? input.tmdbVotes : existing.tmdbVotes,
    boxOffice: input.boxOffice !== undefined ? input.boxOffice : existing.boxOffice,
    budget: input.budget !== undefined ? input.budget : existing.budget,
    popularity: input.popularity !== undefined ? input.popularity : existing.popularity,
    oscarWins: input.oscarWins !== undefined ? input.oscarWins : existing.oscarWins,
    oscarNominations:
      input.oscarNominations !== undefined
        ? input.oscarNominations
        : existing.oscarNominations,
    awards: input.awards !== undefined ? input.awards : existing.awards,
    source: input.source !== undefined ? input.source : existing.source,
  };
  const scores = scoresFor(merged, readMaxima(merged.mediaType ?? existing.mediaType));
  const row = rowFromInput(merged, existing.slug, scores);
  const columns = Object.keys(row).filter((column) => column !== "slug");
  getDb()
    .prepare(
      `UPDATE movies SET ${columns
        .map((column) => `${column} = @${column}`)
        .join(", ")}, updated_at = datetime('now') WHERE id = @id`,
    )
    .run({ ...row, id });

  /*
   * If the TMDB image path changed, the cached file no longer belongs to the
   * title. Drop the reference so the next automatic or manual cache run can
   * download the new artwork.
   */
  const staleColumns: string[] = [];
  const staleFiles: (string | null)[] = [];
  if (input.posterPath !== undefined && input.posterPath !== existing.posterPath) {
    staleColumns.push("poster_local = NULL");
    staleFiles.push(existing.posterLocal);
  }
  if (
    input.backdropPath !== undefined &&
    input.backdropPath !== existing.backdropPath
  ) {
    staleColumns.push("backdrop_local = NULL");
    staleFiles.push(existing.backdropLocal);
  }
  if (staleColumns.length > 0) {
    getDb()
      .prepare(`UPDATE movies SET ${staleColumns.join(", ")} WHERE id = ?`)
      .run(id);
    for (const file of staleFiles) removeMediaFile(file);
  }
  if (options.recompute !== false) recomputeAllScores();
}

export function deleteMovie(id: number): void {
  removeMovieMediaFiles(id);
  getDb().prepare("DELETE FROM movies WHERE id = ?").run(id);
  recomputeAllScores();
}

export type PersonalPatch = {
  seen?: boolean;
  rating?: number | null;
  favorite?: boolean;
  note?: string | null;
  watchedAt?: string | null;
};

export function setPersonalState(movieId: number, patch: PersonalPatch) {
  const db = getDb();
  const exists = db
    .prepare("SELECT id, media_type FROM movies WHERE id = ?")
    .get(movieId) as { id: number; media_type: string } | undefined;
  if (!exists) throw new Error("Film nicht gefunden.");
  const current = db
    .prepare("SELECT * FROM personal WHERE movie_id = ?")
    .get(movieId) as Record<string, unknown> | undefined;

  let seen = patch.seen ?? Boolean(current?.seen);
  let rating =
    patch.rating !== undefined
      ? patch.rating
      : current?.rating !== undefined && current?.rating !== null
        ? Number(current.rating)
        : null;
  const favorite = patch.favorite ?? Boolean(current?.favorite);

  if (patch.favorite === true) seen = true;
  if (rating !== null && rating !== undefined) seen = true;
  if (!seen) rating = null;
  if (rating !== null && rating !== undefined) {
    rating = Math.min(10, Math.max(1, Math.round(Number(rating) * 2) / 2));
  }

  const note = patch.note !== undefined ? patch.note : ((current?.note as string) ?? null);
  const watchedAt =
    patch.watchedAt !== undefined
      ? patch.watchedAt
      : ((current?.watched_at as string) ?? null) ||
        (seen ? new Date().toISOString().slice(0, 10) : null);

  db.prepare(`
    INSERT INTO personal (movie_id, seen, rating, favorite, watched_at, note, updated_at)
    VALUES (@movieId, @seen, @rating, @favorite, @watchedAt, @note, datetime('now'))
    ON CONFLICT(movie_id) DO UPDATE SET
      seen = excluded.seen, rating = excluded.rating, favorite = excluded.favorite,
      watched_at = excluded.watched_at, note = excluded.note, updated_at = datetime('now')
  `).run({
    movieId,
    seen: seen ? 1 : 0,
    rating,
    favorite: favorite ? 1 : 0,
    watchedAt: seen ? watchedAt : null,
    note,
  });

  // Series with tracked episodes derive "seen" from episode progress.
  if (exists.media_type === "serie") syncSeriesSeen(movieId);
}

/* -------------------------------- importing ------------------------------- */

const FIELD_ALIASES: Record<keyof MovieInput, string[]> = {
  mediaType: ["mediatype", "media_type", "typ", "type", "medium"],
  tmdbId: ["tmdbid", "tmdb_id", "tmdb", "themoviedb_id"],
  titleDe: ["titlede", "title_de", "titel", "title", "deutschertitel", "name"],
  titleEn: ["titleen", "title_en", "englishtitle", "englischertitel", "titel_en"],
  titleOriginal: [
    "titleoriginal",
    "title_original",
    "originaltitel",
    "original_title",
    "originaltitle",
  ],
  year: ["year", "jahr", "erscheinungsjahr", "releaseyear", "startjahr"],
  endYear: ["endyear", "end_year", "endejahr", "endjahr", "letztesjahr"],
  seasons: ["seasons", "staffeln", "staffel", "anzahlstaffeln"],
  episodes: ["episodes", "folgen", "episoden", "anzahlfolgen"],
  seriesStatus: ["seriesstatus", "series_status", "serienstatus", "status"],
  releaseDate: ["releasedate", "release_date", "veroeffentlichung", "datum", "erstausstrahlung"],
  overviewDe: ["overviewde", "overview_de", "beschreibung", "overview", "handlung", "plot"],
  overviewEn: ["overviewen", "overview_en", "beschreibung_en", "plot_en"],
  taglineDe: ["taglinede", "tagline_de", "tagline", "slogan"],
  taglineEn: ["taglineen", "tagline_en", "slogan_en"],
  posterPath: ["posterpath", "poster_path", "poster", "posterurl"],
  backdropPath: ["backdroppath", "backdrop_path", "backdrop", "backdropurl"],
  genres: ["genres", "genre", "genresliste"],
  genresEn: ["genresen", "genres_en", "genresenglish"],
  runtime: ["runtime", "laufzeit", "minuten"],
  director: ["director", "regie", "regisseur"],
  cast: ["cast", "castlist", "besetzung", "schauspieler"],
  country: ["country", "land", "herkunftsland", "productioncountry"],
  originalLanguage: ["originallanguage", "original_language", "sprache", "language"],
  ageRating: ["agerating", "age_rating", "fsK", "freigabe", "rating"],
  imdbId: ["imdbid", "imdb_id"],
  imdbRating: ["imdbrating", "imdb_rating", "imdb", "imdbwertung"],
  imdbVotes: ["imdbvotes", "imdb_votes", "imdbstimmen"],
  rtRating: ["rtRating", "rt_rating", "rottentomatoes", "rt", "tomatometer"],
  metacritic: ["metacritic", "metacriticscore", "mc"],
  tmdbRating: ["tmdbRating", "tmdb_rating", "tmdbwertung"],
  tmdbVotes: ["tmdbVotes", "tmdb_votes", "tmdbstimmen"],
  boxOffice: ["boxoffice", "box_office", "einspiel", "einspielergebnis", "revenue"],
  budget: ["budget", "kosten"],
  popularity: ["popularity", "popularitaet", "populaeritaet"],
  oscarWins: ["oscarwins", "oscar_wins", "oscars", "oscarsiege"],
  oscarNominations: [
    "oscarnominations",
    "oscar_nominations",
    "oscarnominierungen",
    "nominations",
  ],
  awards: ["awards", "auszeichnungen"],
  source: ["source", "quelle"],
};

function pickField(row: Record<string, unknown>, aliases: string[]) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find(
      (key) =>
        key.toLowerCase().replace(/[\s_-]/g, "") ===
        alias.toLowerCase().replace(/[\s_-]/g, ""),
    );
    if (match !== undefined && row[match] !== "" && row[match] !== null) {
      return row[match];
    }
  }
  return undefined;
}

export function parseMediaType(value: unknown): MediaType {
  const raw = String(value ?? "").trim().toLowerCase();
  return ["serie", "serien", "series", "tv", "show", "fernsehserie"].includes(raw)
    ? "serie"
    : "movie";
}

export function normalizeImportRow(row: Record<string, unknown>): MovieInput | null {
  const title = pickField(row, FIELD_ALIASES.titleDe);
  if (!title || !String(title).trim()) return null;
  const input: MovieInput = {
    mediaType: parseMediaType(pickField(row, FIELD_ALIASES.mediaType)),
    titleDe: String(title).trim(),
    titleEn: (pickField(row, FIELD_ALIASES.titleEn) as string) ?? null,
    titleOriginal: (pickField(row, FIELD_ALIASES.titleOriginal) as string) ?? null,
    year: parseLooseNumber(pickField(row, FIELD_ALIASES.year)),
    endYear: parseLooseNumber(pickField(row, FIELD_ALIASES.endYear)),
    seasons: parseLooseNumber(pickField(row, FIELD_ALIASES.seasons)),
    episodes: parseLooseNumber(pickField(row, FIELD_ALIASES.episodes)),
    seriesStatus: (pickField(row, FIELD_ALIASES.seriesStatus) as string) ?? null,
    releaseDate: (pickField(row, FIELD_ALIASES.releaseDate) as string) ?? null,
    overviewDe: (pickField(row, FIELD_ALIASES.overviewDe) as string) ?? null,
    overviewEn: (pickField(row, FIELD_ALIASES.overviewEn) as string) ?? null,
    taglineDe: (pickField(row, FIELD_ALIASES.taglineDe) as string) ?? null,
    taglineEn: (pickField(row, FIELD_ALIASES.taglineEn) as string) ?? null,
    posterPath: (pickField(row, FIELD_ALIASES.posterPath) as string) ?? null,
    backdropPath: (pickField(row, FIELD_ALIASES.backdropPath) as string) ?? null,
    genres: parseList(pickField(row, FIELD_ALIASES.genres)),
    genresEn: parseList(pickField(row, FIELD_ALIASES.genresEn)),
    runtime: parseLooseNumber(pickField(row, FIELD_ALIASES.runtime)),
    director: (pickField(row, FIELD_ALIASES.director) as string) ?? null,
    cast: parseList(pickField(row, FIELD_ALIASES.cast)),
    country: (pickField(row, FIELD_ALIASES.country) as string) ?? null,
    originalLanguage:
      (pickField(row, FIELD_ALIASES.originalLanguage) as string) ?? null,
    ageRating: (pickField(row, FIELD_ALIASES.ageRating) as string) ?? null,
    imdbId: (pickField(row, FIELD_ALIASES.imdbId) as string) ?? null,
    imdbRating: parseLooseNumber(pickField(row, FIELD_ALIASES.imdbRating)),
    imdbVotes: parseLooseNumber(pickField(row, FIELD_ALIASES.imdbVotes)),
    rtRating: parseLooseNumber(pickField(row, FIELD_ALIASES.rtRating)),
    metacritic: parseLooseNumber(pickField(row, FIELD_ALIASES.metacritic)),
    tmdbRating: parseLooseNumber(pickField(row, FIELD_ALIASES.tmdbRating)),
    tmdbVotes: parseLooseNumber(pickField(row, FIELD_ALIASES.tmdbVotes)),
    boxOffice: parseLooseNumber(pickField(row, FIELD_ALIASES.boxOffice)),
    budget: parseLooseNumber(pickField(row, FIELD_ALIASES.budget)),
    popularity: parseLooseNumber(pickField(row, FIELD_ALIASES.popularity)),
    oscarWins: parseLooseNumber(pickField(row, FIELD_ALIASES.oscarWins)),
    oscarNominations: parseLooseNumber(
      pickField(row, FIELD_ALIASES.oscarNominations),
    ),
    awards: (pickField(row, FIELD_ALIASES.awards) as string) ?? null,
    source: (pickField(row, FIELD_ALIASES.source) as string) ?? "import",
  };
  const tmdbId = parseLooseNumber(pickField(row, FIELD_ALIASES.tmdbId));
  input.tmdbId = tmdbId;
  return input;
}

export type ImportSummary = {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export function importRows(rows: Record<string, unknown>[]): ImportSummary {
  const db = getDb();
  const summary: ImportSummary = { added: 0, updated: 0, skipped: 0, errors: [] };
  let index = 0;
  for (const raw of rows) {
    index += 1;
    try {
      const input = normalizeImportRow(raw);
      if (!input) {
        summary.skipped += 1;
        continue;
      }
      const media = input.mediaType ?? "movie";
      let existingId: number | null = null;
      if (input.tmdbId) {
        const byTmdb = db
          .prepare("SELECT id FROM movies WHERE media_type = ? AND tmdb_id = ?")
          .get(media, input.tmdbId) as { id: number } | undefined;
        existingId = byTmdb?.id ?? null;
      }
      if (!existingId) {
        const byTitle = db
          .prepare(
            "SELECT id FROM movies WHERE media_type = ? AND title_de = ? COLLATE NOCASE AND COALESCE(year, 0) = COALESCE(?, 0)",
          )
          .get(media, input.titleDe, input.year) as { id: number } | undefined;
        existingId = byTitle?.id ?? null;
      }
      if (existingId) {
        updateMovie(existingId, input, { recompute: false });
        summary.updated += 1;
      } else {
        insertMovie(input, { recompute: false });
        summary.added += 1;
      }
    } catch (error) {
      summary.errors.push(
        `Zeile ${index}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      );
    }
  }
  recomputeAllScores();
  return summary;
}

/* --------------------------------- demo ---------------------------------- */

export function seedDemoData(force = false): number {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) AS c FROM movies").get() as { c: number }).c;
  if (count > 0 && !force) return 0;
  for (const movie of DEMO_MOVIES) {
    const input: MovieInput = {
      ...movie,
      posterPath: `/demo-posters/${movie.posterFile}`,
      source: "demo",
    };
    insertMovie(input, { recompute: false });
  }
  recomputeAllScores();
  setSetting("demo_seeded", "1");
  return DEMO_MOVIES.length;
}

export function ensureDemoSeeded() {
  if (getSetting("demo_seeded") === "1") return;
  const count = (
    getDb().prepare("SELECT COUNT(*) AS c FROM movies").get() as { c: number }
  ).c;
  if (count === 0) seedDemoData();
  else setSetting("demo_seeded", "1");
}

export function removeDemoData(): number {
  const info = getDb().prepare("DELETE FROM movies WHERE source = 'demo'").run();
  recomputeAllScores();
  return info.changes;
}

/* ------------------------------- episodes -------------------------------- */

function mapEpisode(row: Record<string, unknown>): Episode {
  return {
    id: Number(row.id),
    movieId: Number(row.movie_id),
    seasonNumber: Number(row.season_number),
    episodeNumber: Number(row.episode_number),
    tmdbId: numberOrNull(row.tmdb_id),
    title: String(row.title ?? ""),
    titleEn: (row.title_en as string | null) ?? null,
    overview: (row.overview as string | null) ?? null,
    overviewEn: (row.overview_en as string | null) ?? null,
    airDate: (row.air_date as string | null) ?? null,
    runtime: numberOrNull(row.runtime),
    stillPath: (row.still_path as string | null) ?? null,
    stillLocal: (row.still_local as string | null) ?? null,
    watched: Boolean(row.watched),
    rewatched: Boolean(row.rewatched),
    watchedAt: (row.watched_at as string | null) ?? null,
  };
}

export function getSeriesEpisodes(movieId: number): Episode[] {
  const rows = getDb()
    .prepare(
      `SELECT e.*, COALESCE(ep.watched, 0) AS watched,
              COALESCE(ep.rewatched, 0) AS rewatched, ep.watched_at AS watched_at
       FROM episodes e
       LEFT JOIN episode_progress ep ON ep.episode_id = e.id
       WHERE e.movie_id = ?
       ORDER BY e.season_number ASC, e.episode_number ASC`,
    )
    .all(movieId) as Record<string, unknown>[];
  return rows.map(mapEpisode);
}

/** Replace the stored episode list while keeping any existing progress. */
export function saveSeriesEpisodes(movieId: number, episodes: EpisodeInput[]): number {
  if (episodes.length === 0) return 0;
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO episodes
       (movie_id, season_number, episode_number, tmdb_id, title, title_en, overview, overview_en, air_date, runtime, still_path)
     VALUES
       (@movieId, @seasonNumber, @episodeNumber, @tmdbId, @title, @titleEn, @overview, @overviewEn, @airDate, @runtime, @stillPath)
     ON CONFLICT(movie_id, season_number, episode_number) DO UPDATE SET
       tmdb_id = excluded.tmdb_id,
       title = excluded.title,
       title_en = COALESCE(excluded.title_en, episodes.title_en),
       overview = excluded.overview,
       overview_en = COALESCE(excluded.overview_en, episodes.overview_en),
       air_date = excluded.air_date,
       runtime = excluded.runtime,
       still_path = excluded.still_path,
       still_local = CASE WHEN episodes.still_path IS excluded.still_path
                          THEN episodes.still_local ELSE NULL END`,
  );
  const existing = db
    .prepare(
      `SELECT id, season_number, episode_number, still_path, still_local
       FROM episodes WHERE movie_id = ?`,
    )
    .all(movieId) as {
    id: number;
    season_number: number;
    episode_number: number;
    still_path: string | null;
    still_local: string | null;
  }[];
  const existingByKey = new Map(
    existing.map((row) => [`${row.season_number}:${row.episode_number}`, row]),
  );
  const keep = new Set(
    episodes.map((episode) => `${episode.seasonNumber}:${episode.episodeNumber}`),
  );
  const transaction = db.transaction(() => {
    for (const episode of episodes) {
      const key = `${episode.seasonNumber}:${episode.episodeNumber}`;
      const previous = existingByKey.get(key);
      if (
        previous &&
        (episode.stillPath ?? null) !== previous.still_path
      ) {
        removeMediaFile(previous.still_local);
      }
      upsert.run({
        movieId,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        tmdbId: episode.tmdbId ?? null,
        title: episode.title,
        titleEn: episode.titleEn ?? null,
        overview: episode.overview ?? null,
        overviewEn: episode.overviewEn ?? null,
        airDate: episode.airDate ?? null,
        runtime: episode.runtime ?? null,
        stillPath: episode.stillPath ?? null,
      });
    }
    const remove = db.prepare("DELETE FROM episodes WHERE id = ?");
    for (const row of existing) {
      if (!keep.has(`${row.season_number}:${row.episode_number}`)) {
        remove.run(row.id);
        removeMediaFile(row.still_local);
      }
    }
  });
  transaction();
  return episodes.length;
}

function episodeOwner(episodeId: number): number {
  const row = getDb()
    .prepare("SELECT movie_id FROM episodes WHERE id = ?")
    .get(episodeId) as { movie_id: number } | undefined;
  if (!row) throw new Error("Folge nicht gefunden.");
  return row.movie_id;
}

type EpisodeCounts = {
  total: number;
  watched: number;
  rewatched: number;
  rewatchActive: boolean;
};

function readEpisodeCounts(movieId: number): EpisodeCounts {
  const row = getDb()
    .prepare(
      `SELECT COUNT(e.id) AS total,
              COALESCE(SUM(CASE WHEN p.watched = 1 THEN 1 ELSE 0 END), 0) AS watched,
              COALESCE(SUM(CASE WHEN p.rewatched = 1 THEN 1 ELSE 0 END), 0) AS rewatched
       FROM episodes e
       LEFT JOIN episode_progress p ON p.episode_id = e.id
       WHERE e.movie_id = ?`,
    )
    .get(movieId) as { total: number; watched: number; rewatched: number };
  const personal = getDb()
    .prepare("SELECT rewatch_active FROM personal WHERE movie_id = ?")
    .get(movieId) as { rewatch_active: number } | undefined;
  return {
    total: Number(row?.total ?? 0),
    watched: Number(row?.watched ?? 0),
    rewatched: Number(row?.rewatched ?? 0),
    rewatchActive: Boolean(personal?.rewatch_active),
  };
}

/**
 * Keep `personal.seen` in sync with the episode progress: a series counts as
 * seen only once every tracked episode has been watched.
 */
function syncSeriesSeen(movieId: number): void {
  const counts = readEpisodeCounts(movieId);
  if (counts.total === 0) return;
  const complete = counts.watched >= counts.total;
  getDb()
    .prepare(
      `INSERT INTO personal (movie_id, seen, watched_at, updated_at)
       VALUES (@movieId, @seen,
               CASE WHEN @seen = 1 THEN date('now') ELSE NULL END, datetime('now'))
       ON CONFLICT(movie_id) DO UPDATE SET
         seen = excluded.seen,
         watched_at = excluded.watched_at,
         updated_at = datetime('now')`,
    )
    .run({ movieId, seen: complete ? 1 : 0 });
}

/** A completed rewatch round ends the rewatch mode again. */
function settleRewatch(movieId: number): void {
  const counts = readEpisodeCounts(movieId);
  if (counts.total > 0 && counts.rewatched >= counts.total) {
    getDb()
      .prepare(
        "UPDATE personal SET rewatch_active = 0, updated_at = datetime('now') WHERE movie_id = ?",
      )
      .run(movieId);
  }
}

export function setEpisodeWatched(episodeId: number, watched: boolean): void {
  if (!Number.isFinite(episodeId)) throw new Error("Ungültige Folge.");
  const movieId = episodeOwner(episodeId);
  const db = getDb();
  db.prepare(
    `INSERT INTO episode_progress (episode_id, watched, rewatched, watched_at, updated_at)
     VALUES (@episodeId, @watched,
             CASE WHEN @watched = 1 THEN 0 ELSE 0 END,
             CASE WHEN @watched = 1 THEN date('now') ELSE NULL END,
             datetime('now'))
     ON CONFLICT(episode_id) DO UPDATE SET
       watched = excluded.watched,
       rewatched = CASE WHEN excluded.watched = 0 THEN 0 ELSE episode_progress.rewatched END,
       watched_at = CASE
         WHEN excluded.watched = 1 THEN COALESCE(episode_progress.watched_at, date('now'))
         ELSE NULL
       END,
       updated_at = datetime('now')`,
  ).run({ episodeId, watched: watched ? 1 : 0 });
  syncSeriesSeen(movieId);
}

export function setEpisodeRewatched(episodeId: number, rewatched: boolean): void {
  if (!Number.isFinite(episodeId)) throw new Error("Ungültige Folge.");
  const movieId = episodeOwner(episodeId);
  getDb()
    .prepare(
      `INSERT INTO episode_progress (episode_id, watched, rewatched, watched_at, updated_at)
       VALUES (?, 1, ?, date('now'), datetime('now'))
       ON CONFLICT(episode_id) DO UPDATE SET
         watched = 1,
         rewatched = excluded.rewatched,
         watched_at = COALESCE(episode_progress.watched_at, date('now')),
         updated_at = datetime('now')`,
    )
    .run(episodeId, rewatched ? 1 : 0);
  syncSeriesSeen(movieId);
  if (rewatched) settleRewatch(movieId);
}

/** Mark every episode of one season — or of the whole series — as (un)watched. */
export function setSeasonWatched(
  movieId: number,
  seasonNumber: number | null,
  watched: boolean,
): void {
  const db = getDb();
  const scope = seasonNumber === null ? "" : "AND e.season_number = @seasonNumber";
  db.prepare(
    `INSERT INTO episode_progress (episode_id, watched, rewatched, watched_at, updated_at)
     SELECT e.id, @watched, 0,
            CASE WHEN @watched = 1 THEN date('now') ELSE NULL END,
            datetime('now')
     FROM episodes e
     WHERE e.movie_id = @movieId ${scope}
     ON CONFLICT(episode_id) DO UPDATE SET
       watched = excluded.watched,
       rewatched = CASE WHEN excluded.watched = 0 THEN 0 ELSE episode_progress.rewatched END,
       watched_at = CASE
         WHEN excluded.watched = 1 THEN COALESCE(episode_progress.watched_at, date('now'))
         ELSE NULL
       END,
       updated_at = datetime('now')`,
  ).run({ movieId, watched: watched ? 1 : 0, seasonNumber: seasonNumber ?? -1 });
  syncSeriesSeen(movieId);
}

/** Mark remaining episodes of a season (or the series) as rewatched. */
export function setSeasonRewatched(
  movieId: number,
  seasonNumber: number | null,
  rewatched: boolean,
): void {
  const db = getDb();
  const scope = seasonNumber === null ? "" : "AND e.season_number = @seasonNumber";
  db.prepare(
    `INSERT INTO episode_progress (episode_id, watched, rewatched, watched_at, updated_at)
     SELECT e.id, 1, @rewatched, date('now'), datetime('now')
     FROM episodes e
     WHERE e.movie_id = @movieId ${scope}
     ON CONFLICT(episode_id) DO UPDATE SET
       watched = 1,
       rewatched = excluded.rewatched,
       watched_at = COALESCE(episode_progress.watched_at, date('now')),
       updated_at = datetime('now')`,
  ).run({ movieId, rewatched: rewatched ? 1 : 0, seasonNumber: seasonNumber ?? -1 });
  syncSeriesSeen(movieId);
  settleRewatch(movieId);
}

/** Begin a fresh rewatch round: clear the rewatch marks and start at episode 1. */
export function startRewatch(movieId: number): void {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE episode_progress SET rewatched = 0, updated_at = datetime('now')
       WHERE episode_id IN (SELECT id FROM episodes WHERE movie_id = ?)`,
    ).run(movieId);
    db.prepare(
      `INSERT INTO personal (movie_id, seen, rewatch_active, updated_at)
       VALUES (?, 1, 1, datetime('now'))
       ON CONFLICT(movie_id) DO UPDATE SET
         rewatch_active = 1, updated_at = datetime('now')`,
    ).run(movieId);
  });
  transaction();
}

/** Leave rewatch mode without touching the first-watch progress. */
export function stopRewatch(movieId: number): void {
  getDb()
    .prepare(
      "UPDATE personal SET rewatch_active = 0, updated_at = datetime('now') WHERE movie_id = ?",
    )
    .run(movieId);
}

export function computeSeriesProgress(
  episodes: Episode[],
  rewatchActive = false,
): SeriesProgress {
  const totalEpisodes = episodes.length;
  const watchedEpisodes = episodes.filter((episode) => episode.watched).length;
  const rewatchedEpisodes = episodes.filter((episode) => episode.rewatched).length;
  const percent = totalEpisodes
    ? Math.round((watchedEpisodes / totalEpisodes) * 100)
    : 0;

  if (totalEpisodes === 0) {
    return {
      state: "none",
      totalEpisodes: 0,
      watchedEpisodes: 0,
      rewatchedEpisodes: 0,
      percent: 0,
      nextEpisode: null,
      rewatchActive: false,
    };
  }

  if (watchedEpisodes === 0) {
    return {
      state: "none",
      totalEpisodes,
      watchedEpisodes: 0,
      rewatchedEpisodes,
      percent: 0,
      nextEpisode: episodes[0] ?? null,
      rewatchActive: false,
    };
  }

  if (watchedEpisodes < totalEpisodes) {
    return {
      state: "watching",
      totalEpisodes,
      watchedEpisodes,
      rewatchedEpisodes,
      percent,
      nextEpisode: episodes.find((episode) => !episode.watched) ?? null,
      rewatchActive,
    };
  }

  if (rewatchActive && rewatchedEpisodes < totalEpisodes) {
    return {
      state: "rewatching",
      totalEpisodes,
      watchedEpisodes,
      rewatchedEpisodes,
      percent: 100,
      nextEpisode: episodes.find((episode) => !episode.rewatched) ?? null,
      rewatchActive: true,
    };
  }

  return {
    state: "watched",
    totalEpisodes,
    watchedEpisodes,
    rewatchedEpisodes,
    percent: 100,
    nextEpisode: null,
    rewatchActive: false,
  };
}

export function getSeriesProgress(movieId: number): SeriesProgress {
  return computeSeriesProgress(
    getSeriesEpisodes(movieId),
    readEpisodeCounts(movieId).rewatchActive,
  );
}

/**
 * Progress summaries for many series at once — used for badges on archive
 * cards without running one query per title.
 */
export function getSeriesStates(movieIds: number[]): Map<number, SeriesStateSummary> {
  const ids = [...new Set(movieIds)].filter((id) => Number.isInteger(id) && id > 0);
  const result = new Map<number, SeriesStateSummary>();
  if (ids.length === 0) return result;

  const rows = getDb()
    .prepare(
      `SELECT e.movie_id, e.season_number, e.episode_number, e.title, e.title_en,
              COALESCE(p.watched, 0) AS watched,
              COALESCE(p.rewatched, 0) AS rewatched,
              COALESCE(per.rewatch_active, 0) AS rewatch_active
       FROM episodes e
       LEFT JOIN episode_progress p ON p.episode_id = e.id
       LEFT JOIN personal per ON per.movie_id = e.movie_id
       WHERE e.movie_id IN (${ids.map(() => "?").join(",")})
       ORDER BY e.movie_id, e.season_number, e.episode_number`,
    )
    .all(...ids) as {
    movie_id: number;
    season_number: number;
    episode_number: number;
    title: string;
    title_en: string | null;
    watched: number;
    rewatched: number;
    rewatch_active: number;
  }[];

  const grouped = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.movie_id) ?? [];
    list.push(row);
    grouped.set(row.movie_id, list);
  }

  for (const [movieId, list] of grouped) {
    const total = list.length;
    const watched = list.filter((row) => row.watched).length;
    const rewatched = list.filter((row) => row.rewatched).length;
    const rewatchActive = Boolean(list[0]?.rewatch_active);
    let state: WatchState;
    let next: (typeof rows)[number] | null = null;
    if (watched === 0) {
      state = "none";
      next = list[0] ?? null;
    } else if (watched < total) {
      state = "watching";
      next = list.find((row) => !row.watched) ?? null;
    } else if (rewatchActive && rewatched < total) {
      state = "rewatching";
      next = list.find((row) => !row.rewatched) ?? null;
    } else {
      state = "watched";
    }
    result.set(movieId, {
      state,
      watchedEpisodes: watched,
      totalEpisodes: total,
      nextEpisode: next
        ? {
            seasonNumber: next.season_number,
            episodeNumber: next.episode_number,
            title: next.title,
            titleEn: next.title_en,
          }
        : null,
    });
  }

  return result;
}

export function getSeriesState(movieId: number): SeriesStateSummary | null {
  return getSeriesStates([movieId]).get(movieId) ?? null;
}

/**
 * Repair the legacy `personal.seen` flag for series: it may have been set as
 * soon as one episode was watched. Runs once at startup and is idempotent.
 */
function syncAllSeriesSeen(): void {
  getDb()
    .prepare(
      `UPDATE personal
          SET seen = (
                SELECT CASE
                         WHEN COUNT(e.id) > 0
                          AND SUM(CASE WHEN COALESCE(ep.watched, 0) = 1 THEN 1 ELSE 0 END) >= COUNT(e.id)
                         THEN 1 ELSE 0
                       END
                  FROM episodes e
                  LEFT JOIN episode_progress ep ON ep.episode_id = e.id
                 WHERE e.movie_id = personal.movie_id
              ),
              watched_at = CASE
                WHEN (
                  SELECT COUNT(e.id) > 0
                     AND SUM(CASE WHEN COALESCE(ep.watched, 0) = 1 THEN 1 ELSE 0 END) >= COUNT(e.id)
                    FROM episodes e
                    LEFT JOIN episode_progress ep ON ep.episode_id = e.id
                   WHERE e.movie_id = personal.movie_id
                ) THEN COALESCE(watched_at, date('now'))
                ELSE NULL
              END,
              updated_at = datetime('now')
        WHERE movie_id IN (SELECT id FROM movies WHERE media_type = 'serie')
          AND EXISTS (SELECT 1 FROM episodes e WHERE e.movie_id = personal.movie_id)`,
    )
    .run();
}

ensureDemoSeeded();
syncAllSeriesSeen();
