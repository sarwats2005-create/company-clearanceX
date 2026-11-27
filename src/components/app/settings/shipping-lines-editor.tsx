"use client";

import { useRef, useState } from "react";
import { Image01, Trash01, Upload01 } from "@untitledui/icons";
import { AppDialog } from "@/components/app/app-dialog";
import { ShippingLineLogo } from "@/components/app/shipping-line-logo";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { saveShippingLineBrandAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";
import { SimpleListEditor } from "./simple-list-editor";

interface Line {
    id: string;
    name: string;
    isActive: boolean;
    logo: string | null;
    website: string | null;
}

/** Shrinks any picked image to at most 160px (PNG keeps transparency), so a logo stays a few KB. */
async function toSmallDataUrl(file: File): Promise<string> {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
}

/** Shipping lines in Settings: each with its logo; "الشعار" uploads a picture or sets the line's website. */
export function ShippingLinesEditor({ items }: { items: Line[] }) {
    const [editing, setEditing] = useState<Line | null>(null);
    const [logo, setLogo] = useState<string | null>(null);
    const [website, setWebsite] = useState("");
    const [reading, setReading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const save = useAction(saveShippingLineBrandAction, { success: "تم حفظ الشعار", onSuccess: () => setEditing(null) });

    const open = (l: Line) => {
        setEditing(l);
        setLogo(l.logo);
        setWebsite(l.website ?? "");
    };

    return (
        <>
            <SimpleListEditor
                kind="shipping_lines"
                items={items}
                addLabel="خط شحن جديد"
                placeholder="مثال: PIL"
                dirLtr
                leading={(l) => <ShippingLineLogo line={l} size="lg" />}
                extra={(l) => (
                    <Button size="md" color="secondary" iconLeading={Image01} onClick={() => open(l)}>
                        الشعار
                    </Button>
                )}
            />

            <AppDialog
                isOpen={!!editing}
                onOpenChange={(o) => !save.pending && !o && setEditing(null)}
                title={editing ? `شعار ${editing.name}` : ""}
                description="ارفع صورة الشعار من جهازك، أو اكتب موقع الخط ليظهر شعاره تلقائياً."
                size="sm"
                footer={
                    <>
                        <Button color="secondary" size="lg" onClick={() => setEditing(null)} isDisabled={save.pending}>
                            إلغاء
                        </Button>
                        <Button size="lg" isLoading={save.pending} showTextWhileLoading onClick={() => editing && save.run({ id: editing.id, logo, website })}>
                            حفظ
                        </Button>
                    </>
                }
            >
                {editing && (
                    <div className="flex flex-col gap-5">
                        <div className="flex items-center gap-4 rounded-2xl bg-secondary p-4">
                            <ShippingLineLogo key={`${logo}:${website}`} line={{ name: editing.name, logo, website: website || null }} size="xl" />
                            <div className="flex flex-col gap-2">
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    hidden
                                    onChange={async (e) => {
                                        const f = e.target.files?.[0];
                                        e.target.value = "";
                                        if (!f) return;
                                        setReading(true);
                                        try {
                                            setLogo(await toSmallDataUrl(f));
                                        } finally {
                                            setReading(false);
                                        }
                                    }}
                                />
                                <Button size="md" iconLeading={Upload01} isLoading={reading} onClick={() => fileRef.current?.click()}>
                                    رفع صورة
                                </Button>
                                {logo && (
                                    <Button size="md" color="tertiary-destructive" iconLeading={Trash01} onClick={() => setLogo(null)}>
                                        إزالة الصورة
                                    </Button>
                                )}
                            </div>
                        </div>
                        <Input
                            label="موقع الخط (اختياري)"
                            size="lg"
                            placeholder="maersk.com"
                            value={website}
                            onChange={setWebsite}
                            inputClassName="[direction:ltr] text-end"
                            isInvalid={!!save.fieldErrors.website}
                            hint={save.fieldErrors.website ?? "إن لم ترفع صورة، نعرض شعار هذا الموقع."}
                        />
                        {save.fieldErrors.logo && <p className="text-sm text-error-primary">{save.fieldErrors.logo}</p>}
                    </div>
                )}
            </AppDialog>
        </>
    );
}
