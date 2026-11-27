import { Plus } from "@untitledui/icons";
import { ContainersList } from "@/components/app/containers/containers-list";
import { FilterChipLink } from "@/components/app/filter-chip";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { listContainers } from "@/features/containers/queries";
import { HOME_FILTERS, type HomeFilter, type HomeParams, homeListFilters, homeQuery } from "@/features/home/model";
import { getHomeCounts } from "@/features/home/queries";
import { containersText, todayISO } from "@/lib/format";
import { t } from "@/lib/i18n";
import { HomeEmpty } from "./home-empty";

const CHIP_LABEL: Record<HomeFilter, string> = {
    all: "الكل",
    confirmed: t("statusShort.confirmed"),
    on_the_way: t("statusShort.on_the_way"),
    arrived: t("statusShort.arrived"),
    delivered: "سُلّمت هذا الشهر",
};

const EMPTY_TEXT: Record<HomeFilter, string> = {
    all: "لا توجد حاويات حالية. كل الحاويات سُلّمت قبل أكثر من أسبوع.",
    confirmed: "لا توجد حاويات مؤكدة تنتظر الشحن الآن.",
    on_the_way: "لا توجد حاويات في الطريق الآن.",
    arrived: "لا توجد حاويات في أم قصر الآن.",
    delivered: "لم تُسلَّم أي حاوية هذا الشهر بعد.",
};

/** "الحاويات الحالية" (PRD §8.3): chips, the list (table on desktop, cards on phones), 25 per page. */
export async function CurrentContainers({ params }: { params: HomeParams }) {
    const [counts, { rows, total, page, pageSize }] = await Promise.all([getHomeCounts(), listContainers(db, homeListFilters(params, todayISO()))]);
    if (counts.all === 0) return <HomeEmpty />;
    const pages = Math.max(Math.ceil(total / pageSize), 1);

    return (
        <section aria-labelledby="current-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                    <h2 id="current-title" className="text-lg font-semibold text-primary">
                        الحاويات الحالية
                    </h2>
                    <p className="text-sm text-tertiary">{total ? containersText(total) : "لا شيء هنا"}</p>
                </div>
                <Button size="lg" iconLeading={<Plus data-icon aria-hidden="true" />} href="/containers/new">
                    {t("action.newContainer")}
                </Button>
            </div>

            <nav aria-label="تصفية حسب الحالة" className="flex flex-wrap gap-2">
                {HOME_FILTERS.map((f) => (
                    <FilterChipLink key={f} href={homeQuery({ filter: f, page: 1 })} current={params.filter === f}>
                        {CHIP_LABEL[f]}
                    </FilterChipLink>
                ))}
            </nav>

            {rows.length > 0 ? (
                <ContainersList rows={rows} filters={null} />
            ) : (
                <div className="flex flex-col items-center gap-2 border-y border-secondary py-12 text-center">
                    <p className="text-md text-tertiary">{total ? "لا توجد حاويات في هذه الصفحة." : EMPTY_TEXT[params.filter]}</p>
                    <Button size="md" color="link-color" href="/containers">
                        عرض كل الحاويات
                    </Button>
                </div>
            )}

            {pages > 1 ? (
                <nav aria-label="الصفحات" className="flex items-center justify-between gap-3 text-md">
                    {page > 1 ? (
                        <Button size="md" color="secondary" href={`${homeQuery({ ...params, page: page - 1 })}#current`}>
                            السابق
                        </Button>
                    ) : (
                        <span />
                    )}
                    <span className="text-tertiary">
                        صفحة <bdi className="num">{page}</bdi> من <bdi className="num">{pages}</bdi>
                    </span>
                    {page < pages ? (
                        <Button size="md" color="secondary" href={`${homeQuery({ ...params, page: page + 1 })}#current`}>
                            التالي
                        </Button>
                    ) : (
                        <span />
                    )}
                </nav>
            ) : (
                rows.length > 0 && (
                    <Button size="md" color="link-color" href="/containers" className="self-start">
                        عرض كل الحاويات
                    </Button>
                )
            )}
        </section>
    );
}
