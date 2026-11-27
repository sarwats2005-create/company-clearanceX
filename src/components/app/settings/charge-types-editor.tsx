"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Edit05, Plus, Receipt, Star01 } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { IconTile } from "@/components/app/icon-tile";
import { AppDialog } from "@/components/app/app-dialog";
import { IconButton } from "@/components/app/icon-button";
import { SegmentedControl } from "@/components/app/segmented-control";
import { SelectField } from "@/components/app/select-field";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import type { Currency } from "@/db/schema";
import { moveItemAction, saveChargeTypeAction, setChargeTypeDefaultLineAction, setItemActiveAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";
import { formatMoney } from "@/lib/format";
import { cx } from "@/utils/cx";

interface ChargeType {
    id: string;
    name: string;
    defaultCurrency: Currency;
    defaultPartyId: string | null;
    isFee: boolean;
    isActive: boolean;
    /** Already on the expenses page when it opens. */
    isDefaultLine: boolean;
    defaults: Record<string, string>;
}

type Draft = Omit<ChargeType, "id"> & { id?: string };

export function ChargeTypesEditor({
    types,
    parties,
    sizes,
}: {
    types: ChargeType[];
    parties: { id: string; name: string }[];
    sizes: { id: string; label: string }[];
}) {
    const [draft, setDraft] = useState<Draft | null>(null);
    const save = useAction(saveChargeTypeAction, { success: "تم الحفظ", onSuccess: () => setDraft(null) });
    const move = useAction(moveItemAction);
    const activate = useAction(setItemActiveAction, { success: "تم الحفظ" });
    const pin = useAction(setChargeTypeDefaultLineAction, { success: "تم الحفظ" });
    const partyName = (id: string | null) => parties.find((p) => p.id === id)?.name;
    const err = save.fieldErrors;

    const open = (t?: ChargeType) =>
        setDraft(
            t
                ? { ...t, defaults: Object.fromEntries(sizes.map((s) => [s.id, t.defaults[s.id] ? formatMoney(t.defaults[s.id], t.defaultCurrency, { symbol: false }) : ""])) }
                : { name: "", defaultCurrency: "USD", defaultPartyId: parties[0]?.id ?? null, isFee: false, isActive: true, isDefaultLine: false, defaults: {} },
        );

    return (
        <div className="flex flex-col gap-6">
            <div className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
                <p className="flex items-start gap-2 text-md text-secondary">
                    <Star01 className="mt-1 size-5 shrink-0 fill-current text-utility-yellow-500" aria-hidden="true" />
                    الأنواع المعلّمة بالنجمة تظهر وحدها كسطور جاهزة كلما فتحت صفحة المصاريف، بعملتها الافتراضية. يمكنك أيضاً تعليمها من صفحة المصاريف نفسها.
                </p>
                <Button size="lg" iconLeading={Plus} onClick={() => open()} className="shrink-0">
                    نوع جديد
                </Button>
            </div>
            <ul className="surface flex flex-col divide-y divide-secondary px-3 md:px-4">
                {types.map((t, i) => (
                    <li key={t.id} className="flex min-h-18 flex-wrap items-center gap-2 py-3">
                        <IconTile icon={Receipt} color={t.isFee ? "green" : "pink"} size="md" className={cx(!t.isActive && "opacity-60")} />
                        <div className={cx("flex min-w-0 flex-1 flex-col gap-0.5 ps-1", !t.isActive && "opacity-60")}>
                            <span className="flex flex-wrap items-center gap-2 text-md text-primary">
                                {t.name}
                                {t.isFee && (
                                    <Badge size="sm" color="success">
                                        أتعاب (ربح)
                                    </Badge>
                                )}
                                {!t.isActive && (
                                    <Badge size="sm" color="gray">
                                        موقوف
                                    </Badge>
                                )}
                            </span>
                            <span className="text-sm text-tertiary">
                                {t.defaultCurrency === "USD" ? "دولار" : "دينار"} · {t.isFee ? "ربح الشركة" : (partyName(t.defaultPartyId) ?? "بدون جهة افتراضية")}
                            </span>
                        </div>
                        <AriaButton
                            onPress={() => pin.run({ id: t.id, isDefaultLine: !t.isDefaultLine })}
                            isDisabled={pin.pending}
                            aria-pressed={t.isDefaultLine}
                            aria-label={t.isDefaultLine ? `«${t.name}» سطر افتراضي. اضغط لإلغاء ذلك` : `اجعل «${t.name}» سطراً افتراضياً`}
                            className={({ isFocusVisible }) =>
                                cx(
                                    "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 transition-colors duration-150 ring-inset disabled:opacity-60",
                                    t.isDefaultLine
                                        ? "bg-utility-yellow-50 text-utility-yellow-700 ring-utility-yellow-200"
                                        : "text-tertiary ring-secondary hover:bg-primary_hover",
                                    isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                                )
                            }
                        >
                            <Star01 className={cx("size-5", t.isDefaultLine && "fill-current")} aria-hidden="true" />
                            {t.isDefaultLine ? "افتراضي" : "عادي"}
                        </AriaButton>
                        <IconButton icon={ArrowUp} label="تحريك للأعلى" isDisabled={i === 0 || move.pending} onPress={() => move.run("charge_types", t.id, "up")} />
                        <IconButton icon={ArrowDown} label="تحريك للأسفل" isDisabled={i === types.length - 1 || move.pending} onPress={() => move.run("charge_types", t.id, "down")} />
                        <IconButton icon={Edit05} label="تعديل" onPress={() => open(t)} />
                        <Toggle size="md" aria-label={t.isActive ? "إيقاف" : "تفعيل"} isSelected={t.isActive} onChange={(v) => activate.run("charge_types", t.id, v)} className="ms-2" />
                    </li>
                ))}
            </ul>

            <AppDialog
                isOpen={!!draft}
                onOpenChange={(o) => !o && setDraft(null)}
                title={draft?.id ? "تعديل نوع مصروف" : "نوع مصروف جديد"}
                footer={
                    <>
                        <Button color="secondary" size="lg" onClick={() => setDraft(null)}>
                            إلغاء
                        </Button>
                        <Button size="lg" isLoading={save.pending} onClick={() => draft && save.run(draft)}>
                            حفظ
                        </Button>
                    </>
                }
            >
                {draft && (
                    <>
                        <Input label="الاسم" size="lg" isRequired autoFocus value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} isInvalid={!!err.name} hint={err.name} />
                        <SegmentedControl
                            label="العملة الافتراضية"
                            value={draft.defaultCurrency}
                            onChange={(v) => setDraft({ ...draft, defaultCurrency: v })}
                            options={[
                                { value: "USD", label: "دولار $" },
                                { value: "IQD", label: "دينار د.ع" },
                            ]}
                        />
                        <Toggle
                            size="md"
                            label="هذا أتعاب (ربح الشركة)"
                            hint="لا تدفعه أي جهة؛ يُسجّل على التاجر ويذهب إلى أرباحك"
                            isSelected={draft.isFee}
                            onChange={(v) => setDraft({ ...draft, isFee: v })}
                        />
                        <Toggle
                            size="md"
                            label="سطر افتراضي"
                            hint="يظهر وحده في صفحة المصاريف بهذه العملة، دون أن تختاره"
                            isSelected={draft.isDefaultLine}
                            onChange={(v) => setDraft({ ...draft, isDefaultLine: v })}
                        />
                        {!draft.isFee && (
                            <SelectField
                                label="من يدفعه عادةً"
                                items={parties.map((p) => ({ id: p.id, label: p.name }))}
                                value={draft.defaultPartyId}
                                onChange={(v) => setDraft({ ...draft, defaultPartyId: v })}
                            />
                        )}
                        <fieldset className="flex flex-col gap-3">
                            <legend className="mb-1 text-sm font-medium text-secondary">المبلغ المعتاد حسب حجم الحاوية (اختياري)</legend>
                            <div className="grid grid-cols-2 gap-3">
                                {sizes.map((s) => (
                                    <Input
                                        key={s.id}
                                        label={s.label}
                                        size="lg"
                                        inputMode="decimal"
                                        value={draft.defaults[s.id] ?? ""}
                                        onChange={(v) => setDraft({ ...draft, defaults: { ...draft.defaults, [s.id]: v } })}
                                        inputClassName="num [direction:ltr] text-end"
                                        isInvalid={!!err[`defaults.${s.id}`]}
                                        hint={err[`defaults.${s.id}`]}
                                    />
                                ))}
                            </div>
                        </fieldset>
                    </>
                )}
            </AppDialog>
        </div>
    );
}
