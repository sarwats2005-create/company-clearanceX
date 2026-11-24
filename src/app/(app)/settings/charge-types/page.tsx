import { ChargeTypesEditor } from "@/components/app/settings/charge-types-editor";
import { SectionShell } from "@/components/app/settings/section-shell";
import { listChargeTypes, listParties, listSizes } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "أنواع المصاريف" };

export default async function Page() {
    await requireSession();
    const [types, parties, sizes] = await Promise.all([listChargeTypes(), listParties(), listSizes()]);
    return (
        <SectionShell title="أنواع المصاريف">
            <ChargeTypesEditor
                types={types}
                parties={parties.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name }))}
                sizes={sizes.filter((s) => s.isActive).map((s) => ({ id: s.id, label: s.label }))}
            />
        </SectionShell>
    );
}
