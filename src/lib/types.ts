export type MediaType = "movie" | "serie";

export type SortKey =
  | "score_desc"
  | "score_asc"
  | "year_desc"
  | "year_asc"
  | "title_asc"
  | "boxoffice_desc"
  | "popularity_desc"
  | "myrating_desc"
  | "added_desc";

export type SeenFilter = "all" | "seen" | "unseen";

export type MovieFilters = {
  media?: MediaType;
  q?: string;
  year?: number;
  decade?: number;
  genre?: string;
  listId?: number;
  sort?: SortKey;
  seen?: SeenFilter;
  favorite?: boolean;
  minScore?: number;
  minMyRating?: number;
  page?: number;
  pageSize?: number;
};

export type Movie = {
  id: number;
  mediaType: MediaType;
  tmdbId: number | null;
  slug: string;
  titleDe: string;
  titleEn: string | null;
  titleOriginal: string;
  year: number | null;
  endYear: number | null;
  seasons: number | null;
  episodes: number | null;
  seriesStatus: string | null;
  releaseDate: string | null;
  overviewDe: string | null;
  overviewEn: string | null;
  taglineDe: string | null;
  taglineEn: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  /** Relative path below data/media, or null when only TMDB has the image. */
  posterLocal: string | null;
  backdropLocal: string | null;
  genres: string[];
  genresEn: string[];
  runtime: number | null;
  director: string | null;
  cast: string[];
  country: string | null;
  originalLanguage: string | null;
  ageRating: string | null;
  imdbId: string | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  rtRating: number | null;
  metacritic: number | null;
  tmdbRating: number | null;
  tmdbVotes: number | null;
  boxOffice: number | null;
  budget: number | null;
  popularity: number | null;
  oscarWins: number;
  oscarNominations: number;
  awards: string | null;
  criticsScore: number | null;
  audienceScore: number | null;
  boxofficeScore: number | null;
  popularityScore: number | null;
  renownScore: number | null;
  totalScore: number;
  source: string;
  starterIndex: number | null;
  createdAt: string;
  updatedAt: string;
  seen: boolean;
  myRating: number | null;
  favorite: boolean;
  listNames: string[];
  watchedAt: string | null;
  myNote: string | null;
};

export type MovieInput = {
  mediaType?: MediaType;
  tmdbId?: number | null;
  titleDe: string;
  titleEn?: string | null;
  titleOriginal?: string | null;
  year?: number | null;
  endYear?: number | null;
  seasons?: number | null;
  episodes?: number | null;
  seriesStatus?: string | null;
  releaseDate?: string | null;
  overviewDe?: string | null;
  overviewEn?: string | null;
  taglineDe?: string | null;
  taglineEn?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  genres?: string[];
  genresEn?: string[];
  runtime?: number | null;
  director?: string | null;
  cast?: string[];
  country?: string | null;
  originalLanguage?: string | null;
  ageRating?: string | null;
  imdbId?: string | null;
  imdbRating?: number | null;
  imdbVotes?: number | null;
  rtRating?: number | null;
  metacritic?: number | null;
  tmdbRating?: number | null;
  tmdbVotes?: number | null;
  boxOffice?: number | null;
  budget?: number | null;
  popularity?: number | null;
  oscarWins?: number | null;
  oscarNominations?: number | null;
  awards?: string | null;
  source?: string | null;
};

export type ScoreWeights = {
  critics: number;
  audience: number;
  boxoffice: number;
  popularity: number;
  renown: number;
};

export type PersonalState = {
  seen: boolean;
  rating: number | null;
  favorite: boolean;
  note: string | null;
  watchedAt: string | null;
};

export type ListResult = {
  movies: Movie[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type Stats = {
  count: number;
  seenCount: number;
  ratedCount: number;
  favoriteCount: number;
  avgScore: number;
  avgMyRating: number | null;
  yearMin: number | null;
  yearMax: number | null;
  genreCount: number;
  decades: { decade: number; count: number }[];
  genres: { name: string; count: number }[];
  recentYear: number | null;
};

export type TmdbSearchResult = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  overview: string;
  posterPath: string | null;
  rating: number | null;
  votes: number | null;
  popularity: number | null;
  alreadyInDb: boolean;
  existingId: number | null;
  existingSlug: string | null;
  /** TMDB genre ids (search results only). */
  genreIds?: number[];
  /** ISO 639-1 original language (search results only). */
  originalLanguage?: string;
};

/** One page of TMDB search hits plus the paging metadata. */
export type TmdbSearchPage = {
  results: TmdbSearchResult[];
  page: number;
  totalPages: number;
  totalResults: number;
};

export type MovieListSummary = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  count: number;
  coverMovies: Movie[];
};

export type MovieListDetail = MovieListSummary & {
  movies: Movie[];
};

export type MovieListMembership = {
  id: number;
  name: string;
  description: string | null;
  count: number;
  contains: boolean;
};

export type ListSearchCandidate = {
  key: string;
  movieId: number | null;
  tmdbId: number | null;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  posterPath: string | null;
  rating: number | null;
  inList: boolean;
  inArchive: boolean;
};

export type ImportMatchInput = {
  title: string;
  year?: number | null;
  originalTitle?: string | null;
  tmdbId?: number | null;
};

export type TmdbMatchCandidate = TmdbSearchResult & {
  matchScore: number;
  matchLabel: "hoch" | "mittel" | "niedrig";
  reasons: string[];
};

export type TmdbMatchResult = {
  index: number;
  input: ImportMatchInput;
  candidates: TmdbMatchCandidate[];
  bestTmdbId: number | null;
  status: "matched" | "review" | "none" | "error";
  error?: string;
};

export type TmdbMatchBatch = {
  nextOffset: number;
  total: number;
  done: boolean;
  results: TmdbMatchResult[];
};

export type TmdbImportChoice = {
  index: number;
  tmdbId: number;
  inputTitle: string;
  mediaType?: MediaType;
  listId?: number | null;
};

export type TmdbImportBatchResult = {
  nextOffset: number;
  total: number;
  done: boolean;
  added: number;
  updated: number;
  listed: number;
  imported: { id: number; slug: string; title: string }[];
  errors: string[];
};

export type DiscoverSort =
  | "relevance"
  | "rating_desc"
  | "popularity_desc"
  | "revenue_desc"
  | "release_desc"
  | "votes_desc";

export type DiscoverFilters = {
  media: MediaType;
  genreIds: number[];
  genreMode: "and" | "or";
  year: number | null;
  decade: number | null;
  minRating: number;
  minVotes: number;
  language: string | null;
  sort: DiscoverSort;
  page: number;
  /** How many fresh titles should be collected for one view. */
  perPage?: number;
};

export type DiscoverMovie = TmdbSearchResult & {
  genreIds: number[];
};

/** A capped pool of TMDB search hits used for local filtering and sorting. */
export type TmdbSearchPool = {
  movies: DiscoverMovie[];
  totalResults: number;
  totalPages: number;
  capped: boolean;
};

export type DiscoverResult = {
  movies: DiscoverMovie[];
  nextPage: number | null;
  hiddenExisting: number;
  scannedPages: number;
  totalResults: number;
  totalPages: number;
};

/** Where a series currently stands, derived from its episode progress. */
export type WatchState = "none" | "watching" | "watched" | "rewatching";

export type Episode = {
  id: number;
  movieId: number;
  seasonNumber: number;
  episodeNumber: number;
  tmdbId: number | null;
  title: string;
  titleEn: string | null;
  overview: string | null;
  overviewEn: string | null;
  airDate: string | null;
  runtime: number | null;
  stillPath: string | null;
  stillLocal: string | null;
  watched: boolean;
  rewatched: boolean;
  watchedAt: string | null;
};

export type SeriesProgress = {
  state: WatchState;
  totalEpisodes: number;
  watchedEpisodes: number;
  rewatchedEpisodes: number;
  percent: number;
  nextEpisode: Episode | null;
  rewatchActive: boolean;
};

/** Compact progress summary for archive cards and list rows. */
export type SeriesStateSummary = {
  state: WatchState;
  watchedEpisodes: number;
  totalEpisodes: number;
  nextEpisode: {
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    titleEn?: string | null;
  } | null;
};

export type EpisodeInput = {
  tmdbId?: number | null;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  titleEn?: string | null;
  overview?: string | null;
  overviewEn?: string | null;
  airDate?: string | null;
  runtime?: number | null;
  stillPath?: string | null;
  stillLocal?: string | null;
};

export type ImportRow = Partial<MovieInput> & {
  id?: number | string | null;
  tmdb_id?: number | string | null;
  slug?: string | null;
};
