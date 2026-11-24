import type { Metadata } from "next";
import { ContainerForm } from "@/components/app/container-form/container-form";
import { emptyValues } from "@/components/app/container-form/values";
import { FormPageHeader } from "@/components/app/form-page-header";
import { db } from "@/db";
import { getContainerFormOptions } from "@/features/containers/queries";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "حاوية جديدة" };

export default async function NewContainerPage() {
    await requireSession();
    const options = await getContainerFormOptions(db);
    const today = todayISO();
    return (
        <>
            <FormPageHeader parent={{ href: "/containers", label: "الحاويات" }} title="حاوية جديدة" description="أدخل الأساسيات الثلاثة. باقي التفاصيل اختيارية ويمكن إضافتها لاحقاً." />
            <ContainerForm mode="create" initial={emptyValues({ ...options.defaults, registeredOn: today })} options={options} today={today} />
        </>
    );
}
