import { CurrencyForm } from "@/components/app/settings/currency-form";
import { SectionShell } from "@/components/app/settings/section-shell";
import { getCompanySettings } from "@/features/settings/queries";
import { requireSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { formatNumber } from "@/lib/format";

export const metadata = { title: "سعر الصرف والتنبيهات" };

export default async function Page() {
    await requireSession();
    const s = await getCompanySettings();
    return (
        <SectionShell title="سعر الصرف والتنبيهات" description="لا يوجد سعر صرف تلقائي في العراق، لذلك تكتب السعر بنفسك.">
            <CurrencyForm
                initial={{ defaultUsdIqdRate: formatNumber(s.defaultUsdIqdRate).replace(/,/g, ""), arrivedWarningDays: String(s.arrivedWarningDays) }}
                rateUpdated={s.rateUpdatedAt ? formatDate(s.rateUpdatedAt) : null}
            />
        </SectionShell>
    );
}
