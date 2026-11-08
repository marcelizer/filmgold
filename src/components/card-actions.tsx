"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  ListPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  createListWithMovieAction,
  deleteMovieAction,
  getMovieListMembershipsAction,
  toggleListMembershipAction,
} from "@/app/actions";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import type { MediaType, MovieListMembership } from "@/lib/types";

export function CardActions({
  movieId,
  title,
  mediaType,
  className,
}: {
  movieId: number;
  title: string;
  mediaType: MediaType;
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<MovieListMembership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  function openDialog(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
    setError(null);
    if (!lists) {
      startTransition(async () => {
        const result = await getMovieListMembershipsAction(movieId);
        if (result.ok) setLists(result.data.lists);
        else setError(result.error);
      });
    }
  }

  function toggle(list: MovieListMembership) {
    const next = !list.contains;
    setLists((current) =>
      current?.map((entry) =>
        entry.id === list.id ? { ...entry, contains: next } : entry,
      ) ?? null,
    );
    startTransition(async () => {
      const result = await toggleListMembershipAction(list.id, movieId, next);
      if (!result.ok) {
        setError(result.error);
        setLists((current) =>
          current?.map((entry) =>
            entry.id === list.id ? { ...entry, contains: !next } : entry,
          ) ?? null,
        );
        return;
      }
      router.refresh();
    });
  }

  function createList(event: React.FormEvent) {
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
      const refreshed = await getMovieListMembershipsAction(movieId);
      if (refreshed.ok) setLists(refreshed.data.lists);
      router.refresh();
    });
  }

  function removeFromArchive() {
    if (
      !window.confirm(
        t(
          `„${title}“ wirklich aus dem Archiv löschen? Deine Folgen- und Listen-Einträge werden ebenfalls entfernt.`,
          `Remove “${title}” from the archive? Episode progress and list entries will be removed too.`,
        ),
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    startTransition(async () => {
      const result = await deleteMovieAction(movieId);
      setDeleting(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      const base = mediaType === "serie" ? "/serien" : "/filme";
      const onDetail =
        pathname.startsWith(`${base}/`) && pathname !== base;
      if (onDetail) router.push(base);
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={cn(
          "relative z-30 flex size-7 items-center justify-center rounded-full border border-white/15 bg-black/75 text-white/75 backdrop-blur transition-colors hover:border-gold/50 hover:text-gold",
          className,
        )}
        title={t("Listen & Archiv verwalten", "Manage lists & archive")}
        aria-label={t("Listen & Archiv verwalten", "Manage lists & archive")}
      >
        <MoreHorizontal className="size-3.5" />
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t("Titel verwalten", "Manage title")}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow">{t("Titel verwalten", "Manage title")}</p>
                    <h2 className="mt-1 truncate text-lg text-cream">{title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-cream"
                    aria-label={t("Schließen", "Close")}
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {error ? (
                  <p className="mt-4 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
                    {error}
                  </p>
                ) : null}

                <div className="mt-5">
                  <div className="flex items-center gap-2 text-gold">
                    <ListPlus className="size-4" />
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
                      {t("Auf deinen Listen", "On your lists")}
                    </p>
                  </div>

                  {lists === null ? (
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                      <Loader2 className="size-3.5 animate-spin" />
                      {t("Listen werden geladen …", "Loading lists …")}
                    </div>
                  ) : lists.length === 0 ? (
                    <p className="mt-3 text-xs text-muted">
                      {t(
                        "Noch keine Liste. Lege unten die erste an.",
                        "No lists yet. Create your first one below.",
                      )}
                    </p>
                  ) : (
                    <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {lists.map((list) => (
                        <li key={list.id}>
                          <button
                            type="button"
                            onClick={() => toggle(list)}
                            disabled={pending}
                            aria-pressed={list.contains}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                              list.contains
                                ? "border-gold/35 bg-gold/[0.08] text-gold"
                                : "border-line bg-white/[0.02] text-muted hover:border-cream/25 hover:text-cream",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded border",
                                list.contains
                                  ? "border-gold bg-gold text-[#17120a]"
                                  : "border-line",
                              )}
                            >
                              {list.contains ? <Check className="size-3" /> : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {list.name}
                            </span>
                            <span className="text-[10px] tabular-nums text-muted-2">
                              {list.count}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form onSubmit={createList} className="mt-3 flex gap-2">
                    <input
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      maxLength={80}
                      placeholder={t("Neue Liste …", "New list …")}
                      aria-label={t("Name der neuen Liste", "New list name")}
                      className="input-base h-9 min-w-0 flex-1 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={pending || !newName.trim()}
                      className="btn-primary h-9 shrink-0 px-3 text-xs"
                      title={t("Liste anlegen", "Create list")}
                    >
                      {pending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                    </button>
                  </form>
                </div>

                <div className="mt-5 border-t border-line-soft pt-4">
                  <button
                    type="button"
                    onClick={removeFromArchive}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 text-[11px] text-rust transition-colors hover:text-[#ffb4a3]"
                  >
                    {deleting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {t("Aus dem Archiv entfernen", "Remove from archive")}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
