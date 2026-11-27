import { db } from "@/db";
import { ACCOUNT_SEGMENTS, LEDGER_KIND, defaultCurrency, parseStatementParams, rangeText } from "@/features/accounts/model";
import { getStatementTarget } from "@/features/accounts/queries";
import { statementSheet } from "@/features/exports/sheets";
import { xlsxResponse } from "@/features/exports/workbook";
import { getStatement } from "@/features/ledger/statements";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { isUuid } from "@/lib/ids";

/** A statement as Excel (PRD §8.8): the same range and currency as on screen. */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
    await requireSession();
    const { kind, id } = await params;
    const segment = ACCOUNT_SEGMENTS.find((s) => s === kind);
    if (!segment || !isUuid(id)) return new Response("Not found", { status: 404 });
    const target = await getStatementTarget(db, segment, id);
    if (!target) return new Response("Not found", { status: 404 });

    const today = todayISO();
    const p = parseStatementParams(Object.fromEntries(new URL(request.url).searchParams), today);
    const currency = defaultCurrency(target.currencies, target.balance, p.currency);
    const st = await getStatement(db, { kind: LEDGER_KIND[segment], refId: id }, currency, p.from, p.to);
    const vault = segment === "vaults";
    return xlsxResponse(
        statementSheet(st, {
            title: `${vault ? "كشف حركة" : "كشف حساب"} ${target.name}`,
            range: rangeText(p.from, p.to),
            currency,
            mode: vault ? "vault" : "account",
            withOpening: !!p.from,
        }),
        `statement-${today}.xlsx`,
    );
}
