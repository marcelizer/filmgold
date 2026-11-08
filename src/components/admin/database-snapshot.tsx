"use client";

import { useState } from "react";
import {
  Archive,
  Database,
  Download,
  HardDrive,
  Loader2,
  Lock,
  Scale,
} from "lucide-react";
import { compareSnapshotsAction } from "@/app/actions";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import {
  SNAPSHOT_PRESETS,
  snapshotQuery,
  type SnapshotMedia,
  type SnapshotPreset,
  type SnapshotScope,
} from "@/lib/snapshot-options";

type Comparison = {
  preset: SnapshotPreset;
  bytes: number;
  counts: Record<string, number>;
};

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function DatabaseSnapshot() {
  const t = useT();
  const [scope, setScope] = useState<SnapshotScope>(SNAPSHOT_PRESETS.light);
  const [comparison, setComparison] = useState<Comparison[] | null>(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets: { key: SnapshotPreset; de: string; en: string; hintDe: string; hintEn: string }[] = [
    {
      key: "light",
      de: "Schlank",
      en: "Light",
      hintDe: "Nur Katalog",
      hintEn: "Catalogue only",
    },
    {
      key: "standard",
      de: "Archiv + Folgen",
      en: "Archive + episodes",
      hintDe: "Mit Folgenliste",
      hintEn: "With episode list",
    },
    {
      key: "full",
      de: "Komplett",
      en: "Complete",
      hintDe: "Inkl. persönlicher Daten",
      hintEn: "Incl. personal data",
    },
  ];

  function applyPreset(key: SnapshotPreset) {
    setScope({ ...SNAPSHOT_PRESETS[key] });
    setError(null);
  }

  function toggle(key: keyof SnapshotScope, value: boolean) {
    setScope((current) => ({ ...current, [key]: value }));
  }

  async function compare() {
    setComparing(true);
    setError(null);
    try {
      const result = await compareSnapshotsAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setComparison(result.data);
    } finally {
      setComparing(false);
    }
  }

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-gold">
            <Database className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t("Datenbank-Snapshot", "Database snapshot")}
            </p>
          </div>
          <h2 className="mt-2 text-base font-medium text-cream">
            {t(
              "Eine schlanke SQLite-Datei für GitHub erstellen",
              "Create a slim SQLite file for GitHub",
            )}
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
            {t(
              "Erzeugt eine eigenständige Kopie der Datenbank, die du direkt als data/filmgold.db verwenden oder als seed/filmgold.db ins Repository legen kannst. Metadaten bleiben vollständig erhalten; persönliche Daten sind standardmäßig nicht enthalten.",
              "Creates a standalone copy of the database that you can use directly as data/filmgold.db or commit as seed/filmgold.db. Metadata stays complete; personal data is excluded by default.",
            )}
          </p>
        </div>
        <span className="chip border-gold/25 text-gold">
          <HardDrive className="size-3" />
          SQLite
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => applyPreset(preset.key)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors",
              snapshotQuery(scope) === snapshotQuery(SNAPSHOT_PRESETS[preset.key])
                ? "border-gold/50 bg-gold/10 text-cream"
                : "border-line bg-surface-2/40 text-muted hover:border-gold/30 hover:text-cream",
            )}
          >
            <span className="flex items-center gap-1.5 text-[11px]">
              {preset.key === "full" ? (
                <Archive className="size-3" />
              ) : preset.key === "light" ? (
                <HardDrive className="size-3" />
              ) : (
                <Scale className="size-3" />
              )}
              {t(preset.de, preset.en)}
            </span>
            <span className="mt-0.5 block text-[9px] text-muted-2">
              {t(preset.hintDe, preset.hintEn)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 rounded-xl border border-line-soft bg-surface-2/30 p-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted-2">
              {t("Medium", "Medium")}
            </span>
            <select
              value={scope.media}
              onChange={(event) =>
                setScope((current) => ({
                  ...current,
                  media: event.target.value as SnapshotMedia,
                }))
              }
              className="input-base h-9 text-xs"
            >
              <option value="all">{t("Filme & Serien", "Movies & series")}</option>
              <option value="movie">{t("Nur Filme", "Movies only")}</option>
              <option value="serie">{t("Nur Serien", "Series only")}</option>
            </select>
          </label>

          <div className="space-y-1.5">
            {(
              [
                ["includeEpisodes", "Folgenlisten", "Episode lists"],
                ["includePersonal", "Persönliche Daten", "Personal data"],
                ["includeLists", "Eigene Listen", "Custom lists"],
                ["includeSettings", "Einstellungen", "Settings"],
                ["includeMediaPaths", "Lokale Medienpfade", "Local media paths"],
              ] as const
            ).map(([key, de, en]) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-[11px] text-muted hover:text-cream"
              >
                <input
                  type="checkbox"
                  checked={scope[key]}
                  onChange={(event) => toggle(key, event.target.checked)}
                  className="mt-0.5 size-3.5 rounded border-line bg-surface-2 accent-[#c9a227]"
                />
                <span>
                  {t(de, en)}
                  {key === "includePersonal" ? (
                    <span className="ml-1 text-[9px] text-muted-2">
                      {t(
                        "Bewertungen, Favoriten, Notizen, Fortschritt",
                        "ratings, favourites, notes, progress",
                      )}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-moss/25 bg-moss/5 p-3 text-[10px] leading-relaxed text-[#b6cba9]">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            {t(
              "Der TMDB-Schlüssel wird nie in einen Snapshot geschrieben – auch nicht bei „Komplett“. Lokale Medienpfade werden nur auf Wunsch übernommen; die Bilddateien selbst sind nie enthalten.",
              "The TMDB key is never written to a snapshot – even with “Complete”. Local media paths are only included on request; the image files themselves are never included.",
            )}
          </div>
          <a
            href={`/api/database?${snapshotQuery(scope)}`}
            download
            className="btn-primary h-9 w-full justify-center px-4 text-xs"
          >
            <Download className="size-3.5" />
            {t("Snapshot herunterladen", "Download snapshot")}
          </a>
          <button
            type="button"
            onClick={compare}
            disabled={comparing}
            className="btn-ghost h-9 w-full justify-center px-4 text-xs"
          >
            {comparing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Scale className="size-3.5" />
            )}
            {comparing
              ? t("Vergleiche Größen …", "Comparing sizes …")
              : t("Schlank vs. komplett vergleichen", "Compare light vs. complete")}
          </button>

          {comparison ? (
            <div className="space-y-1.5">
              {comparison.map((entry) => (
                <div
                  key={entry.preset}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[11px]"
                >
                  <span className="text-muted">
                    {entry.preset === "light"
                      ? t("Schlank", "Light")
                      : entry.preset === "standard"
                        ? t("Archiv + Folgen", "Archive + episodes")
                        : t("Komplett", "Complete")}
                    <span className="ml-2 text-[9px] text-muted-2">
                      {entry.counts.movies} {t("Titel", "titles")} ·{" "}
                      {entry.counts.episodes} {t("Folgen", "episodes")}
                    </span>
                  </span>
                  <span className="tabular-nums text-cream">
                    {formatBytes(entry.bytes)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
