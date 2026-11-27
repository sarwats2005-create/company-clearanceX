"use client";

import { useState } from "react";
import { Plus } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { NewTraderDialog } from "@/components/app/quick-add-dialogs";
import { Button } from "@/components/base/buttons/button";

/** "+ تاجر جديد" (PRD §8.8): the quick dialog, then straight to the new trader's page. */
export function NewTraderButton() {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    return (
        <>
            <Button size="lg" iconLeading={Plus} onClick={() => setOpen(true)}>
                تاجر جديد
            </Button>
            <NewTraderDialog initialName="" isOpen={open} onOpenChange={setOpen} onCreated={(t) => router.push(`/accounts/traders/${t.id}`)} />
        </>
    );
}
