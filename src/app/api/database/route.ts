import fs from "node:fs/promises";

import {
  SNAPSHOT_PRESETS,
  normalizeSnapshotScope,
  type SnapshotPreset,
  type SnapshotScope,
} from "@/lib/snapshot-options";
import { buildDatabaseSnapshot, cleanupSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function single(url: URL, key: string) {
  return url.searchParams.get(key);
}

function flag(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  return value === "1" || value === "true" || value === "yes";
}

function scopeFromUrl(url: URL): SnapshotScope {
  const presetRaw = single(url, "preset") as SnapshotPreset | null;
  const base =
    presetRaw && Object.hasOwn(SNAPSHOT_PRESETS, presetRaw)
      ? SNAPSHOT_PRESETS[presetRaw]
      : SNAPSHOT_PRESETS.light;
  const mediaRaw = single(url, "media");
  return normalizeSnapshotScope({
    media:
      mediaRaw === "movie" || mediaRaw === "serie" ? mediaRaw : base.media,
    includeEpisodes: flag(single(url, "episodes"), base.includeEpisodes),
    includePersonal: flag(single(url, "personal"), base.includePersonal),
    includeLists: flag(single(url, "lists"), base.includeLists),
    includeSettings: flag(single(url, "settings"), base.includeSettings),
    includeMediaPaths: flag(single(url, "mediaPaths"), base.includeMediaPaths),
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const snapshot = buildDatabaseSnapshot(scopeFromUrl(url));
    try {
      const data = await fs.readFile(snapshot.path);
      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": "application/vnd.sqlite3",
          "Content-Disposition": `attachment; filename="${snapshot.filename}"`,
          "Content-Length": String(data.length),
          "Cache-Control": "no-store",
        },
      });
    } finally {
      cleanupSnapshot(snapshot);
    }
  } catch (error) {
    return new Response(
      error instanceof Error
        ? error.message
        : "Datenbank-Snapshot konnte nicht erstellt werden.",
      {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
}
