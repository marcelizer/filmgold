export const LOCALES = ["de", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";
export const LOCALE_COOKIE = "filmgold_locale";

export function isLocale(value: unknown): value is Locale {
  return value === "de" || value === "en";
}

/** Pick the value for the active locale. */
export function pick<T>(locale: Locale, de: T, en: T): T {
  return locale === "en" ? en : de;
}

/** Inline translation helper: `tr(locale, "Filme", "Movies")`. */
export function tr(locale: Locale, de: string, en: string): string {
  return locale === "en" ? en : de;
}

export function localeIntl(locale: Locale) {
  return locale === "en" ? "en-US" : "de-DE";
}

/** Plural helper with an explicit English form. */
export function pluralFor(
  locale: Locale,
  count: number,
  deOne: string,
  deMany: string,
  enOne: string,
  enMany: string,
) {
  if (locale === "en") return count === 1 ? enOne : enMany;
  return count === 1 ? deOne : deMany;
}
