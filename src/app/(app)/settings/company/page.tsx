import { CompanyForm } from "@/components/app/settings/company-form";
import { SectionShell } from "@/components/app/settings/section-shell";
import { getCompanySettings } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "معلومات الشركة" };

export default async function Page() {
    await requireSession();
    const s = await getCompanySettings();
    return (
        <SectionShell title="معلومات الشركة" description="تظهر على الوصولات وكشوف الحساب المطبوعة.">
            <CompanyForm initial={{ name: s.name, phone: s.phone ?? "", address: s.address ?? "", receiptFooter: s.receiptFooter ?? "" }} />
        </SectionShell>
    );
}
