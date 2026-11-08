import { getDb, getTmdbCredentials, type TmdbCredentials } from "./db";
import { MAX_DISCOVER_PAGE_SIZE } from "./layout";
import { cacheMovieMedia } from "./media";
import type { Locale } from "./locale";
import { addMovieToList } from "./lists";
import {
  getContentBackfillTargets,
  getEpisodeBackfillTargets,
  getMovieById,
  insertMovie,
  recomputeAllScores,
  saveLocalizedContent,
  saveSeriesEpisodes,
  updateMovie,
} from "./movies";
import { SEED_MOVIES, SEED_SERIES, type SeedEntry } from "./seed-list";
import type {
  DiscoverFilters,
  DiscoverMovie,
  DiscoverResult,
  EpisodeInput,
  ImportMatchInput,
  MediaType,
  MovieInput,
  TmdbImportBatchResult,
  TmdbImportChoice,
  TmdbMatchBatch,
  TmdbMatchCandidate,
  TmdbMatchResult,
  TmdbSearchPage,
  TmdbSearchPool,
  TmdbSearchResult,
} from "./types";

const BASE = "https://api.themoviedb.org/3";

type TmdbSearchItem = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  original_language?: string;
};

type TmdbSearchResponse = {
  page: number;
  results: TmdbSearchItem[];
  total_pages: number;
  total_results: number;
};

type TmdbDiscoverResponse = {
  page: number;
  results: TmdbSearchItem[];
  total_pages: number;
  total_results: number;
};

type TmdbDetailsResponse = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  tagline: string;
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: { season_number: number; episode_count: number }[];
  status?: string;
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  revenue?: number;
  budget?: number;
  poster_path: string | null;
  backdrop_path: string | null;
  original_language: string;
  production_countries?: { iso_3166_1: string; name: string }[];
  origin_country?: string[];
  created_by?: { name: string }[];
  credits?: {
    crew: { job: string; name: string }[];
    cast: { name: string }[];
  };
  aggregate_credits?: { cast: { name: string }[] };
  release_dates?: {
    results: {
      iso_3166_1: string;
      release_dates: { certification: string; type: number }[];
    }[];
  };
  content_ratings?: {
    results: { iso_3166_1: string; rating: string }[];
  };
  external_ids?: { imdb_id: string | null };
};

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  override?: { apiKey?: string | null; accessToken?: string | null },
): Promise<T> {
  const stored = override ? null : getTmdbCredentials();
  const creds: Pick<TmdbCredentials, "apiKey" | "accessToken"> = {
    apiKey: override?.apiKey ?? stored?.apiKey ?? null,
    accessToken: override?.accessToken ?? stored?.accessToken ?? null,
  };
  if (!creds.apiKey && !creds.accessToken) {
    throw new Error(
      "Kein TMDB-API-Key hinterlegt. Trage ihn unter Admin → Einstellungen oder in .env.local ein.",
    );
  }
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("language", "de-DE");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  if (creds.apiKey) url.searchParams.set("api_key", creds.apiKey);
  const response = await fetch(url, {
    headers: creds.accessToken
      ? { Authorization: `Bearer ${creds.accessToken}`, accept: "application/json" }
      : { accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 401) {
    throw new Error("TMDB lehnt den API-Key ab (401). Bitte Key prüfen.");
  }
  if (response.status === 429) {
    throw new Error("TMDB-Rate-Limit erreicht. Bitte kurz warten.");
  }
  if (!response.ok) {
    throw new Error(`TMDB-Anfrage fehlgeschlagen (${response.status}).`);
  }
  return (await response.json()) as T;
}

function yearFromDate(date?: string | null) {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

export async function testTmdbCredentials(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("Bitte einen API-Key eingeben.");
  const creds = trimmed.startsWith("eyJ")
    ? { accessToken: trimmed, apiKey: null }
    : { apiKey: trimmed, accessToken: null };
  const data = await tmdbFetch<{ images?: unknown }>("/configuration", {}, creds);
  if (!data) throw new Error("Unerwartete Antwort von TMDB.");
  return true;
}

type ExistingMovie = { id: number; slug: string } | null;

function isSerie(media: MediaType) {
  return media === "serie";
}

function itemTitle(item: TmdbSearchItem | TmdbDetailsResponse, media: MediaType) {
  return isSerie(media)
    ? item.name || item.original_name || ""
    : item.title || item.original_title || "";
}

function itemOriginalTitle(
  item: TmdbSearchItem | TmdbDetailsResponse,
  media: MediaType,
) {
  return isSerie(media)
    ? item.original_name || item.name || ""
    : item.original_title || item.title || "";
}

function itemDate(item: TmdbSearchItem | TmdbDetailsResponse, media: MediaType) {
  return isSerie(media) ? item.first_air_date : item.release_date;
}

function existingByTmdb(tmdbId: number, media: MediaType): ExistingMovie {
  return (
    (getDb()
      .prepare("SELECT id, slug FROM movies WHERE media_type = ? AND tmdb_id = ?")
      .get(media, tmdbId) as ExistingMovie) ?? null
  );
}

function existingByTitle(
  title: string,
  originalTitle: string,
  year: number | null,
  media: MediaType,
): ExistingMovie {
  return (
    (getDb()
      .prepare(
        `SELECT id, slug FROM movies
         WHERE media_type = @media
           AND (title_de = @title COLLATE NOCASE OR title_original = @original COLLATE NOCASE)
           AND COALESCE(year, 0) = COALESCE(@year, 0)
         LIMIT 1`,
      )
      .get({ title, original: originalTitle, year, media }) as ExistingMovie) ?? null
  );
}

function existingMovie(
  tmdbId: number,
  title: string,
  originalTitle: string,
  year: number | null,
  media: MediaType,
): ExistingMovie {
  return (
    existingByTmdb(tmdbId, media) ??
    existingByTitle(title, originalTitle, year, media)
  );
}

/** TMDB returns 20 hits per page; larger views aggregate whole pages. */
const TMDB_PAGE_SIZE = 20;

function mapSearchResult(result: TmdbSearchItem, media: MediaType): TmdbSearchResult {
  const title = itemTitle(result, media);
  const originalTitle = itemOriginalTitle(result, media);
  const year = yearFromDate(itemDate(result, media));
  const existing = existingMovie(result.id, title, originalTitle, year, media);
  return {
    tmdbId: result.id,
    mediaType: media,
    title,
    originalTitle,
    year,
    overview: result.overview,
    posterPath: result.poster_path,
    rating: result.vote_average || null,
    votes: result.vote_count || null,
    popularity: result.popularity || null,
    alreadyInDb: Boolean(existing),
    existingId: existing?.id ?? null,
    existingSlug: existing?.slug ?? null,
    genreIds: Array.isArray(result.genre_ids) ? result.genre_ids : [],
    originalLanguage: result.original_language,
  };
}

/**
 * Search TMDB and return one page of hits. `perPage` is rounded to whole TMDB
 * pages so that paging stays stable: 20 → one, 40 → two, 100 → five TMDB pages.
 */
export async function searchTmdbPage(
  query: string,
  media: MediaType = "movie",
  locale: Locale = "de",
  page = 1,
  perPage = TMDB_PAGE_SIZE,
): Promise<TmdbSearchPage> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { results: [], page: 1, totalPages: 0, totalResults: 0 };
  }

  const safePage = Math.min(500, Math.max(1, Math.round(page)));
  const pagesPerView = Math.max(
    1,
    Math.min(5, Math.round(Math.max(1, perPage) / TMDB_PAGE_SIZE)),
  );
  const firstTmdbPage = (safePage - 1) * pagesPerView + 1;
  const requested = Array.from(
    { length: pagesPerView },
    (_, index) => firstTmdbPage + index,
  ).filter((entry) => entry <= 500);

  const responses = await Promise.all(
    requested.map((tmdbPage) =>
      tmdbFetch<TmdbSearchResponse>(
        isSerie(media) ? "/search/tv" : "/search/movie",
        {
          query: trimmed,
          include_adult: "false",
          region: "DE",
          language: locale === "en" ? "en-US" : "de-DE",
          page: tmdbPage,
        },
      ),
    ),
  );

  const seen = new Set<number>();
  const results: TmdbSearchResult[] = [];
  for (const data of responses) {
    for (const result of data.results ?? []) {
      if (!result?.id || !itemTitle(result, media)) continue;
      if (seen.has(result.id)) continue;
      seen.add(result.id);
      results.push(mapSearchResult(result, media));
    }
  }

  const totalResults = responses[0]?.total_results ?? results.length;
  const tmdbTotalPages = Math.min(500, responses[0]?.total_pages ?? 1);
  return {
    results: results.slice(0, pagesPerView * TMDB_PAGE_SIZE),
    page: safePage,
    totalPages: Math.max(1, Math.ceil(tmdbTotalPages / pagesPerView)),
    totalResults,
  };
}

export async function searchTmdb(
  query: string,
  media: MediaType = "movie",
  locale: Locale = "de",
): Promise<TmdbSearchResult[]> {
  const page = await searchTmdbPage(query, media, locale, 1, TMDB_PAGE_SIZE);
  return page.results;
}

/** Search results are useful for sorting once we have more than one page. */
const SEARCH_POOL_PAGES = 10;

/**
 * Fetch a capped pool of TMDB search hits so the caller can apply filters and
 * sorting locally. TMDB's search endpoint has no sort parameter at all, so
 * every non-relevance ordering has to be computed on our side.
 */
export async function searchTmdbPool(
  query: string,
  media: MediaType = "movie",
  locale: Locale = "de",
): Promise<TmdbSearchPool> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { movies: [], totalResults: 0, totalPages: 0, capped: false };
  }

  const baseParams = {
    query: trimmed,
    include_adult: "false",
    region: "DE",
    language: locale === "en" ? "en-US" : "de-DE",
  };
  const path = isSerie(media) ? "/search/tv" : "/search/movie";
  const first = await tmdbFetch<TmdbSearchResponse>(path, {
    ...baseParams,
    page: 1,
  });
  const totalPages = Math.min(500, first.total_pages ?? 1);
  const pagesToFetch = Math.min(totalPages, SEARCH_POOL_PAGES);
  const rest =
    pagesToFetch > 1
      ? await Promise.all(
          Array.from({ length: pagesToFetch - 1 }, (_, index) =>
            tmdbFetch<TmdbSearchResponse>(path, {
              ...baseParams,
              page: index + 2,
            }),
          ),
        )
      : [];

  const seen = new Set<number>();
  const movies: DiscoverMovie[] = [];
  for (const data of [first, ...rest]) {
    for (const result of data.results ?? []) {
      if (!result?.id || !itemTitle(result, media)) continue;
      if (seen.has(result.id)) continue;
      seen.add(result.id);
      movies.push({
        ...mapSearchResult(result, media),
        genreIds: Array.isArray(result.genre_ids) ? result.genre_ids : [],
      });
    }
  }

  return {
    movies,
    totalResults: first.total_results ?? movies.length,
    totalPages,
    capped: totalPages > pagesToFetch,
  };
}

const DISCOVER_SORT_MAPS: Record<
  MediaType,
  Record<DiscoverFilters["sort"], string>
> = {
  movie: {
    relevance: "popularity.desc",
    rating_desc: "vote_average.desc",
    popularity_desc: "popularity.desc",
    revenue_desc: "revenue.desc",
    release_desc: "primary_release_date.desc",
    votes_desc: "vote_count.desc",
  },
  serie: {
    relevance: "popularity.desc",
    rating_desc: "vote_average.desc",
    popularity_desc: "popularity.desc",
    revenue_desc: "popularity.desc",
    release_desc: "first_air_date.desc",
    votes_desc: "vote_count.desc",
  },
};

function discoverFromRaw(result: TmdbSearchItem, media: MediaType): DiscoverMovie {
  return {
    ...searchResultFromRaw(result, media),
    genreIds: Array.isArray(result.genre_ids) ? result.genre_ids : [],
  };
}

/**
 * Browse TMDB titles that are not part of the local archive yet. Several
 * discover pages are scanned when filters hide many titles, so the returned
 * grid stays useful instead of showing only a handful of new films.
 */
export async function discoverTmdb(
  filters: DiscoverFilters,
  locale: Locale = "de",
): Promise<DiscoverResult> {
  const startPage = Math.min(500, Math.max(1, Math.round(filters.page || 1)));
  const minRating = Math.min(10, Math.max(0, filters.minRating || 0));
  const minVotes = Math.max(0, Math.round(filters.minVotes || 0));
  const genreIds = [...new Set(filters.genreIds)]
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 5);

  const media = filters.media ?? "movie";
  const sortMap = DISCOVER_SORT_MAPS[media] ?? DISCOVER_SORT_MAPS.movie;
  const params: Record<string, string | number | undefined> = {
    sort_by: sortMap[filters.sort] ?? sortMap.rating_desc,
    include_adult: "false",
    include_video: media === "movie" ? "false" : undefined,
    region: media === "movie" ? "DE" : undefined,
    "vote_average.gte": minRating > 0 ? minRating : undefined,
    "vote_count.gte": minVotes > 0 ? minVotes : undefined,
    with_original_language: filters.language ?? undefined,
    language: locale === "en" ? "en-US" : "de-DE",
  };
  if (genreIds.length > 0) {
    params.with_genres = genreIds.join(filters.genreMode === "or" ? "|" : ",");
  }
  if (filters.year) {
    params[isSerie(media) ? "first_air_date_year" : "primary_release_year"] =
      filters.year;
  } else if (filters.decade) {
    const prefix = isSerie(media) ? "first_air_date" : "primary_release_date";
    params[`${prefix}.gte`] = `${filters.decade}-01-01`;
    params[`${prefix}.lte`] = `${filters.decade + 9}-12-31`;
  }

  const movies: DiscoverMovie[] = [];
  const seen = new Set<number>();
  let hiddenExisting = 0;
  let totalResults = 0;
  let totalPages = 1;
  let page = startPage;
  let scannedPages = 0;
  const target = Math.min(
    MAX_DISCOVER_PAGE_SIZE,
    Math.max(24, Math.round(filters.perPage ?? 24)),
  );
  const maxScans = Math.min(16, Math.max(4, Math.ceil(target / 20) + 2));

  while (scannedPages < maxScans && page <= 500 && movies.length < target) {
    const data = await tmdbFetch<TmdbDiscoverResponse>(
      isSerie(media) ? "/discover/tv" : "/discover/movie",
      {
        ...params,
        page,
      },
    );
    scannedPages += 1;
    totalResults = data.total_results ?? 0;
    totalPages = data.total_pages ?? 1;
    const results = Array.isArray(data.results) ? data.results : [];
    for (const raw of results) {
      if (!raw?.id || !itemTitle(raw, media)) continue;
      const mapped = discoverFromRaw(raw, media);
      if (mapped.alreadyInDb) {
        hiddenExisting += 1;
        continue;
      }
      if (seen.has(mapped.tmdbId)) continue;
      seen.add(mapped.tmdbId);
      movies.push(mapped);
    }
    page += 1;
    if (results.length === 0) break;
  }

  return {
    movies,
    nextPage: page <= Math.min(500, totalPages) ? page : null,
    hiddenExisting,
    scannedPages,
    totalResults,
    totalPages,
  };
}

function ageRating(details: TmdbDetailsResponse): string | null {
  const de = details.release_dates?.results.find(
    (entry) => entry.iso_3166_1 === "DE",
  );
  const certification = de?.release_dates.find((entry) => entry.certification)
    ?.certification;
  if (!certification) return null;
  return /^\d+$/.test(certification) ? `FSK ${certification}` : certification;
}

function tvAgeRating(details: TmdbDetailsResponse): string | null {
  const de = details.content_ratings?.results.find(
    (entry) => entry.iso_3166_1 === "DE",
  );
  const rating = de?.rating?.trim();
  if (!rating) return null;
  return /^\d+$/.test(rating) ? `FSK ${rating}` : rating;
}

/* --------------------------- matching existing titles -------------------------- */

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/^(der|die|das|the|a|an)\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * TMDB treats subtitle punctuation as significant: "Der Herr der Ringe -
 * Die Rückkehr des Königs" returns nothing while the main title works. Build
 * progressively shorter variants so a failed exact query can fall back to a
 * still-meaningful search.
 */
function titleVariants(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const variants = [trimmed];
  const add = (candidate: string | undefined) => {
    const clean = candidate?.trim();
    if (clean && clean.length >= 2 && !variants.includes(clean)) {
      variants.push(clean);
    }
  };
  add(trimmed.replace(/\s*[([{]\s*\d{4}\s*[)\]}]?\s*$/, ""));
  for (const source of [...variants]) {
    add(source.split(/\s*(?::|–|—)\s*|\s+-\s+/)[0]);
  }
  // Without the subtitle separator TMDB sometimes finds nothing at all. Trim
  // trailing words progressively (e.g. "... die rückkehr des königs" →
  // "... die rückkehr des") until a search returns the right title.
  const words = trimmed.split(/\s+/).filter(Boolean);
  // The distinctive part of a long title often sits at the end ("… jungen
  // Indiana Jones"), so try short suffix windows before chopping from the end.
  for (let take = Math.min(4, words.length); take >= 2; take -= 1) {
    add(words.slice(words.length - take).join(" "));
  }
  for (let drop = 1; drop <= 5 && words.length - drop >= 1; drop += 1) {
    add(words.slice(0, words.length - drop).join(" "));
  }
  return variants;
}

function tokenOverlap(a: string, b: string) {
  const left = new Set(a.split(" ").filter((token) => token.length > 1));
  const right = new Set(b.split(" ").filter((token) => token.length > 1));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

function scoreMatch(input: ImportMatchInput, result: TmdbSearchResult) {
  const reasons: string[] = [];
  const target = normalizeTitle(input.title);
  const targetOriginal = input.originalTitle
    ? normalizeTitle(input.originalTitle)
    : "";
  const titleCandidates = [result.title, result.originalTitle]
    .map(normalizeTitle)
    .filter(Boolean);

  const exactTarget = Boolean(target && titleCandidates.includes(target));
  const exactOriginal = Boolean(
    targetOriginal && titleCandidates.includes(targetOriginal),
  );
  const exact = exactTarget || exactOriginal;
  const similarity = Math.max(
    0,
    ...titleCandidates.map((candidate) =>
      Math.max(
        target ? titleSimilarity(target, candidate) : 0,
        targetOriginal ? titleSimilarity(targetOriginal, candidate) : 0,
      ),
    ),
  );
  const overlap = target
    ? Math.max(
        0,
        ...titleCandidates.map((candidate) => tokenOverlap(target, candidate)),
      )
    : 0;
  // A title that literally starts with the input (or vice versa) is a much
  // better signal than raw character similarity suggests – e.g. "Bibi & Tina"
  // vs "Bibi & Tina - Der Film".
  const contains = [target, targetOriginal]
    .filter(Boolean)
    .some((needle) =>
      titleCandidates.some(
        (candidate) =>
          candidate !== needle &&
          (candidate.startsWith(`${needle} `) ||
            needle.startsWith(`${candidate} `)),
      ),
    );

  // An exact title is already a very strong signal – the year only refines it.
  // Similar titles degrade gently so typos and punctuation never kill a match.
  const baseTitle = Math.max(
    similarity,
    overlap * 0.9,
    contains ? 0.84 : 0,
  );
  const titleScore = exact ? 90 : Math.round(baseTitle * 90);
  if (exactTarget) {
    reasons.push("Titel exakt");
  } else if (exactOriginal) {
    reasons.push("Originaltitel exakt");
  } else if (similarity >= 0.85) {
    reasons.push("Titel fast identisch");
  } else if (contains) {
    reasons.push("Haupttitel enthalten");
  } else if (similarity >= 0.6 || overlap >= 0.6) {
    reasons.push("Titel ähnlich");
  }

  let yearScore = 0;
  if (input.year && result.year) {
    const difference = Math.abs(input.year - result.year);
    if (difference === 0) {
      yearScore = 10;
      reasons.push("Jahr exakt");
    } else if (difference === 1) {
      yearScore = 6;
      reasons.push("Jahr ±1");
    } else if (difference === 2) {
      yearScore = 3;
      reasons.push("Jahr nah");
    } else if (difference >= 4) {
      // A clearly different year points at a remake or a same-named film.
      yearScore = -Math.min(25, (difference - 2) * 5);
      reasons.push("Jahr weicht ab");
    }
  }

  const popularityScore = Math.min(
    3,
    Math.log10((result.popularity ?? 0) + 1) * 1.2,
  );
  const votesScore = Math.min(4, Math.log10((result.votes ?? 0) + 1) * 0.9);
  if (votesScore >= 3) reasons.push("viele Stimmen");

  const matchScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(titleScore + yearScore + popularityScore + votesScore),
    ),
  );
  return {
    matchScore,
    matchLabel:
      matchScore >= 70 ? ("hoch" as const) : matchScore >= 45 ? ("mittel" as const) : ("niedrig" as const),
    reasons: reasons.slice(0, 4),
  };
}

function searchResultFromRaw(
  result: TmdbSearchItem,
  media: MediaType,
): TmdbSearchResult {
  const title = itemTitle(result, media);
  const originalTitle = itemOriginalTitle(result, media);
  const year = yearFromDate(itemDate(result, media));
  const existing = existingMovie(
    result.id,
    title,
    originalTitle,
    year,
    media,
  );
  return {
    tmdbId: result.id,
    mediaType: media,
    title,
    originalTitle,
    year,
    overview: result.overview,
    posterPath: result.poster_path,
    rating: result.vote_average || null,
    votes: result.vote_count || null,
    popularity: result.popularity || null,
    alreadyInDb: Boolean(existing),
    existingId: existing?.id ?? null,
    existingSlug: existing?.slug ?? null,
  };
}

function candidateFromRaw(
  input: ImportMatchInput,
  result: TmdbSearchItem,
  media: MediaType,
): TmdbMatchCandidate {
  const base = searchResultFromRaw(result, media);
  return { ...base, ...scoreMatch(input, base) };
}

async function rawSearch(query: string, year: number | undefined, media: MediaType) {
  const data = await tmdbFetch<TmdbSearchResponse>(
    isSerie(media) ? "/search/tv" : "/search/movie",
    {
      query,
      ...(isSerie(media)
        ? { first_air_date_year: year }
        : { year }),
      include_adult: "false",
      region: "DE",
    },
  );
  return data.results.filter((result) => result.id && itemTitle(result, media));
}

function mergeResults(
  target: Map<number, TmdbSearchItem>,
  results: TmdbSearchItem[],
) {
  for (const result of results) {
    if (!target.has(result.id)) target.set(result.id, result);
  }
}

async function gatherCandidates(
  input: ImportMatchInput,
  media: MediaType,
): Promise<TmdbMatchCandidate[]> {
  const found = new Map<number, TmdbSearchItem>();
  const year = input.year ?? undefined;
  const variants = titleVariants(input.title);
  const primary = variants[0] ?? input.title;

  const search = async (
    query: string,
    releaseYear: number | undefined,
    required = false,
  ) => {
    try {
      mergeResults(found, await rawSearch(query, releaseYear, media));
    } catch (error) {
      if (required) throw error;
      // Optional fallbacks may fail without discarding the primary result.
    }
  };

  const strongMatch = () =>
    [...found.values()].some(
      (result) => candidateFromRaw(input, result, media).matchScore >= 70,
    );

  await search(primary, year, true);

  if (year && !strongMatch()) await search(primary, undefined);

  // TMDB's search treats subtitle punctuation as significant. Retry the main
  // title (before ":", "–" or " - ") until something convincing appears.
  for (const variant of variants.slice(1)) {
    if (strongMatch()) break;
    await search(variant, year);
    if (year && !strongMatch()) await search(variant, undefined);
  }

  const original = input.originalTitle?.trim();
  if (
    original &&
    normalizeTitle(original) !== normalizeTitle(input.title) &&
    !strongMatch()
  ) {
    await search(original, year);
    if (year && !strongMatch()) await search(original, undefined);
  }

  return [...found.values()]
    .map((result) => candidateFromRaw(input, result, media))
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        (b.popularity ?? 0) - (a.popularity ?? 0) ||
        (b.votes ?? 0) - (a.votes ?? 0),
    );
}

async function candidatesForInput(
  input: ImportMatchInput,
  media: MediaType,
): Promise<TmdbMatchCandidate[]> {
  return (await gatherCandidates(input, media)).slice(0, 6);
}

async function candidateById(
  tmdbId: number,
  media: MediaType,
): Promise<TmdbMatchCandidate | null> {
  const details = await tmdbFetch<TmdbDetailsResponse>(
    isSerie(media) ? `/tv/${tmdbId}` : `/movie/${tmdbId}`,
  );
  if (!details?.id) return null;
  const title = itemTitle(details, media);
  const originalTitle = itemOriginalTitle(details, media);
  const result: TmdbSearchItem = {
    id: details.id,
    title,
    name: title,
    original_title: originalTitle,
    original_name: originalTitle,
    overview: details.overview,
    release_date: details.release_date,
    first_air_date: details.first_air_date,
    poster_path: details.poster_path,
    vote_average: details.vote_average,
    vote_count: details.vote_count,
    popularity: details.popularity,
  };
  return {
    ...searchResultFromRaw(result, media),
    matchScore: 100,
    matchLabel: "hoch",
    reasons: ["TMDB-ID"],
  };
}

export async function searchTmdbCandidates(
  query: string,
  media: MediaType = "movie",
): Promise<TmdbMatchCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const yearMatch = /^(.*?)\s*[([{]\s*(\d{4})\s*[)\]}]?\s*$/.exec(trimmed);
  const title = yearMatch ? yearMatch[1].trim() : trimmed;
  const year = yearMatch ? Number(yearMatch[2]) : undefined;
  const input: ImportMatchInput = { title, year: year ?? null };
  return (await gatherCandidates(input, media)).slice(0, 10);
}

export async function matchTmdbRow(
  input: ImportMatchInput,
  media: MediaType = "movie",
): Promise<TmdbMatchResult> {
  const cleanInput: ImportMatchInput = {
    title: String(input?.title ?? "").trim(),
    year:
      Number.isFinite(Number(input?.year)) && Number(input?.year) > 1800
        ? Math.round(Number(input.year))
        : null,
    originalTitle: input?.originalTitle
      ? String(input.originalTitle).trim() || null
      : null,
    tmdbId:
      Number.isFinite(Number(input?.tmdbId)) && Number(input?.tmdbId) > 0
        ? Math.round(Number(input.tmdbId))
        : null,
  };

  try {
    if (!cleanInput.title && !cleanInput.tmdbId) {
      throw new Error("Titel fehlt.");
    }
    const candidates = cleanInput.tmdbId
      ? [await candidateById(cleanInput.tmdbId, media)].filter(
          (entry): entry is TmdbMatchCandidate => Boolean(entry),
        )
      : await candidatesForInput(cleanInput, media);
    const best = candidates[0] ?? null;
    return {
      index: 0,
      input: cleanInput,
      candidates,
      bestTmdbId: best?.tmdbId ?? null,
      status: !best ? "none" : best.matchScore >= 70 ? "matched" : "review",
    };
  } catch (error) {
    return {
      index: 0,
      input: cleanInput,
      candidates: [],
      bestTmdbId: null,
      status: "error",
      error: error instanceof Error ? error.message : "Abgleich fehlgeschlagen.",
    };
  }
}

export async function matchTmdbBatch(
  rows: ImportMatchInput[],
  offset = 0,
  limit = 6,
  media: MediaType = "movie",
): Promise<TmdbMatchBatch> {
  const safeLimit = Math.min(12, Math.max(1, limit));
  const slice = rows.slice(offset, offset + safeLimit);
  const results: TmdbMatchResult[] = [];
  for (let index = 0; index < slice.length; index += 1) {
    const result = await matchTmdbRow(slice[index], media);
    results.push({ ...result, index: offset + index });
  }
  const nextOffset = offset + slice.length;
  return {
    nextOffset,
    total: rows.length,
    done: nextOffset >= rows.length,
    results,
  };
}


export async function fetchTmdbMedia(
  tmdbId: number,
  media: MediaType = "movie",
): Promise<MovieInput> {
  if (isSerie(media)) {
    const params = {
      append_to_response: "credits,aggregate_credits,external_ids,content_ratings",
    };
    const [details, english] = await Promise.all([
      tmdbFetch<TmdbDetailsResponse>(`/tv/${tmdbId}`, params),
      tmdbFetch<TmdbDetailsResponse>(`/tv/${tmdbId}`, {
        ...params,
        language: "en-US",
      }).catch(() => null),
    ]);
    const creators = details.created_by?.map((person) => person.name) ?? [];
    const cast =
      details.aggregate_credits?.cast.slice(0, 8).map((person) => person.name) ??
      details.credits?.cast.slice(0, 8).map((person) => person.name) ??
      [];
    const country =
      details.production_countries?.map((entry) => entry.name).join(", ") ||
      details.origin_country?.join(", ") ||
      null;
    return {
      mediaType: "serie",
      tmdbId: details.id,
      titleDe: itemTitle(details, "serie"),
      titleEn: english ? itemTitle(english, "serie") || null : null,
      titleOriginal: itemOriginalTitle(details, "serie"),
      year: yearFromDate(details.first_air_date),
      endYear: yearFromDate(details.last_air_date),
      seasons: details.number_of_seasons ?? null,
      episodes: details.number_of_episodes ?? null,
      seriesStatus: details.status || null,
      releaseDate: details.first_air_date || null,
      overviewDe: details.overview || null,
      overviewEn: english?.overview || null,
      taglineDe: details.tagline || null,
      taglineEn: english?.tagline || null,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      genres: details.genres.map((genre) => genre.name),
      genresEn: english?.genres?.map((genre) => genre.name) ?? [],
      runtime: details.episode_run_time?.find((value) => value > 0) ?? null,
      director: creators.join(", ") || null,
      cast,
      country,
      originalLanguage: details.original_language || null,
      ageRating: tvAgeRating(details),
      imdbId: details.external_ids?.imdb_id ?? null,
      imdbRating: null,
      imdbVotes: null,
      rtRating: null,
      metacritic: null,
      tmdbRating: details.vote_average || null,
      tmdbVotes: details.vote_count || null,
      boxOffice: null,
      budget: null,
      popularity: details.popularity || null,
      oscarWins: 0,
      oscarNominations: 0,
      awards: null,
      source: "tmdb",
    };
  }

  const params = { append_to_response: "credits,release_dates,external_ids" };
  const [details, english] = await Promise.all([
    tmdbFetch<TmdbDetailsResponse>(`/movie/${tmdbId}`, params),
    tmdbFetch<TmdbDetailsResponse>(`/movie/${tmdbId}`, {
      ...params,
      language: "en-US",
    }).catch(() => null),
  ]);
  const directors =
    details.credits?.crew
      .filter((person) => person.job === "Director")
      .map((person) => person.name) ?? [];
  const cast = details.credits?.cast.slice(0, 8).map((person) => person.name) ?? [];
  return {
    mediaType: "movie",
    tmdbId: details.id,
    titleDe: itemTitle(details, "movie"),
    titleEn: english ? itemTitle(english, "movie") || null : null,
    titleOriginal: itemOriginalTitle(details, "movie"),
    year: yearFromDate(details.release_date),
    releaseDate: details.release_date || null,
    overviewDe: details.overview || null,
    overviewEn: english?.overview || null,
    taglineDe: details.tagline || null,
    taglineEn: english?.tagline || null,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    genres: details.genres.map((genre) => genre.name),
    genresEn: english?.genres?.map((genre) => genre.name) ?? [],
    runtime: details.runtime,
    director: directors.join(", ") || null,
    cast,
    country:
      details.production_countries?.map((country) => country.name).join(", ") ||
      null,
    originalLanguage: details.original_language || null,
    ageRating: ageRating(details),
    imdbId: details.external_ids?.imdb_id ?? null,
    imdbRating: null,
    imdbVotes: null,
    rtRating: null,
    metacritic: null,
    tmdbRating: details.vote_average || null,
    tmdbVotes: details.vote_count || null,
    boxOffice: (details.revenue ?? 0) > 0 ? (details.revenue ?? null) : null,
    budget: (details.budget ?? 0) > 0 ? (details.budget ?? null) : null,
    popularity: details.popularity || null,
    oscarWins: 0,
    oscarNominations: 0,
    awards: null,
    source: "tmdb",
  };
}

export function fetchTmdbMovie(tmdbId: number): Promise<MovieInput> {
  return fetchTmdbMedia(tmdbId, "movie");
}

type TmdbSeasonResponse = {
  season_number: number;
  episodes?: {
    id: number;
    episode_number: number;
    name?: string;
    overview?: string;
    air_date?: string | null;
    runtime?: number | null;
    still_path?: string | null;
  }[];
};

/**
 * Load every regular season of a series from TMDB. Specials (season 0) are
 * skipped so progress tracking stays focused on the main run.
 */
export async function fetchTmdbSeriesEpisodes(
  tmdbId: number,
): Promise<EpisodeInput[]> {
  const details = await tmdbFetch<TmdbDetailsResponse>(`/tv/${tmdbId}`);
  const seasons = (details.seasons ?? [])
    .filter((season) => season.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);
  const episodes: EpisodeInput[] = [];
  for (const season of seasons) {
    const [data, english] = await Promise.all([
      tmdbFetch<TmdbSeasonResponse>(
        `/tv/${tmdbId}/season/${season.season_number}`,
      ),
      tmdbFetch<TmdbSeasonResponse>(
        `/tv/${tmdbId}/season/${season.season_number}`,
        { language: "en-US" },
      ).catch(() => null),
    ]);
    const englishByEpisode = new Map(
      (english?.episodes ?? []).map((episode) => [episode.episode_number, episode]),
    );
    for (const episode of data.episodes ?? []) {
      const translated = englishByEpisode.get(episode.episode_number);
      episodes.push({
        tmdbId: episode.id ?? null,
        seasonNumber: data.season_number ?? season.season_number,
        episodeNumber: episode.episode_number,
        title: episode.name?.trim() || `Folge ${episode.episode_number}`,
        titleEn:
          translated?.name?.trim() || (translated ? `Episode ${episode.episode_number}` : null),
        overview: episode.overview || null,
        overviewEn: translated?.overview || null,
        airDate: episode.air_date || null,
        runtime: episode.runtime && episode.runtime > 0 ? episode.runtime : null,
        stillPath: episode.still_path || null,
      });
    }
  }
  return episodes;
}

/**
 * Load or refresh all episodes of an archived series from TMDB. Existing
 * watched/rewatch state is preserved by the episode upsert.
 */
export async function syncSeriesEpisodes(movieId: number): Promise<number> {
  const movie = getMovieById(movieId);
  if (!movie) throw new Error("Serie nicht gefunden.");
  if (movie.mediaType !== "serie") throw new Error("Nur Serien haben Folgen.");
  if (!movie.tmdbId) {
    throw new Error("Für diese Serie ist keine TMDB-ID hinterlegt.");
  }
  const episodes = await fetchTmdbSeriesEpisodes(movie.tmdbId);
  if (episodes.length === 0) {
    throw new Error("TMDB liefert keine Folgen für diese Serie.");
  }
  return saveSeriesEpisodes(movieId, episodes);
}

async function upsertTmdbMovie(
  tmdbId: number,
  media: MediaType = "movie",
): Promise<{
  id: number;
  added: boolean;
}> {
  const db = getDb();
  const input = await fetchTmdbMedia(tmdbId, media);
  const byTmdb = db
    .prepare("SELECT id FROM movies WHERE media_type = ? AND tmdb_id = ?")
    .get(media, tmdbId) as { id: number } | undefined;
  const byTitle = byTmdb
    ? undefined
    : (db
        .prepare(
          `SELECT id FROM movies
           WHERE media_type = @media
             AND (title_de = @title COLLATE NOCASE OR title_original = @original COLLATE NOCASE)
             AND COALESCE(year, 0) = COALESCE(@year, 0)
           LIMIT 1`,
        )
        .get({
          title: input.titleDe,
          original: input.titleOriginal ?? input.titleDe,
          year: input.year,
          media,
        }) as { id: number } | undefined);
  const existingId = byTmdb?.id ?? byTitle?.id ?? null;

  if (existingId) {
    const movie = getMovieById(existingId);
    updateMovie(
      existingId,
      {
        ...input,
        rtRating: movie?.rtRating ?? null,
        metacritic: movie?.metacritic ?? null,
        imdbRating: movie?.imdbRating ?? null,
        imdbVotes: movie?.imdbVotes ?? null,
        oscarWins: movie?.oscarWins ?? 0,
        oscarNominations: movie?.oscarNominations ?? 0,
        awards: movie?.awards ?? null,
        source: movie?.source === "manual" ? "manual" : "tmdb",
      },
      { recompute: false },
    );
    return { id: existingId, added: false };
  }
  const id = insertMovie(input, { recompute: false });
  return { id, added: true };
}

export async function addMovieFromTmdb(
  tmdbId: number,
  media: MediaType = "movie",
): Promise<{
  id: number;
  added: boolean;
}> {
  const result = await upsertTmdbMovie(tmdbId, media);
  // Best effort: the title is added even when TMDB image downloads fail.
  try {
    await cacheMovieMedia(result.id);
  } catch {
    // ignore media cache errors
  }
  recomputeAllScores();
  return result;
}

export async function importTmdbChoicesBatch(
  choices: TmdbImportChoice[],
  offset = 0,
  limit = 4,
): Promise<TmdbImportBatchResult> {
  const safeLimit = Math.min(10, Math.max(1, limit));
  const slice = choices.slice(offset, offset + safeLimit);
  let added = 0;
  let updated = 0;
  let listed = 0;
  const imported: TmdbImportBatchResult["imported"] = [];
  const errors: string[] = [];

  for (const choice of slice) {
    try {
      const result = await upsertTmdbMovie(
        choice.tmdbId,
        choice.mediaType ?? "movie",
      );
      try {
        await cacheMovieMedia(result.id);
      } catch {
        // ignore media cache errors; importing metadata is what matters
      }
      const movie = getMovieById(result.id);
      if (result.added) added += 1;
      else updated += 1;
      if (choice.listId) {
        try {
          if (addMovieToList(choice.listId, result.id)) listed += 1;
        } catch (listError) {
          errors.push(
            `${choice.inputTitle || `TMDB ${choice.tmdbId}`}: ${
              listError instanceof Error
                ? listError.message
                : "Konnte nicht auf die Liste gesetzt werden."
            }`,
          );
        }
      }
      if (movie) {
        imported.push({ id: movie.id, slug: movie.slug, title: movie.titleDe });
      }
    } catch (error) {
      errors.push(
        `${choice.inputTitle || `TMDB ${choice.tmdbId}`}: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`,
      );
    }
  }

  if (added + updated > 0) recomputeAllScores();
  const nextOffset = offset + slice.length;
  return {
    nextOffset,
    total: choices.length,
    done: nextOffset >= choices.length,
    added,
    updated,
    listed,
    imported,
    errors,
  };
}

export type SeedBatchResult = {
  nextOffset: number;
  total: number;
  processed: number;
  added: number;
  skipped: number;
  failed: string[];
  done: boolean;
};

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  let beforePrevious: number[] = [];
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      // Treat a swapped pair of letters as one edit instead of two.
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        current[j] = Math.min(current[j], beforePrevious[j - 2] + 1);
      }
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

function titleSimilarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

/**
 * TMDB's search is fuzzy and returns look-alike titles (documentaries,
 * remakes, "making of" specials) before the real one. Pick the candidate
 * whose title and year actually match instead of trusting the first result.
 */
function pickSeedCandidate(
  entry: SeedEntry,
  candidates: TmdbSearchItem[],
  media: MediaType,
) {
  const target = normalizeTitle(entry.title);
  const scored = candidates.map((result) => {
    const titles = [
      result.title,
      result.name,
      result.original_title,
      result.original_name,
    ]
      .filter((value): value is string => Boolean(value))
      .map(normalizeTitle)
      .filter(Boolean);
    const exact = titles.includes(target);
    const similarity = Math.max(
      0,
      ...titles.map((title) => titleSimilarity(target, title)),
    );
    const year = yearFromDate(
      media === "serie" ? result.first_air_date : result.release_date,
    );
    const yearScore =
      year !== null && entry.year
        ? year === entry.year
          ? 40
          : Math.abs(year - entry.year) === 1
            ? 20
            : 0
        : 0;
    return {
      result,
      exact,
      similarity,
      score: (exact ? 100 : Math.round(similarity * 100)) + yearScore,
      popularity: result.popularity ?? 0,
    };
  });
  const viable = scored
    .filter((candidate) => candidate.exact || candidate.similarity >= 0.8)
    .sort((a, b) => b.score - a.score || b.popularity - a.popularity);
  return viable[0]?.result ?? null;
}

export async function importSeedBatch(
  media: MediaType,
  indices: number[] = [],
  offset = 0,
  limit = 6,
): Promise<SeedBatchResult> {
  const db = getDb();
  const packageEntries = media === "serie" ? SEED_SERIES : SEED_MOVIES;
  const requested = [...new Set(indices)].filter(
    (index) => Number.isInteger(index) && index >= 0 && index < packageEntries.length,
  );
  const selectedEntries =
    requested.length > 0
      ? requested.map((index) => ({ index, entry: packageEntries[index] }))
      : packageEntries.map((entry, index) => ({ index, entry }));
  const slice = selectedEntries.slice(offset, offset + limit);
  let added = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const { index, entry } of slice) {
    try {
      const data =
        media === "serie"
          ? await tmdbFetch<TmdbSearchResponse>("/search/tv", {
              query: entry.title,
              first_air_date_year: entry.year,
              include_adult: "false",
              region: "DE",
            })
          : await tmdbFetch<TmdbSearchResponse>("/search/movie", {
              query: entry.title,
              year: entry.year,
              include_adult: "false",
              region: "DE",
            });
      const candidates = data.results.filter((result) => result.id);
      const best = pickSeedCandidate(entry, candidates, media);
      if (!best) {
        failed.push(`${entry.title} (${entry.year})`);
        continue;
      }
      const existing = db
        .prepare("SELECT id FROM movies WHERE media_type = ? AND tmdb_id = ?")
        .get(media, best.id) as { id: number } | undefined;
      if (existing) {
        skipped += 1;
        continue;
      }
      const input = await fetchTmdbMedia(best.id, media);
      input.source = "starter";
      const movieId = insertMovie(input, { recompute: false });
      db.prepare("UPDATE movies SET starter_index = ? WHERE id = ?").run(
        index,
        movieId,
      );
      if (media === "serie") {
        try {
          const episodes = await fetchTmdbSeriesEpisodes(best.id);
          saveSeriesEpisodes(movieId, episodes);
        } catch {
          /* The series itself is imported even when episode data fails. */
        }
      }
      added += 1;
    } catch (error) {
      failed.push(
        `${entry.title} (${entry.year}): ${
          error instanceof Error ? error.message : "Fehler"
        }`,
      );
    }
  }

  if (added > 0) recomputeAllScores();
  const nextOffset = offset + slice.length;
  return {
    nextOffset,
    total: selectedEntries.length,
    processed: slice.length,
    added,
    skipped,
    failed,
    done: nextOffset >= selectedEntries.length,
  };
}

/* ---------------------- English content backfill ---------------------- */

export type ContentBackfillBatch = {
  total: number;
  processed: number;
  updated: number;
  remaining: number;
  failed: string[];
};

/**
 * Fetch English titles, synopses, taglines and genres for archived titles that
 * were imported before bilingual content existed. Safe to run repeatedly.
 */
export async function backfillEnglishContent(
  limit = 5,
): Promise<ContentBackfillBatch> {
  const { total, targets } = getContentBackfillTargets(limit);
  const failed: string[] = [];
  let updated = 0;

  for (const target of targets) {
    try {
      const params = {
        append_to_response:
          target.mediaType === "serie"
            ? "credits,aggregate_credits,external_ids,content_ratings"
            : "credits,release_dates,external_ids",
        language: "en-US",
      };
      const details = await tmdbFetch<TmdbDetailsResponse>(
        target.mediaType === "serie"
          ? `/tv/${target.tmdbId}`
          : `/movie/${target.tmdbId}`,
        params,
      );
      saveLocalizedContent(target.id, {
        titleEn: itemTitle(details, target.mediaType) || null,
        overviewEn: details.overview || null,
        taglineEn: details.tagline || null,
        genresEn: details.genres?.map((genre) => genre.name) ?? [],
      });
      updated += 1;
    } catch (error) {
      failed.push(
        `${target.title}: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`,
      );
    }
  }

  return {
    total,
    processed: targets.length,
    updated,
    remaining: getContentBackfillTargets(1).total,
    failed,
  };
}

/**
 * Re-sync series that still have episodes without English copy. Episode
 * progress (watched/rewatch) is preserved by the upsert.
 */
export async function backfillEnglishEpisodes(
  limit = 3,
): Promise<ContentBackfillBatch> {
  const { total, targets } = getEpisodeBackfillTargets(500);
  const movieIds = [...new Set(targets.map((target) => target.movieId))].slice(
    0,
    Math.max(1, limit),
  );
  const failed: string[] = [];
  let updated = 0;

  for (const movieId of movieIds) {
    const movie = getMovieById(movieId);
    try {
      updated += await syncSeriesEpisodes(movieId);
    } catch (error) {
      failed.push(
        `${movie?.titleDe ?? `Serie ${movieId}`}: ${
          error instanceof Error ? error.message : "Unbekannter Fehler"
        }`,
      );
    }
  }

  return {
    total,
    processed: movieIds.length,
    updated,
    remaining: getEpisodeBackfillTargets(1).total,
    failed,
  };
}
