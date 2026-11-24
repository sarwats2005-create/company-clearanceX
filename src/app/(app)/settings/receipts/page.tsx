import { ReceiptsEditor } from "@/components/app/settings/receipts-editor";
import { SectionShell } from "@/components/app/settings/section-shell";
import { listReceiptSequences } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "الوصولات" };

export default async function Page() {
    await requireSession();
    return (
        <SectionShell title="الوصولات">
            <ReceiptsEditor rows={await listReceiptSequences()} />
        </SectionShell>
    );
}
