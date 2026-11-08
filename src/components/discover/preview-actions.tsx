"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ListPlus, Loader2, Plus } from "lucide-react";
import { addListCandidateAction, addMovieFromTmdbAction } from "@/app/actions";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import type { MediaType } from "@/lib/types";

export type PreviewListOption = {
  id: number;
  name: string;
  count: number;
};

export function PreviewActions({
  tmdbId,
  mediaType,
  lists,
}: {
  tmdbId: number;
  mediaType: MediaType;
  lists: PreviewListOption[];
}) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [listName, setListName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detailHref = `${mediaType === "serie" ? "/serien" : "/filme"}/${slug ?? ""}`;

  async function addToArchive() {
    setBusy(true);
    setError(null);
    const result = await addMovieFromTmdbAction(tmdbId, mediaType);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSlug(result.data.slug);
    router.refresh();
  }

  async function addToList(listId: number) {
    const list = lists.find((entry) => entry.id === listId);
    if (!list) return;
    setBusy(true);
    setError(null);
    const result = await addListCandidateAction(list.id, { tmdbId, mediaType });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSlug(result.data.slug);
    setListName(list.name);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {slug ? (
        <Link
          href={detailHref}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-moss/35 bg-moss/10 px-4 text-xs text-moss transition-colors hover:border-moss/60"
        >
          <Check className="size-3.5" />
          {t("Im Archiv ansehen", "View in archive")}
        </Link>
      ) : (
        <button
          type="button"
          onClick={addToArchive}
          disabled={busy}
          className={cn(
            "btn-primary h-10 w-full text-xs",
            busy && "opacity-70",
          )}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          {t("Ins Archiv übernehmen", "Add to archive")}
        </button>
      )}

      {lists.length > 0 ? (
        <label className="relative block">
          <ListPlus className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
          <select
            value=""
            onChange={(event) => {
              const listId = Number(event.target.value);
              event.target.value = "";
              if (listId) void addToList(listId);
            }}
            disabled={busy}
            className="h-10 w-full appearance-none rounded-full border border-line bg-surface-2 pl-9 pr-3 text-xs text-muted transition-colors hover:border-cream/25 hover:text-cream focus:border-gold/50 focus:outline-none"
            aria-label={t("Auf eine Liste setzen", "Add to a list")}
          >
            <option value="">
              {listName
                ? t(`Auf „${listName}“`, `To “${listName}”`)
                : t("Auf eine Liste setzen …", "Add to a list …")}
            </option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.count})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <Link
          href="/listen"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-dashed border-line px-4 text-xs text-muted-2 transition-colors hover:border-gold/40 hover:text-gold"
        >
          <ListPlus className="size-3.5" />
          {t("Liste anlegen", "Create list")}
        </Link>
      )}

      {error ? (
        <p className="rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-[11px] leading-relaxed text-[#f0a08e]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
