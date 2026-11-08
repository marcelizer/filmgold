"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ListPlus, Loader2, Plus } from "lucide-react";
import {
  createListWithMovieAction,
  toggleListMembershipAction,
} from "@/app/actions";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { formatInt } from "@/lib/format";
import type { MovieListMembership } from "@/lib/types";

type Patch = { id: number; value: boolean };

export function MovieListsPanel({
  movieId,
  lists,
}: {
  movieId: number;
  lists: MovieListMembership[];
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const initial = Object.fromEntries(
    lists.map((list) => [list.id, list.contains]),
  ) as Record<number, boolean>;
  const [membership, applyOptimistic] = useOptimistic<
    Record<number, boolean>,
    Patch
  >(initial, (state, patch) => ({ ...state, [patch.id]: patch.value }));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  function toggle(list: MovieListMembership) {
    const next = !membership[list.id];
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id: list.id, value: next });
      const result = await toggleListMembershipAction(list.id, movieId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function createList(event: FormEvent) {
    event.preventDefault();
    const clean = newName.trim();
    if (!clean) return;
    setError(null);
    startTransition(async () => {
      const result = await createListWithMovieAction(clean, movieId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewName("");
      setShowCreate(false);
      router.refresh();
    });
  }

  return (
    <section className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-gold">
          <ListPlus className="size-4" />
          <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
            {t("Auf deinen Listen", "On your lists")}
          </p>
        </div>
        <Link
          href="/listen"
          className="inline-flex items-center gap-1 text-[10px] text-muted-2 transition-colors hover:text-gold"
        >
          {t("Alle", "All")} <ArrowRight className="size-3" />
        </Link>
      </div>

      {lists.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {lists.map((list) => {
            const contains = membership[list.id] ?? false;
            return (
              <li key={list.id}>
                <button
                  type="button"
                  onClick={() => toggle(list)}
                  disabled={pending}
                  aria-pressed={contains}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    contains
                      ? "border-gold/35 bg-gold/[0.08] text-gold"
                      : "border-line bg-white/[0.02] text-muted hover:border-cream/25 hover:text-cream",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      contains
                        ? "border-gold bg-gold text-[#17120a]"
                        : "border-line",
                    )}
                  >
                    {contains ? <Check className="size-3" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{list.name}</span>
                  <span className="text-[10px] tabular-nums text-muted-2">
                    {formatInt(list.count, locale)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {t(
            "Noch keine eigene Liste. Lege eine an – zum Beispiel für einen Filmabend oder deine nächste Entdeckung.",
            "No list yet. Create one – for a movie night or your next discovery, for example.",
          )}
        </p>
      )}

      {showCreate ? (
        <form onSubmit={createList} className="mt-3 flex gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={80}
            autoFocus
            placeholder={t("Neue Liste …", "New list …")}
            className="input-base h-9 min-w-0 flex-1 text-xs"
            aria-label={t("Name der neuen Liste", "New list name")}
          />
          <button
            type="submit"
            disabled={pending || !newName.trim()}
            className="btn-primary h-9 shrink-0 px-3 text-xs"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-gold hover:text-gold-soft"
        >
          <Plus className="size-3.5" />
          {t("Neue Liste mit diesem Titel", "New list with this title")}
        </button>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-[11px] text-[#f0a08e]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
