import Link from "next/link";
import { ArrowRight, ListX } from "lucide-react";
import { ListControls } from "@/components/list-controls";
import { ListFilter } from "@/components/list-filter";
import { MovieCard } from "@/components/movie-card";
import { YearJump } from "@/components/year-jump";
import { contentTitle } from "@/lib/content";
import { formatInt, formatScore } from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import {
  pageSizeParam,
  parseGridLayout,
  parsePageSize,
  previewCardSizes,
  previewGridClassName,
  YEAR_PREVIEW_SIZES,
  ALL_PAGE_SIZE,
} from "@/lib/layout";
import { getListMovieIds, getListOptions } from "@/lib/lists";
import { tr, pluralFor, type Locale } from "@/lib/locale";
import { getSeriesStates, getYearsWithMovies } from "@/lib/movies";
import type { MediaType } from "@/lib/types";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function YearsPage({
  media,
  searchParams,
}: {
  media: MediaType;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale: Locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const params = searchParams ? await searchParams : {};
  const listRaw = Number(single(params.list));
  const listId = Number.isFinite(listRaw) && listRaw > 0 ? listRaw : undefined;
  const preview = parsePageSize(single(params.preview), YEAR_PREVIEW_SIZES, 4);
  const view = parseGridLayout(single(params.view));
  const viewParams: Record<string, string | undefined> = {
    list: listId ? String(listId) : undefined,
    preview: pageSizeParam(preview, 4),
    view: view !== "standard" ? view : undefined,
  };
  const lists = getListOptions();
  const allowed = listId ? new Set(getListMovieIds(listId)) : null;
  const activeList = listId ? lists.find((entry) => entry.id === listId) : null;

  const allYears = getYearsWithMovies(media);
  const years = (allowed
    ? allYears
        .map((entry) => ({
          year: entry.year,
          movies: entry.movies.filter((movie) => allowed.has(movie.id)),
        }))
        .filter((entry) => entry.movies.length > 0)
    : allYears
  );
  const visibleMovies = years.flatMap((entry) => entry.movies);
  const totalCount = visibleMovies.length;
  const decadeCount = new Set(
    years.map((entry) => Math.floor(entry.year / 10) * 10),
  ).size;
  const avgScore = totalCount
    ? Math.round(
        (visibleMovies.reduce((sum, movie) => sum + movie.totalScore, 0) /
          totalCount) *
          10,
      ) / 10
    : 0;

  const decades = new Map<number, typeof years>();
  for (const entry of years) {
    const decade = Math.floor(entry.year / 10) * 10;
    const list = decades.get(decade) ?? [];
    list.push(entry);
    decades.set(decade, list);
  }
  const decadeEntries = [...decades.entries()].sort((a, b) => b[0] - a[0]);
  const isSerie = media === "serie";
  const noun = isSerie ? t("Serien", "series") : t("Filme", "films");
  const singular = isSerie ? t("Serie", "series") : t("Film", "film");
  const basePath = isSerie ? "/serien/jahre" : "/jahre";
  const catalogPath = isSerie ? "/serien" : "/filme";
  const visibleIds = visibleMovies.map((movie) => movie.id);
  const seriesStates = isSerie ? getSeriesStates(visibleIds) : undefined;

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="max-w-3xl">
        <p className="eyebrow">{t("Chronik", "Chronicle")}</p>
        <h1 className="display mt-3 text-5xl text-cream sm:text-6xl">
          {t("Jahr für Jahr", "Year by year")}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            `${formatInt(totalCount, locale)} ${pluralFor(
              locale,
              totalCount,
              singular,
              noun,
              singular,
              noun,
            )} aus ${formatInt(years.length, locale)} ${pluralFor(
              locale,
              years.length,
              "Jahrgang",
              "Jahrgängen",
              "year",
              "years",
            )} und ${formatInt(decadeCount, locale)} ${pluralFor(
              locale,
              decadeCount,
              "Jahrzehnt",
              "Jahrzehnten",
              "decade",
              "decades",
            )}. Spring direkt in ein einzelnes Jahr oder stöbere durch die Dekaden.`,
            `${formatInt(totalCount, locale)} ${pluralFor(
              locale,
              totalCount,
              singular,
              noun,
              singular,
              noun,
            )} from ${formatInt(years.length, locale)} ${pluralFor(
              locale,
              years.length,
              "Jahrgang",
              "Jahrgängen",
              "year",
              "years",
            )} and ${formatInt(decadeCount, locale)} ${pluralFor(
              locale,
              decadeCount,
              "Jahrzehnt",
              "Jahrzehnten",
              "decade",
              "decades",
            )}. Jump straight to a year or browse by decade.`,
          )}
        </p>
        {activeList ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1 text-[11px] text-gold">
            {t("Gefiltert nach Liste", "Filtered by list")}: {activeList.name}
            <Link href={basePath} className="text-muted hover:text-cream">
              {t("zurücksetzen", "reset")}
            </Link>
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ListFilter
          lists={lists}
          value={listId ? String(listId) : ""}
          basePath={basePath}
          params={{
            preview: viewParams.preview,
            view: viewParams.view,
          }}
        />
        {listId ? (
          <Link
            href={`${catalogPath}?list=${listId}`}
            className="chip transition-colors hover:border-gold/40 hover:text-gold"
          >
            {t("Liste im Archiv öffnen", "Open list in archive")}{" "}
            <ArrowRight className="size-3" />
          </Link>
        ) : null}
        <ListControls
          basePath={basePath}
          params={viewParams}
          pageSize={preview}
          pageSizeOptions={YEAR_PREVIEW_SIZES}
          layout={view}
          sizeParam="preview"
          sizeLabel={{ de: "Vorschau pro Jahr", en: "Preview per year" }}
          className="sm:ml-auto"
        />
      </div>

      {years.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line bg-surface/40 p-8">
          <span className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <ListX className="size-5 text-gold" />
          </span>
          <div>
            <h2 className="display text-3xl text-cream">
              {t("Keine Titel in dieser Liste.", "No titles in this list.")}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {t(
                "Füge über die Karten im Archiv Titel hinzu – oder wähle eine andere Liste.",
                "Add titles via the cards in the archive – or choose another list.",
              )}
            </p>
          </div>
          <Link href={catalogPath} className="btn-primary h-9 px-4 text-xs">
            {t("Zum Archiv", "Go to archive")}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <YearJump
              years={years.map((entry) => entry.year)}
              basePath={basePath}
              listId={listId}
            />
            <details className="surface-card p-4">
              <summary className="cursor-pointer text-xs font-medium text-cream">
                {t(
                  `Alle ${formatInt(years.length, locale)} Jahrgänge als Schnellzugriff`,
                  `All ${formatInt(years.length, locale)} years at a glance`,
                )}
              </summary>
              <div className="mt-3 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {years.map(({ year, movies }) => (
                  <Link
                    key={year}
                    href={`${basePath}/${year}${listId ? `?list=${listId}` : ""}`}
                    className="chip text-[10px] transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    {year}
                    <span className="text-[9px] text-muted-2">{movies.length}</span>
                  </Link>
                ))}
              </div>
            </details>
          </div>

          <nav className="no-scrollbar sticky top-16 z-30 -mx-4 mt-8 flex gap-2 overflow-x-auto border-y border-line-soft bg-bg/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-full sm:border sm:px-3">
            {decadeEntries.map(([decade, entries]) => (
              <a
                key={decade}
                href={`#jahrzehnt-${decade}`}
                className="chip shrink-0 transition-colors hover:border-gold/40 hover:text-gold"
              >
                {t(`${decade}er`, `${decade}s`)}
                <span className="text-[9px] text-muted-2">{entries.length}</span>
              </a>
            ))}
          </nav>

          <div className="mt-10 space-y-16">
            {decadeEntries.map(([decade, entries]) => {
              const count = entries.reduce(
                (sum, entry) => sum + entry.movies.length,
                0,
              );
              return (
                <section key={decade} id={`jahrzehnt-${decade}`} className="scroll-mt-32">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <h2 className="display text-4xl text-gold">
                        {t(`${decade}er`, `${decade}s`)}
                      </h2>
                      <p className="mt-1 text-xs text-muted">
                        {formatInt(count, locale)}{" "}
                        {pluralFor(locale, count, singular, noun, singular, noun)}{" "}
                        {t("in", "across")} {entries.length}{" "}
                        {pluralFor(
                          locale,
                          entries.length,
                          "Jahr",
                          "Jahren",
                          "year",
                          "years",
                        )}
                      </p>
                    </div>
                    <Link
                      href={`${catalogPath}?decade=${decade}${listId ? `&list=${listId}` : ""}`}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-gold"
                    >
                      {t("Ganzes Jahrzehnt", "Whole decade")}{" "}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>

                  <div className="mt-6">
                    {entries.map(({ year, movies }) => {
                      const shown =
                        preview === ALL_PAGE_SIZE
                          ? movies
                          : movies.slice(0, preview);
                      return (
                      <div
                        key={year}
                        id={`jahr-${year}`}
                        className="grid scroll-mt-28 gap-5 border-t border-line-soft py-6 md:grid-cols-[130px_1fr]"
                      >
                        <div className="flex items-baseline gap-3 md:block">
                          <p className="display text-3xl leading-none text-cream tabular-nums">
                            {year}
                          </p>
                          <Link
                            href={`${basePath}/${year}${listId ? `?list=${listId}` : ""}`}
                            className="mt-0 text-[11px] text-muted transition-colors hover:text-gold md:mt-2 md:block"
                          >
                            {movies.length}{" "}
                            {pluralFor(locale, movies.length, singular, noun, singular, noun)} →
                          </Link>
                        </div>
                        <div className={`grid ${previewGridClassName(view)}`}>
                          {shown.map((movie) => (
                            <MovieCard
                              key={movie.id}
                              movie={movie}
                              sizes={previewCardSizes(view)}
                              seriesState={seriesStates?.get(movie.id)}
                              locale={locale}
                            />
                          ))}
                          {preview !== ALL_PAGE_SIZE && movies.length > preview ? (
                            <Link
                              href={`${basePath}/${year}${listId ? `?list=${listId}` : ""}`}
                              className="group flex aspect-2/3 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-center transition-colors hover:border-gold/40"
                            >
                              <span className="display text-3xl text-muted group-hover:text-gold">
                                +{movies.length - preview}
                              </span>
                              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
                                {t(`Alle ${year}`, `All ${year}`)}
                              </span>
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <p className="mt-16 border-t border-line-soft pt-6 text-[11px] text-muted-2">
            {t(
              `${
                isSerie ? "Bestbewertete Serie" : "Bestbewerteter Film"
              } je Jahr nach aktuellem Filmgold-Score: `,
              `Highest-rated ${isSerie ? "series" : "film"} per year by current Filmgold score: `,
            )}
            {years[0] && years[0].movies[0]
              ? `${contentTitle(years[0].movies[0], locale)} (${years[0].year})`
              : "–"}{" "}
            · {formatScore(avgScore, 1, locale)}{" "}
            {t("durchschnittlicher Score im Archiv.", "average score in the archive.")}
          </p>
        </>
      )}
    </div>
  );
}
