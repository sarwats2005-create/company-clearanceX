import { Settings01 } from "@untitledui/icons";
import type { Metadata } from "next";
import { AccountsHeader } from "@/components/app/accounts/accounts-header";
import { PartiesTable } from "@/components/app/accounts/accounts-tables";
import { AmountsLine, BalanceBand } from "@/components/app/accounts/balance-band";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { listPartyAccounts } from "@/features/accounts/queries";
import { getKindTotals } from "@/features/ledger/balances";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "حسابات الجهات" };

export default async function PartiesAccountsPage() {
    await requireSession();
    const [rows, totals] = await Promise.all([listPartyAccounts(db), getKindTotals(db, "party")]);

    return (
        <div className="flex flex-col gap-8">
            <AccountsHeader
                current="parties"
                description="الشركات والشركاء الذين يدفعون عنا. «له» تعني أن المبلغ لهم علينا."
                actions={
                    <Button size="lg" color="secondary" href="/settings/parties" iconLeading={<Settings01 data-icon aria-hidden="true" />}>
                        إدارة الجهات
                    </Button>
                }
            />
            <BalanceBand
                title="المجموع"
                items={[
                    { label: "المستحق للجهات علينا", value: <AmountsLine amounts={totals.negative} tone="text-success-primary" /> },
                    { label: "المستحق لنا على الجهات", value: <AmountsLine amounts={totals.positive} tone="text-error-primary" /> },
                ]}
            />
            {rows.length ? (
                <PartiesTable rows={rows} />
            ) : (
                <div className="flex flex-col items-center gap-2 border-y border-secondary py-16 text-center">
                    <p className="text-lg font-semibold text-primary">لا توجد جهات بعد</p>
                    <p className="text-md text-tertiary">أضف شركة التخليص أو الشريك من الإعدادات.</p>
                </div>
            )}
        </div>
    );
}
