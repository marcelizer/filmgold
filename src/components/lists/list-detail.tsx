"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Film,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  addListCandidateAction,
  deleteListAction,
  moveListItemAction,
  removeMovieFromListAction,
  searchListCandidatesAction,
  updateListAction,
} from "@/app/actions";
import { useLocale, useT } from "@/components/i18n-provider";
import { ListControls } from "@/components/list-controls";
import { Pagination } from "@/components/pagination";
import { Poster } from "@/components/poster";
import { ScoreBadge } from "@/components/score-badge";
import { cn } from "@/lib/cn";
import { contentTitle } from "@/lib/content";
import {
  formatInt,
  formatRuntime,
  formatScore,
  formatYear,
  formatYearRange,
} from "@/lib/format";
import {
  ALL_PAGE_SIZE,
  CATALOG_PAGE_SIZES,
  gridClassName,
  pageSizeParam,
  type GridLayout,
} from "@/lib/layout";
import type { ListSearchCandidate, MovieListDetail } from "@/lib/types";

function candidatePoster(candidate: ListSearchCandidate) {
  return {
    id: candidate.movieId ?? (candidate.tmdbId ? -candidate.tmdbId : 0),
    titleDe: candidate.title,
    titleOriginal: candidate.originalTitle,
    year: candidate.year,
    posterPath: candidate.posterPath,
  };
}

export function ListDetail({
  list,
  size = ALL_PAGE_SIZE,
  view = "standard",
  page = 1,
}: {
  list: MovieListDetail;
  size?: number;
  view?: GridLayout;
  page?: number;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? "");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ListSearchCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  const perPage =
    size === ALL_PAGE_SIZE ? Math.max(1, list.movies.length) : size;
  const totalPages = Math.max(1, Math.ceil(list.movies.length / perPage));
  const safePage = Math.min(page, totalPages);
  const shownMovies = list.movies.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );
  const startRank = (safePage - 1) * perPage;
  const controlParams: Record<string, string | undefined> = {
    size: pageSizeParam(size, ALL_PAGE_SIZE),
    view: view === "standard" ? undefined : view,
  };

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setDetailsError(null);
    const result = await updateListAction(list.id, { name, description });
    setSaving(false);
    if (!result.ok) {
      setDetailsError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function removeList() {
    if (
      !window.confirm(
        t(
          `Liste „${list.name}“ wirklich löschen? Die Titel bleiben im Archiv.`,
          `Delete the list “${list.name}”? The titles stay in the archive.`,
        ),
      )
    ) {
      return;
    }
    setDeleting(true);
    const result = await deleteListAction(list.id);
    setDeleting(false);
    if (!result.ok) {
      setDetailsError(result.error);
      return;
    }
    router.push("/listen");
    router.refresh();
  }

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setSearching(true);
    setSearchError(null);
    setNotice(null);
    setCandidates(null);
    const result = await searchListCandidatesAction(list.id, clean);
    setSearching(false);
    if (!result.ok) {
      setSearchError(result.error);
      return;
    }
    setCandidates(result.data.candidates);
  }

  async function addCandidate(candidate: ListSearchCandidate) {
    setPendingKey(candidate.key);
    setSearchError(null);
    setNotice(null);
    const result = await addListCandidateAction(list.id, {
      movieId: candidate.movieId,
      tmdbId: candidate.tmdbId,
      mediaType: candidate.mediaType,
    });
    setPendingKey(null);
    if (!result.ok) {
      setSearchError(result.error);
      return;
    }
    setCandidates((current) =>
      current?.map((entry) =>
        entry.key === candidate.key
          ? {
              ...entry,
              movieId: result.data.movieId,
              inList: true,
              inArchive: true,
            }
          : entry,
      ) ?? null,
    );
    setNotice(
      result.data.added
        ? t(
            `„${candidate.title}“ wurde hinzugefügt.`,
            `“${candidate.title}” was added.`,
          )
        : t(
            `„${candidate.title}“ steht bereits auf dieser Liste.`,
            `“${candidate.title}” is already on this list.`,
          ),
    );
    router.refresh();
  }

  async function removeMovie(movieId: number, title: string) {
    if (
      !window.confirm(
        t(
          `„${title}“ von dieser Liste entfernen?`,
          `Remove “${title}” from this list?`,
        ),
      )
    ) {
      return;
    }
    setRemoving(movieId);
    const result = await removeMovieFromListAction(list.id, movieId);
    setRemoving(null);
    if (!result.ok) {
      setSearchError(result.error);
      return;
    }
    router.refresh();
  }

  async function move(movieId: number, direction: "up" | "down") {
    setRemoving(movieId);
    const result = await moveListItemAction(list.id, movieId, direction);
    setRemoving(null);
    if (!result.ok) {
      setSearchError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="container-page py-12 lg:py-16">
      <Link
        href="/listen"
        className="inline-flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-cream"
      >
        <ArrowLeft className="size-3.5" />
        {t("Alle Listen", "All lists")}
      </Link>

      {editing ? (
        <form onSubmit={saveDetails} className="surface-card mt-6 p-5 sm:p-6">
          <p className="eyebrow">{t("Liste bearbeiten", "Edit list")}</p>
          <div className="mt-4 grid gap-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              className="input-base h-10"
              aria-label={t("Listenname", "List name")}
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={400}
              rows={3}
              placeholder={t("Beschreibung (optional)", "Description (optional)")}
              className="input-base resize-y text-sm"
            />
          </div>
          {detailsError ? (
            <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
              {detailsError}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="btn-primary h-9 px-4 text-xs"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {t("Speichern", "Save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(list.name);
                setDescription(list.description ?? "");
                setDetailsError(null);
              }}
              className="btn-ghost h-9 px-4 text-xs"
            >
              {t("Abbrechen", "Cancel")}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="eyebrow">{t("Eigene Liste", "Your list")}</p>
            <h1 className="display mt-3 text-5xl text-cream sm:text-6xl">
              {list.name}
            </h1>
            {list.description ? (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
                {list.description}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-2">
              {formatInt(list.count, locale)}{" "}
              {t("Titel", list.count === 1 ? "title" : "titles")}{" "}
              ·{" "}
              {list.count > 0
                ? t("Reihenfolge von oben nach unten", "Order from top to bottom")
                : t("Noch keine Titel", "No titles yet")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-ghost h-9 px-4 text-xs"
            >
              <Pencil className="size-3.5" />
              {t("Bearbeiten", "Edit")}
            </button>
            <button
              type="button"
              onClick={removeList}
              disabled={deleting}
              className="btn-quiet h-9 border border-line px-4 text-xs text-rust hover:text-rust"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              {t("Löschen", "Delete")}
            </button>
          </div>
        </div>
      )}

      {detailsError && !editing ? (
        <p className="mt-4 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
          {detailsError}
        </p>
      ) : null}

      <section className="surface-card mt-8 p-5">
        <div className="flex items-center gap-2 text-gold">
          <Plus className="size-4" />
          <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
            {t("Titel hinzufügen", "Add titles")}
          </p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {t(
            "Suche im Archiv oder direkt bei TMDB. Filme und Serien, die noch nicht im Archiv sind, werden beim Hinzufügen automatisch mit allen Daten importiert.",
            "Search the archive or directly on TMDB. Films and series that are not yet in the archive are imported with all their data when added.",
          )}
        </p>
        <form onSubmit={runSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(
                "Titel, Originaltitel oder Regie …",
                "Title, original title or director …",
              )}
              className="input-base h-10 pl-9"
              aria-label={t("Titel für die Liste suchen", "Search titles for the list")}
            />
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="btn-primary h-10 shrink-0 px-4 text-xs"
          >
            {searching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            {t("Suchen", "Search")}
          </button>
        </form>

        {searchError ? (
          <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
            {searchError}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-[#b6cba9]">
            {notice}
          </p>
        ) : null}

        {candidates ? (
          candidates.length > 0 ? (
            <ul className="mt-4 divide-y divide-line-soft border-t border-line-soft">
              {candidates.map((candidate) => (
                <li key={candidate.key} className="flex items-center gap-3 py-3">
                  <Poster
                    movie={candidatePoster(candidate)}
                    imageSize="w342"
                    sizes="44px"
                    locale={locale}
                    className="w-11 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-cream">{candidate.title}</p>
                    <p className="truncate text-[11px] text-muted-2">
                      {candidate.originalTitle ??
                        t("Originaltitel unbekannt", "Original title unknown")}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {candidate.mediaType === "serie"
                        ? t("Serie", "Series")
                        : t("Film", "Film")}
                      <span className="mx-1.5 text-line">·</span>
                      {formatYear(candidate.year)}
                      {candidate.rating
                        ? ` · TMDB ${formatScore(candidate.rating, 1, locale)}`
                        : ""}
                      <span className="mx-1.5 text-line">·</span>
                      <span
                        className={candidate.inArchive ? "text-moss" : "text-gold"}
                      >
                        {candidate.inArchive
                          ? t("Im Archiv", "In archive")
                          : t("Wird importiert", "Will be imported")}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addCandidate(candidate)}
                    disabled={
                      pendingKey !== null ||
                      candidate.inList ||
                      (!candidate.inArchive && !candidate.tmdbId)
                    }
                    className={cn(
                      "btn-ghost h-8 shrink-0 px-3 text-[11px]",
                      candidate.inList && "border-moss/30 text-moss",
                    )}
                  >
                    {pendingKey === candidate.key ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : candidate.inList ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    {candidate.inList
                      ? t("In Liste", "On list")
                      : candidate.inArchive
                        ? t("Hinzufügen", "Add")
                        : t("Importieren", "Import")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-muted">
              {t(
                "Kein Treffer. Versuche einen anderen Titel oder prüfe die TMDB-Verbindung.",
                "No match. Try another title or check the TMDB connection.",
              )}
            </p>
          )
        ) : null}
      </section>

      <section className="mt-10">
        {list.movies.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line bg-surface/40 p-8">
            <span className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <Film className="size-5 text-gold" />
            </span>
            <div>
              <h2 className="display text-3xl text-cream">
                {t("Noch ganz leer.", "Still empty.")}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                {t(
                  "Nutze die Suche oben oder öffne eine Film- oder Serienseite und füge den Titel dort einer deiner Listen hinzu.",
                  "Use the search above or open a film or series page and add the title to one of your lists there.",
                )}
              </p>
            </div>
            <Link href="/filme" className="btn-primary h-9 px-4 text-xs">
              {t("Archiv entdecken", "Explore archive")}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-muted-2">
                {t(
                  `Seite ${safePage} von ${totalPages}`,
                  `Page ${safePage} of ${totalPages}`,
                )}
              </p>
              <ListControls
                basePath={`/listen/${list.id}`}
                params={controlParams}
                pageSize={size}
                pageSizeOptions={CATALOG_PAGE_SIZES}
                layout={view}
              />
            </div>
            <div className={cn("grid gap-5", gridClassName(view))}>
            {shownMovies.map((movie, index) => {
              const title = contentTitle(movie, locale);
              const position = startRank + index + 1;
              return (
              <article key={movie.id} className="group relative">
                <Link
                  href={`${movie.mediaType === "serie" ? "/serien" : "/filme"}/${movie.slug}`}
                  className="absolute inset-0 z-10"
                  aria-label={t(`${title} ansehen`, `View ${title}`)}
                />
                <div className="relative">
                  <Poster movie={movie} sizes="(max-width: 640px) 45vw, 18vw" locale={locale} />
                  <span className="absolute left-2 top-2 z-20 flex size-7 items-center justify-center rounded-full border border-white/15 bg-black/75 text-[11px] font-medium tabular-nums text-gold backdrop-blur">
                    {position}
                  </span>
                  <ScoreBadge
                    score={movie.totalScore}
                    className="absolute right-2 top-2 z-20"
                    locale={locale}
                  />
                  <button
                    type="button"
                    onClick={() => removeMovie(movie.id, title)}
                    disabled={removing === movie.id}
                    className="absolute right-2 top-11 z-20 flex size-7 items-center justify-center rounded-full border border-white/15 bg-black/75 text-white/70 opacity-0 backdrop-blur transition-all hover:border-rust/50 hover:text-rust group-hover:opacity-100"
                    title={t("Von Liste entfernen", "Remove from list")}
                  >
                    {removing === movie.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </button>
                </div>
                <div className="mt-3">
                  <h3 className="truncate text-sm text-cream group-hover:text-gold">
                    {title}
                  </h3>
                  <p className="mt-0.5 text-[10px] text-muted-2">
                    {movie.mediaType === "serie"
                      ? t("Serie", "Series")
                      : t("Film", "Film")}
                    <span className="mx-1 text-line">·</span>
                    {movie.mediaType === "serie"
                      ? formatYearRange(movie.year, movie.endYear)
                      : formatYear(movie.year)}
                    {movie.mediaType === "serie"
                      ? movie.seasons
                        ? ` · ${movie.seasons} ${t("Staffeln", "seasons")}`
                        : ""
                      : movie.runtime
                        ? ` · ${formatRuntime(movie.runtime, locale)}`
                        : ""}
                  </p>
                </div>
                <div className="relative z-20 mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => move(movie.id, "up")}
                    disabled={position === 1 || removing === movie.id}
                    className="flex size-7 items-center justify-center rounded-md border border-line text-muted transition-colors hover:border-cream/30 hover:text-cream disabled:opacity-30"
                    title={t("Nach oben", "Move up")}
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(movie.id, "down")}
                    disabled={
                      position === list.movies.length || removing === movie.id
                    }
                    className="flex size-7 items-center justify-center rounded-md border border-line text-muted transition-colors hover:border-cream/30 hover:text-cream disabled:opacity-30"
                    title={t("Nach unten", "Move down")}
                  >
                    <ArrowDown className="size-3" />
                  </button>
                  {movie.myRating ? (
                    <span className="ml-auto text-[11px] tabular-nums text-gold">
                      {formatScore(movie.myRating, 1, locale)}/10
                    </span>
                  ) : null}
                </div>
              </article>
              );
            })}
            </div>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              basePath={`/listen/${list.id}`}
              params={controlParams}
              locale={locale}
            />
          </>
        )}
      </section>
    </div>
  );
}
