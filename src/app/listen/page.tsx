import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Film, ListPlus, Plus, Sparkles, Tv } from "lucide-react";
import { CreateListForm } from "@/components/lists/create-list-form";
import { Poster } from "@/components/poster";
import { formatDate, formatInt } from "@/lib/format";
import { getLocale } from "@/lib/i18n-server";
import { getLists } from "@/lib/lists";
import { pluralFor, tr, type Locale } from "@/lib/locale";
import { getStats } from "@/lib/movies";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: tr(locale, "Eigene Listen", "Your lists"),
    description: tr(
      locale,
      "Eigene Sammlungen anlegen, Filme und Serien hinzufügen und in deine persönliche Reihenfolge bringen.",
      "Create your own collections, add films and series and arrange them in your personal order.",
    ),
  };
}

export default async function ListsPage() {
  const locale: Locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  const lists = getLists();
  const stats = getStats();
  const seriesStats = getStats("serie");
  const totalSlots = lists.reduce((sum, list) => sum + list.count, 0);

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <p className="eyebrow">{t("Deine Sammlungen", "Your collections")}</p>
          <h1 className="display mt-3 text-5xl text-cream sm:text-6xl">
            {t("Eigene Listen", "Your lists")}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            {lists.length > 0
              ? t(
                  `${formatInt(lists.length, locale)} ${pluralFor(
                    locale,
                    lists.length,
                    "Liste",
                    "Listen",
                    "list",
                    "lists",
                  )} mit ${formatInt(totalSlots, locale)} ${pluralFor(
                    locale,
                    totalSlots,
                    "Platz",
                    "Plätzen",
                    "slot",
                    "slots",
                  )}. Sortiere Titel nach Stimmung, Genre oder deiner ganz eigenen Dramaturgie.`,
                  `${formatInt(lists.length, locale)} ${pluralFor(
                    locale,
                    lists.length,
                    "Liste",
                    "Listen",
                    "list",
                    "lists",
                  )} with ${formatInt(totalSlots, locale)} ${pluralFor(
                    locale,
                    totalSlots,
                    "slot",
                    "slots",
                    "slot",
                    "slots",
                  )}. Arrange titles by mood, genre or your very own narrative.`,
                )
              : t(
                  "Lege Sammlungen für einen Filmabend, ein Genre oder deine persönliche Reihenfolge an – unabhängig von Bewertungen und gesehen-Status.",
                  "Create collections for a movie night, a genre or your personal order – independent of ratings and seen status.",
                )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/filme" className="btn-ghost">
            <Film className="size-3.5" />
            {t("Filme entdecken", "Discover films")}
          </Link>
          <Link href="/serien" className="btn-ghost">
            <Tv className="size-3.5" />
            {t("Serien entdecken", "Discover series")}
          </Link>
          <Link href="/meine-liste" className="btn-quiet border border-line">
            {t("Gesehene Titel", "Seen titles")}
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        <CreateListForm />

        <div className="min-w-0">
          {lists.length === 0 ? (
            <div className="flex h-full flex-col items-start justify-center gap-4 rounded-2xl border border-dashed border-line bg-surface/40 p-8 sm:p-10">
              <span className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <ListPlus className="size-5 text-gold" />
              </span>
              <div>
                <h2 className="display text-3xl text-cream">
                  {t("Die erste Liste wartet.", "Your first list is waiting.")}
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
                  {t(
                    "Gib links einen Namen ein. Danach kannst du auf jeder Detailseite oder direkt in der Liste nach Filmen und Serien suchen und sie hinzufügen.",
                    "Enter a name on the left. You can then search films and series on every detail page or directly inside the list and add them.",
                  )}
                </p>
              </div>
              <Link
                href={`/filme?sort=score_desc`}
                className="text-xs text-gold hover:text-gold-soft"
              >
                {t("Zum Archiv", "Go to archive")}{" "}
                <ArrowRight className="inline size-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {lists.map((list) => {
                const covers = list.coverMovies.slice(0, 3);
                return (
                  <Link
                    key={list.id}
                    href={`/listen/${list.id}`}
                    className="group surface-card relative overflow-hidden p-5 transition-colors hover:border-gold/35"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                          {formatInt(list.count, locale)}{" "}
                          {t("Titel", "titles")}
                        </p>
                        <h2 className="display mt-1.5 truncate text-2xl text-cream transition-colors group-hover:text-gold">
                          {list.name}
                        </h2>
                        {list.description ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
                            {list.description}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs italic text-muted-2">
                            {t("Noch keine Beschreibung", "No description yet")}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 -space-x-4">
                        {covers.length > 0 ? (
                          covers.map((movie, index) => (
                            <Poster
                              key={movie.id}
                              movie={movie}
                              imageSize="w342"
                              sizes="64px"
                              locale={locale}
                              className={`w-14 rounded-lg ring-2 ring-surface ${
                                index === 0
                                  ? "rotate-[-4deg]"
                                  : index === 2
                                    ? "rotate-[4deg]"
                                    : ""
                              }`}
                            />
                          ))
                        ) : (
                          <span className="flex size-14 items-center justify-center rounded-lg border border-dashed border-line text-muted-2">
                            <Sparkles className="size-4" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3 border-t border-line-soft pt-3">
                      <p className="text-[10px] text-muted-2">
                        {t("Aktualisiert", "Updated")}{" "}
                        {formatDate(list.updatedAt, locale)}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[11px] text-gold opacity-0 transition-opacity group-hover:opacity-100">
                        {t("Liste öffnen", "Open list")}{" "}
                        <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}

              <div className="flex flex-col items-start justify-center gap-3 rounded-2xl border border-dashed border-line p-5 text-muted-2">
                <Plus className="size-4 text-gold" />
                <p className="text-xs leading-relaxed">
                  {t(
                    "Weitere Listen lassen sich jederzeit links anlegen.",
                    "You can create more lists on the left at any time.",
                  )}
                </p>
                <p className="text-[10px] text-muted-2">
                  {t(
                    `${formatInt(stats.count, locale)} Filme und ${formatInt(
                      seriesStats.count,
                      locale,
                    )} Serien im Archiv als Fundus.`,
                    `${formatInt(stats.count, locale)} films and ${formatInt(
                      seriesStats.count,
                      locale,
                    )} series in the archive to draw from.`,
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
