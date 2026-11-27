"use client";

import { useState } from "react";
import { AlertTriangle, Check, ClockRewind, InfoCircle, Lock01, ReverseLeft, Save01, Trash01 } from "@untitledui/icons";
import { Label as AriaLabel, Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";
import { AppDialog } from "@/components/app/app-dialog";
import { CardTitle, IconTile } from "@/components/app/icon-tile";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import type { RestorePointKind } from "@/db/schema";
import { createRestorePointAction, deleteRestorePointAction, resetDataAction, restoreFromPointAction } from "@/features/restore/actions";
import { useAction } from "@/hooks/use-action";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cx } from "@/utils/cx";

export interface RestorePointView {
    id: string;
    label: string;
    kind: RestorePointKind;
    counts: Record<string, number>;
    createdOn: string;
    createdAt: string;
}

const KIND_LABEL: Record<RestorePointKind, string | null> = {
    manual: null,
    before_restore: "تلقائية",
    before_reset: "تلقائية",
};

/** "حاويات 30 · حركات مالية 120 · تجار 10": what is inside a point, in the owner's words. */
function summary(counts: Record<string, number>) {
    const n = (k: string) => formatNumber(String(counts[k] ?? 0));
    return `حاويات ${n("containers")} · حركات مالية ${n("journal_entries")} · تجار ${n("traders")}`;
}

/** The two dialogs share this: what happens, in short lines with a tick. */
function Facts({ items }: { items: string[] }) {
    return (
        <ul className="flex flex-col gap-2 rounded-2xl bg-secondary p-4">
            {items.map((s) => (
                <li key={s} className="flex items-start gap-2 text-md text-secondary">
                    <Check className="mt-1 size-5 shrink-0 text-fg-success-primary" aria-hidden="true" />
                    <span>{s}</span>
                </li>
            ))}
        </ul>
    );
}

function PasswordField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
    return (
        <Input
            type="password"
            label="كلمة المرور للتأكيد"
            size="lg"
            autoComplete="current-password"
            value={value}
            onChange={onChange}
            isInvalid={!!error}
            hint={error ?? "نفس كلمة المرور التي تدخل بها إلى البرنامج."}
        />
    );
}

/**
 * Settings → نقاط الاسترجاع. Save a full copy of the data in one tap, go back to any copy, and (only after saving a
 * copy today) start fresh. Every restore and fresh start saves an automatic copy first, so each can be undone.
 */
export function RestorePointsPanel({ points, savedToday, today }: { points: RestorePointView[]; savedToday: boolean; today: string }) {
    const [label, setLabel] = useState("");
    const save = useAction(createRestorePointAction, { success: "تم حفظ نقطة الاسترجاع", onSuccess: () => setLabel("") });

    const [restoring, setRestoring] = useState<RestorePointView | null>(null);
    const [resetOpen, setResetOpen] = useState(false);
    const [deleting, setDeleting] = useState<RestorePointView | null>(null);
    const remove = useAction(deleteRestorePointAction, { success: "تم حذف النقطة", onSuccess: () => setDeleting(null) });

    const latest = points[0];

    return (
        <div className="flex max-w-3xl flex-col gap-5">
            {/* 1. Save now: the main job of this page, first and big. */}
            <section aria-labelledby="save-title" className="flex flex-col gap-5 surface p-5 md:p-6">
                <CardTitle
                    id="save-title"
                    icon={Save01}
                    color="teal"
                    title="احفظ نقطة استرجاع الآن"
                    hint="نسخة كاملة من كل الحاويات والحركات والإعدادات. إذا حدث خطأ، ترجع إليها بضغطة."
                />
                <form
                    className="flex flex-col gap-4 sm:flex-row sm:items-end"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save.run({ label });
                    }}
                >
                    <div className="flex-1">
                        <Input label="اسم النقطة (اختياري)" placeholder="مثلاً: قبل جرد آخر الشهر" size="lg" value={label} onChange={setLabel} maxLength={80} />
                    </div>
                    <Button type="submit" size="xl" iconLeading={Save01} isLoading={save.pending} showTextWhileLoading>
                        حفظ نقطة استرجاع
                    </Button>
                </form>
                {latest && (
                    <p className="flex items-center gap-2 text-sm text-tertiary">
                        <ClockRewind className="size-4 shrink-0" aria-hidden="true" />
                        آخر نقطة: <bdi className="num">{formatDateTime(new Date(latest.createdAt))}</bdi>
                    </p>
                )}
            </section>

            {/* 2. The saved points. */}
            <section aria-labelledby="points-title" className="flex flex-col gap-4 surface p-5 md:p-6">
                <CardTitle
                    id="points-title"
                    icon={ClockRewind}
                    color="teal"
                    title={`النقاط المحفوظة (${formatNumber(String(points.length))})`}
                    hint="اختر نقطة لترجع كل البيانات إلى ما كانت عليه وقتها."
                />
                {points.length === 0 ? (
                    <p className="rounded-2xl bg-secondary p-5 text-center text-md text-tertiary">لا توجد نقاط بعد. احفظ أول نقطة من الزر في الأعلى.</p>
                ) : (
                    <ul className="flex flex-col divide-y divide-secondary">
                        {points.map((p) => {
                            const auto = KIND_LABEL[p.kind];
                            const canDelete = p.kind === "manual" && p.createdOn !== today;
                            return (
                                <li key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <IconTile icon={auto ? ClockRewind : Save01} color={auto ? "gray" : "teal"} size="md" />
                                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className="flex flex-wrap items-center gap-2 text-md font-semibold text-primary">
                                                {p.label}
                                                {auto && (
                                                    <span className="rounded-full bg-tertiary px-2 py-0.5 text-xs font-semibold text-secondary">{auto}</span>
                                                )}
                                                {!auto && p.createdOn === today && (
                                                    <span className="rounded-full bg-success-primary px-2 py-0.5 text-xs font-semibold text-success-primary">
                                                        اليوم
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-sm text-tertiary">
                                                <bdi className="num">{formatDateTime(new Date(p.createdAt))}</bdi>
                                            </span>
                                            <span className="text-sm text-tertiary">{summary(p.counts)}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 ps-13 sm:ps-0">
                                        <Button size="md" color="secondary" iconLeading={ReverseLeft} onClick={() => setRestoring(p)}>
                                            استرجاع
                                        </Button>
                                        {canDelete && (
                                            <Button size="md" color="tertiary-destructive" iconLeading={Trash01} onClick={() => setDeleting(p)}>
                                                حذف
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p className="flex items-start gap-2 text-sm text-tertiary">
                    <InfoCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    النقاط محفوظة داخل البرنامج. نقطة اليوم لا تُحذف قبل الغد، والنقاط التلقائية تُحذف وحدها بعد 30 يوماً.
                </p>
            </section>

            {/* 3. Start fresh: appears only after the owner saved a point today. */}
            {savedToday ? (
                <section aria-labelledby="reset-title" className="flex flex-col gap-4 surface p-5 ring-1 ring-error_subtle ring-inset md:p-6">
                    <CardTitle
                        id="reset-title"
                        icon={AlertTriangle}
                        color="red"
                        title="البدء من جديد"
                        hint="يحذف الحاويات والحركات المالية ويبدأ البرنامج من الصفر. نقطة اليوم تبقى محفوظة، فتستطيع التراجع."
                    />
                    <div>
                        <Button size="lg" color="secondary-destructive" iconLeading={AlertTriangle} onClick={() => setResetOpen(true)}>
                            البدء من جديد…
                        </Button>
                    </div>
                </section>
            ) : (
                <section aria-labelledby="reset-locked-title" className="flex items-start gap-4 surface p-5 md:p-6">
                    <IconTile icon={Lock01} color="gray" size="md" />
                    <div className="flex flex-col gap-1">
                        <h3 id="reset-locked-title" className="text-md font-semibold text-primary">
                            البدء من جديد
                        </h3>
                        <p className="text-md text-tertiary">لحمايتك، يظهر هذا الخيار فقط بعد أن تحفظ نقطة استرجاع اليوم. هكذا تستطيع التراجع إذا غيّرت رأيك.</p>
                    </div>
                </section>
            )}

            {restoring && <RestoreDialog point={restoring} onClose={() => setRestoring(null)} />}
            {resetOpen && <ResetDialog onClose={() => setResetOpen(false)} />}
            <AppDialog
                isOpen={!!deleting}
                onOpenChange={(o) => !o && !remove.pending && setDeleting(null)}
                size="sm"
                title="حذف هذه النقطة؟"
                description={deleting ? `«${deleting.label}» من ${formatDateTime(new Date(deleting.createdAt))}. بياناتك الحالية لا تتغير.` : undefined}
                footer={
                    <>
                        <Button size="lg" color="secondary" onClick={() => setDeleting(null)} isDisabled={remove.pending}>
                            إلغاء
                        </Button>
                        <Button
                            size="lg"
                            color="primary-destructive"
                            iconLeading={Trash01}
                            isLoading={remove.pending}
                            onClick={() => deleting && remove.run(deleting.id)}
                        >
                            حذف النقطة
                        </Button>
                    </>
                }
            />
        </div>
    );
}

function RestoreDialog({ point, onClose }: { point: RestorePointView; onClose: () => void }) {
    const [password, setPassword] = useState("");
    const run = useAction(restoreFromPointAction, { success: "تم الاسترجاع. بياناتك الآن كما كانت في تلك النقطة.", onSuccess: onClose });
    const when = formatDateTime(new Date(point.createdAt));
    return (
        <AppDialog
            isOpen
            onOpenChange={(o) => !o && !run.pending && onClose()}
            isDismissable={!run.pending}
            title={`استرجاع «${point.label}»؟`}
            description={`كل البيانات ترجع إلى ما كانت عليه في ${when}.`}
            footer={
                <>
                    <Button size="lg" color="secondary" onClick={onClose} isDisabled={run.pending}>
                        إلغاء
                    </Button>
                    <Button
                        size="lg"
                        iconLeading={ReverseLeft}
                        isLoading={run.pending}
                        showTextWhileLoading
                        isDisabled={!password}
                        onClick={() => run.run({ id: point.id, password })}
                    >
                        {run.pending ? "جارٍ الاسترجاع…" : "استرجاع"}
                    </Button>
                </>
            }
        >
            <form
                className="flex flex-col gap-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (password) run.run({ id: point.id, password });
                }}
            >
                <Facts
                    items={[
                        `الحاويات والحركات والإعدادات ترجع كما كانت في ${when}.`,
                        "ما أضفته بعد ذلك يُحذف من البيانات الحالية.",
                        "قبل الاسترجاع نحفظ نقطة تلقائية لبياناتك الحالية، فتستطيع التراجع.",
                        "كلمة المرور والأجهزة المسجّلة لا تتغير.",
                    ]}
                />
                <PasswordField value={password} onChange={setPassword} error={run.fieldErrors.password} />
            </form>
        </AppDialog>
    );
}

function ResetDialog({ onClose }: { onClose: () => void }) {
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState<"records" | "everything">("records");
    const run = useAction(resetDataAction, { success: "تم البدء من جديد. نقطة اليوم محفوظة إذا أردت التراجع.", onSuccess: onClose });
    const submit = () => password && run.run({ keepSettings: mode === "records", password });

    const options = [
        {
            value: "records",
            title: "امسح الحاويات والمال فقط",
            hint: "تبقى قوائم التجار والجهات والقاصات وأنواع المصاريف وخطوط الشحن، وكل الأرصدة تصبح صفراً.",
        },
        { value: "everything", title: "امسح كل شيء", hint: "يرجع البرنامج كما كان أول مرة، مع القوائم الأصلية." },
    ] as const;

    return (
        <AppDialog
            isOpen
            onOpenChange={(o) => !o && !run.pending && onClose()}
            isDismissable={!run.pending}
            title="البدء من جديد"
            description="اختر ماذا تريد أن تمسح."
            footer={
                <>
                    <Button size="lg" color="secondary" onClick={onClose} isDisabled={run.pending}>
                        إلغاء
                    </Button>
                    <Button
                        size="lg"
                        color="primary-destructive"
                        iconLeading={AlertTriangle}
                        isLoading={run.pending}
                        showTextWhileLoading
                        isDisabled={!password}
                        onClick={submit}
                    >
                        {run.pending ? "جارٍ الحذف…" : "حذف والبدء من جديد"}
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
                <AriaRadioGroup value={mode} onChange={(v) => setMode(v as typeof mode)} className="flex flex-col gap-2">
                    <AriaLabel className="sr-only">ماذا تريد أن تمسح؟</AriaLabel>
                    {options.map((o) => (
                        <AriaRadio
                            key={o.value}
                            value={o.value}
                            className={({ isSelected, isFocusVisible }) =>
                                cx(
                                    "flex cursor-pointer items-start gap-3 rounded-2xl bg-primary p-4 ring-1 transition-[box-shadow,background-color] duration-150 ease-smooth select-none ring-inset",
                                    isSelected ? "bg-error-primary shadow-card ring-2 ring-error" : "shadow-xs ring-secondary hover:shadow-card",
                                    isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                                )
                            }
                        >
                            {({ isSelected }) => (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className={cx(
                                            "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full ring-2 ring-inset",
                                            isSelected ? "bg-error-solid text-white ring-transparent" : "ring-primary",
                                        )}
                                    >
                                        {isSelected && <Check className="size-4" strokeWidth={3} />}
                                    </span>
                                    <span className="flex flex-col gap-0.5">
                                        <span className="text-md font-semibold text-primary">{o.title}</span>
                                        <span className="text-sm text-tertiary">{o.hint}</span>
                                    </span>
                                </>
                            )}
                        </AriaRadio>
                    ))}
                </AriaRadioGroup>
                <Facts
                    items={[
                        "قبل الحذف نحفظ نقطة تلقائية لبياناتك الحالية.",
                        "نقطة اليوم تبقى محفوظة، فتستطيع الرجوع إليها.",
                        "كلمة المرور والأجهزة المسجّلة لا تتغير.",
                    ]}
                />
                <PasswordField value={password} onChange={setPassword} error={run.fieldErrors.password} />
            </form>
        </AppDialog>
    );
}
