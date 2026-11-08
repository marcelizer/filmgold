import fs from "node:fs/promises";
import path from "node:path";

import {
  mediaRoot,
  remotePathForLocal,
  resolveMediaFile,
  type MediaKind,
} from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const FALLBACK_SIZE: Record<MediaKind, string> = {
  posters: "w780",
  backdrops: "w1280",
  stills: "w300",
};

function fallbackUrl(relativePath: string) {
  const remote = remotePathForLocal(relativePath);
  if (!remote) return null;
  if (/^https?:\/\//i.test(remote.remote)) return remote.remote;
  return `https://image.tmdb.org/t/p/${FALLBACK_SIZE[remote.kind]}${
    remote.remote.startsWith("/") ? "" : "/"
  }${remote.remote}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relative = (segments ?? []).join("/");
  const file = resolveMediaFile(relative);

  if (!file || !file.startsWith(path.resolve(mediaRoot()) + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(file);
    const extension = path.extname(file).toLowerCase();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Content-Length": String(data.length),
        // File names are content hashes, so the content never changes.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    /*
     * A JSON backup restores the local path but not the image files. Serve
     * the TMDB original instead until the media cache is downloaded again.
     */
    const fallback = fallbackUrl(relative);
    if (fallback) {
      return Response.redirect(fallback, 307);
    }
    return new Response("Not found", { status: 404 });
  }
}
