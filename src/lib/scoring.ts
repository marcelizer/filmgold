import type { Locale } from "./locale";
import type { ScoreWeights } from "./types";

export const DEFAULT_WEIGHTS: ScoreWeights = {
  critics: 35,
  audience: 30,
  boxoffice: 15,
  popularity: 10,
  renown: 10,
};

export type ScoreInput = {
  rtRating: number | null;
  metacritic: number | null;
  imdbRating: number | null;
  tmdbRating: number | null;
  imdbVotes: number | null;
  tmdbVotes: number | null;
  boxOffice: number | null;
  popularity: number | null;
};

export type ScoreMaxima = {
  maxBoxOffice: number;
  maxPopularity: number;
  maxVotes: number;
};

export type ComputedScores = {
  criticsScore: number | null;
  audienceScore: number | null;
  boxofficeScore: number | null;
  popularityScore: number | null;
  renownScore: number | null;
  totalScore: number;
};

const clamp = (value: number) => Math.min(100, Math.max(0, value));

function logScale(value: number | null, max: number): number | null {
  if (!value || value <= 0 || !max || max <= 0) return null;
  return clamp((Math.log10(1 + value) / Math.log10(1 + max)) * 100);
}

function weighted(values: { value: number | null; weight: number }[]) {
  let total = 0;
  let used = 0;
  for (const item of values) {
    if (item.value === null || Number.isNaN(item.value)) continue;
    total += item.value * item.weight;
    used += item.weight;
  }
  return used > 0 ? total / used : null;
}

export function votesFor(input: Pick<ScoreInput, "imdbVotes" | "tmdbVotes">) {
  if (input.imdbVotes && input.imdbVotes > 0) return input.imdbVotes;
  if (input.tmdbVotes && input.tmdbVotes > 0) return input.tmdbVotes * 100;
  return null;
}

export function computeScores(
  input: ScoreInput,
  maxima: ScoreMaxima,
  weights: ScoreWeights,
): ComputedScores {
  const criticParts = [input.rtRating, input.metacritic].filter(
    (value): value is number => typeof value === "number" && !Number.isNaN(value),
  );
  const criticsScore =
    criticParts.length > 0
      ? Math.round((criticParts.reduce((a, b) => a + b, 0) / criticParts.length) * 10) / 10
      : null;

  const audienceScore = weighted([
    {
      value: input.imdbRating ? input.imdbRating * 10 : null,
      weight: 0.65,
    },
    {
      value: input.tmdbRating ? input.tmdbRating * 10 : null,
      weight: 0.35,
    },
  ]);

  const boxofficeScore = logScale(input.boxOffice, maxima.maxBoxOffice);
  const popularityScore = logScale(input.popularity, maxima.maxPopularity);
  const renownScore = logScale(votesFor(input), maxima.maxVotes);

  const total = weighted([
    { value: criticsScore, weight: weights.critics },
    { value: audienceScore, weight: weights.audience },
    { value: boxofficeScore, weight: weights.boxoffice },
    { value: popularityScore, weight: weights.popularity },
    { value: renownScore, weight: weights.renown },
  ]);

  return {
    criticsScore: round(criticsScore),
    audienceScore: round(audienceScore),
    boxofficeScore: round(boxofficeScore),
    popularityScore: round(popularityScore),
    renownScore: round(renownScore),
    totalScore: round(total) ?? 0,
  };
}

function round(value: number | null) {
  if (value === null) return null;
  return Math.round(value * 10) / 10;
}

export const SCORE_LABELS: Record<keyof ScoreWeights, string> = {
  critics: "Kritiker",
  audience: "Publikum",
  boxoffice: "Box Office",
  popularity: "Popularität",
  renown: "Bekanntheit",
};

export function scoreLabels(locale: Locale): Record<keyof ScoreWeights, string> {
  if (locale === "en") {
    return {
      critics: "Critics",
      audience: "Audience",
      boxoffice: "Box office",
      popularity: "Popularity",
      renown: "Renown",
    };
  }
  return SCORE_LABELS;
}

export function scoreDescriptions(
  locale: Locale,
): Record<keyof ScoreWeights, string> {
  if (locale === "en") {
    return {
      critics:
        "Average of Rotten Tomatoes and Metacritic. If one source is missing, the other counts alone.",
      audience:
        "Audience rating from IMDb (65 %) and TMDB (35 %). If one source is missing, the other is weighted more heavily.",
      boxoffice:
        "Worldwide box office in US dollars, log-scaled – so a single mega-hit does not dominate the list.",
      popularity:
        "Current TMDB popularity, log-scaled. Shows which films people still look for today.",
      renown:
        "Number of ratings as a measure of renown. IMDb votes, or TMDB votes × 100 as a fallback.",
    };
  }
  return SCORE_DESCRIPTIONS;
}

export const SCORE_DESCRIPTIONS: Record<keyof ScoreWeights, string> = {
  critics:
    "Durchschnitt aus Rotten-Tomatoes- und Metacritic-Wertung. Fehlt eine Quelle, zählt die andere.",
  audience:
    "Publikumsurteil aus IMDb (65 %) und TMDB (35 %). Fehlt eine Quelle, wird die andere stärker gewichtet.",
  boxoffice:
    "Weltweites Einspielergebnis in US-Dollar, logarithmisch skaliert – damit ein Megahit die Liste nicht dominiert.",
  popularity:
    "Aktuelle TMDB-Popularität, logarithmisch skaliert. Zeigt, welche Filme heute noch gesucht werden.",
  renown:
    "Anzahl der Bewertungen als Maß für Bekanntheit. IMDb-Stimmen, ersatzweise TMDB-Stimmen × 100.",
};
