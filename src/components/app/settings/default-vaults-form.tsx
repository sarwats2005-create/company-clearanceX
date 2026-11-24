"use client";

import { useState } from "react";
import { type Option, SelectField } from "@/components/app/select-field";
import { Button } from "@/components/base/buttons/button";
import { setDefaultVaultsAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";

/** Default vault per currency (PRD §8.10 item 4): what every money form picks first. */
export function DefaultVaultsForm({ initial, iqd, usd }: { initial: { IQD: string; USD: string }; iqd: Option[]; usd: Option[] }) {
    const [v, setV] = useState(initial);
    const save = useAction(setDefaultVaultsAction, { success: "تم الحفظ" });
    const err = save.fieldErrors;

    return (
        <form
            className="flex max-w-xl flex-col gap-5"
            onSubmit={(e) => {
                e.preventDefault();
                save.run(v);
            }}
        >
            <SelectField
                label="قاصة الدينار"
                items={iqd}
                value={v.IQD || null}
                onChange={(id) => setV((s) => ({ ...s, IQD: id }))}
                isInvalid={!!err.IQD}
                hint={err.IQD ?? "تُختار أولاً عند قبض أو دفع مبلغ بالدينار."}
            />
            <SelectField
                label="قاصة الدولار"
                items={usd}
                value={v.USD || null}
                onChange={(id) => setV((s) => ({ ...s, USD: id }))}
                isInvalid={!!err.USD}
                hint={err.USD ?? "تُختار أولاً عند قبض أو دفع مبلغ بالدولار."}
            />
            <div>
                <Button type="submit" size="lg" isLoading={save.pending}>
                    حفظ
                </Button>
            </div>
        </form>
    );
}
