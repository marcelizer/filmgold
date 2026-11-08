import Link from "next/link";
import { Search, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { ListControls } from "@/components/list-controls";
import { MovieGrid } from "@/components/movie-grid";
import { Pagination } from "@/components/pagination";
import { DiscoverResults } from "@/components/discover/discover-results";
import { genreLabel } from "@/lib/content";
import { hasTmdbCredentials } from "@/lib/db";
import { formatInt } from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import {
  CATALOG_PAGE_SIZES,
  pageSizeParam,
  parseGridLayout,
  parsePageSize,
} from "@/lib/layout";
import { getListOptions } from "@/lib/lists";
import { pluralFor, tr } from "@/lib/locale";
import {
  getMovies,
  getSeriesStates,
  getStats,
  getYearsWithMovies,
} from "@/lib/movies";
import { searchTmdb } from "@/lib/tmdb";
import type { DiscoverMovie, MediaType, SortKey } from "@/lib/types";

const SORT_KEYS: SortKey[] = [
  "score_desc",
  "score_asc",
  "year_desc",
  "year_asc",
  "title_asc",
  "boxoffice_desc",
  "popularity_desc",
  "myrating_desc",
  "added_desc",
];

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function CatalogPage({
  media,
  searchParams,
}: {
  media: MediaType;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const q = single(params.q) ?? "";
  const genre = single(params.genre) ?? "";
  const listRaw = Number(single(params.list));
  const listId = Number.isFinite(listRaw) && listRaw > 0 ? listRaw : undefined;
  const decadeRaw = Number(single(params.decade));
  const yearRaw = Number(single(params.year));
  const seenRaw = single(params.seen);
  const favorite = single(params.favorite) === "1";
  const sortRaw = single(params.sort);
  const pageRaw = Number(single(params.page));
  const extern = single(params.extern) === "1";
  const perPage = parsePageSize(single(params.size), CATALOG_PAGE_SIZES, 24);
  const view = parseGridLayout(single(params.view));

  const sort = SORT_KEYS.includes(sortRaw as SortKey)
    ? (sortRaw as SortKey)
    : "score_desc";
  const seen = seenRaw === "seen" || seenRaw === "unseen" ? seenRaw : "all";
  const basePath = media === "serie" ? "/serien" : "/filme";
  const noun = media === "serie" ? t("Serien", "series") : t("Filme", "films");
  const singular = media === "serie" ? t("Serie", "series") : t("Film", "film");

  const stats = getStats(media);
  const result = getMovies({
    media,
    q,
    genre: genre || undefined,
    listId,
    decade: Number.isFinite(decadeRaw) && decadeRaw > 1800 ? decadeRaw : undefined,
    year: Number.isFinite(yearRaw) && yearRaw > 1800 ? yearRaw : undefined,
    seen,
    favorite,
    sort,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    pageSize: perPage,
  });
  const years = getYearsWithMovies(media).map((entry) => entry.year);
  const lists = getListOptions();
  const currentParams: Record<string, string | undefined> = {
    q: q || undefined,
    genre: genre || undefined,
    list: listId ? String(listId) : undefined,
    decade: Number.isFinite(decadeRaw) && decadeRaw > 1800 ? String(decadeRaw) : undefined,
    year: Number.isFinite(yearRaw) && yearRaw > 1800 ? String(yearRaw) : undefined,
    seen: seen !== "all" ? seen : undefined,
    favorite: favorite ? "1" : undefined,
    sort: sort !== "score_desc" ? sort : undefined,
    extern: extern ? "1" : undefined,
    size: pageSizeParam(perPage, 24),
    view: view !== "standard" ? view : undefined,
  };

  const seriesStates =
    media === "serie"
      ? getSeriesStates(result.movies.map((movie) => movie.id))
      : undefined;

  // Optional second result set: TMDB titles that are not part of the archive.
  let external: DiscoverMovie[] | null = null;
  let externalError: string | null = null;
  if (extern && q.trim().length >= 2) {
    if (hasTmdbCredentials()) {
      try {
        const hits = await searchTmdb(q, media, locale);
        external = hits
          .filter((hit) => !hit.alreadyInDb)
          .map((hit) => ({ ...hit, genreIds: [] }));
      } catch (caught) {
        externalError =
          caught instanceof Error
            ? caught.message
            : t(
                "TMDB konnte nicht abgefragt werden.",
                "TMDB could not be queried.",
              );
      }
    } else {
      externalError = t(
        "Für die Suche außerhalb des Archivs wird ein TMDB-API-Key benötigt.",
        "Searching outside the archive requires a TMDB API key.",
      );
    }
  }
  const externalLists = external
    ? lists.map((list) => ({
        id: list.id,
        name: list.name,
        count: list.count,
      }))
    : [];

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="max-w-3xl">
        <p className="eyebrow">{t("Das Archiv", "The archive")}</p>
        <h1 className="display mt-3 text-5xl text-cream sm:text-6xl">
          {media === "serie" ? t("Alle Serien", "All series") : t("Alle Filme", "All films")}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            `${formatInt(stats.count, locale)} ${pluralFor(
              locale,
              stats.count,
              singular,
              noun,
              singular,
              noun,
            )}, sortiert und filterbar. Der Filmgold-Score verbindet ${
              media === "serie"
                ? "Publikum, Popularität"
                : "Kritik, Publikum, Einspiel"
            } und Gegenwartsrelevanz – du kannst aber auch klassisch nach Jahr, Titel oder deiner eigenen Wertung ordnen.`,
            `${formatInt(stats.count)} ${pluralFor(
              locale,
              stats.count,
              singular,
              noun,
              singular,
              noun,
            )}, sortable and filterable. The Filmgold score blends ${
              media === "serie"
                ? "audience, popularity"
                : "critics, audience, box office"
            } and contemporary relevance – or sort by year, title or your own rating.`,
          )}
        </p>
      </div>

      <div className="mt-8">
        <FilterBar
          genres={stats.genres.map((entry) => entry.name)}
          decades={stats.decades.map((entry) => entry.decade)}
          years={years}
          lists={lists}
          current={{
            q,
            genre,
            decade: currentParams.decade ?? "",
            year: currentParams.year ?? "",
            list: currentParams.list ?? "",
            seen,
            favorite: favorite ? "1" : "",
            sort,
            extern: extern ? "1" : "",
          }}
          basePath={basePath}
          media={media}
          preserve={{
            size: currentParams.size,
            view: currentParams.view,
          }}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p>
          <span className="text-cream">{formatInt(result.total, locale)}</span>{" "}
          {result.total === 1 ? singular : noun}{" "}
          {t("gefunden", "found")}
          {q ? (
            <>
              {" "}{t("für", "for")} <span className="text-cream">„{q}“</span>
            </>
          ) : null}
          {genre ? (
            <>
              {" "}{t("im Genre", "in genre")}{" "}
              <span className="text-cream">{genreLabel(genre, locale)}</span>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-muted-2">
            {t(
              `Seite ${result.page} von ${result.totalPages}`,
              `Page ${result.page} of ${result.totalPages}`,
            )}
          </p>
          <ListControls
            basePath={basePath}
            params={currentParams}
            pageSize={perPage}
            pageSizeOptions={CATALOG_PAGE_SIZES}
            layout={view}
          />
        </div>
      </div>

      <div className="mt-6">
        {result.movies.length > 0 ? (
          <MovieGrid
            movies={result.movies}
            eagerCount={5}
            seriesStates={seriesStates}
            locale={locale}
            layout={view}
          />
        ) : external && external.length > 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-3 text-xs text-muted">
            {t(
              "Kein Treffer im Archiv – die TMDB-Treffer findest du direkt darunter.",
              "No match in the archive – the TMDB results are listed right below.",
            )}
          </p>
        ) : (
          <EmptyState
            title={t(`Keine ${noun} gefunden`, `No ${noun} found`)}
            description={t(
              "Für diese Kombination gibt es keinen Treffer. Setze die Filter zurück oder suche nach einem anderen Titel.",
              "There is no match for this combination. Reset the filters or search for another title.",
            )}
            action={
              <Link href={basePath} className="btn-ghost">
                <Search className="size-4" />
                {t(`Alle ${noun} zeigen`, `Show all ${noun}`)}
              </Link>
            }
          />
        )}
      </div>

      {extern ? (
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-soft pb-4">
            <div>
              <p className="eyebrow">{t("Außerhalb des Archivs", "Outside the archive")}</p>
              <h2 className="display mt-2 text-3xl text-cream">
                {t("Nicht im Archiv (TMDB)", "Not in the archive (TMDB)")}
              </h2>
            </div>
            {external ? (
              <p className="text-[11px] text-muted-2">
                {formatInt(external.length, locale)}{" "}
                {external.length === 1 ? singular : noun} {t("gefunden", "found")}
              </p>
            ) : null}
          </div>

          {externalError ? (
            <div className="mt-4 rounded-xl border border-rust/30 bg-rust/10 p-4 text-xs text-[#f0a08e]">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-3.5" />
                {t(
                  "Suche außerhalb des Archivs nicht möglich",
                  "Search outside the archive unavailable",
                )}
              </p>
              <p className="mt-1.5 leading-relaxed">{externalError}</p>
            </div>
          ) : external && external.length > 0 ? (
            <div className="mt-6">
              <DiscoverResults movies={external} lists={externalLists} />
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-line bg-surface/40 px-4 py-3 text-xs text-muted">
              {t(
                `Keine weiteren ${noun} zu „${q}“ bei TMDB gefunden.`,
                `No further ${noun} for “${q}” found on TMDB.`,
              )}
            </p>
          )}
        </section>
      ) : null}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath={basePath}
        params={currentParams}
        locale={locale}
      />
    </div>
  );
}
