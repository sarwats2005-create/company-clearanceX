import { Suspense } from "react";
import { ArrowCircleDown, ArrowCircleUp } from "@untitledui/icons";
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

/** Home (PRD §8.3, Part F4.1): greeting, the overview band, late alerts, and the current containers. */
export default async function HomePage({ searchParams }: { searchParams: Search }) {
    const session = await requireSession();
    const params = parseHomeParams(await searchParams);

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title={`${greeting()}، ${session.name}`}
                description={formatDateLong(todayISO(), { weekday: true })}
                actions={
                    <>
                        <Button size="lg" color="secondary" iconLeading={<ArrowCircleDown data-icon aria-hidden="true" />} href="/money/new/receive-trader">
                            {t("money.receiveFromTrader")}
                        </Button>
                        <Button size="lg" color="secondary" iconLeading={<ArrowCircleUp data-icon aria-hidden="true" />} href="/money/new/pay-party">
                            {t("money.payParty")}
                        </Button>
                    </>
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
