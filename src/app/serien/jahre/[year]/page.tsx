import type { Metadata } from "next";
import { YearPage } from "@/components/pages/year-page";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const [locale, { year }] = await Promise.all([getLocale(), params]);
  return {
    title: pick(locale, `Serien aus ${year}`, `Series from ${year}`),
    description: pick(
      locale,
      `Die besten Serien des Jahrgangs ${year} im Filmgold-Archiv.`,
      `The best series of ${year} in the Filmgold archive.`,
    ),
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { year } = await params;
  return (
    <YearPage media="serie" rawYear={year} searchParams={searchParams} />
  );
}
