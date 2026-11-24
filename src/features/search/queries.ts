import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import "server-only";
import type { DbOrTx } from "@/db";
import {
    type ContainerStatus,
    type Currency,
    type EntryType,
    type PartyKind,
    type ReceiptKind,
    containers,
    journalEntries,
    parties,
    shippingLines,
    traders,
} from "@/db/schema";
import { folded, likePattern } from "@/db/search";
import { type Balances, getBalancesMany } from "@/features/ledger/balances";
import { normalizeContainerNumber } from "@/lib/container-number";
import { parseReceiptQuery } from "./model";

export interface SearchResults {
    containers: {
        id: string;
        containerNumber: string;
        billOfLadingNumber: string | null;
        status: ContainerStatus;
        shippingLineName: string;
        traderNames: string[];
    }[];
    traders: { id: string; name: string; phone: string | null; balance: Balances }[];
    parties: { id: string; name: string; kind: PartyKind; balance: Balances }[];
    receipts: {
        id: string;
        receiptNo: string;
        receiptKind: ReceiptKind | null;
        type: EntryType;
        date: string;
        amount: string | null;
        currency: Currency | null;
        counterparty: string | null;
        cancelled: boolean;
    }[];
}

const LIMIT = 5;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const traderNamesSql = sql<
    string[]
>`coalesce((select array_agg(t.name order by s.sort_order) from container_shares s join traders t on t.id = s.trader_id where s.container_id = "containers"."id"), '{}')`;

/**
 * One box for everything (PRD §8.2): containers by number or B/L (partial, any case or spacing), traders by
 * name or phone, parties by name, receipts by "ق-123" or "123". Five per group; cancelled containers are left out.
 */
export async function globalSearch(db: DbOrTx, raw: string): Promise<SearchResults> {
    const q = raw.trim().slice(0, 100);
    const receipt = parseReceiptQuery(q);
    const wide = q.length >= 2;
    const number = normalizeContainerNumber(q);
    const byNumber = wide && /^[A-Z0-9]+$/.test(number);
    const like = wide ? likePattern(q) : "";

    const [cs, ts, ps, rs] = await Promise.all([
        byNumber
            ? db
                  .select({
                      id: containers.id,
                      containerNumber: containers.containerNumber,
                      billOfLadingNumber: containers.billOfLadingNumber,
                      status: containers.status,
                      shippingLineName: shippingLines.name,
                      traderNames: traderNamesSql,
                  })
                  .from(containers)
                  .innerJoin(shippingLines, eq(shippingLines.id, containers.shippingLineId))
                  .where(
                      and(
                          isNull(containers.archivedAt),
                          sql`(${containers.containerNumber} like ${`%${escapeLike(number)}%`} or upper(${containers.billOfLadingNumber}) like ${`%${escapeLike(number)}%`})`,
                      ),
                  )
                  .orderBy(
                      sql`(${containers.containerNumber} = ${number}) desc`,
                      sql`(${containers.containerNumber} like ${`${escapeLike(number)}%`}) desc`,
                      desc(containers.registeredOn),
                  )
                  .limit(LIMIT)
            : [],
        like
            ? db
                  .select({ id: traders.id, name: traders.name, phone: traders.phone })
                  .from(traders)
                  .where(and(eq(traders.isActive, true), sql`(${folded(traders.name)} like ${like} or ${folded(traders.phone)} like ${like})`))
                  .orderBy(traders.name)
                  .limit(LIMIT)
            : [],
        like
            ? db
                  .select({ id: parties.id, name: parties.name, kind: parties.kind })
                  .from(parties)
                  .where(and(ne(parties.kind, "self"), sql`${folded(parties.name)} like ${like}`))
                  .orderBy(parties.name)
                  .limit(LIMIT)
            : [],
        receipt
            ? db
                  .select({
                      id: journalEntries.id,
                      receiptNo: journalEntries.receiptNo,
                      receiptKind: journalEntries.receiptKind,
                      type: journalEntries.type,
                      date: journalEntries.entryDate,
                      amount: journalEntries.amount,
                      currency: journalEntries.currency,
                      counterparty: journalEntries.counterpartyLabel,
                      cancelledAt: journalEntries.cancelledAt,
                  })
                  .from(journalEntries)
                  .where(
                      and(
                          sql`${journalEntries.receiptNo} is not null`,
                          sql`substring(${journalEntries.receiptNo} from '(\\d+)$')::int = ${receipt.number}`,
                          receipt.prefix ? sql`${journalEntries.receiptNo} like ${`${receipt.prefix}-%`}` : undefined,
                      ),
                  )
                  .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
                  .limit(LIMIT)
            : [],
    ]);

    const [tb, pb] = await Promise.all([
        getBalancesMany(
            db,
            "trader",
            ts.map((t) => t.id),
        ),
        getBalancesMany(
            db,
            "party",
            ps.map((p) => p.id),
        ),
    ]);

    return {
        containers: cs,
        traders: ts.map((t) => ({ ...t, balance: tb.get(t.id)! })),
        parties: ps.map((p) => ({ ...p, balance: pb.get(p.id)! })),
        receipts: rs.map(({ cancelledAt, receiptNo, ...r }) => ({ ...r, receiptNo: receiptNo!, cancelled: cancelledAt !== null || r.type === "reversal" })),
    };
}
