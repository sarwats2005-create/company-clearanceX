import { SectionShell } from "@/components/app/settings/section-shell";
import { SimpleListEditor } from "@/components/app/settings/simple-list-editor";
import { listExpenseCategories } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "تصنيفات المصاريف العامة" };

export default async function Page() {
    await requireSession();
    const items = await listExpenseCategories();
    return (
        <SectionShell title="تصنيفات المصاريف العامة" description="تُستخدم عند تسجيل مصروف عام من المالية (إيجار، رواتب…).">
            <SimpleListEditor kind="expense_categories" items={items} addLabel="تصنيف جديد" placeholder="مثال: كهرباء" />
        </SectionShell>
    );
}
