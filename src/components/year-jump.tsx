"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useT } from "@/components/i18n-provider";

export function YearJump({
  years,
  current,
  basePath = "/jahre",
  listId,
}: {
  years: number[];
  current?: number;
  basePath?: string;
  listId?: number | null;
}) {
  const router = useRouter();
  const t = useT();
  const [year, setYear] = useState(current ? String(current) : "");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!year) return;
    const query = listId ? `?list=${listId}` : "";
    router.push(`${basePath}/${year}${query}`);
  }

  return (
    <form
      onSubmit={submit}
      className="surface-card flex flex-wrap items-end gap-3 p-4"
    >
      <label className="min-w-40 flex-1">
        <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-muted-2">
          {t("Direkt zu einem Jahrgang", "Jump to a year")}
        </span>
        <select
          value={year}
          onChange={(event) => setYear(event.target.value)}
          className="input-base h-10"
        >
          <option value="">{t("Jahr wählen …", "Choose year …")}</option>
          {years.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={!year}
        className="btn-primary h-10 px-4 text-xs"
      >
        {t("Jahr öffnen", "Open year")}
        <ArrowRight className="size-3.5" />
      </button>
    </form>
  );
}
