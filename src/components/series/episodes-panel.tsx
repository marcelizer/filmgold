"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCheck,
  ChevronDown,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import {
  setSeasonRewatchedAction,
  setSeasonWatchedAction,
  startRewatchAction,
  stopRewatchAction,
  syncSeriesEpisodesAction,
  toggleEpisodeRewatchedAction,
  toggleEpisodeWatchedAction,
} from "@/app/actions";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { episodeTitle } from "@/lib/content";
import { formatDate, formatInt, formatRuntime, mediaImage } from "@/lib/format";
import type { Episode, SeriesProgress, WatchState } from "@/lib/types";

type SeasonGroup = {
  seasonNumber: number;
  episodes: Episode[];
  watchedCount: number;
  rewatchedCount: number;
};

function groupSeasons(episodes: Episode[]): SeasonGroup[] {
  const groups = new Map<number, Episode[]>();
  for (const episode of episodes) {
    const list = groups.get(episode.seasonNumber) ?? [];
    list.push(episode);
    groups.set(episode.seasonNumber, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seasonNumber, list]) => ({
      seasonNumber,
      episodes: [...list].sort((a, b) => a.episodeNumber - b.episodeNumber),
      watchedCount: list.filter((episode) => episode.watched).length,
      rewatchedCount: list.filter((episode) => episode.rewatched).length,
    }));
}

export function episodeCode(episode: Pick<Episode, "seasonNumber" | "episodeNumber">) {
  return `S${String(episode.seasonNumber).padStart(2, "0")} E${String(
    episode.episodeNumber,
  ).padStart(2, "0")}`;
}

export function EpisodesPanel({
  movieId,
  tmdbId,
  configured,
  episodes,
  progress,
}: {
  movieId: number;
  tmdbId: number | null;
  configured: boolean;
  episodes: Episode[];
  progress: SeriesProgress;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const stateLabels: Record<WatchState, string> = {
    none: t("Neu", "New"),
    watching: t("Am Schauen", "Watching"),
    watched: t("Gesehen", "Watched"),
    rewatching: t("Rewatch", "Rewatch"),
  };

  const seasons = useMemo(() => groupSeasons(episodes), [episodes]);
  const empty = episodes.length === 0;
  const canSync = Boolean(tmdbId) && configured;
  const next = progress.nextEpisode;
  const nextTitle = next ? episodeTitle(next, locale) : "";
  const rewatching = progress.state === "rewatching";
  const barPercent =
    rewatching && progress.totalEpisodes > 0
      ? Math.round((progress.rewatchedEpisodes / progress.totalEpisodes) * 100)
      : progress.percent;

  useEffect(() => {
    if (!empty || !canSync) return;
    const key = `filmgold:episodes:${movieId}`;
    const forget = () => {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
    };
    // Defer one tick so the auto-sync is a plain side effect and cannot loop
    // through a state update during the effect itself.
    const timer = window.setTimeout(() => {
      try {
        if (window.sessionStorage.getItem(key)) return;
        window.sessionStorage.setItem(key, "1");
      } catch {
        // sessionStorage may be unavailable; the request below is idempotent.
      }
      setSyncing(true);
      setError(null);
      void syncSeriesEpisodesAction(movieId)
        .then((result) => {
          setSyncing(false);
          if (result.ok) {
            router.refresh();
            return;
          }
          forget();
          setError(result.error);
        })
        .catch(() => {
          setSyncing(false);
          forget();
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canSync, empty, movieId, router]);

  function runSync(manual = false) {
    setSyncing(true);
    setError(null);
    setSyncNotice(null);
    void syncSeriesEpisodesAction(movieId)
      .then((result) => {
        if (result.ok) {
          if (manual) {
            setSyncNotice(
              t(
                `${result.data.count} Folgen abgeglichen.`,
                `${result.data.count} episodes synced.`,
              ),
            );
          }
          router.refresh();
          return;
        }
        setError(result.error);
      })
      .finally(() => setSyncing(false));
  }

  async function run(key: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusyKey(key);
    setError(null);
    const result = await action();
    setBusyKey(null);
    if (!result.ok) {
      setError(result.error ?? t("Aktion fehlgeschlagen.", "Action failed."));
      return;
    }
    router.refresh();
  }

  const busy = (key: string) => busyKey === key;

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="eyebrow">{t("Folgen-Tracking", "Episode tracking")}</h2>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted">
            {t(
              "Hake einzelne Folgen ab – für den ersten Durchlauf und den Rewatch. Staffeln oder die ganze Serie lassen sich auf einen Schlag abhaken.",
              "Tick off individual episodes – for the first run and the rewatch. Seasons or the whole series can be checked off at once.",
            )}
          </p>
        </div>
        {canSync ? (
          <button
            type="button"
            onClick={() => runSync(true)}
            disabled={syncing}
            className="btn-quiet h-8 border border-line px-3 text-[11px]"
          >
            {syncing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            {empty ? t("Folgen laden", "Load episodes") : t("Abgleichen", "Sync")}
          </button>
        ) : null}
      </div>

      {empty ? (
        <div className="mt-5 rounded-xl border border-dashed border-line bg-surface-2/40 p-5 text-sm text-muted">
          {syncing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-gold" />
              {t("Folgen werden von TMDB geladen …", "Loading episodes from TMDB …")}
            </span>
          ) : (
            <>
              <p className="text-cream">
                {t("Noch keine Folgen gespeichert.", "No episodes saved yet.")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-2">
                {canSync
                  ? t(
                      "Die Folgen werden automatisch von TMDB geladen. Falls das nicht klappt, nutze „Folgen laden“.",
                      "Episodes are loaded automatically from TMDB. If that fails, use “Load episodes”.",
                    )
                  : t(
                      "Für dieses Archiv fehlen die Folgen. Sie lassen sich nur mit einer TMDB-ID und einem hinterlegten API-Key laden.",
                      "This archive is missing its episodes. They can only be loaded with a TMDB ID and a configured API key.",
                    )}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-xl border border-line-soft bg-surface-2/50 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "chip py-0.5 text-[9px] uppercase tracking-[0.14em]",
                      progress.state === "watching" && "border-gold/30 text-gold",
                      progress.state === "watched" && "border-moss/35 text-moss",
                      progress.state === "rewatching" &&
                        "border-sky-300/30 text-sky-200",
                    )}
                  >
                    {stateLabels[progress.state]}
                  </span>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
                    {t("Fortschritt", "Progress")}
                  </p>
                </div>
                <p className="mt-2 text-sm text-cream">
                  {t(
                    `${progress.watchedEpisodes} von ${progress.totalEpisodes} Folgen gesehen`,
                    `${progress.watchedEpisodes} of ${progress.totalEpisodes} episodes watched`,
                  )}
                  {rewatching ? (
                    <span className="text-muted-2">
                      {" "}
                      ·{" "}
                      {t(
                        `${progress.rewatchedEpisodes} rewatched`,
                        `${progress.rewatchedEpisodes} rewatched`,
                      )}
                    </span>
                  ) : null}
                </p>
              </div>
              <span className="display text-2xl text-gold tabular-nums">
                {formatInt(barPercent, locale)} %
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  rewatching ? "bg-sky-300/70" : "bg-gold/70",
                )}
                style={{ width: `${Math.max(barPercent, 1)}%` }}
              />
            </div>

            {next ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gold">
                    {rewatching
                      ? t("Rewatch · Nächste Folge", "Rewatch · Next episode")
                      : t("Nächste Folge", "Next episode")}
                  </p>
                  <p className="mt-1 truncate text-sm text-cream">
                    <span className="mr-2 font-mono text-[11px] text-muted-2">
                      {episodeCode(next)}
                    </span>
                    {nextTitle}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-2">
                    {rewatching
                      ? t(
                          `${progress.rewatchedEpisodes} von ${progress.totalEpisodes} in diesem Durchlauf`,
                          `${progress.rewatchedEpisodes} of ${progress.totalEpisodes} in this run`,
                        )
                      : t(
                          `${progress.watchedEpisodes} von ${progress.totalEpisodes} gesehen · Staffel ${next.seasonNumber}`,
                          `${progress.watchedEpisodes} of ${progress.totalEpisodes} watched · season ${next.seasonNumber}`,
                        )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    run(`next:${next.id}`, () =>
                      rewatching
                        ? toggleEpisodeRewatchedAction(next.id, true)
                        : toggleEpisodeWatchedAction(next.id, true),
                    )
                  }
                  disabled={busyKey !== null}
                  className="btn-primary h-9 px-4 text-xs"
                >
                  {busy(`next:${next.id}`) ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : rewatching ? (
                    <RotateCcw className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  {rewatching
                    ? t("Rewatch abhaken", "Check off rewatch")
                    : t("Als gesehen markieren", "Mark as seen")}
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-moss">
                    {t("Komplett gesehen", "Fully watched")}
                  </p>
                  <p className="mt-1 text-sm text-cream">
                    {t(
                      `Alle ${progress.totalEpisodes} Folgen sind abgehakt.`,
                      `All ${progress.totalEpisodes} episodes are checked off.`,
                    )}
                    {progress.rewatchedEpisodes === progress.totalEpisodes
                      ? t(
                          " Der letzte Rewatch ist abgeschlossen.",
                          " The latest rewatch is complete.",
                        )
                      : ""}
                  </p>
                </div>
                {episodes[0] ? (
                  <button
                    type="button"
                    onClick={() => run("start-rewatch", () => startRewatchAction(movieId))}
                    disabled={busyKey !== null}
                    className="btn-quiet h-9 border border-line px-4 text-xs"
                  >
                    {busy("start-rewatch") ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    {t("Rewatch starten", "Start rewatch")}
                  </button>
                ) : null}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
              {progress.watchedEpisodes < progress.totalEpisodes ? (
                <button
                  type="button"
                  onClick={() =>
                    run("bulk-series", () =>
                      setSeasonWatchedAction(movieId, null, true),
                    )
                  }
                  disabled={busyKey !== null}
                  className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-cream disabled:opacity-50"
                >
                  {busy("bulk-series") ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CheckCheck className="size-3" />
                  )}
                  {t("Alle Folgen abhaken", "Check off all episodes")}
                </button>
              ) : null}
              {rewatching ? (
                <button
                  type="button"
                  onClick={() => run("stop-rewatch", () => stopRewatchAction(movieId))}
                  disabled={busyKey !== null}
                  className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-cream disabled:opacity-50"
                >
                  {busy("stop-rewatch") ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <X className="size-3" />
                  )}
                  {t("Rewatch beenden", "Stop rewatch")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {seasons.map((season) => {
              const complete = season.watchedCount === season.episodes.length;
              const remaining = season.episodes.length - season.watchedCount;
              const rewatchRemaining =
                season.episodes.length - season.rewatchedCount;
              return (
                <details
                  key={season.seasonNumber}
                  open={season.seasonNumber === next?.seasonNumber}
                  className="group/season rounded-xl border border-line-soft bg-surface-2/30"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-xs text-cream">
                    <ChevronDown className="size-3.5 shrink-0 text-muted-2 transition-transform group-open/season:rotate-180" />
                    <span className="font-medium">
                      {t("Staffel", "Season")} {season.seasonNumber}
                    </span>
                    <span className="text-muted-2">
                      {t(
                        `${season.watchedCount}/${season.episodes.length} gesehen`,
                        `${season.watchedCount}/${season.episodes.length} watched`,
                      )}
                    </span>
                    {rewatching && season.rewatchedCount > 0 ? (
                      <span className="chip border-sky-300/25 py-0.5 text-[9px] text-sky-200">
                        {t(
                          `${season.rewatchedCount} rewatched`,
                          `${season.rewatchedCount} rewatched`,
                        )}
                      </span>
                    ) : null}
                    {complete ? (
                      <Check className="ml-auto size-3.5 text-moss" />
                    ) : null}
                  </summary>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-2">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
                      {t("Staffel", "Season")} {season.seasonNumber}
                    </span>
                    <div className="flex items-center gap-3 text-[11px]">
                      {remaining > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            run(`season:${season.seasonNumber}`, () =>
                              setSeasonWatchedAction(
                                movieId,
                                season.seasonNumber,
                                true,
                              ),
                            )
                          }
                          disabled={busyKey !== null}
                          className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-gold disabled:opacity-50"
                        >
                          {busy(`season:${season.seasonNumber}`) ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <CheckCheck className="size-3" />
                          )}
                          {t("Staffel abhaken", "Check off season")}
                        </button>
                      ) : rewatching && rewatchRemaining > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            run(`season-rewatch:${season.seasonNumber}`, () =>
                              setSeasonRewatchedAction(
                                movieId,
                                season.seasonNumber,
                                true,
                              ),
                            )
                          }
                          disabled={busyKey !== null}
                          className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-sky-200 disabled:opacity-50"
                        >
                          {busy(`season-rewatch:${season.seasonNumber}`) ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3" />
                          )}
                          {t("Staffel rewatchen", "Rewatch season")}
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-2">
                          {t("Staffel komplett", "Season complete")}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul>
                    {season.episodes.map((episode) => {
                      const watchBusy = busy(`watch:${episode.id}`);
                      const rewatchBusy = busy(`rewatch:${episode.id}`);
                      const label = episodeTitle(episode, locale);
                      const still = mediaImage(episode.stillLocal, episode.stillPath, "w300");
                      return (
                        <li
                          key={episode.id}
                          className={cn(
                            "flex items-center gap-3 border-b border-line-soft/60 px-4 py-2.5 last:border-b-0",
                            episode.watched && "bg-white/[0.015]",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              run(`watch:${episode.id}`, () =>
                                toggleEpisodeWatchedAction(
                                  episode.id,
                                  !episode.watched,
                                ),
                              )
                            }
                            disabled={watchBusy}
                            aria-pressed={episode.watched}
                            aria-label={
                              episode.watched
                                ? t(
                                    `${label} als ungesehen markieren`,
                                    `Mark ${label} as unwatched`,
                                  )
                                : t(
                                    `${label} als gesehen markieren`,
                                    `Mark ${label} as watched`,
                                  )
                            }
                            title={
                              episode.watched
                                ? t("Ersten Durchlauf zurücksetzen", "Reset first run")
                                : t("Als gesehen markieren", "Mark as watched")
                            }
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                              episode.watched
                                ? "border-moss/60 bg-moss/20 text-moss"
                                : "border-line text-transparent hover:border-cream/40",
                            )}
                          >
                            {watchBusy ? (
                              <Loader2 className="size-3 animate-spin text-muted" />
                            ) : (
                              <Check className="size-3" />
                            )}
                          </button>

                          {episode.watched ? (
                            <button
                              type="button"
                              onClick={() =>
                                run(`rewatch:${episode.id}`, () =>
                                  toggleEpisodeRewatchedAction(
                                    episode.id,
                                    !episode.rewatched,
                                  ),
                                )
                              }
                              disabled={rewatchBusy}
                              aria-pressed={episode.rewatched}
                              aria-label={
                                episode.rewatched
                                  ? t(
                                      `${label} Rewatch entfernen`,
                                      `Remove rewatch for ${label}`,
                                    )
                                  : t(
                                      `${label} als rewatched markieren`,
                                      `Mark ${label} as rewatched`,
                                    )
                              }
                              title={
                                episode.rewatched
                                  ? t(
                                      "Rewatch-Markierung entfernen",
                                      "Remove rewatch mark",
                                    )
                                  : t("Als rewatched markieren", "Mark as rewatched")
                              }
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                                episode.rewatched
                                  ? "border-sky-300/50 bg-sky-300/15 text-sky-200"
                                  : "border-line text-muted-2 hover:border-sky-300/40 hover:text-sky-200",
                              )}
                            >
                              {rewatchBusy ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3" />
                              )}
                            </button>
                          ) : null}

                          <div className="hidden w-[88px] shrink-0 overflow-hidden rounded-md border border-white/10 bg-surface-2 sm:block">
                            {still ? (
                              <Image
                                src={still}
                                alt=""
                                width={176}
                                height={99}
                                sizes="88px"
                                className="aspect-video w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-video w-full items-center justify-center text-[9px] text-muted-2">
                                {t("S", "S")}
                                {episode.seasonNumber}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "line-clamp-2 text-[13px] sm:line-clamp-none sm:truncate",
                                episode.watched ? "text-cream" : "text-cream/85",
                              )}
                            >
                              <span className="mr-2 whitespace-nowrap font-mono text-[10px] text-muted-2">
                                {episodeCode(episode)}
                              </span>
                              {label}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-muted-2">
                              {[
                                episode.airDate
                                  ? formatDate(episode.airDate, locale)
                                  : null,
                                episode.runtime
                                  ? formatRuntime(episode.runtime, locale)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || t("Keine Angaben", "No details")}
                            </p>
                          </div>

                          {next?.id === episode.id ? (
                            <span className="hidden shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-gold sm:inline">
                              {t("Als Nächstes", "Up next")}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
          </div>
        </>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-[11px] leading-relaxed text-[#f0a08e]">
          {error}
        </p>
      ) : null}
      {syncNotice ? (
        <p className="mt-3 rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-[11px] text-[#b6cba9]">
          {syncNotice}
        </p>
      ) : null}
    </section>
  );
}
