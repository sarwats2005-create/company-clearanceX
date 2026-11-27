import { Suspense } from "react";
import { Plus, Sun } from "@untitledui/icons";
import type { Metadata } from "next";
import { CurrentContainers } from "@/components/app/home/current-containers";
import { ListSkeleton, OverviewSkeleton } from "@/components/app/home/home-skeletons";
import { HomeOverview } from "@/components/app/home/overview";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { parseHomeParams } from "@/features/home/model";
import { greeting } from "@/features/search/model";
import { requireSession } from "@/lib/auth";
import { formatDateLong, todayISO } from "@/lib/format";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "الرئيسية" };

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Home: greeting, the main vault (loud, first), late alerts, counts, debts, and the current containers. */
export default async function HomePage({ searchParams }: { searchParams: Search }) {
    const session = await requireSession();
    const params = parseHomeParams(await searchParams);

    return (
        <div className="flex flex-col gap-7">
            <PageHeader
                title={`${greeting()}، ${session.name}`}
                description={formatDateLong(todayISO(), { weekday: true })}
                icon={Sun}
                iconColor="gold"
                actions={
                    <Button size="xl" iconLeading={<Plus data-icon aria-hidden="true" />} href="/containers/new">
                        {t("action.newContainer")}
                    </Button>
                }
            />

            <Suspense fallback={<OverviewSkeleton />}>
                <HomeOverview filter={params.filter} />
            </Suspense>

            {/* No key on this boundary: changing a chip keeps the old list until the new one is ready (no skeleton flash, no scroll jump). */}
            <div id="current" className="scroll-mt-24">
                <Suspense fallback={<ListSkeleton />}>
                    <CurrentContainers params={params} />
                </Suspense>
            </div>
        </div>
    );
}
