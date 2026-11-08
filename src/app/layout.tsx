import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/locale";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: {
      default: pick(
        locale,
        "Filmgold – Die besten Filme & Serien aller Zeiten",
        "Filmgold – The greatest films & series of all time",
      ),
      template: "%s · Filmgold",
    },
    description: pick(
      locale,
      "Eine kuratierte Übersicht der besten Filme und Serien aller Zeiten – nach Kritik, Publikum, Box Office und Popularität. Mit deutschen und Originaltiteln, Bewertungen und persönlicher Liste.",
      "A curated guide to the greatest films and series of all time – weighted by critics, audiences, box office and popularity. With original titles, ratings and your personal list.",
    ),
    applicationName: "Filmgold",
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    keywords: pick(
      locale,
      [
        "beste Filme",
        "beste Serien",
        "Filmranking",
        "Serienranking",
        "Kino",
        "Kritiker",
        "Box Office",
        "Filmliste",
        "Serienliste",
      ],
      [
        "best films",
        "best series",
        "movie ranking",
        "series ranking",
        "cinema",
        "critics",
        "box office",
        "movie list",
        "series list",
      ],
    ),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-cream">
        <I18nProvider locale={locale}>
          <Suspense fallback={null}>
            <SiteHeader />
          </Suspense>
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
