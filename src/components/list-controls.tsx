"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Grid2x2, Grid3x3, LayoutGrid, Loader2 } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import {
  ALL_PAGE_SIZE,
  GRID_LAYOUTS,
  MAX_PAGE_SIZE,
  type GridLayout,
} from "@/lib/layout";

const LAYOUT_META: Record<
  GridLayout,
  { de: string; en: string; icon: typeof LayoutGrid }
> = {
  compact: { de: "Kompakt", en: "Compact", icon: Grid3x3 },
  standard: { de: "Standard", en: "Standard", icon: LayoutGrid },
  large: { de: "Groß", en: "Large", icon: Grid2x2 },
};

export function ListControls({
  basePath,
  params,
  pageSize,
  pageSizeOptions,
  layout,
  sizeParam = "size",
  layoutParam = "view",
  sizeLabel,
  maxPageSize = MAX_PAGE_SIZE,
  allowAll = true,
  className,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  pageSize: number;
  pageSizeOptions: readonly number[];
  layout?: GridLayout;
  sizeParam?: string;
  layoutParam?: string;
  sizeLabel?: { de: string; en: string };
  maxPageSize?: number;
  allowAll?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const preset = pageSize > 0 && pageSizeOptions.includes(pageSize);
  const [custom, setCustom] = useState(
    pageSize > 0 && !preset ? String(pageSize) : "",
  );

  function navigate(patch: Record<string, string | undefined>) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    // Changing the view should always start at the first page.
    search.delete("page");
    const query = search.toString();
    startTransition(() => {
      router.push(query ? `${basePath}?${query}` : basePath);
    });
  }

  function applyCustom(raw = custom) {
    const parsed = Math.round(Number(raw));
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const size = Math.min(maxPageSize, Math.max(1, parsed));
    setCustom(String(size));
    navigate({ [sizeParam]: String(size) });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-muted-2",
        pending && "opacity-60",
        className,
      )}
    >
      <label className="inline-flex items-center gap-2">
        <span className="whitespace-nowrap">
          {sizeLabel ? t(sizeLabel.de, sizeLabel.en) : t("Pro Seite", "Per page")}
        </span>
        <select
          value={pageSize === ALL_PAGE_SIZE ? "all" : String(pageSize)}
          onChange={(event) =>
            navigate({ [sizeParam]: event.target.value })
          }
          className="h-8 rounded-full border border-line bg-surface-2/70 pl-2.5 pr-7 text-[11px] text-cream focus:border-gold/50 focus:outline-none"
          aria-label={t("Einträge pro Seite", "Items per page")}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={String(option)}>
              {option}
            </option>
          ))}
          {pageSize > 0 && !preset ? (
            <option value={String(pageSize)}>{pageSize}</option>
          ) : null}
          {allowAll ? (
            <option value="all">{t("Alle", "All")}</option>
          ) : null}
        </select>
      </label>

      <label className="inline-flex items-center gap-1.5">
        <span className="whitespace-nowrap">{t("Eigene", "Custom")}</span>
        <input
          type="number"
          min={1}
          max={maxPageSize}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyCustom();
            }
          }}
          onBlur={() => {
            if (custom.trim()) applyCustom();
          }}
          placeholder={t("z. B. 50", "e.g. 50")}
          className="h-8 w-16 [appearance:textfield] rounded-full border border-line bg-surface-2/70 px-2.5 text-[11px] text-cream placeholder:text-muted-2/60 focus:border-gold/50 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label={t("Eigene Anzahl pro Seite", "Custom items per page")}
        />
        <button
          type="button"
          onClick={() => applyCustom()}
          disabled={!custom.trim()}
          className="flex size-7 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-30"
          title={t("Eigene Anzahl übernehmen", "Apply custom size")}
        >
          <Check className="size-3" />
        </button>
      </label>

      {layout ? (
        <div className="inline-flex items-center gap-1.5">
          <span className="whitespace-nowrap">{t("Ansicht", "View")}</span>
          <div
            role="group"
            aria-label={t("Darstellung wählen", "Choose layout")}
            className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2/70 p-0.5"
          >
            {GRID_LAYOUTS.map((entry) => {
              const meta = LAYOUT_META[entry];
              const Icon = meta.icon;
              const active = entry === layout;
              return (
                <button
                  key={entry}
                  type="button"
                  onClick={() =>
                    navigate({
                      [layoutParam]: entry === "standard" ? "" : entry,
                    })
                  }
                  aria-pressed={active}
                  title={t(meta.de, meta.en)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors",
                    active
                      ? "bg-gold/15 text-gold"
                      : "text-muted hover:bg-white/[0.04] hover:text-cream",
                  )}
                >
                  <Icon className="size-3" />
                  <span className="hidden sm:inline">{t(meta.de, meta.en)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {pending ? (
        <Loader2 className="size-3.5 animate-spin text-muted-2" aria-hidden />
      ) : null}
    </div>
  );
}
