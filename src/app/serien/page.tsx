import type { Metadata } from "next";
import { CatalogPage } from "@/components/pages/catalog-page";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Alle Serien", "All series"),
    description: pick(
      locale,
      "Das komplette Serien-Archiv – filterbar nach Genre, Jahrzehnt, Jahr und Sortierung.",
      "The complete series archive – filterable by genre, decade, year and sort order.",
    ),
  };
}

export default function SeriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage media="serie" searchParams={searchParams} />;
}
