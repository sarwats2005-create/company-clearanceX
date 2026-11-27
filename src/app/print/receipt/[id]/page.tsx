import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiptDocument } from "@/components/app/money/receipt-document";
import { PrintToolbar } from "@/components/app/print-toolbar";
import { db } from "@/db";
import { getReceipt } from "@/features/money/queries";
import { requireSession } from "@/lib/auth";
import { isUuid } from "@/lib/ids";

type Params = Promise<{ id: string }>;

export const metadata: Metadata = { title: "طباعة وصل" };

/** A5 portrait receipt, no app chrome (PRD §8.11). ?autoprint=1 opens the print dialog. */
export default async function PrintReceiptPage({ params, searchParams }: { params: Params; searchParams: Promise<{ autoprint?: string }> }) {
    await requireSession();
    const { id } = await params;
    const r = isUuid(id) ? await getReceipt(db, id) : null;
    if (!r) notFound();
    const { autoprint } = await searchParams;

    return (
        <>
            <style>
                {
                    "@page { size: A5 portrait; margin: 10mm; } @media print { html, body { background: #fff; } .receipt { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"
                }
            </style>
            <PrintToolbar autoPrint={autoprint === "1"} backHref={`/money/receipts/${r.id}`} backLabel="رجوع إلى الوصل" />
            <main className="flex justify-center bg-secondary px-4 py-8 print:bg-white print:p-0">
                <ReceiptDocument r={r} className="w-full max-w-[148mm] shadow-lg print:max-w-none print:p-0 print:shadow-none" />
            </main>
        </>
    );
}
