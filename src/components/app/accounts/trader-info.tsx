"use client";

import { useState } from "react";
import { Edit05 } from "@untitledui/icons";
import { AppDialog } from "@/components/app/app-dialog";
import { optionalLabel } from "@/components/app/field-label";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { updateTraderAction } from "@/features/accounts/actions";
import { useAction } from "@/hooks/use-action";

interface Trader {
    id: string;
    name: string;
    phone: string | null;
    city: string | null;
    notes: string | null;
}

function Row({ label, children, ltr }: { label: string; children: string | null; ltr?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="shrink-0 text-sm text-tertiary">{label}</dt>
            <dd className="min-w-0 text-end text-md whitespace-pre-line text-primary">
                {children ? ltr ? <bdi className="num">{children}</bdi> : children : <span className="text-quaternary">—</span>}
            </dd>
        </div>
    );
}

/** معلومات tab: the trader's details and a dialog to change them. */
export function TraderInfo({ trader }: { trader: Trader }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState({ name: "", phone: "", city: "", notes: "" });
    const save = useAction(updateTraderAction, { success: "تم حفظ معلومات التاجر", onSuccess: () => setOpen(false) });
    const err = save.fieldErrors;
    const submit = () => save.run({ id: trader.id, ...draft });

    return (
        <section aria-labelledby="info-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h2 id="info-title" className="text-lg font-semibold text-primary">
                    معلومات التاجر
                </h2>
                <Button
                    size="md"
                    color="secondary"
                    iconLeading={Edit05}
                    onClick={() => {
                        setDraft({ name: trader.name, phone: trader.phone ?? "", city: trader.city ?? "", notes: trader.notes ?? "" });
                        save.clear();
                        setOpen(true);
                    }}
                >
                    تعديل المعلومات
                </Button>
            </div>
            <dl className="surface divide-y divide-secondary px-5">
                <Row label="الاسم">{trader.name}</Row>
                <Row label="رقم الهاتف" ltr>
                    {trader.phone}
                </Row>
                <Row label="المدينة">{trader.city}</Row>
                <Row label="ملاحظات">{trader.notes}</Row>
            </dl>

            <AppDialog
                isOpen={open}
                onOpenChange={(o) => !save.pending && setOpen(o)}
                isDismissable={!save.pending}
                size="sm"
                title="تعديل معلومات التاجر"
                description="الاسم الجديد يظهر في الحاويات والوصولات القادمة. الوصولات القديمة تبقى كما طُبعت."
                footer={
                    <>
                        <Button size="lg" color="secondary" onClick={() => setOpen(false)} isDisabled={save.pending}>
                            رجوع
                        </Button>
                        <Button size="lg" isLoading={save.pending} showTextWhileLoading onClick={submit}>
                            حفظ
                        </Button>
                    </>
                }
            >
                <form
                    className="flex flex-col gap-5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    <Input
                        label="اسم التاجر"
                        size="lg"
                        isRequired
                        autoFocus
                        value={draft.name}
                        onChange={(v) => setDraft({ ...draft, name: v })}
                        isInvalid={!!err.name}
                        hint={err.name}
                    />
                    <Input
                        label={optionalLabel("رقم الهاتف")}
                        size="lg"
                        type="tel"
                        inputClassName="[direction:ltr] text-end"
                        value={draft.phone}
                        onChange={(v) => setDraft({ ...draft, phone: v })}
                        isInvalid={!!err.phone}
                        hint={err.phone}
                    />
                    <Input
                        label={optionalLabel("المدينة")}
                        size="lg"
                        value={draft.city}
                        onChange={(v) => setDraft({ ...draft, city: v })}
                        isInvalid={!!err.city}
                        hint={err.city}
                    />
                    <TextArea
                        label={optionalLabel("ملاحظات")}
                        rows={3}
                        value={draft.notes}
                        onChange={(v) => setDraft({ ...draft, notes: v })}
                        isInvalid={!!err.notes}
                        hint={err.notes}
                    />
                    <button type="submit" hidden />
                </form>
            </AppDialog>
        </section>
    );
}
