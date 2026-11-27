import { ChevronLeft } from "@untitledui/icons";
import { asc, eq } from "drizzle-orm";
import { DefaultVaultsForm } from "@/components/app/settings/default-vaults-form";
import { SectionShell } from "@/components/app/settings/section-shell";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { type Currency, vaults } from "@/db/schema";
import { getSettingsRow } from "@/features/settings/service";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "القاصات" };

export default async function Page() {
    await requireSession();
    const [settings, rows] = await Promise.all([
        getSettingsRow(db),
        db
            .select({ id: vaults.id, name: vaults.name, allowed: vaults.allowedCurrencies })
            .from(vaults)
            .where(eq(vaults.isActive, true))
            .orderBy(asc(vaults.createdAt)),
    ]);
    const options = (c: Currency) => rows.filter((r) => r.allowed.includes(c)).map((r) => ({ id: r.id, label: r.name }));

    return (
        <SectionShell
            title="القاصات"
            description="اختر القاصة التي تظهر أولاً في نماذج القبض والدفع لكل عملة. يمكنك دائماً اختيار غيرها في النموذج."
            actions={
                <Button size="md" color="link-color" iconTrailing={<ChevronLeft data-icon aria-hidden="true" />} href="/accounts/vaults">
                    إدارة القاصات
                </Button>
            }
        >
            <DefaultVaultsForm
                initial={{ IQD: settings.defaultVaultIqdId ?? "", USD: settings.defaultVaultUsdId ?? "" }}
                iqd={options("IQD")}
                usd={options("USD")}
            />
        </SectionShell>
    );
}
