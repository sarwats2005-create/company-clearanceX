"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppDialog } from "@/components/app/app-dialog";
import { DateField } from "@/components/app/date-field";
import { EntityCombobox } from "@/components/app/entity-combobox";
import { optionalLabel } from "@/components/app/field-label";
import { QuickAddDialog } from "@/components/app/quick-add-dialogs";
import { SegmentedControl } from "@/components/app/segmented-control";
import { SelectField } from "@/components/app/select-field";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import type { Currency } from "@/db/schema";
import type { VaultShortfall } from "@/features/ledger/vault-check";
import { checkMoneyAction, postMoneyAction } from "@/features/money/actions";
import {
    type FormErrors,
    type MoneyFormOptions,
    type MoneyFormState,
    type Prefill,
    emptyForm,
    formSentence,
    fullAmount,
    onAmountChange,
    onDebtChange,
    onRateChange,
    toMoneyInput,
    validateForm,
    vaultFor,
} from "@/features/money/form-model";
import { type MoneyKind, type PayReason, otherCurrency } from "@/features/money/schemas";
import { useAction } from "@/hooks/use-action";
import { formatDate, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { balanceWords } from "./money-kinds";

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
    { value: "IQD", label: "دينار" },
    { value: "USD", label: "دولار" },
];
const REASONS: { value: PayReason; label: string }[] = [
    { value: "refund", label: "إرجاع" },
    { value: "advance", label: "سلفة" },
    { value: "other", label: "أخرى" },
];
const RECEIPT_WORD: Record<MoneyKind, string> = {
    receive_trader: "وصل قبض",
    receive_party: "وصل قبض",
    deposit: "وصل قبض",
    pay_party: "وصل صرف",
    pay_trader: "وصل صرف",
    withdraw: "وصل صرف",
    expense: "وصل صرف",
    transfer: "وصل تحويل",
    exchange: "وصل تصريف",
};
const CURRENCY_NAME: Record<Currency, string> = { IQD: "بالدينار", USD: "بالدولار" };

const numInput = "num [direction:ltr] text-end";

/** One form for the nine money actions (PRD §8.7). Fields appear only when that action needs them. */
export function MoneyForm({ kind, options, today, prefill }: { kind: MoneyKind; options: MoneyFormOptions; today: string; prefill: Prefill }) {
    const router = useRouter();
    const [opts, setOpts] = useState(options);
    const [f, setF] = useState<MoneyFormState>(() => emptyForm(kind, options, today, prefill));
    const [errors, setErrors] = useState<FormErrors>({});
    const [confirm, setConfirm] = useState<{ sentence: string; shortfalls: VaultShortfall[] } | null>(null);
    const [addCategory, setAddCategory] = useState<string | null>(null);

    const check = useAction(checkMoneyAction);
    const save = useAction(postMoneyAction, {
        success: (d) => t("toast.receiptSaved", { number: d.receiptNo }),
        onSuccess: (d) => router.push(`/money/receipts/${d.entryId}`),
    });

    const update = (next: MoneyFormState, touched: string[]) => {
        setF(next);
        if (touched.some((k) => errors[k])) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !touched.includes(k))));
    };
    const set = (p: Partial<MoneyFormState>, touched: string[] = Object.keys(p)) => update({ ...f, ...p }, touched);

    const other = otherCurrency(f.currency);
    const usesTrader = kind === "receive_trader" || kind === "pay_trader";
    const usesParty = kind === "receive_party" || kind === "pay_party";
    const usesVault = kind !== "transfer" && kind !== "exchange";
    const canFx = kind === "receive_trader" || kind === "pay_party";

    const vaultItems = (c: Currency, exclude?: string | null) =>
        opts.vaults
            .filter((v) => v.allowedCurrencies.includes(c) && v.id !== exclude)
            .map((v) => ({ id: v.id, label: v.name, supportingText: formatMoney(v.balance[c], c) }));
    const traderItems = useMemo(() => opts.traders.map((x) => ({ id: x.id, label: x.name, supportingText: balanceWords(x.balance) })), [opts.traders]);
    const partyItems = useMemo(
        () =>
            opts.parties.map((x) => ({
                id: x.id,
                label: x.name,
                supportingText: balanceWords(x.balance)
                    .replace(/^له /, "المستحق لهم ")
                    .replace(/ · له /, " · المستحق لهم "),
            })),
        [opts.parties],
    );

    const changeCurrency = (c: Currency) => {
        const base: MoneyFormState = {
            ...f,
            currency: c,
            vaultId: vaultFor(opts, c, f.vaultId),
            fromVaultId: vaultFor(opts, c, f.fromVaultId),
            toVaultId:
                kind === "exchange"
                    ? vaultFor(opts, otherCurrency(c), f.toVaultId)
                    : f.toVaultId && opts.vaults.find((v) => v.id === f.toVaultId)?.allowedCurrencies.includes(c)
                      ? f.toVaultId
                      : null,
        };
        update(onAmountChange(base, f.amount), ["currency", "vaultId", "fromVaultId", "toVaultId"]);
    };

    const full = fullAmount(kind, f, opts);

    const onSave = async () => {
        const e = validateForm(kind, f);
        setErrors(e);
        if (Object.keys(e).length) {
            toast.error("راجع الحقول المعلّمة بالأحمر");
            requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-invalid] input, [data-invalid] button")?.focus());
            return;
        }
        toast.dismiss();
        const res = await check.run(toMoneyInput(kind, f, false));
        if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            return;
        }
        setConfirm({ sentence: formSentence(kind, f, opts), shortfalls: res.data });
    };

    const onConfirm = async () => {
        const res = await save.run(toMoneyInput(kind, f, !!confirm?.shortfalls.length));
        if (res.ok || !res.fieldErrors) return;
        if (res.fieldErrors.allowNegative) {
            setConfirm(null);
            return onSave();
        }
        setConfirm(null);
        setErrors(res.fieldErrors);
    };

    const fxToggle = canFx && (
        <div className="flex flex-col gap-4 border-t border-secondary pt-5">
            <Toggle
                size="md"
                label="الدفع بعملة أخرى"
                hint={
                    kind === "receive_trader"
                        ? `التاجر يدفع ${CURRENCY_NAME[f.currency]} عن دين ${CURRENCY_NAME[other]}`
                        : `ندفع ${CURRENCY_NAME[f.currency]} عن مستحق ${CURRENCY_NAME[other]}`
                }
                isSelected={f.fxOn}
                onChange={(on) => update(on ? onAmountChange({ ...f, fxOn: true }, f.amount) : { ...f, fxOn: false }, ["fx.debtAmount", "rate"])}
            />
            {f.fxOn && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                        label="سعر الصرف (دينار لكل دولار)"
                        size="lg"
                        inputMode="decimal"
                        inputClassName={numInput}
                        value={f.rate}
                        onChange={(v) => update(onRateChange(f, v), ["rate", "fx.debtAmount"])}
                        isInvalid={!!errors.rate}
                        hint={errors.rate ?? "يُملأ بآخر سعر استخدمته"}
                    />
                    <Input
                        label={kind === "receive_trader" ? `يُخصم من دينه ${CURRENCY_NAME[other]}` : `يُسدَّد من المستحق ${CURRENCY_NAME[other]}`}
                        size="lg"
                        inputMode="decimal"
                        inputClassName={numInput}
                        value={f.debtAmount}
                        onChange={(v) => update(onDebtChange(f, v), ["fx.debtAmount", "rate"])}
                        isInvalid={!!errors["fx.debtAmount"]}
                        hint={errors["fx.debtAmount"] ?? "يتغير السعر إذا عدّلت هذا المبلغ"}
                    />
                </div>
            )}
        </div>
    );

    return (
        <>
            <form
                noValidate
                className="flex w-full max-w-[40rem] flex-col gap-6 pb-28 lg:pb-8"
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave();
                }}
            >
                {usesTrader && (
                    <div className="flex flex-col gap-2" data-invalid={errors.traderId ? "" : undefined}>
                        <EntityCombobox
                            label="التاجر"
                            aria-label="التاجر"
                            isRequired
                            items={traderItems}
                            value={f.traderId}
                            onChange={(id) => set({ traderId: id })}
                            placeholder="اكتب اسم التاجر"
                            isInvalid={!!errors.traderId}
                            hint={errors.traderId}
                        />
                        {kind === "receive_trader" && full && (
                            <FullButton onPress={() => set({ ...full }, ["amount", "fx.debtAmount"])}>
                                تسديد الدين كاملاً ({formatMoney(f.fxOn ? (full.debtAmount ?? "0") : full.amount, f.fxOn ? other : f.currency)})
                            </FullButton>
                        )}
                    </div>
                )}

                {usesParty && (
                    <div className="flex flex-col gap-2" data-invalid={errors.partyId ? "" : undefined}>
                        <EntityCombobox
                            label="الجهة"
                            aria-label="الجهة"
                            isRequired
                            items={partyItems}
                            value={f.partyId}
                            onChange={(id) => set({ partyId: id })}
                            isInvalid={!!errors.partyId}
                            hint={errors.partyId}
                        />
                        {kind === "pay_party" && full && (
                            <FullButton onPress={() => set({ ...full }, ["amount", "fx.debtAmount"])}>
                                تسديد كامل المستحق ({formatMoney(f.fxOn ? (full.debtAmount ?? "0") : full.amount, f.fxOn ? other : f.currency)})
                            </FullButton>
                        )}
                    </div>
                )}

                {kind === "expense" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div data-invalid={errors.categoryId ? "" : undefined}>
                            <EntityCombobox
                                label="التصنيف"
                                aria-label="التصنيف"
                                isRequired
                                items={opts.categories.map((c) => ({ id: c.id, label: c.name }))}
                                value={f.categoryId}
                                onChange={(id) => set({ categoryId: id })}
                                addLabel="إضافة تصنيف جديد"
                                onAdd={(typed) => setAddCategory(typed)}
                                isInvalid={!!errors.categoryId}
                                hint={errors.categoryId}
                            />
                        </div>
                        <Input
                            label={optionalLabel("المستفيد")}
                            size="lg"
                            value={f.payee}
                            onChange={(v) => set({ payee: v })}
                            placeholder="مثلاً: صاحب المكتب"
                        />
                    </div>
                )}

                {kind === "exchange" ? (
                    <>
                        <fieldset className="flex flex-col gap-4">
                            <legend className="mb-4 text-md font-semibold text-primary">ما يخرج</legend>
                            <SegmentedControl label="العملة" value={f.currency} onChange={changeCurrency} options={CURRENCY_OPTIONS} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div data-invalid={errors.fromVaultId ? "" : undefined}>
                                    <SelectField
                                        label="من قاصة"
                                        isRequired
                                        items={vaultItems(f.currency)}
                                        value={f.fromVaultId}
                                        onChange={(id) => set({ fromVaultId: id })}
                                        isInvalid={!!errors.fromVaultId}
                                        hint={errors.fromVaultId}
                                    />
                                </div>
                                <div data-invalid={errors.fromAmount ? "" : undefined}>
                                    <Input
                                        label={`المبلغ ${CURRENCY_NAME[f.currency]}`}
                                        isRequired
                                        size="lg"
                                        inputMode="decimal"
                                        inputClassName={numInput}
                                        placeholder="0"
                                        value={f.amount}
                                        onChange={(v) => update(onAmountChange(f, v), ["fromAmount", "toAmount"])}
                                        isInvalid={!!errors.fromAmount}
                                        hint={errors.fromAmount}
                                    />
                                </div>
                            </div>
                        </fieldset>
                        <Input
                            label="سعر الصرف (دينار لكل دولار)"
                            size="lg"
                            inputMode="decimal"
                            inputClassName={numInput}
                            className="sm:max-w-[calc(50%-0.5rem)]"
                            value={f.rate}
                            onChange={(v) => update(onRateChange(f, v), ["rate", "toAmount"])}
                            isInvalid={!!errors.rate}
                            hint={errors.rate}
                        />
                        <fieldset className="flex flex-col gap-4 border-t border-secondary pt-5">
                            <legend className="sr-only">ما يدخل</legend>
                            <p aria-hidden="true" className="text-md font-semibold text-primary">
                                ما يدخل ({other === "USD" ? "دولار" : "دينار"})
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div data-invalid={errors.toVaultId ? "" : undefined}>
                                    <SelectField
                                        label="إلى قاصة"
                                        isRequired
                                        items={vaultItems(other)}
                                        value={f.toVaultId}
                                        onChange={(id) => set({ toVaultId: id })}
                                        isInvalid={!!errors.toVaultId}
                                        hint={errors.toVaultId ?? (vaultItems(other).length ? undefined : "لا توجد قاصة بهذه العملة")}
                                    />
                                </div>
                                <div data-invalid={errors.toAmount ? "" : undefined}>
                                    <Input
                                        label={`المبلغ المستلم ${CURRENCY_NAME[other]}`}
                                        isRequired
                                        size="lg"
                                        inputMode="decimal"
                                        inputClassName={numInput}
                                        placeholder="0"
                                        value={f.toAmount}
                                        onChange={(v) => update(onDebtChange(f, v), ["toAmount", "rate"])}
                                        isInvalid={!!errors.toAmount}
                                        hint={errors.toAmount ?? "يتغير السعر إذا عدّلت هذا المبلغ"}
                                    />
                                </div>
                            </div>
                        </fieldset>
                    </>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start" data-invalid={errors.amount ? "" : undefined}>
                        <Input
                            label="المبلغ"
                            isRequired
                            size="lg"
                            inputMode="decimal"
                            inputClassName={`${numInput} text-lg`}
                            placeholder="0"
                            value={f.amount}
                            onChange={(v) => update(onAmountChange(f, v), ["amount", "fx.debtAmount"])}
                            isInvalid={!!errors.amount}
                            hint={errors.amount}
                        />
                        <SegmentedControl label="العملة" value={f.currency} onChange={changeCurrency} options={CURRENCY_OPTIONS} />
                    </div>
                )}

                {usesVault && (
                    <div data-invalid={errors.vaultId ? "" : undefined}>
                        <SelectField
                            label={kind === "receive_trader" || kind === "receive_party" || kind === "deposit" ? "إلى قاصة" : "من قاصة"}
                            isRequired
                            items={vaultItems(f.currency)}
                            value={f.vaultId}
                            onChange={(id) => set({ vaultId: id })}
                            isInvalid={!!errors.vaultId}
                            hint={errors.vaultId ?? (vaultItems(f.currency).length ? undefined : "لا توجد قاصة بهذه العملة")}
                            placeholder="اختر القاصة"
                        />
                    </div>
                )}

                {kind === "transfer" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div data-invalid={errors.fromVaultId ? "" : undefined}>
                            <SelectField
                                label="من قاصة"
                                isRequired
                                items={vaultItems(f.currency)}
                                value={f.fromVaultId}
                                onChange={(id) => set({ fromVaultId: id, toVaultId: f.toVaultId === id ? null : f.toVaultId })}
                                isInvalid={!!errors.fromVaultId}
                                hint={errors.fromVaultId}
                            />
                        </div>
                        <div data-invalid={errors.toVaultId ? "" : undefined}>
                            <SelectField
                                label="إلى قاصة"
                                isRequired
                                items={vaultItems(f.currency, f.fromVaultId)}
                                value={f.toVaultId}
                                onChange={(id) => set({ toVaultId: id })}
                                isInvalid={!!errors.toVaultId}
                                hint={errors.toVaultId ?? (vaultItems(f.currency, f.fromVaultId).length ? undefined : "لا توجد قاصة أخرى بهذه العملة")}
                                placeholder="اختر القاصة"
                            />
                        </div>
                    </div>
                )}

                {fxToggle}

                {kind === "pay_trader" && <SegmentedControl label="السبب" value={f.payReason} onChange={(r) => set({ payReason: r })} options={REASONS} />}

                <div className="grid gap-4 border-t border-secondary pt-5 sm:grid-cols-2">
                    <div data-invalid={errors.date ? "" : undefined}>
                        <DateField
                            label="التاريخ"
                            aria-label="التاريخ"
                            isRequired
                            value={f.date}
                            onChange={(d) => set({ date: d })}
                            isInvalid={!!errors.date}
                            hint={errors.date}
                        />
                    </div>
                    <Input label={optionalLabel("ملاحظة")} size="lg" value={f.note} onChange={(v) => set({ note: v })} placeholder="تظهر على الوصل" />
                </div>

                <div className="no-print fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-secondary bg-primary/95 px-4 py-3 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-start">
                        <Button type="submit" size="lg" className="sm:min-w-48" isLoading={check.pending} showTextWhileLoading>
                            حفظ وإصدار الوصل
                        </Button>
                        <Button size="lg" color="tertiary" href="/money" className="max-sm:hidden">
                            {t("action.cancel")}
                        </Button>
                    </div>
                </div>
            </form>

            <AppDialog
                isOpen={!!confirm}
                onOpenChange={(o) => !o && !save.pending && setConfirm(null)}
                isDismissable={!save.pending}
                size="md"
                title="تأكيد العملية"
                footer={
                    <>
                        <Button size="lg" color="secondary" onClick={() => setConfirm(null)} isDisabled={save.pending}>
                            رجوع
                        </Button>
                        <Button size="lg" onClick={onConfirm} isLoading={save.pending} showTextWhileLoading>
                            {confirm?.shortfalls.length ? "نعم، احفظ رغم ذلك" : "تأكيد وحفظ"}
                        </Button>
                    </>
                }
            >
                {confirm && (
                    <>
                        <p className="text-lg text-primary">{confirm.sentence}</p>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-secondary py-3 text-md">
                            <dt className="text-tertiary">التاريخ</dt>
                            <dd className="text-primary">
                                <bdi className="num">{f.date ? formatDate(f.date) : "—"}</bdi>
                            </dd>
                            <dt className="text-tertiary">الوصل</dt>
                            <dd className="text-primary">{RECEIPT_WORD[kind]}</dd>
                            {f.note.trim() && (
                                <>
                                    <dt className="text-tertiary">ملاحظة</dt>
                                    <dd className="text-primary">{f.note.trim()}</dd>
                                </>
                            )}
                        </dl>
                        {confirm.shortfalls.length > 0 && (
                            <div
                                className="ring-warning-200 flex gap-3 rounded-lg bg-warning-primary p-3 text-sm text-warning-primary ring-1 ring-inset"
                                role="alert"
                            >
                                <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
                                <div className="flex flex-col gap-1">
                                    {confirm.shortfalls.map((s) => (
                                        <p key={`${s.vaultId}:${s.currency}`}>
                                            رصيد «{s.vaultName}» سيصبح <bdi className="num">{formatMoney(s.after, s.currency)}</bdi>.
                                        </p>
                                    ))}
                                    <p className="font-semibold">{t("warn.negativeVault")}</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </AppDialog>

            <QuickAddDialog
                kind="expense_categories"
                isOpen={addCategory !== null}
                onOpenChange={(o) => !o && setAddCategory(null)}
                initialName={addCategory ?? ""}
                onCreated={(c) => {
                    setOpts((o) => ({ ...o, categories: [...o.categories, c] }));
                    set({ categoryId: c.id });
                }}
            />
        </>
    );
}

function FullButton({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
    return (
        <Button size="md" color="link-color" className="self-start" onClick={onPress}>
            {children}
        </Button>
    );
}
