import type { Metadata } from "next";
import { AccountsHeader } from "@/components/app/accounts/accounts-header";
import { NewVaultCard } from "@/components/app/accounts/vault-dialog";
import { VAULT_KIND_ICON } from "@/components/app/accounts/vault-kinds";
import { db } from "@/db";
import { vaultSubtitle } from "@/features/accounts/model";
import { type VaultAccountRow, listVaultAccounts } from "@/features/accounts/queries";
import { requireSession } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "القاصات" };

const card =
    "relative flex h-full min-h-36 flex-col justify-between gap-5 overflow-hidden rounded-2xl p-5 outline-focus-ring transition-[background-color,transform] duration-150 ease-smooth focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99] md:p-6";

function VaultCard({ v }: { v: VaultAccountRow }) {
    const Icon = VAULT_KIND_ICON[v.kind];
    const main = v.kind === "main" && v.isActive;
    return (
        <a
            href={`/accounts/vaults/${v.id}`}
            className={cx(
                card,
                main ? "bg-brand-solid hover:bg-brand-solid_hover" : "bg-primary ring-1 ring-secondary ring-inset hover:bg-primary_hover",
                !v.isActive && "opacity-60",
            )}
        >
            <span className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cx("truncate text-lg font-semibold", main ? "text-primary_on-brand" : "text-primary")}>{v.name}</span>
                    <span className={cx("text-sm", main ? "text-tertiary_on-brand" : "text-tertiary")}>
                        {vaultSubtitle(v)}
                        {!v.isActive && " · موقوفة"}
                    </span>
                </span>
                <Icon className={cx("size-6 shrink-0", main ? "text-tertiary_on-brand" : "text-fg-quaternary")} aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
                {v.allowedCurrencies.map((c) => (
                    <bdi
                        key={c}
                        className={cx(
                            "num self-start font-semibold",
                            main ? "text-display-xs text-primary_on-brand md:text-display-sm" : "text-xl",
                            !main && (v.balance[c].startsWith("-") ? "text-error-primary" : "text-primary"),
                        )}
                    >
                        {formatMoney(v.balance[c], c)}
                    </bdi>
                ))}
            </span>
        </a>
    );
}

/** Vaults (PRD §8.8): the main vault is the wide navy card; every vault opens its movements. */
export default async function VaultsPage() {
    await requireSession();
    const vaults = await listVaultAccounts(db);

    return (
        <div className="flex flex-col gap-8">
            <AccountsHeader current="vaults" description="أين يوجد مالك الآن. لكل قاصة رصيد بالدينار وآخر بالدولار حسب ما تقبله." />
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vaults.map((v) => (
                    <li key={v.id} className={cx(v.kind === "main" && v.isActive && "sm:col-span-2")}>
                        <VaultCard v={v} />
                    </li>
                ))}
                <li>
                    <NewVaultCard />
                </li>
            </ul>
        </div>
    );
}
