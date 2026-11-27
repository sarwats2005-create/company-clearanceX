import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormPageHeader } from "@/components/app/form-page-header";
import { ReceiptActions } from "@/components/app/money/receipt-actions";
import { ReceiptDocument } from "@/components/app/money/receipt-document";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { getReceipt } from "@/features/money/queries";
import { requireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { receiptShareText } from "@/lib/whatsapp";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { id } = await params;
    const r = isUuid(id) ? await getReceipt(db, id) : null;
    return { title: r ? `${r.title} ${r.receiptNo}` : "وصل" };
}

export default async function ReceiptPage({ params }: { params: Params }) {
    await requireSession();
    const { id } = await params;
    const r = isUuid(id) ? await getReceipt(db, id) : null;
    if (!r) notFound();

    const share = receiptShareText({
        company: r.company.name,
        title: r.title,
        receiptNo: r.receiptNo,
        date: r.date,
        lines: r.lines,
        amount: r.amount,
        currency: r.currency,
        words: r.words,
        cancelled: !!r.cancelledAt,
    });

    return (
        <div className="flex flex-col gap-6">
            <FormPageHeader
                parent={{ href: "/money/journal", label: "سجل المعاملات" }}
                title={`${r.title} ${r.receiptNo}`}
                crumb={r.receiptNo}
                description={r.description}
            />

            <ReceiptActions entryId={r.id} receiptNo={r.receiptNo} shareText={share} phone={r.phone} canCancel={!r.cancelledAt && !r.isCancellation} />

            {(r.cancelledAt || r.isCancellation || r.containerId) && (
                <div className="surface flex max-w-[40rem] flex-col gap-1 px-5 py-4 text-md">
                    {r.cancelledAt && (
                        <p className="text-error-primary">
                            أُلغي هذا الوصل في <bdi className="num">{formatDateTime(r.cancelledAt)}</bdi>
                            {r.cancelReason ? ` · السبب: ${r.cancelReason}` : ""}
                        </p>
                    )}
                    {r.cancelledBy && (
                        <Button size="md" color="link-color" className="self-start" href={`/money/receipts/${r.cancelledBy.id}`}>
                            عرض وصل الإلغاء {r.cancelledBy.receiptNo}
                        </Button>
                    )}
                    {r.reverses && (
                        <Button size="md" color="link-color" className="self-start" href={`/money/receipts/${r.reverses.id}`}>
                            عرض الوصل الملغى {r.reverses.receiptNo}
                        </Button>
                    )}
                    {r.containerId && (
                        <Button size="md" color="link-color" className="self-start" href={`/containers/${r.containerId}`}>
                            فتح الحاوية {r.containerNumber}
                        </Button>
                    )}
                </div>
            )}

            <ReceiptDocument id="receipt-doc" r={r} className="w-full max-w-[40rem] rounded-2xl shadow-card ring-1 ring-secondary" />
        </div>
    );
}
