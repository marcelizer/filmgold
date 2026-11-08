"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { hasTmdbCredentials, saveWeights, setSetting } from "@/lib/db";
import { restoreBackup, type RestoreSummary } from "@/lib/backup";
import { translateError } from "@/lib/errors";
import { getLocale } from "@/lib/i18n-server";
import { isLocale, LOCALE_COOKIE, tr } from "@/lib/locale";
import {
  cacheEpisodeStillsBatch,
  cacheMovieMediaBatch,
  clearMediaCache,
  getMediaStats,
  type MediaCacheMode,
} from "@/lib/media";
import { compareSnapshots } from "@/lib/snapshot";
import {
  addMovieToList,
  createList,
  deleteList,
  getListDetail,
  getListsForMovie,
  isMovieInList,
  moveListItem,
  removeMovieFromList,
  searchArchiveCandidates,
  updateList,
} from "@/lib/lists";
import {
  deleteMovie,
  getMovieById,
  importRows,
  insertMovie,
  normalizeImportRow,
  recomputeAllScores,
  removeDemoData,
  removeStarterData,
  resetArchive,
  seedDemoData,
  setEpisodeRewatched,
  setEpisodeWatched,
  setPersonalState,
  setSeasonRewatched,
  setSeasonWatched,
  startRewatch,
  stopRewatch,
  updateMovie,
  type PersonalPatch,
} from "@/lib/movies";
import {
  addMovieFromTmdb,
  backfillEnglishContent,
  backfillEnglishEpisodes,
  importSeedBatch,
  importTmdbChoicesBatch,
  matchTmdbBatch,
  matchTmdbRow,
  searchTmdb,
  searchTmdbCandidates,
  syncSeriesEpisodes,
  testTmdbCredentials,
} from "@/lib/tmdb";
import type {
  ImportMatchInput,
  ListSearchCandidate,
  MediaType,
  MovieListMembership,
  ScoreWeights,
  TmdbImportChoice,
} from "@/lib/types";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function fail(error: unknown): Promise<{ ok: false; error: string }> {
  const locale = await getLocale();
  const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
  return {
    ok: false,
    error: tr(locale, message, translateError(message, locale)),
  };
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function setLocaleAction(locale: string): Promise<ActionResult> {
  try {
    if (!isLocale(locale)) throw new Error("Unsupported language.");
    const store = await cookies();
    store.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function savePersonalAction(
  movieId: number,
  patch: PersonalPatch,
): Promise<ActionResult> {
  try {
    if (!Number.isFinite(movieId)) throw new Error("Ungültiger Film.");
    const clean: PersonalPatch = {};
    if (typeof patch.seen === "boolean") clean.seen = patch.seen;
    if (typeof patch.favorite === "boolean") clean.favorite = patch.favorite;
    if (patch.rating !== undefined) {
      clean.rating =
        patch.rating === null || !Number.isFinite(Number(patch.rating))
          ? null
          : Math.min(10, Math.max(1, Number(patch.rating)));
    }
    if (patch.note !== undefined) {
      clean.note = typeof patch.note === "string" ? patch.note.slice(0, 2000) : null;
    }
    if (patch.watchedAt !== undefined) clean.watchedAt = patch.watchedAt;
    setPersonalState(movieId, clean);
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleEpisodeWatchedAction(
  episodeId: number,
  watched: boolean,
): Promise<ActionResult> {
  try {
    setEpisodeWatched(episodeId, watched);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleEpisodeRewatchedAction(
  episodeId: number,
  rewatched: boolean,
): Promise<ActionResult> {
  try {
    setEpisodeRewatched(episodeId, rewatched);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function setSeasonWatchedAction(
  movieId: number,
  seasonNumber: number | null,
  watched: boolean,
): Promise<ActionResult> {
  try {
    setSeasonWatched(movieId, seasonNumber, watched);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function setSeasonRewatchedAction(
  movieId: number,
  seasonNumber: number | null,
  rewatched: boolean,
): Promise<ActionResult> {
  try {
    setSeasonRewatched(movieId, seasonNumber, rewatched);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function startRewatchAction(movieId: number): Promise<ActionResult> {
  try {
    startRewatch(movieId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function stopRewatchAction(movieId: number): Promise<ActionResult> {
  try {
    stopRewatch(movieId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function syncSeriesEpisodesAction(
  movieId: number,
): Promise<ActionResult<{ count: number }>> {
  try {
    const count = await syncSeriesEpisodes(movieId);
    refresh();
    return { ok: true, data: { count } };
  } catch (error) {
    return fail(error);
  }
}

export async function saveMovieAction(
  raw: Record<string, unknown>,
  id?: number | null,
): Promise<ActionResult<{ id: number }>> {
  try {
    const input = normalizeImportRow(raw);
    if (!input) throw new Error("Ein Titel ist erforderlich.");
    if (!raw.source) input.source = "manual";
    if (id) {
      updateMovie(id, input);
      refresh();
      return { ok: true, data: { id } };
    }
    const newId = insertMovie(input);
    refresh();
    return { ok: true, data: { id: newId } };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMovieAction(id: number): Promise<ActionResult> {
  try {
    deleteMovie(id);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function importRowsAction(
  rows: Record<string, unknown>[],
): Promise<ActionResult<{ added: number; updated: number; skipped: number; errors: string[] }>> {
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Keine Zeilen zum Importieren gefunden.");
    }
    if (rows.length > 2000) throw new Error("Maximal 2000 Zeilen pro Import.");
    const summary = importRows(rows);
    refresh();
    return { ok: true, data: summary };
  } catch (error) {
    return fail(error);
  }
}

export async function addTmdbMovieAction(
  tmdbId: number,
  media: MediaType = "movie",
): Promise<ActionResult<{ id: number; added: boolean }>> {
  try {
    if (!Number.isFinite(tmdbId)) throw new Error("Ungültige TMDB-ID.");
    const result = await addMovieFromTmdb(tmdbId, media);
    refresh();
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function searchTmdbAction(query: string, media: MediaType = "movie") {
  try {
    const results = await searchTmdb(query, media, await getLocale());
    return { ok: true as const, data: results };
  } catch (error) {
    return fail(error);
  }
}

export async function importSeedBatchAction(
  media: MediaType,
  indices: number[] = [],
  offset = 0,
  limit = 6,
) {
  try {
    if (media !== "movie" && media !== "serie") {
      throw new Error("Ungültiges Startpaket.");
    }
    const cleanIndices = Array.isArray(indices)
      ? [...new Set(indices.map((value) => Math.round(Number(value))))].filter(
          (value) => Number.isFinite(value) && value >= 0,
        )
      : [];
    if (cleanIndices.length > 500) {
      throw new Error("Maximal 500 Einträge pro Startpaket.");
    }
    const result = await importSeedBatch(
      media,
      cleanIndices,
      Math.max(0, Math.round(offset)),
      Math.min(10, Math.max(1, Math.round(limit))),
    );
    if (result.added > 0) refresh();
    return { ok: true as const, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function removeStarterDataAction(
  media?: MediaType,
  indices?: number[],
): Promise<ActionResult<{ count: number }>> {
  try {
    if (media !== undefined && media !== "movie" && media !== "serie") {
      throw new Error("Ungültiges Startpaket.");
    }
    const cleanIndices = Array.isArray(indices)
      ? [...new Set(indices.map((value) => Math.round(Number(value))))].filter(
          (value) => Number.isFinite(value) && value >= 0,
        )
      : [];
    if (cleanIndices.length > 500) {
      throw new Error("Maximal 500 Einträge pro Startpaket.");
    }
    const count = removeStarterData(
      media,
      indices === undefined ? undefined : cleanIndices,
    );
    refresh();
    return { ok: true, data: { count } };
  } catch (error) {
    return fail(error);
  }
}

export async function resetDatabaseAction(options?: {
  includeSettings?: boolean;
}): Promise<ActionResult<{ movies: number; lists: number }>> {
  try {
    const data = resetArchive({
      includeSettings: Boolean(options?.includeSettings),
    });
    refresh();
    return { ok: true, data };
  } catch (error) {
    return fail(error);
  }
}

export async function restoreBackupAction(
  raw: string | Record<string, unknown>,
): Promise<ActionResult<RestoreSummary>> {
  try {
    const size = typeof raw === "string" ? raw.length : JSON.stringify(raw).length;
    if (size > 18_000_000) throw new Error("Die Backup-Datei ist zu groß.");
    const summary = restoreBackup(raw);
    refresh();
    return { ok: true, data: summary };
  } catch (error) {
    return fail(error);
  }
}

export async function saveWeightsAction(
  weights: ScoreWeights,
): Promise<ActionResult<ScoreWeights>> {
  try {
    const clean: ScoreWeights = {
      critics: clampWeight(weights.critics),
      audience: clampWeight(weights.audience),
      boxoffice: clampWeight(weights.boxoffice),
      popularity: clampWeight(weights.popularity),
      renown: clampWeight(weights.renown),
    };
    const total =
      clean.critics + clean.audience + clean.boxoffice + clean.popularity + clean.renown;
    if (total <= 0) throw new Error("Mindestens eine Gewichtung muss über 0 liegen.");
    saveWeights(clean);
    recomputeAllScores();
    refresh();
    return { ok: true, data: clean };
  } catch (error) {
    return fail(error);
  }
}

function clampWeight(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, Math.round(num)));
}

export async function saveTmdbKeyAction(
  key: string | null,
): Promise<ActionResult<{ source: string }>> {
  try {
    if (key === null) {
      setSetting("tmdb_api_key", "");
      return { ok: true, data: { source: "none" } };
    }
    const trimmed = key.trim();
    if (trimmed) await testTmdbCredentials(trimmed);
    setSetting("tmdb_api_key", trimmed);
    return { ok: true, data: { source: trimmed ? "db" : "none" } };
  } catch (error) {
    return fail(error);
  }
}

export async function testTmdbKeyAction(key: string): Promise<ActionResult> {
  try {
    await testTmdbCredentials(key);
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function recomputeScoresAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const count = recomputeAllScores();
    refresh();
    return { ok: true, data: { count } };
  } catch (error) {
    return fail(error);
  }
}

export async function loadDemoDataAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const count = seedDemoData();
    refresh();
    return { ok: true, data: { count } };
  } catch (error) {
    return fail(error);
  }
}

export async function removeDemoDataAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const count = removeDemoData();
    refresh();
    return { ok: true, data: { count } };
  } catch (error) {
    return fail(error);
  }
}

/* ---------------------------------- lists --------------------------------- */

export async function createListAction(
  name: string,
  description?: string | null,
): Promise<ActionResult<{ id: number }>> {
  try {
    const id = createList(name, description);
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return fail(error);
  }
}

export async function createListWithMovieAction(
  name: string,
  movieId: number,
): Promise<ActionResult<{ id: number }>> {
  try {
    const id = createList(name);
    addMovieToList(id, movieId);
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateListAction(
  id: number,
  patch: { name?: string; description?: string | null },
): Promise<ActionResult> {
  try {
    if (!Number.isFinite(id)) throw new Error("Ungültige Liste.");
    updateList(id, patch);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteListAction(id: number): Promise<ActionResult> {
  try {
    if (!Number.isFinite(id)) throw new Error("Ungültige Liste.");
    deleteList(id);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function getMovieListMembershipsAction(
  movieId: number,
): Promise<ActionResult<{ lists: MovieListMembership[] }>> {
  try {
    if (!Number.isFinite(movieId)) throw new Error("Ungültiger Titel.");
    return { ok: true, data: { lists: getListsForMovie(movieId) } };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleListMembershipAction(
  listId: number,
  movieId: number,
  included: boolean,
): Promise<ActionResult> {
  try {
    if (!Number.isFinite(listId) || !Number.isFinite(movieId)) {
      throw new Error("Ungültige Auswahl.");
    }
    if (included) addMovieToList(listId, movieId);
    else removeMovieFromList(listId, movieId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function moveListItemAction(
  listId: number,
  movieId: number,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    if (!Number.isFinite(listId) || !Number.isFinite(movieId)) {
      throw new Error("Ungültige Auswahl.");
    }
    moveListItem(listId, movieId, direction);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function removeMovieFromListAction(
  listId: number,
  movieId: number,
): Promise<ActionResult> {
  try {
    if (!Number.isFinite(listId) || !Number.isFinite(movieId)) {
      throw new Error("Ungültige Auswahl.");
    }
    removeMovieFromList(listId, movieId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function searchListCandidatesAction(
  listId: number,
  query: string,
): Promise<ActionResult<{ candidates: ListSearchCandidate[] }>> {
  try {
    if (!getListDetail(listId)) throw new Error("Liste nicht gefunden.");
    const trimmed = query.trim();
    if (!trimmed) return { ok: true, data: { candidates: [] } };

    const archive = searchArchiveCandidates(trimmed, 8).map((candidate) => ({
      ...candidate,
      inList: candidate.movieId
        ? isMovieInList(listId, candidate.movieId)
        : false,
    }));

    const remote: ListSearchCandidate[] = [];
    if (trimmed.length >= 2 && hasTmdbCredentials()) {
      try {
        const locale = await getLocale();
        const [movieResults, serieResults] = await Promise.all([
          searchTmdb(trimmed, "movie", locale).catch(() => []),
          searchTmdb(trimmed, "serie", locale).catch(() => []),
        ]);
        const results = [...movieResults, ...serieResults];
        for (const result of results) {
          const movieId = result.existingId;
          remote.push({
            key: movieId
              ? `db-${movieId}`
              : `tmdb-${result.mediaType}-${result.tmdbId}`,
            movieId,
            tmdbId: result.tmdbId,
            mediaType: result.mediaType,
            title: result.title,
            originalTitle: result.originalTitle,
            year: result.year,
            posterPath: result.posterPath,
            rating: result.rating,
            inList: movieId ? isMovieInList(listId, movieId) : false,
            inArchive: Boolean(movieId),
          });
        }
      } catch (error) {
        if (archive.length === 0) throw error;
      }
    }

    const seenKeys = new Set(archive.map((candidate) => candidate.key));
    const seenTmdb = new Set(
      archive
        .filter((candidate) => candidate.tmdbId !== null)
        .map((candidate) => `${candidate.mediaType}:${candidate.tmdbId}`),
    );
    const merged = [...archive];
    for (const candidate of remote) {
      if (seenKeys.has(candidate.key)) continue;
      const tmdbKey = `${candidate.mediaType}:${candidate.tmdbId}`;
      if (candidate.tmdbId && seenTmdb.has(tmdbKey)) continue;
      merged.push(candidate);
      seenKeys.add(candidate.key);
      if (candidate.tmdbId) seenTmdb.add(tmdbKey);
    }

    return { ok: true, data: { candidates: merged.slice(0, 14) } };
  } catch (error) {
    return fail(error);
  }
}

export async function addListCandidateAction(
  listId: number,
  candidate: {
    movieId?: number | null;
    tmdbId?: number | null;
    mediaType?: MediaType | null;
  },
): Promise<ActionResult<{ movieId: number; slug: string | null; added: boolean }>> {
  try {
    if (!Number.isFinite(listId)) throw new Error("Ungültige Liste.");
    let movieId =
      candidate?.movieId && Number.isFinite(candidate.movieId)
        ? Math.round(candidate.movieId)
        : null;
    if (!movieId) {
      const tmdbId =
        candidate?.tmdbId && Number.isFinite(candidate.tmdbId)
          ? Math.round(candidate.tmdbId)
          : null;
      if (!tmdbId) throw new Error("Titel oder TMDB-ID fehlt.");
      const media: MediaType =
        candidate?.mediaType === "serie" ? "serie" : "movie";
      const imported = await addMovieFromTmdb(tmdbId, media);
      movieId = imported.id;
    }
    const added = addMovieToList(listId, movieId);
    const movie = getMovieById(movieId);
    refresh();
    return {
      ok: true,
      data: { movieId, slug: movie?.slug ?? null, added },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function addMovieFromTmdbAction(
  tmdbId: number,
  media: MediaType = "movie",
): Promise<
  ActionResult<{ id: number; slug: string; title: string; added: boolean }>
> {
  try {
    const clean = Math.round(Number(tmdbId));
    if (!Number.isFinite(clean) || clean <= 0) {
      throw new Error("Ungültige TMDB-ID.");
    }
    const result = await addMovieFromTmdb(clean, media);
    const movie = getMovieById(result.id);
    refresh();
    return {
      ok: true,
      data: {
        id: result.id,
        slug: movie?.slug ?? "",
        title: movie?.titleDe ?? "",
        added: result.added,
      },
    };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------ TMDB matching ----------------------------- */

export async function matchTmdbBatchAction(
  rows: ImportMatchInput[],
  offset = 0,
  limit = 6,
  media: MediaType = "movie",
) {
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Keine Zeilen für den Abgleich.");
    }
    if (rows.length > 500) throw new Error("Maximal 500 Zeilen pro Abgleich.");
    const data = await matchTmdbBatch(rows, Math.max(0, offset), limit, media);
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function matchTmdbRowAction(
  row: ImportMatchInput,
  media: MediaType = "movie",
) {
  try {
    const data = await matchTmdbRow(row, media);
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function searchTmdbMatchAction(
  query: string,
  media: MediaType = "movie",
) {
  try {
    const data = await searchTmdbCandidates(query, media);
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function commitTmdbImportAction(
  choices: TmdbImportChoice[],
  offset = 0,
  limit = 4,
) {
  try {
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error("Keine Titel zum Übernehmen ausgewählt.");
    }
    const clean = choices
      .filter(
        (choice) =>
          Number.isFinite(Number(choice.tmdbId)) && Number(choice.tmdbId) > 0,
      )
      .map((choice) => ({
        index: Number(choice.index) || 0,
        tmdbId: Math.round(Number(choice.tmdbId)),
        mediaType: (choice.mediaType === "serie" ? "serie" : "movie") as MediaType,
        inputTitle: String(choice.inputTitle ?? "").slice(0, 200),
        listId:
          Number.isFinite(Number(choice.listId)) && Number(choice.listId) > 0
            ? Math.round(Number(choice.listId))
            : null,
      }));
    if (clean.length === 0) throw new Error("Keine gültigen TMDB-IDs ausgewählt.");
    const unique = [
      ...new Map(
        clean.map((choice) => [`${choice.mediaType}:${choice.tmdbId}`, choice]),
      ).values(),
    ];
    const data = await importTmdbChoicesBatch(unique, Math.max(0, offset), limit);
    if (data.done && data.added + data.updated > 0) refresh();
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------- English content backfill ---------------------- */

export async function backfillEnglishContentAction(limit = 5) {
  try {
    if (!hasTmdbCredentials()) {
      throw new Error("Für die englischen Texte wird ein TMDB-API-Key benötigt.");
    }
    const data = await backfillEnglishContent(
      Math.min(10, Math.max(1, Math.round(limit))),
    );
    if (data.updated > 0) refresh();
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function backfillEnglishEpisodesAction(limit = 3) {
  try {
    if (!hasTmdbCredentials()) {
      throw new Error("Für die englischen Folgentexte wird ein TMDB-API-Key benötigt.");
    }
    const data = await backfillEnglishEpisodes(
      Math.min(6, Math.max(1, Math.round(limit))),
    );
    if (data.updated > 0) refresh();
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------ media cache ------------------------------ */

function normalizeMediaMode(mode: unknown): MediaCacheMode {
  return mode === "all" ? "all" : "missing";
}export async function mediaStatsAction() {
  try {
    return { ok: true as const, data: getMediaStats() };
  } catch (error) {
    return fail(error);
  }
}

export async function cacheMovieMediaBatchAction(
  offset = 0,
  limit = 6,
  mode: MediaCacheMode = "missing",
) {
  try {
    const data = await cacheMovieMediaBatch({
      offset: Math.max(0, Math.round(offset)),
      limit: Math.min(20, Math.max(1, Math.round(limit))),
      mode: normalizeMediaMode(mode),
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function cacheEpisodeStillsBatchAction(
  offset = 0,
  limit = 10,
  mode: MediaCacheMode = "missing",
) {
  try {
    const data = await cacheEpisodeStillsBatch({
      offset: Math.max(0, Math.round(offset)),
      limit: Math.min(30, Math.max(1, Math.round(limit))),
      mode: normalizeMediaMode(mode),
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function clearMediaCacheAction() {
  try {
    const data = clearMediaCache();
    refresh();
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------- database snapshots -------------------------- */

export async function compareSnapshotsAction() {
  try {
    return { ok: true as const, data: compareSnapshots() };
  } catch (error) {
    return fail(error);
  }
}

