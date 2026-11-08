"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Heart, Loader2, Save } from "lucide-react";
import { savePersonalAction } from "@/app/actions";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { formatDate, formatScore } from "@/lib/format";

type PersonalState = {
  seen: boolean;
  rating: number | null;
  favorite: boolean;
  note: string | null;
  watchedAt: string | null;
};

type PersonalPatch = Partial<PersonalState>;

export function PersonalPanel({
  movieId,
  seen,
  rating,
  favorite,
  note,
  watchedAt,
}: {
  movieId: number;
  seen: boolean;
  rating: number | null;
  favorite: boolean;
  note: string | null;
  watchedAt: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [state, applyOptimistic] = useOptimistic<PersonalState, PersonalPatch>(
    { seen, rating, favorite, note, watchedAt },
    (current, patch) => ({ ...current, ...patch }),
  );
  const [noteDraft, setNoteDraft] = useState(note ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function persist(patch: PersonalPatch, successMessage?: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      applyOptimistic(patch);
      const result = await savePersonalAction(movieId, patch);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (successMessage) setMessage(successMessage);
      router.refresh();
    });
  }

  function toggleSeen() {
    const next = !state.seen;
    const today = new Date().toISOString().slice(0, 10);
    persist(
      {
        seen: next,
        rating: next ? state.rating : null,
        watchedAt: next ? (state.watchedAt ?? today) : null,
      },
      next
        ? t("Als gesehen markiert.", "Marked as seen.")
        : t("Gesehen-Markierung entfernt.", "Seen mark removed."),
    );
  }

  function chooseRating(value: number) {
    const next = state.rating === value ? null : value;
    persist(
      { rating: next, seen: next ? true : state.seen },
      t("Bewertung gespeichert.", "Rating saved."),
    );
  }

  function toggleFavorite() {
    const next = !state.favorite;
    persist(
      { favorite: next, seen: next ? true : state.seen },
      t("Favorit aktualisiert.", "Favourite updated."),
    );
  }

  function saveNote() {
    persist({ note: noteDraft }, t("Notiz gespeichert.", "Note saved."));
  }

  function setWatchedDate(value: string) {
    persist({ watchedAt: value || null }, t("Datum gespeichert.", "Date saved."));
  }

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
        <div>
          <p className="eyebrow">{t("Deine Sicht", "Your view")}</p>
          <h2 className="mt-1.5 text-base font-medium">
            {t("Persönliche Bewertung", "Personal rating")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {pending ? <Loader2 className="size-3.5 animate-spin text-gold" /> : null}
          {state.rating ? (
            <span className="display text-3xl leading-none text-gold tabular-nums">
              {formatScore(state.rating, 1, locale)}
              <span className="ml-0.5 text-sm text-muted">/10</span>
            </span>
          ) : (
            <span className="text-xs text-muted-2">
              {t("Noch keine Wertung", "No rating yet")}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSeen}
            disabled={pending}
            aria-pressed={state.seen}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
              state.seen
                ? "border-gold/45 bg-gold/15 text-gold"
                : "border-line bg-white/[0.02] text-muted hover:border-cream/30 hover:text-cream",
            )}
          >
            <Check className="size-3.5" />
            {state.seen ? t("Gesehen", "Seen") : t("Noch nicht gesehen", "Not seen yet")}
          </button>

          <button
            type="button"
            onClick={toggleFavorite}
            disabled={pending}
            aria-pressed={state.favorite}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
              state.favorite
                ? "border-rust/40 bg-rust/10 text-[#ef8f7b]"
                : "border-line bg-white/[0.02] text-muted hover:border-cream/30 hover:text-cream",
            )}
          >
            <Heart className={cn("size-3.5", state.favorite && "fill-current")} />
            {state.favorite ? t("Favorit", "Favourite") : t("Als Favorit", "Add favourite")}
          </button>

          {state.seen ? (
            <label className="ml-auto flex items-center gap-2 text-[11px] text-muted-2">
              {t("Gesehen am", "Seen on")}
              <input
                type="date"
                value={state.watchedAt ?? ""}
                onChange={(event) => setWatchedDate(event.target.value)}
                className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-muted"
              />
            </label>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted">
              {t("Deine Wertung", "Your rating")}{" "}
              <span className="text-muted-2">(1–10)</span>
            </p>
            {state.rating ? (
              <button
                type="button"
                onClick={() => chooseRating(state.rating as number)}
                className="text-[10px] text-muted-2 underline underline-offset-2 hover:text-cream"
              >
                {t("entfernen", "remove")}
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseRating(value)}
                disabled={pending}
                aria-label={
                  locale === "en"
                    ? `${value} out of 10 points`
                    : `${value} von 10 Punkten`
                }
                aria-pressed={state.rating === value}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md border text-xs tabular-nums transition-all",
                  state.rating === value
                    ? "border-gold bg-gold font-semibold text-[#17120a]"
                    : "border-line bg-surface-2 text-muted hover:border-gold/40 hover:text-cream",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="personal-note" className="text-xs text-muted">
            {t("Notiz", "Note")} <span className="text-muted-2">({t("optional", "optional")})</span>
          </label>
          <textarea
            id="personal-note"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            rows={3}
            placeholder={t(
              "Was ist dir an diesem Titel geblieben?",
              "What stayed with you about this title?",
            )}
            className="input-base mt-2 resize-y text-[13px]"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p
              className={cn(
                "text-[11px]",
                error ? "text-rust" : message ? "text-moss" : "text-transparent",
              )}
              role="status"
            >
              {error ?? message ?? "."}
            </p>
            <button
              type="button"
              onClick={saveNote}
              disabled={pending || noteDraft === (state.note ?? "")}
              className="btn-quiet border border-line"
            >
              <Save className="size-3" />
              {t("Notiz speichern", "Save note")}
            </button>
          </div>
        </div>

        {state.watchedAt ? (
          <p className="text-[11px] text-muted-2">
            {t("Zuletzt gesehen", "Last seen")}: {formatDate(state.watchedAt, locale)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
