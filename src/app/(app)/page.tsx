import { PageHeader } from "@/components/app/page-header";
import { t } from "@/lib/i18n";

export default function HomePage() {
    return <PageHeader title={t("nav.home")} description={t("app.tagline")} />;
}
