"use client";

import { useState } from "react";
import { Edit05, Plus } from "@untitledui/icons";
import { AppDialog } from "@/components/app/app-dialog";
import { IconButton } from "@/components/app/icon-button";
import { SelectField } from "@/components/app/select-field";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import type { PartyKind } from "@/db/schema";
import { PARTY_KIND_LABEL } from "@/features/accounts/model";
import { savePartyAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";
import { cx } from "@/utils/cx";

interface Party {
    id: string;
    name: string;
    kind: PartyKind;
    phone: string | null;
    notes: string | null;
    isActive: boolean;
    isSystem: boolean;
}

type Draft = { id?: string; name: string; kind: PartyKind; phone: string; notes: string; isActive: boolean; isDefaultCompany: boolean; isSelf: boolean };

export function PartiesEditor({ parties, defaultCompanyId }: { parties: Party[]; defaultCompanyId: string | null }) {
    const [draft, setDraft] = useState<Draft | null>(null);
    const save = useAction(savePartyAction, { success: "تم الحفظ", onSuccess: () => setDraft(null) });
    const err = save.fieldErrors;

    const open = (p?: Party) =>
        setDraft(
            p
                ? { id: p.id, name: p.name, kind: p.kind, phone: p.phone ?? "", notes: p.notes ?? "", isActive: p.isActive, isDefaultCompany: p.id === defaultCompanyId, isSelf: p.kind === "self" }
                : { name: "", kind: "clearance_company", phone: "", notes: "", isActive: true, isDefaultCompany: false, isSelf: false },
        );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-md text-tertiary">الجهة هي من يدفع مصاريف الحاوية عنك، ويصبح لها رصيد في الحسابات (المستحق لهم علينا).</p>
                <Button size="lg" iconLeading={Plus} onClick={() => open()} className="shrink-0">
                    جهة جديدة
                </Button>
            </div>
            <ul className="flex flex-col divide-y divide-secondary border-y border-secondary">
                {parties.map((p) => (
                    <li key={p.id} className="flex min-h-16 items-center gap-3 py-3">
                        <div className={cx("flex min-w-0 flex-1 flex-col gap-0.5", !p.isActive && "opacity-60")}>
                            <span className="flex flex-wrap items-center gap-2 text-md text-primary">
                                {p.name}
                                {p.id === defaultCompanyId && (
                                    <Badge size="sm" color="brand">
                                        الشركة الافتراضية
                                    </Badge>
                                )}
                                {!p.isActive && (
                                    <Badge size="sm" color="gray">
                                        موقوف
                                    </Badge>
                                )}
                            </span>
                            <span className="text-sm text-tertiary">
                                {PARTY_KIND_LABEL[p.kind]}
                                {p.phone && (
                                    <>
                                        {" · "}
                                        <bdi className="num">{p.phone}</bdi>
                                    </>
                                )}
                            </span>
                        </div>
                        <IconButton icon={Edit05} label="تعديل" onPress={() => open(p)} />
                    </li>
                ))}
            </ul>

            <AppDialog
                isOpen={!!draft}
                onOpenChange={(o) => !o && setDraft(null)}
                title={draft?.id ? "تعديل جهة" : "جهة جديدة"}
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
                        {!draft.isSelf && (
                            <SelectField
                                label="النوع"
                                items={(["clearance_company", "partner", "other"] as const).map((k) => ({ id: k, label: PARTY_KIND_LABEL[k] }))}
                                value={draft.kind}
                                onChange={(v) => setDraft({ ...draft, kind: v as PartyKind })}
                            />
                        )}
                        <Input label="الهاتف" size="lg" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} inputClassName="[direction:ltr] text-end" />
                        <TextArea label="ملاحظات" rows={2} value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} />
                        {!draft.isSelf && (
                            <>
                                <Toggle
                                    size="md"
                                    label="الشركة الافتراضية للحاويات الجديدة"
                                    hint="تُختار تلقائياً في حقل شركة التخليص"
                                    isSelected={draft.isDefaultCompany}
                                    onChange={(v) => setDraft({ ...draft, isDefaultCompany: v })}
                                />
                                <Toggle size="md" label="مفعّلة" isSelected={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />
                            </>
                        )}
                    </>
                )}
            </AppDialog>
        </div>
    );
}
