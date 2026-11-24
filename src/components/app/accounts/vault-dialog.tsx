"use client";

import { useState } from "react";
import { Edit05, Plus } from "@untitledui/icons";
import { Radio as AriaRadio, RadioGroup as AriaRadioGroup } from "react-aria-components";
import { AppDialog } from "@/components/app/app-dialog";
import { optionalLabel } from "@/components/app/field-label";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import type { Currency, VaultKind } from "@/db/schema";
import { saveVaultAction, setVaultActiveAction } from "@/features/accounts/actions";
import { CURRENCY_NAME, CUSTOM_VAULT_KINDS, VAULT_KIND_LABEL } from "@/features/accounts/model";
import { useAction } from "@/hooks/use-action";
import { cx } from "@/utils/cx";
import { VAULT_KIND_HINT, VAULT_KIND_ICON } from "./vault-kinds";

export interface VaultSource {
    id: string;
    name: string;
    kind: VaultKind;
    allowedCurrencies: Currency[];
    notes: string | null;
    isSystem: boolean;
    isActive: boolean;
}

type Draft = { name: string; kind: VaultKind; currencies: Currency[]; notes: string };

const fromVault = (v?: VaultSource): Draft =>
    v
        ? { name: v.name, kind: v.kind, currencies: [...v.allowedCurrencies], notes: v.notes ?? "" }
        : { name: "", kind: "person", currencies: ["IQD"], notes: "" };

const isFixed = (v?: VaultSource) => !!v && (v.isSystem || v.kind === "main" || v.kind === "usd");

/** Vault form (PRD §8.8): name, kind as radio cards, allowed currencies, notes. Stopping lives at the bottom. */
function VaultDialog({ vault, isOpen, onOpenChange }: { vault?: VaultSource; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
    const [draft, setDraft] = useState<Draft>(() => fromVault(vault));
    const save = useAction(saveVaultAction, { success: vault ? "تم حفظ القاصة" : "تمت إضافة القاصة", onSuccess: () => onOpenChange(false) });
    const toggle = useAction(setVaultActiveAction, {
        success: vault?.isActive ? "تم إيقاف القاصة" : "تم تشغيل القاصة",
        onSuccess: () => onOpenChange(false),
    });
    const err = save.fieldErrors;
    const busy = save.pending || toggle.pending;
    const submit = () => save.run({ id: vault?.id, name: draft.name, kind: draft.kind, allowedCurrencies: draft.currencies, notes: draft.notes });
    const setCurrency = (c: Currency, on: boolean) => {
        setDraft((d) => ({ ...d, currencies: on ? [...d.currencies, c] : d.currencies.filter((x) => x !== c) }));
        if (err.allowedCurrencies) save.setFieldErrors(({ allowedCurrencies: _, ...rest }) => rest);
    };

    return (
        <AppDialog
            isOpen={isOpen}
            onOpenChange={(o) => !busy && onOpenChange(o)}
            isDismissable={!busy}
            title={vault ? `تعديل ${vault.name}` : "قاصة جديدة"}
            description={vault ? undefined : "مكان تحفظ فيه المال: شخص، محل صيرفة، تاجر، أو غير ذلك. لكل قاصة رصيد منفصل لكل عملة."}
            footer={
                <>
                    <Button size="lg" color="secondary" onClick={() => onOpenChange(false)} isDisabled={busy}>
                        رجوع
                    </Button>
                    <Button size="lg" isLoading={save.pending} showTextWhileLoading isDisabled={toggle.pending} onClick={submit}>
                        {vault ? "حفظ" : "إضافة القاصة"}
                    </Button>
                </>
            }
        >
            <form
                className="flex flex-col gap-6"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <Input
                    label="اسم القاصة"
                    size="lg"
                    isRequired
                    autoFocus
                    placeholder="مثلاً: صيرفة الأمين"
                    value={draft.name}
                    onChange={(v) => setDraft({ ...draft, name: v })}
                    isInvalid={!!err.name}
                    hint={err.name}
                />

                {!isFixed(vault) && (
                    <AriaRadioGroup value={draft.kind} onChange={(k) => setDraft({ ...draft, kind: k as VaultKind })} className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-secondary">نوع القاصة</span>
                        <div className="grid grid-cols-2 gap-3">
                            {CUSTOM_VAULT_KINDS.map((k) => {
                                const Icon = VAULT_KIND_ICON[k];
                                return (
                                    <AriaRadio
                                        key={k}
                                        value={k}
                                        className={({ isSelected, isFocusVisible }) =>
                                            cx(
                                                "flex cursor-pointer flex-col gap-2 rounded-xl p-3.5 ring-1 transition-[background-color,box-shadow,transform] duration-150 ease-smooth ring-inset active:scale-[0.98]",
                                                isSelected ? "bg-brand-primary_alt ring-2 ring-brand" : "bg-primary ring-primary hover:bg-primary_hover",
                                                isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                                            )
                                        }
                                    >
                                        {({ isSelected }) => (
                                            <>
                                                <Icon
                                                    className={cx("size-5", isSelected ? "text-fg-brand-primary" : "text-fg-quaternary")}
                                                    aria-hidden="true"
                                                />
                                                <span className="flex flex-col">
                                                    <span className={cx("text-md", isSelected ? "font-semibold text-brand-secondary" : "text-primary")}>
                                                        {VAULT_KIND_LABEL[k]}
                                                    </span>
                                                    <span className="text-sm text-tertiary">{VAULT_KIND_HINT[k]}</span>
                                                </span>
                                            </>
                                        )}
                                    </AriaRadio>
                                );
                            })}
                        </div>
                    </AriaRadioGroup>
                )}

                <fieldset className="flex flex-col gap-3">
                    <legend className="mb-2 text-sm font-medium text-secondary">العملات التي تقبلها</legend>
                    {(["IQD", "USD"] as Currency[]).map((c) => (
                        <Checkbox
                            key={c}
                            size="md"
                            label={`${CURRENCY_NAME[c]} (${c === "IQD" ? "د.ع" : "$"})`}
                            isSelected={draft.currencies.includes(c)}
                            onChange={(on) => setCurrency(c, on)}
                        />
                    ))}
                    {err.allowedCurrencies && <p className="text-sm text-error-primary">{err.allowedCurrencies}</p>}
                </fieldset>

                <TextArea
                    label={optionalLabel("ملاحظات")}
                    rows={2}
                    value={draft.notes}
                    onChange={(v) => setDraft({ ...draft, notes: v })}
                    isInvalid={!!err.notes}
                    hint={err.notes}
                />
                <button type="submit" hidden />

                {vault && !isFixed(vault) && (
                    <div className="flex flex-col gap-2 border-t border-secondary pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-tertiary">
                            {vault.isActive
                                ? "القاصة الموقوفة لا تظهر في نماذج المالية. يجب أن يكون رصيدها صفراً."
                                : "هذه القاصة موقوفة. شغّلها لتظهر في نماذج المالية."}
                        </p>
                        <Button
                            size="md"
                            color={vault.isActive ? "tertiary-destructive" : "secondary"}
                            isLoading={toggle.pending}
                            showTextWhileLoading
                            isDisabled={save.pending}
                            onClick={() => toggle.run(vault.id, !vault.isActive)}
                            className="shrink-0 self-start sm:self-auto"
                        >
                            {vault.isActive ? "إيقاف القاصة" : "تشغيل القاصة"}
                        </Button>
                    </div>
                )}
            </form>
        </AppDialog>
    );
}

/** The dashed "+ قاصة جديدة" card at the end of the vault grid (PRD §8.8). */
export function NewVaultCard() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-full min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary text-md text-tertiary outline-focus-ring transition-[background-color,color,transform] duration-150 ease-smooth hover:bg-primary_hover hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]"
            >
                <Plus className="size-6 text-fg-quaternary" aria-hidden="true" />
                قاصة جديدة
            </button>
            {open && <VaultDialog isOpen={open} onOpenChange={setOpen} />}
        </>
    );
}

export function EditVaultButton({ vault }: { vault: VaultSource }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button size="lg" color="secondary" iconLeading={Edit05} onClick={() => setOpen(true)}>
                تعديل
            </Button>
            {open && <VaultDialog vault={vault} isOpen={open} onOpenChange={setOpen} />}
        </>
    );
}
