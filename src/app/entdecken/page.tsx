import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Compass, EyeOff, Film, Sparkles, TriangleAlert, Tv } from "lucide-react";
import { DiscoverFilters, type DiscoverFilterState } from "@/components/discover/discover-filters";
import { DiscoverResults } from "@/components/discover/discover-results";
import { ListControls } from "@/components/list-controls";
import { MediaSwitch } from "@/components/media-switch";
import { Pagination } from "@/components/pagination";
import { hasTmdbCredentials } from "@/lib/db";
import { formatInt } from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import {
  ALL_PAGE_SIZE,
  MAX_DISCOVER_PAGE_SIZE,
  SEARCH_PAGE_SIZES,
  pageSizeParam,
  parseGridLayout,
  parsePageSize,
} from "@/lib/layout";
import { getLists } from "@/lib/lists";
import { pluralFor, tr, type Locale } from "@/lib/locale";
import { getStats } from "@/lib/movies";
import { discoverTmdb, searchTmdbPool } from "@/lib/tmdb";
import { isTmdbGenreId } from "@/lib/tmdb-genres";
import type {
  DiscoverFilters as DiscoverFiltersType,
  DiscoverMovie,
  DiscoverSort,
  MediaType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: tr(locale, "Neu entdecken", "Discover"),
    description: tr(
      locale,
      "Filme außerhalb deines Archivs finden – nach Genre, Jahr, Bewertung, Stimmen und Sprache kombiniert.",
      "Find films outside your archive – combined by genre, year, rating, votes and language.",
    ),
  };
}

const SORT_KEYS: DiscoverSort[] = [
  "relevance",
  "rating_desc",
  "popularity_desc",
  "votes_desc",
  "revenue_desc",
  "release_desc",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR + 2 - 1900 + 1 },
  (_, index) => CURRENT_YEAR + 1 - index,
);
const DECADES = Array.from({ length: 13 }, (_, index) => 2020 - index * 10);

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numeric(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(single(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Local filters for search results, which TMDB itself cannot filter. */
function matchesFilters(
  movie: DiscoverMovie,
  filters: DiscoverFiltersType,
): boolean {
  if (filters.genreIds.length > 0) {
    const genres = movie.genreIds ?? [];
    const matches =
      filters.genreMode === "and"
        ? filters.genreIds.every((id) => genres.includes(id))
        : filters.genreIds.some((id) => genres.includes(id));
    if (!matches) return false;
  }
  if (filters.year) {
    if (movie.year !== filters.year) return false;
  } else if (filters.decade) {
    if (
      movie.year === null ||
      Math.floor(movie.year / 10) * 10 !== filters.decade
    ) {
      return false;
    }
  }
  if (filters.minRating > 0 && (movie.rating ?? 0) < filters.minRating) {
    return false;
  }
  if (filters.minVotes > 0 && (movie.votes ?? 0) < filters.minVotes) {
    return false;
  }
  if (filters.language && movie.originalLanguage !== filters.language) {
    return false;
  }
  return true;
}

/** TMDB search has no sort parameter, so non-relevance order is local. */
function sortSearchHits(
  movies: DiscoverMovie[],
  sort: DiscoverSort,
): DiscoverMovie[] {
  if (sort === "relevance") return movies;
  const value = (entry: number | null | undefined) => entry ?? 0;
  return [...movies].sort((a, b) => {
    switch (sort) {
      case "rating_desc":
        return (
          value(b.rating) - value(a.rating) || value(b.votes) - value(a.votes)
        );
      case "votes_desc":
        return value(b.votes) - value(a.votes);
      case "release_desc":
        return (
          value(b.year) - value(a.year) ||
          value(b.popularity) - value(a.popularity)
        );
      case "popularity_desc":
      case "revenue_desc":
      default:
        return value(b.popularity) - value(a.popularity);
    }
  });
}

function discoverHref(
  filters: DiscoverFiltersType,
  page?: number,
  view?: string,
) {
  const params = new URLSearchParams();
  if (filters.media === "serie") params.set("medium", "serie");
  if (filters.genreIds.length > 0) {
    params.set("genre", filters.genreIds.join(","));
    if (filters.genreIds.length > 1 && filters.genreMode === "or") {
      params.set("genreMode", "or");
    }
  }
  if (filters.year) params.set("year", String(filters.year));
  else if (filters.decade) params.set("decade", String(filters.decade));
  if (filters.minRating > 0) params.set("minRating", String(filters.minRating));
  if (filters.minVotes !== 1000) params.set("minVotes", String(filters.minVotes));
  if (filters.language) params.set("language", filters.language);
  if (filters.sort !== "rating_desc" && filters.sort !== "relevance") {
    params.set("sort", filters.sort);
  }
  const size = pageSizeParam(filters.perPage ?? 24, 24);
  if (size) params.set("size", size);
  if (view && view !== "standard") params.set("view", view);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/entdecken?${query}` : "/entdecken";
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale: Locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const params = await searchParams;
  const media: MediaType = single(params.medium) === "serie" ? "serie" : "movie";
  const q = (single(params.q) ?? "").trim();
  const searchActive = q.length >= 2;

  const genreIds = [
    ...new Set(
      (single(params.genre) ?? "")
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isInteger(entry) && isTmdbGenreId(entry, media)),
    ),
  ].slice(0, 5);
  const genreMode = single(params.genreMode) === "or" ? "or" : "and";

  const yearRaw = Math.round(numeric(params.year, 0));
  const year =
    yearRaw >= 1900 && yearRaw <= CURRENT_YEAR + 2 ? yearRaw : null;
  const decadeRaw = Math.round(numeric(params.decade, 0));
  const decade =
    !year && decadeRaw >= 1900 && decadeRaw <= 2030 && decadeRaw % 10 === 0
      ? decadeRaw
      : null;

  const minRating = clamp(numeric(params.minRating, 0), 0, 10);
  const minVotes = Math.round(clamp(numeric(params.minVotes, 1000), 0, 1_000_000));
  const languageRaw = (single(params.language) ?? "").toLowerCase();
  const language = /^[a-z]{2}$/.test(languageRaw) ? languageRaw : null;
  const sortRaw = single(params.sort) as DiscoverSort | undefined;
  const defaultSort: DiscoverSort = searchActive ? "relevance" : "rating_desc";
  const sort =
    sortRaw &&
    SORT_KEYS.includes(sortRaw) &&
    (searchActive || sortRaw !== "relevance")
      ? sortRaw
      : defaultSort;
  const page = Math.round(clamp(numeric(params.page, 1), 1, 500));
  const perPage = parsePageSize(
    single(params.size),
    SEARCH_PAGE_SIZES,
    24,
    { max: MAX_DISCOVER_PAGE_SIZE },
  );
  const sizeParam = pageSizeParam(perPage, 24);
  const view = parseGridLayout(single(params.view));

  const filters: DiscoverFiltersType = {
    media,
    genreIds,
    genreMode,
    year,
    decade,
    minRating,
    minVotes,
    language,
    sort,
    page,
    perPage,
  };

  const current: DiscoverFilterState = {
    media,
    q,
    genreIds,
    genreMode,
    year: year ? String(year) : "",
    decade: decade ? String(decade) : "",
    minRating: String(minRating),
    minVotes: String(minVotes),
    language: language ?? "",
    sort,
    size: sizeParam,
    view: view !== "standard" ? view : undefined,
  };
  const filterKey = [
    media,
    q,
    genreIds.join(","),
    genreMode,
    current.year,
    current.decade,
    current.minRating,
    current.minVotes,
    current.language,
    current.sort,
    current.size,
    current.view,
  ].join("|");

  const configured = hasTmdbCredentials();
  const stats = getStats(media);
  const lists = getLists().map((list) => ({
    id: list.id,
    name: list.name,
    count: list.count,
  }));

  let result: Awaited<ReturnType<typeof discoverTmdb>> | null = null;
  let searchResults: DiscoverMovie[] | null = null;
  let searchMatched = 0;
  let searchAvailable = 0;
  let searchPage = page;
  let searchTotalPages = 1;
  let searchCapped = false;
  let error: string | null = null;
  if (configured) {
    try {
      if (searchActive) {
        const pool = await searchTmdbPool(q, media, locale);
        const matched = pool.movies.filter((movie) =>
          matchesFilters(movie, filters),
        );
        const ordered = sortSearchHits(matched, sort);
        searchMatched = ordered.length;
        searchAvailable = pool.totalResults;
        const effectivePerPage =
          perPage === ALL_PAGE_SIZE
            ? Math.max(1, ordered.length)
            : perPage;
        searchTotalPages = Math.max(
          1,
          Math.ceil(ordered.length / effectivePerPage),
        );
        searchPage = Math.min(page, searchTotalPages);
        searchResults = ordered.slice(
          (searchPage - 1) * effectivePerPage,
          searchPage * effectivePerPage,
        );
        searchCapped = pool.capped;
      } else {
        result = await discoverTmdb(
          {
            ...filters,
            perPage:
              perPage === ALL_PAGE_SIZE ? MAX_DISCOVER_PAGE_SIZE : perPage,
          },
          locale,
        );
      }
    } catch (caught) {
      error =
        caught instanceof Error
          ? caught.message
          : t(
              "TMDB konnte nicht abgefragt werden.",
              "TMDB could not be queried.",
            );
    }
  }

  const shown = searchActive ? searchResults : result?.movies ?? null;
  const archivedCount = shown?.filter((movie) => movie.alreadyInDb).length ?? 0;

  const nextHref = result?.nextPage
    ? discoverHref(filters, result.nextPage, view)
    : null;
  const prevHref =
    !searchActive && page > 1
      ? discoverHref(filters, page - 1, view)
      : null;

  const defaultMinVotes = 1000;
  const filterParams: Record<string, string | undefined> = {
    medium: media === "serie" ? "serie" : undefined,
    q: q || undefined,
    genre: genreIds.length ? genreIds.join(",") : undefined,
    genreMode:
      genreIds.length > 1 && genreMode === "or" ? "or" : undefined,
    year: year ? String(year) : undefined,
    decade: decade ? String(decade) : undefined,
    minRating: minRating > 0 ? String(minRating) : undefined,
    minVotes:
      minVotes !== defaultMinVotes ? String(minVotes) : undefined,
    language: language ?? undefined,
    sort: sort !== defaultSort ? sort : undefined,
    size: sizeParam,
    view: view !== "standard" ? view : undefined,
  };
  const searchPagerParams = filterParams;
  const controlParams = filterParams;

  const noun = media === "serie" ? t("Serien", "series") : t("Filme", "films");
  const singular = media === "serie" ? t("Serie", "series") : t("Film", "film");
  const resetHref = media === "serie" ? "/entdecken?medium=serie" : "/entdecken";

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <p className="eyebrow">{t("Frischer Stoff", "Fresh material")}</p>
          <h1 className="display mt-3 text-5xl text-cream sm:text-6xl">
            {t("Neu entdecken", "Discover")}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            {t(
              `${media === "serie" ? "Serien" : "Filme"}, die noch nicht in deinem Archiv sind – gefiltert nach Genre, Jahr, TMDB-Bewertung, Stimmen und Originalsprache. Über das Suchfeld findest du gezielt einzelne Titel, auch solche, die schon im Archiv liegen. Kombiniere die Filter, wie du magst, und übernimm Treffer mit einem Klick ins Archiv oder direkt auf eine deiner Listen.`,
              `${media === "serie" ? "Series" : "Films"} that are not in your archive yet – filtered by genre, year, TMDB rating, votes and original language. Use the search field to find specific titles, including ones already in the archive. Combine the filters however you like and move results into the archive or straight onto one of your lists with a single click.`,
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MediaSwitch
            current={media}
            hrefs={{
              movie: "/entdecken",
              serie: "/entdecken?medium=serie",
            }}
          />
          <span className="chip">
            {media === "serie" ? (
              <Tv className="size-3 text-gold" />
            ) : (
              <Film className="size-3 text-gold" />
            )}
            {formatInt(stats.count, locale)} {t("im Archiv", "in archive")}
          </span>
          <Link href="/listen" className="btn-ghost">
            <Compass className="size-3.5" />
            {t("Listen", "Lists")}
          </Link>
        </div>
      </div>

      {!configured ? (
        <div className="mt-8 rounded-2xl border border-gold/25 bg-gold/[0.05] p-6">
          <p className="flex items-center gap-2 text-sm text-gold">
            <TriangleAlert className="size-4" />
            {t(
              "Für die Entdeckung wird ein TMDB-Key benötigt.",
              "A TMDB key is required for discovery.",
            )}
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            {t(
              "Hinterlege einen API-Key in den Einstellungen oder in der",
              "Add an API key in the settings or in",
            )}
            <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-cream">
              .env.local
            </code>
            {t(
              ". Danach kannst du hier nach Bewertung, Genre, Jahr und mehr stöbern.",
              ". You can then browse by rating, genre, year and more.",
            )}
          </p>
          <Link
            href="/admin?tab=einstellungen"
            className="mt-4 inline-flex text-xs text-gold hover:text-gold-soft"
          >
            {t("Jetzt hinterlegen", "Add it now")}
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8">
            <DiscoverFilters
              key={filterKey}
              current={current}
              years={YEARS}
              decades={DECADES}
            />
          </div>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-soft pb-4">
              <div>
                <p className="eyebrow">
                  {searchActive
                    ? t("Suchergebnisse", "Search results")
                    : t("Aus TMDB", "From TMDB")}
                </p>
                <h2 className="display mt-2 text-3xl text-cream">
                  {searchActive
                    ? t(`Treffer für „${q}“`, `Results for “${q}”`)
                    : shown
                      ? `${formatInt(shown.length, locale)} ${pluralFor(
                          locale,
                          shown.length,
                          singular,
                          noun,
                          singular,
                          noun,
                        )}`
                      : media === "serie"
                        ? t("Serien für dich", "Series for you")
                        : t("Filme für dich", "Films for you")}
                </h2>
              </div>
              {shown ? (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-2">
                  <span>
                    {searchActive
                      ? !searchCapped && searchMatched < searchAvailable
                        ? t(
                            `${formatInt(searchMatched, locale)} von ${formatInt(searchAvailable, locale)} Treffern`,
                            `${formatInt(searchMatched, locale)} of ${formatInt(searchAvailable, locale)} results`,
                          )
                        : t(
                            `${formatInt(searchMatched, locale)} Treffer`,
                            `${formatInt(searchMatched, locale)} results`,
                          )
                      : t(
                          `${formatInt(result?.totalResults ?? 0, locale)} Treffer bei TMDB`,
                          `${formatInt(result?.totalResults ?? 0, locale)} results on TMDB`,
                        )}
                  </span>
                  {archivedCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-muted">
                      <EyeOff className="size-3" />
                      {t(
                        `${formatInt(archivedCount, locale)} bereits im Archiv`,
                        `${formatInt(archivedCount, locale)} already in the archive`,
                      )}
                    </span>
                  ) : !searchActive && (result?.hiddenExisting ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 text-muted">
                      <EyeOff className="size-3" />
                      {t(
                        `${formatInt(result?.hiddenExisting ?? 0, locale)} bereits im Archiv`,
                        `${formatInt(result?.hiddenExisting ?? 0, locale)} already in the archive`,
                      )}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-muted-2">
                {searchActive
                  ? t(
                      `Seite ${searchPage} von ${searchTotalPages}`,
                      `Page ${searchPage} of ${searchTotalPages}`,
                    )
                  : t(
                      `Seite ${page}`,
                      `Page ${page}`,
                    )}
              </p>
              <ListControls
                basePath="/entdecken"
                params={controlParams}
                pageSize={perPage}
                pageSizeOptions={SEARCH_PAGE_SIZES}
                layout={view}
                maxPageSize={MAX_DISCOVER_PAGE_SIZE}
                sizeLabel={{
                  de: "Treffer pro Seite",
                  en: "Results per page",
                }}
              />
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-rust/30 bg-rust/10 p-6 text-sm text-[#f0a08e]">
                <p className="flex items-center gap-2 font-medium">
                  <TriangleAlert className="size-4" />
                  {t("Abfrage fehlgeschlagen", "Query failed")}
                </p>
                <p className="mt-2 text-xs leading-relaxed">{error}</p>
                <Link
                  href={resetHref}
                  className="mt-4 inline-flex text-xs text-gold hover:text-gold-soft"
                >
                  {t("Filter zurücksetzen", "Reset filters")}
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </div>
            ) : shown && shown.length > 0 ? (
              <>
                <div className="mt-6">
                  <DiscoverResults movies={shown} lists={lists} layout={view} />
                </div>
                <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line-soft pt-6">
                  <p className="text-[11px] text-muted-2">
                    {searchActive
                      ? t(
                          "Treffer aus TMDB – bereits archivierte Titel sind markiert und lassen sich direkt öffnen.",
                          "Results from TMDB – already archived titles are marked and can be opened directly.",
                        )
                      : t(
                          `Bewertung und Stimmen stammen von TMDB. Bereits vorhandene ${noun} werden automatisch ausgeblendet.`,
                          `Ratings and votes come from TMDB. Existing ${noun} are hidden automatically.`,
                        )}
                    {searchActive && searchCapped ? (
                      <span className="mt-1 block">
                        {t(
                          "Die Suche berücksichtigt die ersten 200 TMDB-Treffer. Präzisiere die Suche, um mehr zu sehen.",
                          "The search considers the first 200 TMDB results. Refine the query to see more.",
                        )}
                      </span>
                    ) : null}
                  </p>
                  {searchActive ? (
                    <span className="text-[11px] text-muted-2">
                      {t(
                        "Alle Treffer lassen sich unten durchblättern.",
                        "Browse all results with the pager below.",
                      )}
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {prevHref ? (
                        <Link href={prevHref} className="btn-ghost h-9 px-4 text-xs">
                          <ArrowLeft className="size-3.5" />
                          {t("Zurück", "Back")}
                        </Link>
                      ) : null}
                      {nextHref ? (
                        <Link href={nextHref} className="btn-ghost h-9 px-4 text-xs">
                          {t(`Mehr ${noun} zeigen`, `Show more ${noun}`)}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      ) : (
                        <span className="text-[11px] text-muted-2">
                          {t("Ende der Trefferliste erreicht.", "End of results reached.")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {searchActive ? (
                  <Pagination
                    page={searchPage}
                    totalPages={searchTotalPages}
                    basePath="/entdecken"
                    params={searchPagerParams}
                    locale={locale}
                  />
                ) : null}
              </>
            ) : (
              <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line bg-surface/40 p-8">
                <span className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                  <Sparkles className="size-5 text-gold" />
                </span>
                <div>
                  <h3 className="display text-3xl text-cream">
                    {searchActive
                      ? t(`Keine Treffer für „${q}“`, `No results for “${q}”`)
                      : t(
                          `Keine neuen ${noun} für diese Filter.`,
                          `No new ${noun} for these filters.`,
                        )}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                    {searchActive
                      ? t(
                          "Prüfe die Schreibweise oder suche nach dem Originaltitel. Alternativ kannst du mit den Filtern unten stöbern.",
                          "Check the spelling or search for the original title. You can also browse with the filters above.",
                        )
                      : t(
                          "Locker die Bewertung oder Mindeststimmen, wähle ein anderes Genre oder setze die Filter zurück.",
                          "Loosen the rating or minimum votes, choose another genre or reset the filters.",
                        )}
                  </p>
                </div>
                <Link href={resetHref} className="btn-primary h-9 px-4 text-xs">
                  {t("Alle Filter zurücksetzen", "Reset all filters")}
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
