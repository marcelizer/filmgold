"use client";

import Link from "next/link";
import { Film, Tv } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n-provider";
import type { MediaType } from "@/lib/types";

export const MEDIA_LABELS: Record<MediaType, string> = {
  movie: "Filme",
  serie: "Serien",
};

const DEFAULT_HREFS: Record<MediaType, string> = {
  movie: "/filme",
  serie: "/serien",
};

export function MediaSwitch({
  current,
  hrefs = DEFAULT_HREFS,
  className,
  compact = false,
}: {
  current: MediaType;
  hrefs?: Record<MediaType, string>;
  className?: string;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2/70 p-0.5",
        className,
      )}
      role="group"
      aria-label={t("Filme oder Serien", "Films or series")}
    >
      {(["movie", "serie"] as const).map((media) => {
        const Icon = media === "movie" ? Film : Tv;
        const active = current === media;
        return (
          <Link
            key={media}
            href={hrefs[media]}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
              compact ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-xs",
              active
                ? "bg-gold/15 text-gold"
                : "text-muted hover:bg-white/[0.04] hover:text-cream",
            )}
          >
            <Icon className={compact ? "size-3" : "size-3.5"} />
            {t(MEDIA_LABELS[media], media === "movie" ? "Films" : "Series")}
          </Link>
        );
      })}
    </div>
  );
}
