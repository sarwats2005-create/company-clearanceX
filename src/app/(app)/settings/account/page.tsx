import { AccountForm } from "@/components/app/settings/account-form";
import { SectionShell } from "@/components/app/settings/section-shell";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "الحساب" };

export default async function Page() {
    const s = await requireSession();
    return (
        <SectionShell title="الحساب">
            <AccountForm name={s.name} username={s.username} />
        </SectionShell>
    );
}
