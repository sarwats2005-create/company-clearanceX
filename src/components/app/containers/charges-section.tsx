"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Receipt } from "@untitledui/icons";
import { AppDialog } from "@/components/app/app-dialog";
import { BalanceText } from "@/components/app/balance-text";
import { CardTitle } from "@/components/app/icon-tile";
import { AddChargesButton, useChargesSheet } from "@/components/app/charges-sheet";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { TextArea } from "@/components/base/textarea/textarea";
import type { Currency } from "@/db/schema";
import { cancelChargeAction, resplitChargesAction } from "@/features/charges/actions";
import type { ContainerChargeRow, ContainerMoney } from "@/features/charges/queries";
import type { ResplitItem } from "@/features/charges/service";
import { useAction } from "@/hooks/use-action";
import { formatDate, formatMoney } from "@/lib/format";
import { cx } from "@/utils/cx";

type PerCurrency = Record<Currency, string>;

function Amounts({ x, className }: { x: PerCurrency; className?: string }) {
    const parts = (["USD", "IQD"] as Currency[]).filter((c) => Number(x[c]) !== 0);
    if (!parts.length) return <span className={cx("text-quaternary", className)}>0</span>;
    return (
        <span className={cx("flex flex-col items-end gap-0.5", className)}>
            {parts.map((c) => (
                <bdi key={c} className="num whitespace-nowrap">
                    {formatMoney(x[c], c)}
                </bdi>
            ))}
        </span>
    );
}

const partsText = (parts: { traderName: string; amount: string }[], currency: Currency) =>
    parts.map((p) => `${p.traderName} ${formatMoney(p.amount, currency)}`).join(" · ");

function splitLabel(c: ContainerChargeRow) {
    if (c.splitMode === "manual") return "يدوي";
    if (c.splitMode === "single_trader") return `على ${c.allocations[0]?.traderName ?? "تاجر واحد"}`;
    return "حسب الحصص";
}

/** The charges block of the container page (PRD §8.6): list, cancel / cancel-and-replace, money summary. */
export function ChargesSection({
    charges,
    money,
    isShared,
    canEdit,
}: {
    charges: ContainerChargeRow[];
    money: ContainerMoney;
    isShared: boolean;
    canEdit: boolean;
}) {
    const active = charges.filter((c) => !c.cancelledAt);
    const cancelled = charges.filter((c) => c.cancelledAt);
    const [showCancelled, setShowCancelled] = useState(false);
    const [cancel, setCancel] = useState<{ charge: ContainerChargeRow; replace: boolean } | null>(null);

    return (
        <section id="charges" aria-labelledby="charges-title" className="surface flex scroll-mt-6 flex-col gap-4 p-5 md:p-6">
            <CardTitle
                id="charges-title"
                icon={Receipt}
                color="pink"
                title="المصاريف"
                actions={canEdit && active.length > 0 ? <AddChargesButton size="md" color="secondary" className="max-lg:hidden" /> : undefined}
            />

            {active.length === 0 ? (
                <p className="rounded-2xl bg-secondary px-4 py-6 text-center text-md text-tertiary">لم تُسجَّل مصاريف على هذه الحاوية بعد.</p>
            ) : (
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
                    <ul className="flex flex-col divide-y divide-secondary">
                        {active.map((c) => (
                            <ChargeItem
                                key={c.id}
                                charge={c}
                                isShared={isShared}
                                onCancel={canEdit ? (replace) => setCancel({ charge: c, replace }) : undefined}
                            />
                        ))}
                    </ul>
                    <MoneySummary money={money} isShared={isShared} />
                </div>
            )}

            {cancelled.length > 0 && (
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        aria-expanded={showCancelled}
                        onClick={() => setShowCancelled((v) => !v)}
                        className="inline-flex cursor-pointer items-center gap-1 self-start rounded-md text-sm text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2"
                    >
                        <ChevronDown className={cx("size-4 transition-transform duration-150 ease-smooth", showCancelled && "rotate-180")} aria-hidden="true" />
                        <span>
                            المصاريف الملغاة (<bdi className="num">{cancelled.length}</bdi>)
                        </span>
                    </button>
                    {showCancelled && (
                        <ul className="flex flex-col divide-y divide-secondary border-y border-secondary">
                            {cancelled.map((c) => (
                                <ChargeItem key={c.id} charge={c} isShared={isShared} />
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {cancel && <CancelChargeDialog charge={cancel.charge} replace={cancel.replace} onClose={() => setCancel(null)} />}
        </section>
    );
}

function ChargeItem({ charge: c, isShared, onCancel }: { charge: ContainerChargeRow; isShared: boolean; onCancel?: (replace: boolean) => void }) {
    const off = !!c.cancelledAt;
    return (
        <li className={cx("flex items-start gap-3 py-4", off && "text-tertiary")}>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                    <p className={cx("text-md", off ? "text-tertiary" : "text-primary")}>
                        {c.chargeTypeName}
                        {c.isFee && !off && <span className="ms-2 rounded-full bg-success-primary px-2 py-0.5 text-xs text-success-primary">ربح</span>}
                        {off && <span className="ms-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-tertiary ring-1 ring-secondary ring-inset">ملغى</span>}
                    </p>
                    <bdi className={cx("num shrink-0 text-md", off ? "text-quaternary line-through" : "text-primary")}>{formatMoney(c.amount, c.currency)}</bdi>
                </div>
                <p className="text-sm text-tertiary">
                    {c.payerLabel}
                    {" · "}
                    <bdi className="num">{formatDate(c.entryDate)}</bdi>
                    {c.receiptNo && (
                        <>
                            {" · "}
                            وصل <bdi className="num">{c.receiptNo}</bdi>
                        </>
                    )}
                </p>
                {isShared && c.allocations.length > 0 && (
                    <p className="text-sm text-tertiary">
                        <span className="text-secondary">{splitLabel(c)}:</span> {partsText(c.allocations, c.currency)}
                    </p>
                )}
                {c.note && <p className="text-sm text-secondary">{c.note}</p>}
                {off && c.cancelReason && <p className="text-sm text-tertiary">سبب الإلغاء: {c.cancelReason}</p>}
            </div>
            {onCancel && (
                <Dropdown.Root>
                    <Dropdown.DotsButton aria-label={`خيارات ${c.chargeTypeName}`} className="-me-1 size-10 shrink-0 rounded-lg" />
                    <Dropdown.Popover className="w-64">
                        <Dropdown.Menu onAction={(key) => onCancel(key === "replace")}>
                            <Dropdown.Item id="replace" label="إلغاء وإضافة بدلاً منه" />
                            <Dropdown.Item id="cancel" label="إلغاء المصروف" />
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown.Root>
            )}
        </li>
    );
}

function CancelChargeDialog({ charge: c, replace, onClose }: { charge: ContainerChargeRow; replace: boolean; onClose: () => void }) {
    const sheet = useChargesSheet();
    const [reason, setReason] = useState(replace ? "تصحيح المبلغ أو الجهة" : "");
    const run = useAction(cancelChargeAction, {
        success: replace ? "أُلغي المصروف. أضف المصروف الصحيح" : "تم إلغاء المصروف",
        onSuccess: () => {
            onClose();
            if (!replace) return;
            const single = c.splitMode === "single_trader" ? c.allocations[0]?.traderId : null;
            sheet.open({
                chargeTypeId: c.chargeTypeId,
                row: {
                    amount: c.amount.replace(/\.00$/, ""),
                    currency: c.currency,
                    paidByPartyId: c.isFee ? null : c.paidByPartyId,
                    vaultId: c.paidFromVaultId,
                    splitMode: c.splitMode,
                    splitTraderId: single ?? null,
                    manual: c.splitMode === "manual" ? Object.fromEntries(c.allocations.map((a) => [a.traderId, a.amount.replace(/\.00$/, "")])) : {},
                    note: c.note ?? "",
                },
            });
        },
    });
    const who = c.isFee ? "ومن أرباح الشركة" : c.paidFromVaultId ? "ويعود المبلغ إلى القاصة" : `ومن حساب ${c.payerLabel}`;
    return (
        <AppDialog
            isOpen
            onOpenChange={(o) => !o && !run.pending && onClose()}
            isDismissable={!run.pending}
            size="sm"
            title={`إلغاء «${c.chargeTypeName}» ${formatMoney(c.amount, c.currency)}؟`}
            description={`يُحذف المبلغ من حساب التاجر ${who}. يبقى المصروف ظاهراً في السجل مع سبب الإلغاء.${replace ? " بعدها تُفتح نافذة المصاريف بنفس القيم لتصحيحها." : ""}`}
            footer={
                <>
                    <Button size="lg" color="secondary" onClick={onClose} isDisabled={run.pending}>
                        رجوع
                    </Button>
                    <Button
                        size="lg"
                        color="primary-destructive"
                        isLoading={run.pending}
                        showTextWhileLoading
                        onClick={() => run.run({ chargeId: c.id, reason })}
                    >
                        {replace ? "إلغاء ثم تصحيح" : "إلغاء المصروف"}
                    </Button>
                </>
            }
        >
            <TextArea
                label="سبب الإلغاء"
                isRequired
                rows={2}
                value={reason}
                onChange={setReason}
                isInvalid={!!run.fieldErrors.reason}
                hint={run.fieldErrors.reason}
                placeholder="مثال: المبلغ خطأ"
            />
        </AppDialog>
    );
}

function Line({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
    return (
        <div className={cx("flex items-baseline justify-between gap-4 py-2.5", strong && "font-semibold text-primary")}>
            <dt className={cx("text-sm", strong ? "text-primary" : "text-tertiary")}>{label}</dt>
            <dd className={cx("text-md", strong ? "text-primary" : "text-secondary")}>{children}</dd>
        </div>
    );
}

/** PRD §5.4a: what this container costs, our fee, what we owe each party, and each trader's part and overall balance. */
function MoneySummary({ money, isShared }: { money: ContainerMoney; isShared: boolean }) {
    return (
        <aside aria-labelledby="money-title" className="flex flex-col gap-5 rounded-2xl bg-secondary p-4 lg:p-5">
            <div className="flex flex-col">
                <h3 id="money-title" className="text-md font-semibold text-secondary">
                    ملخص الحساب
                </h3>
                <dl className="flex flex-col divide-y divide-secondary">
                    <Line label="تكاليف تُدفع لجهات">
                        <Amounts x={money.costs} />
                    </Line>
                    <Line label="أتعاب (ربح الشركة)">
                        <Amounts x={money.fees} />
                    </Line>
                    <Line label={isShared ? "المجموع على التجار" : "المجموع على التاجر"} strong>
                        <Amounts x={money.total} />
                    </Line>
                </dl>
            </div>

            {money.owedToParties.length > 0 && (
                <div className="flex flex-col">
                    <h3 className="text-sm text-tertiary">مستحق للجهات عن هذه الحاوية</h3>
                    <dl className="flex flex-col divide-y divide-secondary">
                        {money.owedToParties.map((p) => (
                            <Line key={p.partyId} label={p.name}>
                                <Amounts x={p.amounts} />
                            </Line>
                        ))}
                    </dl>
                </div>
            )}

            <div className="flex flex-col gap-1">
                <h3 className="text-sm text-tertiary">{isShared ? "التجار" : "رصيد التاجر الكلي"}</h3>
                <ul className="flex flex-col divide-y divide-secondary">
                    {money.traders.map((tr) => (
                        <li key={tr.traderId} className="flex flex-col gap-1 py-2.5">
                            <div className="flex items-baseline justify-between gap-3">
                                <a
                                    href={`/accounts/traders/${tr.traderId}`}
                                    className="rounded-md text-md text-primary underline-offset-2 outline-focus-ring hover:underline focus-visible:outline-2"
                                >
                                    {tr.name}
                                </a>
                                {isShared && <Amounts x={tr.part} className="text-sm text-secondary" />}
                            </div>
                            <p className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="text-tertiary">الرصيد الكلي</span>
                                <BalanceText amounts={tr.balance} />
                            </p>
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-quaternary">الدفعات تُسجَّل على حساب التاجر كله، لا على حاوية واحدة.</p>
            </div>
        </aside>
    );
}

/** Shares changed after charges were saved (PRD §5.3): list old → new parts, then cancel and re-post them. */
export function ResplitAlert({ containerId, items }: { containerId: string; items: ResplitItem[] }) {
    const [open, setOpen] = useState(false);
    const run = useAction(resplitChargesAction, { success: "أُعيد توزيع المصاريف على الحصص الجديدة", onSuccess: () => setOpen(false) });
    if (!items.length) return null;
    return (
        <>
            <div
                className="ring-warning-200 flex flex-col gap-3 rounded-xl bg-warning-primary p-4 ring-1 ring-inset sm:flex-row sm:items-center sm:justify-between"
                role="status"
            >
                <div className="flex gap-3 text-warning-primary">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                        <p className="text-md font-semibold">تغيّرت الحصص بعد تسجيل المصاريف</p>
                        <p className="text-sm">بعض المصاريف ما زالت موزعة على الحصص القديمة.</p>
                    </div>
                </div>
                <Button size="md" color="secondary" onClick={() => setOpen(true)} className="shrink-0">
                    إعادة توزيع المصاريف
                </Button>
            </div>
            <AppDialog
                isOpen={open}
                onOpenChange={(o) => !run.pending && setOpen(o)}
                isDismissable={!run.pending}
                size="md"
                title="إعادة توزيع المصاريف"
                description="تُلغى هذه المصاريف وتُسجَّل من جديد حسب الحصص الحالية، بتاريخ اليوم. ما ندين به للجهات لا يتغير."
                footer={
                    <>
                        <Button size="lg" color="secondary" onClick={() => setOpen(false)} isDisabled={run.pending}>
                            رجوع
                        </Button>
                        <Button size="lg" isLoading={run.pending} showTextWhileLoading onClick={() => run.run(containerId)}>
                            إعادة التوزيع
                        </Button>
                    </>
                }
            >
                <ul className="flex flex-col divide-y divide-secondary border-y border-secondary">
                    {items.map((it) => (
                        <li key={it.chargeId} className="flex flex-col gap-1 py-3 text-sm">
                            <p className="flex items-baseline justify-between gap-3 text-md text-primary">
                                {it.chargeTypeName}
                                <bdi className="num">{formatMoney(it.amount, it.currency)}</bdi>
                            </p>
                            <p className="text-tertiary">
                                قبل:{" "}
                                <span className="line-through">
                                    {partsText(
                                        it.before.filter((a) => Number(a.amount) > 0),
                                        it.currency,
                                    )}
                                </span>
                            </p>
                            <p className="text-secondary">بعد: {partsText(it.after, it.currency)}</p>
                        </li>
                    ))}
                </ul>
            </AppDialog>
        </>
    );
}
