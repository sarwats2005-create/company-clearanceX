"use client";

import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Anchor, Calendar, CheckCircle, Container, Package } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppDialog } from "@/components/app/app-dialog";
import { DateField } from "@/components/app/date-field";
import { EntityCombobox, type EntityOption } from "@/components/app/entity-combobox";
import { optionalLabel } from "@/components/app/field-label";
import { NewTraderDialog, QuickAddDialog } from "@/components/app/quick-add-dialogs";
import { SegmentedControl } from "@/components/app/segmented-control";
import { SelectField } from "@/components/app/select-field";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import type { ContainerStatus } from "@/db/schema";
import { checkContainerNumberAction, createContainerAction, updateContainerAction } from "@/features/containers/actions";
import { containerInputSchema } from "@/features/containers/schemas";
import { capacityFor } from "@/features/containers/shares";
import { useAction } from "@/hooks/use-action";
import { normalizeContainerNumber } from "@/lib/container-number";
import { t } from "@/lib/i18n";
import { zodFieldErrors } from "@/lib/zod-errors";
import { cx } from "@/utils/cx";
import { FormSection } from "./form-section";
import { SharesEditor } from "./shares-editor";
import { type FormValues, type SectionKey, emptyShare, emptyValues, sectionCounts, sectionOf, toInput } from "./values";

export interface ContainerFormOptions {
    shippingLines: { id: string; name: string; isActive: boolean }[];
    ports: { id: string; name: string; country: string | null; isActive: boolean }[];
    sizes: { id: string; label: string; lengthM: string | null; volumeM3: string | null; isActive: boolean }[];
    parties: { id: string; name: string; isActive: boolean }[];
    traders: { id: string; name: string; phone: string | null }[];
    defaults: { companyPartyId: string | null; shippingLineId: string | null; portOfLoadingId: string | null };
    suggestions: { goods: string[]; destinations: string[] };
}

interface ContainerFormProps {
    mode: "create" | "edit";
    containerId?: string;
    status?: ContainerStatus | null;
    /** Edit mode: the container has active charges (the trader/shared switch are then locked). */
    hasCharges?: boolean;
    initial: FormValues;
    options: ContainerFormOptions;
    today: string;
}

const DRAFT_KEY = "cc:container-draft";
const FOLD_KEY = "cc:container-form-sections";

/** Order used to find "the first invalid field". */
const FIELD_ORDER = [
    ...new Set([
        "containerNumber",
        "shippingLineId",
        "shares.0.traderId",
        "isShared",
        "splitUnit",
        "shares",
        ...Array.from({ length: 30 }, (_, i) => [
            `shares.${i}.traderId`,
            `shares.${i}.shareValue`,
            `shares.${i}.goods`,
            `shares.${i}.cartons`,
            `shares.${i}.weightKg`,
        ]).flat(),
        "portOfLoadingId",
        "billOfLadingNumber",
        "containerSizeId",
        "quantity",
        "faxNumber",
        "companyPartyId",
        "destination",
        "registeredOn",
        "expectedArrivalOn",
        "arrivedOn",
        "deliveredOn",
        "notes",
    ]),
];

const FIELD_NAME: Record<string, string> = {
    containerNumber: "رقم الحاوية",
    shippingLineId: "خط الشحن",
    "shares.0.traderId": "التاجر",
    splitUnit: "وحدة التقسيم",
    shares: "الحصص",
    portOfLoadingId: "ميناء التحميل",
    billOfLadingNumber: "رقم البوليصة",
    quantity: "العدد",
    faxNumber: "الفاكس",
    destination: "الجهة",
    registeredOn: "تاريخ التسجيل",
    expectedArrivalOn: "تاريخ الوصول المتوقع",
    notes: "الملاحظة",
};
const fieldName = (key: string) => FIELD_NAME[key] ?? (/^shares\.(\d+)/.test(key) ? `التاجر ${Number(key.split(".")[1]) + 1}` : "حقل");

const readJson = <T,>(key: string): T | null => {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
};
const writeJson = (key: string, value: unknown) => {
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* private mode: drafts are a convenience only */
    }
};

const countWord = (n: number) => (n === 2 ? "حقلين" : n <= 10 ? `${n} حقول` : `${n} حقلاً`);
const hasContent = (v: FormValues) => !!(v.containerNumber.trim() || v.shares.some((s) => s.traderId));

export function ContainerForm({ mode, containerId, status = null, hasCharges = false, initial, options, today }: ContainerFormProps) {
    const router = useRouter();
    const isEdit = mode === "edit";
    const [values, setValues] = useState<FormValues>(initial);
    const [baseline, setBaseline] = useState<FormValues>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [lines, setLines] = useState(options.shippingLines);
    const [ports, setPorts] = useState(options.ports);
    const [traders, setTraders] = useState(options.traders);
    const [dialog, setDialog] = useState<{ kind: "line" | "port" | "trader"; typed: string; rowKey?: string } | null>(null);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [draft, setDraft] = useState<FormValues | null>(null);
    const [check, setCheck] = useState<{ normalized: string; existingId: string | null; isUsualFormat: boolean } | null>(null);
    const hiddenShares = useRef<FormValues["shares"]>([]);
    const formRef = useRef<HTMLFormElement>(null);
    const savingRef = useRef(false);

    // ---- folding (remembered on this device; edit mode opens every section that has data)
    const counts = sectionCounts(values, { companyPartyId: options.defaults.companyPartyId }, status);
    const [open, setOpen] = useState<Record<SectionKey, boolean>>(() => {
        if (isEdit) {
            const c = sectionCounts(initial, { companyPartyId: options.defaults.companyPartyId }, status);
            return { shipment: c.shipment.filled > 0, goods: c.goods.filled > 0, dates: true };
        }
        return { shipment: false, goods: false, dates: false };
    });
    useEffect(() => {
        if (isEdit) return;
        const saved = readJson<Record<SectionKey, boolean>>(FOLD_KEY);
        if (saved) setOpen((o) => ({ ...o, ...saved }));
    }, [isEdit]);
    const toggle = (k: SectionKey) =>
        setOpen((o) => {
            const next = { ...o, [k]: !o[k] };
            if (!isEdit) writeJson(FOLD_KEY, next);
            return next;
        });

    // ---- draft safety (create mode)
    useEffect(() => {
        if (isEdit) return;
        const saved = readJson<FormValues>(DRAFT_KEY);
        if (saved && hasContent(saved)) setDraft(saved);
    }, [isEdit]);
    const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(baseline), [values, baseline]);
    useEffect(() => {
        if (isEdit || !dirty || draft) return;
        const id = window.setTimeout(() => writeJson(DRAFT_KEY, hasContent(values) ? values : null), 2000);
        return () => window.clearTimeout(id);
    }, [values, dirty, isEdit, draft]);
    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => {
            if (savingRef.current) return;
            e.preventDefault();
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    // ---- live container-number check (400ms after typing stops)
    useEffect(() => {
        const raw = values.containerNumber;
        if (!normalizeContainerNumber(raw)) {
            setCheck(null);
            return;
        }
        const id = window.setTimeout(async () => {
            const res = await checkContainerNumberAction(raw, containerId);
            if (res.ok) setCheck(res.data);
        }, 400);
        return () => window.clearTimeout(id);
    }, [values.containerNumber, containerId]);

    const set = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
        setValues((v) => ({ ...v, [key]: value }));
        setErrors((e) => {
            if (!e[key as string]) return e;
            const { [key as string]: _, ...rest } = e;
            return rest;
        });
    }, []);
    const setShares = (shares: FormValues["shares"]) => {
        setValues((v) => ({ ...v, shares }));
        setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("shares"))));
    };
    const patchFirst = (p: Partial<FormValues["shares"][number]>) => setShares(values.shares.map((s, i) => (i === 0 ? { ...s, ...p } : s)));

    const toggleShared = (on: boolean) => {
        setValues((v) => {
            if (on) {
                const rows = hiddenShares.current.length ? [v.shares[0], ...hiddenShares.current] : [v.shares[0], emptyShare()];
                hiddenShares.current = [];
                return { ...v, isShared: true, splitUnit: v.splitUnit ?? "meters", shares: rows };
            }
            hiddenShares.current = v.shares.slice(1);
            return { ...v, isShared: false, shares: v.shares.slice(0, 1) };
        });
        setErrors({});
    };

    // ---- options for the pickers (keep an inactive item when it is the current value)
    const lineItems: EntityOption[] = useMemo(
        () => lines.filter((l) => l.isActive || l.id === values.shippingLineId).map((l) => ({ id: l.id, label: l.name })),
        [lines, values.shippingLineId],
    );
    const portItems: EntityOption[] = useMemo(
        () =>
            ports
                .filter((p) => p.isActive || p.id === values.portOfLoadingId)
                .map((p) => ({ id: p.id, label: p.name, supportingText: p.country ?? undefined })),
        [ports, values.portOfLoadingId],
    );
    const traderItems: EntityOption[] = useMemo(() => traders.map((tr) => ({ id: tr.id, label: tr.name, supportingText: tr.phone ?? undefined })), [traders]);
    const sizeItems = options.sizes.filter((s) => s.isActive || s.id === values.containerSizeId);
    const partyItems = options.parties.filter((p) => p.isActive || p.id === values.companyPartyId).map((p) => ({ id: p.id, label: p.name }));
    const size = options.sizes.find((s) => s.id === values.containerSizeId) ?? null;
    const capacity = capacityFor(size, values.splitUnit);

    // ---- validation, focus, save
    const focusField = (key: string) => {
        const section = sectionOf(key);
        if (section && !open[section]) setOpen((o) => ({ ...o, [section]: true }));
        window.requestAnimationFrame(() => {
            const el =
                formRef.current?.querySelector<HTMLElement>(`[data-field="${key}"]`) ??
                formRef.current?.querySelector<HTMLElement>(`[data-field^="${key.split(".")[0]}"]`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            el?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, [role=spinbutton], [role=radio], button")?.focus({ preventScroll: true });
        });
    };
    const showErrors = (errs: Record<string, string>) => {
        setErrors(errs);
        const first = FIELD_ORDER.find((k) => errs[k]) ?? Object.keys(errs)[0];
        if (first) focusField(first);
    };

    const create = useAction(createContainerAction);
    const update = useAction((input: ReturnType<typeof toInput>) => updateContainerAction(containerId!, input));
    const pending = create.pending || update.pending;

    const save = async (then: "open" | "another") => {
        if (pending) return;
        const input = toInput(values);
        const parsed = containerInputSchema.safeParse(input);
        const errs = parsed.success ? {} : zodFieldErrors(parsed.error);
        if (check?.existingId && !errs.containerNumber) errs.containerNumber = t("error.duplicateContainer");
        if (Object.keys(errs).length) {
            showErrors(errs);
            toast.error(Object.keys(errs).length > 1 ? `يرجى تصحيح ${countWord(Object.keys(errs).length)}` : Object.values(errs)[0]);
            return;
        }
        savingRef.current = true;
        if (isEdit) {
            const res = await update.run(input);
            if (!res.ok) {
                savingRef.current = false;
                return showErrors(res.fieldErrors ?? {});
            }
            toast.success("تم حفظ التعديلات");
            setBaseline(values);
            router.push(`/containers/${containerId}`);
            return;
        }
        const res = await create.run(input);
        if (!res.ok) {
            savingRef.current = false;
            return showErrors(res.fieldErrors ?? {});
        }
        writeJson(DRAFT_KEY, null);
        const { id, containerNumber } = res.data;
        if (then === "open") {
            toast.success(`تمت إضافة الحاوية ${containerNumber}`);
            setBaseline(values);
            router.push(`/containers/${id}?new=1`);
            return;
        }
        toast.success(`تمت إضافة الحاوية ${containerNumber}`, { action: { label: "فتح الحاوية", onClick: () => router.push(`/containers/${id}`) } });
        // A whole ship often arrives together: keep the line, the port and the date.
        const next = {
            ...emptyValues({
                shippingLineId: values.shippingLineId,
                portOfLoadingId: values.portOfLoadingId,
                companyPartyId: options.defaults.companyPartyId,
                registeredOn: values.registeredOn ?? today,
            }),
        };
        hiddenShares.current = [];
        setValues(next);
        setBaseline(next);
        setErrors({});
        setCheck(null);
        savingRef.current = false;
        focusField("containerNumber");
    };

    // Enter moves to the next field; Ctrl/⌘+Enter saves (PRD §8.5.6).
    const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
        if (e.key !== "Enter") return;
        const target = e.target as HTMLElement;
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            void save("open");
            return;
        }
        if (target.tagName === "TEXTAREA" || target.getAttribute("aria-expanded") === "true" || target.tagName === "BUTTON") return;
        e.preventDefault();
        const fields = Array.from(formRef.current?.querySelectorAll<HTMLElement>("[data-field]") ?? []);
        const at = fields.findIndex((f) => f.contains(target));
        for (const f of fields.slice(at + 1)) {
            const el = f.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea, [role=spinbutton], [role=radio]");
            if (el) {
                el.focus();
                return;
            }
        }
    };

    const leave = () => {
        writeJson(DRAFT_KEY, null);
        savingRef.current = true;
        router.push(isEdit ? `/containers/${containerId}` : "/containers");
    };

    // ---- summary
    const traderName = (id: string | null) => traders.find((x) => x.id === id)?.name ?? "";
    const lineName = lines.find((l) => l.id === values.shippingLineId)?.name ?? "";
    const portName = ports.find((p) => p.id === values.portOfLoadingId)?.name ?? "";
    const chosenTraders = (values.isShared ? values.shares : values.shares.slice(0, 1)).map((s) => traderName(s.traderId)).filter(Boolean);
    const numberOk = !!check && !check.existingId;
    const missing = [
        !normalizeContainerNumber(values.containerNumber) && "رقم الحاوية",
        !values.shippingLineId && "خط الشحن",
        chosenTraders.length === 0 && "التاجر",
    ].filter(Boolean) as string[];
    const ready = missing.length === 0 && !check?.existingId;

    const shipmentPreview = [
        portName,
        values.billOfLadingNumber.trim() && `B/L ${values.billOfLadingNumber.trim().toUpperCase()}`,
        size?.label,
        values.faxNumber.trim() && `فاكس ${values.faxNumber.trim()}`,
    ]
        .filter(Boolean)
        .join(" · ");
    const goodsPreview = [
        values.shares[0]?.goods.trim(),
        values.shares[0]?.cartons.trim() && `${values.shares[0].cartons.trim()} كرتون`,
        values.destination.trim(),
    ]
        .filter(Boolean)
        .join(" · ");
    const datesPreview = [values.expectedArrivalOn && "الوصول المتوقع محدد", values.notes.trim() && "ملاحظة"].filter(Boolean).join(" · ");

    const errorKeys = Object.keys(errors);
    const s0 = values.shares[0];

    const numberHint = (() => {
        if (errors.containerNumber && !check?.existingId) return errors.containerNumber;
        if (!check) return undefined;
        if (check.existingId)
            return (
                <span>
                    {t("error.duplicateContainer")} ·{" "}
                    <a href={`/containers/${check.existingId}`} className="font-semibold underline underline-offset-2">
                        فتح الحاوية
                    </a>
                </span>
            );
        if (!check.isUsualFormat) return <span className="text-warning-primary">{t("warn.containerFormat")}</span>;
        return (
            <span className="inline-flex items-center gap-1 text-success-primary">
                <CheckCircle className="size-4" aria-hidden="true" />
                {t("form.containerAvailable")}
            </span>
        );
    })();

    const actions = (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <Button size="xl" isLoading={pending} showTextWhileLoading onClick={() => save("open")} className="w-full md:w-auto">
                {pending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "حفظ الحاوية"}
            </Button>
            <div className="flex items-center justify-center gap-4 md:contents">
                {!isEdit && (
                    <Button
                        size="xl"
                        color="secondary"
                        isDisabled={pending}
                        onClick={() => save("another")}
                        className="max-md:h-11 max-md:bg-transparent max-md:px-2 max-md:shadow-none max-md:ring-0"
                    >
                        {t("form.saveAndNew")}
                    </Button>
                )}
                <Button
                    size="xl"
                    color="tertiary"
                    isDisabled={pending}
                    onClick={() => (dirty ? setLeaveOpen(true) : leave())}
                    className="max-md:h-11 max-md:px-2"
                >
                    {t("action.cancel")}
                </Button>
            </div>
            <span className={cx("text-sm md:ms-auto", ready ? "text-success-primary" : "text-tertiary", "xl:hidden")}>
                {ready ? "✓ جاهز للحفظ" : `ينقص: ${missing.join("، ") || "تصحيح رقم الحاوية"}`}
            </span>
        </div>
    );

    return (
        <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col">
            {draft && (
                <div
                    role="status"
                    className="ring-warning-200 mb-6 flex flex-col gap-3 rounded-xl bg-warning-primary p-4 ring-1 ring-inset sm:flex-row sm:items-center sm:justify-between"
                >
                    <p className="text-md text-primary">{t("form.draftFound", { number: draft.containerNumber.trim() || "بدون رقم" })}</p>
                    <div className="flex gap-2">
                        <Button
                            size="md"
                            onClick={() => {
                                setValues(draft);
                                setDraft(null);
                                const c = sectionCounts(draft, { companyPartyId: options.defaults.companyPartyId }, null);
                                setOpen((o) => ({
                                    shipment: o.shipment || c.shipment.filled > 0,
                                    goods: o.goods || c.goods.filled > 0,
                                    dates: o.dates || c.dates.filled > 1,
                                }));
                            }}
                        >
                            متابعة
                        </Button>
                        <Button
                            size="md"
                            color="secondary"
                            onClick={() => {
                                writeJson(DRAFT_KEY, null);
                                setDraft(null);
                            }}
                        >
                            حذف المسودة
                        </Button>
                    </div>
                </div>
            )}

            {errorKeys.length > 1 && (
                <div role="alert" className="mb-6 flex gap-3 rounded-xl bg-error-primary p-4 ring-1 ring-error_subtle ring-inset">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-fg-error-primary" aria-hidden="true" />
                    <div className="flex flex-col gap-1">
                        <p className="text-md font-semibold text-error-primary">يرجى تصحيح {countWord(errorKeys.length)}</p>
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {FIELD_ORDER.filter((k) => errors[k]).map((k) => (
                                <li key={k}>
                                    <button
                                        type="button"
                                        onClick={() => focusField(k)}
                                        className="cursor-pointer text-error-primary underline underline-offset-2"
                                    >
                                        {fieldName(k)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <fieldset disabled={pending} className="flex min-w-0 items-start gap-8">
                <div className="flex w-full max-w-[720px] min-w-0 flex-col gap-6 pb-24">
                    <FormSection id="sec-basics" step="1" title="الأساسيات" icon={Container} required isOpen accent>
                        <div data-field="containerNumber">
                            <Input
                                label="رقم الحاوية"
                                isRequired
                                size="lg"
                                autoFocus={!isEdit}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck="false"
                                placeholder="مثال: MSCU4829175"
                                inputClassName="cn text-end text-lg tracking-wide uppercase placeholder:font-body placeholder:normal-case placeholder:tracking-normal"
                                value={values.containerNumber}
                                onChange={(v) => set("containerNumber", v)}
                                isInvalid={!!errors.containerNumber || !!check?.existingId}
                                hint={numberHint}
                            />
                        </div>
                        <div data-field="shippingLineId">
                            <EntityCombobox
                                label="خط الشحن"
                                aria-label="خط الشحن"
                                isRequired
                                icon={Anchor}
                                items={lineItems}
                                value={values.shippingLineId}
                                onChange={(id) => set("shippingLineId", id)}
                                addLabel="إضافة خط جديد"
                                onAdd={(typed) => setDialog({ kind: "line", typed })}
                                isInvalid={!!errors.shippingLineId}
                                hint={
                                    errors.shippingLineId ??
                                    (!isEdit &&
                                    values.shippingLineId &&
                                    values.shippingLineId === options.defaults.shippingLineId &&
                                    values.shippingLineId === baseline.shippingLineId
                                        ? "اخترناه لأنه آخر خط استخدمته. يمكنك تغييره."
                                        : undefined)
                                }
                            />
                        </div>
                        {!values.isShared && (
                            <div data-field="shares.0.traderId">
                                <EntityCombobox
                                    label="التاجر"
                                    aria-label="التاجر"
                                    isRequired
                                    items={traderItems}
                                    value={s0?.traderId ?? null}
                                    onChange={(id) => patchFirst({ traderId: id })}
                                    addLabel="إضافة تاجر جديد"
                                    onAdd={(typed) => setDialog({ kind: "trader", typed, rowKey: s0?.key })}
                                    isDisabled={isEdit && hasCharges}
                                    isInvalid={!!errors["shares.0.traderId"]}
                                    hint={
                                        errors["shares.0.traderId"] ??
                                        (isEdit && hasCharges ? "على الحاوية مصاريف مسجلة على هذا التاجر. ألغِ المصاريف أولاً لتغييره." : undefined)
                                    }
                                />
                            </div>
                        )}
                        <div data-field="isShared" className="flex flex-col gap-1.5">
                            <Toggle
                                size="md"
                                label={t("form.sharedSwitch")}
                                hint="عندما تحمل الحاوية بضاعة لأكثر من تاجر، وتُقسَّم المصاريف بينهم."
                                isSelected={values.isShared}
                                onChange={toggleShared}
                                isDisabled={isEdit && hasCharges && values.isShared === initial.isShared && initial.isShared}
                            />
                            {errors.isShared && <p className="text-sm text-error-primary">{errors.isShared}</p>}
                            {isEdit && hasCharges && initial.isShared && (
                                <p className="text-sm text-tertiary">على الحاوية مصاريف موزعة على التجار، لذلك لا يمكن إلغاء المشاركة الآن.</p>
                            )}
                        </div>
                    </FormSection>

                    {values.isShared && (
                        <FormSection id="sec-shares" step="1ب" title="الحصص" icon={Package} required isOpen>
                            <SharesEditor
                                unit={values.splitUnit}
                                onUnitChange={(u) => set("splitUnit", u)}
                                rows={values.shares}
                                onRowsChange={setShares}
                                traders={traderItems}
                                onAddTrader={(rowKey, typed) => setDialog({ kind: "trader", typed, rowKey })}
                                capacity={capacity}
                                sizeLabel={size?.label ?? null}
                                errors={errors}
                                goodsSuggestions={options.suggestions.goods}
                            />
                        </FormSection>
                    )}

                    <FormSection
                        id="sec-shipment"
                        step="2"
                        title="تفاصيل الشحنة"
                        icon={Anchor}
                        filled={counts.shipment.filled}
                        total={counts.shipment.total}
                        preview={shipmentPreview}
                        isOpen={open.shipment}
                        onToggle={() => toggle("shipment")}
                    >
                        <div data-field="portOfLoadingId">
                            <EntityCombobox
                                label={optionalLabel("ميناء التحميل")}
                                aria-label="ميناء التحميل"
                                items={portItems}
                                value={values.portOfLoadingId}
                                onChange={(id) => set("portOfLoadingId", id)}
                                addLabel="إضافة ميناء"
                                onAdd={(typed) => setDialog({ kind: "port", typed })}
                                isInvalid={!!errors.portOfLoadingId}
                                hint={errors.portOfLoadingId}
                            />
                        </div>
                        <div data-field="billOfLadingNumber">
                            <Input
                                label={optionalLabel("رقم البوليصة (B/L)")}
                                size="lg"
                                autoComplete="off"
                                spellCheck="false"
                                placeholder="مثال: COSU62341"
                                inputClassName="cn text-end uppercase placeholder:font-body placeholder:normal-case"
                                value={values.billOfLadingNumber}
                                onChange={(v) => set("billOfLadingNumber", v)}
                                isInvalid={!!errors.billOfLadingNumber}
                                hint={errors.billOfLadingNumber ?? "رقم واحد قد يشمل أكثر من حاوية."}
                            />
                        </div>
                        <div data-field="containerSizeId" className="flex flex-col gap-1.5">
                            <SegmentedControl
                                label="حجم الحاوية (اختياري)"
                                value={values.containerSizeId}
                                onChange={(id) => set("containerSizeId", values.containerSizeId === id ? null : id)}
                                options={sizeItems.map((s) => ({ value: s.id, label: s.label }))}
                            />
                            {values.containerSizeId && (
                                <button
                                    type="button"
                                    onClick={() => set("containerSizeId", null)}
                                    className="cursor-pointer self-start text-sm text-tertiary underline underline-offset-2"
                                >
                                    بدون حجم
                                </button>
                            )}
                        </div>
                        <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                            <div data-field="quantity">
                                <Input
                                    label={optionalLabel("العدد")}
                                    size="lg"
                                    inputMode="numeric"
                                    inputClassName="num [direction:ltr] text-end"
                                    value={values.quantity}
                                    onChange={(v) => set("quantity", v)}
                                    isInvalid={!!errors.quantity}
                                    hint={errors.quantity}
                                />
                            </div>
                            <div data-field="faxNumber">
                                <Input
                                    label={optionalLabel("فاكس")}
                                    size="lg"
                                    inputClassName="num [direction:ltr] text-end"
                                    value={values.faxNumber}
                                    onChange={(v) => set("faxNumber", v)}
                                    isInvalid={!!errors.faxNumber}
                                    hint={errors.faxNumber}
                                />
                            </div>
                        </div>
                        <div data-field="companyPartyId">
                            <SelectField
                                label={optionalLabel("شركة التخليص")}
                                aria-label="شركة التخليص"
                                items={partyItems}
                                value={values.companyPartyId}
                                onChange={(id) => set("companyPartyId", id)}
                                isInvalid={!!errors.companyPartyId}
                                hint={errors.companyPartyId}
                            />
                        </div>
                    </FormSection>

                    {!values.isShared && (
                        <FormSection
                            id="sec-goods"
                            step="3"
                            title="البضاعة"
                            icon={Package}
                            filled={counts.goods.filled}
                            total={counts.goods.total}
                            preview={goodsPreview}
                            isOpen={open.goods}
                            onToggle={() => toggle("goods")}
                        >
                            <div data-field="shares.0.goods">
                                <Input
                                    label={optionalLabel("البضاعة")}
                                    size="lg"
                                    list="cc-goods-list"
                                    placeholder="مثال: أجهزة كهربائية"
                                    value={s0?.goods ?? ""}
                                    onChange={(v) => patchFirst({ goods: v })}
                                    isInvalid={!!errors["shares.0.goods"]}
                                    hint={errors["shares.0.goods"]}
                                />
                                <datalist id="cc-goods-list">
                                    {options.suggestions.goods.map((g) => (
                                        <option key={g} value={g} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                                <div data-field="shares.0.cartons">
                                    <Input
                                        label={optionalLabel("عدد الكراتين")}
                                        size="lg"
                                        inputMode="numeric"
                                        inputClassName="num [direction:ltr] text-end"
                                        value={s0?.cartons ?? ""}
                                        onChange={(v) => patchFirst({ cartons: v })}
                                        isInvalid={!!errors["shares.0.cartons"]}
                                        hint={errors["shares.0.cartons"]}
                                    />
                                </div>
                                <div data-field="shares.0.weightKg">
                                    <Input
                                        label={optionalLabel("الوزن (كغم)")}
                                        size="lg"
                                        inputMode="decimal"
                                        inputClassName="num [direction:ltr] text-end"
                                        value={s0?.weightKg ?? ""}
                                        onChange={(v) => patchFirst({ weightKg: v })}
                                        isInvalid={!!errors["shares.0.weightKg"]}
                                        hint={errors["shares.0.weightKg"]}
                                    />
                                </div>
                            </div>
                            <div data-field="destination">
                                <Input
                                    label={optionalLabel("الجهة")}
                                    size="lg"
                                    list="cc-destination-list"
                                    placeholder="مثال: بغداد"
                                    value={values.destination}
                                    onChange={(v) => set("destination", v)}
                                    isInvalid={!!errors.destination}
                                    hint={errors.destination}
                                />
                                <datalist id="cc-destination-list">
                                    {options.suggestions.destinations.map((d) => (
                                        <option key={d} value={d} />
                                    ))}
                                </datalist>
                            </div>
                        </FormSection>
                    )}

                    <FormSection
                        id="sec-dates"
                        step={values.isShared ? "3" : "4"}
                        title="التواريخ والملاحظات"
                        icon={Calendar}
                        filled={counts.dates.filled}
                        total={counts.dates.total}
                        preview={datesPreview}
                        isOpen={open.dates}
                        onToggle={() => toggle("dates")}
                    >
                        <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                            <div data-field="registeredOn">
                                <DateField
                                    label="تاريخ التسجيل"
                                    value={values.registeredOn}
                                    onChange={(v) => set("registeredOn", v)}
                                    isInvalid={!!errors.registeredOn}
                                    hint={errors.registeredOn ?? (values.registeredOn === today ? "اليوم" : undefined)}
                                />
                            </div>
                            <div data-field="expectedArrivalOn">
                                <DateField
                                    label={optionalLabel("تاريخ الوصول المتوقع")}
                                    value={values.expectedArrivalOn}
                                    onChange={(v) => set("expectedArrivalOn", v)}
                                    isInvalid={!!errors.expectedArrivalOn}
                                    hint={errors.expectedArrivalOn}
                                />
                            </div>
                        </div>
                        {(status === "arrived" || status === "delivered") && (
                            <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                                <div data-field="arrivedOn">
                                    <DateField
                                        label="تاريخ الوصول"
                                        value={values.arrivedOn}
                                        onChange={(v) => set("arrivedOn", v)}
                                        isInvalid={!!errors.arrivedOn}
                                        hint={errors.arrivedOn}
                                    />
                                </div>
                                {status === "delivered" && (
                                    <div data-field="deliveredOn">
                                        <DateField
                                            label="تاريخ التسليم"
                                            value={values.deliveredOn}
                                            onChange={(v) => set("deliveredOn", v)}
                                            isInvalid={!!errors.deliveredOn}
                                            hint={errors.deliveredOn}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        <div data-field="notes">
                            <TextArea
                                label={optionalLabel("ملاحظة")}
                                rows={3}
                                value={values.notes}
                                onChange={(v) => set("notes", v)}
                                isInvalid={!!errors.notes}
                                hint={errors.notes}
                            />
                        </div>
                    </FormSection>
                </div>

                <aside
                    aria-label="ملخص الحاوية"
                    className="sticky top-6 hidden w-80 shrink-0 flex-col gap-4 rounded-xl bg-primary p-6 shadow-xs ring-1 ring-secondary xl:flex"
                >
                    <h2 className="text-md font-semibold text-primary">ملخص الحاوية</h2>
                    <dl className="flex flex-col gap-2.5 text-sm">
                        <SummaryRow label="الرقم" value={check?.normalized || normalizeContainerNumber(values.containerNumber)} ok={numberOk} mono />
                        <SummaryRow label="الخط" value={lineName} ok={!!lineName} />
                        <SummaryRow label={chosenTraders.length > 1 ? "التجار" : "التاجر"} value={chosenTraders.join("، ")} ok={chosenTraders.length > 0} />
                    </dl>
                    <hr className="border-secondary" />
                    <dl className="flex flex-col gap-2.5 text-sm">
                        <SummaryRow label="الحجم" value={size?.label ?? ""} />
                        <SummaryRow label="البوليصة" value={values.billOfLadingNumber.trim().toUpperCase()} mono />
                        <SummaryRow label="الميناء" value={portName} />
                        <SummaryRow
                            label="البضاعة"
                            value={
                                values.isShared
                                    ? values.shares
                                          .map((s) => s.goods.trim())
                                          .filter(Boolean)
                                          .join("، ")
                                    : (s0?.goods.trim() ?? "")
                            }
                        />
                    </dl>
                    <p
                        className={cx(
                            "rounded-lg px-3 py-2 text-sm font-semibold",
                            ready ? "bg-success-primary text-success-primary" : "bg-secondary text-tertiary",
                        )}
                    >
                        {ready ? "✓ جاهز للحفظ" : `ينقص: ${missing.join("، ") || "تصحيح رقم الحاوية"}`}
                    </p>
                </aside>
            </fieldset>

            <div className="no-print sticky bottom-0 z-10 -mx-4 border-t border-secondary bg-primary/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
                <div className="w-full max-w-[720px]">{actions}</div>
            </div>

            <NewTraderDialog
                isOpen={dialog?.kind === "trader"}
                onOpenChange={(o) => !o && setDialog(null)}
                initialName={dialog?.kind === "trader" ? dialog.typed : ""}
                onCreated={(tr) => {
                    setTraders((list) => [...list, { id: tr.id, name: tr.name, phone: null }].sort((a, b) => a.name.localeCompare(b.name, "ar")));
                    const key = dialog?.rowKey;
                    setShares(values.shares.map((s, i) => ((key ? s.key === key : i === 0) ? { ...s, traderId: tr.id } : s)));
                }}
            />
            <QuickAddDialog
                kind="shipping_lines"
                isOpen={dialog?.kind === "line"}
                onOpenChange={(o) => !o && setDialog(null)}
                initialName={dialog?.kind === "line" ? dialog.typed : ""}
                onCreated={(item) => {
                    setLines((l) => [...l, { id: item.id, name: item.name, isActive: true }]);
                    set("shippingLineId", item.id);
                }}
            />
            <QuickAddDialog
                kind="ports_of_loading"
                isOpen={dialog?.kind === "port"}
                onOpenChange={(o) => !o && setDialog(null)}
                initialName={dialog?.kind === "port" ? dialog.typed : ""}
                onCreated={(item) => {
                    setPorts((p) => [...p, { id: item.id, name: item.name, country: null, isActive: true }]);
                    set("portOfLoadingId", item.id);
                }}
            />
            <AppDialog
                isOpen={leaveOpen}
                onOpenChange={setLeaveOpen}
                size="sm"
                title={t("warn.unsaved")}
                description="إذا خرجت الآن لن يُحفظ ما كتبته."
                footer={
                    <>
                        <Button size="lg" color="secondary" onClick={() => setLeaveOpen(false)}>
                            البقاء في الصفحة
                        </Button>
                        <Button size="lg" color="primary-destructive" onClick={leave}>
                            الخروج دون حفظ
                        </Button>
                    </>
                }
            />
        </form>
    );
}

function SummaryRow({ label, value, ok, mono }: { label: string; value: string; ok?: boolean; mono?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-tertiary">{label}</dt>
            <dd className={cx("flex min-w-0 items-center gap-1.5 text-end text-primary", !value && "text-quaternary")}>
                <bdi className={cx("truncate", mono && "cn")}>{value || "—"}</bdi>
                {ok && <CheckCircle className="size-4 shrink-0 text-fg-success-secondary" aria-hidden="true" />}
            </dd>
        </div>
    );
}
