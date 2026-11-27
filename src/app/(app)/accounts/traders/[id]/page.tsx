import { ArrowCircleUp, Phone01, Plus, Wallet02 } from "@untitledui/icons";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BalanceBand, ParentLink, SideFigure } from "@/components/app/accounts/balance-band";
import { StatementSection } from "@/components/app/accounts/statement-section";
import { TraderInfo } from "@/components/app/accounts/trader-info";
import { ContainersList } from "@/components/app/containers/containers-list";
import { LinkTabs } from "@/components/app/link-tabs";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { type Currency, traders } from "@/db/schema";
import { defaultCurrency, parseStatementParams } from "@/features/accounts/model";
import { getStatementTarget, getTraderAccount } from "@/features/accounts/queries";
import { listContainers } from "@/features/containers/queries";
import { requireSession } from "@/lib/auth";
import { balanceSide, todayISO } from "@/lib/format";
import { isUuid } from "@/lib/ids";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { id } = await params;
    if (!isUuid(id)) return { title: "التاجر" };
    const [row] = await db.select({ name: traders.name }).from(traders).where(eq(traders.id, id));
    return { title: row ? `حساب ${row.name}` : "التاجر" };
}

const TABS = ["statement", "containers", "info"] as const;
type Tab = (typeof TABS)[number];

/** Trader page (PRD §8.8): both balances, receive / pay, then statement · containers · info. */
export default async function TraderAccountPage({ params, searchParams }: { params: Params; searchParams: Search }) {
    await requireSession();
    const { id } = await params;
    if (!isUuid(id)) notFound();
    const [account, target] = await Promise.all([getTraderAccount(db, id), getStatementTarget(db, "traders", id)]);
    if (!account || !target) notFound();
    const sp = await searchParams;
    const tab: Tab = TABS.find((x) => x === sp.tab) ?? "statement";
    const { trader, balance, activeContainers } = account;
    const base = `/accounts/traders/${id}`;
    // Receive in the currency he owes in (dollars first); pay in the one where we owe him.
    const owes = (["USD", "IQD"] as Currency[]).find((c) => balanceSide(balance[c], c) === "owesUs");
    const owed = (["USD", "IQD"] as Currency[]).find((c) => balanceSide(balance[c], c) === "weOwe");
    const receiveCurrency = owes ?? defaultCurrency(["USD", "IQD"], balance);

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                eyebrow={<ParentLink href="/accounts/traders">حسابات التجار</ParentLink>}
                title={trader.name}
                description={
                    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                        {trader.phone && (
                            <a
                                href={`tel:${trader.phone}`}
                                className="inline-flex items-center gap-1.5 rounded-md outline-focus-ring hover:text-secondary focus-visible:outline-2"
                            >
                                <Phone01 className="size-4 text-fg-quaternary" aria-hidden="true" />
                                <bdi className="num">{trader.phone}</bdi>
                            </a>
                        )}
                        {trader.city && <span>{trader.city}</span>}
                        {!trader.phone && !trader.city && <span>لا توجد معلومات اتصال</span>}
                    </span>
                }
                actions={
                    <>
                        <Button
                            size="lg"
                            iconLeading={<Wallet02 data-icon aria-hidden="true" />}
                            href={`/money/new/receive-trader?trader=${id}&currency=${receiveCurrency}`}
                        >
                            استلام دفعة
                        </Button>
                        <Button
                            size="lg"
                            color="secondary"
                            iconLeading={<ArrowCircleUp data-icon aria-hidden="true" />}
                            href={`/money/new/pay-trader?trader=${id}${owed ? `&currency=${owed}` : ""}`}
                        >
                            دفع للتاجر
                        </Button>
                    </>
                }
            />

            <BalanceBand
                title="الرصيد الحالي"
                items={[
                    { label: "بالدولار", value: <SideFigure amount={balance.USD} currency="USD" /> },
                    { label: "بالدينار", value: <SideFigure amount={balance.IQD} currency="IQD" /> },
                ]}
            />

            <LinkTabs
                label="أقسام حساب التاجر"
                items={[
                    { href: base, label: "كشف الحساب", isActive: tab === "statement" },
                    { href: `${base}?tab=containers`, label: activeContainers ? `الحاويات (${activeContainers})` : "الحاويات", isActive: tab === "containers" },
                    { href: `${base}?tab=info`, label: "معلومات", isActive: tab === "info" },
                ]}
            />

            {tab === "statement" && <StatementSection target={target} params={parseStatementParams(sp, todayISO())} />}
            {tab === "containers" && <TraderContainers traderId={id} />}
            {tab === "info" && <TraderInfo trader={trader} />}
        </div>
    );
}

async function TraderContainers({ traderId }: { traderId: string }) {
    const { rows, total } = await listContainers(db, { traderId, totalsOf: traderId, pageSize: 200, sort: "registered", dir: "desc" });
    return (
        <section aria-labelledby="containers-title" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <h2 id="containers-title" className="text-lg font-semibold text-primary">
                    حاويات التاجر
                </h2>
                <Button size="md" color="secondary" iconLeading={<Plus data-icon aria-hidden="true" />} href={`/containers/new?trader=${traderId}`}>
                    حاوية جديدة
                </Button>
            </div>
            {rows.length ? (
                <>
                    <ContainersList rows={rows} filters={null} totalsLabel="حصته من المصاريف" />
                    {total > rows.length && (
                        <Button size="md" color="link-color" href={`/containers?trader=${traderId}`} className="self-start">
                            عرض كل الحاويات
                        </Button>
                    )}
                </>
            ) : (
                <p className="border-y border-secondary py-12 text-center text-md text-tertiary">لا توجد حاويات لهذا التاجر بعد.</p>
            )}
        </section>
    );
}
