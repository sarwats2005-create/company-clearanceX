"use client";

import { useEffect, useState } from "react";
import { AppDialog } from "@/components/app/app-dialog";
import { optionalLabel } from "@/components/app/field-label";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { createTraderAction } from "@/features/containers/actions";
import { saveSimpleItemAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";

/** Small modal behind "+ إضافة تاجر جديد" (PRD §5.2): name required, phone optional. Selects the new trader. */
export function NewTraderDialog({ initialName, isOpen, onOpenChange, onCreated }: { initialName: string; isOpen: boolean; onOpenChange: (open: boolean) => void; onCreated: (trader: { id: string; name: string }) => void }) {
    const [name, setName] = useState(initialName);
    const [phone, setPhone] = useState("");
    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setPhone("");
        }
    }, [isOpen, initialName]);
    const save = useAction(createTraderAction, {
        success: (d) => `تمت إضافة التاجر ${d.name}`,
        onSuccess: (d) => {
            onCreated(d);
            onOpenChange(false);
        },
    });

    return (
        <AppDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            size="sm"
            title="تاجر جديد"
            description="اكتب اسم التاجر. يمكنك إضافة باقي التفاصيل لاحقاً من الحسابات."
            footer={
                <>
                    <Button size="lg" color="secondary" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button size="lg" isLoading={save.pending} showTextWhileLoading onClick={() => save.run({ name, phone })}>
                        إضافة التاجر
                    </Button>
                </>
            }
        >
            <form
                className="flex flex-col gap-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    save.run({ name, phone });
                }}
            >
                <Input label="اسم التاجر" size="lg" isRequired autoFocus value={name} onChange={setName} isInvalid={!!save.fieldErrors.name} hint={save.fieldErrors.name} />
                <Input label={optionalLabel("رقم الهاتف")} size="lg" type="tel" inputClassName="[direction:ltr] text-end" value={phone} onChange={setPhone} isInvalid={!!save.fieldErrors.phone} hint={save.fieldErrors.phone} />
                <button type="submit" hidden />
            </form>
        </AppDialog>
    );
}

const SIMPLE_COPY = {
    shipping_lines: { title: "خط شحن جديد", field: "اسم الخط", button: "إضافة الخط", done: "تمت إضافة الخط" },
    ports_of_loading: { title: "ميناء تحميل جديد", field: "اسم الميناء", button: "إضافة الميناء", done: "تمت إضافة الميناء" },
} as const;

/** "+ إضافة خط جديد" / "+ إضافة ميناء": one name, saved to the Settings list, then selected. */
export function QuickAddDialog({
    kind,
    initialName,
    isOpen,
    onOpenChange,
    onCreated,
}: {
    kind: keyof typeof SIMPLE_COPY;
    initialName: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (item: { id: string; name: string }) => void;
}) {
    const copy = SIMPLE_COPY[kind];
    const [name, setName] = useState(initialName);
    useEffect(() => {
        if (isOpen) setName(initialName);
    }, [isOpen, initialName]);
    const save = useAction((n: string) => saveSimpleItemAction(kind, { name: n }), {
        success: copy.done,
        onSuccess: (d) => {
            onCreated({ id: d.id, name: name.trim() });
            onOpenChange(false);
        },
    });

    return (
        <AppDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            size="sm"
            title={copy.title}
            description="يُضاف إلى القائمة في الإعدادات أيضاً."
            footer={
                <>
                    <Button size="lg" color="secondary" onClick={() => onOpenChange(false)}>
                        إلغاء
                    </Button>
                    <Button size="lg" isLoading={save.pending} showTextWhileLoading onClick={() => save.run(name)}>
                        {copy.button}
                    </Button>
                </>
            }
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    save.run(name);
                }}
            >
                <Input label={copy.field} size="lg" isRequired autoFocus value={name} onChange={setName} isInvalid={!!save.fieldErrors.name} hint={save.fieldErrors.name} />
                <button type="submit" hidden />
            </form>
        </AppDialog>
    );
}
