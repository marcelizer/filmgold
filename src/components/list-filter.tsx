"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListFilter as ListFilterIcon } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";

export function ListFilter({
  lists,
  value,
  basePath,
  params = {},
  className,
  id = "list",
}: {
  lists: { id: number; name: string; count: number }[];
  value: string;
  basePath: string;
  params?: Record<string, string | undefined>;
  className?: string;
  id?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();

  if (lists.length === 0) return null;

  function change(next: string) {
    const search = new URLSearchParams();
    for (const [key, entry] of Object.entries(params)) {
      if (entry) search.set(key, entry);
    }
    if (next) search.set(id, next);
    const query = search.toString();
    startTransition(() => {
      router.push(query ? `${basePath}?${query}` : basePath);
    });
  }

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line bg-surface-2/70 py-1 pl-3 pr-1 text-[11px] transition-opacity",
        pending && "opacity-60",
        className,
      )}
    >
      <ListFilterIcon className="size-3.5 text-gold" aria-hidden />
      <span className="text-muted">{t("Liste", "List")}</span>
      <select
        value={value}
        onChange={(event) => change(event.target.value)}
        className="h-7 max-w-[190px] rounded-full border-0 bg-transparent pr-6 text-[11px] text-cream focus:outline-none"
        aria-label={t("Nach Liste filtern", "Filter by list")}
      >
        <option value="">{t("Alle", "All")}</option>
        {lists.map((list) => (
          <option key={list.id} value={String(list.id)}>
            {list.name} ({list.count})
          </option>
        ))}
      </select>
    </label>
  );
}
