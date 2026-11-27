"use client";

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { updateCompanyAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";

export function CompanyForm({ initial }: { initial: { name: string; phone: string; address: string; receiptFooter: string } }) {
    const [v, setV] = useState(initial);
    const save = useAction(updateCompanyAction, { success: "تم الحفظ" });
    const set = (k: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [k]: value }));
    const err = save.fieldErrors;

    return (
        <form
            className="surface flex max-w-2xl flex-col gap-5 p-5 md:p-6"
            onSubmit={(e) => {
                e.preventDefault();
                save.run(v);
            }}
        >
            <Input label="اسم الشركة" size="lg" isRequired value={v.name} onChange={set("name")} isInvalid={!!err.name} hint={err.name ?? "يظهر في أعلى الوصولات وكشوف الحساب"} />
            <Input label="الهاتف" size="lg" value={v.phone} onChange={set("phone")} inputClassName="[direction:ltr] text-end" placeholder="0770 000 0000" />
            <Input label="العنوان" size="lg" value={v.address} onChange={set("address")} placeholder="البصرة - العشار" />
            <TextArea label="نص أسفل الوصل" rows={3} value={v.receiptFooter} onChange={set("receiptFooter")} placeholder="مثال: شكراً لتعاملكم معنا" />
            <div>
                <Button type="submit" size="lg" isLoading={save.pending}>
                    حفظ
                </Button>
            </div>
        </form>
    );
}
