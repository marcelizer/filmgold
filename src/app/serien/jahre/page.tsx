import type { Metadata } from "next";
import { YearsPage } from "@/components/pages/years-page";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Serien nach Jahr", "Series by year"),
    description: pick(
      locale,
      "Die besten Serien Jahr für Jahr im Filmgold-Archiv.",
      "The best series year by year in the Filmgold archive.",
    ),
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <YearsPage media="serie" searchParams={searchParams} />;
}
