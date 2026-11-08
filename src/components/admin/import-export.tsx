"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  Database,
  Download,
  FileSpreadsheet,
  Languages,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  backfillEnglishContentAction,
  backfillEnglishEpisodesAction,
  importRowsAction,
  loadDemoDataAction,
  removeDemoDataAction,
  restoreBackupAction,
} from "@/app/actions";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { csvToObjects } from "@/lib/csv";
import { translateError } from "@/lib/errors";
import { ExportBuilder } from "./export-builder";
import { DatabaseSnapshot } from "./database-snapshot";
import { SmartImport } from "./smart-import";
import { StarterPackages } from "./starter-packages";

const CSV_EXAMPLE =
  "title_de,title_original,year,genres,runtime,director,rt_rating,metacritic,imdb_rating,box_office\n" +
  "Die Verurteilten,The Shawshank Redemption,1994,Drama|Krimi,142,Frank Darabont,91,82,9.3,28341469\n";

export function ImportExport({
  configured,
  demoCount,
  movieCount,
  starterMovieImported,
  starterSeriesImported,
  starterMoviePresent,
  starterSeriesPresent,
  lists,
}: {
  configured: boolean;
  demoCount: number;
  movieCount: number;
  starterMovieImported: number[];
  starterSeriesImported: number[];
  starterMoviePresent: number[];
  starterSeriesPresent: number[];
  lists: { id: number; name: string; count: number }[];
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [backupListId, setBackupListId] = useState("");
  const [backupPending, setBackupPending] = useState(false);
  const [backupName, setBackupName] = useState<string | null>(null);
  const [backupSummary, setBackupSummary] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [contentRunning, setContentRunning] = useState(false);
  const [contentProgress, setContentProgress] = useState<{
    updated: number;
    remaining: number | null;
    failed: string[];
  }>({ updated: 0, remaining: null, failed: [] });
  const [episodeRunning, setEpisodeRunning] = useState(false);
  const [episodeProgress, setEpisodeProgress] = useState<{
    updated: number;
    remaining: number | null;
    failed: string[];
  }>({ updated: 0, remaining: null, failed: [] });
  const [contentError, setContentError] = useState<string | null>(null);

  function parseInput(value: string) {
    setError(null);
    setSummary(null);
    setRows(null);
    const clean = value.trim();
    if (!clean) return;
    try {
      if (clean.startsWith("[") || clean.startsWith("{")) {
        const parsed = JSON.parse(clean) as unknown;
        const list = Array.isArray(parsed)
          ? parsed
          : parsed &&
              typeof parsed === "object" &&
              Array.isArray((parsed as { movies?: unknown }).movies)
            ? (parsed as { movies: unknown[] }).movies
            : null;
        if (!list) {
          throw new Error(
            "JSON muss ein Array oder ein Objekt mit „movies“ sein.",
          );
        }
        setRows(list as Record<string, unknown>[]);
      } else {
        const objects = csvToObjects(clean);
        if (objects.length === 0) throw new Error("Keine Zeilen erkannt.");
        setRows(objects);
      }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Datei konnte nicht gelesen werden.";
      setError(translateError(message, locale));
    }
  }

  async function runImport() {
    if (!rows || rows.length === 0) return;
    setPending(true);
    setError(null);
    setSummary(null);
    try {
      const result = await importRowsAction(rows);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const parts = [
        `${result.data.added} ${t("hinzugefügt", "added")}`,
        `${result.data.updated} ${t("aktualisiert", "updated")}`,
        `${result.data.skipped} ${t("übersprungen", "skipped")}`,
      ];
      if (result.data.errors.length) {
        parts.push(
          `${result.data.errors.length} ${t("Fehler", "errors")}: ${result.data.errors
            .slice(0, 3)
            .join(" | ")}`,
        );
      }
      setSummary(parts.join(" · "));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function runContentBackfill() {
    setContentRunning(true);
    setContentError(null);
    try {
      for (let round = 0; round < 40; round += 1) {
        const result = await backfillEnglishContentAction(8);
        if (!result.ok) {
          setContentError(result.error);
          break;
        }
        setContentProgress((current) => ({
          updated: current.updated + result.data.updated,
          remaining: result.data.remaining,
          failed: [...current.failed, ...result.data.failed],
        }));
        router.refresh();
        if (result.data.remaining <= 0 || result.data.processed === 0) break;
      }
    } finally {
      setContentRunning(false);
    }
  }

  async function runEpisodeBackfill() {
    setEpisodeRunning(true);
    setContentError(null);
    try {
      for (let round = 0; round < 30; round += 1) {
        const result = await backfillEnglishEpisodesAction(4);
        if (!result.ok) {
          setContentError(result.error);
          break;
        }
        setEpisodeProgress((current) => ({
          updated: current.updated + result.data.updated,
          remaining: result.data.remaining,
          failed: [...current.failed, ...result.data.failed],
        }));
        router.refresh();
        if (result.data.remaining <= 0 || result.data.processed === 0) break;
      }
    } finally {
      setEpisodeRunning(false);
    }
  }

  async function restore(file: File) {
    setBackupPending(true);
    setBackupError(null);
    setBackupSummary(null);
    setBackupName(file.name);
    try {
      const text = await file.text();
      const result = await restoreBackupAction(text);
      if (!result.ok) {
        setBackupError(result.error);
        return;
      }
      const data = result.data;
      setBackupSummary(
        [
          `${data.moviesAdded} ${t("neu", "added")}`,
          `${data.moviesUpdated} ${t("aktualisiert", "updated")}`,
          `${data.personal} ${t("persönliche Einträge", "personal entries")}`,
          `${data.episodes} ${t("Folgen", "episodes")}`,
          `${data.listsAdded} ${t("neue Listen", "new lists")}`,
          `${data.listItems} ${t("Listeneinträge", "list items")}`,
        ].join(" · "),
      );
      router.refresh();
    } catch {
      setBackupError(
        t("Die Backup-Datei konnte nicht gelesen werden.", "The backup file could not be read."),
      );
    } finally {
      setBackupPending(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${CSV_EXAMPLE}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = t("filmgold-vorlage.csv", "filmgold-template.csv");
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const previewKeys = rows?.[0] ? Object.keys(rows[0]).slice(0, 8) : [];

  return (
    <div className="space-y-6">
      <StarterPackages
        configured={configured}
        starterMovieImported={starterMovieImported}
        starterSeriesImported={starterSeriesImported}
        starterMoviePresent={starterMoviePresent}
        starterSeriesPresent={starterSeriesPresent}
      />

      <SmartImport configured={configured} lists={lists} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <Upload className="size-4 text-gold" />
              <h2 className="text-sm font-medium text-cream">
                {t(
                  "CSV oder JSON als Rohdaten importieren",
                  "Import CSV or JSON as raw data",
                )}
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t(
                "Für vollständig vorbereitete Datensätze ohne TMDB-Abgleich. Datei auswählen oder Inhalt einfügen. Spaltennamen sind flexibel: title_de, jahr, regie, genres, box_office und deutsche Varianten werden erkannt. Genres und Besetzung mit | trennen. Bestehende Filme werden über TMDB-ID oder Titel + Jahr aktualisiert.",
                "For fully prepared datasets without a TMDB match. Choose a file or paste content. Column names are flexible: title_de, year, director, genres, box_office and German variants are recognised. Separate genres and cast with |. Existing titles are updated by TMDB ID or title + year.",
              )}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json,.txt,text/csv,application/json"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const value = await file.text();
                  setFileName(file.name);
                  setText(value);
                  parseInput(value);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost h-9 px-4 text-xs"
              >
                <Upload className="size-3.5" />
                {t("Datei wählen", "Choose file")}
              </button>
              <button
                type="button"
                onClick={downloadTemplate}
                className="btn-quiet border border-line"
              >
                <FileSpreadsheet className="size-3" />
                {t("CSV-Vorlage", "CSV template")}
              </button>
              {fileName ? (
                <span className="self-center text-[11px] text-muted-2">
                  {fileName}
                </span>
              ) : null}
            </div>

            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setFileName(null);
              }}
              onBlur={() => parseInput(text)}
              rows={7}
              placeholder={`${CSV_EXAMPLE}\n${t(
                "… oder JSON-Array einfügen",
                "… or paste a JSON array",
              )}`}
              className="input-base mt-3 resize-y font-mono text-[11px] leading-relaxed"
            />

            {rows ? (
              <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3">
                <p className="text-[11px] text-cream">
                  {rows.length}{" "}
                  {rows.length === 1
                    ? t("Zeile", "row")
                    : t("Zeilen", "rows")}{" "}
                  {t("erkannt", "detected")} ·{" "}
                  <span className="text-muted-2">
                    {t("Spalten:", "Columns:")} {previewKeys.join(", ")}
                  </span>
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
                {error}
              </p>
            ) : null}
            {summary ? (
              <p className="mt-3 rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-[#b6cba9]">
                {summary}
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
              <p className="text-[10px] text-muted-2">
                {t(
                  "Maximal 2000 Zeilen pro Vorgang.",
                  "A maximum of 2000 rows per import.",
                )}
              </p>
              <button
                type="button"
                onClick={runImport}
                disabled={!rows || rows.length === 0 || pending}
                className="btn-primary h-9 px-5 text-xs"
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {rows
                  ? t(
                      `${rows.length} Zeilen importieren`,
                      `Import ${rows.length} rows`,
                    )
                  : t("Importieren", "Import")}
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="surface-card p-5">
            <div className="flex items-center gap-2 text-gold">
              <Languages className="size-4" />
              <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
                {t("Englische Inhalte", "English content")}
              </p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {t(
                "Titel, Handlung, Tagline und Genres auf Englisch aus TMDB nachladen. Die deutschen Texte bleiben unverändert. Mehrfaches Ausführen ist unbedenklich – bereits vorhandene Texte werden übersprungen.",
                "Load English titles, synopses, taglines and genres from TMDB. The German texts stay untouched. Running it repeatedly is safe – existing content is skipped.",
              )}
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={runContentBackfill}
                disabled={!configured || contentRunning || episodeRunning}
                className="btn-ghost h-9 w-full justify-start px-4 text-xs"
              >
                {contentRunning ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Languages className="size-3.5" />
                )}
                {contentRunning
                  ? t("Lade englische Texte …", "Loading English texts …")
                  : t("Filme & Serien nachladen", "Load movies & series")}
              </button>
              <button
                type="button"
                onClick={runEpisodeBackfill}
                disabled={!configured || contentRunning || episodeRunning}
                className="btn-ghost h-9 w-full justify-start px-4 text-xs"
              >
                {episodeRunning ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Languages className="size-3.5" />
                )}
                {episodeRunning
                  ? t("Lade Folgentexte …", "Loading episode texts …")
                  : t("Folgentitel nachladen", "Load episode titles")}
              </button>
            </div>
            {contentProgress.remaining !== null ? (
              <p className="mt-3 text-[10px] leading-relaxed text-muted-2">
                {contentProgress.updated}{" "}
                {t("Texte aktualisiert", "texts updated")} ·{" "}
                {contentProgress.remaining} {t("Titel offen", "titles pending")}
              </p>
            ) : null}
            {episodeProgress.remaining !== null ? (
              <p className="mt-1 text-[10px] leading-relaxed text-muted-2">
                {episodeProgress.updated}{" "}
                {t("Folgen aktualisiert", "episodes updated")} ·{" "}
                {episodeProgress.remaining}{" "}
                {t("Folgen offen", "episodes pending")}
              </p>
            ) : null}
            {contentProgress.failed.length + episodeProgress.failed.length > 0 ? (
              <p className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-rust/30 bg-rust/10 p-2 text-[10px] leading-relaxed text-[#f0a08e]">
                {[...contentProgress.failed, ...episodeProgress.failed].join(" · ")}
              </p>
            ) : null}
            {!configured ? (
              <p className="mt-3 rounded-lg border border-gold/20 bg-gold/[0.04] px-3 py-2 text-[10px] text-gold-soft">
                {t(
                  "Dafür wird ein TMDB-Key benötigt.",
                  "A TMDB key is required for this.",
                )}{" "}
                <Link
                  href="/admin?tab=einstellungen"
                  className="underline underline-offset-2"
                >
                  {t("Jetzt hinterlegen", "Add one now")}
                </Link>
              </p>
            ) : null}
            {contentError ? (
              <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-[10px] text-[#f0a08e]">
                {contentError}
              </p>
            ) : null}
          </section>

          <section className="surface-card p-5">
            <div className="flex items-center gap-2 text-gold">
              <Sparkles className="size-4" />
              <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
                {t("Demo-Daten", "Demo data")}
              </p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {demoCount > 0
                ? t(
                    `${demoCount} Beispielfilme sind aktuell im Archiv. Sie können jederzeit entfernt werden.`,
                    `${demoCount} sample movies are currently in the archive. You can remove them at any time.`,
                  )
                : t(
                    "Die Beispieldaten wurden entfernt oder sind noch nicht geladen.",
                    "The sample data has been removed or not loaded yet.",
                  )}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {demoCount > 0 ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        t(
                          "Alle als Demo markierten Filme entfernen?",
                          "Remove all movies marked as demo?",
                        ),
                      )
                    ) {
                      return;
                    }
                    setPending(true);
                    const result = await removeDemoDataAction();
                    setPending(false);
                    if (!result.ok) setError(result.error);
                    else router.refresh();
                  }}
                  className="btn-quiet justify-start border border-line text-rust hover:text-rust"
                >
                  <Trash2 className="size-3" />
                  {t("Demo-Daten entfernen", "Remove demo data")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={movieCount > 0 || pending}
                  onClick={async () => {
                    setPending(true);
                    const result = await loadDemoDataAction();
                    setPending(false);
                    if (!result.ok) setError(result.error);
                    else router.refresh();
                  }}
                  className="btn-quiet justify-start border border-line"
                  title={
                    movieCount > 0
                      ? t(
                          "Demo-Daten können nur in ein leeres Archiv geladen werden",
                          "Demo data can only be loaded into an empty archive",
                        )
                      : undefined
                  }
                >
                  <Sparkles className="size-3" />
                  {t("Demo-Daten laden", "Load demo data")}
                </button>
              )}
              {movieCount > 0 && demoCount === 0 ? (
                <p className="text-[10px] text-muted-2">
                  {t(
                    "Beispieldaten nur in ein leeres Archiv ladbar.",
                    "Sample data can only be loaded into an empty archive.",
                  )}
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <section className="surface-card p-5">
        <div className="flex items-center gap-2 text-gold">
          <Database className="size-4" />
          <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
            {t("Backup & Wiederherstellung", "Backup & restore")}
          </p>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
          {t(
            "Sichere das komplette Archiv oder eine einzelne Liste als JSON-Datei inklusive persönlicher Bewertungen, Favoriten, Folgenfortschritt und Listen. Beim Wiederherstellen werden vorhandene Titel mit derselben TMDB-ID bzw. demselben Titel und Jahr aktualisiert, fehlende Titel ergänzt und Listen zusammengeführt.",
            "Save the whole archive or a single list as a JSON file including personal ratings, favourites, episode progress and lists. Restoring updates existing titles with the same TMDB ID or title and year, adds missing titles and merges lists.",
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <a href="/api/backup" download className="btn-ghost h-9 px-4 text-xs">
            <Download className="size-3.5" />
            {t("Gesamtes Archiv exportieren", "Export whole archive")}
          </a>
          <label className="min-w-[180px] flex-1 sm:max-w-64">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
              {t("Nur eine Liste", "One list only")}
            </span>
            <select
              value={backupListId}
              onChange={(event) => setBackupListId(event.target.value)}
              className="input-base h-9 text-xs"
            >
              <option value="">{t("Liste wählen …", "Choose a list …")}</option>
              {lists.map((list) => (
                <option key={list.id} value={String(list.id)}>
                  {list.name} ({list.count})
                </option>
              ))}
            </select>
          </label>
          <a
            href={backupListId ? `/api/backup?listId=${backupListId}` : undefined}
            download
            aria-disabled={!backupListId}
            className={cn(
              "btn-quiet h-9 border border-line px-4 text-xs",
              !backupListId && "pointer-events-none opacity-40",
            )}
          >
            <Download className="size-3.5" />
            {t("Liste exportieren", "Export list")}
          </a>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
          <input
            ref={backupRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void restore(file);
            }}
          />
          <button
            type="button"
            onClick={() => backupRef.current?.click()}
            disabled={backupPending}
            className="btn-ghost h-9 px-4 text-xs"
          >
            {backupPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArchiveRestore className="size-3.5" />
            )}
            {backupPending
              ? t("Backup wird eingelesen …", "Restoring backup …")
              : t("Backup wiederherstellen", "Restore backup")}
          </button>
          {backupName ? (
            <span className="text-[11px] text-muted-2">{backupName}</span>
          ) : null}
          <span className="text-[10px] text-muted-2">
            {t(
              "Nur Filmgold-Backup-Dateien (JSON).",
              "Filmgold backup files only (JSON).",
            )}
          </span>
        </div>
        {backupSummary ? (
          <p className="mt-3 rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-[#b6cba9]">
            {backupSummary}
          </p>
        ) : null}
        {backupError ? (
          <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
            {backupError}
          </p>
        ) : null}
      </section>

      <DatabaseSnapshot />

      <ExportBuilder lists={lists} />
    </div>
  );
}
