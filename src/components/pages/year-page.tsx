import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Film,
  ListX,
  Sparkles,
  Tv,
} from "lucide-react";
import { ListFilter } from "@/components/list-filter";
import { ListControls } from "@/components/list-controls";
import { MovieCard } from "@/components/movie-card";
import { Pagination } from "@/components/pagination";
import { Poster } from "@/components/poster";
import { ScoreBadge } from "@/components/score-badge";
import { contentGenres, contentTitle } from "@/lib/content";
import { formatInt, formatScore } from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import {
  ALL_PAGE_SIZE,
  CATALOG_PAGE_SIZES,
  gridClassName,
  pageSizeParam,
  parseGridLayout,
  parsePageSize,
} from "@/lib/layout";
import { getListOptions } from "@/lib/lists";
import { pluralFor, tr, type Locale } from "@/lib/locale";
import { getMovies, getSeriesStates, getYearsWithMovies } from "@/lib/movies";
import type { MediaType } from "@/lib/types";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function YearPage({
  media,
  rawYear,
  searchParams,
}: {
  media: MediaType;
  rawYear: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const year = Number(rawYear);
  if (!Number.isInteger(year) || year < 1800 || year > 2200) notFound();

  const locale: Locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const params = searchParams ? await searchParams : {};
  const listRaw = Number(single(params.list));
  const listId = Number.isFinite(listRaw) && listRaw > 0 ? listRaw : undefined;
  const perPage = parsePageSize(
    single(params.size),
    CATALOG_PAGE_SIZES,
    ALL_PAGE_SIZE,
  );
  const view = parseGridLayout(single(params.view));
  const requestedPage = Math.max(1, Math.round(Number(single(params.page)) || 1));
  const lists = getListOptions();
  const activeList = listId ? lists.find((entry) => entry.id === listId) : null;

  const isSerie = media === "serie";
  const noun = isSerie ? t("Serien", "series") : t("Filme", "films");
  const singular = isSerie ? t("Serie", "series") : t("Film", "film");
  const basePath = isSerie ? "/serien/jahre" : "/jahre";
  const catalogPath = isSerie ? "/serien" : "/filme";
  const Icon = isSerie ? Tv : Film;
  const listQuery = listId ? `list=${listId}` : "";
  const controlParams: Record<string, string | undefined> = {
    list: listId ? String(listId) : undefined,
    size: pageSizeParam(perPage, ALL_PAGE_SIZE),
    view: view !== "standard" ? view : undefined,
  };
  const navQuery = [
    listQuery,
    controlParams.size ? `size=${controlParams.size}` : "",
    controlParams.view ? `view=${controlParams.view}` : "",
  ]
    .filter(Boolean)
    .join("&");

  const allResult = getMovies({
    media,
    year,
    listId,
    pageSize: ALL_PAGE_SIZE,
    sort: "score_desc",
  });
  if (allResult.total === 0) {
    if (listId) {
      return (
        <div className="container-page py-12 lg:py-16">
          <Link
            href={`${basePath}/${year}`}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-cream"
          >
            <ArrowLeft className="size-3.5" />
            {t("Ohne Listenfilter", "Without list filter")}
          </Link>
          <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line bg-surface/40 p-8">
            <span className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <ListX className="size-5 text-gold" />
            </span>
            <h1 className="display text-3xl text-cream">
              {t(
                `Keine Titel aus dieser Liste im Jahr ${year}.`,
                `No titles from this list in ${year}.`,
              )}
            </h1>
            <Link
              href={`${catalogPath}?list=${listId}`}
              className="btn-primary h-9 px-4 text-xs"
            >
              {t("Liste im Archiv öffnen", "Open list in archive")}
            </Link>
          </div>
        </div>
      );
    }
    notFound();
  }

  const years = getYearsWithMovies(media);
  const index = years.findIndex((entry) => entry.year === year);
  const newer = index > 0 ? years[index - 1] : null;
  const older = index >= 0 && index < years.length - 1 ? years[index + 1] : null;
  const decade = Math.floor(year / 10) * 10;
  const total = allResult.total;
  const effectivePerPage =
    perPage === ALL_PAGE_SIZE ? Math.max(1, total) : perPage;
  const totalPages = Math.max(1, Math.ceil(total / effectivePerPage));
  const page = Math.min(requestedPage, totalPages);
  const movies =
    perPage === ALL_PAGE_SIZE
      ? allResult.movies
      : allResult.movies.slice(
          (page - 1) * effectivePerPage,
          page * effectivePerPage,
        );
  const best = allResult.movies[0] ?? null;
  const average =
    allResult.movies.length > 0
      ? Math.round(
          (allResult.movies.reduce((sum, movie) => sum + movie.totalScore, 0) /
            allResult.movies.length) *
            10,
        ) / 10
      : 0;
  const seriesStates = isSerie
    ? getSeriesStates(movies.map((movie) => movie.id))
    : undefined;

  return (
    <div className="container-page py-12 lg:py-16">
      <Link
        href={basePath}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-cream"
      >
        <ArrowLeft className="size-3.5" />
        {t("Alle Jahrgänge", "All years")}
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ListFilter
          lists={lists}
          value={listId ? String(listId) : ""}
          basePath={`${basePath}/${year}`}
          params={{ size: controlParams.size, view: controlParams.view }}
        />
        {activeList ? (
          <span className="text-[11px] text-gold">
            {t("Liste", "List")}: {activeList.name}
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid items-end gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="eyebrow">{t("Jahrgang", "Year")}</p>
          <h1 className="display mt-3 text-[clamp(4rem,14vw,9rem)] leading-[0.85] text-cream tabular-nums">
            {year}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            {t(
              `${formatInt(total, locale)} ${pluralFor(
                locale,
                total,
                singular,
                noun,
                singular,
                noun,
              )} aus dem Jahrgang ${year} – sortiert nach aktuellem Filmgold-Score.${
                best ? ` Angeführt von „${contentTitle(best, locale)}“.` : ""
              }`,
              `${formatInt(total, locale)} ${pluralFor(
                locale,
                total,
                singular,
                noun,
                singular,
                noun,
              )} from ${year} – sorted by current Filmgold score.${
                best ? ` Led by “${contentTitle(best, locale)}”.` : ""
              }`,
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="chip">
              <Icon className="size-3 text-gold" />
              {formatInt(total, locale)}{" "}
              {pluralFor(locale, total, singular, noun, singular, noun)}
            </span>
            <span className="chip">
              <Sparkles className="size-3 text-gold" />
              {t("Ø", "Avg.")}{" "}
              {formatScore(average, 1, locale)}
            </span>
            <Link
              href={`${catalogPath}?year=${year}${listQuery ? `&${listQuery}` : ""}`}
              className="chip transition-colors hover:border-gold/40 hover:text-gold"
            >
              {t("Im Archiv filtern", "Filter in archive")}
            </Link>
            <Link
              href={`${catalogPath}?decade=${decade}${listQuery ? `&${listQuery}` : ""}`}
              className="chip transition-colors hover:border-gold/40 hover:text-gold"
            >
              {t(`${decade}er öffnen`, `Open ${decade}s`)}
            </Link>
          </div>
        </div>

        {best ? (
          <Link
            href={`${catalogPath}/${best.slug}`}
            className="group relative mx-auto w-full max-w-[280px] lg:ml-auto"
          >
            <Poster
              movie={best}
              imageSize="w500"
              sizes="(max-width: 1024px) 70vw, 280px"
              eager
              className="shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
            />
            <div className="mt-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gold">
                  {isSerie
                    ? t("Beste Serie", "Best series")
                    : t("Bester Film", "Best film")}{" "}
                  {year}
                </p>
                <p className="mt-1 truncate text-sm text-cream group-hover:text-gold">
                  {contentTitle(best, locale)}
                </p>
                <p className="truncate text-[10px] text-muted-2">
                  {contentGenres(best, locale).slice(0, 2).join(", ")}
                </p>
              </div>
              <ScoreBadge score={best.totalScore} size="md" locale={locale} />
            </div>
          </Link>
        ) : null}
      </div>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4 border-b border-line-soft pb-4">
          <div>
            <p className="eyebrow">
              {isSerie ? t("Alle Serien", "All series") : t("Alle Filme", "All films")}
            </p>
            <h2 className="display mt-2 text-3xl text-cream">
              {formatInt(total, locale)}{" "}
              {t("aus", "from")} {year}
            </h2>
          </div>
          <p className="text-[11px] text-muted-2">
            <CalendarDays className="mr-1 inline size-3" />
            {t(`${decade}er`, `${decade}s`)}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-muted-2">
            {t(
              `Seite ${page} von ${totalPages}`,
              `Page ${page} of ${totalPages}`,
            )}
          </p>
          <ListControls
            basePath={`${basePath}/${year}`}
            params={controlParams}
            pageSize={perPage}
            pageSizeOptions={CATALOG_PAGE_SIZES}
            layout={view}
          />
        </div>
        <div className={`mt-6 grid ${gridClassName(view)}`}>
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
              seriesState={seriesStates?.get(movie.id)}
              locale={locale}
            />
          ))}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath={`${basePath}/${year}`}
          params={controlParams}
          locale={locale}
        />
      </section>

      <nav className="mt-12 flex flex-wrap items-stretch justify-between gap-3 border-t border-line-soft pt-6">
        {older ? (
          <Link
            href={`${basePath}/${older.year}${navQuery ? `?${navQuery}` : ""}`}
            className="group flex items-center gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:border-gold/40"
          >
            <ChevronLeft className="size-4 text-muted-2 group-hover:text-gold" />
            <span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-2">
                {t("Älter", "Older")}
              </span>
              <span className="text-sm text-cream group-hover:text-gold">
                {older.year}
              </span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        <Link
          href={basePath}
          className="flex items-center gap-2 self-center text-xs text-muted hover:text-gold"
        >
          {t("Alle Jahre", "All years")} <ArrowRight className="size-3.5" />
        </Link>
        {newer ? (
          <Link
            href={`${basePath}/${newer.year}${navQuery ? `?${navQuery}` : ""}`}
            className="group flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-right transition-colors hover:border-gold/40"
          >
            <span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-2">
                {t("Neuer", "Newer")}
              </span>
              <span className="text-sm text-cream group-hover:text-gold">
                {newer.year}
              </span>
            </span>
            <ChevronRight className="size-4 text-muted-2 group-hover:text-gold" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
