import type { Metadata } from "next";
import { GenresPage } from "@/components/pages/genres-page";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Serien nach Genre", "Series by genre"),
    description: pick(
      locale,
      "Die besten Serien nach Genre – Drama, Komödie, Krimi, Sci-Fi & Fantasy und mehr.",
      "The best series by genre – drama, comedy, crime, sci-fi & fantasy and more.",
    ),
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <GenresPage media="serie" searchParams={searchParams} />;
}
