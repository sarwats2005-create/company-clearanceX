import { SectionShell } from "@/components/app/settings/section-shell";
import { ShippingLinesEditor } from "@/components/app/settings/shipping-lines-editor";
import { listShippingLines } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "خطوط الشحن" };

export default async function Page() {
    await requireSession();
    const items = await listShippingLines();
    return (
        <SectionShell title="خطوط الشحن" description="تظهر بشعاراتها في نموذج الحاوية. الخطوط المستخدمة لا تُحذف، بل تُوقف.">
            <ShippingLinesEditor items={items.map((l) => ({ id: l.id, name: l.name, isActive: l.isActive, logo: l.logo, website: l.website }))} />
        </SectionShell>
    );
}
