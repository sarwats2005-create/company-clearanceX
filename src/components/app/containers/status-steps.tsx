"use client";

import { useState } from "react";
import { AlertTriangle, Check } from "@untitledui/icons";
import { AppDialog } from "@/components/app/app-dialog";
import { DateField } from "@/components/app/date-field";
import { optionalLabel } from "@/components/app/field-label";
import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import type { ContainerStatus } from "@/db/schema";
import { changeStatusAction } from "@/features/containers/actions";
import { STATUS_ORDER, statusIndex } from "@/features/containers/status";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cx } from "@/utils/cx";

interface StatusStepsProps {
    containerId: string;
    status: ContainerStatus;
    /** Last date each status was reached (from the history). */
    reachedOn: Partial<Record<ContainerStatus, string>>;
    today: string;
    isArchived?: boolean;
}

/** (1) تم التأكيد ── (2) في الطريق ── (3) وصلت أم قصر ── (4) تم التسليم, with one tap to move (PRD §5.1, §8.6). */
export function StatusSteps({ containerId, status, reachedOn, today, isArchived }: StatusStepsProps) {
    const [target, setTarget] = useState<ContainerStatus | null>(null);
    const current = statusIndex(status);
    const next = STATUS_ORDER[current + 1];

    return (
        <div className="flex flex-col gap-4">
            <ol className="flex flex-col gap-0 md:flex-row md:items-start">
                {STATUS_ORDER.map((s, i) => {
                    const done = i < current;
                    const isCurrent = i === current;
                    const date = i <= current ? reachedOn[s] : undefined;
                    return (
                        <li key={s} className="relative flex flex-1 gap-3 pb-6 last:pb-0 md:flex-col md:items-center md:gap-2 md:pb-0 md:text-center">
                            {i < STATUS_ORDER.length - 1 && (
                                <span
                                    aria-hidden="true"
                                    className={cx(
                                        "absolute start-[17px] top-9 bottom-0 w-0.5 md:start-[calc(50%+22px)] md:end-[calc(-50%+22px)] md:top-[17px] md:bottom-auto md:h-0.5 md:w-auto",
                                        i < current ? "bg-brand-solid" : "bg-border-secondary",
                                    )}
                                />
                            )}
                            <button
                                type="button"
                                disabled={isCurrent || isArchived}
                                onClick={() => setTarget(s)}
                                aria-label={isCurrent ? `${t(`status.${s}`)} (المرحلة الحالية)` : `نقل إلى: ${t(`status.${s}`)}`}
                                className={cx(
                                    "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums outline-focus-ring transition-[background-color,transform] duration-150 ease-smooth focus-visible:outline-2 focus-visible:outline-offset-2 enabled:cursor-pointer enabled:active:scale-[0.97]",
                                    done && "bg-brand-solid text-white",
                                    isCurrent && "bg-brand-solid text-white ring-4 ring-brand-100",
                                    !done && !isCurrent && "bg-primary text-tertiary ring-1 ring-primary ring-inset enabled:hover:bg-primary_hover",
                                )}
                            >
                                {done ? <Check className="size-5" aria-hidden="true" /> : i + 1}
                            </button>
                            <div className="flex min-w-0 flex-col gap-0.5 pt-1.5 md:items-center md:pt-0">
                                <span className={cx("text-md", isCurrent ? "font-semibold text-primary" : done ? "text-secondary" : "text-tertiary")}>{t(`status.${s}`)}</span>
                                <span className="text-sm text-tertiary">{date ? <bdi className="num">{formatDate(date)}</bdi> : isCurrent ? "" : "—"}</span>
                            </div>
                        </li>
                    );
                })}
            </ol>
            {next && !isArchived && (
                <Button size="lg" color="secondary" className="self-start md:self-center" onClick={() => setTarget(next)}>
                    نقل إلى: {t(`statusShort.${next}`)}
                </Button>
            )}
            {target && <StatusDialog containerId={containerId} from={status} to={target} today={today} onClose={() => setTarget(null)} />}
        </div>
    );
}

function StatusDialog({ containerId, from, to, today, onClose }: { containerId: string; from: ContainerStatus; to: ContainerStatus; today: string; onClose: () => void }) {
    const [date, setDate] = useState<string | null>(today);
    const [note, setNote] = useState("");
    const backward = statusIndex(to) < statusIndex(from);
    const skipped = backward ? [] : STATUS_ORDER.slice(statusIndex(from) + 1, statusIndex(to));
    const move = useAction(changeStatusAction, { success: `تم نقل الحاوية إلى «${t(`status.${to}`)}»`, onSuccess: onClose });
    const err = move.fieldErrors;

    return (
        <AppDialog
            isOpen
            onOpenChange={(o) => !o && onClose()}
            size="sm"
            isDismissable={!move.pending}
            title={backward ? `إرجاع الحاوية إلى «${t(`status.${to}`)}»` : `نقل الحاوية إلى «${t(`status.${to}`)}»`}
            description={backward ? undefined : "اختر تاريخ هذه المرحلة. اليوم مختار تلقائياً."}
            footer={
                <>
                    <Button size="lg" color="secondary" onClick={onClose} isDisabled={move.pending}>
                        إلغاء
                    </Button>
                    <Button size="lg" color={backward ? "primary-destructive" : "primary"} isLoading={move.pending} showTextWhileLoading onClick={() => move.run(containerId, { to, date: date ?? "", note })}>
                        {backward ? "تأكيد الرجوع" : "تأكيد النقل"}
                    </Button>
                </>
            }
        >
            {backward && (
                <div className="flex gap-3 rounded-lg bg-warning-primary p-3 text-sm text-warning-primary ring-1 ring-warning-200 ring-inset">
                    <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
                    <p>الرجوع إلى مرحلة سابقة يُسجَّل في السجل مع السبب، وتُمسح تواريخ المراحل اللاحقة.</p>
                </div>
            )}
            {skipped.length > 0 && (
                <p className="rounded-lg bg-secondary p-3 text-sm text-secondary">
                    ستُسجَّل المراحل التي تخطيتها ({skipped.map((s) => t(`statusShort.${s}`)).join("، ")}) بنفس التاريخ.
                </p>
            )}
            <DateField label="التاريخ" isRequired value={date} onChange={setDate} isInvalid={!!err.date} hint={err.date ?? (date === today ? "اليوم" : undefined)} />
            <TextArea
                label={backward ? "سبب الرجوع" : optionalLabel("ملاحظة")}
                isRequired={backward}
                rows={2}
                value={note}
                onChange={setNote}
                isInvalid={!!err.note}
                hint={err.note}
                placeholder={backward ? "مثال: نُقلت بالخطأ" : undefined}
            />
        </AppDialog>
    );
}
