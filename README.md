# Filmgold

Filmgold ist ein lokales, deutschsprachiges Ranking der besten Filme und Serien aller Zeiten. Die App verbindet Kritiker- und Publikumswertungen, Einspielergebnisse und aktuelle Popularität zu einem eigenen **Filmgold-Score** – und lässt dich Titel als gesehen markieren, persönlich bewerten und kommentieren.

Läuft vollständig auf deinem Rechner: Next.js-App, SQLite-Datenbank, keine Anmeldung, keine Cloud.

## Funktionen

- **Ranking & Archiv** – Filme und Serien getrennt durchsuchbar, sortierbar nach Filmgold-Score, Jahr, Titel, Box Office, Popularität und eigener Wertung; filterbar nach Genre, Jahrzehnt, Jahr und Gesehen-Status. Bei einer Titelsuche lässt sich zusätzlich „Auch außerhalb des Archivs“ aktivieren: Treffer aus TMDB, die noch fehlen, erscheinen direkt unter den Archivtreffern.
- **Filme und Serien** – Umschalter in der Navigation; Serien haben eigene Archiv-, Jahre- und Genre-Seiten sowie eigene Detailseiten mit Staffeln, Folgen, Status und Erstausstrahlung.
- **Folgen-Tracking für Serien** – Folgen einzeln für den ersten Durchlauf und den Rewatch abhaken, ganze Staffeln oder die komplette Serie auf einmal markieren, die nächste Folge sehen und den Serienstatus (Am Schauen / Gesehen / Rewatch) auf einen Blick erkennen.
- **Titelsuche in „Neu entdecken“** – nach Filmen oder Serien bei TMDB suchen, auch wenn sie schon im Archiv sind; archivierte Treffer sind markiert und führen direkt zur Detailseite.
- **Vorschau ohne Tab-Wechsel** – Titel aus „Neu entdecken“, die noch nicht im Archiv sind, öffnen eine interne Vorschau mit Handlung, Fakten und Besetzung – von dort direkt ins Archiv oder auf eine Liste.
- **Deutsche und originale Titel** – inklusive Handlung, Besetzung, Regie, Laufzeit, FSK, Oscars und Einspiel.
- **Persönliche Liste** – für Filme und Serien getrennt: gesehen markieren, 1–10 vergeben, Favoriten setzen, Notiz und Sichtdatum speichern.
- **Filmgold-Score** – gewichteter Score aus Kritik, Publikum, Box Office, Popularität und Bekanntheit. Fehlende Werte werden nicht mit 0 bestraft, sondern die übrigen Gewichte neu verteilt. Alle Gewichte sind im Adminbereich einstellbar.
- **Verwaltung** – Filme und Serien anlegen, bearbeiten, löschen; TMDB-Suche und kuratiertes Startpaket; CSV-/JSON-Import und Export; Demo-Daten laden oder entfernen. Datenbank-Snapshots lassen sich schlank (nur Katalog) oder vollständig (inklusive persönlicher Daten) als eigenständige SQLite-Datei herunterladen.
- **Eigene Listen** – gemischte Sammlungen aus Filmen und Serien, inklusive direktem Import einzelner Titel auf eine Liste beim Smart-Import.
- **Poster** – TMDB-Bilder oder lokale Dateien; bei fehlendem Bild wird ein gestaltetes Fallback-Poster erzeugt.

## Schnellstart

Voraussetzungen: **Node.js 20.9 oder neuer** (empfohlen: Node 24 LTS) und npm.

```bash
npm install
cp .env.example .env.local   # unter Windows: Copy-Item .env.example .env.local
npm run dev
```

Danach [http://localhost:3000](http://localhost:3000) öffnen.

Beim ersten Start legt die App die SQLite-Datei unter `data/filmgold.db` an und befüllt sie mit **24 Demo-Filmen**, damit die Seite sofort nutzbar ist. Die Demo-Filme sind im Interface gekennzeichnet und können im Adminbereich unter **Import & Export → Demo-Daten** entfernt werden.

Liegt im Repository bereits eine kuratierte `seed/filmgold.db`, wird diese beim ersten Start nach `data/filmgold.db` kopiert. Die Demo-Daten werden dann übersprungen; alle späteren Änderungen landen ausschließlich in der lokalen Kopie unter `data/`.

## TMDB einrichten

Filmdaten, Seriendaten und Poster kommen von [The Movie Database (TMDB)](https://www.themoviedb.org/). Ein kostenloser Account genügt:

1. Unter [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) einen API Key (v3) oder Read Access Token (v4) erstellen.
2. Den Wert in `.env.local` eintragen:

   ```dotenv
   TMDB_ACCESS_TOKEN=dein_v4_token
   # oder
   TMDB_API_KEY=dein_v3_key
   ```

3. Dev-Server neu starten.

Alternativ lässt sich der Key direkt im Adminbereich unter **Einstellungen → TMDB-Verbindung** hinterlegen. Er wird dann in der lokalen Datenbank gespeichert. Ein Eintrag in `.env.local` hat Vorrang vor dem Datenbank-Key.

Ohne Key funktionieren Archiv, Bewertungen und Verwaltung weiterhin – nur TMDB-Suche, Import und Poster von TMDB sind deaktiviert.

## Erste echte Daten

Im Adminbereich unter **Import & Export**:

- **Startpaket importieren** – lädt ein kuratiertes Set aus rund 190 Filmen über TMDB (deutscher Titel, Originaltitel, Poster, Besetzung, Laufzeit, Einspiel usw.). Der Vorgang dauert je nach Verbindung ein bis drei Minuten.
- **CSV oder JSON importieren** – eigene Daten einlesen. Die Spaltennamen sind flexibel; eine Vorlage lässt sich direkt herunterladen.
- **Demo-Daten entfernen** – löscht nur Titel mit Quelle `demo`, nicht deine eigenen Importe.

Ein Export des kompletten Archivs ist als CSV oder JSON über `/api/export?format=csv` bzw. `/api/export?format=json` möglich.

## Suchen & Entdecken

- **Im Archiv** (`/filme`, `/serien`): Das Suchfeld durchsucht Titel, Originaltitel, Regie bzw. Crew. Sobald ein Suchbegriff eingegeben ist, lässt sich **„Auch außerhalb des Archivs“** aktivieren. Dann erscheinen unter den Archivtreffern zusätzlich TMDB-Titel, die noch fehlen – mit Bewertung, Kurzbeschreibung und den bekannten Aktionen „Ins Archiv“ und „Auf Liste“.
- **In „Neu entdecken“** (`/entdecken`): Das Suchfeld oben sucht direkt bei TMDB – ohne Filter, dafür inklusive bereits archivierter Titel. Diese sind als „Im Archiv ansehen“ markiert; alle anderen lassen sich wie gewohnt übernehmen.
- Beide Suchen bleiben in der App: Treffer öffnen die interne Vorschau bzw. Detailseite, nie einen externen Tab.

## Der Filmgold-Score

Standardgewichtung (relativ zueinander, Summe 100):

| Komponente   | Gewicht | Grundlage |
| ------------ | ------: | --------- |
| Kritiker     |     35 % | Rotten Tomatoes und Metacritic |
| Publikum     |     30 % | IMDb (65 %) und TMDB (35 %) |
| Box Office   |     15 % | weltweites Einspiel, logarithmisch skaliert |
| Popularität  |     10 % | aktuelle TMDB-Popularität, logarithmisch skaliert |
| Bekanntheit  |     10 % | Anzahl der Bewertungen (IMDb-Stimmen, sonst TMDB-Stimmen) |

Jede Kennzahl wird auf 0–100 normalisiert. Fehlt eine Quelle, werden die verbleibenden Gewichte neu verteilt. Die Gewichte und der Score lassen sich unter **Admin → Einstellungen** anpassen und neu berechnen. Filme und Serien werden dabei getrennt normalisiert, damit ihre Skalen vergleichbar bleiben.

## Adminbereich

`/admin` ist ohne Login erreichbar und für den lokalen Einzelplatzbetrieb gedacht. Dort stehen diese Bereiche zur Verfügung:

- **Filme / Serien** – Tabelle mit allen Titeln, Suche, Editor und Löschen.
- **TMDB-Suche** – Film oder Serie suchen, Details prüfen und direkt ins Archiv übernehmen.
- **Import & Export** – Startpaket, CSV/JSON, Smart-Import, Backup, Datenbank-Snapshot und der frei konfigurierbare Tabellen-Export.
- **Medien** – lokalen Bild-Cache laden, vergleichen, leeren und als Archiv sichern.
- **Einstellungen** – Score-Gewichtung, TMDB-Key, Neuberechnung.

## Folgen-Tracking

Beim ersten Öffnen einer Serie lädt Filmgold die Folgen automatisch von TMDB (Special-Staffel 0 ausgenommen) und speichert sie lokal. Danach funktioniert das Abhaken auch ohne Internet.

- Jede Folge hat zwei Häkchen: das erste markiert den ersten Durchlauf, das zweite (Kreispfeil) den Rewatch. Der Rewatch lässt sich pro Folge, pro Staffel oder für die ganze Serie abhaken.
- Eine Serie gilt erst als **Gesehen**, wenn wirklich alle Folgen abgehakt sind. Ohne abgehakte Folge steht sie auf **Ungesehen**, bei mindestens einer offenen Folge auf **Am Schauen**, während eines Rewatchs auf **Rewatch**.
- Auf den Archivkarten sitzt oben rechts ein farbiger Episoden-Tag mit der nächsten Folge (z. B. `S02E06`): gold beim ersten Durchlauf, blau beim Rewatch. Daneben zeigt ein Status-Chip, ob die Serie **Beendet**, **Läuft**, **Abgesetzt**, **In Produktion** oder **Geplant** ist.
- Die nächste offene Folge wird oben im Panel hervorgehoben – mit einem Klick auf „Als gesehen markieren“ springt der Zeiger weiter.
- „Alle Folgen abhaken“ und „Staffel abhaken“ markieren mehrere Folgen auf einmal. „Rewatch starten“ beginnt nach dem ersten Durchlauf eine neue Runde bei Folge 1; „Rewatch beenden“ verlässt den Modus, ohne den Erstlauf zu verändern.
- „Abgleichen“ aktualisiert die Folgenliste mit TMDB, ohne deinen Fortschritt zu verlieren.

## Datenbank & Datenmodell

Filmgold verwendet **eine einzige SQLite-Datei** unter `data/filmgold.db`. Es gibt keine getrennte Benutzerdatenbank und keinen Datenbankserver: Katalog, persönliche Daten und Einstellungen liegen gemeinsam in dieser Datei. Getrennt sind nur die Bilddateien.

| Tabelle | Inhalt |
| --- | --- |
| `movies` | Alle Filme **und** Serien (unterschieden über `media_type`): Titel (DE/original/EN), Jahr, Genres, Laufzeit, Staffeln, Besetzung, Regie, Handlung, Bewertungen, Einspiel, Filmgold-Score, TMDB-IDs und relative Pfade zu lokal gecachten Bildern. |
| `episodes` | Folgenlisten der Serien inklusive Staffel, Nummer, Titel, Erstausstrahlung und lokalem Still-Pfad. |
| `personal` | Persönlicher Status pro Titel: gesehen, Bewertung, Favorit, Notiz, Sichtdatum und Rewatch-Modus. |
| `episode_progress` | Fortschritt pro Folge für den ersten Durchlauf und den Rewatch. |
| `lists` / `list_items` | Eigene Listen und ihre sortierten Einträge (Filme und Serien gemischt). |
| `settings` | Score-Gewichtung, Seitentitel, Demo-Markierung und optional der TMDB-Key. |

Die **Medien sind separat**: Poster, Backdrops und Folgenbilder liegen als Dateien unter `data/media/`. In der Datenbank stehen nur relative Pfade. Fehlt eine Datei, fällt die App automatisch auf die TMDB-URL zurück. Dadurch bleibt die Datenbank klein und ein Medien-Backup lässt sich unabhängig erstellen.

## Backup, Export & GitHub

Es gibt vier Wege, Daten aus Filmgold zu sichern – je nachdem, ob du alles, nur den Katalog oder eine Tabelle brauchst:

| Weg | Enthält | Format |
| --- | --- | --- |
| **Datenbank kopieren** | Alles inklusive persönlicher Daten und Einstellungen | `data/filmgold.db` (Server vorher stoppen) |
| **JSON-Backup** (`/api/backup`) | Katalog, Folgen, persönliche Daten, Listen und Einstellungen; Verweise auf lokale Bilder, aber keine Bilddateien | `.json` |
| **Tabellen-Export** (`/api/export`) | Frei wählbare Felder und Filter (z. B. nur Titel + Jahr + Bewertung) | CSV, XLSX, PDF, JSON |
| **Datenbank-Snapshot** (`/api/database`) | Eigenständige SQLite-Datei nach Preset | `.db` |

Der **Datenbank-Snapshot** im Adminbereich unter **Import & Export** ist der einfachste Weg für ein öffentliches Repository:

| Preset | Inhalt | Typische Größe* |
| --- | --- | ---: |
| **Schlank** | Nur `movies` – der komplette Katalog mit allen Metadaten | ca. 4,4 MB |
| **Archiv + Folgen** | Zusätzlich `episodes` | ca. 5,0 MB |
| **Komplett** | Zusätzlich persönliche Daten, Folgenfortschritt, Listen, Einstellungen und lokale Medienpfade | ca. 5,2 MB |

\* Gemessen mit dem aktuellen Archiv aus 2.267 Titeln und 685 Folgen; die Werte schwanken je nach Datenmenge.

Wichtig:

- **Alle Presets behalten die vollständigen Titel-Metadaten.** „Schlank“ entfernt keine Bewertungen, Genres oder Beschreibungen, sondern nur Folgen, persönliche Daten, Listen, Einstellungen und Medienpfade.
- Der **TMDB-Key wird nie** in einen Snapshot geschrieben – auch nicht bei „Komplett“. Einstellungen mit Schlüssel-, Token- oder Secret-Namen werden immer herausgefiltert.
- **Bilddateien sind nie enthalten.** Wer den Medien-Cache mitnehmen will, lädt ihn unter **Medien** als `filmgold-media-*.tar.gz` herunter. Das JSON-Backup und der Medien-Download gehören zusammen.
- Persönliche Daten lassen sich bewusst **nicht** aus einem schlanken Snapshot rekonstruieren; sie werden nur bei „Komplett“ mitgenommen. Fehlende Folgenlisten holt die App beim ersten Öffnen einer Serie automatisch von TMDB nach.

### Kuratiertes Archiv für GitHub veröffentlichen

1. Im Adminbereich unter **Import & Export → Datenbank-Snapshot** das Preset **Schlank** oder **Archiv + Folgen** wählen und herunterladen.
2. Die Datei als `seed/filmgold.db` im Repository ablegen.
3. `data/`, `data/media/`, `.env.local` und `.next/` nicht committen – sie sind bereits in `.gitignore` ausgeschlossen.
4. Beim ersten Start kopiert die App `seed/filmgold.db` automatisch nach `data/filmgold.db`, sofern dort noch keine Datei liegt und `DATABASE_PATH` nicht gesetzt ist. Der Seed selbst bleibt unverändert; alle persönlichen Änderungen landen in der lokalen Kopie.

So enthält das Repository einen schlanken, reproduzierbaren Katalog, während Bewertungen, Favoriten, Listen und Bild-Cache lokal bleiben.

## Technik

- Next.js 16 (App Router, Turbopack) und React 19
- Tailwind CSS v4
- SQLite über `better-sqlite3`
- TMDB API (deutsche Metadaten)
- TypeScript

## Projektstruktur

```text
src/app/          Seiten, Server Actions und API-Routen
src/components/   Oberfläche, Adminbereich und Dialoge
src/lib/          SQLite, TMDB, Score, Suche, Backup, Export und Medien-Cache
public/           Statische Assets und Demo-Poster
seed/             Kuratierter Datenbank-Seed für neue Installationen
data/             Lokale Datenbank und Medien-Cache (git-ignoriert)
```

## Skripte

```bash
npm run dev      # Entwicklungsserver
npm run build    # Produktionsbuild
npm start        # Produktionsserver (nach npm run build)
npm run lint     # ESLint
npx tsc --noEmit # TypeScript prüfen
```

## Hinweise

- Die App ist für den lokalen Einzelbenutzerbetrieb ohne Authentifizierung ausgelegt. Für einen öffentlich erreichbaren Server müsste der Adminbereich geschützt werden.
- Film- und Serienmetadaten sowie Poster stammen von TMDB. Bitte die [TMDB-Nutzungsbedingungen](https://www.themoviedb.org/documentation/api/terms-of-use) beachten.
- Die mitgelieferten Demo-Poster dienen nur als Platzhalter für die lokale Demo und werden nicht für den Produktivbetrieb empfohlen.
