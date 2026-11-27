"use client";

import { type ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, Receipt, Settings01, Star01, Trash01 } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppDialog } from "@/components/app/app-dialog";
import { DateField } from "@/components/app/date-field";
import { optionalLabel } from "@/components/app/field-label";
import { IconButton } from "@/components/app/icon-button";
import { IconTile } from "@/components/app/icon-tile";
import { StepBar } from "@/components/app/step-bar";
import { SegmentedControl } from "@/components/app/segmented-control";
import { SelectField } from "@/components/app/select-field";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import type { Currency } from "@/db/schema";
import { addChargesAction, checkVaultsAction } from "@/features/charges/actions";
import type { ChargeSheetData } from "@/features/charges/queries";
import {
    type SheetRow,
    branchDinar,
    confirmSentence,
    isBranch,
    newRow,
    payerVault,
    paysFromVault,
    rowPreview,
    sheetSummary,
    toInput,
    vaultOutflows,
} from "@/features/charges/sheet-model";
import type { VaultShortfall } from "@/features/ledger/vault-check";
import { setChargeTypeDefaultLineAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";
import { formatDate, formatMoney } from "@/lib/format";
import { t } from "@/lib/i18n";
import { parseAmount } from "@/lib/money";
import { cx } from "@/utils/cx";

export interface ChargePrefill {
    chargeTypeId: string;
    row: Partial<SheetRow>;
}

type Errors = Record<string, Partial<Record<"amount" | "paidByPartyId" | "vaultId" | "fxRate" | "splitTraderId" | "manual" | "chargeTypeId", string>>>;

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

/**
 * Holds the sheet for one container; any AddChargesButton below opens it. `data` is null for a cancelled container.
 * `startInFlow`: the container was just added, so the sheet opens by itself as step 2 of adding a container.
 */
export function ChargesSheetProvider({ data, today, startInFlow = false, children }: { data: ChargeSheetData | null; today: string; startInFlow?: boolean; children: ReactNode }) {
    const router = useRouter();
    const [state, setState] = useState<{ isOpen: boolean; key: number; prefill: ChargePrefill | null; flow: boolean }>({
        isOpen: false,
        key: 0,
        prefill: null,
        flow: false,
    });
    useEffect(() => {
        if (!startInFlow || !data) return;
        setState((s) => ({ isOpen: true, key: s.key + 1, prefill: null, flow: true }));
        // Drop ?new=1 so a refresh doesn't open the step again.
        router.replace(window.location.pathname, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startInFlow]);
    const value = useMemo(
        () => ({ open: (prefill?: ChargePrefill) => setState((s) => ({ isOpen: true, key: s.key + 1, prefill: prefill ?? null, flow: false })), canAdd: !!data }),
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
                    flow={state.flow}
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
    data: initialData,
    today,
    prefill,
    flow,
    isOpen,
    onClose,
}: {
    data: ChargeSheetData;
    today: string;
    prefill: ChargePrefill | null;
    /** Opened as step 2 right after adding the container. */
    flow: boolean;
    isOpen: boolean;
    onClose: () => void;
}) {
    // The expense types live here too, so marking a line as default shows at once.
    const [types, setTypes] = useState(initialData.chargeTypes);
    const data = useMemo(() => ({ ...initialData, chargeTypes: types }), [initialData, types]);
    const c = data.container;
    const [date, setDate] = useState<string | null>(today);
    // Opens with the default lines already there (or the one line asked for), so nothing is typed twice.
    const [rows, setRows] = useState<Record<string, SheetRow>>(() => {
        const type = prefill && initialData.chargeTypes.find((x) => x.id === prefill.chargeTypeId);
        if (type) return { [type.id]: { ...newRow(type, initialData), ...prefill!.row } };
        return Object.fromEntries(initialData.chargeTypes.filter((x) => x.isDefaultLine).map((x) => [x.id, newRow(x, initialData)]));
    });
    const [added, setAdded] = useState<string[]>(() => Object.keys(rows));
    const [dirty, setDirty] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [confirm, setConfirm] = useState<{ sentence: string; shortfalls: VaultShortfall[] } | null>(null);
    const [leaving, setLeaving] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);
    // Lines stay in the order they were added; a new line goes to the bottom.
    const order = added.filter((id) => rows[id] && types.some((x) => x.id === id));
    const summary = sheetSummary(data, order, rows);
    const available = types.filter((x) => !rows[x.id]);

    const save = useAction(addChargesAction, {
        success: (r) =>
            (flow ? "تم! أُضيفت الحاوية ومصاريفها" : "تم حفظ المصاريف") + (r.receiptNos.length ? ` · رقم الوصل ${r.receiptNos.join("، ")}` : ""),
        onSuccess: () => {
            setConfirm(null);
            onClose();
        },
    });
    const check = useAction(checkVaultsAction);
    const pin = useAction(setChargeTypeDefaultLineAction);

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
        setAdded((a) => (on ? [...a.filter((x) => x !== id), id] : a.filter((x) => x !== id)));
        setErrors((e) => ({ ...e, [id]: {} }));
        if (on) requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLInputElement>(`[data-line="${id}"] input`)?.focus());
    };

    /** Star: this line (with the currency it shows now) opens by itself next time. Star again to stop that. */
    const togglePin = async (id: string) => {
        const type = types.find((x) => x.id === id);
        if (!type) return;
        const on = !type.isDefaultLine;
        const currency = rows[id]?.currency ?? type.defaultCurrency;
        const res = await pin.run({ id, isDefaultLine: on, defaultCurrency: on ? currency : undefined });
        if (!res.ok) return;
        setTypes((list) => list.map((x) => (x.id === id ? { ...x, isDefaultLine: on, defaultCurrency: on ? currency : x.defaultCurrency } : x)));
        toast.success(on ? `«${type.name}» سطر افتراضي الآن: يظهر وحده في كل مرة` : `«${type.name}» لم يعد سطراً افتراضياً`);
    };

    /** Save the currency this line shows now as the type's default currency. */
    const saveCurrency = async (id: string) => {
        const type = types.find((x) => x.id === id);
        const currency = rows[id]?.currency;
        if (!type || !currency) return;
        const res = await pin.run({ id, isDefaultLine: type.isDefaultLine, defaultCurrency: currency });
        if (!res.ok) return;
        setTypes((list) => list.map((x) => (x.id === id ? { ...x, defaultCurrency: currency } : x)));
        toast.success(`عملة «${type.name}» الافتراضية: ${currency === "USD" ? "دولار" : "دينار"}`);
    };
    const patch = (id: string, p: Partial<SheetRow>) => {
        setDirty(true);
        setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));
        setErrors((e) => ({ ...e, [id]: Object.fromEntries(Object.entries(e[id] ?? {}).filter(([k]) => !(k in p) && !(k === "manual" && "amount" in p))) }));
    };

    const validate = (): Errors => {
        const out: Errors = {};
        for (const id of order) {
            const row = rows[id];
            const type = data.chargeTypes.find((x) => x.id === id)!;
            const e: Errors[string] = {};
            const amount = parseAmount(row.amount, row.currency);
            if (amount === null || Number(amount) <= 0) e.amount = "اكتب المبلغ";
            if (!type.isFee && !row.paidByPartyId) e.paidByPartyId = "اختر من دفع المبلغ";
            if (!type.isFee && paysFromVault(data, row.paidByPartyId) && !row.vaultId) e.vaultId = "اختر القاصة التي دُفع منها";
            if (!type.isFee && isBranch(data, row.paidByPartyId) && row.currency === "USD" && !e.amount && !branchDinar(data, row))
                e.fxRate = "اكتب سعر الدولار: قاصة الشراكة بالدينار فقط";
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

    // Ask before throwing away only when the owner actually typed or changed something.
    const requestClose = () => (dirty ? setLeaving(true) : onClose());

    return (
        <>
            <SlideoutMenu
                isOpen={isOpen}
                onOpenChange={(o) => !o && requestClose()}
                isDismissable={false}
                isKeyboardDismissDisabled={dirty}
                dialogLabel={`إضافة مصاريف على الحاوية ${c.containerNumber}`}
                sheetClassName="max-w-none md:max-w-[44rem]"
            >
                <SlideoutMenu.Header onClose={requestClose}>
                    <div className="flex items-center gap-3">
                        <IconTile icon={Receipt} color="pink" size="lg" />
                        <div className="flex min-w-0 flex-col">
                            <h2 className="text-lg font-semibold text-primary">{flow ? "الخطوة 2: مصاريف الحاوية" : "إضافة مصاريف"}</h2>
                            <p className="text-md text-tertiary">
                                على الحاوية <bdi className="cn">{c.containerNumber}</bdi>
                                {c.isShared ? ` · مشتركة بين ${c.shares.map((s) => s.name).join(" و ")}` : c.shares[0] ? ` · ${c.shares[0].name}` : ""}
                            </p>
                        </div>
                    </div>
                    {flow && <StepBar current={1} className="mt-4" />}
                </SlideoutMenu.Header>
                <SlideoutMenu.Content>
                    <div ref={bodyRef} className="flex flex-col gap-5 pb-2">
                        <div className="max-w-xs">
                            <DateField label="التاريخ" isRequired value={date} onChange={setDate} hint={date === today ? "اليوم" : undefined} />
                        </div>

                        {order.length > 0 ? (
                            <ol aria-label="سطور المصاريف" className="flex flex-col gap-3">
                                {order.map((id) => (
                                    <ChargeRowEditor
                                        key={id}
                                        data={data}
                                        type={types.find((x) => x.id === id)!}
                                        row={rows[id]}
                                        errors={errors[id] ?? {}}
                                        onChange={(p) => patch(id, p)}
                                        onRemove={() => {
                                            setDirty(true);
                                            toggle(id, false);
                                        }}
                                        onTogglePin={() => togglePin(id)}
                                        onSaveCurrency={() => saveCurrency(id)}
                                        isSavingPin={pin.pending}
                                    />
                                ))}
                            </ol>
                        ) : (
                            <div className="flex flex-col items-center gap-2 rounded-2xl bg-secondary px-4 py-8 text-center">
                                <IconTile icon={Receipt} color="gray" size="lg" />
                                <p className="text-md text-secondary">لا توجد سطور بعد. اضغط «إضافة سطر» واختر نوع المصروف.</p>
                                <p className="text-sm text-tertiary">علّم السطر بالنجمة ليظهر وحده في كل مرة.</p>
                            </div>
                        )}

                        <AddLineMenu
                            types={available}
                            parties={data.parties}
                            onAdd={(id) => {
                                setDirty(true);
                                toggle(id, true);
                            }}
                        />
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
                            {flow ? "تخطي الآن" : t("action.cancel")}
                        </Button>
                        <Button size="xl" onClick={onSave} isDisabled={!order.length} isLoading={check.pending} showTextWhileLoading>
                            {flow ? "حفظ المصاريف وإنهاء" : "حفظ المصاريف"}
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
                                const vault = paysFromVault(data, row.paidByPartyId) ? data.vaults.find((v) => v.id === row.vaultId)?.name : null;
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
    onTogglePin,
    onSaveCurrency,
    isSavingPin,
}: {
    data: ChargeSheetData;
    type: ChargeSheetData["chargeTypes"][number];
    row: SheetRow;
    errors: Errors[string];
    onChange: (p: Partial<SheetRow>) => void;
    onRemove: () => void;
    onTogglePin: () => void;
    onSaveCurrency: () => void;
    isSavingPin: boolean;
}) {
    const c = data.container;
    const [showNote, setShowNote] = useState(!!row.note);
    const payerIsSelf = !!data.parties.find((p) => p.id === row.paidByPartyId)?.isSelf;
    const payerIsBranch = isBranch(data, row.paidByPartyId);
    const partyItems = useMemo(() => data.parties.map((p) => ({ id: p.id, label: p.name })), [data.parties]);
    const vaultItems = useMemo(
        () =>
            payerIsBranch
                ? // The branch pays from its own vault, or the owner pays for it from one of his dinar vaults.
                  data.vaults
                      .filter((v) => v.partyId === row.paidByPartyId || (!v.partyId && v.allowedCurrencies.includes("IQD")))
                      .map((v) => ({ id: v.id, label: v.partyId ? `من ${v.name}` : `دفعتُها عنها من ${v.name}` }))
                : data.vaults.filter((v) => !v.partyId && v.allowedCurrencies.includes(row.currency)).map((v) => ({ id: v.id, label: v.name })),
        [data.vaults, row.currency, row.paidByPartyId, payerIsBranch],
    );
    const dinar = branchDinar(data, row);
    const traderItems = useMemo(() => c.shares.map((s) => ({ id: s.traderId, label: s.name })), [c.shares]);
    const preview = c.isShared ? rowPreview(row, data) : null;
    const name = (id: string) => c.shares.find((s) => s.traderId === id)?.name ?? "";

    return (
        <li
            data-line={type.id}
            className={cx(
                "rise-in flex flex-col gap-4 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-inset md:p-5",
                Object.keys(errors).length ? "ring-error_subtle" : "ring-secondary",
            )}
            data-row-error={Object.keys(errors).length ? "" : undefined}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
                    <IconTile icon={Receipt} color={type.isFee ? "green" : "pink"} size="md" />
                    <h4 className="min-w-0 text-md font-semibold text-balance text-primary">
                        {type.name}
                        {type.isFee && <span className="ms-2 rounded-full bg-success-primary px-2 py-0.5 text-xs text-success-primary">ربح</span>}
                    </h4>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <AriaButton
                        onPress={onTogglePin}
                        isDisabled={isSavingPin}
                        aria-pressed={type.isDefaultLine}
                        aria-label={type.isDefaultLine ? `«${type.name}» سطر افتراضي. اضغط لإلغاء ذلك` : `اجعل «${type.name}» سطراً افتراضياً`}
                        className={({ isFocusVisible }) =>
                            cx(
                                "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 transition-[background-color,color,transform] duration-150 ease-smooth ring-inset data-pressed:scale-[0.96] disabled:cursor-wait disabled:opacity-60",
                                type.isDefaultLine
                                    ? "bg-utility-yellow-50 text-utility-yellow-700 ring-utility-yellow-200"
                                    : "bg-primary text-tertiary ring-secondary hover:bg-primary_hover hover:text-secondary",
                                isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                            )
                        }
                    >
                        <Star01 className={cx("size-5", type.isDefaultLine && "fill-current")} aria-hidden="true" />
                        {type.isDefaultLine ? "افتراضي" : "اجعله افتراضياً"}
                    </AriaButton>
                    <IconButton icon={Trash01} label={`إزالة سطر ${type.name}`} tone="danger" onPress={onRemove} />
                </div>
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
                <div className="flex flex-col gap-1.5">
                    <SegmentedControl
                        label="العملة"
                        value={row.currency}
                        onChange={(cur) => onChange({ currency: cur, vaultId: payerIsSelf || payerIsBranch ? payerVault(data, row.paidByPartyId, cur, row.vaultId) : row.vaultId })}
                        options={CURRENCY_OPTIONS}
                    />
                    {row.currency !== type.defaultCurrency && (
                        <button
                            type="button"
                            onClick={onSaveCurrency}
                            disabled={isSavingPin}
                            className="inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-md text-sm font-semibold text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 disabled:opacity-60"
                        >
                            <Star01 className="size-4" aria-hidden="true" />
                            اجعل {row.currency === "USD" ? "الدولار" : "الدينار"} عملته الافتراضية
                        </button>
                    )}
                </div>
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
                        onChange={(id) => onChange({ paidByPartyId: id, vaultId: payerVault(data, id, row.currency, row.vaultId) })}
                        isInvalid={!!errors.paidByPartyId}
                        hint={errors.paidByPartyId ?? (payerIsBranch ? "التاجر يدين بهذا المبلغ للشراكة، لا لك" : undefined)}
                    />
                    {(payerIsSelf || payerIsBranch) && (
                        <SelectField
                            label="من أي قاصة؟"
                            isRequired
                            items={vaultItems}
                            value={row.vaultId}
                            onChange={(id) => onChange({ vaultId: id })}
                            isInvalid={!!errors.vaultId}
                            hint={
                                errors.vaultId ??
                                (payerIsBranch && row.vaultId && !data.vaults.find((v) => v.id === row.vaultId)?.partyId
                                    ? "دفعتَها عن الشراكة: تصبح الشراكة مدينة لك بها"
                                    : vaultItems.length
                                      ? "يصدر لها وصل صرف"
                                      : "لا توجد قاصة بهذه العملة")
                            }
                            placeholder="اختر القاصة"
                        />
                    )}
                    {payerIsBranch && row.currency === "USD" && (
                        <Input
                            label="سعر الدولار"
                            isRequired
                            size="lg"
                            inputMode="decimal"
                            inputClassName="num [direction:ltr] text-end"
                            placeholder="1310"
                            value={row.fxRate}
                            onChange={(v) => onChange({ fxRate: v })}
                            isInvalid={!!errors.fxRate}
                            hint={errors.fxRate ?? (dinar ? `يُسجَّل بالدينار: ${formatMoney(dinar, "IQD")}` : "قاصة الشراكة بالدينار فقط، فيُحوَّل المبلغ بهذا السعر")}
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

/**
 * "+ إضافة سطر": a popup list of the expense types from Settings. Tapping one adds its line, already filled
 * with its default currency, payer and amount.
 */
function AddLineMenu({
    types,
    parties,
    onAdd,
}: {
    types: ChargeSheetData["chargeTypes"];
    parties: ChargeSheetData["parties"];
    onAdd: (id: string) => void;
}) {
    const payer = (x: ChargeSheetData["chargeTypes"][number]) => (x.isFee ? "ربح الشركة" : (parties.find((p) => p.id === x.defaultPartyId)?.name ?? ""));
    return (
        <div className="flex flex-col gap-2">
            <Dropdown.Root>
                <AriaButton
                    isDisabled={!types.length}
                    className={({ isFocusVisible }) =>
                        cx(
                            "flex min-h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-primary_alt text-md font-semibold text-brand-secondary transition-[background-color,transform] duration-150 ease-smooth hover:bg-brand-primary data-pressed:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
                            isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                        )
                    }
                >
                    <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-brand-gradient text-white shadow-button-brand">
                        <Plus className="size-5" strokeWidth={2.5} />
                    </span>
                    {types.length ? "إضافة سطر" : "أُضيفت كل أنواع المصاريف"}
                </AriaButton>
                <Dropdown.Popover className="max-h-[60vh] w-[min(22rem,calc(100vw-2rem))] rounded-2xl py-1.5 shadow-xl" placement="top">
                    <Dropdown.Menu aria-label="أنواع المصاريف" onAction={(key) => onAdd(String(key))}>
                        {types.map((x) => (
                            <Dropdown.Item key={x.id} id={x.id} textValue={x.name} className="group outline-none" unstyled>
                                <span className="mx-1.5 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-100 group-data-focused:bg-primary_hover group-data-hovered:bg-primary_hover">
                                    <IconTile icon={Receipt} color={x.isFee ? "green" : "pink"} size="sm" />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="text-md font-medium text-primary">{x.name}</span>
                                        <span className="truncate text-sm text-tertiary">
                                            {[payer(x), x.defaultCurrency === "USD" ? "دولار" : "دينار"].filter(Boolean).join(" · ")}
                                            {x.defaultAmount && (
                                                <>
                                                    {" · "}
                                                    <bdi className="num">{formatMoney(x.defaultAmount, x.defaultCurrency)}</bdi>
                                                </>
                                            )}
                                        </span>
                                    </span>
                                    {x.isDefaultLine && <Star01 className="size-4 shrink-0 fill-current text-utility-yellow-500" aria-label="افتراضي" />}
                                </span>
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown.Root>
            <a
                href="/settings/charge-types"
                className="inline-flex min-h-9 items-center gap-1.5 self-center rounded-md text-sm text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2"
            >
                <Settings01 className="size-4" aria-hidden="true" />
                إضافة نوع مصروف جديد أو تعديله
            </a>
        </div>
    );
}
