import { SectionShell } from "@/components/app/settings/section-shell";
import { SimpleListEditor } from "@/components/app/settings/simple-list-editor";
import { listPorts } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "موانئ التحميل" };

export default async function Page() {
    await requireSession();
    const items = await listPorts();
    return (
        <SectionShell title="موانئ التحميل" description="الميناء الذي حُمّلت منه الحاوية. اختياري في نموذج الحاوية.">
            <SimpleListEditor kind="ports_of_loading" items={items.map((p) => ({ ...p, secondary: p.country }))} addLabel="ميناء جديد" placeholder="مثال: داليان" />
        </SectionShell>
    );
}
