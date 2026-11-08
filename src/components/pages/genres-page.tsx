import Link from "next/link";
import { ArrowRight, ListX } from "lucide-react";
import { ListFilter } from "@/components/list-filter";
import { Poster } from "@/components/poster";
import { contentTitle, genreLabel } from "@/lib/content";
import { formatInt, formatScore } from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import { getListMovieIds, getListOptions } from "@/lib/lists";
import { pluralFor, tr, type Locale } from "@/lib/locale";
import { getAllMovies } from "@/lib/movies";
import type { MediaType } from "@/lib/types";

const GENRE_HUES: Record<string, number> = {
  Drama: 32,
  Krimi: 12,
  Thriller: 210,
  Action: 4,
  "Action & Abenteuer": 12,
  "Science-Fiction": 195,
  "Science Fiction": 195,
  "Sci-Fi & Fantasy": 265,
  Abenteuer: 88,
  Fantasy: 275,
  Komödie: 45,
  Krieg: 20,
  "Krieg & Politik": 16,
  Historie: 40,
  Mystery: 250,
  Animation: 320,
  Romantik: 340,
  Liebesfilm: 340,
  Western: 30,
  Musik: 290,
  Familie: 130,
  Kinder: 120,
  Dokumentarfilm: 170,
  Nachrichten: 190,
  Reality: 300,
  Seifenoper: 335,
  Talkshow: 55,
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function GenresPage({
  media,
  searchParams,
}: {
  media: MediaType;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale: Locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const params = searchParams ? await searchParams : {};
  const listRaw = Number(single(params.list));
  const listId = Number.isFinite(listRaw) && listRaw > 0 ? listRaw : undefined;
  const lists = getListOptions();
  const allowed = listId ? new Set(getListMovieIds(listId)) : null;
  const activeList = listId ? lists.find((entry) => entry.id === listId) : null;

  const all = getAllMovies(1000, media).filter((movie) =>
    allowed ? allowed.has(movie.id) : true,
  );
  const isSerie = media === "serie";
  const noun = isSerie ? t("Serien", "series") : t("Filme", "films");
  const singular = isSerie ? t("Serie", "series") : t("Film", "film");
  const catalogPath = isSerie ? "/serien" : "/filme";
  const basePath = isSerie ? "/serien/genres" : "/genres";

  const counts = new Map<string, number>();
  for (const movie of all) {
    for (const genre of movie.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  const genres = [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      movies: all.filter((movie) => movie.genres.includes(name)).slice(0, 3),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        genreLabel(a.name, locale).localeCompare(
          genreLabel(b.name, locale),
          locale === "en" ? "en" : "de",
        ),
    );
  const listQuery = listId ? `&list=${listId}` : "";

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="max-w-3xl">
        <p className="eyebrow">{t("Gattungen", "Genres")}</p>
        <h1 className="display mt-3 text-5xl text-cream sm:text-6xl">
          {t("Nach Genre", "By genre")}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            `${formatInt(genres.length, locale)} ${pluralFor(
              locale,
              genres.length,
              "Genre",
              "Genres",
              "genre",
              "genres",
            )}, ${formatInt(all.length, locale)} ${pluralFor(
              locale,
              all.length,
              singular,
              noun,
              singular,
              noun,
            )}. Jede Gattung hat ihren eigenen Maßstab – vom leisen Drama bis zum blockbustenden Spektakel.`,
            `${formatInt(genres.length, locale)} ${pluralFor(
              locale,
              genres.length,
              "Genre",
              "Genres",
              "genre",
              "genres",
            )}, ${formatInt(all.length, locale)} ${pluralFor(
              locale,
              all.length,
              singular,
              noun,
              singular,
              noun,
            )}. Every genre has its own scale – from the quiet drama to the blockbuster spectacle.`,
          )}
        </p>
        {activeList ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1 text-[11px] text-gold">
            {t("Gefiltert nach Liste", "Filtered by list")}: {activeList.name}
            <Link href={basePath} className="text-muted hover:text-cream">
              {t("zurücksetzen", "reset")}
            </Link>
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ListFilter
          lists={lists}
          value={listId ? String(listId) : ""}
          basePath={basePath}
        />
        <Link
          href={`${catalogPath}${listId ? `?list=${listId}` : ""}`}
          className="chip transition-colors hover:border-gold/40 hover:text-gold"
        >
          {t("Liste im Archiv öffnen", "Open list in archive")}{" "}
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {genres.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line bg-surface/40 p-8">
          <span className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <ListX className="size-5 text-gold" />
          </span>
          <div>
            <h2 className="display text-3xl text-cream">
              {t("Keine Titel in dieser Liste.", "No titles in this list.")}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {t(
                "Füge über die Karten im Archiv Titel hinzu – oder wähle eine andere Liste.",
                "Add titles via the cards in the archive – or choose another list.",
              )}
            </p>
          </div>
          <Link href={catalogPath} className="btn-primary h-9 px-4 text-xs">
            {t("Zum Archiv", "Go to archive")}
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {genres.map(({ name, count, movies }) => {
            const hue = GENRE_HUES[name] ?? 24;
            const label = genreLabel(name, locale);
            const lead = movies[0];
            return (
              <Link
                key={name}
                href={`${catalogPath}?genre=${encodeURIComponent(name)}${listQuery}`}
                className="group relative min-h-[230px] overflow-hidden rounded-2xl border border-line-soft bg-surface transition-colors hover:border-gold/30"
              >
                <div
                  className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                  style={{
                    background: `radial-gradient(120% 130% at 88% 10%, hsl(${hue} 30% 26%) 0%, #0b0c0f 58%), linear-gradient(120deg, hsl(${hue} 18% 15%) 0%, #0a0b0e 75%)`,
                  }}
                />
                <div className="relative flex h-full flex-col justify-between gap-6 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                        {count} {pluralFor(locale, count, singular, noun, singular, noun)}
                      </p>
                      <h2 className="display mt-1 text-4xl text-cream">{label}</h2>
                      <p className="mt-3 max-w-[16rem] text-xs leading-relaxed text-white/55">
                        {lead
                          ? t(
                              `Angeführt von ${contentTitle(lead, locale)} (${lead.year}) mit ${formatScore(
                                lead.totalScore,
                                1,
                                locale,
                              )} Punkten.`,
                              `Led by ${contentTitle(lead, locale)} (${lead.year}) with a score of ${formatScore(
                                lead.totalScore,
                                1,
                                locale,
                              )}.`,
                            )
                          : t(`${noun} entdecken`, `Discover ${noun}`)}
                      </p>
                    </div>
                    <div className="flex -space-x-5 pt-1">
                      {movies.map((movie, index) => (
                        <Poster
                          key={movie.id}
                          movie={movie}
                          imageSize="w342"
                          sizes="70px"
                          locale={locale}
                          className={`w-16 rounded-lg ring-2 ring-[#0b0c0f] ${
                            index === 0
                              ? "rotate-[-5deg]"
                              : index === 2
                                ? "rotate-[5deg]"
                                : ""
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <ol className="min-w-0 space-y-1.5">
                      {movies.slice(0, 3).map((movie, index) => (
                        <li
                          key={movie.id}
                          className="flex items-center gap-2 text-[11px] text-white/55"
                        >
                          <span className="w-3 text-right tabular-nums text-gold/70">
                            {index + 1}
                          </span>
                          <span className="truncate">{contentTitle(movie, locale)}</span>
                        </li>
                      ))}
                    </ol>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-gold opacity-70 transition-opacity group-hover:opacity-100">
                      {t("Entdecken", "Discover")} <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
