import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { tr, type Locale } from "@/lib/locale";

export function Pagination({
  page,
  totalPages,
  basePath,
  params,
  locale = "de",
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string | undefined>;
  locale?: Locale;
}) {
  if (totalPages <= 1) return null;

  function href(target: number) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") search.set(key, value);
    }
    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  }

  const pages: (number | "gap")[] = [];
  const push = (value: number | "gap") => {
    if (pages[pages.length - 1] !== value) pages.push(value);
  };
  for (let current = 1; current <= totalPages; current += 1) {
    if (
      current === 1 ||
      current === totalPages ||
      Math.abs(current - page) <= 1
    ) {
      push(current);
    } else if (pages[pages.length - 1] !== "gap") {
      push("gap");
    }
  }

  return (
    <nav
      className="mt-10 flex items-center justify-center gap-1.5"
      aria-label={tr(locale, "Seiten", "Pages")}
    >
      <Link
        href={href(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-gold/40 hover:text-cream",
          page === 1 && "pointer-events-none opacity-40",
        )}
        aria-label={tr(locale, "Vorherige Seite", "Previous page")}
      >
        <ChevronLeft className="size-4" />
      </Link>
      {pages.map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-xs text-muted-2">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={href(entry)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border text-xs tabular-nums transition-colors",
              entry === page
                ? "border-gold bg-gold text-[#17120a]"
                : "border-line text-muted hover:border-gold/40 hover:text-cream",
            )}
            aria-current={entry === page ? "page" : undefined}
          >
            {entry}
          </Link>
        ),
      )}
      <Link
        href={href(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-gold/40 hover:text-cream",
          page === totalPages && "pointer-events-none opacity-40",
        )}
        aria-label={tr(locale, "Nächste Seite", "Next page")}
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
