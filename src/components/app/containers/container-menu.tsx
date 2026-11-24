"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppDialog } from "@/components/app/app-dialog";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { archiveContainerAction } from "@/features/containers/actions";
import { useAction } from "@/hooks/use-action";

/** "⋯" on the container page: WhatsApp summary and cancel container (PRD §8.6). */
export function ContainerMenu({ containerId, containerNumber, shareText, canArchive }: { containerId: string; containerNumber: string; shareText: string; canArchive: boolean }) {
    const router = useRouter();
    const [confirm, setConfirm] = useState(false);
    const archive = useAction(archiveContainerAction, {
        success: `تم إلغاء الحاوية ${containerNumber}`,
        onSuccess: () => router.push("/containers"),
    });

    return (
        <>
            <Dropdown.Root>
                <Dropdown.DotsButton aria-label="خيارات أخرى" className="size-11 rounded-lg ring-1 ring-primary ring-inset" />
                <Dropdown.Popover className="w-64">
                    <Dropdown.Menu
                        onAction={(key) => {
                            if (key === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
                            if (key === "archive") setConfirm(true);
                        }}
                    >
                        <Dropdown.Item id="whatsapp" label="مشاركة واتساب" />
                        <Dropdown.Item id="archive" label="إلغاء الحاوية" isDisabled={!canArchive} />
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown.Root>
            <AppDialog
                isOpen={confirm}
                onOpenChange={setConfirm}
                size="sm"
                title={`إلغاء الحاوية ${containerNumber}؟`}
                description="تختفي الحاوية من القوائم وتبقى محفوظة في السجل. لا يمكن إلغاء حاوية عليها مصاريف."
                footer={
                    <>
                        <Button size="lg" color="secondary" onClick={() => setConfirm(false)}>
                            رجوع
                        </Button>
                        <Button size="lg" color="primary-destructive" isLoading={archive.pending} showTextWhileLoading onClick={() => archive.run(containerId)}>
                            إلغاء الحاوية
                        </Button>
                    </>
                }
            />
        </>
    );
}
