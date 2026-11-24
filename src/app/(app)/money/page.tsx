import { ClockRewind } from "@untitledui/icons";
import type { Metadata } from "next";
import { JournalList } from "@/components/app/money/journal-list";
import { GROUP_COLOR, MONEY_GROUPS, MONEY_KIND_META } from "@/components/app/money/money-kinds";
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
        <div className="flex flex-col gap-10">
            <PageHeader
                title="المالية"
                description="سجّل أي مبلغ يدخل أو يخرج. لكل عملية وصل مرقّم يمكن طباعته."
                actions={
                    <Button size="lg" color="secondary" href="/money/journal" iconLeading={<ClockRewind data-icon aria-hidden="true" />}>
                        سجل المعاملات
                    </Button>
                }
            />

            <section aria-labelledby="vaults-title" className="flex flex-col gap-3">
                <h2 id="vaults-title" className="text-sm text-tertiary">
                    أرصدة القاصات
                </h2>
                <ul className="grid grid-cols-1 divide-y divide-secondary border-y border-secondary sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
                    {vaults.map((v, i) => (
                        <li
                            key={v.id}
                            className={cx(
                                "flex flex-col gap-1 py-4 sm:px-5 sm:first:ps-0",
                                i > 0 && "sm:border-s sm:border-secondary",
                                i >= 2 && "sm:max-lg:border-t lg:border-t-0",
                            )}
                        >
                            <span className="text-sm text-tertiary">{v.name}</span>
                            {(v.allowedCurrencies as Currency[]).map((c) => (
                                <bdi
                                    key={c}
                                    className={cx("num self-start text-xl font-medium", v.balance[c].startsWith("-") ? "text-error-primary" : "text-primary")}
                                >
                                    {formatMoney(v.balance[c], c)}
                                </bdi>
                            ))}
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
                        <h3 className="inline-flex items-center gap-2 text-sm text-tertiary">
                            <span aria-hidden="true" className={cx("size-2 rounded-full", GROUP_COLOR[g.group])} />
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
                                            className="relative flex h-full min-h-28 flex-col gap-3 overflow-hidden rounded-2xl bg-primary p-4 ring-1 ring-secondary outline-focus-ring transition-[background-color,transform] duration-150 ease-smooth ring-inset hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] sm:p-5 lg:min-h-30"
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={cx("absolute inset-y-4 start-0 w-[3px] rounded-e-full", GROUP_COLOR[g.group])}
                                            />
                                            <Icon className="size-6 text-fg-quaternary" aria-hidden="true" />
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
                <div className="flex items-baseline justify-between gap-4">
                    <h2 id="recent-title" className="text-lg font-semibold text-primary">
                        آخر المعاملات
                    </h2>
                    {recent.total > 0 && (
                        <Button size="md" color="link-color" href="/money/journal">
                            عرض السجل كاملاً
                        </Button>
                    )}
                </div>
                <JournalList
                    rows={recent.rows.slice(0, 8)}
                    empty={
                        <p className="border-y border-secondary py-10 text-center text-md text-tertiary">
                            لا توجد معاملات بعد. اختر نوع العملية من الأعلى لتسجيل أول مبلغ.
                        </p>
                    }
                />
            </section>
        </div>
    );
}
