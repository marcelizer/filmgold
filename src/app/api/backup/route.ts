import { NextResponse } from "next/server";
import { buildBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "backup"
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const listRaw = Number(url.searchParams.get("listId"));
    const listId = Number.isFinite(listRaw) && listRaw > 0 ? listRaw : undefined;
    const backup = buildBackup({ listId });
    const date = backup.generatedAt.slice(0, 10);
    const name =
      backup.scope.type === "list"
        ? `filmgold-backup-${safeName(backup.scope.listName)}-${date}.json`
        : `filmgold-backup-all-${date}.json`;
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Backup konnte nicht erstellt werden.",
      },
      { status: 400 },
    );
  }
}
