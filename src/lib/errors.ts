import { tr, type Locale } from "./locale";

/**
 * Validation errors originate in the data layer (mostly German). Server actions
 * and client-side parsers share this table so both locales get the same copy.
 */
export const ERROR_TRANSLATIONS: Record<string, string> = {
  "Unbekannter Fehler.": "Unknown error.",
  "Ungültiger Film.": "Invalid film.",
  "Ungültiger Titel.": "Invalid title.",
  "Ungültige Serie.": "Invalid series.",
  "Ein Titel ist erforderlich.": "A title is required.",
  "Titel fehlt.": "Title missing.",
  "Film nicht gefunden.": "Film not found.",
  "Serie nicht gefunden.": "Series not found.",
  "Titel nicht gefunden.": "Title not found.",
  "Folge nicht gefunden.": "Episode not found.",
  "Ungültige Folge.": "Invalid episode.",
  "Ungültige Liste.": "Invalid list.",
  "Ungültige Auswahl.": "Invalid selection.",
  "Liste nicht gefunden.": "List not found.",
  "Bitte einen Listennamen eingeben.": "Please enter a list name.",
  "Eine Liste mit diesem Namen existiert bereits.":
    "A list with this name already exists.",
  "Titel ist nicht in dieser Liste.": "Title is not in this list.",
  "Ungültige TMDB-ID.": "Invalid TMDB ID.",
  "Titel oder TMDB-ID fehlt.": "Title or TMDB ID missing.",
  "Keine Zeilen zum Importieren gefunden.": "No rows found to import.",
  "Maximal 2000 Zeilen pro Import.": "A maximum of 2000 rows per import.",
  "Maximal 500 Zeilen pro Abgleich.": "A maximum of 500 rows per match.",
  "Keine Zeilen für den Abgleich.": "No rows to match.",
  "Keine Titel zum Übernehmen ausgewählt.": "No titles selected to add.",
  "Keine gültigen TMDB-IDs ausgewählt.": "No valid TMDB IDs selected.",
  "Mindestens eine Gewichtung muss über 0 liegen.":
    "At least one weight must be greater than 0.",
  "Bitte einen API-Key eingeben.": "Please enter an API key.",
  "Kein TMDB-API-Key hinterlegt. Trage ihn unter Admin → Einstellungen oder in .env.local ein.":
    "No TMDB API key configured. Add it under Admin → Settings or in .env.local.",
  "Unerwartete Antwort von TMDB.": "Unexpected response from TMDB.",
  "Nur Serien haben Folgen.": "Only series have episodes.",
  "Für diese Serie ist keine TMDB-ID hinterlegt.":
    "No TMDB ID is stored for this series.",
  "TMDB liefert keine Folgen für diese Serie.":
    "TMDB has no episodes for this series.",
  "TMDB lehnt den API-Key ab (401). Bitte Key prüfen.":
    "TMDB rejected the API key (401). Please check the key.",
  "TMDB-Rate-Limit erreicht. Bitte kurz warten.":
    "TMDB rate limit reached. Please wait a moment.",
  "Für die englischen Texte wird ein TMDB-API-Key benötigt.":
    "A TMDB API key is required for the English texts.",
  "Für die englischen Folgentexte wird ein TMDB-API-Key benötigt.":
    "A TMDB API key is required for the English episode texts.",
  "Bitte eine Titelliste einfügen.": "Please paste a list of titles.",
  "JSON konnte nicht gelesen werden.": "The JSON could not be read.",
  "JSON muss ein Array oder ein Objekt mit „movies“ sein.":
    "The JSON must be an array or an object containing “movies”.",
  "Keine Zeilen erkannt.": "No rows detected.",
  "Keine gültigen Titel gefunden.": "No valid titles found.",
  "Ungültiges Startpaket.": "Invalid starter package.",
  "Maximal 500 Einträge pro Startpaket.":
    "A maximum of 500 entries per starter package.",
  "Keine Einträge ausgewählt.": "No entries selected.",
  "Die Datenbank konnte nicht zurückgesetzt werden.":
    "The database could not be reset.",
};

/** Translate a known data-layer error, leaving unknown messages untouched. */
export function translateError(message: string, locale: Locale): string {
  const direct = ERROR_TRANSLATIONS[message];
  if (direct) return direct;
  const requestFailed = message.match(
    /^TMDB-Anfrage fehlgeschlagen \((\d+)\)\.$/,
  );
  if (requestFailed) {
    return tr(locale, message, `TMDB request failed (${requestFailed[1]}).`);
  }
  const maxRows = message.match(/^Maximal (\d+) Titel pro Abgleich\./);
  if (maxRows) {
    return tr(
      locale,
      message,
      `A maximum of ${maxRows[1]} titles per match. Please split the list.`,
    );
  }
  return message;
}
