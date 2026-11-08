"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Heart, Loader2 } from "lucide-react";
import { savePersonalAction } from "@/app/actions";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";

export function SeenButton({
  movieId,
  seen,
  withLabel = false,
  className,
}: {
  movieId: number;
  seen: boolean;
  withLabel?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [optimistic, setOptimistic] = useOptimistic(seen);
  const [pending, startTransition] = useTransition();

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const result = await savePersonalAction(movieId, { seen: next });
      if (!result.ok) return;
      router.refresh();
    });
  }

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          optimistic
            ? "border-gold/40 bg-gold/15 text-gold"
            : "border-line bg-white/[0.02] text-muted hover:border-cream/30 hover:text-cream",
          className,
        )}
        aria-pressed={optimistic}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
        {optimistic ? t("Gesehen", "Seen") : t("Als gesehen markieren", "Mark as seen")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={optimistic}
      aria-label={
        optimistic
          ? t("Als ungesehen markieren", "Mark as unseen")
          : t("Als gesehen markieren", "Mark as seen")
      }
      title={
        optimistic
          ? t("Gesehen – klicken zum Entfernen", "Seen – click to remove")
          : t("Als gesehen markieren", "Mark as seen")
      }
      className={cn(
        "flex size-7 items-center justify-center rounded-full border backdrop-blur-md transition-all",
        optimistic
          ? "border-gold/60 bg-gold text-[#17120a]"
          : "border-white/25 bg-black/45 text-white/80 opacity-0 hover:border-gold/60 hover:text-gold group-hover:opacity-100 focus-visible:opacity-100",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Check className="size-3.5" />
      )}
    </button>
  );
}

/** Quick favourite toggle for archive cards. */
export function FavoriteButton({
  movieId,
  favorite,
  className,
}: {
  movieId: number;
  favorite: boolean;
  className?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [optimistic, setOptimistic] = useOptimistic(favorite);
  const [pending, startTransition] = useTransition();

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const result = await savePersonalAction(movieId, { favorite: next });
      if (!result.ok) return;
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={optimistic}
      aria-label={
        optimistic
          ? t("Aus Favoriten entfernen", "Remove from favourites")
          : t("Zu Favoriten hinzufügen", "Add to favourites")
      }
      title={
        optimistic
          ? t("Favorit – klicken zum Entfernen", "Favourite – click to remove")
          : t("Zu Favoriten hinzufügen", "Add to favourites")
      }
      className={cn(
        "flex size-7 items-center justify-center rounded-full border backdrop-blur-md transition-all",
        optimistic
          ? "border-rust/60 bg-rust/90 text-white"
          : "border-white/25 bg-black/45 text-white/80 opacity-0 hover:border-rust/60 hover:text-rust group-hover:opacity-100 focus-visible:opacity-100",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Heart className={cn("size-3.5", optimistic && "fill-current")} />
      )}
    </button>
  );
}
