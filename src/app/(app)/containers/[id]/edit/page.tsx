import { Edit05 } from "@untitledui/icons";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContainerForm } from "@/components/app/container-form/container-form";
import { fromContainer } from "@/components/app/container-form/values";
import { FormPageHeader } from "@/components/app/form-page-header";
import { db } from "@/db";
import { getContainer, getContainerFormOptions } from "@/features/containers/queries";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = { title: "تعديل الحاوية" };

export default async function EditContainerPage({ params }: { params: Promise<{ id: string }> }) {
    await requireSession();
    const { id } = await params;
    if (!isUuid(id)) notFound();
    const [container, options] = await Promise.all([getContainer(db, id), getContainerFormOptions(db)]);
    if (!container || container.archivedAt) notFound();
    return (
        <>
            <FormPageHeader
                parent={{ href: `/containers/${id}`, label: container.containerNumber }}
                crumb="تعديل"
                icon={Edit05}
                iconColor="orange"
                title={
                    <>
                        تعديل الحاوية <bdi className="cn">{container.containerNumber}</bdi>
                    </>
                }
            />
            <ContainerForm mode="edit" containerId={id} status={container.status} hasCharges={container.activeCharges > 0} initial={fromContainer(container)} options={options} today={todayISO()} />
        </>
    );
}
