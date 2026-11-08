"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ChevronDown,
  Film,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Tv,
} from "lucide-react";
import {
  importSeedBatchAction,
  removeStarterDataAction,
} from "@/app/actions";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { formatInt } from "@/lib/format";
import { SEED_MOVIES, SEED_SERIES } from "@/lib/seed-list";
import type { MediaType } from "@/lib/types";

type StarterProgress = {
  done: number;
  total: number;
  added: number;
  skipped: number;
  failed: string[];
};

const PACKS = [
  {
    media: "movie" as MediaType,
    entries: SEED_MOVIES,
    icon: Film,
  },
  {
    media: "serie" as MediaType,
    entries: SEED_SERIES,
    icon: Tv,
  },
];

export function StarterPackages({
  configured,
  starterMovieImported,
  starterSeriesImported,
  starterMoviePresent,
  starterSeriesPresent,
}: {
  configured: boolean;
  starterMovieImported: number[];
  starterSeriesImported: number[];
  starterMoviePresent: number[];
  starterSeriesPresent: number[];
}) {
  const router = useRouter();
  const t = useT();
  const [expanded, setExpanded] = useState<Record<MediaType, boolean>>({
    movie: false,
    serie: false,
  });
  const [query, setQuery] = useState<Record<MediaType, string>>({
    movie: "",
    serie: "",
  });
  const [selected, setSelected] = useState<Record<MediaType, number[]>>({
    movie: [],
    serie: [],
  });
  const [running, setRunning] = useState<MediaType | null>(null);
  const [removing, setRemoving] = useState<MediaType | null>(null);
  const [progress, setProgress] = useState<
    Partial<Record<MediaType, StarterProgress>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function packImported(media: MediaType) {
    return media === "movie" ? starterMovieImported : starterSeriesImported;
  }

  function packPresent(media: MediaType) {
    return media === "movie" ? starterMoviePresent : starterSeriesPresent;
  }

  function visibleEntries(media: MediaType) {
    const entries = media === "movie" ? SEED_MOVIES : SEED_SERIES;
    const needle = query[media].trim().toLowerCase();
    return entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) =>
        needle ? entry.title.toLowerCase().includes(needle) : true,
      );
  }

  function toggleEntry(media: MediaType, index: number) {
    setSelected((current) => {
      const list = current[media];
      return {
        ...current,
        [media]: list.includes(index)
          ? list.filter((value) => value !== index)
          : [...list, index],
      };
    });
  }

  function selectAll(media: MediaType, include: boolean) {
    const indices = include
      ? visibleEntries(media).map(({ index }) => index)
      : [];
    setSelected((current) => ({ ...current, [media]: indices }));
  }

  async function runImport(media: MediaType, indices: number[]) {
    const entries = media === "movie" ? SEED_MOVIES : SEED_SERIES;
    const total = indices.length > 0 ? indices.length : entries.length;
    setRunning(media);
    setError(null);
    setMessage(null);
    setProgress((current) => ({
      ...current,
      [media]: { done: 0, total, added: 0, skipped: 0, failed: [] },
    }));
    let offset = 0;
    let added = 0;
    let skipped = 0;
    const failed: string[] = [];
    try {
      while (offset < total) {
        const result = await importSeedBatchAction(
          media,
          indices,
          offset,
          media === "serie" ? 4 : 6,
        );
        if (!result.ok) {
          setError(result.error);
          break;
        }
        added += result.data.added;
        skipped += result.data.skipped;
        failed.push(...result.data.failed);
        const next = result.data.nextOffset;
        setProgress((current) => ({
          ...current,
          [media]: { done: next, total, added, skipped, failed: [...failed] },
        }));
        if (next <= offset) break;
        offset = next;
        if (result.data.done) break;
      }
      setMessage(
        t(
          `${added} neu · ${skipped} bereits vorhanden`,
          `${added} added · ${skipped} already present`,
        ),
      );
      router.refresh();
    } finally {
      setRunning(null);
    }
  }

  async function removeStarter(media: MediaType, indices?: number[]) {
    const label =
      media === "movie" ? t("Filme", "movies") : t("Serien", "series");
    const selectedOnly = Boolean(indices && indices.length > 0);
    const confirmed = window.confirm(
      selectedOnly
        ? t(
            `Ausgewählte ${label} aus dem Archiv entfernen? Auch Titel, die nicht über das Startpaket importiert wurden, werden gelöscht.`,
            `Remove selected ${label} from the archive? Titles that were not imported through the starter package are deleted as well.`,
          )
        : t(
            `Alle ${label} entfernen, die über das Startpaket importiert wurden?`,
            `Remove all ${label} that were imported through the starter package?`,
          ),
    );
    if (!confirmed) return;
    setRemoving(media);
    setError(null);
    setMessage(null);
    const result = await removeStarterDataAction(media, indices ?? []);
    setRemoving(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (selectedOnly) {
      setSelected((current) => ({
        ...current,
        [media]: current[media].filter((value) => !(indices ?? []).includes(value)),
      }));
    }
    const removed = result.data.count;
    const noun =
      removed === 1
        ? media === "movie"
          ? t("Film", "movie")
          : t("Serie", "series")
        : label;
    setMessage(
      t(`${removed} ${noun} entfernt.`, `${removed} ${noun} removed.`),
    );
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {PACKS.map((pack) => {
          const media = pack.media;
          const entries = pack.entries;
          const icon = pack.icon;
          const Icon = icon;
          const importedIndices = new Set(packImported(media));
          const presentIndices = new Set(packPresent(media));
          const present = presentIndices.size;
          const entriesLabel = media === "movie" ? t("Filme", "movies") : t("Serien", "series");
          const list = visibleEntries(media);
          const chosen = selected[media];
          const chosenPresent = chosen.filter((index) => presentIndices.has(index));
          const prog = progress[media];
          const percent =
            prog && prog.total > 0
              ? Math.round((prog.done / prog.total) * 100)
              : 0;
          const busy = running === media;
          const anyBusy = running !== null || removing !== null;

          return (
            <div key={media} className="surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-gold">
                    <Sparkles className="size-4" />
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
                      {t("Startpaket", "Starter package")}
                    </p>
                  </div>
                  <h2 className="mt-2 flex items-center gap-2 text-base font-medium text-cream">
                    <Icon className="size-4 text-gold/80" />
                    {formatInt(entries.length)} {t("kuratierte", "curated")}{" "}
                    {entriesLabel}
                  </h2>
                </div>
                {present > 0 ? (
                  <span className="chip border-gold/25 text-gold">
                    {formatInt(present)}{" "}
                    {t("im Archiv", "in archive")}
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-xs leading-relaxed text-muted">
                {media === "movie"
                  ? t(
                      "Ein Jahrhundert Kino: Klassiker, Meilensteine und moderne Favoriten. Der Import sucht jeden Titel bei TMDB und übernimmt Titel, Poster, Besetzung, Laufzeit und Einspiel.",
                      "A century of cinema: classics, milestones and modern favourites. The import looks up every title on TMDB and brings in titles, posters, cast, runtime and box office.",
                    )
                  : t(
                      "Serien aus sieben Jahrzehnten: Von Klassikern bis zu aktuellen Prestige-Produktionen. Der Import übernimmt Metadaten und Folgenliste, damit du den Fortschritt direkt tracken kannst.",
                      "Series from seven decades: from classics to current prestige productions. The import brings in metadata and the episode list so you can track progress right away.",
                    )}
              </p>

              {!configured ? (
                <p className="mt-3 rounded-lg border border-gold/20 bg-gold/[0.04] px-3 py-2 text-[11px] text-gold-soft">
                  {t(
                    "Für das Startpaket wird ein TMDB-Key benötigt.",
                    "A TMDB key is required for the starter package.",
                  )}{" "}
                  <Link
                    href="/admin?tab=einstellungen"
                    className="underline underline-offset-2"
                  >
                    {t("Jetzt hinterlegen", "Add one now")}
                  </Link>
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => runImport(media, [])}
                  disabled={!configured || anyBusy}
                  className="btn-primary h-9 px-4 text-xs"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="size-3.5" />
                  )}
                  {busy
                    ? t("Import läuft …", "Importing …")
                    : t("Ganzes Paket importieren", "Import whole package")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) => ({
                      ...current,
                      [media]: !current[media],
                    }))
                  }
                  disabled={anyBusy}
                  className="btn-ghost h-9 px-4 text-xs"
                >
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform",
                      expanded[media] && "rotate-180",
                    )}
                  />
                  {t("Einträge auswählen", "Choose entries")}
                </button>
                {importedIndices.size > 0 ? (
                  <button
                    type="button"
                    onClick={() => removeStarter(media)}
                    disabled={anyBusy}
                    className="btn-quiet h-9 border border-line px-3 text-xs text-rust hover:bg-rust/10 hover:text-rust"
                  >
                    {removing === media ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {t("Startpaket entfernen", "Remove starter entries")}
                  </button>
                ) : null}
              </div>

              {expanded[media] ? (
                <div className="mt-4 rounded-xl border border-line-soft bg-surface-2/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[160px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
                      <input
                        value={query[media]}
                        onChange={(event) =>
                          setQuery((current) => ({
                            ...current,
                            [media]: event.target.value,
                          }))
                        }
                        placeholder={t("Paket durchsuchen …", "Search package …")}
                        className="input-base h-8 pl-8 text-[11px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => selectAll(media, true)}
                      className="text-[10px] text-muted underline underline-offset-2 hover:text-cream"
                    >
                      {t("Alle", "All")}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectAll(media, false)}
                      className="text-[10px] text-muted underline underline-offset-2 hover:text-cream"
                    >
                      {t("Keine", "None")}
                    </button>
                  </div>

                  <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto pr-1">
                    {list.map(({ entry, index }) => {
                      const active = chosen.includes(index);
                      return (
                        <label
                          key={`${entry.title}-${entry.year}-${index}`}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] transition-colors",
                            active
                              ? "bg-gold/[0.06] text-cream"
                              : "text-muted hover:text-cream",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleEntry(media, index)}
                            className="size-3.5 rounded border-line bg-surface-2 accent-[#c9a227]"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {entry.title}
                          </span>
                          {importedIndices.has(index) ? (
                            <span className="shrink-0 rounded-full border border-moss/30 bg-moss/10 px-1.5 py-px text-[9px] text-[#b6cba9]">
                              {t("importiert", "imported")}
                            </span>
                          ) : presentIndices.has(index) ? (
                            <span className="shrink-0 rounded-full border border-line bg-white/[0.03] px-1.5 py-px text-[9px] text-muted-2">
                              {t("im Archiv", "in archive")}
                            </span>
                          ) : null}
                          <span className="tabular-nums text-[10px] text-muted-2">
                            {entry.year}
                          </span>
                        </label>
                      );
                    })}
                    {list.length === 0 ? (
                      <p className="px-2 py-3 text-center text-[11px] text-muted-2">
                        {t("Keine Einträge gefunden.", "No entries found.")}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
                    <p className="text-[10px] text-muted-2">
                      {t(
                        `${chosen.length} ausgewählt${chosenPresent.length > 0 ? ` · ${chosenPresent.length} im Archiv` : ""}`,
                        `${chosen.length} selected${chosenPresent.length > 0 ? ` · ${chosenPresent.length} in archive` : ""}`,
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeStarter(media, chosenPresent)}
                        disabled={anyBusy || chosenPresent.length === 0}
                        className="btn-quiet h-8 border border-line px-3 text-[11px] text-rust hover:bg-rust/10 hover:text-rust"
                        title={t(
                          "Ausgewählte Titel entfernen – auch manuell hinzugefügte",
                          "Remove selected titles – including manually added ones",
                        )}
                      >
                        {removing === media ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        {t(
                          `Auswahl entfernen (${chosenPresent.length})`,
                          `Remove selection (${chosenPresent.length})`,
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => runImport(media, chosen)}
                        disabled={!configured || anyBusy || chosen.length === 0}
                        className="btn-primary h-8 px-4 text-[11px]"
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="size-3.5" />
                        )}
                        {t(
                          `Auswahl importieren (${chosen.length})`,
                          `Import selection (${chosen.length})`,
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {prog ? (
                <div className="mt-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-gold transition-[width] duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                    <span>
                      {prog.done} / {prog.total} {t("geprüft", "checked")} ·{" "}
                      {prog.added} {t("neu", "added")} · {prog.skipped}{" "}
                      {t("vorhanden", "present")}
                    </span>
                    {prog.failed.length > 0 ? (
                      <span className="text-rust">
                        {prog.failed.length}{" "}
                        {t("nicht gefunden", "not found")}
                      </span>
                    ) : null}
                  </div>
                  {prog.failed.length > 0 ? (
                    <p className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-line bg-surface-2 p-2 text-[10px] leading-relaxed text-muted-2">
                      {prog.failed.join(" · ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {message ? (
        <p className="rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-[#b6cba9]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
