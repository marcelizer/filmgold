import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListDetail } from "@/components/lists/list-detail";
import { getLocale } from "@/lib/i18n-server";
import {
  ALL_PAGE_SIZE,
  CATALOG_PAGE_SIZES,
  parseGridLayout,
  parsePageSize,
} from "@/lib/layout";
import { getListDetail } from "@/lib/lists";
import { tr } from "@/lib/locale";

export const dynamic = "force-dynamic";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const list = getListDetail(Number(id));
  if (!list) return { title: tr(locale, "Liste nicht gefunden", "List not found") };
  return {
    title: list.name,
    description:
      list.description ??
      tr(
        locale,
        `${list.count} Titel in der Filmgold-Liste „${list.name}“.`,
        `${list.count} ${list.count === 1 ? "title" : "titles"} in the Filmgold list “${list.name}”.`,
      ),
  };
}

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const listId = Number(id);
  if (!Number.isFinite(listId)) notFound();
  const list = getListDetail(listId);
  if (!list) notFound();
  const view = parseGridLayout(single(query.view));
  const size = parsePageSize(
    single(query.size),
    CATALOG_PAGE_SIZES,
    ALL_PAGE_SIZE,
  );
  const page = Math.max(1, Math.round(Number(single(query.page)) || 1));
  return <ListDetail list={list} size={size} view={view} page={page} />;
}
