"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  cacheEpisodeStillsBatchAction,
  cacheMovieMediaBatchAction,
  clearMediaCacheAction,
  mediaStatsAction,
} from "@/app/actions";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import type { MediaStats } from "@/lib/media";

type RunKind = "movies" | "stills" | null;

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function MediaPanel({ initialStats }: { initialStats: MediaStats }) {
  const router = useRouter();
  const t = useT();
  const [stats, setStats] = useState(initialStats);
  const [running, setRunning] = useState<RunKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    kind: Exclude<RunKind, null>;
    done: number;
    total: number;
    downloaded: number;
    skipped: number;
    failed: string[];
  } | null>(null);
  const stopRef = useRef(false);

  async function reloadStats() {
    const result = await mediaStatsAction();
    if (result.ok) setStats(result.data);
  }

  async function runMovies(mode: "missing" | "all") {
    setRunning("movies");
    setError(null);
    setMessage(null);
    stopRef.current = false;
    let offset = 0;
    let downloaded = 0;
    let skipped = 0;
    const failed: string[] = [];
    try {
      for (;;) {
        if (stopRef.current) break;
        const result = await cacheMovieMediaBatchAction(offset, 6, mode);
        if (!result.ok) {
          setError(result.error);
          break;
        }
        const data = result.data;
        downloaded += data.downloaded;
        skipped += data.skipped;
        failed.push(...data.failed);
        offset = data.nextOffset;
        setProgress({
          kind: "movies",
          done: Math.min(data.nextOffset, data.total),
          total: data.total,
          downloaded,
          skipped,
          failed: failed.slice(-30),
        });
        if (data.done || data.processed === 0) break;
      }
      setMessage(
        t(
          `${downloaded} Bilder gespeichert, ${skipped} bereits vorhanden.`,
          `${downloaded} images saved, ${skipped} already cached.`,
        ),
      );
    } finally {
      setRunning(null);
      await reloadStats();
      router.refresh();
    }
  }

  async function runStills(mode: "missing" | "all") {
    setRunning("stills");
    setError(null);
    setMessage(null);
    stopRef.current = false;
    let offset = 0;
    let downloaded = 0;
    let skipped = 0;
    const failed: string[] = [];
    try {
      for (;;) {
        if (stopRef.current) break;
        const result = await cacheEpisodeStillsBatchAction(offset, 10, mode);
        if (!result.ok) {
          setError(result.error);
          break;
        }
        const data = result.data;
        downloaded += data.downloaded;
        skipped += data.skipped;
        failed.push(...data.failed);
        offset = data.nextOffset;
        setProgress({
          kind: "stills",
          done: Math.min(data.nextOffset, data.total),
          total: data.total,
          downloaded,
          skipped,
          failed: failed.slice(-30),
        });
        if (data.done || data.processed === 0) break;
      }
      setMessage(
        t(
          `${downloaded} Folgenbilder gespeichert, ${skipped} bereits vorhanden.`,
          `${downloaded} episode stills saved, ${skipped} already cached.`,
        ),
      );
    } finally {
      setRunning(null);
      await reloadStats();
      router.refresh();
    }
  }

  async function clearCache() {
    const confirmed = window.confirm(
      t(
        "Alle lokal gespeicherten Bilder löschen? Die TMDB-Bilder bleiben als Fallback verfügbar und können jederzeit neu geladen werden.",
        "Delete all locally cached images? TMDB images remain available as a fallback and can be downloaded again at any time.",
      ),
    );
    if (!confirmed) return;
    setRunning("movies");
    setError(null);
    setMessage(null);
    const result = await clearMediaCacheAction();
    setRunning(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProgress(null);
    setMessage(
      t(
        `${result.data.files} Dateien gelöscht (${formatBytes(result.data.bytes)}).`,
        `${result.data.files} files deleted (${formatBytes(result.data.bytes)}).`,
      ),
    );
    await reloadStats();
    router.refresh();
  }

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;
  const busy = running !== null;
  const missingPosters = Math.max(0, stats.movies - stats.postersCached);
  const missingStills = Math.max(0, stats.episodeStills - stats.stillsCached);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2 text-gold">
            <ImageIcon className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t("Medien-Cache", "Media cache")}
            </p>
          </div>
          <h2 className="mt-2 text-base font-medium text-cream">
            {t(
              "Poster, Backdrops und Folgenbilder lokal speichern",
              "Store posters, backdrops and episode stills locally",
            )}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            {t(
              "Bilder werden neben der Datenbank unter data/media abgelegt. Neue Titel erhalten Poster und Backdrop automatisch. Bereits vorhandene Bilder werden nicht erneut geladen, außer du wählst „Alles neu laden“.",
              "Images are stored next to the database under data/media. New titles get a poster and backdrop automatically. Existing images are skipped unless you choose “Reload everything”.",
            )}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
                {t("Poster", "Posters")}
              </p>
              <p className="mt-1 text-sm text-cream">
                {stats.postersCached}/{stats.movies}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
                {t("Backdrops", "Backdrops")}
              </p>
              <p className="mt-1 text-sm text-cream">
                {stats.backdropsCached}/{stats.movies}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
                {t("Folgenbilder", "Episode stills")}
              </p>
              <p className="mt-1 text-sm text-cream">
                {stats.stillsCached}/{stats.episodeStills}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
                {t("Auf der Platte", "On disk")}
              </p>
              <p className="mt-1 text-sm text-cream">
                {formatBytes(stats.bytes)}
                <span className="ml-1 text-[10px] text-muted-2">
                  · {stats.files} {t("Dateien", "files")}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runMovies("missing")}
              disabled={busy}
              className="btn-primary h-9 px-4 text-xs"
            >
              {running === "movies" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              {t("Fehlende Bilder laden", "Download missing images")}
            </button>
            <button
              type="button"
              onClick={() => runMovies("all")}
              disabled={busy}
              className="btn-ghost h-9 px-4 text-xs"
            >
              <RefreshCw className="size-3.5" />
              {t("Alles neu laden", "Reload everything")}
            </button>
            <button
              type="button"
              onClick={() => runStills("missing")}
              disabled={busy || stats.episodeStills === 0}
              className="btn-ghost h-9 px-4 text-xs"
            >
              {running === "stills" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5" />
              )}
              {t("Fehlende Folgenbilder", "Missing episode stills")}
            </button>
            {busy ? (
              <button
                type="button"
                onClick={() => {
                  stopRef.current = true;
                }}
                className="btn-quiet h-9 border border-line px-4 text-xs"
              >
                {t("Stoppen", "Stop")}
              </button>
            ) : null}
          </div>

          {progress ? (
            <div className="mt-5 rounded-xl border border-line bg-surface-2/50 p-3">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>
                  {progress.kind === "movies"
                    ? t("Filme & Serien", "Movies & series")
                    : t("Folgenbilder", "Episode stills")}
                </span>
                <span className="tabular-nums">
                  {progress.done}/{progress.total} · {percent} %
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-gold transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-muted-2">
                {progress.downloaded} {t("gespeichert", "saved")} ·{" "}
                {progress.skipped} {t("übersprungen", "skipped")}
              </p>
            </div>
          ) : null}

          {message ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-[#b6cba9]">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          ) : null}
          {progress && progress.failed.length > 0 ? (
            <details className="mt-3 rounded-lg border border-rust/20 bg-rust/5 p-3 text-[11px] text-[#e5b3a6]">
              <summary className="cursor-pointer">
                {progress.failed.length}{" "}
                {t("Bilder konnten nicht geladen werden", "images could not be loaded")}
              </summary>
              <ul className="mt-2 space-y-1">
                {progress.failed.map((failure) => (
                  <li key={failure}>{failure}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2 text-gold">
            <Download className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t("Medien-Backup", "Media backup")}
            </p>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
            {t(
              "Das JSON-Backup enthält alle Metadaten und die Verweise auf lokale Bilder, aber keine Bilddateien. Lade den Medien-Cache separat als Archiv herunter. Entpacke den Ordner filmgold-media in dein data-Verzeichnis – neben filmgold.db.",
              "The JSON backup contains all metadata and references to local images, but no image files. Download the media cache separately as an archive. Extract the filmgold-media folder into your data directory – next to filmgold.db.",
            )}
          </p>
          <a
            href="/api/media"
            className={cn(
              "btn-ghost mt-4 h-9 px-4 text-xs",
              stats.files === 0 && "pointer-events-none opacity-50",
            )}
            aria-disabled={stats.files === 0}
          >
            <Download className="size-3.5" />
            {t("Medien-Archiv herunterladen", "Download media archive")}
          </a>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="surface-card p-5">
          <div className="flex items-center gap-2 text-gold">
            <AlertTriangle className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t("Hinweise", "Notes")}
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {t(
              "Dateien werden nur heruntergeladen, wenn TMDB einen Bildpfad kennt. Fehlt eine Datei, zeigt die App automatisch wieder das TMDB-Bild.",
              "Files are only downloaded when TMDB knows an image path. If a file is missing, the app automatically falls back to the TMDB image.",
            )}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t(
              `${missingPosters} Titel haben noch kein lokales Poster, ${missingStills} Folgen noch kein lokales Bild. Das Laden kann bei vielen Titeln einige Minuten dauern; du kannst jederzeit stoppen und später fortsetzen.`,
              `${missingPosters} titles do not have a local poster yet, ${missingStills} episodes have no local still. Downloading many titles can take a few minutes; you can stop at any time and continue later.`,
            )}
          </p>
        </section>

        <section className="surface-card border-rust/20 p-5">
          <div className="flex items-center gap-2 text-[#e5b3a6]">
            <Trash2 className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t("Cache leeren", "Clear cache")}
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {t(
              "Löscht alle Bilddateien und entfernt die lokalen Verweise. Metadaten und TMDB-Pfade bleiben erhalten.",
              "Deletes all image files and removes the local references. Metadata and TMDB paths stay intact.",
            )}
          </p>
          <button
            type="button"
            onClick={clearCache}
            disabled={busy || stats.files === 0}
            className="btn-quiet mt-4 h-9 w-full justify-start border border-rust/30 px-4 text-xs text-[#e5b3a6]"
          >
            <Trash2 className="size-3.5" />
            {t("Bilder löschen", "Delete images")}
          </button>
        </section>
      </aside>
    </div>
  );
}
