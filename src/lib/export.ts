import { getListsForMovie } from "./lists";
import {
  contentGenres,
  contentOriginalTitle,
  contentOverview,
  contentTagline,
  contentTitle,
} from "./content";
import {
  EXPORT_FIELDS,
  exportLabel,
  parseExportFields,
  type ExportFieldKey,
} from "./export-fields";
import {
  formatDate,
  formatInt,
  formatMoneyUsd,
  formatRuntime,
  formatScore,
  formatYear,
  formatYearRange,
  tmdbImage,
} from "./format";
import { tr, type Locale } from "./locale";
import { getMoviesForExport, getSeriesStates } from "./movies";
import type { MediaType, Movie, SeriesStateSummary } from "./types";

export type ExportFilters = {
  media?: MediaType | "all";
  seen?: "all" | "seen" | "unseen";
  listId?: number;
  q?: string;
  genre?: string;
  year?: number;
};

export type ExportRequest = ExportFilters & {
  locale: Locale;
  fields?: string[] | string;
};

export type ExportColumn = { key: ExportFieldKey; label: string };

export type ExportData = {
  columns: ExportColumn[];
  rows: string[][];
  records: Record<string, string>[];
  count: number;
};

const FIELD_BY_KEY = new Map(EXPORT_FIELDS.map((field) => [field.key, field]));

const WATCH_STATE: Record<string, { de: string; en: string }> = {
  none: { de: "Ungesehen", en: "Unwatched" },
  watching: { de: "Am Schauen", en: "Watching" },
  watched: { de: "Gesehen", en: "Watched" },
  rewatching: { de: "Rewatch", en: "Rewatch" },
};

function seriesStatusLabel(status: string | null, locale: Locale): string {
  if (!status) return "";
  const value = status.toLowerCase();
  if (value.includes("cancel") || value.includes("abgesetzt")) {
    return tr(locale, "Abgesetzt", "Canceled");
  }
  if (
    value.includes("returning") ||
    value.includes("continuing") ||
    value.includes("ongoing") ||
    value.includes("fortlaufend")
  ) {
    return tr(locale, "Läuft", "Running");
  }
  if (
    value.includes("ended") ||
    value.includes("beendet") ||
    value.includes("abgeschlossen")
  ) {
    return tr(locale, "Beendet", "Ended");
  }
  if (value.includes("production")) {
    return tr(locale, "In Produktion", "In production");
  }
  if (value.includes("planned") || value.includes("geplant")) {
    return tr(locale, "Geplant", "Planned");
  }
  return status;
}

function nextEpisodeLabel(
  summary: SeriesStateSummary | undefined,
  locale: Locale,
): string {
  const next = summary?.nextEpisode;
  if (!next) return "";
  const code = `S${String(next.seasonNumber).padStart(2, "0")}E${String(
    next.episodeNumber,
  ).padStart(2, "0")}`;
  const title =
    locale === "en" && next.titleEn?.trim() ? next.titleEn : next.title;
  return `${code} · ${title}`;
}

function fieldValue(
  key: ExportFieldKey,
  movie: Movie,
  locale: Locale,
  summary: SeriesStateSummary | undefined,
  lists: string[],
): string {
  const isSerie = movie.mediaType === "serie";
  switch (key) {
    case "title":
      return contentTitle(movie, locale);
    case "originalTitle":
      return contentOriginalTitle(movie, locale) ?? "";
    case "titleDe":
      return movie.titleDe;
    case "titleEn":
      return movie.titleEn ?? "";
    case "year":
      return isSerie
        ? formatYearRange(movie.year, movie.endYear)
        : formatYear(movie.year);
    case "releaseDate":
      return formatDate(movie.releaseDate, locale);
    case "mediaType":
      return isSerie ? tr(locale, "Serie", "Series") : tr(locale, "Film", "Film");
    case "genres":
      return contentGenres(movie, locale).join(", ");
    case "runtime":
      return formatRuntime(movie.runtime, locale);
    case "seasons":
      return movie.seasons ? formatInt(movie.seasons, locale) : "";
    case "episodes":
      return movie.episodes ? formatInt(movie.episodes, locale) : "";
    case "score":
      return formatScore(movie.totalScore, 1, locale);
    case "myRating":
      return movie.myRating ? formatScore(movie.myRating, 1, locale) : "";
    case "seen":
      return movie.seen
        ? tr(locale, "Ja", "Yes")
        : tr(locale, "Nein", "No");
    case "favorite":
      return movie.favorite
        ? tr(locale, "Ja", "Yes")
        : tr(locale, "Nein", "No");
    case "watchState": {
      if (!isSerie) {
        return movie.seen
          ? tr(locale, "Gesehen", "Seen")
          : tr(locale, "Ungesehen", "Unwatched");
      }
      const state = summary?.state ?? "none";
      return tr(locale, WATCH_STATE[state].de, WATCH_STATE[state].en);
    }
    case "seriesStatus":
      return seriesStatusLabel(movie.seriesStatus, locale);
    case "nextEpisode":
      return nextEpisodeLabel(summary, locale);
    case "director":
      return movie.director ?? "";
    case "cast":
      return movie.cast.join(", ");
    case "country":
      return movie.country ?? "";
    case "ageRating":
      return movie.ageRating ?? "";
    case "overview":
      return contentOverview(movie, locale) ?? "";
    case "tagline":
      return contentTagline(movie, locale) ?? "";
    case "posterUrl":
      return tmdbImage(movie.posterPath, "w500") ?? "";
    case "backdropUrl":
      return tmdbImage(movie.backdropPath, "w1280") ?? "";
    case "imdbRating":
      return movie.imdbRating ? formatScore(movie.imdbRating, 1, locale) : "";
    case "rtRating":
      return movie.rtRating ? `${movie.rtRating} %` : "";
    case "metacritic":
      return movie.metacritic ? String(movie.metacritic) : "";
    case "tmdbRating":
      return movie.tmdbRating ? formatScore(movie.tmdbRating, 1, locale) : "";
    case "boxOffice":
      return formatMoneyUsd(movie.boxOffice, locale);
    case "budget":
      return formatMoneyUsd(movie.budget, locale);
    case "popularity":
      return movie.popularity ? formatInt(movie.popularity, locale) : "";
    case "oscars": {
      const parts: string[] = [];
      if (movie.oscarWins > 0) {
        parts.push(
          tr(
            locale,
            `${movie.oscarWins} ${movie.oscarWins === 1 ? "Sieg" : "Siege"}`,
            `${movie.oscarWins} ${movie.oscarWins === 1 ? "win" : "wins"}`,
          ),
        );
      }
      if (movie.oscarNominations > 0) {
        parts.push(
          tr(
            locale,
            `${movie.oscarNominations} Nominierungen`,
            `${movie.oscarNominations} nominations`,
          ),
        );
      }
      return parts.join(" · ");
    }
    case "awards":
      return movie.awards ?? "";
    case "lists":
      return lists.join(", ");
    case "addedAt":
      return formatDate(movie.createdAt?.slice(0, 10), locale);
    case "watchedAt":
      return movie.watchedAt ? formatDate(movie.watchedAt, locale) : "";
    case "note":
      return movie.myNote ?? "";
    case "tmdbId":
      return movie.tmdbId ? String(movie.tmdbId) : "";
    default:
      return "";
  }
}

export function buildExportData(request: ExportRequest): ExportData {
  const fields = parseExportFields(
    Array.isArray(request.fields) ? request.fields.join(",") : request.fields,
  );
  const columns: ExportColumn[] = fields.map((key) => {
    const field = FIELD_BY_KEY.get(key);
    return {
      key,
      label: field ? exportLabel(field, request.locale) : key,
    };
  });

  const movies = getMoviesForExport({
    media: request.media ?? "all",
    seen: request.seen ?? "all",
    listId: request.listId,
    q: request.q,
    genre: request.genre,
    year: request.year,
  });

  const summaries = getSeriesStates(
    movies.filter((movie) => movie.mediaType === "serie").map((movie) => movie.id),
  );

  const records: Record<string, string>[] = [];
  const rows: string[][] = [];
  for (const movie of movies) {
    const summary = summaries.get(movie.id);
    const lists = getListsForMovie(movie.id)
      .filter((list) => list.contains)
      .map((list) => list.name);
    const record: Record<string, string> = {};
    const row = fields.map((key) => {
      const value = fieldValue(key, movie, request.locale, summary, lists);
      record[key] = value;
      return value;
    });
    records.push(record);
    rows.push(row);
  }

  return { columns, rows, records, count: movies.length };
}
