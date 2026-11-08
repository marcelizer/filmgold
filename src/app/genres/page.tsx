import type { Metadata } from "next";
import { GenresPage } from "@/components/pages/genres-page";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Nach Genre", "By genre"),
    description: pick(
      locale,
      "Die besten Filme nach Genre – Drama, Science-Fiction, Thriller, Komödie und mehr.",
      "The best films by genre – drama, science fiction, thriller, comedy and more.",
    ),
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <GenresPage media="movie" searchParams={searchParams} />;
}
