import { SectionShell } from "@/components/app/settings/section-shell";
import { SizesEditor } from "@/components/app/settings/sizes-editor";
import { listSizes } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "أحجام الحاويات" };

export default async function Page() {
    await requireSession();
    const sizes = await listSizes();
    return (
        <SectionShell title="أحجام الحاويات">
            <SizesEditor sizes={sizes} />
        </SectionShell>
    );
}
