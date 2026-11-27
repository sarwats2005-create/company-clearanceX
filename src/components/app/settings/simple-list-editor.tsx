"use client";

import { type ReactNode, useState } from "react";
import { ArrowDown, ArrowUp, Edit05 } from "@untitledui/icons";
import { AppDialog } from "@/components/app/app-dialog";
import { IconButton } from "@/components/app/icon-button";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { moveItemAction, saveSimpleItemAction, setItemActiveAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";
import { cx } from "@/utils/cx";

type Kind = "shipping_lines" | "ports_of_loading" | "expense_categories";

export interface Item {
    id: string;
    name: string;
    isActive: boolean;
    secondary?: string | null;
}

/** Add / rename / order / (de)activate for name-only lists (PRD §8.10 item 5). */
export function SimpleListEditor<T extends Item>({
    kind,
    items,
    addLabel,
    placeholder,
    dirLtr,
    leading,
    extra,
}: {
    kind: Kind;
    items: T[];
    addLabel: string;
    placeholder: string;
    dirLtr?: boolean;
    /** Shown before the name (e.g. a shipping line's logo). */
    leading?: (item: T) => ReactNode;
    /** Extra buttons on the row (e.g. "الشعار"). */
    extra?: (item: T) => ReactNode;
}) {
    const [name, setName] = useState("");
    const [editing, setEditing] = useState<Item | null>(null);
    const [editName, setEditName] = useState("");
    const add = useAction(saveSimpleItemAction, { success: "تمت الإضافة", onSuccess: () => setName("") });
    const rename = useAction(saveSimpleItemAction, { success: "تم الحفظ", onSuccess: () => setEditing(null) });
    const move = useAction(moveItemAction);
    const activate = useAction(setItemActiveAction, { success: "تم الحفظ" });

    return (
        <div className="flex flex-col gap-6">
            <form
                className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-end md:p-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    add.run(kind, { name });
                }}
            >
                <Input
                    label={addLabel}
                    placeholder={placeholder}
                    size="lg"
                    value={name}
                    onChange={setName}
                    isInvalid={!!add.fieldErrors.name}
                    hint={add.fieldErrors.name}
                    className="sm:max-w-sm"
                    inputClassName={dirLtr ? "[direction:ltr] text-end" : undefined}
                />
                <Button type="submit" size="lg" isLoading={add.pending} isDisabled={!name.trim()}>
                    إضافة
                </Button>
            </form>

            <ul className="surface flex flex-col divide-y divide-secondary px-3 md:px-4">
                {items.map((item, i) => (
                    <li key={item.id} className="flex min-h-18 flex-wrap items-center gap-2 py-2.5">
                        {leading && <span className={cx(!item.isActive && "opacity-60")}>{leading(item)}</span>}
                        <div className={cx("flex min-w-0 flex-1 flex-col ps-1", !item.isActive && "opacity-60")}>
                            <span className="flex items-center gap-2 text-md text-primary">
                                <bdi>{item.name}</bdi>
                                {!item.isActive && (
                                    <Badge size="sm" color="gray">
                                        موقوف
                                    </Badge>
                                )}
                            </span>
                            {item.secondary && <span className="text-sm text-tertiary">{item.secondary}</span>}
                        </div>
                        {extra?.(item)}
                        <IconButton icon={ArrowUp} label="تحريك للأعلى" isDisabled={i === 0 || move.pending} onPress={() => move.run(kind, item.id, "up")} />
                        <IconButton icon={ArrowDown} label="تحريك للأسفل" isDisabled={i === items.length - 1 || move.pending} onPress={() => move.run(kind, item.id, "down")} />
                        <IconButton
                            icon={Edit05}
                            label="تعديل الاسم"
                            onPress={() => {
                                setEditing(item);
                                setEditName(item.name);
                            }}
                        />
                        <Toggle size="md" aria-label={item.isActive ? "إيقاف" : "تفعيل"} isSelected={item.isActive} onChange={(v) => activate.run(kind, item.id, v)} className="ms-2" />
                    </li>
                ))}
            </ul>

            <AppDialog
                isOpen={!!editing}
                onOpenChange={(o) => !o && setEditing(null)}
                title="تعديل الاسم"
                size="sm"
                footer={
                    <>
                        <Button color="secondary" size="lg" onClick={() => setEditing(null)}>
                            إلغاء
                        </Button>
                        <Button size="lg" isLoading={rename.pending} onClick={() => editing && rename.run(kind, { id: editing.id, name: editName })}>
                            حفظ
                        </Button>
                    </>
                }
            >
                <Input label="الاسم" size="lg" value={editName} onChange={setEditName} autoFocus isInvalid={!!rename.fieldErrors.name} hint={rename.fieldErrors.name} />
            </AppDialog>
        </div>
    );
}
