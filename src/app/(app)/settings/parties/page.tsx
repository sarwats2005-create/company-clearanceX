import { PartiesEditor } from "@/components/app/settings/parties-editor";
import { SectionShell } from "@/components/app/settings/section-shell";
import { getCompanySettings, listParties } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "الجهات" };

export default async function Page() {
    await requireSession();
    const [parties, s] = await Promise.all([listParties(), getCompanySettings()]);
    return (
        <SectionShell title="الجهات">
            <PartiesEditor parties={parties} defaultCompanyId={s.defaultClearancePartyId} />
        </SectionShell>
    );
}
