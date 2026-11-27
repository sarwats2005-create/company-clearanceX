import { ArrowCircleDown, Building07, Phone01, Settings01, Wallet02 } from "@untitledui/icons";
import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BalanceBand, ParentLink } from "@/components/app/accounts/balance-band";
import { StatementSection } from "@/components/app/accounts/statement-section";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { type Currency, parties } from "@/db/schema";
import { PARTY_KIND_LABEL, parseStatementParams } from "@/features/accounts/model";
import { getPartyAccount, getStatementTarget } from "@/features/accounts/queries";
import { type Branch, getBranch } from "@/features/branch/service";
import { type Balances, getBalances, getKindTotals } from "@/features/ledger/balances";
import { getSettingsRow } from "@/features/settings/service";
import { requireSession } from "@/lib/auth";
import { balanceSide, formatMoney, todayISO } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { cx } from "@/utils/cx";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { id } = await params;
    if (!isUuid(id)) return { title: "الجهة" };
    const [row] = await db.select({ name: parties.name }).from(parties).where(eq(parties.id, id));
    return { title: row ? `حساب ${row.name}` : "الجهة" };
}

const IN_WORDS: Record<Currency, string> = { USD: "بالدولار", IQD: "بالدينار" };

/** Party headline (PRD §6.2): "المستحق لهم علينا" (we owe them, green) or "المستحق لنا عليهم" (red). */
function partyItem(amount: string, c: Currency) {
    const side = balanceSide(amount, c);
    if (side === "settled") return { label: IN_WORDS[c], value: <span className="text-quaternary">مسدد</span> };
    return {
        label: `${side === "weOwe" ? "المستحق لهم علينا" : "المستحق لنا عليهم"} ${IN_WORDS[c]}`,
        value: <bdi className={cx("num", side === "weOwe" ? "text-success-primary" : "text-error-primary")}>{formatMoney(amount.replace(/^-/, ""), c)}</bdi>,
    };
}

/** Party page (PRD §8.8, US-18): what we owe them, a "دفع" shortcut, and the statement. */
export default async function PartyAccountPage({ params, searchParams }: { params: Params; searchParams: Search }) {
    await requireSession();
    const { id } = await params;
    if (!isUuid(id)) notFound();
    const [account, target] = await Promise.all([getPartyAccount(db, id), getStatementTarget(db, "parties", id)]);
    if (!account || !target) notFound();
    const { party, balance } = account;
    const branch = party.isBranch ? await getBranch(db) : null;
    if (branch) return <BranchPage branch={branch} party={party} balance={balance} target={target} sp={await searchParams} />;
    const owe = (["USD", "IQD"] as Currency[]).find((c) => balanceSide(balance[c], c) === "weOwe");
    const owesUs = (["USD", "IQD"] as Currency[]).find((c) => balanceSide(balance[c], c) === "owesUs");

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                icon={Building07}
                iconColor="teal"
                eyebrow={<ParentLink href="/accounts/parties">حسابات الجهات</ParentLink>}
                title={party.name}
                description={
                    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>{PARTY_KIND_LABEL[party.kind]}</span>
                        {party.phone && (
                            <a
                                href={`tel:${party.phone}`}
                                className="inline-flex items-center gap-1.5 rounded-md outline-focus-ring hover:text-secondary focus-visible:outline-2"
                            >
                                <Phone01 className="size-4 text-fg-quaternary" aria-hidden="true" />
                                <bdi className="num">{party.phone}</bdi>
                            </a>
                        )}
                        {!party.isActive && <span className="text-error-primary">موقوفة</span>}
                    </span>
                }
                actions={
                    party.isActive && (
                        <>
                            <Button
                                size="lg"
                                iconLeading={<Wallet02 data-icon aria-hidden="true" />}
                                href={`/money/new/pay-party?party=${id}${owe ? `&currency=${owe}` : ""}`}
                            >
                                دفع
                            </Button>
                            <Button
                                size="lg"
                                color="secondary"
                                iconLeading={<ArrowCircleDown data-icon aria-hidden="true" />}
                                href={`/money/new/receive-party?party=${id}${owesUs ? `&currency=${owesUs}` : ""}`}
                            >
                                استلام
                            </Button>
                        </>
                    )
                }
            />

            <BalanceBand title="الرصيد الحالي" items={[partyItem(balance.USD, "USD"), partyItem(balance.IQD, "IQD")]} />

            <StatementSection target={target} params={parseStatementParams(await searchParams, todayISO())} />

            <section aria-labelledby="party-info" className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="party-info" className="text-lg font-semibold text-primary">
                        ملاحظات
                    </h2>
                    <Button size="md" color="link-gray" iconLeading={<Settings01 data-icon aria-hidden="true" />} href="/settings/parties">
                        تعديل في الإعدادات
                    </Button>
                </div>
                <p className={cx("surface px-5 py-4 text-md whitespace-pre-line", party.notes ? "text-secondary" : "text-quaternary")}>
                    {party.notes || "لا توجد ملاحظات."}
                </p>
            </section>
        </div>
    );
}

/**
 * The owner's branch (the Umm Qasr partnership): its own vault, what customers owe it, and what it and the owner
 * owe each other, with one-tap handovers both ways.
 */
async function BranchPage({
    branch,
    party,
    balance,
    target,
    sp,
}: {
    branch: Branch;
    party: typeof parties.$inferSelect;
    balance: Balances;
    target: NonNullable<Awaited<ReturnType<typeof getStatementTarget>>>;
    sp: Record<string, string | string[] | undefined>;
}) {
    const settings = await getSettingsRow(db);
    const main = settings.defaultVaultIqdId;
    const [vault, customers, debtors] = await Promise.all([
        branch.vaultId ? getBalances(db, "vault", branch.vaultId) : null,
        getKindTotals(db, "trader_branch"),
        db.execute<{ id: string; name: string; owes: string }>(sql`
            SELECT t.id, t.name, sum(l.debit - l.credit) AS owes
              FROM accounts a JOIN journal_lines l ON l.account_id = a.id JOIN traders t ON t.id = a.ref_id
             WHERE a.kind = 'trader_branch'
             GROUP BY t.id, t.name HAVING sum(l.debit - l.credit) <> 0
             ORDER BY owes DESC LIMIT 20`),
    ]);
    const iqd = Number(balance.IQD);
    const between = iqd < 0 ? `عندك لها ${formatMoney(String(-iqd), "IQD")}` : iqd > 0 ? `هي مدينة لك بـ ${formatMoney(balance.IQD, "IQD")}` : "لا شيء";
    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                icon={Building07}
                iconColor="teal"
                eyebrow={<ParentLink href="/accounts/parties">حسابات الجهات</ParentLink>}
                title={party.name}
                description="شراكتك: لها قاصة خاصة، والتجار يدينون لها بالمصاريف التي تدفعها"
                actions={
                    branch.vaultId &&
                    main && (
                        <>
                            <Button
                                size="lg"
                                iconLeading={<ArrowCircleDown data-icon aria-hidden="true" />}
                                href={`/money/new/transfer?vault=${main}&to=${branch.vaultId}&currency=IQD`}
                            >
                                تسليم للشراكة
                            </Button>
                            <Button
                                size="lg"
                                color="secondary"
                                iconLeading={<Wallet02 data-icon aria-hidden="true" />}
                                href={`/money/new/transfer?vault=${branch.vaultId}&to=${main}&currency=IQD`}
                            >
                                استلام من الشراكة
                            </Button>
                        </>
                    )
                }
            />

            <BalanceBand
                title="الشراكة بالدينار"
                items={[
                    { label: `في ${branch.vaultName ?? "قاصتها"}`, value: <span className="num">{formatMoney(vault?.IQD ?? "0", "IQD")}</span> },
                    { label: "التجار مدينون لها", value: <span className="num">{formatMoney(customers.positive.IQD, "IQD")}</span> },
                    { label: "بينك وبينها", value: <span>{between}</span> },
                ]}
            />

            <section aria-labelledby="branch-debtors" className="flex flex-col gap-3">
                <h2 id="branch-debtors" className="text-lg font-semibold text-primary">
                    التجار المدينون للشراكة
                </h2>
                {debtors.rows.length === 0 ? (
                    <p className="surface px-5 py-4 text-md text-tertiary">لا يوجد تاجر مدين للشراكة الآن.</p>
                ) : (
                    <ul className="surface flex flex-col divide-y divide-secondary px-5">
                        {debtors.rows.map((d) => (
                            <li key={d.id}>
                                <a
                                    href={`/accounts/traders/${d.id}`}
                                    className="flex min-h-14 items-center justify-between gap-3 rounded-md py-3 text-md outline-focus-ring hover:text-brand-secondary focus-visible:outline-2"
                                >
                                    <span className="text-primary">{d.name}</span>
                                    <span className="num text-secondary">{formatMoney(d.owes, "IQD")}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <StatementSection target={target} params={parseStatementParams(sp, todayISO())} />
        </div>
    );
}
