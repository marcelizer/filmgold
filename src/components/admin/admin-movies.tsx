"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { deleteMovieAction, saveMovieAction } from "@/app/actions";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { formatYear, tmdbImage } from "@/lib/format";
import { ADMIN_PAGE_SIZES, ALL_PAGE_SIZE } from "@/lib/layout";
import type { MediaType, Movie } from "@/lib/types";
import { Poster } from "@/components/poster";
import { ScoreBadge } from "@/components/score-badge";
import { SeenButton } from "@/components/seen-button";

type FormState = Record<string, string>;

const EMPTY_FORM: FormState = {
  media_type: "movie",
  title_de: "",
  title_original: "",
  year: "",
  end_year: "",
  seasons: "",
  episodes: "",
  series_status: "",
  release_date: "",
  runtime: "",
  director: "",
  country: "",
  original_language: "",
  age_rating: "",
  genres: "",
  cast: "",
  overview_de: "",
  tagline_de: "",
  poster_path: "",
  backdrop_path: "",
  imdb_id: "",
  imdb_rating: "",
  imdb_votes: "",
  rt_rating: "",
  metacritic: "",
  tmdb_rating: "",
  tmdb_votes: "",
  box_office: "",
  budget: "",
  popularity: "",
  oscar_wins: "",
  oscar_nominations: "",
  awards: "",
  tmdb_id: "",
  source: "manual",
};

function movieToForm(movie: Movie): FormState {
  return {
    media_type: movie.mediaType,
    title_de: movie.titleDe,
    title_original: movie.titleOriginal,
    year: movie.year?.toString() ?? "",
    end_year: movie.endYear?.toString() ?? "",
    seasons: movie.seasons?.toString() ?? "",
    episodes: movie.episodes?.toString() ?? "",
    series_status: movie.seriesStatus ?? "",
    release_date: movie.releaseDate ?? "",
    runtime: movie.runtime?.toString() ?? "",
    director: movie.director ?? "",
    country: movie.country ?? "",
    original_language: movie.originalLanguage ?? "",
    age_rating: movie.ageRating ?? "",
    genres: movie.genres.join(", "),
    cast: movie.cast.join(", "),
    overview_de: movie.overviewDe ?? "",
    tagline_de: movie.taglineDe ?? "",
    poster_path: movie.posterPath ?? "",
    backdrop_path: movie.backdropPath ?? "",
    imdb_id: movie.imdbId ?? "",
    imdb_rating: movie.imdbRating?.toString() ?? "",
    imdb_votes: movie.imdbVotes?.toString() ?? "",
    rt_rating: movie.rtRating?.toString() ?? "",
    metacritic: movie.metacritic?.toString() ?? "",
    tmdb_rating: movie.tmdbRating?.toString() ?? "",
    tmdb_votes: movie.tmdbVotes?.toString() ?? "",
    box_office: movie.boxOffice?.toString() ?? "",
    budget: movie.budget?.toString() ?? "",
    popularity: movie.popularity?.toString() ?? "",
    oscar_wins: movie.oscarWins?.toString() ?? "0",
    oscar_nominations: movie.oscarNominations?.toString() ?? "0",
    awards: movie.awards ?? "",
    tmdb_id: movie.tmdbId?.toString() ?? "",
    source: movie.source,
  };
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-2">
        {label}
        {hint ? (
          <span className="normal-case tracking-normal text-[9px]">{hint}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export function AdminMovies({
  movies,
  defaultMedia = "movie",
}: {
  movies: Movie[];
  defaultMedia?: MediaType;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Movie | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(1);
  const [customSize, setCustomSize] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return movies;
    return movies.filter((movie) =>
      [movie.titleDe, movie.titleOriginal, movie.director, String(movie.year ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [movies, query]);

  const perPage =
    pageSize === ALL_PAGE_SIZE ? Math.max(1, filtered.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );

  function applyCustomSize(raw: string) {
    const parsed = Math.round(Number(raw));
    if (!Number.isFinite(parsed) || parsed < 1) return;
    setPageSize(Math.min(1000, parsed));
    setPage(1);
    setCustomSize("");
  }

  useEffect(() => {
    if (!editing) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setEditing(null);
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [editing]);

  function sourceLabel(source: string) {
    if (source === "starter") return t("Startpaket", "starter");
    if (source === "demo") return t("Demo", "demo");
    if (source === "tmdb") return "TMDB";
    if (source === "import") return t("Import", "import");
    if (source === "manual") return t("manuell", "manual");
    return source;
  }

  function openNew() {
    setForm({ ...EMPTY_FORM, media_type: defaultMedia });
    setError(null);
    setEditing("new");
  }

  function openEdit(movie: Movie) {
    setForm(movieToForm(movie));
    setError(null);
    setEditing(movie);
  }

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      if (key === "genres" || key === "cast") {
        payload[key] = value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
      } else if (value.trim() === "") {
        payload[key] = null;
      } else {
        payload[key] = value.trim();
      }
    }
    if (!payload.source) payload.source = "manual";
    return payload;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title_de.trim()) {
      setError(t("Bitte einen deutschen Titel angeben.", "Please enter a title."));
      return;
    }
    setError(null);
    const id = editing === "new" ? null : editing?.id ?? null;
    startTransition(async () => {
      const result = await saveMovieAction(toPayload(), id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(movie: Movie) {
    const confirmed = window.confirm(
      t(
        `„${movie.titleDe}“ wirklich aus dem Archiv löschen?`,
        `Really delete “${movie.titleDe}” from the archive?`,
      ),
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteMovieAction(movie.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const previewPoster = form.poster_path
    ? tmdbImage(form.poster_path, "w342")
    : null;

  return (
    <>
      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft p-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t(
                "Filme & Serien durchsuchen …",
                "Search movies & series …",
              )}
              className="input-base h-9 pl-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-2">
              {filtered.length} {t("von", "of")} {movies.length}
            </span>
            <button
              type="button"
              onClick={openNew}
              className="btn-primary h-9 px-4 text-xs"
            >
              <Plus className="size-3.5" />
              {t("Neuer Eintrag", "New entry")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-white/[0.015] px-4 py-2.5 text-[11px] text-muted-2">
          <label className="inline-flex items-center gap-2">
            <span className="whitespace-nowrap">
              {t("Einträge pro Seite", "Entries per page")}
            </span>
            <select
              value={pageSize === ALL_PAGE_SIZE ? "all" : String(pageSize)}
              onChange={(event) => {
                const value = event.target.value;
                setPageSize(value === "all" ? ALL_PAGE_SIZE : Number(value));
                setPage(1);
              }}
              className="h-8 rounded-full border border-line bg-surface-2/70 pl-2.5 pr-7 text-[11px] text-cream focus:border-gold/50 focus:outline-none"
            >
              {ADMIN_PAGE_SIZES.map((option) => (
                <option key={option} value={String(option)}>
                  {option}
                </option>
              ))}
              {pageSize > 0 &&
              !(ADMIN_PAGE_SIZES as readonly number[]).includes(pageSize) ? (
                <option value={String(pageSize)}>{pageSize}</option>
              ) : null}
              <option value="all">{t("Alle", "All")}</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="whitespace-nowrap">{t("Eigene", "Custom")}</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={customSize}
              onChange={(event) => setCustomSize(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyCustomSize(customSize);
                }
              }}
              onBlur={() => {
                if (customSize.trim()) applyCustomSize(customSize);
              }}
              placeholder={t("z. B. 75", "e.g. 75")}
              className="h-8 w-16 [appearance:textfield] rounded-full border border-line bg-surface-2/70 px-2.5 text-[11px] text-cream placeholder:text-muted-2/60 focus:border-gold/50 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              {t(
                `Seite ${safePage} von ${totalPages}`,
                `Page ${safePage} of ${totalPages}`,
              )}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              className="flex size-7 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-30"
              title={t("Vorherige Seite", "Previous page")}
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              className="flex size-7 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-30"
              title={t("Nächste Seite", "Next page")}
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-line-soft text-[9px] uppercase tracking-[0.14em] text-muted-2">
                <th className="px-4 py-2.5 font-medium">{t("Titel", "Title")}</th>
                <th className="px-3 py-2.5 font-medium">{t("Jahr", "Year")}</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 font-medium">
                  {t("Quelle", "Source")}
                </th>
                <th className="px-3 py-2.5 font-medium">
                  {t("Deine Sicht", "Your view")}
                </th>
                <th className="px-4 py-2.5 text-right font-medium">
                  {t("Aktionen", "Actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((movie) => (
                <tr
                  key={movie.id}
                  className="group border-b border-line-soft/70 text-xs transition-colors last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 shrink-0">
                        <Poster
                          movie={movie}
                          imageSize="w342"
                          sizes="32px"
                          className="rounded-md border-white/5"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium text-cream">
                          <span
                            className={cn(
                              "rounded px-1 py-0.5 text-[8px] uppercase tracking-wider",
                              movie.mediaType === "serie"
                                ? "bg-gold/10 text-gold/80"
                                : "bg-white/[0.06] text-muted-2",
                            )}
                          >
                            {movie.mediaType === "serie"
                              ? t("Serie", "Series")
                              : t("Film", "Movie")}
                          </span>
                          <span className="truncate">{movie.titleDe}</span>
                        </p>
                        <p className="truncate text-[10px] italic text-muted-2">
                          {movie.titleOriginal !== movie.titleDe
                            ? movie.titleOriginal
                            : movie.director ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">
                    {movie.mediaType === "serie"
                      ? movie.endYear && movie.endYear !== movie.year
                        ? `${formatYear(movie.year)}–${movie.endYear}`
                        : formatYear(movie.year)
                      : formatYear(movie.year)}
                  </td>
                  <td className="px-3 py-2.5">
                    <ScoreBadge score={movie.totalScore} locale={locale} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
                        movie.source === "starter"
                          ? "border-gold/25 text-gold/80"
                          : movie.source === "demo"
                            ? "border-gold/25 text-gold/80"
                            : movie.source === "tmdb"
                              ? "border-moss/25 text-moss"
                              : "border-line text-muted-2",
                      )}
                    >
                      {sourceLabel(movie.source)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <SeenButton movieId={movie.id} seen={movie.seen} />
                      {movie.myRating ? (
                        <span className="tabular-nums text-gold">
                          {movie.myRating}/10
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(movie)}
                        className="btn-quiet"
                        title={t("Bearbeiten", "Edit")}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(movie)}
                        disabled={pending}
                        className="btn-quiet hover:text-rust"
                        title={t("Löschen", "Delete")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {t("Kein Titel gefunden.", "No titles found.")}{" "}
            {movies.length === 0
              ? t(
                  "Lege den ersten Film oder die erste Serie an oder importiere Daten.",
                  "Create the first movie or series, or import data.",
                )
              : t("Passe die Suche an.", "Adjust your search.")}
          </p>
        ) : null}
      </div>

      {editing ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <div className="mx-auto my-4 w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line-soft bg-surface/95 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                {previewPoster ? (
                  <div
                    className="aspect-2/3 w-9 rounded border border-white/10 bg-cover bg-center"
                    style={{ backgroundImage: `url(${previewPoster})` }}
                  />
                ) : null}
                <div>
                  <p className="text-sm font-medium text-cream">
                    {editing === "new"
                      ? t("Neuer Eintrag", "New entry")
                      : editing.titleDe}
                  </p>
                  <p className="text-[10px] text-muted-2">
                    {editing === "new"
                      ? t("Manuell anlegen", "Create manually")
                      : `ID ${editing.id} · ${editing.slug}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="btn-quiet"
                aria-label={t("Schließen", "Close")}
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={submit}
              className="max-h-[75vh] space-y-5 overflow-y-auto p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("Medienart", "Media type")}>
                  <select
                    value={form.media_type}
                    onChange={(event) => update("media_type", event.target.value)}
                    className="input-base"
                  >
                    <option value="movie">{t("Film", "Movie")}</option>
                    <option value="serie">{t("Serie", "Series")}</option>
                  </select>
                </Field>
                <Field label={t("Deutscher Titel *", "Title *")}>
                  <input
                    value={form.title_de}
                    onChange={(event) => update("title_de", event.target.value)}
                    className="input-base"
                    required
                  />
                </Field>
                <Field label={t("Originaltitel", "Original title")}>
                  <input
                    value={form.title_original}
                    onChange={(event) =>
                      update("title_original", event.target.value)
                    }
                    className="input-base"
                  />
                </Field>
                <Field
                  label={
                    form.media_type === "serie"
                      ? t("Startjahr", "Start year")
                      : t("Jahr", "Year")
                  }
                >
                  <input
                    value={form.year}
                    onChange={(event) => update("year", event.target.value)}
                    inputMode="numeric"
                    className="input-base"
                  />
                </Field>
                <Field
                  label={
                    form.media_type === "serie"
                      ? t("Folgenlänge", "Episode length")
                      : t("Laufzeit", "Runtime")
                  }
                  hint={t("Minuten", "minutes")}
                >
                  <input
                    value={form.runtime}
                    onChange={(event) => update("runtime", event.target.value)}
                    inputMode="numeric"
                    className="input-base"
                  />
                </Field>
                <Field
                  label={
                    form.media_type === "serie"
                      ? t("Idee / Creator", "Created by")
                      : t("Regie", "Director")
                  }
                >
                  <input
                    value={form.director}
                    onChange={(event) => update("director", event.target.value)}
                    className="input-base"
                  />
                </Field>
                <Field label={t("Land", "Country")}>
                  <input
                    value={form.country}
                    onChange={(event) => update("country", event.target.value)}
                    className="input-base"
                  />
                </Field>
                <Field
                  label={t("Genres", "Genres")}
                  hint={t("durch Komma getrennt", "comma-separated")}
                >
                  <input
                    value={form.genres}
                    onChange={(event) => update("genres", event.target.value)}
                    className="input-base"
                  />
                </Field>
                <Field
                  label={t("Besetzung", "Cast")}
                  hint={t("durch Komma getrennt", "comma-separated")}
                >
                  <input
                    value={form.cast}
                    onChange={(event) => update("cast", event.target.value)}
                    className="input-base"
                  />
                </Field>
                <Field
                  label={t("Poster-Pfad", "Poster path")}
                  hint={t("TMDB oder /pfad", "TMDB or /path")}
                >
                  <input
                    value={form.poster_path}
                    onChange={(event) => update("poster_path", event.target.value)}
                    className="input-base font-mono text-[11px]"
                  />
                </Field>
                <Field label={t("Backdrop-Pfad", "Backdrop path")}>
                  <input
                    value={form.backdrop_path}
                    onChange={(event) =>
                      update("backdrop_path", event.target.value)
                    }
                    className="input-base font-mono text-[11px]"
                  />
                </Field>
                <Field label={t("FSK / Freigabe", "Age rating")}>
                  <input
                    value={form.age_rating}
                    onChange={(event) => update("age_rating", event.target.value)}
                    className="input-base"
                  />
                </Field>
                <Field
                  label={t("Quelle", "Source")}
                  hint={t("manuell / tmdb / import", "manual / tmdb / import")}
                >
                  <input
                    value={form.source}
                    onChange={(event) => update("source", event.target.value)}
                    className="input-base"
                  />
                </Field>
              </div>

              {form.media_type === "serie" ? (
                <fieldset className="rounded-xl border border-line-soft p-4">
                  <legend className="px-1 text-[10px] uppercase tracking-[0.16em] text-gold">
                    {t("Serien-Daten", "Series data")}
                  </legend>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label={t("Endjahr", "End year")}>
                      <input
                        value={form.end_year}
                        onChange={(event) =>
                          update("end_year", event.target.value)
                        }
                        inputMode="numeric"
                        className="input-base"
                      />
                    </Field>
                    <Field label={t("Staffeln", "Seasons")}>
                      <input
                        value={form.seasons}
                        onChange={(event) => update("seasons", event.target.value)}
                        inputMode="numeric"
                        className="input-base"
                      />
                    </Field>
                    <Field label={t("Folgen", "Episodes")}>
                      <input
                        value={form.episodes}
                        onChange={(event) => update("episodes", event.target.value)}
                        inputMode="numeric"
                        className="input-base"
                      />
                    </Field>
                    <Field label={t("Status", "Status")} hint={t("z. B. Ended", "e.g. Ended")}>
                      <input
                        value={form.series_status}
                        onChange={(event) =>
                          update("series_status", event.target.value)
                        }
                        className="input-base"
                      />
                    </Field>
                  </div>
                </fieldset>
              ) : null}

              <div>
                <Field label={t("Handlung", "Synopsis")}>
                  <textarea
                    value={form.overview_de}
                    onChange={(event) => update("overview_de", event.target.value)}
                    rows={4}
                    className="input-base resize-y text-[13px]"
                  />
                </Field>
              </div>

              <fieldset className="rounded-xl border border-line-soft p-4">
                <legend className="px-1 text-[10px] uppercase tracking-[0.16em] text-gold">
                  {t("Bewertungen", "Ratings")}
                </legend>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={t("IMDb-Wertung", "IMDb rating")} hint="0–10">
                    <input
                      value={form.imdb_rating}
                      onChange={(event) =>
                        update("imdb_rating", event.target.value)
                      }
                      inputMode="decimal"
                      className="input-base"
                    />
                  </Field>
                  <Field label={t("IMDb-Stimmen", "IMDb votes")}>
                    <input
                      value={form.imdb_votes}
                      onChange={(event) =>
                        update("imdb_votes", event.target.value)
                      }
                      inputMode="numeric"
                      className="input-base"
                    />
                  </Field>
                  <Field label="Rotten Tomatoes" hint="0–100">
                    <input
                      value={form.rt_rating}
                      onChange={(event) => update("rt_rating", event.target.value)}
                      inputMode="numeric"
                      className="input-base"
                    />
                  </Field>
                  <Field label="Metacritic" hint="0–100">
                    <input
                      value={form.metacritic}
                      onChange={(event) => update("metacritic", event.target.value)}
                      inputMode="numeric"
                      className="input-base"
                    />
                  </Field>
                  <Field label={t("TMDB-Wertung", "TMDB rating")} hint="0–10">
                    <input
                      value={form.tmdb_rating}
                      onChange={(event) =>
                        update("tmdb_rating", event.target.value)
                      }
                      inputMode="decimal"
                      className="input-base"
                    />
                  </Field>
                  <Field label={t("TMDB-Stimmen", "TMDB votes")}>
                    <input
                      value={form.tmdb_votes}
                      onChange={(event) =>
                        update("tmdb_votes", event.target.value)
                      }
                      inputMode="numeric"
                      className="input-base"
                    />
                  </Field>
                  <Field label="Box Office" hint="USD">
                    <input
                      value={form.box_office}
                      onChange={(event) =>
                        update("box_office", event.target.value)
                      }
                      inputMode="numeric"
                      className="input-base"
                    />
                  </Field>
                  <Field label="Budget" hint="USD">
                    <input
                      value={form.budget}
                      onChange={(event) => update("budget", event.target.value)}
                      inputMode="numeric"
                      className="input-base"
                    />
                  </Field>
                  <Field label={t("Popularität", "Popularity")}>
                    <input
                      value={form.popularity}
                      onChange={(event) =>
                        update("popularity", event.target.value)
                      }
                      inputMode="decimal"
                      className="input-base"
                    />
                  </Field>
                  <Field label={t("Oscar-Siege", "Oscar wins")}>
                    <input
                      value={form.oscar_wins}
                      onChange={(event) =>
                        update("oscar_wins", event.target.value)
                      }
                      inputMode="numeric"
                      className="input-base"
                    />
                  </Field>
                  <Field label={t("Oscar-Nominierungen", "Oscar nominations")}>
                    <input
                      value={form.oscar_nominations}
                      onChange={(event) =>
                        update("oscar_nominations", event.target.value)
                      }
                      inputMode="numeric"
                      className="input-base"
                    />
                  </Field>
                  <Field label="TMDB-ID">
                    <input
                      value={form.tmdb_id}
                      onChange={(event) => update("tmdb_id", event.target.value)}
                      inputMode="numeric"
                      className="input-base font-mono text-[11px]"
                    />
                  </Field>
                </div>
              </fieldset>

              <Field
                label={t(
                  "Auszeichnungen / Anmerkungen",
                  "Awards / notes",
                )}
              >
                <textarea
                  value={form.awards}
                  onChange={(event) => update("awards", event.target.value)}
                  rows={2}
                  className="input-base resize-y text-[13px]"
                />
              </Field>

              {error ? (
                <p className="rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                <p className="text-[10px] text-muted-2">
                  {t(
                    "Der Score wird nach dem Speichern automatisch neu berechnet.",
                    "The score is recalculated automatically after saving.",
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="btn-ghost h-9 px-4 text-xs"
                  >
                    {t("Abbrechen", "Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="btn-primary h-9 px-5 text-xs"
                  >
                    {pending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    {t("Speichern", "Save")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
