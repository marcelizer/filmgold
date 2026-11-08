"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  RotateCcw,
  Save,
  Scale,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  recomputeScoresAction,
  resetDatabaseAction,
  saveTmdbKeyAction,
  saveWeightsAction,
} from "@/app/actions";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import {
  DEFAULT_WEIGHTS,
  scoreDescriptions,
  scoreLabels,
} from "@/lib/scoring";
import type { ScoreWeights } from "@/lib/types";

export function SettingsPanel({
  initialWeights,
  tmdbSource,
  demoCount,
  movieCount,
  seriesCount,
}: {
  initialWeights: ScoreWeights;
  tmdbSource: "env" | "db" | "none";
  demoCount: number;
  movieCount: number;
  seriesCount: number;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [weights, setWeights] = useState<ScoreWeights>(initialWeights);
  const [key, setKey] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState("");
  const [includeSettings, setIncludeSettings] = useState(false);

  const labels = scoreLabels(locale);
  const descriptions = scoreDescriptions(locale);
  const sum =
    weights.critics +
    weights.audience +
    weights.boxoffice +
    weights.popularity +
    weights.renown;
  const normalized = (value: number) =>
    sum > 0 ? Math.round((value / sum) * 100) : 0;
  const resetWord = t("LÖSCHEN", "DELETE");

  async function saveWeights() {
    setPending("weights");
    setMessage(null);
    setError(null);
    const result = await saveWeightsAction(weights);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setWeights(result.data);
    setMessage(
      t(
        "Gewichtung gespeichert – alle Scores wurden neu berechnet.",
        "Weights saved – all scores have been recalculated.",
      ),
    );
    router.refresh();
  }

  async function saveKey(remove = false) {
    setPending("key");
    setMessage(null);
    setError(null);
    const result = await saveTmdbKeyAction(remove ? null : key);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setKey("");
    setMessage(
      remove
        ? t("TMDB-Key entfernt.", "TMDB key removed.")
        : t(
            "Key geprüft und gespeichert. Die TMDB-Suche ist jetzt verfügbar.",
            "Key verified and saved. TMDB search is now available.",
          ),
    );
    router.refresh();
  }

  async function recompute() {
    setPending("scores");
    setMessage(null);
    setError(null);
    const result = await recomputeScoresAction();
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(
      t(
        `${result.data.count} Titel neu berechnet.`,
        `${result.data.count} titles recalculated.`,
      ),
    );
    router.refresh();
  }

  async function resetDatabase() {
    if (resetConfirm.trim().toUpperCase() !== resetWord) return;
    setPending("reset");
    setMessage(null);
    setError(null);
    const result = await resetDatabaseAction({ includeSettings });
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResetConfirm("");
    const removedMovies = result.data.movies;
    const removedLists = result.data.lists;
    const movieNoun = removedMovies === 1 ? t("Titel", "title") : t("Titel", "titles");
    const listNoun = removedLists === 1 ? t("Liste", "list") : t("Listen", "lists");
    setMessage(
      t(
        `Gelöscht: ${removedMovies} ${movieNoun}, ${removedLists} ${listNoun}.`,
        `Deleted: ${removedMovies} ${movieNoun}, ${removedLists} ${listNoun}.`,
      ),
    );
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-gold">
                <Scale className="size-4" />
                <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
                  {t("Score-Gewichtung", "Score weighting")}
                </p>
              </div>
              <h2 className="mt-2 text-base font-medium text-cream">
                {t(
                  "Was zählt für die besten Titel?",
                  "What matters for the best titles?",
                )}
              </h2>
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
                {t(
                  "Die Gewichte werden relativ zueinander ausgewertet. Eine Summe von 100 ist nicht Pflicht – 35/30/15/10/10 ergibt dieselbe Verteilung wie 70/60/30/20/20.",
                  "The weights are evaluated relative to each other. A sum of 100 is not required – 35/30/15/10/10 gives the same distribution as 70/60/30/20/20.",
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
                {t("Summe", "Total")}
              </p>
              <p className="display text-3xl text-gold tabular-nums">{sum}</p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {(Object.keys(labels) as (keyof ScoreWeights)[]).map((keyName) => (
              <div key={keyName}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label
                    htmlFor={`weight-${keyName}`}
                    className="text-xs text-cream"
                  >
                    {labels[keyName]}
                    <span className="ml-2 text-[10px] text-gold">
                      {normalized(weights[keyName])} %{" "}
                      {t("effektiv", "effective")}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`weight-${keyName}`}
                      type="number"
                      min={0}
                      max={100}
                      value={weights[keyName]}
                      onChange={(event) =>
                        setWeights((current) => ({
                          ...current,
                          [keyName]: Math.max(
                            0,
                            Math.min(100, Number(event.target.value) || 0),
                          ),
                        }))
                      }
                      className="input-base h-8 w-16 text-center text-xs tabular-nums"
                    />
                    <span className="text-[10px] text-muted-2">
                      {t("Gewicht", "Weight")}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[keyName]}
                  onChange={(event) =>
                    setWeights((current) => ({
                      ...current,
                      [keyName]: Number(event.target.value),
                    }))
                  }
                  className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.06] accent-[#e8b967]"
                  aria-label={t(
                    `Gewicht ${labels[keyName]}`,
                    `Weight ${labels[keyName]}`,
                  )}
                />
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-2">
                  {descriptions[keyName]}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
            <button
              type="button"
              onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
              className="btn-quiet"
            >
              <RotateCcw className="size-3" />
              {t("Standard wiederherstellen", "Restore defaults")}
            </button>
            <button
              type="button"
              onClick={saveWeights}
              disabled={pending !== null || sum <= 0}
              className="btn-primary h-9 px-5 text-xs"
            >
              {pending === "weights" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              {t("Gewichtung speichern", "Save weights")}
            </button>
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2 text-gold">
            <KeyRound className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t("TMDB-Verbindung", "TMDB connection")}
            </p>
          </div>
          <h2 className="mt-2 text-base font-medium text-cream">API key</h2>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
            {t(
              "Ein kostenloser Key genügt. Unterstützt werden der API Key (v3) und der Read Access Token (v4). Der Key wird lokal gespeichert, entweder in dieser Datenbank oder in .env.local.",
              "A free key is enough. Both the API key (v3) and the read access token (v4) are supported. The key is stored locally, either in this database or in .env.local.",
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] flex-1">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-muted-2">
                {t("Key oder Token", "Key or token")}
              </span>
              <input
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder={
                  tmdbSource === "db"
                    ? t("••••••••  (gespeichert)", "••••••••  (stored)")
                    : tmdbSource === "env"
                      ? t(
                          "Wird aus .env.local gelesen",
                          "Read from .env.local",
                        )
                      : t("TMDB-Key einfügen", "Paste TMDB key")
                }
                className="input-base h-10 font-mono text-xs"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={() => saveKey(false)}
              disabled={pending !== null || key.trim().length < 8}
              className="btn-primary h-10 px-4 text-xs"
            >
              {pending === "key" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {t("Prüfen & speichern", "Verify & save")}
            </button>
            {tmdbSource === "db" ? (
              <button
                type="button"
                onClick={() => saveKey(true)}
                disabled={pending !== null}
                className="btn-quiet h-10 border border-line text-rust"
                title={t("Gespeicherten Key entfernen", "Remove stored key")}
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                tmdbSource === "none"
                  ? "border-line text-muted"
                  : "border-moss/30 bg-moss/10 text-moss",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  tmdbSource === "none" ? "bg-muted-2" : "bg-moss",
                )}
              />
              {tmdbSource === "env"
                ? t("Verbunden über .env.local", "Connected via .env.local")
                : tmdbSource === "db"
                  ? t("Verbunden über Datenbank", "Connected via database")
                  : t("Nicht verbunden", "Not connected")}
            </span>
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-muted hover:text-gold"
            >
              {t("Kostenlosen Key erstellen", "Create a free key")}{" "}
              <ExternalLink className="size-3" />
            </a>
          </div>

          {tmdbSource === "env" ? (
            <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[10px] leading-relaxed text-muted-2">
              {t(
                "Ein Key aus .env.local hat Vorrang. Um den datenbankgespeicherten Key zu nutzen, entferne dort TMDB_API_KEY und starte den Server neu.",
                "A key from .env.local takes precedence. To use the database-stored key, remove TMDB_API_KEY there and restart the server.",
              )}
            </p>
          ) : null}

          <details className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
            <summary className="cursor-pointer text-[11px] text-muted">
              {t(
                "Alternative: Key in .env.local hinterlegen",
                "Alternative: store the key in .env.local",
              )}
            </summary>
            <pre className="mt-2 overflow-x-auto text-[10px] leading-relaxed text-muted-2">
{`# .env.local im Projektordner
TMDB_API_KEY=dein_v3_key
# oder
TMDB_ACCESS_TOKEN=dein_v4_token`}
            </pre>
          </details>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-cream">
                {t("Scores neu berechnen", "Recalculate scores")}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {t(
                  "Nach manuellen Datenänderungen oder geänderten Gewichten.",
                  "After manual data changes or changed weights.",
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={recompute}
              disabled={pending !== null}
              className="btn-ghost h-9 px-4 text-xs"
            >
              {pending === "scores" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              {t("Jetzt berechnen", "Recalculate now")}
            </button>
          </div>
        </section>

        <section className="surface-card border-rust/25 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-rust">
            <TriangleAlert className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t("Gefahrenzone", "Danger zone")}
            </p>
          </div>
          <h2 className="mt-2 text-base font-medium text-cream">
            {t("Datenbank zurücksetzen", "Reset database")}
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
            {t(
              "Löscht alle Filme und Serien samt Folgen, persönlichen Bewertungen, Fortschritt und Listen. Der TMDB-Key und die Score-Gewichtung bleiben standardmäßig erhalten. Diese Aktion kann nicht rückgängig gemacht werden.",
              "Deletes all movies and series including episodes, personal ratings, progress and lists. The TMDB key and score weights are kept by default. This action cannot be undone.",
            )}
          </p>
          <label className="mt-4 flex items-center gap-2 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={includeSettings}
              onChange={(event) => setIncludeSettings(event.target.checked)}
              className="size-3.5 rounded border-line bg-surface-2 accent-[#c8a45c]"
            />
            {t(
              "Auch Einstellungen löschen (TMDB-Key und Gewichtung)",
              "Also delete settings (TMDB key and weights)",
            )}
          </label>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.14em] text-muted-2">
                {t(
                  `Zum Bestätigen „${resetWord}“ eingeben`,
                  `Type “${resetWord}” to confirm`,
                )}
              </span>
              <input
                value={resetConfirm}
                onChange={(event) => setResetConfirm(event.target.value)}
                placeholder={resetWord}
                className="input-base h-9 text-xs"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={resetDatabase}
              disabled={
                pending !== null ||
                resetConfirm.trim().toUpperCase() !== resetWord
              }
              className="btn-quiet h-9 border border-rust/40 px-4 text-xs text-rust hover:bg-rust/10 hover:text-rust"
            >
              {pending === "reset" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              {t("Datenbank löschen", "Delete database")}
            </button>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="surface-card p-5">
          <p className="eyebrow">{t("Archiv", "Archive")}</p>
          <dl className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t("Filme gesamt", "Movies total")}</dt>
              <dd className="tabular-nums text-cream">{movieCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t("Serien gesamt", "Series total")}</dt>
              <dd className="tabular-nums text-cream">{seriesCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t("Demo-Titel", "Demo titles")}</dt>
              <dd className="tabular-nums text-cream">{demoCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t("Datenbank", "Database")}</dt>
              <dd className="font-mono text-[10px] text-muted-2">
                data/filmgold.db
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-line-soft pt-3 text-[10px] leading-relaxed text-muted-2">
            {t(
              "Die SQLite-Datei liegt im Projektordner unter data/filmgold.db. Backup: Datei kopieren. Persönliche Bewertungen liegen in derselben Datei.",
              "The SQLite file lives in the project folder at data/filmgold.db. Backup: copy the file. Personal ratings are stored in the same file.",
            )}
          </p>
        </section>

        <section className="surface-card p-5">
          <p className="eyebrow">{t("Schnellzugriff", "Quick access")}</p>
          <div className="mt-4 space-y-2">
            <Link
              href="/admin?tab=filme"
              className="btn-ghost h-9 w-full justify-start px-4 text-xs"
            >
              {t("Titel bearbeiten", "Edit titles")}
            </Link>
            <Link
              href="/admin?tab=hinzufuegen"
              className="btn-ghost h-9 w-full justify-start px-4 text-xs"
            >
              {t("Titel über TMDB hinzufügen", "Add titles via TMDB")}
            </Link>
            <Link
              href="/admin?tab=import"
              className="btn-ghost h-9 w-full justify-start px-4 text-xs"
            >
              {t("Import & Export", "Import & Export")}
            </Link>
          </div>
        </section>

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
      </aside>
    </div>
  );
}
