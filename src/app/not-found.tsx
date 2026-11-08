import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { tr } from "@/lib/locale";

export default async function NotFound() {
  const locale = await getLocale();
  const t = (de: string, en: string) => tr(locale, de, en);
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-full border border-line bg-surface-2">
        <Clapperboard className="size-6 text-gold" />
      </span>
      <p className="eyebrow mt-6">{t("Fehler 404", "Error 404")}</p>
      <h1 className="display mt-3 text-4xl text-cream sm:text-5xl">
        {t("Diese Szene gibt es nicht.", "This scene does not exist.")}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        {t(
          "Der Titel wurde nicht gefunden – vielleicht wurde er gelöscht oder die URL ist nicht ganz richtig.",
          "The title could not be found – it may have been deleted or the URL is not quite right.",
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/filme" className="btn-primary">
          {t("Zum Archiv", "To the archive")}
        </Link>
        <Link href="/" className="btn-ghost">
          {t("Zur Startseite", "Back to home")}
        </Link>
      </div>
    </div>
  );
}
