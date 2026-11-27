"use client";

import { type ReactNode, createContext, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, Trash01 } from "@untitledui/icons";
import { Checkbox as AriaCheckbox } from "react-aria-components";
import { toast } from "sonner";
import { AppDialog } from "@/components/app/app-dialog";
import { DateField } from "@/components/app/date-field";
import { optionalLabel } from "@/components/app/field-label";
import { IconButton } from "@/components/app/icon-button";
import { SegmentedControl } from "@/components/app/segmented-control";
import { SelectField } from "@/components/app/select-field";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";
import { CheckboxBase } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import type { Currency } from "@/db/schema";
import { addChargesAction, checkVaultsAction } from "@/features/charges/actions";
import type { ChargeSheetData } from "@/features/charges/queries";
import { type SheetRow, confirmSentence, newRow, rowPreview, sheetSummary, toInput, vaultFor, vaultOutflows } from "@/features/charges/sheet-model";
import type { VaultShortfall } from "@/features/ledger/vault-check";
import { useAction } from "@/hooks/use-action";
import { formatDate, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { parseAmount } from "@/lib/money";
import { cx } from "@/utils/cx";

export interface ChargePrefill {
    chargeTypeId: string;
    row: Partial<SheetRow>;
}

type Errors = Record<string, Partial<Record<"amount" | "paidByPartyId" | "vaultId" | "splitTraderId" | "manual" | "chargeTypeId", string>>>;

const CURRENCY_OPTIONS = [
    { value: "IQD" as const, label: "دينار" },
    { value: "USD" as const, label: "دولار" },
];
const SPLIT_OPTIONS = [
    { value: "by_share" as const, label: "حسب الحصص" },
    { value: "single_trader" as const, label: "على تاجر واحد" },
    { value: "manual" as const, label: "يدوي" },
];

const moneyLine = (x: Record<Currency, string>) =>
    (["USD", "IQD"] as Currency[])
        .filter((c) => Number(x[c]) !== 0)
        .map((c) => formatMoney(x[c], c))
        .join(" و ");

// ── Opening the sheet from anywhere on the container page ────────────────────
const SheetContext = createContext<{ open: (prefill?: ChargePrefill) => void; canAdd: boolean }>({ open: () => {}, canAdd: false });
export const useChargesSheet = () => useContext(SheetContext);

/** Holds the sheet for one container; any AddChargesButton below opens it. `data` is null for a cancelled container. */
export function ChargesSheetProvider({ data, today, children }: { data: ChargeSheetData | null; today: string; children: ReactNode }) {
    const [state, setState] = useState<{ isOpen: boolean; key: number; prefill: ChargePrefill | null }>({ isOpen: false, key: 0, prefill: null });
    const value = useMemo(
        () => ({ open: (prefill?: ChargePrefill) => setState((s) => ({ isOpen: true, key: s.key + 1, prefill: prefill ?? null })), canAdd: !!data }),
        [data],
    );
    return (
        <SheetContext.Provider value={value}>
            {children}
            {data && (
                <ChargesSheet
                    key={state.key}
                    data={data}
                    today={today}
                    prefill={state.prefill}
                    isOpen={state.isOpen}
                    onClose={() => setState((s) => ({ ...s, isOpen: false }))}
                />
            )}
        </SheetContext.Provider>
    );
}

export function AddChargesButton({
    color = "primary",
    size = "lg",
    className,
    children,
}: {
    color?: "primary" | "secondary";
    size?: "md" | "lg";
    className?: string;
    children?: ReactNode;
}) {
    const { open, canAdd } = useChargesSheet();
    if (!canAdd) return null;
    return (
        <Button size={size} color={color} iconLeading={Plus} onClick={() => open()} className={className}>
            {children ?? t("action.addCharges")}
        </Button>
    );
}

// ── The sheet (PRD §5.4) ─────────────────────────────────────────────────────
function ChargesSheet({
    data,
    today,
    prefill,
    isOpen,
    onClose,
}: {
    data: ChargeSheetData;
    today: string;
    prefill: ChargePrefill | null;
    isOpen: boolean;
    onClose: () => void;
}) {
    const c = data.container;
    const [date, setDate] = useState<string | null>(today);
    const [rows, setRows] = useState<Record<string, SheetRow>>(() => {
        const type = prefill && data.chargeTypes.find((x) => x.id === prefill.chargeTypeId);
        return type ? { [type.id]: { ...newRow(type, data), ...prefill!.row } } : {};
    });
    const [errors, setErrors] = useState<Errors>({});
    const [confirm, setConfirm] = useState<{ sentence: string; shortfalls: VaultShortfall[] } | null>(null);
    const [leaving, setLeaving] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);
    const order = data.chargeTypes.filter((x) => rows[x.id]).map((x) => x.id);
    const summary = sheetSummary(data, order, rows);
    const usual = data.chargeTypes.filter((x) => x.defaultAmount);

    const save = useAction(addChargesAction, {
        success: (r) => (r.receiptNos.length ? `تم حفظ المصاريف · رقم الوصل ${r.receiptNos.join("، ")}` : "تم حفظ المصاريف"),
        onSuccess: () => {
            setConfirm(null);
            onClose();
        },
    });
    const check = useAction(checkVaultsAction);

    const toggle = (id: string, on: boolean) => {
        setRows((r) => {
            const next = { ...r };
            if (on)
                next[id] = newRow(
                    data.chargeTypes.find((x) => x.id === id)!,
                    data,
                );
            else delete next[id];
            return next;
        });
        setErrors((e) => ({ ...e, [id]: {} }));
    };
    const patch = (id: string, p: Partial<SheetRow>) => {
        setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));
        setErrors((e) => ({ ...e, [id]: Object.fromEntries(Object.entries(e[id] ?? {}).filter(([k]) => !(k in p) && !(k === "manual" && "amount" in p))) }));
    };
    const tickUsual = () => setRows((r) => Object.fromEntries([...Object.entries(r), ...usual.filter((x) => !r[x.id]).map((x) => [x.id, newRow(x, data)])]));

    const validate = (): Errors => {
        const out: Errors = {};
        for (const id of order) {
            const row = rows[id];
            const type = data.chargeTypes.find((x) => x.id === id)!;
            const e: Errors[string] = {};
            const amount = parseAmount(row.amount, row.currency);
            if (amount === null || Number(amount) <= 0) e.amount = "اكتب المبلغ";
            if (!type.isFee && !row.paidByPartyId) e.paidByPartyId = "اختر من دفع المبلغ";
            if (!type.isFee && data.parties.find((p) => p.id === row.paidByPartyId)?.isSelf && !row.vaultId) e.vaultId = "اختر القاصة التي دُفع منها";
            if (c.isShared && row.splitMode === "single_trader" && !row.splitTraderId) e.splitTraderId = "اختر التاجر";
            if (c.isShared && !e.amount) {
                const p = rowPreview(row, data);
                if (p.kind === "remaining")
                    e.manual = t("error.manualSplitTotal", { total: formatMoney(amount!, row.currency), remaining: formatMoney(p.remaining, row.currency) });
            }
            if (Object.keys(e).length) out[id] = e;
        }
        return out;
    };

    const scrollToFirstError = () =>
        requestAnimationFrame(() => {
            const el = bodyRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], [data-row-error]");
            el?.scrollIntoView({ block: "center", behavior: "smooth" });
            if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
        });

    const onSave = async () => {
        const e = validate();
        setErrors(e);
        if (!date) return toast.error("اختر التاريخ");
        if (Object.keys(e).length) {
            toast.error("راجع الحقول المعلّمة بالأحمر");
            return scrollToFirstError();
        }
        toast.dismiss();
        const res = await check.run(vaultOutflows(data, order, rows));
        if (!res.ok) return;
        setConfirm({ sentence: confirmSentence(data, order, rows), shortfalls: res.data });
    };

    const onConfirm = async () => {
        const res = await save.run(toInput(data, date!, order, rows, !!confirm?.shortfalls.length));
        if (res.ok || !res.fieldErrors) return;
        // Server errors come back as rows.<index>.<field>; put them on the right row.
        const mapped: Errors = {};
        for (const [key, msg] of Object.entries(res.fieldErrors)) {
            const m = key.match(/^rows\.(\d+)\.(\w+)$/);
            if (m && order[Number(m[1])]) mapped[order[Number(m[1])]] = { ...mapped[order[Number(m[1])]], [m[2]]: msg };
        }
        if (Object.keys(mapped).length) {
            setConfirm(null);
            setErrors(mapped);
            scrollToFirstError();
        }
    };

    const requestClose = () => (order.length ? setLeaving(true) : onClose());

    return (
        <>
            <SlideoutMenu
                isOpen={isOpen}
                onOpenChange={(o) => !o && requestClose()}
                isDismissable={false}
                isKeyboardDismissDisabled={order.length > 0}
                dialogLabel={`إضافة مصاريف على الحاوية ${c.containerNumber}`}
                sheetClassName="max-w-none md:max-w-[42rem]"
            >
                <SlideoutMenu.Header onClose={requestClose}>
                    <h2 className="text-lg font-semibold text-primary">إضافة مصاريف</h2>
                    <p className="mt-0.5 text-md text-tertiary">
                        على الحاوية <bdi className="cn">{c.containerNumber}</bdi>
                        {c.isShared ? ` · مشتركة بين ${c.shares.map((s) => s.name).join(" و ")}` : c.shares[0] ? ` · ${c.shares[0].name}` : ""}
                    </p>
                </SlideoutMenu.Header>
                <SlideoutMenu.Content>
                    <div ref={bodyRef} className="flex flex-col gap-6 pb-2">
                        <div className="max-w-xs">
                            <DateField label="التاريخ" isRequired value={date} onChange={setDate} hint={date === today ? "اليوم" : undefined} />
                        </div>

                        <section aria-labelledby="ct-title" className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 id="ct-title" className="text-md font-semibold text-secondary">
                                    ما الذي دُفع على الحاوية؟
                                </h3>
                                {usual.length > 0 && (
                                    <Button size="md" color="link-color" onClick={tickUsual} isDisabled={usual.every((x) => rows[x.id])}>
                                        {t("action.usualCharges")}
                                    </Button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {data.chargeTypes.map((type) => (
                                    <AriaCheckbox
                                        key={type.id}
                                        isSelected={!!rows[type.id]}
                                        onChange={(on) => toggle(type.id, on)}
                                        className={({ isSelected }) =>
                                            cx(
                                                "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 ring-1 transition-[background-color,box-shadow,transform] duration-150 ease-smooth select-none ring-inset data-pressed:scale-[0.98]",
                                                isSelected ? "bg-brand-primary_alt ring-brand-300" : "bg-primary ring-primary hover:bg-primary_hover",
                                            )
                                        }
                                    >
                                        {({ isSelected, isFocusVisible }) => (
                                            <>
                                                <CheckboxBase size="md" isSelected={isSelected} isFocusVisible={isFocusVisible} />
                                                <span className="flex min-w-0 flex-col">
                                                    <span className={cx("text-md text-primary", isSelected && "font-semibold")}>{type.name}</span>
                                                    <span className="truncate text-sm text-tertiary">
                                                        {type.isFee ? "ربح الشركة" : (data.parties.find((p) => p.id === type.defaultPartyId)?.name ?? "")}
                                                        {type.defaultAmount && (
                                                            <>
                                                                {" · "}
                                                                <bdi className="num">{formatMoney(type.defaultAmount, type.defaultCurrency)}</bdi>
                                                            </>
                                                        )}
                                                    </span>
                                                </span>
                                            </>
                                        )}
                                    </AriaCheckbox>
                                ))}
                            </div>
                        </section>

                        {order.length > 0 && (
                            <ol className="flex flex-col divide-y divide-secondary border-y border-secondary">
                                {order.map((id) => (
                                    <ChargeRowEditor
                                        key={id}
                                        data={data}
                                        type={data.chargeTypes.find((x) => x.id === id)!}
                                        row={rows[id]}
                                        errors={errors[id] ?? {}}
                                        onChange={(p) => patch(id, p)}
                                        onRemove={() => toggle(id, false)}
                                    />
                                ))}
                            </ol>
                        )}

                        {order.length === 0 && (
                            <p className="rounded-xl bg-secondary px-4 py-5 text-center text-md text-tertiary">
                                اختر نوع المصروف من المربعات أعلاه، ثم اكتب المبلغ.
                            </p>
                        )}
                    </div>
                </SlideoutMenu.Content>
                <SlideoutMenu.Footer className="flex flex-col gap-3">
                    {summary.count > 0 && (
                        <div className="flex flex-col gap-1 text-md" aria-live="polite">
                            <p className="flex flex-wrap items-baseline justify-between gap-x-4">
                                <span className="text-secondary">المجموع</span>
                                <bdi className="num text-lg font-semibold text-primary">{moneyLine(summary.total) || "—"}</bdi>
                            </p>
                            {moneyLine(summary.fees) && (
                                <p className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-tertiary">
                                    <span>منها أتعاب (ربح الشركة)</span>
                                    <bdi className="num">{moneyLine(summary.fees)}</bdi>
                                </p>
                            )}
                            {c.isShared &&
                                c.shares.map((s) => (
                                    <p key={s.traderId} className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-tertiary">
                                        <span>على {s.name}</span>
                                        <bdi className="num">{summary.perTrader[s.traderId] ? moneyLine(summary.perTrader[s.traderId]) || "0" : "0"}</bdi>
                                    </p>
                                ))}
                            {summary.unsplit > 0 && <p className="text-sm text-warning-primary">توزيع بعض المبالغ على التجار لم يكتمل بعد.</p>}
                        </div>
                    )}
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Button size="lg" color="secondary" onClick={requestClose}>
                            {t("action.cancel")}
                        </Button>
                        <Button size="lg" onClick={onSave} isDisabled={!order.length} isLoading={check.pending} showTextWhileLoading>
                            حفظ المصاريف
                        </Button>
                    </div>
                </SlideoutMenu.Footer>
            </SlideoutMenu>

            <AppDialog
                isOpen={!!confirm}
                onOpenChange={(o) => !o && !save.pending && setConfirm(null)}
                isDismissable={!save.pending}
                size="md"
                title="تأكيد حفظ المصاريف"
                footer={
                    <>
                        <Button size="lg" color="secondary" onClick={() => setConfirm(null)} isDisabled={save.pending}>
                            رجوع
                        </Button>
                        <Button size="lg" onClick={onConfirm} isLoading={save.pending} showTextWhileLoading>
                            {confirm?.shortfalls.length ? "نعم، احفظ رغم ذلك" : "نعم، احفظ المصاريف"}
                        </Button>
                    </>
                }
            >
                {confirm && (
                    <>
                        <p className="text-md text-primary">{confirm.sentence}</p>
                        <ul className="flex flex-col divide-y divide-secondary border-y border-secondary text-sm">
                            {order.map((id) => {
                                const row = rows[id];
                                const type = data.chargeTypes.find((x) => x.id === id)!;
                                const payer = type.isFee ? "ربح الشركة" : data.parties.find((p) => p.id === row.paidByPartyId)?.name;
                                const vault = data.parties.find((p) => p.id === row.paidByPartyId)?.isSelf
                                    ? data.vaults.find((v) => v.id === row.vaultId)?.name
                                    : null;
                                return (
                                    <li key={id} className="flex items-baseline justify-between gap-3 py-2">
                                        <span className="min-w-0 text-secondary">
                                            {type.name}
                                            <span className="text-tertiary">
                                                {" · "}
                                                {payer}
                                                {vault ? ` · ${vault}` : ""}
                                            </span>
                                        </span>
                                        <bdi className="num shrink-0 text-primary">
                                            {formatMoney(parseAmount(row.amount, row.currency) ?? "0", row.currency)}
                                        </bdi>
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="text-sm text-tertiary">
                            التاريخ: <bdi className="num">{date ? formatDate(date) : "—"}</bdi>
                        </p>
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

            <AppDialog
                isOpen={leaving}
                onOpenChange={setLeaving}
                size="sm"
                title="تجاهل المصاريف؟"
                description="لم تُحفظ المصاريف التي اخترتها بعد."
                footer={
                    <>
                        <Button size="lg" color="secondary" onClick={() => setLeaving(false)}>
                            متابعة
                        </Button>
                        <Button
                            size="lg"
                            color="primary-destructive"
                            onClick={() => {
                                setLeaving(false);
                                onClose();
                            }}
                        >
                            تجاهل وإغلاق
                        </Button>
                    </>
                }
            />
        </>
    );
}

function ChargeRowEditor({
    data,
    type,
    row,
    errors,
    onChange,
    onRemove,
}: {
    data: ChargeSheetData;
    type: ChargeSheetData["chargeTypes"][number];
    row: SheetRow;
    errors: Errors[string];
    onChange: (p: Partial<SheetRow>) => void;
    onRemove: () => void;
}) {
    const c = data.container;
    const [showNote, setShowNote] = useState(!!row.note);
    const payerIsSelf = !!data.parties.find((p) => p.id === row.paidByPartyId)?.isSelf;
    const partyItems = useMemo(() => data.parties.map((p) => ({ id: p.id, label: p.name })), [data.parties]);
    const vaultItems = useMemo(
        () => data.vaults.filter((v) => v.allowedCurrencies.includes(row.currency)).map((v) => ({ id: v.id, label: v.name })),
        [data.vaults, row.currency],
    );
    const traderItems = useMemo(() => c.shares.map((s) => ({ id: s.traderId, label: s.name })), [c.shares]);
    const preview = c.isShared ? rowPreview(row, data) : null;
    const name = (id: string) => c.shares.find((s) => s.traderId === id)?.name ?? "";

    return (
        <li className="flex flex-col gap-4 py-5" data-row-error={Object.keys(errors).length ? "" : undefined}>
            <div className="flex items-center justify-between gap-3">
                <h4 className="text-md font-semibold text-primary">
                    {type.name}
                    {type.isFee && <span className="ms-2 rounded-full bg-success-primary px-2 py-0.5 text-xs text-success-primary">ربح</span>}
                </h4>
                <IconButton icon={Trash01} label={`إزالة ${type.name}`} tone="danger" onPress={onRemove} />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <Input
                    label="المبلغ"
                    isRequired
                    size="lg"
                    inputMode="decimal"
                    inputClassName="num [direction:ltr] text-end"
                    placeholder="0"
                    value={row.amount}
                    onChange={(v) => onChange({ amount: v })}
                    isInvalid={!!errors.amount}
                    hint={errors.amount}
                />
                <SegmentedControl
                    label="العملة"
                    value={row.currency}
                    onChange={(cur) => onChange({ currency: cur, vaultId: payerIsSelf ? vaultFor(data, cur, row.vaultId) : row.vaultId })}
                    options={CURRENCY_OPTIONS}
                />
            </div>

            {type.isFee ? (
                <p className="text-sm text-tertiary">الأتعاب ربح للشركة: تُسجَّل على التاجر ولا يدفعها أحد.</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                        label="من دفع المبلغ؟"
                        isRequired
                        items={partyItems}
                        value={row.paidByPartyId}
                        onChange={(id) => {
                            const self = !!data.parties.find((p) => p.id === id)?.isSelf;
                            onChange({ paidByPartyId: id, vaultId: self ? vaultFor(data, row.currency, row.vaultId) : null });
                        }}
                        isInvalid={!!errors.paidByPartyId}
                        hint={errors.paidByPartyId}
                    />
                    {payerIsSelf && (
                        <SelectField
                            label="من أي قاصة؟"
                            isRequired
                            items={vaultItems}
                            value={row.vaultId}
                            onChange={(id) => onChange({ vaultId: id })}
                            isInvalid={!!errors.vaultId}
                            hint={errors.vaultId ?? (vaultItems.length ? "يصدر لها وصل صرف" : "لا توجد قاصة بهذه العملة")}
                            placeholder="اختر القاصة"
                        />
                    )}
                </div>
            )}

            {c.isShared && (
                <div className="flex flex-col gap-3">
                    <SegmentedControl
                        label="التوزيع على التجار"
                        value={row.splitMode}
                        onChange={(m) => onChange({ splitMode: m })}
                        options={SPLIT_OPTIONS}
                        size="md"
                    />
                    {row.splitMode === "single_trader" && (
                        <SelectField
                            label="على أي تاجر؟"
                            isRequired
                            items={traderItems}
                            value={row.splitTraderId}
                            onChange={(id) => onChange({ splitTraderId: id })}
                            isInvalid={!!errors.splitTraderId}
                            hint={errors.splitTraderId}
                            className="sm:max-w-xs"
                        />
                    )}
                    {row.splitMode === "manual" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {c.shares.map((s) => (
                                <Input
                                    key={s.traderId}
                                    label={s.name}
                                    size="lg"
                                    inputMode="decimal"
                                    inputClassName="num [direction:ltr] text-end"
                                    placeholder="0"
                                    value={row.manual[s.traderId] ?? ""}
                                    onChange={(v) => onChange({ manual: { ...row.manual, [s.traderId]: v } })}
                                    isInvalid={!!errors.manual}
                                />
                            ))}
                        </div>
                    )}
                    {preview?.kind === "parts" && (
                        <p className="text-sm text-tertiary">
                            {preview.parts.map((p, i) => (
                                <span key={p.traderId}>
                                    {i > 0 && " · "}
                                    {name(p.traderId)} <bdi className="num text-secondary">{formatMoney(p.amount, row.currency)}</bdi>
                                </span>
                            ))}
                        </p>
                    )}
                    {preview?.kind === "remaining" && (
                        <p className={cx("text-sm", errors.manual ? "text-error-primary" : "text-warning-primary")} aria-live="polite">
                            المتبقي: <bdi className="num font-semibold">{formatMoney(preview.remaining, row.currency)}</bdi>
                        </p>
                    )}
                    {errors.manual && preview?.kind !== "remaining" && <p className="text-sm text-error-primary">{errors.manual}</p>}
                </div>
            )}

            {showNote ? (
                <Input
                    label={optionalLabel("ملاحظة")}
                    size="lg"
                    value={row.note}
                    onChange={(v) => onChange({ note: v })}
                    placeholder="مثال: رقم وصل الكمرك"
                    autoFocus={!row.note}
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setShowNote(true)}
                    className="inline-flex cursor-pointer items-center gap-1 self-start rounded-md text-sm text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2"
                >
                    <Plus className="size-4" aria-hidden="true" />
                    إضافة ملاحظة
                </button>
            )}
        </li>
    );
}
