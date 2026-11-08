import { cn } from "@/lib/cn";
import { gridClassName, type GridLayout } from "@/lib/layout";
import type { Locale } from "@/lib/locale";
import type { Movie, SeriesStateSummary } from "@/lib/types";
import { MovieCard } from "./movie-card";

export function MovieGrid({
  movies,
  className,
  startRank,
  eagerCount = 0,
  seriesStates,
  locale = "de",
  layout = "standard",
}: {
  movies: Movie[];
  className?: string;
  startRank?: number;
  eagerCount?: number;
  seriesStates?: Map<number, SeriesStateSummary>;
  locale?: Locale;
  layout?: GridLayout;
}) {
  return (
    <div className={cn("grid", gridClassName(layout), className)}>
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          rank={startRank ? startRank + index : undefined}
          eager={index < eagerCount}
          seriesState={seriesStates?.get(movie.id)}
          locale={locale}
        />
      ))}
    </div>
  );
}
