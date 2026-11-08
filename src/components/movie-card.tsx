import Link from "next/link";
import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";
import { contentOriginalTitle, contentTitle } from "@/lib/content";
import { formatRuntime, formatYear, formatYearRange } from "@/lib/format";
import { tr, type Locale } from "@/lib/locale";
import type { Movie, SeriesStateSummary } from "@/lib/types";
import { CardActions } from "./card-actions";
import { Poster } from "./poster";
import { MyRatingBadge, ScoreBadge } from "./score-badge";
import { FavoriteButton, SeenButton } from "./seen-button";
import { SeriesStateBadge, EpisodeTag, SeriesStatusBadge } from "./series/series-state-badge";

export function movieHref(movie: Pick<Movie, "mediaType" | "slug">) {
  return `${movie.mediaType === "serie" ? "/serien" : "/filme"}/${movie.slug}`;
}

export function MovieCard({
  movie,
  rank,
  eager = false,
  sizes,
  className,
  seriesState,
  locale = "de",
}: {
  movie: Movie;
  rank?: number;
  eager?: boolean;
  sizes?: string;
  className?: string;
  seriesState?: SeriesStateSummary | null;
  locale?: Locale;
}) {
  const t = (de: string, en: string) => tr(locale, de, en);
  const title = contentTitle(movie, locale);
  const original = contentOriginalTitle(movie, locale);
  const showSeriesState = movie.mediaType === "serie" && Boolean(seriesState);
  const canToggleSeen =
    movie.mediaType !== "serie" || !seriesState;

  return (
    <article className={cn("group relative min-w-0", className)}>
      <Link
        href={movieHref(movie)}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none"
        aria-label={`${title} (${
          movie.mediaType === "serie"
            ? formatYearRange(movie.year, movie.endYear)
            : formatYear(movie.year)
        })`}
      >
        <span className="sr-only">{t("Details ansehen", "View details")}</span>
      </Link>

      <div className="relative">
        <Poster movie={movie} eager={eager} sizes={sizes} locale={locale} />
        <div className="absolute left-2 top-2 z-20 flex items-center gap-1.5">
          {rank ? (
            <span className="flex min-w-7 items-center justify-center rounded-full border border-gold/40 bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gold backdrop-blur">
              #{rank}
            </span>
          ) : null}
          {showSeriesState && seriesState ? (
            <SeriesStateBadge state={seriesState.state} locale={locale} />
          ) : movie.seen ? (
            <span className="rounded-full border border-gold/30 bg-black/65 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-gold backdrop-blur">
              {t("Gesehen", "Seen")}
            </span>
          ) : null}
          {movie.favorite ? (
            <span
              className="flex items-center gap-1 rounded-full border border-rust/50 bg-black/65 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-rust backdrop-blur"
              title={t("Favorit", "Favourite")}
            >
              <Heart className="size-2.5 fill-current" />
              <span className="hidden sm:inline">{t("Favorit", "Favourite")}</span>
            </span>
          ) : null}
        </div>
        <div className="absolute right-2 top-2 z-20 flex flex-col items-end gap-1">
          {showSeriesState && seriesState ? (
            <EpisodeTag summary={seriesState} locale={locale} />
          ) : null}
          {movie.mediaType === "serie" ? (
            <SeriesStatusBadge
              status={movie.seriesStatus}
              locale={locale}
              className="pointer-events-none"
            />
          ) : null}
          {canToggleSeen ? (
            <SeenButton movieId={movie.id} seen={movie.seen} />
          ) : null}
          <FavoriteButton movieId={movie.id} favorite={movie.favorite} />
        </div>
        <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <CardActions
            movieId={movie.id}
            title={title}
            mediaType={movie.mediaType}
          />
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-medium leading-snug text-cream transition-colors group-hover:text-gold">
            {title}
          </h3>
          {original ? (
            <p className="mt-0.5 truncate text-[11px] italic text-muted-2">{original}</p>
          ) : null}
          <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-muted">
            <span className="tabular-nums">
              {movie.mediaType === "serie"
                ? formatYearRange(movie.year, movie.endYear)
                : formatYear(movie.year)}
            </span>
            {movie.mediaType === "serie" && movie.seasons ? (
              <>
                <span className="text-line">·</span>
                <span>
                  {movie.seasons}{" "}
                  {movie.seasons === 1
                    ? t("Staffel", "season")
                    : t("Staffeln", "seasons")}
                </span>
              </>
            ) : movie.runtime ? (
              <>
                <span className="text-line">·</span>
                <span>{formatRuntime(movie.runtime, locale)}</span>
              </>
            ) : null}
          </p>
          {movie.listNames.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {movie.listNames.slice(0, 2).map((name) => (
                <span
                  key={name}
                  className="max-w-24 truncate rounded border border-line-soft bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-muted-2"
                  title={name}
                >
                  {name}
                </span>
              ))}
              {movie.listNames.length > 2 ? (
                <span
                  className="rounded border border-line-soft px-1.5 py-0.5 text-[9px] text-muted-2"
                  title={movie.listNames.slice(2).join(", ")}
                >
                  +{movie.listNames.length - 2}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ScoreBadge score={movie.totalScore} locale={locale} />
          <MyRatingBadge rating={movie.myRating} locale={locale} />
        </div>
      </div>
    </article>
  );
}
