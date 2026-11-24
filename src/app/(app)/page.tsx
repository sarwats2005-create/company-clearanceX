import { PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default async function HomePage() {
    await requireSession();
    return <PageHeader title={t("nav.home")} description={t("app.tagline")} />;
}
