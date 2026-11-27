import type { Metadata } from "next";
import { ContainerForm } from "@/components/app/container-form/container-form";
import { emptyShare, emptyValues } from "@/components/app/container-form/values";
import { FormPageHeader } from "@/components/app/form-page-header";
import { StepBar } from "@/components/app/step-bar";
import { db } from "@/db";
import { getContainerFormOptions } from "@/features/containers/queries";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "حاوية جديدة" };

/** ?trader=<id> (from a trader's page) starts the form with that trader picked. */
export default async function NewContainerPage({ searchParams }: { searchParams: Promise<{ trader?: string | string[] }> }) {
    await requireSession();
    const options = await getContainerFormOptions(db);
    const today = todayISO();
    const { trader } = await searchParams;
    const initial = emptyValues({ ...options.defaults, registeredOn: today });
    if (typeof trader === "string" && options.traders.some((t) => t.id === trader)) initial.shares = [emptyShare(trader)];
    return (
        <>
            <FormPageHeader
                parent={{ href: "/containers", label: "الحاويات" }}
                title="حاوية جديدة"
                description="رقم الحاوية، خط الشحن، والتاجر. بعد الحفظ تنتقل مباشرة إلى المصاريف."
            />
            <StepBar current={0} className="mb-6 max-w-[720px]" />
            <ContainerForm mode="create" initial={initial} options={options} today={today} />
        </>
    );
}
