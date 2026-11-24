"use client";

import { Plus, Trash01 } from "@untitledui/icons";
import { EntityCombobox, type EntityOption } from "@/components/app/entity-combobox";
import { optionalLabel } from "@/components/app/field-label";
import { IconButton } from "@/components/app/icon-button";
import { SegmentedControl } from "@/components/app/segmented-control";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import type { SplitUnit } from "@/db/schema";
import { t } from "@/lib/i18n";
import { normalizeDigits } from "@/lib/money";
import { FillBar } from "./fill-bar";
import { type ShareRow, emptyShare } from "./values";

const UNITS: SplitUnit[] = ["meters", "cbm", "percent", "equal"];
const SHARE_LABEL: Record<SplitUnit, string> = { meters: "الحصة (متر)", cbm: "الحصة (م³)", percent: "النسبة (%)", equal: "" };

/** "٤٫٥" / "4,5" → "4.5"; anything else → null. For the live preview only (the server validates again). */
export function typedNumber(v: string): string | null {
    const s = normalizeDigits(v).replace(/[\s٬]/g, "").replace(/[٫,]/g, ".");
    return /^\d+(\.\d+)?$/.test(s) ? s : null;
}

interface SharesEditorProps {
    unit: SplitUnit | null;
    onUnitChange: (u: SplitUnit) => void;
    rows: ShareRow[];
    onRowsChange: (rows: ShareRow[]) => void;
    traders: EntityOption[];
    onAddTrader: (rowKey: string, typed: string) => void;
    capacity: string | null;
    sizeLabel: string | null;
    errors: Record<string, string>;
    goodsSuggestions: string[];
}

/** ①b الحصص: split unit, one card per trader, and the fill bar (PRD §5.3, §8.5.3). */
export function SharesEditor({ unit, onUnitChange, rows, onRowsChange, traders, onAddTrader, capacity, sizeLabel, errors, goodsSuggestions }: SharesEditorProps) {
    const patch = (key: string, p: Partial<ShareRow>) => onRowsChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
    const nameOf = (id: string | null) => traders.find((x) => x.id === id)?.label ?? "";

    return (
        <div className="flex flex-col gap-5">
            <div data-field="splitUnit">
                <SegmentedControl label="وحدة التقسيم" value={unit} onChange={onUnitChange} options={UNITS.map((u) => ({ value: u, label: t(`splitUnit.${u}`) }))} />
                {errors.splitUnit && <p className="mt-1.5 text-sm text-error-primary">{errors.splitUnit}</p>}
            </div>

            <ol className="flex flex-col gap-4">
                {rows.map((row, i) => (
                    <li key={row.key} className="flex flex-col gap-5 rounded-xl p-4 ring-1 ring-secondary">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-tertiary tabular-nums">التاجر {i + 1}</span>
                            {rows.length > 2 && (
                                <IconButton icon={Trash01} label="حذف هذا التاجر من الحاوية" tone="danger" onPress={() => onRowsChange(rows.filter((r) => r.key !== row.key))} />
                            )}
                        </div>
                        <div className="grid gap-x-4 gap-y-5 md:grid-cols-[1fr_minmax(0,12rem)]">
                            <div data-field={`shares.${i}.traderId`}>
                                <EntityCombobox
                                    label="التاجر"
                                    aria-label={`التاجر ${i + 1}`}
                                    isRequired
                                    items={traders}
                                    value={row.traderId}
                                    onChange={(id) => patch(row.key, { traderId: id })}
                                    addLabel="إضافة تاجر جديد"
                                    onAdd={(typed) => onAddTrader(row.key, typed)}
                                    isInvalid={!!errors[`shares.${i}.traderId`]}
                                    hint={errors[`shares.${i}.traderId`]}
                                />
                            </div>
                            {unit && unit !== "equal" && (
                                <div data-field={`shares.${i}.shareValue`}>
                                    <Input
                                        label={SHARE_LABEL[unit]}
                                        isRequired
                                        size="lg"
                                        inputMode="decimal"
                                        inputClassName="num [direction:ltr] text-end"
                                        placeholder={unit === "percent" ? "مثال: 40" : "مثال: 4"}
                                        value={row.shareValue}
                                        onChange={(v) => patch(row.key, { shareValue: v })}
                                        isInvalid={!!errors[`shares.${i}.shareValue`]}
                                        hint={errors[`shares.${i}.shareValue`]}
                                    />
                                </div>
                            )}
                        </div>
                        <div data-field={`shares.${i}.goods`}>
                            <Input
                                label={optionalLabel("البضاعة")}
                                size="lg"
                                list="cc-goods-suggestions"
                                value={row.goods}
                                onChange={(v) => patch(row.key, { goods: v })}
                                isInvalid={!!errors[`shares.${i}.goods`]}
                                hint={errors[`shares.${i}.goods`]}
                            />
                        </div>
                        <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                            <div data-field={`shares.${i}.cartons`}>
                                <Input
                                    label={optionalLabel("عدد الكراتين")}
                                    size="lg"
                                    inputMode="numeric"
                                    inputClassName="num [direction:ltr] text-end"
                                    value={row.cartons}
                                    onChange={(v) => patch(row.key, { cartons: v })}
                                    isInvalid={!!errors[`shares.${i}.cartons`]}
                                    hint={errors[`shares.${i}.cartons`]}
                                />
                            </div>
                            <div data-field={`shares.${i}.weightKg`}>
                                <Input
                                    label={optionalLabel("الوزن (كغم)")}
                                    size="lg"
                                    inputMode="decimal"
                                    inputClassName="num [direction:ltr] text-end"
                                    value={row.weightKg}
                                    onChange={(v) => patch(row.key, { weightKg: v })}
                                    isInvalid={!!errors[`shares.${i}.weightKg`]}
                                    hint={errors[`shares.${i}.weightKg`]}
                                />
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
            {errors.shares && <p className="text-sm text-error-primary">{errors.shares}</p>}

            <Button color="secondary" size="lg" iconLeading={Plus} className="self-start" onClick={() => onRowsChange([...rows, emptyShare()])}>
                {t("form.addTrader")}
            </Button>

            <FillBar unit={unit} capacity={capacity} sizeLabel={sizeLabel} rows={rows.map((r) => ({ traderId: r.traderId ?? r.key, name: nameOf(r.traderId), shareValue: typedNumber(r.shareValue) }))} />
            <datalist id="cc-goods-suggestions">
                {goodsSuggestions.map((g) => (
                    <option key={g} value={g} />
                ))}
            </datalist>
        </div>
    );
}
