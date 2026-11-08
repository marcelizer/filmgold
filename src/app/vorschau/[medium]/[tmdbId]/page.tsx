import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Globe2,
  Layers,
  ListVideo,
  Star,
  TriangleAlert,
  Users,
} from "lucide-react";
import { PreviewActions } from "@/components/discover/preview-actions";
import { Poster } from "@/components/poster";
import { seriesStatusMeta } from "@/components/series/series-state-badge";
import {
  contentGenres,
  contentOriginalTitle,
  contentOverview,
  contentTagline,
  contentTitle,
} from "@/lib/content";
import { hasTmdbCredentials } from "@/lib/db";
import {
  formatDate,
  formatInt,
  formatRuntime,
  formatScore,
  formatYear,
  formatYearRange,
  tmdbImage,
} from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import { getLists } from "@/lib/lists";
import { tr, type Locale } from "@/lib/locale";
import { getMovieByTmdbId } from "@/lib/movies";
import { fetchTmdbMedia } from "@/lib/tmdb";
import type { MediaType, MovieInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseMedia(value: string): MediaType | null {
  return value === "movie" || value === "film"
    ? "movie"
    : value === "serie" || value === "serien"
      ? "serie"
      : null;
}

/** Keeps the TMDB lookup shared between metadata and page render. */
const loadPreview = cache((tmdbId: number, media: MediaType) =>
  fetchTmdbMedia(tmdbId, media),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ medium: string; tmdbId: string }>;
}): Promise<Metadata> {
  const locale = await getLocale();
  const { medium, tmdbId: rawId } = await params;
  const media = parseMedia(medium);
  const tmdbId = Number(rawId);
  if (!media || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return { title: tr(locale, "Vorschau", "Preview") };
  }
  try {
    const item = await loadPreview(tmdbId, media);
    const title = contentTitle(item, locale);
    const overview = contentOverview(item, locale);
    return {
      title: `${title}${item.year ? ` (${item.year})` : ""} – ${tr(
        locale,
        "Vorschau",
        "Preview",
      )}`,
      description:
        overview?.slice(0, 160) ??
        tr(
          locale,
          `${title} bei Filmgold ansehen und ins Archiv übernehmen.`,
          `View ${title} on Filmgold and add it to your archive.`,
        ),
      openGraph: {
        title,
        description: overview?.slice(0, 200) ?? undefined,
        images: item.posterPath ? [tmdbImage(item.posterPath, "w500") ?? ""] : undefined,
      },
    };
  } catch {
    return { title: tr(locale, "Vorschau", "Preview") };
  }
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ medium: string; tmdbId: string }>;
}) {
  const locale: Locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const { medium, tmdbId: rawId } = await params;
  const media = parseMedia(medium);
  const tmdbId = Number(rawId);
  if (!media || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    redirect("/entdecken");
  }

  const archived = getMovieByTmdbId(tmdbId, media);
  if (archived) {
    redirect(`${media === "serie" ? "/serien" : "/filme"}/${archived.slug}`);
  }

  const configured = hasTmdbCredentials();
  const lists = getLists().map((list) => ({
    id: list.id,
    name: list.name,
    count: list.count,
  }));
  const backHref = `/entdecken${media === "serie" ? "?medium=serie" : ""}`;
  const noun = media === "serie" ? t("Serie", "Series") : t("Film", "Film");

  let item: MovieInput | null = null;
  let error: string | null = null;
  if (configured) {
    try {
      item = await loadPreview(tmdbId, media);
    } catch (caught) {
      error =
        caught instanceof Error
          ? caught.message
          : t(
              "TMDB konnte nicht abgefragt werden.",
              "TMDB could not be queried.",
            );
    }
  }

  if (!configured || error || !item) {
    return (
      <div className="container-page py-16">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-cream"
        >
          <ArrowLeft className="size-3.5" />
          {t("Zurück zur Entdeckung", "Back to discovery")}
        </Link>
        <div className="mt-8 max-w-2xl rounded-2xl border border-rust/30 bg-rust/10 p-6 text-sm text-[#f0a08e]">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4" />
            {configured
              ? t("Vorschau nicht verfügbar", "Preview unavailable")
              : t("TMDB-Key fehlt", "TMDB key missing")}
          </p>
          <p className="mt-2 text-xs leading-relaxed">
            {error ??
              t(
                "Für die Vorschau wird ein TMDB-API-Key benötigt. Hinterlege ihn unter Admin → Einstellungen.",
                "A TMDB API key is required for the preview. Add it under Admin → Settings.",
              )}
          </p>
          <Link
            href="/admin?tab=einstellungen"
            className="mt-4 inline-flex text-xs text-gold hover:text-gold-soft"
          >
            {t("Zu den Einstellungen", "Go to settings")}{" "}
            <ArrowRight className="ml-1 size-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const backdrop = tmdbImage(item.backdropPath ?? null, "w1280");
  const poster = tmdbImage(item.posterPath ?? null, "w500");
  const title = contentTitle(item, locale);
  const overview = contentOverview(item, locale);
  const tagline = contentTagline(item, locale);
  const genres = contentGenres(item, locale);
  const originalShown = contentOriginalTitle(item, locale);
  const isSerie = media === "serie";

  const facts = isSerie
    ? [
        {
          icon: CalendarDays,
          label: t("Startjahr", "First aired"),
          value: formatYearRange(item.year ?? null, item.endYear ?? null),
        },
        {
          icon: Layers,
          label: t("Staffeln", "Seasons"),
          value: item.seasons ? formatInt(item.seasons, locale) : "–",
        },
        {
          icon: ListVideo,
          label: t("Folgen", "Episodes"),
          value: item.episodes ? formatInt(item.episodes, locale) : "–",
        },
        {
          icon: Clock,
          label: t("Folgenlänge", "Episode length"),
          value: formatRuntime(item.runtime ?? null, locale),
        },
        { icon: Globe2, label: t("Herkunft", "Origin"), value: item.country ?? "–" },
        { icon: Users, label: t("Idee", "Created by"), value: item.director ?? "–" },
        {
          icon: Star,
          label: t("Status", "Status"),
          value: seriesStatusMeta(item.seriesStatus, locale)?.label ?? "–",
        },
      ]
    : [
        {
          icon: CalendarDays,
          label: t("Erscheinungsjahr", "Release year"),
          value: formatYear(item.year ?? null),
        },
        {
          icon: Clock,
          label: t("Laufzeit", "Runtime"),
          value: formatRuntime(item.runtime ?? null, locale),
        },
        { icon: Globe2, label: t("Herkunft", "Origin"), value: item.country ?? "–" },
        { icon: Users, label: t("Regie", "Director"), value: item.director ?? "–" },
      ];

  return (
    <article>
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
          {backdrop ? (
            <Image
              src={backdrop}
              alt=""
              fill
              loading="eager"
              sizes="100vw"
              className="scale-105 object-cover object-top opacity-60"
            />
          ) : poster ? (
            <Image
              src={poster}
              alt=""
              fill
              loading="eager"
              sizes="100vw"
              className="scale-125 object-cover object-top opacity-30 blur-2xl"
            />
          ) : (
            <div className="hero-glow h-full w-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/80 via-transparent to-bg/40" />
        </div>

        <div className="container-page pt-8 lg:pt-12">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-cream"
          >
            <ArrowLeft className="size-3.5" />
            {t("Zurück zur Entdeckung", "Back to discovery")}
          </Link>

          <div className="mt-8 grid gap-8 pb-10 md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr] lg:gap-12">
            <div className="mx-auto w-[180px] sm:w-[200px] md:mx-0 md:w-full">
              <Poster
                movie={{
                  id: -tmdbId,
                  titleDe: item.titleDe,
                  titleEn: item.titleEn ?? null,
                  titleOriginal: item.titleOriginal ?? item.titleDe,
                  year: item.year ?? null,
                  posterPath: item.posterPath ?? null,
                }}
                imageSize="w500"
                sizes="(max-width: 768px) 50vw, 240px"
                eager
                locale={locale}
                className="shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip border-gold/25 text-gold">{noun}</span>
                <span className="chip border-white/15 text-muted-2">
                  {t("Vorschau · TMDB", "Preview · TMDB")}
                </span>
                {genres.map((genre) => (
                  <span key={genre} className="chip">
                    {genre}
                  </span>
                ))}
                {item.ageRating ? <span className="chip">{item.ageRating}</span> : null}
              </div>

              <h1 className="display mt-4 text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.96] text-cream">
                {title}
              </h1>
              {originalShown ? (
                <p className="mt-2 text-sm italic text-muted-2">{originalShown}</p>
              ) : null}
              {tagline ? (
                <p className="mt-3 text-sm text-gold-soft/90">
                  {locale === "en" ? `“${tagline}”` : `„${tagline}“`}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                <span className="tabular-nums">{formatYear(item.year ?? null)}</span>
                {item.runtime ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatRuntime(item.runtime, locale)}
                  </span>
                ) : null}
                {item.tmdbRating ? (
                  <span className="inline-flex items-center gap-1 text-gold">
                    <Star className="size-3 fill-current" />
                    {formatScore(item.tmdbRating, 1, locale)}
                    {item.tmdbVotes ? (
                      <span className="text-muted-2">
                        ({formatInt(item.tmdbVotes, locale)} {t("Stimmen", "votes")})
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-10 pb-16 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-10">
          {overview ? (
            <section>
              <h2 className="eyebrow">{t("Handlung", "Synopsis")}</h2>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-cream/85">
                {overview}
              </p>
            </section>
          ) : null}

          <section className="surface-card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="eyebrow">{t("Fakten", "Facts")}</h2>
              {item.releaseDate ? (
                <p className="text-[11px] text-muted-2">
                  {isSerie
                    ? t("Erstausstrahlung", "First aired")
                    : t("Kinostart", "Released")}
                  : {formatDate(item.releaseDate, locale)}
                </p>
              ) : null}
            </div>
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-start gap-3">
                  <fact.icon className="mt-0.5 size-4 shrink-0 text-muted-2" />
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
                      {fact.label}
                    </dt>
                    <dd className="mt-0.5 text-sm leading-snug text-cream">
                      {fact.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          {item.cast && item.cast.length > 0 ? (
            <section>
              <h2 className="eyebrow">{t("Besetzung", "Cast")}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.cast.map((person) => (
                  <span key={person} className="chip">
                    {person}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <p className="rounded-xl border border-line-soft bg-surface-2/40 px-4 py-3 text-[11px] leading-relaxed text-muted-2">
            {isSerie
              ? t(
                  "Diese Serie liegt noch nicht in deinem Archiv. Daten und Bilder stammen von TMDB. Mit „Ins Archiv übernehmen“ speicherst du alle Angaben dauerhaft und kannst Folgen abhaken.",
                  "This series is not in your archive yet. Data and images come from TMDB. With “Add to archive” you save all details permanently and can tick off episodes.",
                )
              : t(
                  "Dieser Film liegt noch nicht in deinem Archiv. Daten und Bilder stammen von TMDB. Mit „Ins Archiv übernehmen“ speicherst du alle Angaben dauerhaft und kannst ihn bewerten.",
                  "This film is not in your archive yet. Data and images come from TMDB. With “Add to archive” you save all details permanently and can rate it.",
                )}
          </p>
        </div>

        <aside className="space-y-5">
          <div className="surface-card p-5">
            <p className="eyebrow">{t("Übernehmen", "Add")}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t(
                "Direkt ins Archiv legen oder erst einmal auf eine Liste setzen.",
                "Put it straight into the archive or add it to a list first.",
              )}
            </p>
            <div className="mt-4">
              <PreviewActions tmdbId={tmdbId} mediaType={media} lists={lists} />
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
