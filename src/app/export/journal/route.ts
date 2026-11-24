import { db } from "@/db";
import { journalSheet } from "@/features/exports/sheets";
import { xlsxResponse } from "@/features/exports/workbook";
import { parseJournalParams } from "@/features/money/journal-params";
import { type JournalRow, listJournal } from "@/features/money/queries";
import { requireSession } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/format";

const MAX_PAGES = 200;

/** "تصدير Excel" on سجل المعاملات (US-15): every receipt of the current filter, newest first. */
export async function GET(request: Request) {
    await requireSession();
    const params = parseJournalParams(Object.fromEntries(new URL(request.url).searchParams));
    const rows: JournalRow[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await listJournal(db, { ...params, page });
        rows.push(...res.rows);
        if (rows.length >= res.total || res.rows.length < res.pageSize) break;
    }
    const filtered = !!(params.q || params.kind || params.from || params.to);
    const today = todayISO();
    return xlsxResponse(journalSheet(rows, `${filtered ? "حسب التصفية" : "كل المعاملات"} · ${formatDate(today)}`), `journal-${today}.xlsx`);
}
