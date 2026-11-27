/** WhatsApp sharing (PRD §6.5): a wa.me link with a plain-text summary. */
import type { Currency } from "@/db/schema";
import { formatDate, formatMoney } from "@/lib/format";
import { normalizeDigits } from "@/lib/money";

/** Iraqi numbers in international form for wa.me ("0770…" → "964770…"). Null when it can't be a phone. */
function waNumber(phone: string | null | undefined): string | null {
    if (!phone) return null;
    let d = normalizeDigits(phone).replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("0")) d = `964${d.slice(1)}`;
    return d.length >= 10 ? d : null;
}

export function whatsappUrl(phone: string | null | undefined, text: string): string {
    const n = waNumber(phone);
    return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`;
}

export function receiptShareText(r: {
    company: string;
    title: string;
    receiptNo: string;
    date: string;
    lines: [string, string][];
    amount: string;
    currency: Currency;
    words: string;
    cancelled: boolean;
}): string {
    return [
        r.company,
        `${r.title} ${r.receiptNo}${r.cancelled ? " (ملغى)" : ""}`,
        `التاريخ: ${formatDate(r.date)}`,
        ...r.lines.map(([k, v]) => `${k}: ${v}`),
        `المبلغ: ${formatMoney(r.amount, r.currency)}`,
        `فقط: ${r.words}`,
    ].join("\n");
}
