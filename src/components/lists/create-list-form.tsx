"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Loader2, Plus } from "lucide-react";
import { createListAction } from "@/app/actions";
import { useT } from "@/components/i18n-provider";

export function CreateListForm() {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError(t("Bitte einen Listennamen eingeben.", "Please enter a list name."));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createListAction(clean, description);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setDescription("");
      setShowDescription(false);
      router.push(`/listen/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="surface-card p-5">
      <div className="flex items-center gap-2 text-gold">
        <ListPlus className="size-4" />
        <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
          {t("Neue Liste", "New list")}
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {t(
          "Sammlungen für einen Abend, ein Genre, eine Stimmung oder alles, was du irgendwann sehen willst.",
          "Collections for an evening, a genre, a mood or anything you want to watch someday.",
        )}
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder={t(
            "z. B. Science-Fiction für lange Abende",
            "e.g. Science fiction for long evenings",
          )}
          className="input-base h-10 min-w-0 flex-1"
          aria-label={t("Listenname", "List name")}
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="btn-primary h-10 shrink-0 px-4 text-xs"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          {t("Liste anlegen", "Create list")}
        </button>
      </div>

      {showDescription ? (
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={400}
          rows={2}
          placeholder={t(
            "Worum geht es in dieser Liste? (optional)",
            "What is this list about? (optional)",
          )}
          className="input-base mt-2 resize-y text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowDescription(true)}
          className="mt-2 text-[11px] text-muted-2 underline underline-offset-2 hover:text-cream"
        >
          {t("Beschreibung ergänzen", "Add description")}
        </button>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
