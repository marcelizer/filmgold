import type { Metadata } from "next";
import { DetailPage, detailMetadata } from "@/components/pages/detail-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return detailMetadata(slug, "movie");
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DetailPage slug={slug} media="movie" />;
}
