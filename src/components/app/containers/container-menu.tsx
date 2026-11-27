"use client";

import { useState } from "react";
import { Printer, SlashCircle01 } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { AppDialog } from "@/components/app/app-dialog";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { archiveContainerAction } from "@/features/containers/actions";
import { useAction } from "@/hooks/use-action";

/** "⋯" on the container page: print sheet and cancel container. WhatsApp has its own button. */
export function ContainerMenu({
    containerId,
    containerNumber,
    canArchive,
}: {
    containerId: string;
    containerNumber: string;
    canArchive: boolean;
}) {
    const router = useRouter();
    const [confirm, setConfirm] = useState(false);
    const archive = useAction(archiveContainerAction, {
        success: `تم إلغاء الحاوية ${containerNumber}`,
        onSuccess: () => router.push("/containers"),
    });

    return (
        <>
            <Dropdown.Root>
                <Dropdown.DotsButton aria-label="خيارات أخرى" className="size-11 rounded-xl bg-primary ring-1 ring-primary ring-inset" />
                <Dropdown.Popover className="w-64">
                    <Dropdown.Menu
                        onAction={(key) => {
                            if (key === "print") window.open(`/print/container/${containerId}?autoprint=1`, "_blank", "noopener");
                            if (key === "archive") setConfirm(true);
                        }}
                    >
                        <Dropdown.Item id="print" label="طباعة كشف الحاوية" icon={Printer} />
                        <Dropdown.Item id="archive" label="إلغاء الحاوية" icon={SlashCircle01} isDisabled={!canArchive} />
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
