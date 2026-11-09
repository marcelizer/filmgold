import type { Metadata } from "next";
import Link from "next/link";
import {
  Clapperboard,
  Database,
  Image as ImageIcon,
  KeyRound,
  PlusCircle,
  Settings2,
  Tv,
  Upload,
} from "lucide-react";
import { AdminMovies } from "@/components/admin/admin-movies";
import { ImportExport } from "@/components/admin/import-export";
import { MediaPanel } from "@/components/admin/media-panel";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { TmdbAdd } from "@/components/admin/tmdb-add";
import { getTmdbCredentials, getWeights } from "@/lib/db";
import { formatInt } from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import { tr } from "@/lib/locale";
import { getMediaStats } from "@/lib/media";
import {
  getAdminMovies,
  getDemoCount,
  getStats,
} from "@/lib/movies";
import { getStarterPresence } from "@/lib/starter";
import { getLists } from "@/lib/lists";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: tr(locale, "Verwaltung", "Admin"),
    description: tr(
      locale,
      "Filme und Serien hinzufügen, bearbeiten, importieren und gewichten.",
      "Add, edit, import and weight movies and series.",
    ),
  };
}

const TABS = [
  { key: "filme", de: "Filme", en: "Movies", icon: Clapperboard },
  { key: "serien", de: "Serien", en: "Series", icon: Tv },
  { key: "hinzufuegen", de: "TMDB-Suche", en: "TMDB search", icon: PlusCircle },
  { key: "import", de: "Import & Export", en: "Import & Export", icon: Upload },
  { key: "medien", de: "Medien", en: "Media", icon: ImageIcon },
  { key: "einstellungen", de: "Einstellungen", en: "Settings", icon: Settings2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const params = await searchParams;
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: TabKey = TABS.some((entry) => entry.key === tabParam)
    ? (tabParam as TabKey)
    : "filme";

  const stats = getStats();
  const seriesStats = getStats("serie");
  const credentials = getTmdbCredentials();
  const weights = getWeights();
  const demoCount = getDemoCount();
  const starterMoviePresence = getStarterPresence("movie");
  const starterSeriesPresence = getStarterPresence("serie");
  const titles =
    tab === "filme"
      ? getAdminMovies("", 1000, "movie")
      : tab === "serien"
        ? getAdminMovies("", 1000, "serie")
        : [];
  const lists = getLists().map((list) => ({
    id: list.id,
    name: list.name,
    count: list.count,
  }));
  const mediaStats = tab === "medien" ? getMediaStats() : null;

  return (
    <div className="container-page py-12 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">{t("Werkstatt", "Workshop")}</p>
          <h1 className="display mt-3 text-5xl text-cream">
            {t("Verwaltung", "Admin")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            {t(
              "Filme und Serien ergänzen, korrigieren, importieren und die Gewichtung des Filmgold-Scores justieren. Änderungen sind sofort im Archiv sichtbar.",
              "Add, correct and import movies and series, and fine-tune the Filmgold score weighting. Changes are visible in the archive immediately.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="chip">
            <Database className="size-3 text-gold" />
            {formatInt(stats.count)} {t("Filme", "movies")} ·{" "}
            {formatInt(seriesStats.count)} {t("Serien", "series")}
          </span>
          <span
            className={cn(
              "chip",
              credentials.source !== "none" && "border-moss/30 text-moss",
            )}
          >
            <KeyRound className="size-3" />
            {credentials.source === "none"
              ? t("TMDB nicht verbunden", "TMDB not connected")
              : credentials.source === "env"
                ? t("TMDB via .env", "TMDB via .env")
                : t("TMDB verbunden", "TMDB connected")}
          </span>
          {demoCount > 0 ? (
            <span className="chip border-gold/25 text-gold">
              {demoCount} {t("Demo-Filme", "demo movies")}
            </span>
          ) : null}
        </div>
      </div>

      <nav className="mt-8 flex flex-wrap gap-1 border-b border-line-soft">
        {TABS.map((entry) => {
          const active = entry.key === tab;
          return (
            <Link
              key={entry.key}
              href={`/admin?tab=${entry.key}`}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-4 py-3 text-xs transition-colors",
                active ? "text-gold" : "text-muted hover:text-cream",
              )}
            >
              <entry.icon className="size-3.5" />
              {t(entry.de, entry.en)}
              {active ? (
                <span className="absolute inset-x-0 -bottom-px h-px bg-gold" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">
        {tab === "filme" || tab === "serien" ? (
          <AdminMovies
            movies={titles}
            defaultMedia={tab === "serien" ? "serie" : "movie"}
          />
        ) : null}
        {tab === "hinzufuegen" ? (
          <TmdbAdd
            configured={credentials.source !== "none"}
            source={credentials.source}
          />
        ) : null}
        {tab === "import" ? (
          <ImportExport
            configured={credentials.source !== "none"}
            demoCount={demoCount}
            movieCount={stats.count}
            starterMovieImported={starterMoviePresence.imported}
            starterSeriesImported={starterSeriesPresence.imported}
            starterMoviePresent={starterMoviePresence.present}
            starterSeriesPresent={starterSeriesPresence.present}
            lists={lists}
          />
        ) : null}
        {tab === "medien" && mediaStats ? (
          <MediaPanel initialStats={mediaStats} />
        ) : null}
        {tab === "einstellungen" ? (
          <SettingsPanel
            initialWeights={weights}
            tmdbSource={credentials.source}
            demoCount={demoCount}
            movieCount={stats.count}
            seriesCount={seriesStats.count}
          />
        ) : null}
      </div>
    </div>
  );
}
