import type { Metadata } from "next";
import { AccountsHeader } from "@/components/app/accounts/accounts-header";
import { TradersTable } from "@/components/app/accounts/accounts-tables";
import { AmountsLine, BalanceBand } from "@/components/app/accounts/balance-band";
import { NewTraderButton } from "@/components/app/accounts/new-trader-button";
import { TradersFilters } from "@/components/app/accounts/traders-filters";
import { db } from "@/db";
import { listTraderAccounts } from "@/features/accounts/queries";
import { getKindTotals } from "@/features/ledger/balances";
import { requireSession } from "@/lib/auth";
import { tradersText } from "@/lib/format";

export const metadata: Metadata = { title: "حسابات التجار" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function TradersAccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    await requireSession();
    const sp = await searchParams;
    const q = one(sp.q)?.trim().slice(0, 100) || undefined;
    const debtsOnly = one(sp.debts) === "1";
    const [rows, totals] = await Promise.all([listTraderAccounts(db, { q, debtsOnly }), getKindTotals(db, "trader")]);
    const filtered = !!(q || debtsOnly);

    return (
        <div className="flex flex-col gap-8">
            <AccountsHeader current="traders" description="رصيد كل تاجر بالدولار والدينار، الأكثر ديناً أولاً." actions={<NewTraderButton />} />
            <BalanceBand
                title="المجموع"
                items={[
                    { label: "مجموع ما على التجار", value: <AmountsLine amounts={totals.positive} tone="text-error-primary" /> },
                    { label: "مجموع ما للتجار عندنا", value: <AmountsLine amounts={totals.negative} tone="text-success-primary" /> },
                ]}
            />
            <section aria-labelledby="traders-title" className="flex flex-col gap-4">
                <h2 id="traders-title" className="sr-only">
                    التجار
                </h2>
                <TradersFilters q={q} debtsOnly={debtsOnly} />
                {rows.length ? (
                    <>
                        <TradersTable rows={rows} />
                        <p className="text-sm text-tertiary">{tradersText(rows.length)}</p>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 border-y border-secondary py-16 text-center">
                        <p className="text-lg font-semibold text-primary">{filtered ? "لا يوجد تاجر يطابق البحث" : "لا يوجد تجار بعد"}</p>
                        <p className="text-md text-tertiary">
                            {filtered ? "جرّب اسماً آخر، أو أزل «عليهم ديون فقط»." : "أضف التاجر من هنا، أو من نموذج الحاوية عند تسجيل أول حاوية له."}
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
