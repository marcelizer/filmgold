import type { Metadata } from "next";
import { YearsPage } from "@/components/pages/years-page";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Nach Jahr", "By year"),
    description: pick(
      locale,
      "Die besten Filme Jahr für Jahr – von Metropolis bis in die Gegenwart.",
      "The best films year by year – from Metropolis to the present day.",
    ),
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <YearsPage media="movie" searchParams={searchParams} />;
}
