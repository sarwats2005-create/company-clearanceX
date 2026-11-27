import type { Metadata } from "next";
import { DownloadLink } from "@/components/app/download-link";
import { JournalFilters } from "@/components/app/money/journal-filters";
import { JournalList } from "@/components/app/money/journal-list";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { journalQuery, parseJournalParams } from "@/features/money/journal-params";
import { listJournal } from "@/features/money/queries";
import { requireSession } from "@/lib/auth";
import { countAr } from "@/lib/format";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "سجل المعاملات" };

const entriesText = (n: number) => countAr(n, { one: "عملية واحدة", two: "عمليتان", few: "عمليات", many: "عملية", other: "عملية" });

export default async function JournalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    await requireSession();
    const params = parseJournalParams(await searchParams);
    const { rows, total, pageSize } = await listJournal(db, params);
    const page = params.page ?? 1;
    const pages = Math.max(Math.ceil(total / pageSize), 1);
    const filtered = !!(params.q || params.kind || params.from || params.to);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow={
                    <a href="/money" className="rounded-md outline-focus-ring hover:text-secondary focus-visible:outline-2">
                        المالية
                    </a>
                }
                title="سجل المعاملات"
                description={filtered ? `نتائج البحث: ${entriesText(total)}` : `كل ما دخل وخرج، الأحدث أولاً · ${entriesText(total)}`}
                actions={
                    total > 0 && <DownloadLink href={`/export/journal${journalQuery(params, { page: undefined })}`}>{t("action.exportExcel")}</DownloadLink>
                }
            />
            {(total > 0 || filtered) && <JournalFilters params={params} />}
            <JournalList
                rows={rows}
                empty={
                    <div className="flex flex-col items-center gap-2 border-y border-secondary py-16 text-center">
                        <p className="text-lg font-semibold text-primary">{filtered ? "لا توجد معاملات تطابق البحث" : "لا توجد معاملات بعد"}</p>
                        <p className="text-md text-tertiary">
                            {filtered ? "جرّب كلمة أخرى، أو امسح التصفية." : "كل مبلغ تسجله من صفحة المالية يظهر هنا مع رقم وصله."}
                        </p>
                        {!filtered && (
                            <Button size="md" color="link-color" href="/money">
                                الذهاب إلى المالية
                            </Button>
                        )}
                    </div>
                }
            />
            {pages > 1 && (
                <nav aria-label="الصفحات" className="flex items-center justify-between gap-3 text-md">
                    {page > 1 ? (
                        <Button size="md" color="secondary" href={journalQuery(params, { page: page - 1 }) || "?"}>
                            السابق
                        </Button>
                    ) : (
                        <span />
                    )}
                    <span className="text-tertiary">
                        صفحة <bdi className="num">{page}</bdi> من <bdi className="num">{pages}</bdi>
                    </span>
                    {page < pages ? (
                        <Button size="md" color="secondary" href={journalQuery(params, { page: page + 1 })}>
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
