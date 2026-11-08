import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Heart, ListChecks, Star } from "lucide-react";
import { MediaSwitch } from "@/components/media-switch";
import { ListControls } from "@/components/list-controls";
import { MovieCard } from "@/components/movie-card";
import { Pagination } from "@/components/pagination";
import { contentTitle, genreLabel } from "@/lib/content";
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
import { pluralFor, tr, type Locale } from "@/lib/locale";
import { getMovies, getSeriesStates, getStats } from "@/lib/movies";
import type { MediaType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: tr(locale, "Meine Liste", "My list"),
    description: tr(
      locale,
      "Deine gesehenen Filme und Serien, Bewertungen und Favoriten – lokal in deinem Archiv.",
      "Your seen films and series, ratings and favourites – stored locally in your archive.",
    ),
  };
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MyListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale: Locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const params = await searchParams;
  const media: MediaType = single(params.medium) === "serie" ? "serie" : "movie";
  const isSerie = media === "serie";
  const pageSize = parsePageSize(
    single(params.size),
    CATALOG_PAGE_SIZES,
    ALL_PAGE_SIZE,
  );
  const view = parseGridLayout(single(params.view));
  const requestedPage = Math.max(1, Math.round(Number(single(params.page)) || 1));
  const noun = isSerie ? t("Serien", "series") : t("Filme", "films");
  const singular = isSerie ? t("Serie", "series") : t("Film", "film");
  const catalogPath = isSerie ? "/serien" : "/filme";
  const history = isSerie
    ? t("Seriengeschichte", "series history")
    : t("Filmgeschichte", "film history");

  const stats = getStats(media);
  const seen = getMovies({
    media,
    seen: "seen",
    pageSize: ALL_PAGE_SIZE,
    sort: "score_desc",
  });
  const movies = [...seen.movies].sort((a, b) => {
    if (b.myRating !== a.myRating) return (b.myRating ?? -1) - (a.myRating ?? -1);
    return b.totalScore - a.totalScore;
  });
  const perPage =
    pageSize === ALL_PAGE_SIZE ? Math.max(1, movies.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(movies.length / perPage));
  const page = Math.min(requestedPage, totalPages);
  const shownMovies = movies.slice((page - 1) * perPage, page * perPage);
  const controlParams: Record<string, string | undefined> = {
    medium: isSerie ? "serie" : undefined,
    size: pageSizeParam(pageSize, ALL_PAGE_SIZE),
    view: view === "standard" ? undefined : view,
  };
  const rated = movies.filter((movie) => movie.myRating !== null);
  const favorites = movies.filter((movie) => movie.favorite);
  const seriesStates = isSerie
    ? getSeriesStates(movies.map((movie) => movie.id))
    : undefined;
  const distribution = Array.from({ length: 10 }, (_, index) => {
    const value = index + 1;
    return {
      value,
      count: rated.filter((movie) => Math.round(movie.myRating ?? 0) === value).length,
    };
  });
  const maxBucket = Math.max(1, ...distribution.map((entry) => entry.count));
  const topGenres = new Map<string, number>();
  for (const movie of seen.movies) {
    for (const genre of movie.genres) {
      topGenres.set(genre, (topGenres.get(genre) ?? 0) + 1);
    }
  }
  const favoriteGenres = [...topGenres.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="max-w-3xl">
        <p className="eyebrow">{t("Dein Archiv", "Your archive")}</p>
        <h1 className="display mt-3 text-5xl text-cream sm:text-6xl">
          {t("Meine Liste", "My list")}
        </h1>
        <div className="mt-4">
          <MediaSwitch
            current={media}
            compact
            hrefs={{
              movie: "/meine-liste",
              serie: "/meine-liste?medium=serie",
            }}
          />
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {stats.seenCount > 0
            ? t(
                `${formatInt(stats.seenCount, locale)} ${
                  stats.seenCount === 1
                    ? isSerie
                      ? "gesehene Serie"
                      : "gesehener Film"
                    : `gesehene ${noun}`
                }, ${formatInt(stats.ratedCount, locale)} ${pluralFor(
                  locale,
                  stats.ratedCount,
                  "eigene Wertung",
                  "eigene Wertungen",
                  "own rating",
                  "own ratings",
                )}, ${formatInt(stats.favoriteCount, locale)} ${pluralFor(
                  locale,
                  stats.favoriteCount,
                  "Favorit",
                  "Favoriten",
                  "favourite",
                  "favourites",
                )}. Alles bleibt in deiner lokalen Datenbank.`,
                `${formatInt(stats.seenCount, locale)} ${pluralFor(
                  locale,
                  stats.seenCount,
                  singular,
                  noun,
                  singular,
                  noun,
                )} seen, ${formatInt(stats.ratedCount, locale)} ${pluralFor(
                  locale,
                  stats.ratedCount,
                  "eigene Wertung",
                  "eigene Wertungen",
                  "of your own rating",
                  "of your own ratings",
                )}, ${formatInt(stats.favoriteCount, locale)} ${pluralFor(
                  locale,
                  stats.favoriteCount,
                  "Favorit",
                  "Favoriten",
                  "favourite",
                  "favourites",
                )}. Everything stays in your local database.`,
              )
            : t(
                `Noch ist dein Archiv leer. Markiere ${noun} als gesehen und vergib deine eigene Wertung – hier entsteht deine ${history}.`,
                `Your archive is still empty. Mark ${noun} as seen and give your own rating – your ${history} starts here.`,
              )}
        </p>
      </div>

      {stats.seenCount === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-5 rounded-2xl border border-dashed border-line bg-surface/40 p-8 sm:p-12">
          <span className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <ListChecks className="size-5 text-gold" />
          </span>
          <div>
            <h2 className="display text-3xl text-cream">
              {isSerie
                ? t("Die erste Serie wartet.", "The first series is waiting.")
                : t("Der erste Film wartet.", "The first film is waiting.")}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              {t(
                `Öffne ${isSerie ? "eine Serie" : "einen Film"} und tippe auf „Als gesehen markieren“. Du kannst anschließend eine Wertung von 1 bis 10 vergeben und eine persönliche Notiz hinterlegen.`,
                `Open ${isSerie ? "a series" : "a film"} and tap “Mark as seen”. You can then give a rating from 1 to 10 and leave a personal note.`,
              )}
            </p>
          </div>
          <Link href={`${catalogPath}?seen=unseen`} className="btn-primary">
            {t(`${noun} durchgehen`, `Browse ${noun}`)} <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="surface-card p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                {t("Gesehen", "Seen")}
              </p>
              <p className="display mt-2 text-4xl text-cream">
                {formatInt(stats.seenCount, locale)}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {t("von", "of")} {formatInt(stats.count, locale)}{" "}
                {t("im Archiv", "in the archive")}
              </p>
            </div>
            <div className="surface-card p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                {t("Dein Durchschnitt", "Your average")}
              </p>
              <p className="display mt-2 text-4xl text-gold">
                {stats.avgMyRating
                  ? formatScore(stats.avgMyRating, 1, locale)
                  : "–"}
                <span className="ml-1 text-base text-muted">/10</span>
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {t("aus", "from")} {formatInt(stats.ratedCount, locale)}{" "}
                {pluralFor(
                  locale,
                  stats.ratedCount,
                  "Wertung",
                  "Wertungen",
                  "rating",
                  "ratings",
                )}
              </p>
            </div>
            <div className="surface-card p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                {t("Favoriten", "Favourites")}
              </p>
              <p className="display mt-2 flex items-center gap-2 text-4xl text-cream">
                {formatInt(stats.favoriteCount, locale)}
                <Heart className="size-5 fill-rust/70 text-rust" />
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {t("mit Herzmarkierung", "marked with a heart")}
              </p>
            </div>
            <div className="surface-card p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                {t("Lieblingsgenres", "Favourite genres")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {favoriteGenres.length > 0 ? (
                  favoriteGenres.map(([genre, count]) => (
                    <span key={genre} className="chip text-[10px]">
                      {genreLabel(genre, locale)}
                      <span className="text-muted-2">{count}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-2">
                    {t("Noch keine Daten", "No data yet")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {rated.length > 0 ? (
            <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
              <div className="surface-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted">
                    {t("Verteilung deiner Wertungen", "Distribution of your ratings")}
                  </p>
                  <p className="text-[10px] text-muted-2">
                    {t("1 = schwach · 10 = Meisterwerk", "1 = weak · 10 = masterpiece")}
                  </p>
                </div>
                <div className="mt-6 flex h-32 items-end gap-1.5">
                  {distribution.map((entry) => (
                    <div key={entry.value} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={`w-full rounded-t transition-all ${
                            entry.count > 0 ? "bg-gold/70" : "bg-white/[0.04]"
                          }`}
                          style={{
                            height: `${Math.max(4, (entry.count / maxBucket) * 100)}%`,
                          }}
                          title={t(
                            `${entry.count} ${pluralFor(
                              locale,
                              entry.count,
                              singular,
                              noun,
                              singular,
                              noun,
                            )} mit ${entry.value} Punkten`,
                            `${entry.count} ${pluralFor(
                              locale,
                              entry.count,
                              singular,
                              noun,
                              singular,
                              noun,
                            )} with ${entry.value} points`,
                          )}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-2">
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="surface-card flex flex-col justify-center p-5">
                <div className="flex items-center gap-2 text-gold">
                  <Star className="size-4 fill-current" />
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
                    {isSerie
                      ? t("Deine beste Serie", "Your best series")
                      : t("Dein bester Film", "Your best film")}
                  </p>
                </div>
                {rated[0] ? (
                  <>
                    <p className="display mt-3 text-2xl text-cream">
                      {contentTitle(rated[0], locale)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {rated[0].year} · {formatScore(rated[0].myRating, 1, locale)}/10
                    </p>
                    <Link
                      href={`${catalogPath}/${rated[0].slug}`}
                      className="mt-4 inline-flex items-center gap-1 text-xs text-gold hover:text-gold-soft"
                    >
                      {isSerie ? t("Zur Serie", "To the series") : t("Zum Film", "To the film")}{" "}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {favorites.length > 0 ? (
            <section className="mt-12">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">{t("Mit Herz", "With heart")}</p>
                  <h2 className="display mt-2 text-3xl text-cream">
                    {t("Deine Favoriten", "Your favourites")}
                  </h2>
                </div>
                <span className="chip">
                  <Heart className="size-3 text-rust" /> {favorites.length}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {favorites.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    sizes="(max-width: 640px) 45vw, 18vw"
                    seriesState={seriesStates?.get(movie.id)}
                    locale={locale}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{t("Gesehen", "Seen")}</p>
                <h2 className="display mt-2 text-3xl text-cream">
                  {t(`Deine ${history}`, `Your ${history}`)}
                </h2>
              </div>
              <p className="text-xs text-muted">
                {t(
                  "Sortiert nach deiner Wertung, dann nach Filmgold-Score",
                  "Sorted by your rating, then by Filmgold score",
                )}
              </p>
            </div>
            {movies.length > 0 ? (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-2">
                    {t(
                      `Seite ${page} von ${totalPages}`,
                      `Page ${page} of ${totalPages}`,
                    )}
                  </p>
                  <ListControls
                    basePath="/meine-liste"
                    params={controlParams}
                    pageSize={pageSize}
                    pageSizeOptions={CATALOG_PAGE_SIZES}
                    layout={view}
                  />
                </div>
                <div className={`mt-6 grid ${gridClassName(view)}`}>
                  {shownMovies.map((movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      sizes="(max-width: 640px) 45vw, 18vw"
                      seriesState={seriesStates?.get(movie.id)}
                      locale={locale}
                    />
                  ))}
                </div>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  basePath="/meine-liste"
                  params={controlParams}
                  locale={locale}
                />
              </>
            ) : (
              <p className="mt-6 text-sm text-muted">
                {t(
                  `Du hast ${noun} als gesehen markiert, aber noch keine Bewertung vergeben.`,
                  `You have marked ${noun} as seen but have not rated any yet.`,
                )}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
