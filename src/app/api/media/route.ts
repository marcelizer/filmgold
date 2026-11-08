import { Readable } from "node:stream";

import { createMediaArchive } from "@/lib/media-archive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { stream, filename, files } = await createMediaArchive();
    if (files === 0) {
      return new Response(
        "Der Medien-Cache ist leer. Lade zuerst Bilder in der Verwaltung herunter.",
        {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Medien-Export fehlgeschlagen.",
      {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
}
