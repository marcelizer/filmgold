"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Eye,
  Loader2,
  ListPlus,
  Plus,
  Star,
} from "lucide-react";
import {
  addListCandidateAction,
  addMovieFromTmdbAction,
} from "@/app/actions";
import { useLocale, useT } from "@/components/i18n-provider";
import { Poster } from "@/components/poster";
import { cn } from "@/lib/cn";
import { formatCompact, formatScore, formatYear } from "@/lib/format";
import { gridClassName, type GridLayout } from "@/lib/layout";
import { tmdbGenreNames } from "@/lib/tmdb-genres";
import type { DiscoverMovie } from "@/lib/types";

export type DiscoverListOption = {
  id: number;
  name: string;
  count: number;
};

type CardState = {
  inArchive: boolean;
  slug: string | null;
  listName: string | null;
};

function posterFor(movie: DiscoverMovie) {
  return {
    id: -movie.tmdbId,
    titleDe: movie.title,
    titleOriginal: movie.originalTitle,
    year: movie.year,
    posterPath: movie.posterPath,
  };
}

export function DiscoverResults({
  movies,
  lists,
  layout = "standard",
}: {
  movies: DiscoverMovie[];
  lists: DiscoverListOption[];
  layout?: GridLayout;
}) {
  const t = useT();
  const locale = useLocale();
  const [added, setAdded] = useState<Record<number, CardState>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string | null>>({});

  // Titles that were already archived before this render keep their archive
  // link even when the result list comes from a title search.
  const initial = movies.reduce<Record<number, CardState>>((map, movie) => {
    if (movie.alreadyInDb && movie.existingSlug) {
      map[movie.tmdbId] = {
        inArchive: true,
        slug: movie.existingSlug,
        listName: null,
      };
    }
    return map;
  }, {});

  async function addToArchive(movie: DiscoverMovie) {
    setPending(movie.tmdbId);
    setErrors((current) => ({ ...current, [movie.tmdbId]: null }));
    const result = await addMovieFromTmdbAction(movie.tmdbId, movie.mediaType);
    setPending(null);
    if (!result.ok) {
      setErrors((current) => ({ ...current, [movie.tmdbId]: result.error }));
      return;
    }
    setAdded((current) => ({
      ...current,
      [movie.tmdbId]: {
        inArchive: true,
        slug: result.data.slug,
        listName: current[movie.tmdbId]?.listName ?? null,
      },
    }));
  }

  async function addToList(movie: DiscoverMovie, listId: number) {
    const list = lists.find((entry) => entry.id === listId);
    if (!list) return;
    setPending(movie.tmdbId);
    setErrors((current) => ({ ...current, [movie.tmdbId]: null }));
    const result = await addListCandidateAction(list.id, {
      tmdbId: movie.tmdbId,
      mediaType: movie.mediaType,
    });
    setPending(null);
    if (!result.ok) {
      setErrors((current) => ({ ...current, [movie.tmdbId]: result.error }));
      return;
    }
    setAdded((current) => ({
      ...current,
      [movie.tmdbId]: {
        inArchive: true,
        slug: result.data.slug,
        listName: list.name,
      },
    }));
  }

  return (
    <div className={cn("grid", gridClassName(layout))}>
      {movies.map((movie) => {
        const state = added[movie.tmdbId] ?? initial[movie.tmdbId];
        const busy = pending === movie.tmdbId;
        const genreLabel = tmdbGenreNames(
          movie.genreIds,
          movie.mediaType,
          locale,
        )
          .slice(0, 2)
          .join(" · ");
        const previewHref = `/vorschau/${
          movie.mediaType === "serie" ? "serie" : "movie"
        }/${movie.tmdbId}`;
        return (
          <article key={movie.tmdbId} className="group flex min-w-0 flex-col">
            <Link
              href={previewHref}
              className="relative block"
              aria-label={t(
                `${movie.title} in der Vorschau öffnen`,
                `Open ${movie.title} in the preview`,
              )}
            >
              <Poster movie={posterFor(movie)} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, 18vw" />
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-gold/40 bg-black/75 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-gold backdrop-blur">
                <Star className="size-2.5 fill-current" />
                {formatScore(movie.rating, 1, locale)}
              </span>
              <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white/70 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                <Eye className="size-3" />
              </span>
            </Link>

            <div className="mt-3 min-w-0 flex-1">
              <h3 className="truncate text-[13.5px] font-medium leading-snug text-cream transition-colors group-hover:text-gold">
                <Link href={previewHref}>{movie.title}</Link>
              </h3>
              {movie.originalTitle &&
              movie.originalTitle.toLowerCase() !== movie.title.toLowerCase() ? (
                <p className="mt-0.5 truncate text-[11px] italic text-muted-2">
                  {movie.originalTitle}
                </p>
              ) : null}
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                <span className="tabular-nums">{formatYear(movie.year)}</span>
                {movie.votes ? (
                  <>
                    <span className="text-line">·</span>
                    <span>
                      {formatCompact(movie.votes, locale)}{" "}
                      {t("Stimmen", "votes")}
                    </span>
                  </>
                ) : null}
              </p>
              {genreLabel ? (
                <p className="mt-1 truncate text-[10px] text-muted-2">{genreLabel}</p>
              ) : null}
              {movie.overview ? (
                <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted">
                  {movie.overview}
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              {state?.inArchive && state.slug ? (
                <Link
                  href={`${movie.mediaType === "serie" ? "/serien" : "/filme"}/${state.slug}`}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-moss/35 bg-moss/10 px-3 text-[11px] text-moss transition-colors hover:border-moss/60"
                >
                  <Check className="size-3" />
                  {t("Im Archiv ansehen", "View in archive")}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => addToArchive(movie)}
                  disabled={busy}
                  className={cn(
                    "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-line px-3 text-[11px] text-cream transition-colors hover:border-gold/45 hover:text-gold",
                    busy && "opacity-70",
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Plus className="size-3" />
                  )}
                  {t("Ins Archiv", "Add to archive")}
                </button>
              )}

              {lists.length > 0 ? (
                <label className="relative block">
                  <ListPlus className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-2" />
                  <select
                    value=""
                    onChange={(event) => {
                      const listId = Number(event.target.value);
                      event.target.value = "";
                      if (listId) addToList(movie, listId);
                    }}
                    disabled={busy}
                    className="h-8 w-full appearance-none rounded-full border border-line bg-surface-2 pl-8 pr-2 text-[11px] text-muted transition-colors hover:border-cream/25 hover:text-cream focus:border-gold/50 focus:outline-none"
                    aria-label={t(
                      `${movie.title} auf eine Liste setzen`,
                      `Add ${movie.title} to a list`,
                    )}
                  >
                    <option value="">
                      {state?.listName
                        ? t(`Auf „${state.listName}“`, `To “${state.listName}”`)
                        : t("Auf Liste …", "To list …")}
                    </option>
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.count})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <Link
                  href="/listen"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-dashed border-line px-3 text-[11px] text-muted-2 transition-colors hover:border-gold/40 hover:text-gold"
                >
                  <ListPlus className="size-3" />
                  {t("Liste anlegen", "Create list")}
                </Link>
              )}

              {errors[movie.tmdbId] ? (
                <p className="rounded-md border border-rust/30 bg-rust/10 px-2 py-1 text-[10px] leading-relaxed text-[#f0a08e]">
                  {errors[movie.tmdbId]}
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
