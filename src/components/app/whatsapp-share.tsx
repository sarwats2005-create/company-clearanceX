"use client";

import { useState } from "react";
import { Image01, MessageTextSquare01 } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { toast } from "sonner";
import { AppDialog } from "@/components/app/app-dialog";
import { IconTile } from "@/components/app/icon-tile";
import { Button } from "@/components/base/buttons/button";
import { whatsappUrl } from "@/lib/whatsapp";
import { cx } from "@/utils/cx";

/** WhatsApp's own mark, drawn simply (a speech bubble with a phone), so the button is recognised at a glance. */
export function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
        </svg>
    );
}

/** Draws the element as a JPEG (white background, sharp on phones). */
async function elementToJpeg(el: HTMLElement): Promise<Blob> {
    const { toJpeg } = await import("html-to-image");
    const dataUrl = await toJpeg(el, {
        quality: 0.92,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        // Buttons and other screen-only bits never go into the picture.
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains("no-print")),
    });
    const res = await fetch(dataUrl);
    return res.blob();
}

async function copyAsPng(jpeg: Blob): Promise<boolean> {
    try {
        if (!("ClipboardItem" in window) || !navigator.clipboard?.write) return false;
        const bmp = await createImageBitmap(jpeg);
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext("2d")!.drawImage(bmp, 0, 0);
        const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (!png) return false;
        await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
        return true;
    } catch {
        return false;
    }
}

function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * "إرسال واتساب": the owner picks how to send, as a picture of the receipt itself (JPEG) or as plain text.
 * On a phone the picture goes straight into WhatsApp's share screen. On a computer the picture is copied
 * (paste it with Ctrl+V) and saved, and WhatsApp opens on the right chat.
 */
export function WhatsAppShareButton({
    text,
    phone,
    targetId,
    fileName,
    label = "إرسال واتساب",
    size = "lg",
    className,
}: {
    /** The plain-text version. */
    text: string;
    /** The trader's or party's phone, to open their chat directly. */
    phone?: string | null;
    /** id of the element drawn as the picture. */
    targetId: string;
    /** File name without extension, e.g. "وصل ق-12". */
    fileName: string;
    label?: string;
    size?: "md" | "lg" | "xl";
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const sendText = () => {
        window.open(whatsappUrl(phone, text), "_blank", "noopener,noreferrer");
        setOpen(false);
    };

    const sendPicture = async () => {
        const el = document.getElementById(targetId);
        if (!el) return toast.error("تعذّر تجهيز الصورة. أرسلها نصاً بدلاً من ذلك.");
        setBusy(true);
        try {
            const blob = await elementToJpeg(el);
            const file = new File([blob], `${fileName}.jpg`, { type: "image/jpeg" });
            // Phones: the system share sheet, where WhatsApp is one tap away.
            if (navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({ files: [file] });
                    setOpen(false);
                    return;
                } catch (e) {
                    if ((e as Error)?.name === "AbortError") return;
                }
            }
            // Computers: copy + save the picture, then open the chat to paste it.
            const copied = await copyAsPng(blob);
            download(blob, file.name);
            window.open(whatsappUrl(phone, ""), "_blank", "noopener,noreferrer");
            toast.success(copied ? "الصورة جاهزة: الصقها في المحادثة بـ Ctrl+V" : "حُفظت الصورة في التنزيلات: أرفقها في المحادثة", { duration: 8000 });
            setOpen(false);
        } catch {
            toast.error("تعذّر تجهيز الصورة. أرسلها نصاً بدلاً من ذلك.");
        } finally {
            setBusy(false);
        }
    };

    const choice = "flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-primary p-4 text-start shadow-xs ring-1 ring-secondary transition-[box-shadow,transform] duration-150 ease-smooth ring-inset hover:shadow-card data-pressed:scale-[0.98] disabled:cursor-wait disabled:opacity-60";

    return (
        <>
            <Button
                size={size}
                color="secondary"
                iconLeading={<WhatsAppIcon className="size-5 text-[rgb(22_163_74)]" />}
                onClick={() => setOpen(true)}
                className={cx("no-print", className)}
            >
                {label}
            </Button>
            <AppDialog isOpen={open} onOpenChange={(o) => !busy && setOpen(o)} isDismissable={!busy} size="sm" title="كيف تريد الإرسال؟" description="اختر صورة الوصل كما هو، أو نصاً عادياً.">
                <div className="flex flex-col gap-3">
                    <AriaButton className={choice} onPress={sendPicture} isDisabled={busy}>
                        <IconTile icon={Image01} color="whatsapp" size="lg" />
                        <span className="flex flex-col">
                            <span className="text-md font-semibold text-primary">{busy ? "جارٍ تجهيز الصورة…" : "صورة (JPEG)"}</span>
                            <span className="text-sm text-tertiary">الوصل نفسه كصورة، كما يُطبع</span>
                        </span>
                    </AriaButton>
                    <AriaButton className={choice} onPress={sendText} isDisabled={busy}>
                        <IconTile icon={MessageTextSquare01} color="teal" size="lg" />
                        <span className="flex flex-col">
                            <span className="text-md font-semibold text-primary">نص</span>
                            <span className="text-sm text-tertiary">رسالة قصيرة بالتفاصيل والمبلغ</span>
                        </span>
                    </AriaButton>
                </div>
            </AppDialog>
        </>
    );
}
