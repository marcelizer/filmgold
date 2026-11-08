import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatScore, scoreGrade } from "@/lib/format";
import type { Locale } from "@/lib/locale";

export function ScoreBadge({
  score,
  size = "sm",
  showStar = true,
  className,
  locale = "de",
}: {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showStar?: boolean;
  className?: string;
  locale?: Locale;
}) {
  const tone =
    score === null || score === undefined
      ? "border-line bg-white/[0.02] text-muted"
      : score >= 80
        ? "border-gold/35 bg-gold/10 text-gold"
        : score >= 65
          ? "border-white/15 bg-white/[0.05] text-cream"
          : "border-line bg-white/[0.02] text-muted";

  return (
    <span
      title={`${locale === "en" ? "Filmgold score" : "Filmgold-Score"} ${formatScore(
        score,
        1,
        locale,
      )} · ${scoreGrade(score, locale)}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border tabular-nums",
        tone,
        size === "sm" && "px-1.5 py-0.5 text-[10px]",
        size === "md" && "px-2 py-1 text-xs",
        size === "lg" && "px-3 py-1.5 text-sm",
        className,
      )}
    >
      {showStar ? (
        <Star
          className={cn(
            "fill-current",
            size === "sm" ? "size-2.5" : size === "md" ? "size-3" : "size-3.5",
          )}
        />
      ) : null}
      {formatScore(score, 1, locale)}
    </span>
  );
}

export function MyRatingBadge({
  rating,
  className,
  locale = "de",
}: {
  rating: number | null | undefined;
  className?: string;
  locale?: Locale;
}) {
  if (!rating) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-gold/25 bg-gold/[0.07] px-1.5 py-0.5 text-[10px] tabular-nums text-gold-soft",
        className,
      )}
      title={
        locale === "en"
          ? `Your rating: ${formatScore(rating, 1, locale)} out of 10`
          : `Deine Bewertung: ${formatScore(rating, 1, locale)} von 10`
      }
    >
      <span className="text-[8px] uppercase tracking-wider">
        {locale === "en" ? "You" : "Du"}
      </span>
      {formatScore(rating, 1, locale)}
    </span>
  );
}
