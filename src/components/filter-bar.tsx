"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2, RotateCcw, Search } from "lucide-react";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { genreLabel } from "@/lib/content";
import type { MediaType } from "@/lib/types";

export type FilterState = {
  q: string;
  genre: string;
  decade: string;
  year: string;
  list: string;
  seen: string;
  favorite: string;
  sort: string;
  extern: string;
};

const FILTER_KEYS = [
  "q",
  "genre",
  "decade",
  "year",
  "list",
  "seen",
  "favorite",
  "sort",
  "extern",
] as const;

export function FilterBar({
  genres,
  decades,
  years,
  lists,
  current,
  basePath = "/filme",
  media = "movie",
  preserve,
}: {
  genres: string[];
  decades: number[];
  years: number[];
  lists?: { id: number; name: string; count: number }[];
  current: FilterState;
  basePath?: string;
  media?: MediaType;
  /** Extra query parameters (page size, view) that survive filter changes. */
  preserve?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(current.q);

  function navigate(patch: Partial<FilterState>) {
    const next = { ...current, ...patch };
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      if (next[key]) params.set(key, next[key]);
    }
    for (const [key, value] of Object.entries(preserve ?? {})) {
      if (value) params.set(key, value);
    }
    const queryString = params.toString();
    startTransition(() => {
      router.push(queryString ? `${basePath}?${queryString}` : basePath);
    });
  }

  const activeFilters = [
    current.q,
    current.genre,
    current.decade,
    current.year,
    current.list,
    current.seen !== "all" ? current.seen : "",
    current.favorite === "1" ? current.favorite : "",
    current.extern,
  ].filter(Boolean).length;

  return (
    <div
      className={cn(
        "surface-card p-4 transition-opacity sm:p-5",
        isPending && "opacity-70",
      )}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <form
          className="relative xl:col-span-3"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ q: query.trim() });
          }}
          role="search"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder={t(
                media === "serie"
                  ? "Titel, Originaltitel, Crew …"
                  : "Titel, Originaltitel, Regie …",
                media === "serie"
                  ? "Title, original title, crew …"
                  : "Title, original title, director …",
              )}
              aria-label={t(
                media === "serie" ? "Serien durchsuchen" : "Filme durchsuchen",
                media === "serie" ? "Search series" : "Search films",
              )}
              className="input-base h-10 pl-9"
            />
          </div>
          <label
            className={cn(
              "mt-2 inline-flex cursor-pointer items-center gap-2 text-[11px] transition-colors",
              current.q
                ? "text-muted hover:text-cream"
                : "cursor-not-allowed text-muted-2/60",
            )}
            title={t(
              current.q
                ? "Treffer aus TMDB anzeigen, die noch nicht im Archiv sind"
                : "Suche zuerst nach einem Titel",
              current.q
                ? "Show TMDB results that are not in the archive yet"
                : "Search for a title first",
            )}
          >
            <input
              type="checkbox"
              checked={current.extern === "1"}
              disabled={!current.q}
              onChange={(event) =>
                navigate({ extern: event.target.checked ? "1" : "" })
              }
              className="size-3.5 rounded border-line bg-surface-2 accent-[#c9a227]"
            />
            {t("Auch außerhalb des Archivs", "Also outside the archive")}
          </label>
        </form>

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Genre", "Genre")}
          </span>
          <select
            value={current.genre}
            onChange={(event) => navigate({ genre: event.target.value })}
            className="input-base h-10"
          >
            <option value="">{t("Alle Genres", "All genres")}</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genreLabel(genre, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Jahrzehnt", "Decade")}
          </span>
          <select
            value={current.decade}
            onChange={(event) =>
              navigate({ decade: event.target.value, year: "" })
            }
            className="input-base h-10"
          >
            <option value="">{t("Alle Jahrzehnte", "All decades")}</option>
            {decades.map((decade) => (
              <option key={decade} value={decade}>
                {t(`${decade}er`, `${decade}s`)}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-1">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Jahr", "Year")}
          </span>
          <select
            value={current.year}
            onChange={(event) =>
              navigate({ year: event.target.value, decade: "" })
            }
            className="input-base h-10"
          >
            <option value="">{t("Alle", "All")}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        {lists && lists.length > 0 ? (
          <label className="xl:col-span-2">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
              {t("Liste", "List")}
            </span>
            <select
              value={current.list}
              onChange={(event) => navigate({ list: event.target.value })}
              className="input-base h-10"
            >
              <option value="">{t("Alle Listen", "All lists")}</option>
              {lists.map((list) => (
                <option key={list.id} value={String(list.id)}>
                  {list.name} ({list.count})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="xl:col-span-2">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
            {t("Sortierung", "Sort")}
          </span>
          <select
            value={current.sort}
            onChange={(event) => navigate({ sort: event.target.value })}
            className="input-base h-10"
          >
            <option value="score_desc">{t("Filmgold-Score", "Filmgold score")}</option>
            <option value="year_desc">{t("Jahr (neu → alt)", "Year (new → old)")}</option>
            <option value="year_asc">{t("Jahr (alt → neu)", "Year (old → new)")}</option>
            <option value="title_asc">{t("Titel A–Z", "Title A–Z")}</option>
            {media === "movie" ? (
              <option value="boxoffice_desc">{t("Box Office", "Box office")}</option>
            ) : null}
            <option value="popularity_desc">{t("Popularität", "Popularity")}</option>
            <option value="myrating_desc">{t("Meine Bewertung", "My rating")}</option>
            <option value="added_desc">{t("Zuletzt hinzugefügt", "Recently added")}</option>
          </select>
        </label>

        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-12">
          <label className="min-w-0 sm:w-56">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
              {t("Gesehen", "Seen")}
            </span>
            <select
              value={current.seen}
              onChange={(event) => navigate({ seen: event.target.value })}
              className="input-base h-10"
            >
              <option value="all">
                {media === "serie" ? t("Alle Serien", "All series") : t("Alle Filme", "All films")}
              </option>
              <option value="seen">{t("Nur gesehene", "Seen only")}</option>
              <option value="unseen">{t("Nur ungesehene", "Unseen only")}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              navigate({ favorite: current.favorite === "1" ? "" : "1" })
            }
            aria-pressed={current.favorite === "1"}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs transition-colors",
              current.favorite === "1"
                ? "border-rust/50 bg-rust/10 text-rust"
                : "border-line text-muted hover:border-cream/30 hover:text-cream",
            )}
            title={t("Nur Favoriten anzeigen", "Show favourites only")}
          >
            <Heart
              className={cn(
                "size-3.5",
                current.favorite === "1" && "fill-current",
              )}
            />
            <span className="hidden sm:inline">
              {t("Favoriten", "Favourites")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.push(basePath);
            }}
            disabled={activeFilters === 0}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-muted transition-colors hover:border-cream/30 hover:text-cream disabled:opacity-40"
            title={t("Filter zurücksetzen", "Reset filters")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            <span className="hidden sm:inline">{t("Zurücksetzen", "Reset")}</span>
          </button>
          <span className="mb-2.5 hidden text-[11px] text-muted-2 sm:inline">
            {activeFilters > 0
              ? t(
                  `${activeFilters} Filter aktiv`,
                  `${activeFilters} filter${activeFilters === 1 ? "" : "s"} active`,
                )
              : t("Kein Filter aktiv", "No filters active")}
          </span>
        </div>
      </div>
    </div>
  );
}
