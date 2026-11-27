"use client";

import { useState } from "react";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { saveSizeAction, setItemActiveAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";
import { formatNumber } from "@/lib/format";

interface Size {
    id?: string;
    label: string;
    lengthM: string | null;
    volumeM3: string | null;
    isActive: boolean;
}

const clean = (v: string | null) => (v ? formatNumber(v).replace(/,/g, "") : "");

function SizeRow({ size, onSaved }: { size: Size; onSaved?: () => void }) {
    const [v, setV] = useState({ label: size.label, lengthM: clean(size.lengthM), volumeM3: clean(size.volumeM3) });
    const save = useAction(saveSizeAction, { success: size.id ? "تم الحفظ" : "تمت الإضافة", onSuccess: onSaved });
    const activate = useAction(setItemActiveAction, { success: "تم الحفظ" });
    const dirty = !size.id || v.label !== size.label || v.lengthM !== clean(size.lengthM) || v.volumeM3 !== clean(size.volumeM3);
    const err = save.fieldErrors;

    return (
        <li className="grid grid-cols-2 items-start gap-3 py-5 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto] sm:gap-4">
            <Input label="الحجم" size="lg" value={v.label} onChange={(x) => setV((s) => ({ ...s, label: x }))} className="col-span-2 sm:col-span-1" isInvalid={!!err.label} hint={err.label} />
            <Input label="الطول (م)" size="lg" inputMode="decimal" value={v.lengthM} onChange={(x) => setV((s) => ({ ...s, lengthM: x }))} inputClassName="num [direction:ltr] text-end" isInvalid={!!err.lengthM} hint={err.lengthM} />
            <Input label="الحجم (م³)" size="lg" inputMode="decimal" value={v.volumeM3} onChange={(x) => setV((s) => ({ ...s, volumeM3: x }))} inputClassName="num [direction:ltr] text-end" isInvalid={!!err.volumeM3} hint={err.volumeM3} />
            <Button color={size.id ? "secondary" : "primary"} size="lg" className="sm:mt-7" isDisabled={!dirty} isLoading={save.pending} onClick={() => save.run({ id: size.id, ...v })}>
                {size.id ? "حفظ" : "إضافة"}
            </Button>
            {size.id ? (
                <div className="flex items-center gap-2 sm:mt-9">
                    <Toggle size="md" aria-label="مفعّل" isSelected={size.isActive} onChange={(x) => activate.run("container_sizes", size.id!, x)} />
                    {!size.isActive && (
                        <Badge size="sm" color="gray">
                            موقوف
                        </Badge>
                    )}
                </div>
            ) : (
                <span />
            )}
        </li>
    );
}

export function SizesEditor({ sizes }: { sizes: Size[] }) {
    const [newKey, setNewKey] = useState(0);
    return (
        <div className="flex flex-col gap-4">
            <p className="text-md text-tertiary">الطول والحجم يُستخدمان لرسم امتلاء الحاوية المشتركة وتنبيهك إذا زادت الحصص عن السعة.</p>
            <ul className="flex flex-col divide-y divide-secondary border-y border-secondary">
                {sizes.map((s) => (
                    <SizeRow key={s.id} size={s} />
                ))}
                <SizeRow key={`new-${newKey}`} size={{ label: "", lengthM: null, volumeM3: null, isActive: true }} onSaved={() => setNewKey((k) => k + 1)} />
            </ul>
        </div>
    );
}
