import { Check, CircleDashed, Clock, Play, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { tr, type Locale } from "@/lib/locale";
import type { SeriesStateSummary, WatchState } from "@/lib/types";

export const WATCH_STATE_LABELS: Record<WatchState, string> = {
  none: "Ungesehen",
  watching: "Am Schauen",
  watched: "Gesehen",
  rewatching: "Rewatch",
};

export function watchStateLabel(state: WatchState, locale: Locale = "de") {
  return tr(
    locale,
    WATCH_STATE_LABELS[state],
    state === "none"
      ? "Unwatched"
      : state === "watching"
        ? "Watching"
        : state === "watched"
          ? "Watched"
          : "Rewatch",
  );
}

const STATE_ICONS = {
  none: CircleDashed,
  watching: Play,
  watched: Check,
  rewatching: RotateCcw,
} as const;

const STATE_CLASSES: Record<WatchState, string> = {
  none: "border-line bg-black/65 text-muted",
  watching: "border-gold/35 bg-black/70 text-gold",
  watched: "border-moss/40 bg-black/70 text-moss",
  rewatching: "border-sky-300/35 bg-black/70 text-sky-200",
};

export function SeriesStateBadge({
  state,
  className,
  withIcon = false,
  locale = "de",
}: {
  state: WatchState;
  className?: string;
  withIcon?: boolean;
  locale?: Locale;
}) {
  const Icon = STATE_ICONS[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] backdrop-blur",
        STATE_CLASSES[state],
        className,
      )}
    >
      {withIcon ? <Icon className="size-2.5" /> : null}
      {watchStateLabel(state, locale)}
    </span>
  );
}

export function episodeCode(episode: {
  seasonNumber: number;
  episodeNumber: number;
}) {
  return `S${String(episode.seasonNumber).padStart(2, "0")} E${String(
    episode.episodeNumber,
  ).padStart(2, "0")}`;
}

/** Compact episode code such as `S02E06`, used for the poster tag. */
export function episodeTagCode(episode: {
  seasonNumber: number;
  episodeNumber: number;
}) {
  return `S${String(episode.seasonNumber).padStart(2, "0")}E${String(
    episode.episodeNumber,
  ).padStart(2, "0")}`;
}

const EPISODE_TAG_CLASSES: Record<WatchState, string> = {
  none: "border-line bg-black/70 text-cream/70",
  watching: "border-gold/45 bg-black/75 text-gold",
  watched: "border-moss/40 bg-black/70 text-moss",
  rewatching: "border-sky-300/45 bg-black/75 text-sky-200",
};

/**
 * Poster tag for the next/current episode. Gold while watching, sky blue
 * during a rewatch so the two rounds stay distinguishable.
 */
export function EpisodeTag({
  summary,
  className,
  locale = "de",
}: {
  summary: SeriesStateSummary;
  className?: string;
  locale?: Locale;
}) {
  const next = summary.nextEpisode;
  if (!next) return null;
  const nextTitle =
    locale === "en" && next.titleEn?.trim() ? next.titleEn : next.title;
  const rewatching = summary.state === "rewatching";
  return (
    <span
      title={`${rewatching ? tr(locale, "Rewatch", "Rewatch") : tr(locale, "Nächste Folge", "Next episode")}: ${episodeCode(next)} – ${nextTitle}`}
      className={cn(
        "pointer-events-none inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums backdrop-blur",
        EPISODE_TAG_CLASSES[summary.state],
        className,
      )}
    >
      {rewatching ? <RotateCcw className="size-2.5" /> : null}
      {episodeTagCode(next)}
    </span>
  );
}

export type SeriesStatusTone = "moss" | "gold" | "rust" | "muted";

export type SeriesStatusMeta = {
  label: string;
  tone: SeriesStatusTone;
};

/** Translate TMDB's English series status into a short label. */
export function seriesStatusMeta(
  status: string | null | undefined,
  locale: Locale = "de",
): SeriesStatusMeta | null {
  if (!status) return null;
  const value = status.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("cancel") || value.includes("abgesetzt")) {
    return { label: tr(locale, "Abgesetzt", "Canceled"), tone: "rust" };
  }
  if (
    value.includes("returning") ||
    value.includes("continuing") ||
    value.includes("ongoing") ||
    value.includes("fortlaufend")
  ) {
    return { label: tr(locale, "Läuft", "Running"), tone: "gold" };
  }
  if (
    value.includes("ended") ||
    value.includes("beendet") ||
    value.includes("abgeschlossen")
  ) {
    return { label: tr(locale, "Beendet", "Ended"), tone: "moss" };
  }
  if (value.includes("production")) {
    return { label: tr(locale, "In Produktion", "In production"), tone: "gold" };
  }
  if (value.includes("planned") || value.includes("geplant")) {
    return { label: tr(locale, "Geplant", "Planned"), tone: "muted" };
  }
  return null;
}

const STATUS_CLASSES: Record<SeriesStatusTone, string> = {
  moss: "border-moss/40 bg-moss/10 text-moss",
  gold: "border-gold/40 bg-gold/10 text-gold",
  rust: "border-rust/40 bg-rust/10 text-[#f0a08e]",
  muted: "border-line bg-white/[0.04] text-muted",
};

const STATUS_ICONS = {
  moss: Check,
  gold: Play,
  rust: X,
  muted: Clock,
} as const;

/** Airing status chip: Beendet, Läuft, Abgesetzt, … */
export function SeriesStatusBadge({
  status,
  className,
  withIcon = false,
  locale = "de",
}: {
  status: string | null | undefined;
  className?: string;
  withIcon?: boolean;
  locale?: Locale;
}) {
  const meta = seriesStatusMeta(status, locale);
  if (!meta) return null;
  const Icon = STATUS_ICONS[meta.tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] backdrop-blur",
        STATUS_CLASSES[meta.tone],
        className,
      )}
    >
      {withIcon ? <Icon className="size-2.5" /> : null}
      {meta.label}
    </span>
  );
}
