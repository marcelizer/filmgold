"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  FileJson,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { useLocale, useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import {
  EXPORT_FIELDS,
  EXPORT_FIELD_KEYS,
  EXPORT_GROUP_LABELS,
  defaultExportFields,
  exportLabel,
  type ExportFieldGroup,
  type ExportFieldKey,
} from "@/lib/export-fields";
import { pick } from "@/lib/locale";

type PreviewData = {
  count: number;
  columns: { key: string; label: string }[];
  rows: string[][];
  truncated: boolean;
  limit: number;
};

type ExportPreset = {
  id: string;
  name: string;
  fields: ExportFieldKey[];
  media: string;
  seen: string;
  listId: string;
  year: string;
  q: string;
  lang: "de" | "en";
  savedAt: number;
};

const GROUPS: ExportFieldGroup[] = ["basis", "details", "personal", "technical"];
const PRESET_KEY = "filmgold_export_presets_v1";

function isExportPreset(value: unknown): value is ExportPreset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Partial<ExportPreset>;
  return (
    typeof preset.id === "string" &&
    typeof preset.name === "string" &&
    Array.isArray(preset.fields)
  );
}

export function ExportBuilder({
  lists,
}: {
  lists: { id: number; name: string; count: number }[];
}) {
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState<Set<ExportFieldKey>>(
    () => new Set(defaultExportFields()),
  );
  const [media, setMedia] = useState("all");
  const [seen, setSeen] = useState("all");
  const [listId, setListId] = useState("");
  const [year, setYear] = useState("");
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"de" | "en">("de");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<ExportPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetId, setPresetId] = useState("");
  const [presetMessage, setPresetMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PRESET_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        // Hydration-safe: presets are only read after mount from local storage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPresets(parsed.filter(isExportPreset));
      }
    } catch {
      /* Ignore broken local storage content. */
    }
  }, []);

  const selectedFields = useMemo(
    () =>
      EXPORT_FIELDS.filter((field) => selected.has(field.key)).map(
        (field) => field.key,
      ),
    [selected],
  );

  function touch() {
    if (preview) setStale(true);
  }

  function toggle(key: ExportFieldKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    touch();
  }

  function setPreset(mode: "all" | "default" | "none") {
    if (mode === "all") {
      setSelected(new Set(EXPORT_FIELDS.map((field) => field.key)));
    } else if (mode === "none") {
      setSelected(new Set());
    } else {
      setSelected(new Set(defaultExportFields()));
    }
    touch();
  }

  function query(extra: Record<string, string>) {
    const params = new URLSearchParams({
      lang,
      media,
      seen,
      fields: selectedFields.join(","),
      ...extra,
    });
    if (listId) params.set("listId", listId);
    if (year.trim()) params.set("year", year.trim());
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }

  async function loadPreview() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/export?${query({ format: "preview" })}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          t(
            `Vorschau fehlgeschlagen (${response.status}).`,
            `Preview failed (${response.status}).`,
          ),
        );
      }
      const data = (await response.json()) as PreviewData;
      setPreview(data);
      setStale(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("Vorschau fehlgeschlagen.", "Preview failed."),
      );
    } finally {
      setPending(false);
    }
  }

  function download(format: "csv" | "xlsx" | "pdf" | "json") {
    if (selectedFields.length === 0) {
      setError(
        t(
          "Bitte mindestens ein Feld auswählen.",
          "Please select at least one field.",
        ),
      );
      return;
    }
    setError(null);
    const anchor = document.createElement("a");
    anchor.href = `/api/export?${query({ format })}`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function persistPresets(next: ExportPreset[]) {
    setPresets(next);
    try {
      window.localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    } catch {
      /* Local storage may be unavailable (private mode). */
    }
  }

  function savePreset() {
    if (selectedFields.length === 0) {
      setError(
        t(
          "Bitte mindestens ein Feld auswählen.",
          "Please select at least one field.",
        ),
      );
      return;
    }
    const name =
      presetName.trim() ||
      t(`Preset ${presets.length + 1}`, `Preset ${presets.length + 1}`);
    const preset: ExportPreset = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      fields: selectedFields,
      media,
      seen,
      listId,
      year,
      q,
      lang,
      savedAt: Date.now(),
    };
    persistPresets([...presets, preset]);
    setPresetName("");
    setPresetId(preset.id);
    setPresetMessage(
      t(`Preset „${name}“ gespeichert.`, `Preset “${name}” saved.`),
    );
    setError(null);
  }

  function applyPreset() {
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    const known = new Set<string>(EXPORT_FIELD_KEYS);
    const fields = preset.fields.filter((field): field is ExportFieldKey =>
      known.has(field),
    );
    setSelected(new Set(fields));
    setMedia(preset.media ?? "all");
    setSeen(preset.seen ?? "all");
    setListId(preset.listId ?? "");
    setYear(preset.year ?? "");
    setQ(preset.q ?? "");
    setLang(preset.lang === "en" ? "en" : "de");
    touch();
    setPresetMessage(
      t(`Preset „${preset.name}“ geladen.`, `Preset “${preset.name}” loaded.`),
    );
    setError(null);
  }

  function deletePreset() {
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    persistPresets(presets.filter((entry) => entry.id !== presetId));
    setPresetId("");
    setPresetMessage(
      t(`Preset „${preset.name}“ gelöscht.`, `Preset “${preset.name}” deleted.`),
    );
  }

  const coverIndex =
    preview?.columns.findIndex((column) => column.key === "posterUrl") ?? -1;

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-gold">
            <FileSpreadsheet className="size-4" />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em]">
              Export
            </p>
          </div>
          <h2 className="mt-2 text-base font-medium text-cream">
            {t(
              "Tabelle zusammenstellen und herunterladen",
              "Build a table and download it",
            )}
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            {t(
              "Wähle Felder und Filter, prüfe die Vorschau und exportiere als CSV, Excel (XLSX), PDF oder JSON. Cover werden als TMDB-Link ausgegeben.",
              "Choose fields and filters, check the preview and export as CSV, Excel (XLSX), PDF or JSON. Covers are exported as TMDB links.",
            )}
          </p>
        </div>
        <span className="chip">
          {selectedFields.length} / {EXPORT_FIELDS.length}{" "}
          {t("Feldern", "fields")}
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-line-soft bg-surface-2/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
              {t("Felder", "Fields")}
            </p>
            <div className="flex gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => setPreset("default")}
                className="text-muted hover:text-cream"
              >
                {t("Standard", "Default")}
              </button>
              <span className="text-line">·</span>
              <button
                type="button"
                onClick={() => setPreset("all")}
                className="text-muted hover:text-cream"
              >
                {t("Alle", "All")}
              </button>
              <span className="text-line">·</span>
              <button
                type="button"
                onClick={() => setPreset("none")}
                className="text-muted hover:text-cream"
              >
                {t("Keine", "None")}
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-4">
            {GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-gold/80">
                  {pick(
                    locale,
                    EXPORT_GROUP_LABELS[group].de,
                    EXPORT_GROUP_LABELS[group].en,
                  )}
                </p>
                <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {EXPORT_FIELDS.filter(
                    (field) => field.group === group,
                  ).map((field) => {
                    const active = selected.has(field.key);
                    return (
                      <label
                        key={field.key}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] transition-colors",
                          active ? "text-cream" : "text-muted hover:text-cream",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggle(field.key)}
                          className="size-3.5 rounded border-line bg-surface-2 accent-[#c9a227]"
                        />
                        {exportLabel(field, locale)}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-line-soft bg-surface-2/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
                {t("Presets", "Presets")}
              </p>
              {presetMessage ? (
                <span className="text-[10px] text-moss">{presetMessage}</span>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder={t("Name des Presets", "Preset name")}
                className="input-base h-8 flex-1 text-[11px]"
              />
              <button
                type="button"
                onClick={savePreset}
                className="btn-ghost h-8 px-3 text-[11px]"
              >
                <Save className="size-3" />
                {t("Speichern", "Save")}
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <select
                value={presetId}
                onChange={(event) => setPresetId(event.target.value)}
                className="input-base h-8 flex-1 text-[11px]"
                aria-label={t("Gespeicherte Presets", "Saved presets")}
              >
                <option value="">
                  {presets.length > 0
                    ? t("Preset wählen …", "Choose preset …")
                    : t("Noch keine Presets", "No presets yet")}
                </option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyPreset}
                disabled={!presetId}
                className="btn-ghost h-8 px-3 text-[11px]"
              >
                {t("Laden", "Load")}
              </button>
              <button
                type="button"
                onClick={deletePreset}
                disabled={!presetId}
                className="btn-quiet h-8 border border-line px-2 text-rust hover:text-rust"
                title={t("Preset löschen", "Delete preset")}
                aria-label={t("Preset löschen", "Delete preset")}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-2">
              {t(
                "Presets speichern Felder, Filter und Tabellensprache lokal in diesem Browser.",
                "Presets store fields, filters and table language locally in this browser.",
              )}
            </p>
          </div>

          <div className="rounded-xl border border-line-soft bg-surface-2/30 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
              {t("Filter", "Filters")}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] text-muted-2">
                  {t("Medium", "Medium")}
                </span>
                <select
                  value={media}
                  onChange={(event) => {
                    setMedia(event.target.value);
                    touch();
                  }}
                  className="input-base h-9 text-xs"
                >
                  <option value="all">
                    {t("Filme & Serien", "Movies & series")}
                  </option>
                  <option value="movie">{t("Nur Filme", "Movies only")}</option>
                  <option value="serie">{t("Nur Serien", "Series only")}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] text-muted-2">
                  {t("Gesehen", "Seen")}
                </span>
                <select
                  value={seen}
                  onChange={(event) => {
                    setSeen(event.target.value);
                    touch();
                  }}
                  className="input-base h-9 text-xs"
                >
                  <option value="all">{t("Alle", "All")}</option>
                  <option value="seen">{t("Nur gesehene", "Seen only")}</option>
                  <option value="unseen">
                    {t("Nur ungesehene", "Unseen only")}
                  </option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] text-muted-2">
                  {t("Liste", "List")}
                </span>
                <select
                  value={listId}
                  onChange={(event) => {
                    setListId(event.target.value);
                    touch();
                  }}
                  className="input-base h-9 text-xs"
                >
                  <option value="">{t("Alle Listen", "All lists")}</option>
                  {lists.map((list) => (
                    <option key={list.id} value={String(list.id)}>
                      {list.name} ({list.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] text-muted-2">
                  {t("Jahr", "Year")}
                </span>
                <input
                  value={year}
                  onChange={(event) => {
                    setYear(event.target.value);
                    touch();
                  }}
                  inputMode="numeric"
                  placeholder={t("z. B. 1999", "e.g. 1999")}
                  className="input-base h-9 text-xs"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] text-muted-2">
                  {t("Suche", "Search")}
                </span>
                <input
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value);
                    touch();
                  }}
                  placeholder={t(
                    "Titel, Originaltitel, Regie …",
                    "Title, original title, director …",
                  )}
                  className="input-base h-9 text-xs"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] text-muted-2">
                  {t("Sprache der Tabelle", "Table language")}
                </span>
                <select
                  value={lang}
                  onChange={(event) => {
                    setLang(event.target.value as "de" | "en");
                    touch();
                  }}
                  className="input-base h-9 text-xs"
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-line-soft bg-surface-2/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-2">
                {t("Vorschau", "Preview")}
              </p>
              <button
                type="button"
                onClick={loadPreview}
                disabled={pending || selectedFields.length === 0}
                className="btn-ghost h-8 px-3 text-[11px]"
              >
                {pending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Eye className="size-3" />
                )}
                {t("Vorschau laden", "Load preview")}
              </button>
            </div>
            {preview ? (
              <p className="mt-2 text-[11px] text-muted">
                <span className="text-cream">{preview.count}</span>{" "}
                {preview.count === 1 ? t("Titel", "title") : t("Titel", "titles")}
                {stale ? (
                  <span className="ml-2 text-gold">
                    ·{" "}
                    {t(
                      "Filter geändert, Vorschau aktualisieren",
                      "Filters changed, refresh preview",
                    )}
                  </span>
                ) : null}
                {preview.truncated
                  ? t(
                      ` · erste ${preview.limit} Zeilen angezeigt`,
                      ` · showing the first ${preview.limit} rows`,
                    )
                  : ""}
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-muted-2">
                {t(
                  "Zeigt die Tabelle, bevor du sie herunterlädst.",
                  "Shows the table before you download it.",
                )}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => download("csv")}
              className="btn-ghost h-9 justify-start px-3 text-xs"
            >
              <FileText className="size-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => download("xlsx")}
              className="btn-primary h-9 justify-start px-3 text-xs"
            >
              <FileSpreadsheet className="size-3.5" /> Excel (XLSX)
            </button>
            <button
              type="button"
              onClick={() => download("pdf")}
              className="btn-ghost h-9 justify-start px-3 text-xs"
            >
              <FileText className="size-3.5" /> PDF
            </button>
            <button
              type="button"
              onClick={() => download("json")}
              className="btn-ghost h-9 justify-start px-3 text-xs"
            >
              <FileJson className="size-3.5" /> JSON
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-2">
            {t(
              "CSV nutzt Semikolon und UTF-8 (Excel-kompatibel). XLSX enthält eine fixierte Kopfzeile und Filter. PDF ist auf Querformat optimiert.",
              "CSV uses semicolons and UTF-8 (Excel-compatible). XLSX has a frozen header row and filters. PDF is optimised for landscape.",
            )}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2 text-xs text-[#f0a08e]">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-line-soft">
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full min-w-max border-collapse text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-surface-2">
                <tr>
                  <th className="border-b border-line px-2 py-2 text-[9px] uppercase tracking-[0.12em] text-muted-2">
                    #
                  </th>
                  {preview.columns.map((column) => (
                    <th
                      key={column.key}
                      className="whitespace-nowrap border-b border-line px-2 py-2 text-[9px] font-medium uppercase tracking-[0.12em] text-gold/85"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={rowIndex % 2 ? "bg-white/[0.015]" : ""}
                  >
                    <td className="whitespace-nowrap border-b border-line-soft/50 px-2 py-1.5 tabular-nums text-muted-2">
                      {rowIndex + 1}
                    </td>
                    {row.map((value, columnIndex) => (
                      <td
                        key={columnIndex}
                        className={cn(
                          "max-w-[280px] border-b border-line-soft/50 px-2 py-1.5 text-cream/85",
                          columnIndex === coverIndex && "w-12",
                        )}
                      >
                        {columnIndex === coverIndex && value ? (
                          <span className="flex items-center gap-1.5 text-muted-2">
                            <ImageIcon className="size-3 shrink-0 text-gold/70" />
                            <span className="truncate" title={value}>
                              {value.split("/").pop()}
                            </span>
                          </span>
                        ) : (
                          <span className="line-clamp-2">{value || "–"}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted">
              {t(
                "Keine Titel für diese Auswahl.",
                "No titles for this selection.",
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
