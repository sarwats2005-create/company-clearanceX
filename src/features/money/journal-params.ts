/** Journal filters in the URL (PRD §8.7). Pure: used by the page (server) and the filters (client). */
import type { ReceiptKind } from "@/db/schema";
import { ISO_DATE } from "@/features/containers/status";

export interface JournalParams {
    q?: string;
    kind?: ReceiptKind;
    from?: string;
    to?: string;
    page?: number;
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const KINDS: ReceiptKind[] = ["in", "out", "transfer", "exchange"];

/** Anything odd in the URL is ignored rather than failing the page. */
export function parseJournalParams(raw: Raw): JournalParams {
    const q = one(raw.q)?.trim().slice(0, 100);
    const kind = one(raw.kind) as ReceiptKind | undefined;
    const from = one(raw.from);
    const to = one(raw.to);
    const page = Number(one(raw.page));
    return {
        q: q || undefined,
        kind: kind && KINDS.includes(kind) ? kind : undefined,
        from: from && ISO_DATE.test(from) ? from : undefined,
        to: to && ISO_DATE.test(to) ? to : undefined,
        page: Number.isInteger(page) && page > 1 ? page : undefined,
    };
}

export function journalQuery(p: JournalParams, patch: Partial<JournalParams> = {}): string {
    const m = { ...p, ...patch };
    const s = new URLSearchParams();
    if (m.q) s.set("q", m.q);
    if (m.kind) s.set("kind", m.kind);
    if (m.from) s.set("from", m.from);
    if (m.to) s.set("to", m.to);
    if (m.page && m.page > 1) s.set("page", String(m.page));
    const str = s.toString();
    return str ? `?${str}` : "";
}
