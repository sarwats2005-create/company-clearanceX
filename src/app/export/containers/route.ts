import { db } from "@/db";
import { parseListParams } from "@/features/containers/list-params";
import { type ContainerRow, listContainers } from "@/features/containers/queries";
import { containersSheet } from "@/features/exports/sheets";
import { xlsxResponse } from "@/features/exports/workbook";
import { requireSession } from "@/lib/auth";
import { containersText, formatDate, todayISO } from "@/lib/format";

const PAGE = 200;
const MAX_PAGES = 100;

/** "تصدير Excel" on the containers list (PRD §8.4): every container of the current filter, in the list's order. */
export async function GET(request: Request) {
    await requireSession();
    const filters = parseListParams(Object.fromEntries(new URL(request.url).searchParams));
    const rows: ContainerRow[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await listContainers(db, { ...filters, page, pageSize: PAGE });
        rows.push(...res.rows);
        if (rows.length >= res.total || res.rows.length < PAGE) break;
    }
    const filtered = !!(filters.q || filters.statuses || filters.traderId || filters.shippingLineId || filters.from || filters.to || filters.lateOnly);
    const today = todayISO();
    return xlsxResponse(
        containersSheet(rows, `${filtered ? "حسب التصفية" : "كل الحاويات"} · ${containersText(rows.length)} · ${formatDate(today)}`),
        `containers-${today}.xlsx`,
    );
}
