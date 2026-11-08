import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { rowsToCsv } from "@/lib/csv";
import { buildExportData, type ExportFilters } from "@/lib/export";
import { getLocale } from "@/lib/i18n-server";
import { isLocale, type Locale } from "@/lib/locale";
import type { MediaType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Format = "preview" | "csv" | "json" | "xlsx" | "pdf";

function single(url: URL, key: string) {
  return url.searchParams.get(key) ?? "";
}

function parseRequest(url: URL, locale: Locale) {
  const mediaRaw = single(url, "media");
  const media: ExportFilters["media"] =
    mediaRaw === "movie" || mediaRaw === "serie" ? (mediaRaw as MediaType) : "all";
  const seenRaw = single(url, "seen");
  const seen: ExportFilters["seen"] =
    seenRaw === "seen" || seenRaw === "unseen" ? seenRaw : "all";
  const listRaw = Number(single(url, "listId"));
  const yearRaw = Number(single(url, "year"));
  return {
    locale,
    fields: single(url, "fields") || undefined,
    media,
    seen,
    listId: Number.isFinite(listRaw) && listRaw > 0 ? listRaw : undefined,
    q: single(url, "q") || undefined,
    genre: single(url, "genre") || undefined,
    year: Number.isFinite(yearRaw) && yearRaw > 1800 ? yearRaw : undefined,
  };
}

function fileBase() {
  return `filmgold-export-${new Date().toISOString().slice(0, 10)}`;
}

function filenameResponse(
  body: BodyInit,
  contentType: string,
  filename: string,
) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function buildXlsx(
  columns: { key: string; label: string }[],
  rows: string[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Filmgold";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Filmgold", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((column, index) => {
    const longest = Math.max(
      column.label.length,
      ...rows.slice(0, 250).map((row) => (row[index] ?? "").length),
    );
    return {
      header: column.label,
      key: column.key,
      width: Math.min(48, Math.max(10, longest + 2)),
    };
  });
  sheet.addRows(rows);

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF16130B" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC9A227" },
  };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildPdf(
  columns: { key: string; label: string }[],
  rows: string[][],
  locale: Locale,
): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const date = new Date().toLocaleDateString(locale === "en" ? "en-US" : "de-DE");
  const title = locale === "en" ? "Filmgold export" : "Filmgold Export";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 24, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(
    locale === "en"
      ? `${rows.length} titles · ${date}`
      : `${rows.length} Titel · ${date}`,
    24,
    46,
  );

  autoTable(doc, {
    startY: 58,
    head: [columns.map((column) => column.label)],
    body: rows,
    margin: { left: 24, right: 24, top: 34, bottom: 30 },
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: 3,
      overflow: "linebreak",
      textColor: [30, 30, 30],
      lineColor: [225, 222, 212],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [201, 162, 39],
      textColor: [22, 19, 11],
      fontStyle: "bold",
      fontSize: 6.8,
    },
    alternateRowStyles: { fillColor: [247, 244, 235] },
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(`${page}`, width - 30, doc.internal.pageSize.getHeight() - 14);
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const formatRaw = single(url, "format") as Format;
  const format: Format = ["preview", "csv", "json", "xlsx", "pdf"].includes(
    formatRaw,
  )
    ? formatRaw
    : "csv";
  const langRaw = single(url, "lang");
  const locale = isLocale(langRaw) ? langRaw : await getLocale();
  const data = buildExportData(parseRequest(url, locale));
  const base = fileBase();

  if (format === "preview") {
    const limit = 300;
    return NextResponse.json({
      count: data.count,
      columns: data.columns,
      rows: data.rows.slice(0, limit),
      truncated: data.count > limit,
      limit,
    });
  }

  if (format === "json") {
    return filenameResponse(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          locale,
          count: data.count,
          fields: data.columns,
          rows: data.records,
        },
        null,
        2,
      ),
      "application/json; charset=utf-8",
      `${base}.json`,
    );
  }

  if (format === "xlsx") {
    const buffer = await buildXlsx(data.columns, data.rows);
    return filenameResponse(
      new Uint8Array(buffer),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `${base}.xlsx`,
    );
  }

  if (format === "pdf") {
    const buffer = buildPdf(data.columns, data.rows, locale);
    return filenameResponse(
      new Uint8Array(buffer),
      "application/pdf",
      `${base}.pdf`,
    );
  }

  return filenameResponse(
    rowsToCsv(
      data.columns.map((column) => column.label),
      data.rows,
      ";",
    ),
    "text/csv; charset=utf-8",
    `${base}.csv`,
  );
}
