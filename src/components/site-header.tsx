"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Menu, Search, Settings2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MediaSwitch } from "@/components/media-switch";
import { LocaleSwitcher, useT } from "@/components/i18n-provider";
import type { MediaType } from "@/lib/types";

type NavLink = { href: string; de: string; en: string; match?: string };

const MOVIE_LINKS: NavLink[] = [
  { href: "/entdecken", de: "Entdecken", en: "Discover" },
  { href: "/jahre", de: "Jahre", en: "Years" },
  { href: "/genres", de: "Genres", en: "Genres" },
  { href: "/listen", de: "Listen", en: "Lists" },
  { href: "/meine-liste", de: "Meine Liste", en: "My list" },
];

const SERIES_LINKS: NavLink[] = [
  {
    href: "/entdecken?medium=serie",
    de: "Entdecken",
    en: "Discover",
    match: "/entdecken",
  },
  { href: "/serien/jahre", de: "Jahre", en: "Years" },
  { href: "/serien/genres", de: "Genres", en: "Genres" },
  { href: "/listen", de: "Listen", en: "Lists" },
  {
    href: "/meine-liste?medium=serie",
    de: "Meine Liste",
    en: "My list",
    match: "/meine-liste",
  },
];

function mediaFromLocation(pathname: string, medium: string | null): MediaType {
  if (pathname === "/serien" || pathname.startsWith("/serien/")) return "serie";
  if (
    medium === "serie" &&
    (pathname === "/entdecken" || pathname === "/meine-liste")
  ) {
    return "serie";
  }
  return "movie";
}

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const t = useT();
  const media = mediaFromLocation(pathname, searchParams.get("medium"));
  const rawLinks = media === "serie" ? SERIES_LINKS : MOVIE_LINKS;
  const links = rawLinks.map((link) => ({
    href: link.href,
    label: t(link.de, link.en),
    match: link.match ?? link.href,
  }));
  const searchHref = media === "serie" ? "/serien" : "/filme";
  const searchLabel = t(
    media === "serie" ? "Serie suchen …" : "Film suchen …",
    media === "serie" ? "Search series …" : "Search films …",
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-bg/85 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-5">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative flex size-7 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
            <span className="size-2 rounded-full bg-gold transition-transform group-hover:scale-125" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[13px] font-semibold tracking-[0.28em] text-cream">
              FILMGOLD
            </span>
            <span className="mt-1 hidden text-[9px] uppercase tracking-[0.18em] text-muted-2 xl:block">
              {t(
                "Die besten Filme & Serien aller Zeiten",
                "The greatest films & series of all time",
              )}
            </span>
          </span>
        </Link>

        <div className="hidden lg:block">
          <MediaSwitch current={media} compact />
        </div>

        <nav className="hidden h-full items-center gap-4 lg:flex lg:gap-5">
          {links.map((link) => {
            const active =
              pathname === link.match || pathname.startsWith(`${link.match}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative flex h-full items-center whitespace-nowrap text-[13px] transition-colors",
                  active
                    ? "text-cream"
                    : "text-muted hover:text-cream",
                )}
              >
                {link.label}
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-px bg-gold" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <form
            action={searchHref}
            className="relative hidden xl:block"
            role="search"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
            <input
              type="search"
              name="q"
              placeholder={searchLabel}
              aria-label={t("Filme durchsuchen", "Search films")}
              className="h-9 w-48 rounded-full border border-line bg-surface-2 pl-9 pr-3 text-xs text-cream placeholder:text-muted-2 focus:border-gold/50 focus:outline-none"
            />
          </form>

          <div className="hidden sm:block">
            <LocaleSwitcher compact />
          </div>

          <Link
            href="/admin"
            className={cn(
              "flex size-9 items-center justify-center rounded-full border border-transparent text-muted transition-colors hover:bg-white/[0.04] hover:text-cream",
              pathname.startsWith("/admin") && "border-line bg-white/[0.04] text-gold",
            )}
            aria-label={t("Verwaltung", "Admin")}
            title={t("Archiv verwalten", "Manage archive")}
          >
            <Settings2 className="size-4" />
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-white/[0.04] hover:text-cream lg:hidden"
            aria-label={t(
              open ? "Menü schließen" : "Menü öffnen",
              open ? "Close menu" : "Open menu",
            )}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line-soft bg-bg/95 lg:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            <MediaSwitch current={media} className="mb-2 self-start" />
            <form
              action={searchHref}
              className="relative mb-2"
              role="search"
              onSubmit={() => setOpen(false)}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
              <input
                type="search"
                name="q"
                placeholder={searchLabel}
                className="h-10 w-full rounded-lg border border-line bg-surface-2 pl-10 pr-3 text-sm text-cream placeholder:text-muted-2 focus:border-gold/50 focus:outline-none"
              />
            </form>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm",
                  pathname === link.match
                    ? "bg-white/[0.04] text-gold"
                    : "text-muted hover:bg-white/[0.03] hover:text-cream",
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-white/[0.03] hover:text-cream"
            >
              {t("Verwaltung", "Admin")}
            </Link>
            <div className="mt-2 px-3">
              <LocaleSwitcher />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
