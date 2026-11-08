export type GridLayout = "compact" | "standard" | "large";

export const GRID_LAYOUTS: GridLayout[] = ["compact", "standard", "large"];

/** Sentinel for "show everything" in the page-size controls. */
export const ALL_PAGE_SIZE = 0;
export const MAX_PAGE_SIZE = 1000;

/** Shared presets so catalog and discovery behave the same way. */
export const CATALOG_PAGE_SIZES = [24, 48, 96] as const;
export const SEARCH_PAGE_SIZES = CATALOG_PAGE_SIZES;
export const YEAR_PREVIEW_SIZES = [4, 8, 12, 24] as const;
export const ADMIN_PAGE_SIZES = [25, 50, 100, 200] as const;

/** Discovery can scan at most this many TMDB results per request. */
export const MAX_DISCOVER_PAGE_SIZE = 200;

export function parseGridLayout(
  value: string | string[] | undefined,
  fallback: GridLayout = "standard",
): GridLayout {
  const raw = Array.isArray(value) ? value[0] : value;
  return GRID_LAYOUTS.includes(raw as GridLayout)
    ? (raw as GridLayout)
    : fallback;
}

/**
 * Parse a page-size query value. Presets are convenient, but any positive
 * number is accepted so users can type their own size. `all`, `alle` and `0`
 * mean "show everything" and return `ALL_PAGE_SIZE`.
 */
export function parsePageSize(
  value: string | string[] | number | undefined,
  options: readonly number[],
  fallback: number,
  limits: { allowAll?: boolean; max?: number } = {},
): number {
  const allowAll = limits.allowAll ?? true;
  const max = limits.max ?? MAX_PAGE_SIZE;
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw ?? "").trim().toLowerCase();
  if (allowAll && (text === "all" || text === "alle" || text === "0")) {
    return ALL_PAGE_SIZE;
  }
  const parsed = Math.round(Number(text));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, parsed);
}

/** Serialise a page size back into a query value. */
export function pageSizeParam(
  size: number,
  fallback: number,
): string | undefined {
  if (size === fallback) return undefined;
  return size === ALL_PAGE_SIZE ? "all" : String(size);
}

/** Column/row rhythm for the main archive grid. */
export function gridClassName(layout: GridLayout): string {
  switch (layout) {
    case "compact":
      return "grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7";
    case "large":
      return "grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    default:
      return "grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  }
}

/** Denser, smaller preview rows used by the year overview. */
export function previewGridClassName(layout: GridLayout): string {
  switch (layout) {
    case "compact":
      return "grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6";
    case "large":
      return "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";
    default:
      return "grid-cols-2 gap-4 sm:grid-cols-4";
  }
}

export function previewCardSizes(layout: GridLayout): string {
  switch (layout) {
    case "compact":
      return "(max-width: 640px) 30vw, 15vw";
    case "large":
      return "(max-width: 640px) 90vw, 30vw";
    default:
      return "(max-width: 640px) 45vw, 20vw";
  }
}
