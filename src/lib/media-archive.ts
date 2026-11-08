import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { createGzip } from "node:zlib";

import { mediaRoot } from "./media";

type ArchiveEntry = {
  absolute: string;
  relative: string;
  size: number;
  mtimeMs: number;
};

async function listFiles(directory: string, base = directory): Promise<ArchiveEntry[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: ArchiveEntry[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute, base)));
    } else if (entry.isFile() && !entry.name.includes(".tmp-")) {
      const stat = await fsp.stat(absolute);
      files.push({
        absolute,
        relative: path.relative(base, absolute).split(path.sep).join("/"),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    }
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

const BLOCK = 512;

function octal(value: number, length: number) {
  return `${value.toString(8).padStart(length - 1, "0")}\0`;
}

function tarHeader(name: string, size: number, mtimeMs: number): Buffer {
  const header = Buffer.alloc(BLOCK, 0);
  const safeName = name.slice(0, 99);
  header.write(safeName, 0, 100, "utf8");
  header.write("0000644\0", 100, 8);
  header.write("0000000\0", 108, 8);
  header.write("0000000\0", 116, 8);
  header.write(octal(size, 12), 124, 12);
  header.write(octal(Math.max(0, Math.floor(mtimeMs / 1000)), 12), 136, 12);
  // Checksum is calculated with the field filled by spaces.
  header.write("        ", 148, 8);
  header.write("0", 156, 1);
  header.write("ustar\0", 257, 6);
  header.write("00", 263, 2);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return header;
}

function padding(size: number) {
  const remainder = size % BLOCK;
  return remainder === 0 ? 0 : BLOCK - remainder;
}

async function* tarStream(files: ArchiveEntry[], manifest: Buffer) {
  // A small manifest makes the archive self-describing.
  yield tarHeader("filmgold-media/manifest.json", manifest.length, Date.now());
  yield manifest;
  yield Buffer.alloc(padding(manifest.length));

  for (const file of files) {
    yield tarHeader(`filmgold-media/${file.relative}`, file.size, file.mtimeMs);
    for await (const chunk of fs.createReadStream(file.absolute)) {
      yield chunk as Buffer;
    }
    const pad = padding(file.size);
    if (pad > 0) yield Buffer.alloc(pad);
  }
  // Two empty blocks mark the end of a tar archive.
  yield Buffer.alloc(BLOCK * 2);
}

export async function createMediaArchive(): Promise<{
  stream: Readable;
  filename: string;
  files: number;
}> {
  const files = await listFiles(mediaRoot());
  const date = new Date().toISOString().slice(0, 10);
  const manifest = Buffer.from(
    JSON.stringify(
      {
        format: "filmgold-media",
        version: 1,
        generatedAt: new Date().toISOString(),
        files: files.length,
        note:
          "Extract the filmgold-media folder into your data directory so it sits next to filmgold.db. Media files complement the JSON metadata backup.",
      },
      null,
      2,
    ),
    "utf8",
  );
  const stream = Readable.from(tarStream(files, manifest)).pipe(
    createGzip({ level: 6 }),
  );
  return {
    stream,
    filename: `filmgold-media-${date}.tar.gz`,
    files: files.length,
  };
}
