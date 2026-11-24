"use client";

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { updateCurrencyAlertsAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";

export function CurrencyForm({ initial, rateUpdated }: { initial: { defaultUsdIqdRate: string; arrivedWarningDays: string }; rateUpdated: string | null }) {
    const [v, setV] = useState(initial);
    const save = useAction(updateCurrencyAlertsAction, { success: "تم الحفظ" });
    const err = save.fieldErrors;

    return (
        <form
            className="flex max-w-xl flex-col gap-8"
            onSubmit={(e) => {
                e.preventDefault();
                save.run(v);
            }}
        >
            <div className="flex flex-col gap-5">
                <h3 className="text-md font-semibold text-primary">سعر الصرف</h3>
                <Input
                    label="سعر الدولار بالدينار (1 $ =)"
                    size="lg"
                    inputMode="decimal"
                    value={v.defaultUsdIqdRate}
                    onChange={(x) => setV((s) => ({ ...s, defaultUsdIqdRate: x }))}
                    isInvalid={!!err.defaultUsdIqdRate}
                    hint={err.defaultUsdIqdRate ?? `يُملأ تلقائياً في نماذج القبض والتصريف، ويمكنك تغييره في كل مرة.${rateUpdated ? ` آخر تغيير: ${rateUpdated}` : ""}`}
                    inputClassName="num [direction:ltr] text-end"
                />
            </div>
            <div className="flex flex-col gap-5 border-t border-secondary pt-6">
                <h3 className="text-md font-semibold text-primary">التنبيهات</h3>
                <Input
                    label="نبّهني إذا بقيت الحاوية في أم قصر أكثر من (يوم)"
                    size="lg"
                    inputMode="numeric"
                    value={v.arrivedWarningDays}
                    onChange={(x) => setV((s) => ({ ...s, arrivedWarningDays: x }))}
                    isInvalid={!!err.arrivedWarningDays}
                    hint={err.arrivedWarningDays}
                    inputClassName="num [direction:ltr] text-end"
                    className="max-w-xs"
                />
            </div>
            <div>
                <Button type="submit" size="lg" isLoading={save.pending}>
                    حفظ
                </Button>
            </div>
        </form>
    );
}
