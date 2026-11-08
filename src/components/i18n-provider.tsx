"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { setLocaleAction } from "@/app/actions";
import { cn } from "@/lib/cn";
import { LOCALES, type Locale } from "@/lib/locale";

const LocaleContext = createContext<Locale>("de");

const LABELS: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
};

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Returns a `t(de, en)` helper bound to the active locale. */
export function useT() {
  const locale = useLocale();
  return (de: string, en: string) => (locale === "en" ? en : de);
}

export function LocaleSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2/70 p-0.5",
        pending && "opacity-60",
        className,
      )}
      role="group"
      aria-label={locale === "de" ? "Sprache wählen" : "Choose language"}
    >
      <Languages
        className={cn("ml-1.5 text-muted-2", compact ? "size-3" : "size-3.5")}
        aria-hidden
      />
      {LOCALES.map((entry) => {
        const active = entry === locale;
        return (
          <button
            key={entry}
            type="button"
            onClick={() => change(entry)}
            disabled={pending}
            aria-pressed={active}
            title={LABELS[entry]}
            className={cn(
              "inline-flex items-center gap-1 rounded-full font-medium uppercase tracking-[0.08em] transition-colors",
              compact ? "h-7 px-2 text-[10px]" : "h-8 px-2.5 text-[11px]",
              active
                ? "bg-gold/15 text-gold"
                : "text-muted hover:bg-white/[0.04] hover:text-cream",
            )}
          >
            {active ? <Check className="size-2.5" /> : null}
            {entry}
          </button>
        );
      })}
    </div>
  );
}
