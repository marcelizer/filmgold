"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { tmdbGenresFor } from "@/lib/tmdb-genres";
import type { MediaType } from "@/lib/types";

export type DiscoverFilterState = {
  media: MediaType;
  q: string;
  genreIds: number[];
  genreMode: "and" | "or";
  year: string;
  decade: string;
  minRating: string;
  minVotes: string;
  language: string;
  sort: string;
  size?: string;
  view?: string;
};

const SORT_OPTIONS = [
  { value: "rating_desc", de: "Beste Bewertung", en: "Best rating" },
  { value: "popularity_desc", de: "Beliebteste", en: "Most popular" },
  { value: "votes_desc", de: "Meiste Stimmen", en: "Most votes" },
  { value: "revenue_desc", de: "Höchstes Einspiel", en: "Highest revenue" },
  { value: "release_desc", de: "Neueste zuerst", en: "Newest first" },
];

const RATING_OPTIONS = [
  { value: "0", de: "Egal", en: "Any" },
  { value: "6", de: "ab 6,0", en: "from 6.0" },
  { value: "6.5", de: "ab 6,5", en: "from 6.5" },
  { value: "7", de: "ab 7,0", en: "from 7.0" },
  { value: "7.5", de: "ab 7,5", en: "from 7.5" },
  { value: "8", de: "ab 8,0", en: "from 8.0" },
  { value: "8.5", de: "ab 8,5", en: "from 8.5" },
  { value: "9", de: "ab 9,0", en: "from 9.0" },
];

const VOTE_OPTIONS = [
  { value: "0", de: "Egal", en: "Any" },
  { value: "100", de: "ab 100", en: "from 100" },
  { value: "300", de: "ab 300", en: "from 300" },
  { value: "500", de: "ab 500", en: "from 500" },
  { value: "1000", de: "ab 1.000", en: "from 1,000" },
  { value: "5000", de: "ab 5.000", en: "from 5,000" },
  { value: "10000", de: "ab 10.000", en: "from 10,000" },
  { value: "25000", de: "ab 25.000", en: "from 25,000" },
];

const LANGUAGE_OPTIONS = [
  { value: "", de: "Alle Sprachen", en: "All languages" },
  { value: "en", de: "Englisch", en: "English" },
  { value: "de", de: "Deutsch", en: "German" },
  { value: "fr", de: "Französisch", en: "French" },
  { value: "es", de: "Spanisch", en: "Spanish" },
  { value: "it", de: "Italienisch", en: "Italian" },
  { value: "ja", de: "Japanisch", en: "Japanese" },
  { value: "ko", de: "Koreanisch", en: "Korean" },
  { value: "zh", de: "Chinesisch", en: "Chinese" },
  { value: "hi", de: "Hindi", en: "Hindi" },
  { value: "ru", de: "Russisch", en: "Russian" },
  { value: "sv", de: "Schwedisch", en: "Swedish" },
  { value: "da", de: "Dänisch", en: "Danish" },
  { value: "no", de: "Norwegisch", en: "Norwegian" },
  { value: "pt", de: "Portugiesisch", en: "Portuguese" },
  { value: "tr", de: "Türkisch", en: "Turkish" },
  { value: "pl", de: "Polnisch", en: "Polish" },
];

const PRESETS = [
  {
    id: "critics",
    de: "Kritikerlieblinge",
    en: "Critics' favourites",
    hintDe: "ab 8,0 · viele Stimmen",
    hintEn: "from 8.0 · many votes",
    query: "?minRating=8&minVotes=5000&sort=rating_desc",
  },
  {
    id: "gems",
    de: "Neue Geheimtipps",
    en: "New hidden gems",
    hintDe: "ab 7,0 · zuletzt erschienen",
    hintEn: "from 7.0 · recently released",
    query: "?minRating=7&minVotes=300&sort=release_desc",
  },
  {
    id: "popular",
    de: "Publikumsmagnete",
    en: "Audience magnets",
    hintDe: "viel Aufmerksamkeit",
    hintEn: "lots of attention",
    query: "?minVotes=2000&sort=popularity_desc",
  },
  {
    id: "hits",
    de: "Große Kinohits",
    en: "Big box-office hits",
    hintDe: "nach Einspiel",
    hintEn: "by revenue",
    query: "?minVotes=1000&sort=revenue_desc",
  },
];

export function DiscoverFilters({
  current,
  years,
  decades,
}: {
  current: DiscoverFilterState;
  years: number[];
  decades: number[];
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(current.q);
  const [genreIds, setGenreIds] = useState<number[]>(current.genreIds);
  const [genreMode, setGenreMode] = useState<"and" | "or">(current.genreMode);
  const [year, setYear] = useState(current.year);
  const [decade, setDecade] = useState(current.decade);
  const [minRating, setMinRating] = useState(current.minRating);
  const [minVotes, setMinVotes] = useState(current.minVotes);
  const [language, setLanguage] = useState(current.language);
  const [sort, setSort] = useState(current.sort);
  const media = current.media;
  const genres = tmdbGenresFor(media, locale);
  const searchMode = current.q.trim().length >= 2;
  const baseSortOptions = SORT_OPTIONS.filter(
    (option) =>
      option.value !== "revenue_desc" || (!searchMode && media !== "serie"),
  );
  const sortOptions = searchMode
    ? [
        { value: "relevance", de: "Relevanz", en: "Relevance" },
        ...baseSortOptions,
      ]
    : baseSortOptions;
  const noun = media === "serie" ? t("Serien", "series") : t("Filme", "films");

  function toggleGenre(id: number) {
    setGenreIds((ids) =>
      ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id],
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (media === "serie") params.set("medium", "serie");
    if (query.trim()) params.set("q", query.trim());
    if (genreIds.length > 0) {
      params.set("genre", genreIds.join(","));
      if (genreIds.length > 1 && genreMode === "or") params.set("genreMode", "or");
    }
    if (year) params.set("year", year);
    else if (decade) params.set("decade", decade);
    if (minVotes !== "1000") params.set("minVotes", minVotes);
    if (minRating && minRating !== "0") params.set("minRating", minRating);
    if (language) params.set("language", language);
    const defaultSort = searchMode ? "relevance" : "rating_desc";
    if (sort && sort !== defaultSort) params.set("sort", sort);
    if (current.size) params.set("size", current.size);
    if (current.view) params.set("view", current.view);
    const queryString = params.toString();
    startTransition(() => {
      router.push(queryString ? `/entdecken?${queryString}` : "/entdecken");
    });
  }

  return (
    <form onSubmit={submit} className="surface-card p-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder={
              media === "serie"
                ? t(
                    "Serientitel suchen – auch außerhalb des Archivs",
                    "Search series titles – also outside the archive",
                  )
                : t(
                    "Filmtitel suchen – auch außerhalb des Archivs",
                    "Search film titles – also outside the archive",
                  )
            }
            aria-label={t(
              `${noun} bei TMDB suchen`,
              `Search ${noun} on TMDB`,
            )}
            className="input-base h-11 pl-9"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary h-11 px-5 text-xs"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Search className="size-3.5" />
          )}
          {t("Titel suchen", "Search titles")}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-gold">
          <SlidersHorizontal className="size-4" />
          <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
            {t("Filter kombinieren", "Combine filters")}
          </p>
        </div>
        <Link
          href={media === "serie" ? "/entdecken?medium=serie" : "/entdecken"}
          className="inline-flex items-center gap-1 text-[11px] text-muted-2 transition-colors hover:text-cream"
        >
          <RotateCcw className="size-3" />
          {t("Zurücksetzen", "Reset")}
        </Link>
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
          {t("Schnellstart", "Quick start")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.filter(
            (preset) => media !== "serie" || preset.query.indexOf("revenue") === -1,
          ).map((preset) => {
            const hits = preset.id === "hits";
            const label =
              media === "serie" && hits
                ? t("Große Serienhits", "Big series hits")
                : t(preset.de, preset.en);
            return (
              <Link
                key={preset.id}
                href={`/entdecken${
                  media === "serie"
                    ? `${preset.query ? `${preset.query}&` : "?"}medium=serie`
                    : preset.query
                }`}
                title={
                  media === "serie" && hits
                    ? t("Große Serienhits", "Big series hits")
                    : t(preset.hintDe, preset.hintEn)
                }
                className="chip transition-colors hover:border-gold/40 hover:text-gold"
              >
                <Sparkles className="size-3 text-gold" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Genres", "Genres")}
          </p>
          {genreIds.length > 1 ? (
            <div className="flex items-center gap-1 rounded-full border border-line p-0.5">
              {(["and", "or"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGenreMode(mode)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition-colors",
                    genreMode === mode
                      ? "bg-gold/15 text-gold"
                      : "text-muted-2 hover:text-cream",
                  )}
                  aria-pressed={genreMode === mode}
                  title={
                    mode === "and"
                      ? t(
                          "Alle gewählten Genres müssen zutreffen",
                          "All selected genres must match",
                        )
                      : t(
                          "Mindestens eines der Genres",
                          "At least one of the genres",
                        )
                  }
                >
                  {mode === "and" ? t("Alle", "All") : t("Oder", "Or")}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {genres.map((genre) => {
            const active = genreIds.includes(genre.id);
            return (
              <button
                key={genre.id}
                type="button"
                onClick={() => toggleGenre(genre.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  active
                    ? "border-gold/45 bg-gold/10 text-gold"
                    : "border-line text-muted hover:border-cream/25 hover:text-cream",
                )}
              >
                {genre.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Jahrzehnt", "Decade")}
          </span>
          <select
            value={decade}
            onChange={(event) => {
              setDecade(event.target.value);
              if (event.target.value) setYear("");
            }}
            className="input-base h-10"
          >
            <option value="">{t("Alle Jahrzehnte", "All decades")}</option>
            {decades.map((entry) => (
              <option key={entry} value={entry}>
                {t(`${entry}er`, `${entry}s`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Einzeljahr", "Single year")}
          </span>
          <select
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              if (event.target.value) setDecade("");
            }}
            className="input-base h-10"
          >
            <option value="">{t("Alle Jahre", "All years")}</option>
            {years.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("TMDB-Bewertung", "TMDB rating")}
          </span>
          <select
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
            className="input-base h-10"
          >
            {RATING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.de, option.en)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Mindestens Stimmen", "Minimum votes")}
          </span>
          <select
            value={minVotes}
            onChange={(event) => setMinVotes(event.target.value)}
            className="input-base h-10"
          >
            {VOTE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.de, option.en)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Originalsprache", "Original language")}
          </span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="input-base h-10"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.de, option.en)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Sortierung", "Sort")}
          </span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="input-base h-10"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.de, option.en)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary h-10 px-5 text-xs"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {t(`${noun} finden`, `Find ${noun}`)}
        </button>
        <p className="text-[11px] leading-relaxed text-muted-2">
          {genreIds.length > 1
            ? genreMode === "and"
              ? t(
                  `${noun} müssen alle gewählten Genres erfüllen.`,
                  `${noun} must match all selected genres.`,
                )
              : t(
                  `${noun} müssen mindestens eines der Genres erfüllen.`,
                  `${noun} must match at least one of the genres.`,
                )
            : t(
                "Kombiniere Genre, Jahr, Bewertung und Stimmen beliebig.",
                "Combine genre, year, rating and votes as you like.",
              )}
        </p>
      </div>
    </form>
  );
}
