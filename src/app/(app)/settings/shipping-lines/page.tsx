import { SectionShell } from "@/components/app/settings/section-shell";
import { SimpleListEditor } from "@/components/app/settings/simple-list-editor";
import { listShippingLines } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "خطوط الشحن" };

export default async function Page() {
    await requireSession();
    const items = await listShippingLines();
    return (
        <SectionShell title="خطوط الشحن" description="تظهر في نموذج الحاوية. الخطوط المستخدمة لا تُحذف، بل تُوقف.">
            <SimpleListEditor kind="shipping_lines" items={items} addLabel="خط شحن جديد" placeholder="مثال: PIL" dirLtr />
        </SectionShell>
    );
}
