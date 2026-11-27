import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ParentLink } from "@/components/app/accounts/balance-band";
import { StatementSection } from "@/components/app/accounts/statement-section";
import { EditVaultButton } from "@/components/app/accounts/vault-dialog";
import { VAULT_KIND_ICON } from "@/components/app/accounts/vault-kinds";
import { MONEY_KIND_META } from "@/components/app/money/money-kinds";
import { VaultHero } from "@/components/app/vault-hero";
import { PageHeader } from "@/components/app/page-header";
import { db } from "@/db";
import { type Currency, vaults } from "@/db/schema";
import { defaultCurrency, parseStatementParams, vaultSubtitle } from "@/features/accounts/model";
import { getStatementTarget, getVaultAccount } from "@/features/accounts/queries";
import { SLUG_BY_KIND } from "@/features/money/form-model";
import type { MoneyKind } from "@/features/money/schemas";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { isUuid } from "@/lib/ids";

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
const TONE = { in: "in", out: "out", internal: "between" } as const;

/** Vault page: the balance big and loud, round quick actions (إيداع / سحب / تحويل / تصريف), then its movements. */
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
        <div className="flex flex-col gap-6">
            <PageHeader
                icon={VAULT_KIND_ICON[vault.kind]}
                iconColor="gold"
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

            <VaultHero
                title={vault.name}
                subtitle={vault.isActive ? "الرصيد الحالي" : "موقوفة"}
                amounts={vault.allowedCurrencies.map((c) => ({ label: IN_WORDS[c], amount: balance[c], currency: c }))}
                actions={
                    vault.isActive
                        ? QUICK.map((k) => ({
                              href: `/money/new/${SLUG_BY_KIND[k]}?vault=${id}&currency=${currency}`,
                              label: SHORT[k] ?? MONEY_KIND_META[k].title,
                              icon: MONEY_KIND_META[k].icon,
                              tone: TONE[MONEY_KIND_META[k].group],
                          }))
                        : []
                }
            />

            {vault.notes && <p className="surface px-5 py-4 text-md whitespace-pre-line text-secondary">{vault.notes}</p>}

            <StatementSection target={target} params={sp} />
        </div>
    );
}
