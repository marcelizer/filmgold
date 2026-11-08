import { localeIntl, type Locale } from "./locale";

export const de = "de-DE";

export function formatScore(
  value: number | null | undefined,
  digits = 1,
  locale: Locale = "de",
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat(localeIntl(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatInt(
  value: number | null | undefined,
  locale: Locale = "de",
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat(localeIntl(locale)).format(value);
}

export function formatCompact(
  value: number | null | undefined,
  locale: Locale = "de",
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat(localeIntl(locale), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatMoneyUsd(
  value: number | null | undefined,
  locale: Locale = "de",
) {
  if (value === null || value === undefined || Number.isNaN(value) || value <= 0) {
    return "–";
  }
  const format = new Intl.NumberFormat(localeIntl(locale), {
    maximumFractionDigits: 2,
  });
  if (value >= 1_000_000_000) {
    return locale === "en"
      ? `$${format.format(value / 1_000_000_000)}B`
      : `${format.format(value / 1_000_000_000)} Mrd. $`;
  }
  if (value >= 1_000_000) {
    return locale === "en"
      ? `$${format.format(value / 1_000_000)}M`
      : `${format.format(value / 1_000_000)} Mio. $`;
  }
  return new Intl.NumberFormat(localeIntl(locale), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRuntime(
  minutes: number | null | undefined,
  locale: Locale = "de",
) {
  if (!minutes) return "–";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (locale === "en") {
    if (hours === 0) return `${rest} min`;
    return `${hours} h ${rest.toString().padStart(2, "0")} min`;
  }
  if (hours === 0) return `${rest} Min.`;
  return `${hours} Std. ${rest.toString().padStart(2, "0")} Min.`;
}

export function formatDate(
  value: string | null | undefined,
  locale: Locale = "de",
) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat(localeIntl(locale), {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatYear(value: number | null | undefined) {
  return value ? String(value) : "–";
}

export function formatYearRange(
  start: number | null | undefined,
  end: number | null | undefined,
) {
  if (!start) return "–";
  if (!end || end === start) return String(start);
  return `${start}–${end}`;
}

export function scoreGrade(
  score: number | null | undefined,
  locale: Locale = "de",
) {
  if (score === null || score === undefined) {
    return locale === "en" ? "Unrated" : "Unbewertet";
  }
  if (score >= 85) return locale === "en" ? "Masterpiece" : "Meisterwerk";
  if (score >= 75) return locale === "en" ? "Outstanding" : "Herausragend";
  if (score >= 65) return locale === "en" ? "Worth watching" : "Sehenswert";
  if (score >= 50) return locale === "en" ? "Solid" : "Solide";
  return locale === "en" ? "Needs work" : "Ausbaufähig";
}

export function plural(count: number, singular: string, pluralForm: string) {
  return count === 1 ? singular : pluralForm;
}

export function decadeOf(year: number | null | undefined) {
  if (!year) return null;
  return Math.floor(year / 10) * 10;
}

export function decadeLabel(decade: number, locale: Locale = "de") {
  return locale === "en" ? `${decade}s` : `${decade}er`;
}

export function initials(title: string) {
  return title
    .split(/\s+/)
    .filter((part) => /[A-Za-zÀ-ÿ0-9]/.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function tmdbImage(path: string | null | undefined, size = "w500") {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/demo-posters")) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** URL for a cached file below data/media. */
export function localMediaUrl(path: string | null | undefined) {
  if (!path) return null;
  return `/media/${path
    .split(/[\\/]/)
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

/**
 * Prefer the locally cached image and fall back to TMDB. Both paths are
 * optional, so this also covers titles imported without artwork.
 */
export function mediaImage(
  localPath: string | null | undefined,
  remotePath: string | null | undefined,
  size = "w500",
) {
  return localMediaUrl(localPath) ?? tmdbImage(remotePath, size);
}
