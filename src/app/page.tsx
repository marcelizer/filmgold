import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clapperboard,
  Heart,
  ListChecks,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { hasTmdbCredentials } from "@/lib/db";
import {
  contentOriginalTitle,
  contentTitle,
  genreLabel,
} from "@/lib/content";
import { formatInt, formatMoneyUsd, formatScore, formatYear } from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import { tr, type Locale } from "@/lib/locale";
import { getDemoCount, getHomeData, getStats } from "@/lib/movies";
import type { Movie } from "@/lib/types";
import { MovieCard } from "@/components/movie-card";
import { Poster } from "@/components/poster";
import { ScoreBadge } from "@/components/score-badge";
import { SectionHeading } from "@/components/section-heading";
import { SeenButton } from "@/components/seen-button";

export const dynamic = "force-dynamic";

function TopTenRow({
  movie,
  rank,
  locale,
}: {
  movie: Movie;
  rank: number;
  locale: Locale;
}) {
  const t = (de: string, en: string) => tr(locale, de, en);
  const title = contentTitle(movie, locale);
  const original = contentOriginalTitle(movie, locale);
  const genres = movie.genres
    .slice(0, 2)
    .map((genre) => genreLabel(genre, locale));
  return (
    <article className="group relative flex items-center gap-4 border-b border-line-soft py-4 last:border-0 sm:gap-5">
      <Link
        href={`/filme/${movie.slug}`}
        className="absolute inset-0 z-10"
        aria-label={`${title} – ${t("Platz", "rank")} ${rank}`}
      />
      <span className="w-9 shrink-0 text-right sm:w-12">
        <span className={rank <= 3 ? "rank-number-solid text-4xl sm:text-5xl" : "rank-number text-4xl sm:text-5xl"}>
          {rank}
        </span>
      </span>
      <div className="w-12 shrink-0 sm:w-14">
        <Poster
          movie={movie}
          imageSize="w342"
          sizes="56px"
          locale={locale}
          className="rounded-lg border-white/5"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-cream transition-colors group-hover:text-gold">
          {title}
        </h3>
        <p className="mt-0.5 truncate text-[11px] italic text-muted-2">
          {original ?? genres.join(" · ")}
        </p>
        <p className="mt-1 text-[11px] text-muted">
          {formatYear(movie.year)}
          <span className="mx-1.5 text-line">·</span>
          {genres.join(", ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-[10px] uppercase tracking-wider text-muted-2">
            {t("Einspiel", "Box office")}
          </p>
          <p className="text-[11px] tabular-nums text-muted">
            {formatMoneyUsd(movie.boxOffice, locale)}
          </p>
        </div>
        <SeenButton movieId={movie.id} seen={movie.seen} className="relative z-20" />
        <ScoreBadge score={movie.totalScore} size="md" locale={locale} />
      </div>
    </article>
  );
}

export default async function HomePage() {
  const locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const data = getHomeData();
  const seriesStats = getStats("serie");
  const demoCount = getDemoCount();
  const hasTmdb = hasTmdbCredentials();
  const { stats, spotlight } = data;

  if (!spotlight) {
    return (
      <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          <Clapperboard className="size-6 text-gold" />
        </span>
        <h1 className="display mt-6 text-4xl">
          {t("Noch keine Titel im Archiv.", "No titles in the archive yet.")}
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted">
          {t(
            "Lege unter Verwaltung los: einzelnen Film oder eine Serie über die TMDB-Suche hinzufügen, das kuratierte Startpaket importieren oder eine CSV-Datei einlesen.",
            "Get started in Admin: add a film or series via TMDB search, import the curated starter pack, or read a CSV file.",
          )}
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/admin?tab=hinzufuegen" className="btn-primary">
            {t("Titel hinzufügen", "Add titles")} <ArrowRight className="size-4" />
          </Link>
          <Link href="/admin?tab=import" className="btn-ghost">
            {t("Import öffnen", "Open import")}
          </Link>
        </div>
      </div>
    );
  }

  const topThree = data.top10.slice(0, 3);
  const seenTop = data.seenMovies.slice(0, 4);
  const demoCountQuery = demoCount;

  return (
    <>
      {(!hasTmdb || demoCountQuery > 0) && (
        <div className="border-b border-gold/15 bg-gold/[0.04]">
          <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2.5 text-[11px]">
            <p className="text-gold-soft/90">
              <span className="font-medium text-gold">{t("Demo-Modus.", "Demo mode.")}</span>{" "}
              {demoCountQuery > 0
                ? t(
                    `${demoCountQuery} Beispielfilme sind geladen.`,
                    `${demoCountQuery} sample films are loaded.`,
                  )
                : t(
                    "Es sind noch keine Filme geladen.",
                    "No films are loaded yet.",
                  )}{" "}
              {!hasTmdb &&
                t(
                  "Für echte Poster, deutsche Titel und vollständige Kennzahlen fehlt nur der TMDB-Key.",
                  "Real posters, localized titles and complete metrics just need the TMDB key.",
                )}
            </p>
            <Link
              href="/admin?tab=einstellungen"
              className="inline-flex items-center gap-1 text-gold hover:text-gold-soft"
            >
              {t("Jetzt einrichten", "Set up now")} <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}

      <section className="relative overflow-hidden border-b border-line-soft">
        <div className="hero-glow pointer-events-none absolute inset-0" />
        <div className="container-page relative grid items-center gap-14 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
          <div className="animate-fade-up">
            <p className="flex items-center gap-3 text-[10px] uppercase tracking-[0.24em] text-muted">
              <span className="h-px w-8 bg-gold/60" />
              {t("Kuratiert", "Curated")} · {formatInt(stats.count, locale)}{" "}
              {t("Filme", "films")}
              {seriesStats.count > 0
                ? ` · ${formatInt(seriesStats.count, locale)} ${t("Serien", "series")}`
                : ""}
              {stats.yearMin && stats.yearMax
                ? ` · ${stats.yearMin}–${stats.yearMax}`
                : ""}
            </p>
            <h1 className="display mt-6 text-[clamp(2.9rem,7vw,5.4rem)] leading-[0.94] text-cream">
              {t("Die besten Filme", "The greatest films")}
              <br />
              <span className="italic text-gold">
                {t("aller Zeiten", "of all time")}
              </span>
              .
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted">
              {t(
                "Kein Algorithmus für den schnellen Klick: Filme und Serien werden nach Kritikerurteil, Publikum, Box Office und heutiger Popularität gewichtet. Mit deutschem Titel, Originalname und deiner eigenen Bewertung.",
                "No quick-click algorithm: films and series are weighted by critics, audiences, box office and current popularity. With localized titles, original names and your own rating.",
              )}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/filme" className="btn-primary">
                {t("Alle Filme entdecken", "Discover all films")}
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/serien" className="btn-ghost">
                {t("Zu den Serien", "Go to series")}
              </Link>
              <Link href="/jahre" className="btn-quiet border border-line">
                {t("Nach Jahr stöbern", "Browse by year")}
              </Link>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-line-soft pt-6">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                  {t("Im Archiv", "In archive")}
                </dt>
                <dd className="display mt-1 text-3xl text-cream tabular-nums">
                  {formatInt(stats.count, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                  {t("Gesehen", "Seen")}
                </dt>
                <dd className="display mt-1 text-3xl text-cream tabular-nums">
                  {formatInt(stats.seenCount, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                  {t("Ø Filmgold", "Avg. Filmgold")}
                </dt>
                <dd className="display mt-1 text-3xl text-gold tabular-nums">
                  {formatScore(stats.avgScore, 1, locale)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-[360px] animate-fade-up lg:max-w-[400px]">
            <div className="absolute -inset-10 rounded-full bg-gold/[0.07] blur-3xl" />
            <div className="absolute -left-6 top-8 hidden rotate-[-7deg] opacity-45 sm:block">
              <Poster
                movie={topThree[2] ?? spotlight}
                imageSize="w342"
                sizes="150px"
                eager
                locale={locale}
                className="w-[150px]"
              />
            </div>
            <div className="absolute -right-4 bottom-12 hidden rotate-[6deg] opacity-45 sm:block">
              <Poster
                movie={topThree[1] ?? spotlight}
                imageSize="w342"
                sizes="140px"
                eager
                className="w-[140px]"
              />
            </div>

            <Link
              href={`/filme/${spotlight.slug}`}
              className="group relative z-10 block"
            >
              <Poster
                movie={spotlight}
                imageSize="w500"
                sizes="(max-width: 1024px) 80vw, 400px"
                eager
                locale={locale}
                className="shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
              />
              <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-gold/30 bg-black/70 px-3 py-1 text-[9px] uppercase tracking-[0.2em] text-gold backdrop-blur">
                {t("Platz 1 von", "No. 1 of")} {formatInt(stats.count, locale)}
              </div>
              <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-black/75 p-4 backdrop-blur-xl">
                <p className="text-[9px] uppercase tracking-[0.18em] text-gold">
                  {t("Filmgold-Score", "Filmgold score")}{" "}
                  {formatScore(spotlight.totalScore, 1, locale)}
                </p>
                <p className="mt-1.5 truncate text-sm font-medium text-cream">
                  {contentTitle(spotlight, locale)}
                </p>
                <p className="mt-0.5 truncate text-[11px] italic text-white/45">
                  {contentOriginalTitle(spotlight, locale)}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/55">
                  <span>
                    {formatYear(spotlight.year)} ·{" "}
                    {spotlight.genres
                      .slice(0, 2)
                      .map((genre) => genreLabel(genre, locale))
                      .join(", ")}
                  </span>
                  <span className="inline-flex items-center gap-1 text-gold">
                    {t("Ansehen", "View")} <ArrowRight className="size-3" />
                  </span>
                </div>
              </div>
            </Link>

            <div className="relative z-20 mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-2 text-[10px] text-muted backdrop-blur">
              <Sparkles className="size-3 text-gold" />
              {t(
                "Kritik + Publikum + Box Office + Popularität",
                "Critics + audience + box office + popularity",
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow={t("Das Ranking", "The ranking")}
              title={t("Die zehn Besten", "The top ten")}
              description={t(
                "Gewichtet aus Kritikerstimmen, Publikumsurteil, Einspielergebnis, Popularität und Bekanntheit.",
                "Weighted from critics, audience scores, box office, popularity and renown.",
              )}
              href="/filme"
              linkLabel={t("Komplette Liste", "Full list")}
            />
            <div className="mt-6 border-t border-line-soft">
              {data.top10.map((movie, index) => (
                <TopTenRow
                  key={movie.id}
                  movie={movie}
                  rank={index + 1}
                  locale={locale}
                />
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="surface-card p-5">
              <div className="flex items-center gap-2 text-gold">
                <BarChart3 className="size-4" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
                  {t("So wird gewichtet", "How it is weighted")}
                </p>
              </div>
              <ul className="mt-4 space-y-3">
                {[
                  [t("Kritiker", "Critics"), "35 %", "RT + Metacritic"],
                  [t("Publikum", "Audience"), "30 %", "IMDb + TMDB"],
                  [
                    t("Box Office", "Box office"),
                    "15 %",
                    t("weltweit, logarithmisch", "worldwide, logarithmic"),
                  ],
                  [t("Popularität", "Popularity"), "10 %", t("TMDB-Trend", "TMDB trend")],
                  [
                    t("Bekanntheit", "Renown"),
                    "10 %",
                    t("Anzahl Bewertungen", "number of votes"),
                  ],
                ].map(([label, weight, hint]) => (
                  <li key={label} className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="text-xs text-cream">{label}</p>
                      <p className="text-[10px] text-muted-2">{hint}</p>
                    </div>
                    <span className="text-xs tabular-nums text-gold">{weight}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line-soft pt-3 text-[10px] leading-relaxed text-muted-2">
                {t(
                  "Fehlende Kennzahlen werden nicht als Null gewertet, sondern die übrigen Gewichte entsprechend neu verteilt.",
                  "Missing metrics are not counted as zero; the remaining weights are redistributed accordingly.",
                )}
              </p>
            </div>

            <div className="surface-card relative overflow-hidden p-5">
              <div className="absolute -right-8 -top-8 size-28 rounded-full bg-gold/10 blur-2xl" />
              <div className="flex items-center gap-2 text-gold">
                <ListChecks className="size-4" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
                  {t("Dein Archiv", "Your archive")}
                </p>
              </div>
              {stats.seenCount > 0 ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-line-soft bg-white/[0.02] p-3">
                      <p className="display text-2xl text-cream">
                        {formatInt(stats.seenCount, locale)}
                      </p>
                      <p className="text-[10px] text-muted-2">{t("gesehen", "seen")}</p>
                    </div>
                    <div className="rounded-lg border border-line-soft bg-white/[0.02] p-3">
                      <p className="display text-2xl text-gold">
                        {stats.avgMyRating
                          ? formatScore(stats.avgMyRating, 1, locale)
                          : "–"}
                      </p>
                      <p className="text-[10px] text-muted-2">
                        {t("Ø deine Wertung", "Avg. your rating")}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/meine-liste"
                    className="mt-4 flex items-center justify-between text-xs text-muted hover:text-gold"
                  >
                    {t("Meine Filmgeschichte", "My film history")}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {t(
                      "Markiere Filme als gesehen und vergib deine eigene Wertung – dein persönliches Kinogedächtnis entsteht automatisch.",
                      "Mark films as seen and give your own rating – your personal cinema memory builds itself.",
                    )}
                  </p>
                  <Link
                    href="/filme?seen=unseen"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-soft"
                  >
                    {t("Jetzt entdecken", "Discover now")}{" "}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-line-soft bg-surface/30 py-16 lg:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow={t("Zeitgeist", "Contemporary")}
            title={t("Die Besten der letzten Jahre", "The best of recent years")}
            description={t(
              "Der höchstbewertete Film jedes Jahrgangs – nicht zwingend der erfolgreichste.",
              "The highest-rated film of each year – not necessarily the most successful.",
            )}
            href="/jahre"
            linkLabel={t("Alle Jahre", "All years")}
          />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {data.recentYears.map(({ year, movie }) => (
              <article key={year} className="group relative">
                <Link
                  href={`/filme/${movie.slug}`}
                  className="absolute inset-0 z-10"
                  aria-label={`${contentTitle(movie, locale)} ${t("aus", "from")} ${year}`}
                />
                <Poster movie={movie} sizes="(max-width: 640px) 45vw, 18vw" locale={locale} />
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-gold">
                      {year}
                    </p>
                    <h3 className="mt-0.5 truncate text-[13px] text-cream group-hover:text-gold">
                      {contentTitle(movie, locale)}
                    </h3>
                    <p className="truncate text-[10px] text-muted-2">
                      {movie.genres
                        .slice(0, 2)
                        .map((entry) => genreLabel(entry, locale))
                        .join(", ")}
                    </p>
                  </div>
                  <ScoreBadge score={movie.totalScore} locale={locale} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16 lg:py-20">
        <SectionHeading
          eyebrow={t("Gattungen", "Genres")}
          title={t("Nach Genre", "By genre")}
          description={t(
            "Vom großen Epos bis zum klaustrophobischen Thriller – finde deinen Zugang zum Kanon.",
            "From the grand epic to the claustrophobic thriller – find your way into the canon.",
          )}
          href="/genres"
          linkLabel={t("Alle Genres", "All genres")}
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.genreHighlights.map(({ genre, movies, count }, index) => (
            <Link
              key={genre}
              href={`/filme?genre=${encodeURIComponent(genre)}`}
              className="group relative overflow-hidden rounded-2xl border border-line-soft bg-surface p-5 transition-colors hover:border-gold/30"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-70 transition-opacity group-hover:opacity-100"
                style={{
                  background: `radial-gradient(120% 100% at 100% 0%, hsl(${
                    (index * 47 + 24) % 360
                  } 22% 24%) 0%, transparent 60%)`,
                }}
              />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                    {count} {t("Filme", "films")}
                  </p>
                  <h3 className="display mt-1 text-3xl text-cream">
                    {genreLabel(genre, locale)}
                  </h3>
                  <p className="mt-2 max-w-[14rem] text-[11px] leading-relaxed text-muted">
                    {movies[0]
                      ? t(
                          `Angeführt von ${contentTitle(movies[0], locale)}`,
                          `Led by ${contentTitle(movies[0], locale)}`,
                        )
                      : t("Filme entdecken", "Discover films")}
                  </p>
                </div>
                <div className="flex -space-x-4">
                  {movies.slice(0, 3).map((movie, posterIndex) => (
                    <Poster
                      key={movie.id}
                      movie={movie}
                      imageSize="w342"
                      sizes="60px"
                      className={`w-14 rounded-lg ring-2 ring-surface ${
                        posterIndex === 0 ? "rotate-[-4deg]" : posterIndex === 2 ? "rotate-[4deg]" : ""
                      }`}
                      locale={locale}
                    />
                  ))}
                </div>
              </div>
              <span className="relative mt-5 inline-flex items-center gap-1 text-[11px] text-gold opacity-0 transition-opacity group-hover:opacity-100">
                {t("Genre öffnen", "Open genre")} <ArrowRight className="size-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line-soft bg-surface/30 py-16 lg:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow={t("Epochen", "Eras")}
            title={t("Ein Jahrhundert Kino", "A century of cinema")}
            description={t(
              "Jedes Jahrzehnt hat seinen Maßstab. Hier ist der bestbewertete Film jeder Dekade.",
              "Every decade has its benchmark. Here is the highest-rated film of each decade.",
            )}
            href="/jahre"
            linkLabel={t("Zeitleiste", "Timeline")}
          />
          <div className="no-scrollbar mt-8 flex gap-4 overflow-x-auto pb-2">
            {data.decadeHighlights.map(({ decade, movie }) => (
              <Link
                key={decade}
                href={`/filme?decade=${decade}`}
                className="group relative w-[190px] shrink-0 overflow-hidden rounded-2xl border border-line-soft bg-surface sm:w-[220px]"
              >
                <Poster
                  movie={movie}
                  sizes="220px"
                  locale={locale}
                  className="rounded-none border-0 opacity-80 transition-opacity group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="display text-2xl text-gold">
                    {t(`${decade}er`, `${decade}s`)}
                  </p>
                  <p className="mt-1 truncate text-xs text-cream">{contentTitle(movie, locale)}</p>
                  <p className="truncate text-[10px] text-white/45">
                    {formatYear(movie.year)} · {t("Score", "Score")}{" "}
                    {formatScore(movie.totalScore, 1, locale)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {stats.seenCount > 0 ? (
        <section className="container-page py-16 lg:py-20">
          <SectionHeading
            eyebrow={t("Dein Archiv", "Your archive")}
            title={t("Deine Filmgeschichte", "Your film history")}
            description={t(
              `${stats.seenCount} gesehen, ${stats.ratedCount} bewertet, ${stats.favoriteCount} Favoriten.`,
              `${stats.seenCount} seen, ${stats.ratedCount} rated, ${stats.favoriteCount} favourites.`,
            )}
            href="/meine-liste"
            linkLabel={t("Alles ansehen", "View all")}
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div className="surface-card flex flex-col justify-between p-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                  {t("Dein Durchschnitt", "Your average")}
                </p>
                <p className="display mt-2 text-6xl text-gold">
                  {stats.avgMyRating
                    ? formatScore(stats.avgMyRating, 1, locale)
                    : "–"}
                  <span className="ml-1 text-xl text-muted">/10</span>
                </p>
                <p className="mt-2 text-xs text-muted">
                  {stats.ratedCount > 0
                    ? t(
                        `über ${stats.ratedCount} bewertete Filme`,
                        `across ${stats.ratedCount} rated films`,
                      )
                    : t("Noch keine Bewertung abgegeben", "No rating yet")}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="chip">
                  <Heart className="size-3 text-rust" />{" "}
                  {stats.favoriteCount} {t("Favoriten", "favourites")}
                </span>
                <span className="chip">
                  <Star className="size-3 text-gold" /> {stats.ratedCount}{" "}
                  {t("bewertet", "rated")}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {seenTop.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  sizes="(max-width: 640px) 45vw, 20vw"
                  locale={locale}
                />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="container-page pb-8 pt-16 lg:pt-20">
          <div className="relative overflow-hidden rounded-3xl border border-line-soft bg-surface p-8 sm:p-12">
            <div className="hero-glow absolute inset-0 opacity-70" />
            <div className="relative grid items-center gap-8 md:grid-cols-[1.3fr_0.7fr]">
              <div>
                <p className="eyebrow">{t("Dein Archiv", "Your archive")}</p>
                <h2 className="display mt-3 text-4xl text-cream sm:text-5xl">
                  {t("Nicht nur eine Liste.", "Not just a list.")}
                  <br />
                  <span className="italic text-gold">
                    {t("Deine Filmgeschichte.", "Your film history.")}
                  </span>
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
                  {t(
                    "Hake Filme ab, die du gesehen hast, vergib eine Wertung von 1 bis 10 und markiere Favoriten. Alles bleibt lokal in deiner Datenbank – ohne Konto, ohne Cloud.",
                    "Tick off films you have seen, give a rating from 1 to 10 and mark favourites. Everything stays local in your database – no account, no cloud.",
                  )}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/filme?seen=unseen" className="btn-primary">
                    {t("Filme durchgehen", "Browse films")}{" "}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link href="/meine-liste" className="btn-ghost">
                    {t("Meine Liste", "My list")}
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {data.top10.slice(3, 7).map((movie) => (
                  <div
                    key={movie.id}
                    className="rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur"
                  >
                    <TrendingUp className="size-4 text-gold" />
                    <p className="mt-2 line-clamp-2 text-xs text-cream">{contentTitle(movie, locale)}</p>
                    <p className="mt-1 text-[10px] text-muted-2">
                      {formatScore(movie.totalScore, 1, locale)}{" "}
                      {t("Punkte", "points")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
