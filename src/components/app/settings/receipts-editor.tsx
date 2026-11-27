"use client";

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import type { ReceiptKind } from "@/db/schema";
import { updateReceiptSequenceAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";

const KIND_LABEL: Record<ReceiptKind, string> = { in: "وصل قبض", out: "وصل صرف", transfer: "وصل تحويل", exchange: "وصل تصريف" };

function Row({ kind, prefix, nextNumber }: { kind: ReceiptKind; prefix: string; nextNumber: number }) {
    const [p, setP] = useState(prefix);
    const [n, setN] = useState(String(nextNumber));
    const save = useAction(updateReceiptSequenceAction, { success: "تم الحفظ" });
    const preview = `${p || "?"}-${String(Number(n) || 0).padStart(6, "0")}`;
    const dirty = p !== prefix || n !== String(nextNumber);

    return (
        <li className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start">
            <div className="flex w-36 shrink-0 flex-col gap-1 pt-2">
                <span className="text-md font-semibold text-primary">{KIND_LABEL[kind]}</span>
                <span className="text-sm text-tertiary">
                    الوصل التالي: <bdi className="num font-medium text-secondary">{preview}</bdi>
                </span>
            </div>
            <Input label="الحرف" size="lg" value={p} onChange={setP} className="w-28" isInvalid={!!save.fieldErrors.prefix} hint={save.fieldErrors.prefix} />
            <Input
                label="الرقم التالي"
                size="lg"
                inputMode="numeric"
                value={n}
                onChange={setN}
                className="w-40"
                inputClassName="num [direction:ltr] text-end"
                isInvalid={!!save.fieldErrors.nextNumber}
                hint={save.fieldErrors.nextNumber}
            />
            <Button color="secondary" size="lg" className="sm:mt-7" isDisabled={!dirty} isLoading={save.pending} onClick={() => save.run(kind, { prefix: p, nextNumber: n })}>
                حفظ
            </Button>
        </li>
    );
}

export function ReceiptsEditor({ rows }: { rows: { kind: ReceiptKind; prefix: string; nextNumber: number }[] }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-md text-tertiary">لكل نوع وصل عدّاد خاص به. يمكن رفع الرقم التالي فقط، ولا يمكن إنزاله، حتى لا يتكرر رقم وصل.</p>
            <ul className="surface flex flex-col divide-y divide-secondary px-4 md:px-5">
                {rows.map((r) => (
                    <Row key={r.kind} {...r} />
                ))}
            </ul>
        </div>
    );
}
