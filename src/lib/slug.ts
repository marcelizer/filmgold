export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "film";
}

export function uniqueSlug(
  base: string,
  exists: (slug: string) => boolean,
  suffix: string | number = "",
) {
  const root = suffix ? `${base}-${suffix}` : base;
  let candidate = root;
  let i = 2;
  while (exists(candidate)) {
    candidate = `${root}-${i}`;
    i += 1;
  }
  return candidate;
}
