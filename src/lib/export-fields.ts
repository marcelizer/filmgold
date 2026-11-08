import { pick, type Locale } from "./locale";

export const EXPORT_FIELD_KEYS = [
  "title",
  "originalTitle",
  "titleDe",
  "titleEn",
  "year",
  "releaseDate",
  "mediaType",
  "genres",
  "runtime",
  "seasons",
  "episodes",
  "score",
  "myRating",
  "seen",
  "favorite",
  "watchState",
  "seriesStatus",
  "nextEpisode",
  "director",
  "cast",
  "country",
  "ageRating",
  "overview",
  "tagline",
  "posterUrl",
  "backdropUrl",
  "imdbRating",
  "rtRating",
  "metacritic",
  "tmdbRating",
  "boxOffice",
  "budget",
  "popularity",
  "oscars",
  "awards",
  "lists",
  "addedAt",
  "watchedAt",
  "note",
  "tmdbId",
] as const;

export type ExportFieldKey = (typeof EXPORT_FIELD_KEYS)[number];

export type ExportFieldGroup = "basis" | "details" | "personal" | "technical";

export type ExportField = {
  key: ExportFieldKey;
  labelDe: string;
  labelEn: string;
  group: ExportFieldGroup;
  defaultOn: boolean;
};

export const EXPORT_FIELDS: ExportField[] = [
  { key: "title", labelDe: "Titel", labelEn: "Title", group: "basis", defaultOn: true },
  { key: "originalTitle", labelDe: "Originaltitel", labelEn: "Original title", group: "basis", defaultOn: false },
  { key: "titleDe", labelDe: "Titel (DE)", labelEn: "Title (DE)", group: "basis", defaultOn: false },
  { key: "titleEn", labelDe: "Titel (EN)", labelEn: "Title (EN)", group: "basis", defaultOn: false },
  { key: "year", labelDe: "Jahr", labelEn: "Year", group: "basis", defaultOn: true },
  { key: "releaseDate", labelDe: "Erscheinungsdatum", labelEn: "Release date", group: "basis", defaultOn: false },
  { key: "mediaType", labelDe: "Typ", labelEn: "Type", group: "basis", defaultOn: true },
  { key: "genres", labelDe: "Genres", labelEn: "Genres", group: "basis", defaultOn: true },
  { key: "runtime", labelDe: "Laufzeit", labelEn: "Runtime", group: "basis", defaultOn: true },
  { key: "seasons", labelDe: "Staffeln", labelEn: "Seasons", group: "basis", defaultOn: true },
  { key: "episodes", labelDe: "Folgen", labelEn: "Episodes", group: "basis", defaultOn: true },
  { key: "score", labelDe: "Filmgold-Score", labelEn: "Filmgold score", group: "basis", defaultOn: true },
  { key: "myRating", labelDe: "Meine Bewertung", labelEn: "My rating", group: "basis", defaultOn: true },
  { key: "seen", labelDe: "Gesehen", labelEn: "Seen", group: "basis", defaultOn: true },
  { key: "favorite", labelDe: "Favorit", labelEn: "Favourite", group: "personal", defaultOn: false },
  { key: "watchState", labelDe: "Status", labelEn: "Status", group: "basis", defaultOn: true },
  { key: "seriesStatus", labelDe: "Ausstrahlung", labelEn: "Airing", group: "basis", defaultOn: true },
  { key: "nextEpisode", labelDe: "Nächste Folge", labelEn: "Next episode", group: "basis", defaultOn: false },
  { key: "director", labelDe: "Regie", labelEn: "Director", group: "details", defaultOn: false },
  { key: "cast", labelDe: "Besetzung", labelEn: "Cast", group: "details", defaultOn: false },
  { key: "country", labelDe: "Herkunft", labelEn: "Origin", group: "details", defaultOn: false },
  { key: "ageRating", labelDe: "FSK", labelEn: "Age rating", group: "details", defaultOn: false },
  { key: "overview", labelDe: "Handlung", labelEn: "Synopsis", group: "details", defaultOn: false },
  { key: "tagline", labelDe: "Tagline", labelEn: "Tagline", group: "details", defaultOn: false },
  { key: "posterUrl", labelDe: "Cover-URL", labelEn: "Cover URL", group: "technical", defaultOn: true },
  { key: "backdropUrl", labelDe: "Backdrop-URL", labelEn: "Backdrop URL", group: "technical", defaultOn: false },
  { key: "imdbRating", labelDe: "IMDb", labelEn: "IMDb", group: "technical", defaultOn: false },
  { key: "rtRating", labelDe: "Rotten Tomatoes", labelEn: "Rotten Tomatoes", group: "technical", defaultOn: false },
  { key: "metacritic", labelDe: "Metacritic", labelEn: "Metacritic", group: "technical", defaultOn: false },
  { key: "tmdbRating", labelDe: "TMDB", labelEn: "TMDB", group: "technical", defaultOn: false },
  { key: "boxOffice", labelDe: "Einspiel", labelEn: "Box office", group: "technical", defaultOn: false },
  { key: "budget", labelDe: "Budget", labelEn: "Budget", group: "technical", defaultOn: false },
  { key: "popularity", labelDe: "Popularität", labelEn: "Popularity", group: "technical", defaultOn: false },
  { key: "oscars", labelDe: "Oscars", labelEn: "Oscars", group: "technical", defaultOn: false },
  { key: "awards", labelDe: "Auszeichnungen", labelEn: "Awards", group: "technical", defaultOn: false },
  { key: "lists", labelDe: "Listen", labelEn: "Lists", group: "personal", defaultOn: false },
  { key: "addedAt", labelDe: "Hinzugefügt", labelEn: "Added", group: "personal", defaultOn: false },
  { key: "watchedAt", labelDe: "Gesehen am", labelEn: "Watched on", group: "personal", defaultOn: false },
  { key: "note", labelDe: "Notiz", labelEn: "Note", group: "personal", defaultOn: false },
  { key: "tmdbId", labelDe: "TMDB-ID", labelEn: "TMDB ID", group: "technical", defaultOn: false },
];

export const EXPORT_GROUP_LABELS: Record<
  ExportFieldGroup,
  { de: string; en: string }
> = {
  basis: { de: "Basis", en: "Basics" },
  details: { de: "Details", en: "Details" },
  personal: { de: "Persönlich", en: "Personal" },
  technical: { de: "Kennzahlen", en: "Metrics" },
};

export function exportLabel(field: ExportField, locale: Locale) {
  return pick(locale, field.labelDe, field.labelEn);
}

export function defaultExportFields(): ExportFieldKey[] {
  return EXPORT_FIELDS.filter((field) => field.defaultOn).map((field) => field.key);
}

export function parseExportFields(raw: string | null | undefined): ExportFieldKey[] {
  const known = new Set<string>(EXPORT_FIELD_KEYS);
  const requested = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => known.has(entry)) as ExportFieldKey[];
  return requested.length > 0 ? requested : defaultExportFields();
}
