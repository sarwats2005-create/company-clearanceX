import ExcelJS from "exceljs";
import type { Currency } from "@/db/schema";

/** A cell: text, a plain number, a date (yyyy-mm-dd) or an amount in one currency. */
export type Cell = string | number | null | { date: string } | { money: string; currency: Currency };

export interface SheetSpec {
    /** Worksheet tab name (Excel allows 31 characters). */
    name: string;
    title: string;
    subtitle?: string;
    columns: { header: string; width: number }[];
    rows: Cell[][];
    footer?: Cell[];
}

const MONEY_FORMAT: Record<Currency, string> = { IQD: '#,##0 "د.ع";-#,##0 "د.ع"', USD: '#,##0.00 "$";-#,##0.00 "$"' };
const HEADER_ROW = 4;

function write(cell: ExcelJS.Cell, v: Cell) {
    if (v === null) return;
    if (typeof v === "object" && "date" in v) {
        const [y, m, d] = v.date.split("-").map(Number);
        cell.value = new Date(Date.UTC(y, m - 1, d));
        cell.numFmt = "dd/mm/yyyy";
    } else if (typeof v === "object") {
        cell.value = Number(v.money);
        cell.numFmt = MONEY_FORMAT[v.currency];
    } else {
        cell.value = v;
    }
}

/** One right-to-left sheet: title, subtitle, a bold header (frozen), the rows, and an optional bold totals row. */
export async function buildWorkbook(spec: SheetSpec): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();
    const ws = wb.addWorksheet(spec.name.slice(0, 31), { views: [{ rightToLeft: true, state: "frozen", ySplit: HEADER_ROW }] });
    spec.columns.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));

    ws.getCell("A1").value = spec.title;
    ws.getCell("A1").font = { bold: true, size: 14 };
    if (spec.subtitle) {
        ws.getCell("A2").value = spec.subtitle;
        ws.getCell("A2").font = { color: { argb: "FF535862" } };
    }

    const header = ws.getRow(HEADER_ROW);
    spec.columns.forEach((c, i) => (header.getCell(i + 1).value = c.header));
    header.font = { bold: true };
    header.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        cell.border = { bottom: { style: "thin", color: { argb: "FFD5D7DA" } } };
    });

    spec.rows.forEach((r, i) => {
        const row = ws.getRow(HEADER_ROW + 1 + i);
        r.forEach((v, j) => write(row.getCell(j + 1), v));
    });
    if (spec.footer) {
        const row = ws.getRow(HEADER_ROW + 1 + spec.rows.length);
        spec.footer.forEach((v, j) => write(row.getCell(j + 1), v));
        row.font = { bold: true };
        row.eachCell((cell) => (cell.border = { top: { style: "thin", color: { argb: "FF181D27" } } }));
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * `attachment; filename="…"` with an ASCII name only. Chromium names a download "download" (no
 * extension) when filename* holds Arabic, so the Arabic title lives inside the sheet instead.
 */
export function contentDisposition(fileName: string): string {
    const ascii = fileName
        .replace(/[^\x20-\x7e]+/g, "")
        .replace(/[\\/:*?"<>|\s]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `attachment; filename="${ascii || "export.xlsx"}"`;
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The download response for one sheet. Never cached: it holds account data. */
export async function xlsxResponse(spec: SheetSpec, fileName: string): Promise<Response> {
    const buf = await buildWorkbook(spec);
    return new Response(new Uint8Array(buf), {
        headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": contentDisposition(fileName), "Cache-Control": "no-store" },
    });
}
