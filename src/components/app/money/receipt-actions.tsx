"use client";

import { useState } from "react";
import { FileDownload02, MessageChatCircle, Printer, SlashCircle01 } from "@untitledui/icons";
import { toast } from "sonner";
import { AppDialog } from "@/components/app/app-dialog";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { cancelReceiptAction } from "@/features/money/actions";
import { useAction } from "@/hooks/use-action";

/** Receipt actions (PRD §6.5): print, PDF, WhatsApp, and cancel with a reason. Print is the one navy button. */
export function ReceiptActions({
    entryId,
    receiptNo,
    whatsappHref,
    canCancel,
}: {
    entryId: string;
    receiptNo: string;
    whatsappHref: string;
    canCancel: boolean;
}) {
    const [cancelOpen, setCancelOpen] = useState(false);
    const [reason, setReason] = useState("");
    const printUrl = `/print/receipt/${entryId}?autoprint=1`;
    const cancel = useAction(cancelReceiptAction, {
        success: (d) => `تم إلغاء الوصل ${receiptNo} · وصل الإلغاء رقم ${d.receiptNo ?? "—"}`,
        onSuccess: () => setCancelOpen(false),
    });

    return (
        <>
            <div className="no-print flex flex-wrap items-center gap-2">
                <Button size="lg" iconLeading={Printer} onClick={() => window.open(printUrl, "_blank", "noopener")}>
                    طباعة
                </Button>
                <Button
                    size="lg"
                    color="secondary"
                    iconLeading={FileDownload02}
                    onClick={() => {
                        toast.info("في نافذة الطباعة اختر «حفظ بتنسيق PDF» بدل الطابعة.");
                        window.open(printUrl, "_blank", "noopener");
                    }}
                >
                    حفظ PDF
                </Button>
                <Button size="lg" color="secondary" iconLeading={MessageChatCircle} href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    واتساب
                </Button>
                {canCancel && (
                    <Button size="lg" color="tertiary-destructive" iconLeading={SlashCircle01} onClick={() => (setReason(""), setCancelOpen(true))}>
                        إلغاء الوصل
                    </Button>
                )}
            </div>

            <AppDialog
                isOpen={cancelOpen}
                onOpenChange={(o) => !cancel.pending && setCancelOpen(o)}
                isDismissable={!cancel.pending}
                size="sm"
                title={`إلغاء الوصل ${receiptNo}`}
                description="يبقى الوصل ظاهراً مع علامة «ملغى»، ويصدر وصل إلغاء برقم جديد يعكس المبلغ."
                footer={
                    <>
                        <Button size="lg" color="secondary" onClick={() => setCancelOpen(false)} isDisabled={cancel.pending}>
                            رجوع
                        </Button>
                        <Button
                            size="lg"
                            color="primary-destructive"
                            isLoading={cancel.pending}
                            showTextWhileLoading
                            onClick={() => cancel.run({ entryId, reason })}
                        >
                            إلغاء الوصل
                        </Button>
                    </>
                }
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        cancel.run({ entryId, reason });
                    }}
                >
                    <Input
                        label="سبب الإلغاء"
                        size="lg"
                        isRequired
                        autoFocus
                        value={reason}
                        onChange={setReason}
                        placeholder="مثلاً: المبلغ خطأ"
                        isInvalid={!!cancel.fieldErrors.reason}
                        hint={cancel.fieldErrors.reason}
                    />
                    <button type="submit" hidden />
                </form>
            </AppDialog>
        </>
    );
}
