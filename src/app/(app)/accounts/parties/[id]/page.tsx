import { ArrowCircleDown, Building07, Phone01, Settings01, Wallet02 } from "@untitledui/icons";
import { eq } from "drizzle-orm";
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
