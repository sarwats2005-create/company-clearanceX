import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BalanceBand, ParentLink } from "@/components/app/accounts/balance-band";
import { StatementSection } from "@/components/app/accounts/statement-section";
import { EditVaultButton } from "@/components/app/accounts/vault-dialog";
import { GROUP_COLOR, MONEY_KIND_META } from "@/components/app/money/money-kinds";
import { PageHeader } from "@/components/app/page-header";
import { db } from "@/db";
import { type Currency, vaults } from "@/db/schema";
import { defaultCurrency, parseStatementParams, vaultSubtitle } from "@/features/accounts/model";
import { getStatementTarget, getVaultAccount } from "@/features/accounts/queries";
import { SLUG_BY_KIND } from "@/features/money/form-model";
import type { MoneyKind } from "@/features/money/schemas";
import { requireSession } from "@/lib/auth";
import { formatMoney, todayISO } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { cx } from "@/utils/cx";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { id } = await params;
    if (!isUuid(id)) return { title: "القاصة" };
    const [row] = await db.select({ name: vaults.name }).from(vaults).where(eq(vaults.id, id));
    return { title: row ? row.name : "القاصة" };
}

const QUICK: MoneyKind[] = ["deposit", "withdraw", "transfer", "exchange"];
const SHORT: Partial<Record<MoneyKind, string>> = { transfer: "تحويل", exchange: "تصريف" };
const IN_WORDS: Record<Currency, string> = { USD: "بالدولار", IQD: "بالدينار" };

/** Vault page (PRD §8.8, US-19): balances, quick إيداع / سحب / تحويل / تصريف, and its movements. */
export default async function VaultAccountPage({ params, searchParams }: { params: Params; searchParams: Search }) {
    await requireSession();
    const { id } = await params;
    if (!isUuid(id)) notFound();
    const [account, target] = await Promise.all([getVaultAccount(db, id), getStatementTarget(db, "vaults", id)]);
    if (!account || !target) notFound();
    const { vault, balance } = account;
    const sp = parseStatementParams(await searchParams, todayISO());
    const currency = defaultCurrency(vault.allowedCurrencies, balance, sp.currency);

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                eyebrow={<ParentLink href="/accounts/vaults">القاصات</ParentLink>}
                title={vault.name}
                description={
                    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>{vaultSubtitle(vault)}</span>
                        {!vault.isActive && <span className="text-error-primary">موقوفة</span>}
                    </span>
                }
                actions={<EditVaultButton vault={vault} />}
            />

            <BalanceBand
                title="الرصيد الحالي"
                items={vault.allowedCurrencies.map((c) => ({
                    label: IN_WORDS[c],
                    value: <bdi className={cx("num", balance[c].startsWith("-") ? "text-error-primary" : "text-primary")}>{formatMoney(balance[c], c)}</bdi>,
                }))}
            />

            {vault.notes && <p className="-mt-4 text-md whitespace-pre-line text-tertiary">{vault.notes}</p>}

            {vault.isActive && (
                <nav aria-label="معاملة على هذه القاصة">
                    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {QUICK.map((k) => {
                            const m = MONEY_KIND_META[k];
                            const Icon = m.icon;
                            return (
                                <li key={k}>
                                    <a
                                        href={`/money/new/${SLUG_BY_KIND[k]}?vault=${id}&currency=${currency}`}
                                        className="relative flex h-14 items-center gap-3 overflow-hidden rounded-xl bg-primary ps-4 pe-3 text-md text-primary ring-1 ring-secondary outline-focus-ring transition-[background-color,transform] duration-150 ease-smooth ring-inset hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]"
                                    >
                                        <span aria-hidden="true" className={cx("absolute inset-y-3 start-0 w-[3px] rounded-e-full", GROUP_COLOR[m.group])} />
                                        <Icon className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                        {SHORT[k] ?? m.title}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            )}

            <StatementSection target={target} params={sp} />
        </div>
    );
}
