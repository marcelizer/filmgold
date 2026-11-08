import type { Locale } from "./locale";
import type { Episode } from "./types";

/**
 * Internal genres stay German (they are the archive's canonical keys and are
 * used by filters/links). Only the label is translated for display.
 */
const GENRE_LABELS_EN: Record<string, string> = {
  Action: "Action",
  Abenteuer: "Adventure",
  Animation: "Animation",
  Komödie: "Comedy",
  Krimi: "Crime",
  Dokumentarfilm: "Documentary",
  Drama: "Drama",
  Familie: "Family",
  Fantasy: "Fantasy",
  Historie: "History",
  Horror: "Horror",
  Musik: "Music",
  Mystery: "Mystery",
  Liebesfilm: "Romance",
  "Science Fiction": "Science Fiction",
  "TV-Film": "TV Movie",
  Thriller: "Thriller",
  Kriegsfilm: "War",
  Western: "Western",
  "Action & Abenteuer": "Action & Adventure",
  Kinder: "Kids",
  Nachrichten: "News",
  Reality: "Reality",
  "Sci-Fi & Fantasy": "Sci-Fi & Fantasy",
  Seifenoper: "Soap",
  Talkshow: "Talk",
  "Krieg & Politik": "War & Politics",
};

export function genreLabel(genre: string, locale: Locale): string {
  if (locale !== "en") return genre;
  return GENRE_LABELS_EN[genre] ?? genre;
}

/** Canonical (German) genre value for a translated label. */
export function genreValue(label: string, locale: Locale): string {
  if (locale !== "en") return label;
  const entry = Object.entries(GENRE_LABELS_EN).find(
    ([, translated]) => translated.toLowerCase() === label.toLowerCase(),
  );
  return entry?.[0] ?? label;
}

type TitleSource = { titleDe: string; titleEn?: string | null };

export function contentTitle(movie: TitleSource, locale: Locale): string {
  if (locale === "en" && movie.titleEn?.trim()) return movie.titleEn.trim();
  return movie.titleDe;
}

export function contentOriginalTitle(
  movie: {
    titleDe: string;
    titleEn?: string | null;
    titleOriginal?: string | null;
  },
  locale: Locale,
): string | null {
  const title = contentTitle(movie, locale);
  const original = movie.titleOriginal?.trim();
  if (!original || original.toLowerCase() === title.toLowerCase()) return null;
  return original;
}

type TextSource = {
  overviewDe?: string | null;
  overviewEn?: string | null;
  taglineDe?: string | null;
  taglineEn?: string | null;
};

export function contentOverview(movie: TextSource, locale: Locale): string | null {
  if (locale === "en") return movie.overviewEn?.trim() || movie.overviewDe || null;
  return movie.overviewDe ?? null;
}

export function contentTagline(movie: TextSource, locale: Locale): string | null {
  if (locale === "en") return movie.taglineEn?.trim() || movie.taglineDe || null;
  return movie.taglineDe ?? null;
}

export function contentGenres(
  movie: { genres?: string[] },
  locale: Locale,
): string[] {
  return (movie.genres ?? []).map((genre) => genreLabel(genre, locale));
}

type EpisodeText = Pick<Episode, "title" | "titleEn" | "overview" | "overviewEn">;

export function episodeTitle(episode: EpisodeText, locale: Locale): string {
  if (locale === "en" && episode.titleEn?.trim()) return episode.titleEn.trim();
  return episode.title;
}

export function episodeOverview(
  episode: EpisodeText,
  locale: Locale,
): string | null {
  if (locale === "en") return episode.overviewEn?.trim() || episode.overview;
  return episode.overview;
}
