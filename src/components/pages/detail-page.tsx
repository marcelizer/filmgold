import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Globe2,
  Heart,
  Layers,
  ListVideo,
  Play,
  RotateCcw,
  Star,
  Ticket,
  Users,
} from "lucide-react";
import { MovieCard } from "@/components/movie-card";
import { MovieListsPanel } from "@/components/lists/movie-lists-panel";
import { PersonalPanel } from "@/components/personal-panel";
import { Poster } from "@/components/poster";
import { ScoreBadge } from "@/components/score-badge";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { SeenButton } from "@/components/seen-button";
import { EpisodesPanel } from "@/components/series/episodes-panel";
import {
  episodeCode,
  seriesStatusMeta,
  SeriesStateBadge,
  SeriesStatusBadge,
} from "@/components/series/series-state-badge";
import { getWeights, hasTmdbCredentials } from "@/lib/db";
import {
  contentGenres,
  contentOriginalTitle,
  contentOverview,
  contentTagline,
  contentTitle,
  episodeTitle,
} from "@/lib/content";
import { getLocale } from "@/lib/i18n-server";
import { tr, type Locale } from "@/lib/locale";
import {
  formatDate,
  formatInt,
  formatMoneyUsd,
  formatRuntime,
  formatScore,
  formatYear,
  formatYearRange,
  mediaImage,
  scoreGrade,
} from "@/lib/format";
import { getDetailData, getSeriesEpisodes, getSeriesProgress } from "@/lib/movies";
import { getListsForMovie } from "@/lib/lists";
import type { MediaType } from "@/lib/types";

export async function detailMetadata(slug: string, media: MediaType): Promise<Metadata> {
  const locale = await getLocale();
  const data = getDetailData(slug, media);
  if (!data) {
    return {
      title: tr(
        locale,
        media === "serie" ? "Serie nicht gefunden" : "Film nicht gefunden",
        media === "serie" ? "Series not found" : "Film not found",
      ),
    };
  }
  const { movie } = data;
  const title = contentTitle(movie, locale);
  const overview = contentOverview(movie, locale);
  return {
    title: `${title} (${movie.year ?? ""})`.trim(),
    description:
      overview?.slice(0, 160) ??
      tr(
        locale,
        `${title} im Filmgold-Archiv: Bewertung, Fakten und deine persönliche Wertung.`,
        `${title} in the Filmgold archive: rating, facts and your personal rating.`,
      ),
    openGraph: {
      title,
      description: overview?.slice(0, 200) ?? undefined,
      images: movie.posterPath
        ? [mediaImage(movie.posterLocal, movie.posterPath, "w500") ?? ""]
        : undefined,
    },
  };
}

export async function DetailPage({
  slug,
  media,
}: {
  slug: string;
  media: MediaType;
}) {
  const locale: Locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const data = getDetailData(slug, media);
  if (!data) notFound();
  const { movie, rank, total, similar } = data;
  const title = contentTitle(movie, locale);
  const overview = contentOverview(movie, locale);
  const tagline = contentTagline(movie, locale);
  const genres = contentGenres(movie, locale);
  const weights = getWeights();
  const lists = getListsForMovie(movie.id);
  const backdrop = mediaImage(movie.backdropLocal, movie.backdropPath, "w1280");
  const poster = mediaImage(movie.posterLocal, movie.posterPath, "w500");
  const originalShown = contentOriginalTitle(movie, locale);
  const isSerie = movie.mediaType === "serie";
  const basePath = isSerie ? "/serien" : "/filme";
  const noun = isSerie ? t("Serien", "series") : t("Filme", "films");
  const episodes = isSerie ? getSeriesEpisodes(movie.id) : [];
  const progress = isSerie ? getSeriesProgress(movie.id) : null;
  const trackedSeries = isSerie && episodes.length > 0;
  const nextEpisode = progress?.nextEpisode ?? null;

  const facts = isSerie
    ? [
        {
          icon: CalendarDays,
          label: t("Startjahr", "First aired"),
          value: formatYearRange(movie.year, movie.endYear),
        },
        {
          icon: Layers,
          label: t("Staffeln", "Seasons"),
          value: movie.seasons ? formatInt(movie.seasons, locale) : "–",
        },
        {
          icon: ListVideo,
          label: t("Folgen", "Episodes"),
          value: movie.episodes ? formatInt(movie.episodes, locale) : "–",
        },
        {
          icon: Clock,
          label: t("Folgenlänge", "Episode length"),
          value: formatRuntime(movie.runtime, locale),
        },
        {
          icon: Globe2,
          label: t("Herkunft", "Origin"),
          value: movie.country ?? "–",
        },
        { icon: Users, label: t("Idee", "Created by"), value: movie.director ?? "–" },
        {
          icon: Ticket,
          label: t("Status", "Status"),
          value: seriesStatusMeta(movie.seriesStatus, locale)?.label ?? "–",
        },
        {
          icon: Award,
          label: t("Auszeichnungen", "Awards"),
          value:
            [
              movie.oscarWins
                ? t(`${movie.oscarWins}× Oscar`, `${movie.oscarWins}× Oscar`)
                : "",
              movie.oscarNominations
                ? t(
                    `${movie.oscarNominations} Nominierungen`,
                    `${movie.oscarNominations} nominations`,
                  )
                : "",
            ]
              .filter(Boolean)
              .join(" · ") || "–",
        },
      ]
    : [
        {
          icon: CalendarDays,
          label: t("Erscheinungsjahr", "Release year"),
          value: formatYear(movie.year),
        },
        {
          icon: Clock,
          label: t("Laufzeit", "Runtime"),
          value: formatRuntime(movie.runtime, locale),
        },
        {
          icon: Globe2,
          label: t("Herkunft", "Origin"),
          value: movie.country ?? "–",
        },
        {
          icon: Users,
          label: t("Regie", "Director"),
          value: movie.director ?? "–",
        },
        {
          icon: Ticket,
          label: t("Box Office", "Box office"),
          value: formatMoneyUsd(movie.boxOffice, locale),
        },
        {
          icon: Award,
          label: t("Auszeichnungen", "Awards"),
          value:
            [
              movie.oscarWins
                ? t(`${movie.oscarWins}× Oscar`, `${movie.oscarWins}× Oscar`)
                : "",
              movie.oscarNominations
                ? t(
                    `${movie.oscarNominations} Nominierungen`,
                    `${movie.oscarNominations} nominations`,
                  )
                : "",
            ]
              .filter(Boolean)
              .join(" · ") || "–",
        },
      ];

  return (
    <article>
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
          {backdrop ? (
            <Image
              src={backdrop}
              alt=""
              fill
              loading="eager"
              sizes="100vw"
              className="scale-105 object-cover object-top opacity-60"
            />
          ) : poster ? (
            <Image
              src={poster}
              alt=""
              fill
              loading="eager"
              sizes="100vw"
              className="scale-125 object-cover object-top opacity-30 blur-2xl"
            />
          ) : (
            <div className="hero-glow h-full w-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/80 via-transparent to-bg/40" />
        </div>

        <div className="container-page pt-8 lg:pt-12">
          <Link
            href={basePath}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-cream"
          >
            <ArrowLeft className="size-3.5" />
            {t("Zurück zum Archiv", "Back to the archive")}
          </Link>

          <div className="mt-8 grid gap-8 pb-10 md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr] lg:gap-12">
            <div className="mx-auto w-[180px] sm:w-[200px] md:mx-0 md:w-full">
              <Poster
                movie={movie}
                imageSize="w500"
                sizes="(max-width: 768px) 50vw, 240px"
                eager
                locale={locale}
                className="shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                {trackedSeries && progress ? (
                  <SeriesStateBadge
                    state={progress.state}
                    withIcon
                    locale={locale}
                    className="px-2 py-1 text-[10px]"
                  />
                ) : (
                  <SeenButton movieId={movie.id} seen={movie.seen} withLabel />
                )}
                {movie.myRating ? (
                  <span className="text-xs tabular-nums text-gold">
                    {formatScore(movie.myRating, 1, locale)}/10
                  </span>
                ) : null}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {isSerie ? (
                  <span className="chip border-gold/25 text-gold">
                    {t("Serie", "Series")}
                  </span>
                ) : null}
                {isSerie ? (
                  <SeriesStatusBadge
                    status={movie.seriesStatus}
                    withIcon
                    locale={locale}
                    className="px-2 py-1 text-[10px]"
                  />
                ) : null}
                {movie.genres.map((genre, index) => (
                  <Link
                    key={genre}
                    href={`${basePath}?genre=${encodeURIComponent(genre)}`}
                    className="chip transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    {genres[index]}
                  </Link>
                ))}
                {movie.source === "demo" ? (
                  <span className="chip border-gold/20 text-gold/80">
                    {t("Beispieldaten", "Sample data")}
                  </span>
                ) : null}
                {movie.favorite ? (
                  <span className="chip border-rust/40 bg-rust/10 text-rust">
                    <Heart className="size-3 fill-current" />
                    {t("Favorit", "Favourite")}
                  </span>
                ) : null}
                {movie.listNames.map((name) => (
                  <span
                    key={`list-${name}`}
                    className="chip border-line-soft text-muted-2"
                    title={t(`Auf der Liste ${name}`, `On the list ${name}`)}
                  >
                    <ListVideo className="size-3" />
                    {name}
                  </span>
                ))}
              </div>

              <h1 className="display mt-4 text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.96] text-cream">
                {title}
              </h1>
              {originalShown ? (
                <p className="mt-2 text-base italic text-muted-2">{originalShown}</p>
              ) : null}
              {tagline ? (
                <p className="mt-4 max-w-2xl border-l border-gold/40 pl-4 text-sm italic text-muted">
                  {tagline}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-muted-2" />
                  {isSerie
                    ? formatYearRange(movie.year, movie.endYear)
                    : formatYear(movie.year)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-2" />
                  {isSerie
                    ? `${movie.seasons ?? "–"} ${t("Staffeln", "seasons")} · ${formatInt(
                        movie.episodes,
                        locale,
                      )} ${t("Folgen", "episodes")}`
                    : formatRuntime(movie.runtime, locale)}
                </span>
                {movie.ageRating ? (
                  <span className="rounded border border-line px-1.5 py-0.5 text-[10px]">
                    {movie.ageRating}
                  </span>
                ) : null}
                {movie.country ? <span>{movie.country}</span> : null}
              </div>

              {isSerie && progress && nextEpisode ? (
                <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1.5 text-[11px] text-muted">
                  {progress.state === "rewatching" ? (
                    <RotateCcw className="size-3 text-sky-200" />
                  ) : (
                    <Play className="size-3 text-gold" />
                  )}
                  <span className="text-[9px] uppercase tracking-[0.14em] text-gold">
                    {progress.state === "rewatching"
                      ? t("Rewatch · Als Nächstes", "Rewatch · Up next")
                      : t("Als Nächstes", "Up next")}
                  </span>
                  <span className="font-mono text-[10px] text-muted-2">
                    {episodeCode(nextEpisode)}
                  </span>
                  <span className="text-cream">{episodeTitle(nextEpisode, locale)}</span>
                  <span className="text-muted-2">
                    (
                    {progress.state === "rewatching"
                      ? `${progress.rewatchedEpisodes}/${progress.totalEpisodes}`
                      : `${progress.watchedEpisodes}/${progress.totalEpisodes}`}
                    )
                  </span>
                </p>
              ) : isSerie && progress && progress.state === "watched" ? (
                <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-moss">
                  <Check className="size-3" />
                  {t(
                    `Alle ${progress.totalEpisodes} Folgen gesehen`,
                    `All ${progress.totalEpisodes} episodes watched`,
                  )}
                </p>
              ) : null}

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <div className="flex items-end gap-2">
                  <span className="display text-6xl leading-none text-gold tabular-nums">
                    {formatScore(movie.totalScore, 1, locale)}
                  </span>
                  <div className="pb-1">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
                      {t("Filmgold-Score", "Filmgold score")}
                    </p>
                    <p className="text-xs text-cream">
                      {scoreGrade(movie.totalScore, locale)}
                    </p>
                  </div>
                </div>
                <div className="h-10 w-px bg-line" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
                    {t("Platzierung", "Ranking")}
                  </p>
                  <p className="text-sm text-cream">
                    #{formatInt(rank, locale)}{" "}
                    <span className="text-muted">
                      {t("von", "of")} {formatInt(total, locale)}
                    </span>
                  </p>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {movie.tmdbId ? (
                    <a
                      href={`https://www.themoviedb.org/${
                        isSerie ? "tv" : "movie"
                      }/${movie.tmdbId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-quiet border border-line"
                    >
                      TMDB <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                  {movie.imdbId ? (
                    <a
                      href={`https://www.imdb.com/title/${movie.imdbId}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-quiet border border-line"
                    >
                      IMDb <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-10 pb-16 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-10">
          {overview ? (
            <section>
              <h2 className="eyebrow">{t("Handlung", "Synopsis")}</h2>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-cream/85">
                {overview}
              </p>
            </section>
          ) : null}

          {isSerie && progress ? (
            <EpisodesPanel
              movieId={movie.id}
              tmdbId={movie.tmdbId}
              configured={hasTmdbCredentials()}
              episodes={episodes}
              progress={progress}
            />
          ) : null}

          <section className="surface-card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="eyebrow">{t("Fakten", "Facts")}</h2>
              {movie.releaseDate ? (
                <p className="text-[11px] text-muted-2">
                  {isSerie
                    ? t("Erstausstrahlung", "First aired")
                    : t("Kinostart", "Released")}
                  : {formatDate(movie.releaseDate, locale)}
                </p>
              ) : null}
            </div>
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-start gap-3">
                  <fact.icon className="mt-0.5 size-4 shrink-0 text-muted-2" />
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
                      {fact.label}
                    </dt>
                    <dd className="mt-0.5 text-sm leading-snug text-cream">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {!isSerie && movie.budget ? (
              <p className="mt-4 border-t border-line-soft pt-3 text-[11px] text-muted-2">
                {t("Budget", "Budget")}: {formatMoneyUsd(movie.budget, locale)} ·{" "}
                {t("Einspiel", "Box office")}:{" "}
                {formatMoneyUsd(movie.boxOffice, locale)}
              </p>
            ) : null}
          </section>

          {movie.cast.length > 0 ? (
            <section>
              <h2 className="eyebrow">{t("Besetzung", "Cast")}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {movie.cast.map((person) => (
                  <span key={person} className="chip">
                    {person}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="eyebrow">{t("Score-Analyse", "Score analysis")}</h2>
                <p className="mt-2 max-w-md text-xs leading-relaxed text-muted">
                  {t(
                    "Jede Kennzahl wird auf 0–100 normalisiert. Fehlende Werte werden nicht mit Null bestraft, sondern die übrigen Gewichte neu verteilt.",
                    "Each metric is normalised to 0–100. Missing values are not penalised as zero; the remaining weights are redistributed instead.",
                  )}
                </p>
              </div>
              <ScoreBadge score={movie.totalScore} size="lg" locale={locale} />
            </div>
            <div className="mt-6">
              <ScoreBreakdown movie={movie} weights={weights} locale={locale} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-line-soft pt-4 text-[10px] text-muted-2 sm:grid-cols-3">
              <p>
                {t("Kritiker", "Critics")}: RT {movie.rtRating ?? "–"} · MC{" "}
                {movie.metacritic ?? "–"}
              </p>
              <p>
                IMDb: {formatScore(movie.imdbRating, 1, locale)} (
                {formatInt(movie.imdbVotes, locale)} {t("Stimmen", "votes")})
              </p>
              <p>
                TMDB: {formatScore(movie.tmdbRating, 1, locale)} (
                {formatInt(movie.tmdbVotes, locale)} {t("Stimmen", "votes")})
              </p>
            </div>
          </section>

          <p className="text-[11px] leading-relaxed text-muted-2">
            {t("Score-Gewichtung", "Score weighting")}:{" "}
            {(
              [
                ["critics", weights.critics],
                ["audience", weights.audience],
                ["boxoffice", weights.boxoffice],
                ["popularity", weights.popularity],
                ["renown", weights.renown],
              ] as const
            )
              .filter(([, value]) => value > 0)
              .map(
                ([key, value]) =>
                  `${
                    key === "critics"
                      ? t("Kritiker", "Critics")
                      : key === "audience"
                        ? t("Publikum", "Audience")
                        : key === "boxoffice"
                          ? t("Box Office", "Box office")
                          : key === "popularity"
                            ? t("Popularität", "Popularity")
                            : t("Bekanntheit", "Renown")
                  } ${value} %`,
              )
              .join(" · ")}
            . {t("Änderbar unter", "Change in")}{" "}
            <Link href="/admin?tab=einstellungen" className="link-underline">
              {t("Einstellungen", "settings")}
            </Link>
            .
          </p>
        </div>

        <aside className="space-y-5">
          <PersonalPanel
            movieId={movie.id}
            seen={movie.seen}
            rating={movie.myRating}
            favorite={movie.favorite}
            note={movie.myNote}
            watchedAt={movie.watchedAt}
          />

          <MovieListsPanel movieId={movie.id} lists={lists} />

          <div className="surface-card p-5">
            <p className="eyebrow">{t("Auf einen Blick", "At a glance")}</p>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{t("Publikum", "Audience")}</span>
                <span className="tabular-nums text-cream">
                  {formatScore(movie.audienceScore, 1, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{t("Kritik", "Critics")}</span>
                <span className="tabular-nums text-cream">
                  {formatScore(movie.criticsScore, 1, locale)}
                </span>
              </div>
              {isSerie ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">{t("Staffeln", "Seasons")}</span>
                    <span className="tabular-nums text-cream">
                      {movie.seasons ?? "–"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">{t("Folgen", "Episodes")}</span>
                    <span className="tabular-nums text-cream">
                      {formatInt(movie.episodes, locale)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">{t("Box Office", "Box office")}</span>
                  <span className="tabular-nums text-cream">
                    {formatMoneyUsd(movie.boxOffice, locale)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{t("Popularität", "Popularity")}</span>
                <span className="tabular-nums text-cream">
                  {formatInt(movie.popularity, locale)}
                </span>
              </div>
            </div>
          </div>

          {movie.oscarWins > 0 || movie.oscarNominations > 0 ? (
            <div className="surface-card border-gold/20 bg-gold/[0.03] p-5">
              <div className="flex items-center gap-2 text-gold">
                <Star className="size-4 fill-current" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
                  {t("Oscars", "Oscars")}
                </p>
              </div>
              <p className="display mt-3 text-4xl text-cream">
                {movie.oscarWins}
                <span className="ml-1 text-base text-muted">
                  {movie.oscarWins === 1
                    ? t("Sieg", "win")
                    : t("Siege", "wins")}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {t(
                  `${movie.oscarNominations} Nominierungen`,
                  `${movie.oscarNominations} nominations`,
                )}
              </p>
              {movie.awards ? (
                <p className="mt-3 border-t border-gold/15 pt-3 text-[11px] leading-relaxed text-gold-soft/80">
                  {movie.awards}
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>

      {similar.length > 0 ? (
        <section className="border-t border-line-soft bg-surface/30 py-14">
          <div className="container-page">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{t("Verwandt", "Related")}</p>
                <h2 className="display mt-2 text-3xl text-cream">
                  {t("Wenn dir das gefällt", "If you like this")}
                </h2>
              </div>
              <Link
                href={`${basePath}?genre=${encodeURIComponent(movie.genres[0] ?? "")}`}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-gold"
              >
                {t("Mehr", "More")} {genres[0] ?? noun}{" "}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {similar.map((candidate) => (
                <MovieCard
                  key={candidate.id}
                  movie={candidate}
                  sizes="(max-width: 640px) 45vw, 16vw"
                  locale={locale}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
