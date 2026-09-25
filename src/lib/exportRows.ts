import * as XLSX from "xlsx";

export type ExportCell = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportCell>;

interface ExportOptions {
    /** Without an extension — the date is appended and ".xlsx" added. */
    fileName: string;
    sheetName?: string;
    rows: ExportRow[];
    /** Column order and headers; defaults to the keys of the first row. */
    columns?: string[];
}

/**
 * Downloads rows as an .xlsx file, client side.
 *
 * Every list in the portal used to grow its own copy of this (and most lists
 * had no export at all), so it lives here: pass plain objects keyed by the
 * column header you want, get a spreadsheet with sensible column widths.
 */
export function exportRowsToXlsx({ fileName, sheetName = "Sheet1", rows, columns }: ExportOptions) {
    if (!rows.length) return;

    const headers = columns ?? Object.keys(rows[0]);
    const body = rows.map((row) => headers.map((h) => row[h] ?? ""));
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...body]);

    // Width from the longest value in each column, so nothing shows as ####.
    sheet["!cols"] = headers.map((h, i) => ({
        wch: Math.min(
            40,
            Math.max(h.length + 2, ...body.map((r) => String(r[i] ?? "").length + 2))
        ),
    }));

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
    XLSX.writeFile(book, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Same data as a CSV, for anything that has to be re-imported elsewhere. */
export function exportRowsToCsv({ fileName, rows, columns }: Omit<ExportOptions, "sheetName">) {
    if (!rows.length) return;

    const headers = columns ?? Object.keys(rows[0]);
    const escape = (v: ExportCell) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
        headers.join(","),
        ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
    ].join("\n");

    // BOM so Excel opens Bengali text in the right encoding.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
