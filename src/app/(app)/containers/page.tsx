import type { Metadata } from "next";
import { Plus } from "@untitledui/icons";
import { ContainersFilters } from "@/components/app/containers/containers-filters";
import { ContainersList } from "@/components/app/containers/containers-list";
import { DownloadLink } from "@/components/app/download-link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { type ListSearchParams, listQuery, parseListParams } from "@/features/containers/list-params";
import { getContainerFormOptions, listContainers } from "@/features/containers/queries";
import { requireSession } from "@/lib/auth";
import { containersText } from "@/lib/format";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "الحاويات" };

export default async function ContainersPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
    await requireSession();
    const filters = parseListParams(await searchParams);
    const [{ rows, total, page, pageSize }, options] = await Promise.all([listContainers(db, filters), getContainerFormOptions(db)]);
    const pages = Math.max(Math.ceil(total / pageSize), 1);
    const filtered = !!(filters.q || filters.statuses || filters.traderId || filters.shippingLineId || filters.from || filters.to || filters.lateOnly);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="الحاويات"
                description={filtered ? `نتائج البحث: ${containersText(total)}` : containersText(total)}
                actions={
                    <>
                        {total > 0 && <DownloadLink href={`/export/containers${listQuery({ ...filters, page: 1 })}`}>{t("action.exportExcel")}</DownloadLink>}
                        <Button size="lg" iconLeading={<Plus data-icon aria-hidden="true" />} href="/containers/new">
                            {t("action.newContainer")}
                        </Button>
                    </>
                }
            />

            {(total > 0 || filtered) && (
                <ContainersFilters
                    filters={filters}
                    traders={options.traders.map((x) => ({ id: x.id, label: x.name }))}
                    lines={options.shippingLines.map((l) => ({ id: l.id, label: l.name }))}
                />
            )}

            {rows.length > 0 ? (
                <ContainersList rows={rows} filters={filters} />
            ) : filtered ? (
                <div className="flex flex-col items-center gap-2 border-y border-secondary py-16 text-center">
                    <p className="text-lg font-semibold text-primary">لا توجد حاويات تطابق البحث</p>
                    <p className="text-md text-tertiary">جرّب كلمة أخرى، أو امسح التصفية.</p>
                    <Button size="md" color="link-color" href="/containers">
                        عرض كل الحاويات
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3 border-y border-secondary py-16 text-center">
                    <p className="text-lg font-semibold text-primary">لا توجد حاويات بعد</p>
                    <p className="text-md text-tertiary">ابدأ بإضافة أول حاوية. تحتاج فقط رقم الحاوية وخط الشحن والتاجر.</p>
                </div>
            )}

            {pages > 1 && (
                <nav aria-label="الصفحات" className="flex items-center justify-between gap-3 text-md">
                    {page > 1 ? (
                        <Button size="md" color="secondary" href={listQuery(filters, { page: page - 1 }) || "?"}>
                            السابق
                        </Button>
                    ) : (
                        <span />
                    )}
                    <span className="text-tertiary">
                        صفحة <bdi className="num">{page}</bdi> من <bdi className="num">{pages}</bdi>
                    </span>
                    {page < pages ? (
                        <Button size="md" color="secondary" href={listQuery(filters, { page: page + 1 })}>
                            التالي
                        </Button>
                    ) : (
                        <span />
                    )}
                </nav>
            )}
        </div>
    );
}
