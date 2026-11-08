"use client";

import { Fragment, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleAlert,
  FileDown,
  FileUp,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import {
  commitTmdbImportAction,
  matchTmdbBatchAction,
  matchTmdbRowAction,
  searchTmdbMatchAction,
} from "@/app/actions";
import { Poster } from "@/components/poster";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { translateError } from "@/lib/errors";
import {
  MAX_IMPORT_ROWS,
  parseImportInput,
  type ParseImportResult,
} from "@/lib/import-parse";
import { formatInt, formatScore, formatYear } from "@/lib/format";
import type {
  MediaType,
  TmdbMatchCandidate,
  TmdbMatchResult,
} from "@/lib/types";

const EXAMPLE = "Der Pate (1972)\nMetropolis (1927)\nSpirited Away (2001)";
const TEMPLATE =
  "title,year,original_title\nDer Pate,1972,The Godfather\nMetropolis,1927,\n";

type Translate = (de: string, en: string) => string;

function posterFor(candidate: TmdbMatchCandidate) {
  return {
    id: -candidate.tmdbId,
    titleDe: candidate.title,
    titleOriginal: candidate.originalTitle,
    year: candidate.year,
    posterPath: candidate.posterPath,
  };
}

function confidenceTone(label: TmdbMatchCandidate["matchLabel"]) {
  if (label === "hoch") return "border-moss/35 bg-moss/10 text-moss";
  if (label === "mittel") return "border-gold/35 bg-gold/10 text-gold";
  return "border-line bg-white/[0.02] text-muted";
}

function matchLabelText(t: Translate, label: TmdbMatchCandidate["matchLabel"]) {
  if (label === "hoch") return t("hoch", "high");
  if (label === "mittel") return t("mittel", "medium");
  return t("niedrig", "low");
}

/** Match reasons are produced in German by the matching layer. */
function reasonText(t: Translate, reason: string) {
  const reasons: Record<string, [string, string]> = {
    "Titel exakt": ["Titel exakt", "exact title"],
    "Originaltitel exakt": ["Originaltitel exakt", "exact original title"],
    "Titel sehr ähnlich": ["Titel sehr ähnlich", "very similar title"],
    "Titel teilweise ähnlich": ["Titel teilweise ähnlich", "partly similar title"],
    "Jahr exakt": ["Jahr exakt", "exact year"],
    "Jahr ±1": ["Jahr ±1", "year ±1"],
    "Jahr nah": ["Jahr nah", "close year"],
    "viele Stimmen": ["viele Stimmen", "many votes"],
    "TMDB-ID": ["TMDB-ID", "TMDB ID"],
  };
  const entry = reasons[reason];
  return entry ? t(entry[0], entry[1]) : reason;
}

export type ImportListOption = { id: number; name: string; count: number };

export function SmartImport({
  configured,
  lists,
}: {
  configured: boolean;
  lists: ImportListOption[];
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaType>("movie");
  const [parsed, setParsed] = useState<ParseImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [matches, setMatches] = useState<TmdbMatchResult[] | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState({ done: 0, total: 0 });
  const [matchError, setMatchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, number | null>>({});
  const [ignored, setIgnored] = useState<Record<number, boolean>>({});
  const [targets, setTargets] = useState<Record<number, string>>({});

  const [searchOpen, setSearchOpen] = useState<number | null>(null);
  const [manualQuery, setManualQuery] = useState<Record<number, string>>({});
  const [manualSearching, setManualSearching] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string | null>>({});

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    added: number;
    updated: number;
    listed: number;
    imported: { id: number; slug: string; title: string }[];
    errors: string[];
  } | null>(null);

  function resetMatches() {
    setMatches(null);
    setSelected({});
    setIgnored({});
    setTargets({});
    setSearchOpen(null);
    setRowError({});
    setMatchError(null);
    setImportError(null);
    setImportResult(null);
    setMatchProgress({ done: 0, total: 0 });
    setImportProgress({ done: 0, total: 0 });
  }

  function translateClientError(message: string) {
    return translateError(message, locale);
  }

  function parse(value: string) {
    setParseError(null);
    resetMatches();
    if (!value.trim()) {
      setParsed(null);
      return;
    }
    try {
      const result = parseImportInput(value);
      if (result.rows.length === 0) {
        throw new Error("Keine gültigen Titel gefunden.");
      }
      if (result.rows.length > MAX_IMPORT_ROWS) {
        throw new Error(
          `Maximal ${MAX_IMPORT_ROWS} Titel pro Abgleich. Bitte die Liste aufteilen.`,
        );
      }
      setParsed(result);
    } catch (error) {
      setParsed(null);
      setParseError(
        translateClientError(
          error instanceof Error
            ? error.message
            : "Liste konnte nicht gelesen werden.",
        ),
      );
    }
  }

  async function runMatch() {
    if (!parsed || parsed.rows.length === 0 || !configured) return;
    setMatching(true);
    setMatchError(null);
    setImportError(null);
    setImportResult(null);
    setMatches([]);
    setSelected({});
    setIgnored({});
    setTargets({});
    setRowError({});
    setMatchProgress({ done: 0, total: parsed.rows.length });

    let offset = 0;
    try {
      while (offset < parsed.rows.length) {
        const result = await matchTmdbBatchAction(
          parsed.rows,
          offset,
          6,
          media,
        );
        if (!result.ok) {
          setMatchError(result.error);
          break;
        }
        offset = result.data.nextOffset;
        setMatches((current) => [...(current ?? []), ...result.data.results]);
        setSelected((current) => {
          const next = { ...current };
          for (const row of result.data.results) {
            if (!(row.index in next)) next[row.index] = row.bestTmdbId;
          }
          return next;
        });
        setMatchProgress({ done: offset, total: parsed.rows.length });
        if (result.data.done) break;
      }
    } finally {
      setMatching(false);
    }
  }

  function pickedTmdbId(row: TmdbMatchResult): number | null {
    return row.index in selected ? selected[row.index] : row.bestTmdbId;
  }

  function candidateForRow(row: TmdbMatchResult): TmdbMatchCandidate | null {
    const tmdbId = pickedTmdbId(row);
    return (
      row.candidates.find((candidate) => candidate.tmdbId === tmdbId) ?? null
    );
  }

  function rowIncluded(row: TmdbMatchResult) {
    if (ignored[row.index]) return false;
    return Boolean(pickedTmdbId(row));
  }

  function setAllIncluded(included: boolean) {
    if (!matches) return;
    setIgnored(
      Object.fromEntries(
        matches
          .filter((row) => (included ? !pickedTmdbId(row) : true))
          .map((row) => [row.index, true]),
      ),
    );
  }

  async function searchRow(row: TmdbMatchResult, event: FormEvent) {
    event.preventDefault();
    const query = (manualQuery[row.index] ?? "").trim();
    if (!query) return;
    setManualSearching(row.index);
    setRowError((current) => ({ ...current, [row.index]: null }));
    const numeric = /^\d{2,}$/.test(query) ? Number(query) : null;
    const result = numeric
      ? await matchTmdbRowAction({ title: row.input.title, tmdbId: numeric }, media)
      : await searchTmdbMatchAction(query, media);
    setManualSearching(null);
    if (!result.ok) {
      setRowError((current) => ({ ...current, [row.index]: result.error }));
      return;
    }
    const incoming = numeric
      ? (result.data as TmdbMatchResult).candidates
      : (result.data as TmdbMatchCandidate[]);
    if (incoming.length === 0) {
      setRowError((current) => ({
        ...current,
        [row.index]: t(
          "Kein TMDB-Treffer für diese Suche.",
          "No TMDB match for this search.",
        ),
      }));
      return;
    }
    setMatches(
      (current) =>
        current?.map((entry) => {
          if (entry.index !== row.index) return entry;
          const merged = new Map<number, TmdbMatchCandidate>();
          for (const candidate of [...entry.candidates, ...incoming]) {
            const known = merged.get(candidate.tmdbId);
            if (!known || candidate.matchScore > known.matchScore) {
              merged.set(candidate.tmdbId, candidate);
            }
          }
          const candidates = [...merged.values()]
            .sort(
              (a, b) =>
                b.matchScore - a.matchScore ||
                (b.popularity ?? 0) - (a.popularity ?? 0),
            )
            .slice(0, 8);
          const best = candidates[0] ?? null;
          return {
            ...entry,
            candidates,
            bestTmdbId: best?.tmdbId ?? null,
            status: best
              ? best.matchScore >= 70
                ? "matched"
                : "review"
              : "none",
            error: undefined,
          };
        }) ?? null,
    );
    const picked = [...incoming].sort((a, b) => b.matchScore - a.matchScore)[0];
    if (picked) {
      setSelected((current) => ({ ...current, [row.index]: picked.tmdbId }));
    }
    setIgnored((current) => ({ ...current, [row.index]: false }));
    setSearchOpen(null);
    setManualQuery((current) => ({ ...current, [row.index]: "" }));
  }

  async function commit() {
    if (!matches) return;
    const choices = new Map<
      number,
      {
        index: number;
        tmdbId: number;
        inputTitle: string;
        mediaType: MediaType;
        listId: number | null;
      }
    >();
    for (const row of matches) {
      if (!rowIncluded(row)) continue;
      const tmdbId = pickedTmdbId(row);
      if (!tmdbId || choices.has(tmdbId)) continue;
      const target = Number(targets[row.index]);
      choices.set(tmdbId, {
        index: row.index,
        tmdbId,
        inputTitle: row.input.title,
        mediaType: media,
        listId: Number.isFinite(target) && target > 0 ? target : null,
      });
    }
    const list = [...choices.values()];
    if (list.length === 0) {
      setImportError(
        t(
          "Keine Titel ausgewählt. Setze Häkchen oder ordne mindestens eine Zeile zu.",
          "No titles selected. Tick a box or assign at least one row.",
        ),
      );
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportResult(null);
    setImportProgress({ done: 0, total: list.length });
    let offset = 0;
    let added = 0;
    let updated = 0;
    let listed = 0;
    const imported: { id: number; slug: string; title: string }[] = [];
    const errors: string[] = [];

    try {
      while (offset < list.length) {
        const result = await commitTmdbImportAction(list, offset, 4);
        if (!result.ok) {
          setImportError(result.error);
          break;
        }
        offset = result.data.nextOffset;
        added += result.data.added;
        updated += result.data.updated;
        listed += result.data.listed;
        imported.push(...result.data.imported);
        errors.push(...result.data.errors);
        setImportProgress({ done: offset, total: list.length });
        if (result.data.done) break;
      }
      setImportResult({ added, updated, listed, imported, errors });
      if (added + updated > 0) router.refresh();
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${TEMPLATE}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "filmgold-tmdb-abgleich.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const rows = matches ?? [];
  const counted = rows.reduce(
    (summary, row) => {
      summary[row.status] += 1;
      return summary;
    },
    { matched: 0, review: 0, none: 0, error: 0 } as Record<
      TmdbMatchResult["status"],
      number
    >,
  );
  const selectedIds = new Set<number>();
  for (const row of rows) {
    if (!rowIncluded(row)) continue;
    const tmdbId = pickedTmdbId(row);
    if (tmdbId) selectedIds.add(tmdbId);
  }
  const selectedCount = selectedIds.size;
  const matchPercent =
    matchProgress.total > 0
      ? Math.round((matchProgress.done / matchProgress.total) * 100)
      : 0;
  const importPercent =
    importProgress.total > 0
      ? Math.round((importProgress.done / importProgress.total) * 100)
      : 0;
  const importWord =
    media === "serie"
      ? selectedCount === 1
        ? t("Serie", "series")
        : t("Serien", "series")
      : selectedCount === 1
        ? t("Film", "movie")
        : t("Filme", "movies");

  return (
    <section className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-gold">
            <Wand2 className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t("TMDB-Abgleich", "TMDB match")}
            </p>
          </div>
          <h2 className="mt-2 text-base font-medium text-cream">
            {t(
              "Titelliste einlesen, Treffer prüfen, sauber importieren",
              "Load a title list, review matches, import cleanly",
            )}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            {t(
              "Füge eine Liste aus Titeln, CSV oder JSON ein. Filmgold sucht zu jeder Zeile den passenden Titel bei TMDB, zeigt den besten Vorschlag und erlaubt dir, die Zuordnung vor dem Import zu korrigieren. Vorhandene Einträge werden aktualisiert statt doppelt angelegt.",
              "Paste a list of titles, CSV or JSON. Filmgold looks up the matching title on TMDB for every row, shows the best suggestion and lets you correct the assignment before importing. Existing entries are updated instead of duplicated.",
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div
            className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2/70 p-0.5"
            role="group"
            aria-label={t("Medienart für den Abgleich", "Media type for matching")}
          >
            {(["movie", "serie"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMedia(value);
                  resetMatches();
                }}
                aria-pressed={media === value}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] transition-colors",
                  media === value
                    ? "bg-gold/15 text-gold"
                    : "text-muted hover:text-cream",
                )}
              >
                {value === "movie" ? t("Filme", "Movies") : t("Serien", "Series")}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="btn-quiet border border-line"
          >
            <FileDown className="size-3" />
            {t("CSV-Vorlage", "CSV template")}
          </button>
        </div>
      </div>

      {!configured ? (
        <p className="mt-4 rounded-lg border border-gold/20 bg-gold/[0.04] px-3 py-2 text-[11px] text-gold-soft">
          {t(
            "Für den Abgleich wird ein TMDB-Key benötigt.",
            "A TMDB key is required for matching.",
          )}{" "}
          <Link
            href="/admin?tab=einstellungen"
            className="underline underline-offset-2"
          >
            {t("Jetzt hinterlegen", "Add one now")}
          </Link>
        </p>
      ) : null}

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.txt,text/csv,application/json,text/plain"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const value = await file.text();
              setFileName(file.name);
              setText(value);
              parse(value);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-ghost h-9 px-4 text-xs"
          >
            <FileUp className="size-3.5" />
            {t("Datei wählen", "Choose file")}
          </button>
          <button
            type="button"
            onClick={() => {
              setText(EXAMPLE);
              setFileName(null);
              parse(EXAMPLE);
            }}
            className="btn-quiet border border-line"
          >
            <Sparkles className="size-3" />
            {t("Beispiel", "Example")}
          </button>
          {fileName ? (
            <span className="text-[11px] text-muted-2">{fileName}</span>
          ) : null}
        </div>

        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setFileName(null);
            setParsed(null);
            setParseError(null);
            resetMatches();
          }}
          onBlur={() => parse(text)}
          rows={8}
          placeholder={t(
            "Der Pate (1972)\nMetropolis (1927)\nSpirited Away (2001)\n\n… oder CSV/JSON mit title, year, original_title",
            "The Godfather (1972)\nMetropolis (1927)\nSpirited Away (2001)\n\n… or CSV/JSON with title, year, original_title",
          )}
          className="input-base mt-3 resize-y font-mono text-[11px] leading-relaxed"
        />

        {parseError ? (
          <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
            {parseError}
          </p>
        ) : null}

        {parsed ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-[11px] text-cream">
              {formatInt(parsed.rows.length, locale)}{" "}
              {parsed.rows.length === 1 ? t("Zeile", "row") : t("Zeilen", "rows")}{" "}
              {t("erkannt", "detected")}
              <span className="text-muted-2">
                {" "}
                · {parsed.format.toUpperCase()}
                {parsed.duplicates > 0
                  ? t(
                      ` · ${parsed.duplicates} Duplikat(e) entfernt`,
                      ` · ${parsed.duplicates} duplicate(s) removed`,
                    )
                  : ""}
                {parsed.skipped > 0
                  ? t(
                      ` · ${parsed.skipped} Zeile(n) übersprungen`,
                      ` · ${parsed.skipped} row(s) skipped`,
                    )
                  : ""}
              </span>
            </p>
            <button
              type="button"
              onClick={runMatch}
              disabled={matching || !configured}
              className="btn-primary h-9 px-4 text-xs"
            >
              {matching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              {matching
                ? t("Abgleich läuft …", "Matching …")
                : t("Mit TMDB abgleichen", "Match with TMDB")}
            </button>
          </div>
        ) : null}

        {matching ||
        (matchProgress.done > 0 && matchProgress.done < matchProgress.total) ? (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full bg-gold transition-[width] duration-500"
                style={{ width: `${matchPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {formatInt(matchProgress.done, locale)} /{" "}
              {formatInt(matchProgress.total, locale)} {t("geprüft", "checked")}
            </p>
          </div>
        ) : null}

        {matchError ? (
          <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
            {matchError}
          </p>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="chip border-moss/30 text-moss">
                <Check className="size-3" /> {counted.matched}{" "}
                {t("sicher", "confident")}
              </span>
              <span className="chip border-gold/30 text-gold">
                <CircleAlert className="size-3" /> {counted.review}{" "}
                {t("prüfen", "review")}
              </span>
              <span className="chip text-muted">
                {counted.none + counted.error} {t("ohne Treffer", "no match")}
              </span>
              <span className="text-muted-2">
                {selectedCount} {t("ausgewählt", "selected")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {lists.length > 0 ? (
                <label className="flex items-center gap-1.5 text-[11px] text-muted-2">
                  {t("Ziel-Liste für alle", "Target list for all")}
                  <select
                    value=""
                    onChange={(event) => {
                      const value = event.target.value;
                      setTargets(
                        Object.fromEntries(rows.map((row) => [row.index, value])),
                      );
                    }}
                    className="input-base h-8 w-44 text-[11px]"
                    aria-label={t(
                      "Ziel-Liste für alle Zeilen",
                      "Target list for all rows",
                    )}
                  >
                    <option value="">{t("Nur Archiv", "Archive only")}</option>
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => setAllIncluded(true)}
                className="text-[11px] text-muted underline underline-offset-2 hover:text-cream"
              >
                {t("Alle mit Treffer", "All with a match")}
              </button>
              <button
                type="button"
                onClick={() => setAllIncluded(false)}
                className="text-[11px] text-muted underline underline-offset-2 hover:text-cream"
              >
                {t("Alle abwählen", "Deselect all")}
              </button>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-[0.14em] text-muted-2">
                <tr>
                  <th className="w-10 px-3 py-2.5"> </th>
                  <th className="px-3 py-2.5">{t("Deine Zeile", "Your row")}</th>
                  <th className="px-3 py-2.5">
                    {t("Bester Treffer", "Best match")}
                  </th>
                  <th className="px-3 py-2.5">{t("Status", "Status")}</th>
                  <th className="w-40 px-3 py-2.5">
                    {t("Ziel-Liste", "Target list")}
                  </th>
                  <th className="w-36 px-3 py-2.5">
                    {t("Zuordnung", "Assignment")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const candidate = candidateForRow(row);
                  const included = rowIncluded(row);
                  const selectedId = pickedTmdbId(row) ?? "";
                  const searching = manualSearching === row.index;
                  return (
                    <Fragment key={row.index}>
                      <tr
                        className={cn(
                          "border-t border-line-soft align-top",
                          !included && "opacity-55",
                        )}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(event) =>
                              setIgnored((current) => ({
                                ...current,
                                [row.index]: !event.target.checked,
                              }))
                            }
                            disabled={!candidate}
                            className="size-3.5 accent-[#c8a45c]"
                            aria-label={t(
                              `Zeile ${row.index + 1} importieren`,
                              `Import row ${row.index + 1}`,
                            )}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-cream">
                            {row.input.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-2">
                            {formatYear(row.input.year)}
                            {row.input.tmdbId
                              ? ` · TMDB ${row.input.tmdbId}`
                              : ""}
                          </p>
                          {row.status === "error" && row.error ? (
                            <p className="mt-1 max-w-[220px] text-[10px] text-rust">
                              {row.error}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          {row.candidates.length > 0 ? (
                            <div className="flex items-start gap-3">
                              {candidate ? (
                                <Poster
                                  movie={posterFor(candidate)}
                                  imageSize="w342"
                                  sizes="40px"
                                  className="w-10 shrink-0"
                                />
                              ) : (
                                <span className="flex aspect-2/3 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-muted-2">
                                  <X className="size-3" />
                                </span>
                              )}
                              <div className="min-w-0">
                                <select
                                  value={selectedId}
                                  onChange={(event) =>
                                    setSelected((current) => ({
                                      ...current,
                                      [row.index]: event.target.value
                                        ? Number(event.target.value)
                                        : null,
                                    }))
                                  }
                                  className="input-base h-8 w-full max-w-[260px] text-[11px]"
                                  aria-label={t(
                                    `Treffer für ${row.input.title}`,
                                    `Matches for ${row.input.title}`,
                                  )}
                                >
                                  <option value="">
                                    {t("Kein Titel", "No title")}
                                  </option>
                                  {row.candidates.map((entry) => (
                                    <option
                                      key={entry.tmdbId}
                                      value={entry.tmdbId}
                                    >
                                      {entry.title} ({formatYear(entry.year)}) ·{" "}
                                      {entry.matchScore}%
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-1 truncate text-[10px] text-muted-2">
                                  {candidate
                                    ? `${
                                        candidate.originalTitle !== candidate.title
                                          ? candidate.originalTitle
                                          : t(
                                              "Kein abweichender Originaltitel",
                                              "No different original title",
                                            )
                                      }${
                                        candidate.rating
                                          ? ` · TMDB ${formatScore(
                                              candidate.rating,
                                              1,
                                              locale,
                                            )}`
                                          : ""
                                      }`
                                    : t("Nicht zugeordnet", "Not assigned")}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-2">
                              {t(
                                "Kein Treffer – nutze „Anders zuordnen“.",
                                "No match – use “Assign differently”.",
                              )}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {candidate ? (
                              <>
                                <span
                                  className={cn(
                                    "inline-flex rounded-full border px-2 py-0.5 text-[10px]",
                                    confidenceTone(candidate.matchLabel),
                                  )}
                                >
                                  {matchLabelText(t, candidate.matchLabel)}
                                </span>
                                {candidate.existingId ? (
                                  <Link
                                    href={`${
                                      candidate.mediaType === "serie"
                                        ? "/serien"
                                        : "/filme"
                                    }/${candidate.existingSlug}`}
                                    className="inline-flex rounded-full border border-moss/30 bg-moss/10 px-2 py-0.5 text-[10px] text-moss hover:underline"
                                  >
                                    {t("vorhanden", "in archive")}
                                  </Link>
                                ) : (
                                  <span className="inline-flex rounded-full border border-gold/30 bg-gold/[0.08] px-2 py-0.5 text-[10px] text-gold">
                                    {t("neu", "new")}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-muted-2">–</span>
                            )}
                          </div>
                          {candidate && candidate.reasons.length > 0 ? (
                            <p className="mt-1.5 max-w-[180px] text-[10px] leading-relaxed text-muted-2">
                              {candidate.reasons
                                .map((reason) => reasonText(t, reason))
                                .join(" · ")}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          {lists.length > 0 ? (
                            <select
                              value={targets[row.index] ?? ""}
                              onChange={(event) =>
                                setTargets((current) => ({
                                  ...current,
                                  [row.index]: event.target.value,
                                }))
                              }
                              disabled={!included}
                              className="input-base h-8 w-full max-w-[150px] text-[11px]"
                              aria-label={t(
                                `Ziel-Liste für ${row.input.title}`,
                                `Target list for ${row.input.title}`,
                              )}
                            >
                              <option value="">
                                {t("Nur Archiv", "Archive only")}
                              </option>
                              {lists.map((list) => (
                                <option key={list.id} value={list.id}>
                                  {list.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[10px] text-muted-2">
                              {t("Keine Liste", "No list")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setSearchOpen((current) =>
                                current === row.index ? null : row.index,
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-gold hover:text-gold-soft"
                          >
                            <Search className="size-3" />
                            {t("Anders zuordnen", "Assign differently")}
                          </button>
                        </td>
                      </tr>
                      {searchOpen === row.index ? (
                        <tr className="border-t border-line-soft bg-surface-2/60">
                          <td />
                          <td colSpan={5} className="px-3 py-3">
                            <form
                              onSubmit={(event) => searchRow(row, event)}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <input
                                value={manualQuery[row.index] ?? ""}
                                onChange={(event) =>
                                  setManualQuery((current) => ({
                                    ...current,
                                    [row.index]: event.target.value,
                                  }))
                                }
                                placeholder={t(
                                  "Titel, Originaltitel oder TMDB-ID …",
                                  "Title, original title or TMDB ID …",
                                )}
                                className="input-base h-8 w-full max-w-sm text-[11px]"
                                autoFocus
                                aria-label={t(
                                  `Neue Suche für ${row.input.title}`,
                                  `New search for ${row.input.title}`,
                                )}
                              />
                              <button
                                type="submit"
                                disabled={
                                  searching ||
                                  !(manualQuery[row.index] ?? "").trim()
                                }
                                className="btn-ghost h-8 px-3 text-[11px]"
                              >
                                {searching ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Search className="size-3.5" />
                                )}
                                {t("Suchen", "Search")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSearchOpen(null)}
                                className="btn-quiet h-8 px-3 text-[11px]"
                              >
                                <X className="size-3" />
                                {t("Schließen", "Close")}
                              </button>
                            </form>
                            {rowError[row.index] ? (
                              <p className="mt-2 text-[10px] text-rust">
                                {rowError[row.index]}
                              </p>
                            ) : null}
                            <p className="mt-2 text-[10px] text-muted-2">
                              {t(
                                "Die neue Auswahl ersetzt den bisherigen Vorschlag nicht – du kannst oben weiter zwischen allen Treffern wechseln.",
                                "The new selection does not replace the previous suggestion – you can still switch between all matches above.",
                              )}
                            </p>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
            <div className="text-[11px] text-muted-2">
              {selectedCount > 0
                ? t(
                    `${selectedCount} ${
                      selectedCount === 1
                        ? media === "serie"
                          ? "Serie wird"
                          : "Film wird"
                        : media === "serie"
                          ? "Serien werden"
                          : "Filme werden"
                    } übernommen. Vorhandene Einträge werden aktualisiert.`,
                    `${selectedCount} ${
                      selectedCount === 1 ? "title" : "titles"
                    } will be imported. Existing entries are updated.`,
                  )
                : t("Noch kein Titel ausgewählt.", "No titles selected yet.")}
            </div>
            <button
              type="button"
              onClick={commit}
              disabled={importing || selectedCount === 0}
              className="btn-primary h-9 px-5 text-xs"
            >
              {importing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {importing
                ? t("Import läuft …", "Importing …")
                : `${selectedCount} ${importWord} ${t("übernehmen", "import")}`}
            </button>
          </div>

          {importing ? (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-gold transition-[width] duration-500"
                  style={{ width: `${importPercent}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {formatInt(importProgress.done, locale)} /{" "}
                {formatInt(importProgress.total, locale)}{" "}
                {t("importiert", "imported")}
              </p>
            </div>
          ) : null}

          {importError ? (
            <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
              {importError}
            </p>
          ) : null}

          {importResult ? (
            <div className="mt-3 rounded-lg border border-moss/30 bg-moss/10 px-3 py-3 text-xs text-[#b6cba9]">
              <p>
                {importResult.added} {t("neu", "new")} · {importResult.updated}{" "}
                {t("aktualisiert", "updated")}
                {importResult.listed > 0
                  ? t(
                      ` · ${importResult.listed} auf Listen gesetzt`,
                      ` · ${importResult.listed} added to lists`,
                    )
                  : ""}
                {importResult.errors.length > 0
                  ? t(
                      ` · ${importResult.errors.length} Fehler`,
                      ` · ${importResult.errors.length} errors`,
                    )
                  : ""}
              </p>
              {importResult.imported.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {importResult.imported.slice(0, 10).map((movie) => (
                    <Link
                      key={movie.id}
                      href={`${media === "serie" ? "/serien" : "/filme"}/${movie.slug}`}
                      className="underline underline-offset-2 hover:text-cream"
                    >
                      {movie.title}
                    </Link>
                  ))}
                  {importResult.imported.length > 10 ? (
                    <span className="text-muted-2">
                      +{importResult.imported.length - 10}{" "}
                      {t("weitere", "more")}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {importResult.errors.length > 0 ? (
                <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto text-[10px] text-[#f0a08e]">
                  {importResult.errors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
