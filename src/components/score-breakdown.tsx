import { formatScore } from "@/lib/format";
import { scoreDescriptions, scoreLabels } from "@/lib/scoring";
import type { Locale } from "@/lib/locale";
import type { Movie, ScoreWeights } from "@/lib/types";

export function ScoreBreakdown({
  movie,
  weights,
  locale = "de",
}: {
  movie: Movie;
  weights: ScoreWeights;
  locale?: Locale;
}) {
  const labels = scoreLabels(locale);
  const descriptions = scoreDescriptions(locale);
  const items = [
    { key: "critics" as const, value: movie.criticsScore },
    { key: "audience" as const, value: movie.audienceScore },
    { key: "boxoffice" as const, value: movie.boxofficeScore },
    { key: "popularity" as const, value: movie.popularityScore },
    { key: "renown" as const, value: movie.renownScore },
  ];
  const totalWeight =
    weights.critics + weights.audience + weights.boxoffice + weights.popularity + weights.renown ||
    1;

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const weight = Math.round((weights[item.key] / totalWeight) * 100);
        return (
          <div key={item.key} title={descriptions[item.key]}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="text-xs text-muted">
                {labels[item.key]}
                <span className="ml-1.5 text-[10px] text-muted-2">{weight} %</span>
              </p>
              <p className="text-[11px] tabular-nums text-cream">
                {item.value === null ? (
                  <span className="text-muted-2">
                    {locale === "en" ? "no data" : "keine Daten"}
                  </span>
                ) : (
                  formatScore(item.value, 1, locale)
                )}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold transition-[width] duration-500"
                style={{ width: `${item.value ?? 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
