"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { addTmdbMovieAction, searchTmdbAction } from "@/app/actions";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { formatScore, formatYear, tmdbImage } from "@/lib/format";
import { localeIntl } from "@/lib/locale";
import type { MediaType, TmdbSearchResult } from "@/lib/types";

export function TmdbAdd({
  configured,
  source,
}: {
  configured: boolean;
  source: "env" | "db" | "none";
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [media, setMedia] = useState<MediaType>("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function runSearch(value: string) {
    const clean = value.trim();
    if (clean.length < 2) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await searchTmdbAction(clean, media);
      if (!result.ok) {
        setError(result.error);
        setResults(null);
        return;
      }
      setResults(result.data);
      if (result.data.length === 0) {
        setMessage(
          t(
            "Keine Treffer. Andere Schreibweise versuchen?",
            "No results. Try a different spelling?",
          ),
        );
      }
    });
  }

  function add(result: TmdbSearchResult) {
    setAddingId(result.tmdbId);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await addTmdbMovieAction(result.tmdbId, result.mediaType);
      setAddingId(null);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResults((current) =>
        current?.map((entry) =>
          entry.tmdbId === result.tmdbId ? { ...entry, alreadyInDb: true } : entry,
        ) ?? null,
      );
      setMessage(
        response.data.added
          ? t(
              `„${result.title}“ wurde aufgenommen.`,
              `“${result.title}” was added.`,
            )
          : t(
              `„${result.title}“ war bereits vorhanden und wurde aktualisiert.`,
              `“${result.title}” was already in the archive and has been updated.`,
            ),
      );
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="surface-card p-5">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-gold" />
            <h2 className="text-sm font-medium text-cream">
              {t("Titel bei TMDB suchen", "Search titles on TMDB")}
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t(
              "Die Suche liefert deutsche Titel, Originaltitel, Besetzung, Laufzeit, Einspiel und Poster direkt aus The Movie Database – für Filme und Serien.",
              "The search returns titles, original titles, cast, runtime, box office and posters directly from The Movie Database – for movies and series.",
            )}
          </p>

          <div
            className="mt-4 inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2/70 p-0.5"
            role="group"
            aria-label={t(
              "Filme oder Serien durchsuchen",
              "Search movies or series",
            )}
          >
            {(["movie", "serie"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMedia(value);
                  setResults(null);
                  setMessage(null);
                  setError(null);
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

          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch(query);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  media === "serie"
                    ? t(
                        "z. B. Dark, Breaking Bad, Babylon Berlin …",
                        "e.g. Dark, Breaking Bad, Babylon Berlin …",
                      )
                    : t(
                        "z. B. Oppenheimer, Das Boot, Parasite …",
                        "e.g. Oppenheimer, Das Boot, Parasite …",
                      )
                }
                className="input-base h-11 pl-9"
                disabled={!configured}
              />
            </div>
            <button
              type="submit"
              disabled={!configured || pending || query.trim().length < 2}
              className="btn-primary h-11 px-5 text-xs"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {t("Suchen", "Search")}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-muted-2">
              {t("Beispiele:", "Examples:")}
            </span>
            {["Oppenheimer", "Das Boot", "Parasite", "Casablanca"].map((example) => (
              <button
                key={example}
                type="button"
                disabled={!configured}
                onClick={() => {
                  setQuery(example);
                  runSearch(example);
                }}
                className="chip transition-colors hover:border-gold/40 hover:text-gold"
              >
                {example}
              </button>
            ))}
          </div>

          {!configured ? (
            <div className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.04] p-4">
              <p className="text-xs font-medium text-gold">
                {t("TMDB-Key fehlt", "TMDB key missing")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {t(
                  "Ohne Key kann nicht gesucht werden. Hinterlege einen kostenlosen API-Key (v3) oder Read Access Token (v4) unter Einstellungen.",
                  "Searching requires a key. Add a free API key (v3) or read access token (v4) under Settings.",
                )}
              </p>
              <Link
                href="/admin?tab=einstellungen"
                className="mt-2 inline-flex text-[11px] text-gold hover:text-gold-soft"
              >
                {t("Zu den Einstellungen", "Go to settings")} →
              </Link>
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-[#b6cba9]">
              {message}
            </p>
          ) : null}
        </div>

        {results && results.length > 0 ? (
          <div className="mt-4 space-y-2">
            {results.map((result) => {
              const poster = tmdbImage(result.posterPath, "w342");
              return (
                <div
                  key={result.tmdbId}
                  className="surface-card flex gap-4 p-3 transition-colors hover:border-line"
                >
                  <div
                    className="aspect-2/3 w-12 shrink-0 rounded-md border border-white/10 bg-surface-2 bg-cover bg-center"
                    style={
                      poster ? { backgroundImage: `url(${poster})` } : undefined
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-cream">
                          {result.title}{" "}
                          <span className="font-normal text-muted-2">
                            ({formatYear(result.year)})
                          </span>
                        </p>
                        {result.originalTitle !== result.title ? (
                          <p className="truncate text-[11px] italic text-muted-2">
                            {result.originalTitle}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-gold">
                        {formatScore(result.rating)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted">
                      {result.overview ||
                        t(
                          "Keine Beschreibung verfügbar.",
                          "No description available.",
                        )}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-2">
                        {result.votes
                          ? t(
                              `${result.votes.toLocaleString(localeIntl(locale))} Stimmen`,
                              `${result.votes.toLocaleString(localeIntl(locale))} votes`,
                            )
                          : "–"}
                      </span>
                      <button
                        type="button"
                        onClick={() => add(result)}
                        disabled={pending || result.alreadyInDb}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] transition-colors",
                          result.alreadyInDb
                            ? "border-moss/30 bg-moss/10 text-moss"
                            : "border-line text-cream hover:border-gold/50 hover:text-gold",
                        )}
                      >
                        {result.alreadyInDb ? (
                          <>
                            <Check className="size-3" />{" "}
                            {t("Im Archiv", "In archive")}
                          </>
                        ) : addingId === result.tmdbId ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />{" "}
                            {t("Lade …", "Loading …")}
                          </>
                        ) : (
                          <>
                            <Plus className="size-3" /> {t("Hinzufügen", "Add")}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <aside className="space-y-4">
        <div className="surface-card p-5">
          <div className="flex items-center gap-2 text-gold">
            <Sparkles className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              {t("Tipp", "Tip")}
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {t(
              "Importer aus TMDB liefern keine Rotten-Tomatoes- oder Metacritic-Werte. Für ein vollständiges Kritikerbild kannst du sie im Film-Editor nachtragen – der Score wird sofort neu berechnet.",
              "TMDB imports do not include Rotten Tomatoes or Metacritic values. For a complete critics picture, add them in the title editor – the score is recalculated immediately.",
            )}
          </p>
        </div>
        <div className="surface-card p-5">
          <p className="eyebrow">{t("Status", "Status")}</p>
          <p className="mt-3 text-xs text-muted">
            {source === "env"
              ? t(
                  "Der Key kommt aus .env.local und hat Vorrang vor dem in der Datenbank gespeicherten Key.",
                  "The key comes from .env.local and takes precedence over the key stored in the database.",
                )
              : source === "db"
                ? t(
                    "Der Key ist lokal in der Datenbank gespeichert.",
                    "The key is stored locally in the database.",
                  )
                : t("Noch kein Key hinterlegt.", "No key configured yet.")}
          </p>
        </div>
      </aside>
    </div>
  );
}
