import { t } from "@/lib/i18n";

export default function NotFound() {
    return (
        <section className="flex min-h-dvh items-center justify-center bg-primary px-4">
            <div className="flex max-w-md flex-col items-center gap-4 text-center">
                <p className="num text-display-md font-semibold text-brand-secondary">404</p>
                <h1 className="text-display-xs font-semibold text-primary">{t("error.notFound")}</h1>
                <a href="/" className="text-md font-semibold text-brand-secondary underline-offset-4 hover:underline">
                    {t("nav.home")}
                </a>
            </div>
        </section>
    );
}
