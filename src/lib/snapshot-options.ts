export type SnapshotMedia = "all" | "movie" | "serie";

export type SnapshotScope = {
  media: SnapshotMedia;
  includeEpisodes: boolean;
  includePersonal: boolean;
  includeLists: boolean;
  includeSettings: boolean;
  includeMediaPaths: boolean;
};

export type SnapshotPreset = "light" | "standard" | "full";

export const SNAPSHOT_PRESETS: Record<SnapshotPreset, SnapshotScope> = {
  /* Catalogue metadata only — ideal for a public GitHub seed. */
  light: {
    media: "all",
    includeEpisodes: false,
    includePersonal: false,
    includeLists: false,
    includeSettings: false,
    includeMediaPaths: false,
  },
  /* Adds the complete episode list, still without personal data. */
  standard: {
    media: "all",
    includeEpisodes: true,
    includePersonal: false,
    includeLists: false,
    includeSettings: false,
    includeMediaPaths: false,
  },
  /* Everything except secrets. TMDB credentials are always stripped. */
  full: {
    media: "all",
    includeEpisodes: true,
    includePersonal: true,
    includeLists: true,
    includeSettings: true,
    includeMediaPaths: true,
  },
};

export function snapshotQuery(scope: SnapshotScope) {
  const params = new URLSearchParams({
    media: scope.media,
    episodes: scope.includeEpisodes ? "1" : "0",
    personal: scope.includePersonal ? "1" : "0",
    lists: scope.includeLists ? "1" : "0",
    settings: scope.includeSettings ? "1" : "0",
    mediaPaths: scope.includeMediaPaths ? "1" : "0",
  });
  return params.toString();
}

export function normalizeSnapshotScope(
  input: Partial<SnapshotScope>,
): SnapshotScope {
  return {
    media:
      input.media === "movie" || input.media === "serie" ? input.media : "all",
    includeEpisodes: Boolean(input.includeEpisodes),
    includePersonal: Boolean(input.includePersonal),
    includeLists: Boolean(input.includeLists),
    includeSettings: Boolean(input.includeSettings),
    includeMediaPaths: Boolean(input.includeMediaPaths),
  };
}
