import type { Locale } from "./locale";
import type { MediaType } from "./types";

type TmdbGenre = { id: number; name: string; en: string };

/** TMDB genre IDs with German and English labels used across Filmgold. */
export const TMDB_GENRES: readonly TmdbGenre[] = [
  { id: 28, name: "Action", en: "Action" },
  { id: 12, name: "Abenteuer", en: "Adventure" },
  { id: 16, name: "Animation", en: "Animation" },
  { id: 35, name: "Komödie", en: "Comedy" },
  { id: 80, name: "Krimi", en: "Crime" },
  { id: 99, name: "Dokumentarfilm", en: "Documentary" },
  { id: 18, name: "Drama", en: "Drama" },
  { id: 10751, name: "Familie", en: "Family" },
  { id: 14, name: "Fantasy", en: "Fantasy" },
  { id: 36, name: "Historie", en: "History" },
  { id: 27, name: "Horror", en: "Horror" },
  { id: 10402, name: "Musik", en: "Music" },
  { id: 9648, name: "Mystery", en: "Mystery" },
  { id: 10749, name: "Liebesfilm", en: "Romance" },
  { id: 878, name: "Science Fiction", en: "Science Fiction" },
  { id: 10770, name: "TV-Film", en: "TV Movie" },
  { id: 53, name: "Thriller", en: "Thriller" },
  { id: 10752, name: "Kriegsfilm", en: "War" },
  { id: 37, name: "Western", en: "Western" },
];

/** TV uses its own genre IDs at TMDB. */
export const TMDB_TV_GENRES: readonly TmdbGenre[] = [
  { id: 10759, name: "Action & Abenteuer", en: "Action & Adventure" },
  { id: 16, name: "Animation", en: "Animation" },
  { id: 35, name: "Komödie", en: "Comedy" },
  { id: 80, name: "Krimi", en: "Crime" },
  { id: 99, name: "Dokumentarfilm", en: "Documentary" },
  { id: 18, name: "Drama", en: "Drama" },
  { id: 10751, name: "Familie", en: "Family" },
  { id: 10762, name: "Kinder", en: "Kids" },
  { id: 9648, name: "Mystery", en: "Mystery" },
  { id: 10763, name: "Nachrichten", en: "News" },
  { id: 10764, name: "Reality", en: "Reality" },
  { id: 10765, name: "Sci-Fi & Fantasy", en: "Sci-Fi & Fantasy" },
  { id: 10766, name: "Seifenoper", en: "Soap" },
  { id: 10767, name: "Talkshow", en: "Talk" },
  { id: 10768, name: "Krieg & Politik", en: "War & Politics" },
  { id: 37, name: "Western", en: "Western" },
];

type Genre = { id: number; name: string };

function namesMap(genres: readonly TmdbGenre[], locale: Locale) {
  return new Map<number, string>(
    genres.map((genre) => [genre.id, locale === "en" ? genre.en : genre.name]),
  );
}

export function tmdbGenresFor(
  media: MediaType = "movie",
  locale: Locale = "de",
): readonly Genre[] {
  const genres = media === "serie" ? TMDB_TV_GENRES : TMDB_GENRES;
  return genres.map((genre) => ({
    id: genre.id,
    name: locale === "en" ? genre.en : genre.name,
  }));
}

export function tmdbGenreName(
  id: number,
  media: MediaType = "movie",
  locale: Locale = "de",
): string | null {
  return namesMap(media === "serie" ? TMDB_TV_GENRES : TMDB_GENRES, locale).get(id) ?? null;
}

export function tmdbGenreNames(
  ids: number[],
  media: MediaType = "movie",
  locale: Locale = "de",
): string[] {
  const selected = new Set(ids);
  return tmdbGenresFor(media, locale)
    .filter((genre) => selected.has(genre.id))
    .map((genre) => genre.name);
}

export function isTmdbGenreId(value: number, media: MediaType = "movie"): boolean {
  const genres = media === "serie" ? TMDB_TV_GENRES : TMDB_GENRES;
  return genres.some((genre) => genre.id === value);
}
