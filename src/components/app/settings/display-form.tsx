"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/app/segmented-control";
import { setTextSizeAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";
import type { TextSize } from "@/lib/text-size";

/** Text size per device (PRD US-27). Applies immediately. */
export function DisplayForm({ initial }: { initial: TextSize }) {
    const [size, setSize] = useState<TextSize>(initial);
    const save = useAction(setTextSizeAction, { success: "تم تغيير حجم الخط" });

    return (
        <div className="flex max-w-xl flex-col gap-6">
            <SegmentedControl
                label="حجم الخط"
                value={size}
                onChange={(v) => {
                    setSize(v);
                    document.documentElement.dataset.textSize = v;
                    save.run(v);
                }}
                options={[
                    { value: "sm", label: "عادي" },
                    { value: "md", label: "كبير" },
                    { value: "lg", label: "كبير جداً" },
                ]}
            />
            <p className="text-md text-tertiary">يُحفظ هذا الاختيار على هذا الجهاز فقط. الأرقام تظهر دائماً بالشكل 123.</p>
        </div>
    );
}
