import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { tr } from "@/lib/locale";

export async function SiteFooter() {
  const locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  return (
    <footer className="mt-24 border-t border-line-soft bg-surface/40">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
              <span className="size-1.5 rounded-full bg-gold" />
            </span>
            <span className="text-[12px] font-semibold tracking-[0.28em] text-cream">
              FILMGOLD
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            {t(
              "Das Beste aus über einem Jahrhundert Kino und Fernsehen – gewichtet nach Kritik, Publikum, Box Office und Popularität. Mit deutschen Titeln, Originalnamen und deiner ganz persönlichen Bewertung.",
              "The best of more than a century of cinema and television – weighted by critics, audiences, box office and popularity. With localized titles, original names and your very own rating.",
            )}
          </p>
        </div>

        <div>
          <p className="eyebrow">{t("Entdecken", "Discover")}</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link className="hover:text-cream" href="/filme">{t("Alle Filme", "All films")}</Link></li>
            <li><Link className="hover:text-cream" href="/serien">{t("Alle Serien", "All series")}</Link></li>
            <li><Link className="hover:text-cream" href="/entdecken">{t("Neu entdecken", "Discover new")}</Link></li>
            <li><Link className="hover:text-cream" href="/jahre">{t("Nach Jahr", "By year")}</Link></li>
            <li><Link className="hover:text-cream" href="/genres">{t("Nach Genre", "By genre")}</Link></li>
            <li><Link className="hover:text-cream" href="/listen">{t("Eigene Listen", "Your lists")}</Link></li>
            <li><Link className="hover:text-cream" href="/meine-liste">{t("Meine Liste", "My list")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow">{t("Verwaltung", "Admin")}</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li><Link className="hover:text-cream" href="/admin">{t("Titel bearbeiten", "Edit titles")}</Link></li>
            <li><Link className="hover:text-cream" href="/admin?tab=hinzufuegen">{t("Titel hinzufügen", "Add titles")}</Link></li>
            <li><Link className="hover:text-cream" href="/admin?tab=import">{t("Import & Export", "Import & export")}</Link></li>
            <li><Link className="hover:text-cream" href="/admin?tab=einstellungen">{t("Einstellungen", "Settings")}</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line-soft">
        <div className="container-page flex flex-col gap-2 py-5 text-[11px] text-muted-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t(
              "Film- und Seriendaten sowie Poster stammen von TMDB. Demo-Daten sind gekennzeichnet und nur als Startpunkte gedacht.",
              "Film and series data and posters come from TMDB. Demo data is marked and intended only as a starting point.",
            )}
          </p>
          <p>{t("Privates Projekt", "Private project")} · {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}
