import { ArrowCircleDown, ArrowCircleUp, ClockRewind, SwitchHorizontal01, Wallet02 } from "@untitledui/icons";
import type { Metadata } from "next";
import { JournalList } from "@/components/app/money/journal-list";
import { VAULT_KIND_ICON } from "@/components/app/accounts/vault-kinds";
import { CardTitle, IconTile } from "@/components/app/icon-tile";
import { MONEY_GROUPS, MONEY_KIND_META } from "@/components/app/money/money-kinds";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import type { Currency } from "@/db/schema";
import { SLUG_BY_KIND } from "@/features/money/form-model";
import { listJournal, listVaultBalances } from "@/features/money/queries";
import { requireSession } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "المالية" };

export default async function MoneyPage() {
    await requireSession();
    const [vaults, recent] = await Promise.all([listVaultBalances(db), listJournal(db, { page: 1 })]);

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                icon={Wallet02}
                iconColor="teal"
                title="المالية"
                description="سجّل أي مبلغ يدخل أو يخرج. لكل عملية وصل مرقّم يمكن طباعته."
                actions={
                    <Button size="lg" color="secondary" href="/money/journal" iconLeading={<ClockRewind data-icon aria-hidden="true" />}>
                        سجل المعاملات
                    </Button>
                }
            />

            <section aria-labelledby="vaults-title" className="flex flex-col gap-3">
                <h2 id="vaults-title" className="text-md font-semibold text-secondary">
                    أرصدة القاصات
                </h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {vaults.map((v) => (
                        <li key={v.id}>
                            <a
                                href={`/accounts/vaults/${v.id}`}
                                className={cx(
                                    "flex h-full flex-col gap-3 p-4 outline-focus-ring transition-[box-shadow,transform] duration-150 ease-smooth focus-visible:outline-2 active:scale-[0.98]",
                                    v.kind === "main" ? "rounded-[1.25rem] bg-hero text-white shadow-hero" : "surface hover:shadow-card-hover",
                                )}
                            >
                                <span className="flex items-center gap-2.5">
                                    <IconTile icon={VAULT_KIND_ICON[v.kind]} color={v.kind === "main" ? "gold" : "gray"} size="sm" />
                                    <span className={cx("truncate text-md font-semibold", v.kind === "main" ? "text-white" : "text-secondary")}>{v.name}</span>
                                </span>
                                {(v.allowedCurrencies as Currency[]).map((c) => (
                                    <bdi
                                        key={c}
                                        className={cx(
                                            "num self-start text-xl font-semibold",
                                            v.kind === "main" ? "text-white" : v.balance[c].startsWith("-") ? "text-error-primary" : "text-primary",
                                        )}
                                    >
                                        {formatMoney(v.balance[c], c)}
                                    </bdi>
                                ))}
                            </a>
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="new-title" className="flex flex-col gap-6">
                <h2 id="new-title" className="text-lg font-semibold text-primary">
                    معاملة جديدة
                </h2>
                {MONEY_GROUPS.map((g) => (
                    <div key={g.group} className="flex flex-col gap-3">
                        <h3 className="inline-flex items-center gap-2 text-md font-semibold text-secondary">
                            {g.group === "in" ? (
                                <ArrowCircleDown className="size-5 text-fg-success-secondary" aria-hidden="true" />
                            ) : g.group === "out" ? (
                                <ArrowCircleUp className="size-5 text-fg-error-secondary" aria-hidden="true" />
                            ) : (
                                <SwitchHorizontal01 className="size-5 text-utility-blue-600" aria-hidden="true" />
                            )}
                            {g.title}
                        </h3>
                        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {g.kinds.map((k) => {
                                const m = MONEY_KIND_META[k];
                                const Icon = m.icon;
                                return (
                                    <li key={k}>
                                        <a
                                            href={`/money/new/${SLUG_BY_KIND[k]}`}
                                            className="surface relative flex h-full min-h-32 flex-col gap-3 p-4 outline-focus-ring transition-[box-shadow,transform] duration-150 ease-smooth hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] sm:p-5"
                                        >
                                            <IconTile icon={Icon} color={m.color} size="lg" />
                                            <span className="flex flex-col gap-0.5">
                                                <span className="text-md font-semibold text-primary sm:text-lg">{m.title}</span>
                                                <span className="text-sm text-tertiary">{m.hint}</span>
                                            </span>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </section>

            <section aria-labelledby="recent-title" className="flex flex-col gap-3">
                <CardTitle
                    id="recent-title"
                    icon={ClockRewind}
                    color="gray"
                    title="آخر المعاملات"
                    actions={
                        recent.total > 0 && (
                            <Button size="md" color="link-color" href="/money/journal">
                                عرض السجل كاملاً
                            </Button>
                        )
                    }
                />
                <JournalList
                    rows={recent.rows.slice(0, 8)}
                    empty={
                        <p className="surface py-10 text-center text-md text-tertiary">
                            لا توجد معاملات بعد. اختر نوع العملية من الأعلى لتسجيل أول مبلغ.
                        </p>
                    }
                />
            </section>
        </div>
    );
}
