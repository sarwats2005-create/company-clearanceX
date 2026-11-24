import { cache } from "react";
import "server-only";
import { db } from "@/db";
import { containerCounts } from "@/features/containers/queries";
import { getKindTotals } from "@/features/ledger/balances";
import { listVaultBalances } from "@/features/money/queries";

/** One count query per request, shared by the overview band and the list's empty state. */
export const getHomeCounts = cache(() => containerCounts(db));

/** Money at a glance (PRD §8.3): the main and dollar vaults, what traders owe us, what we owe parties. */
export async function getHomeMoney() {
    const [vaults, traders, parties] = await Promise.all([listVaultBalances(db), getKindTotals(db, "trader"), getKindTotals(db, "party")]);
    return {
        main: vaults.find((v) => v.kind === "main") ?? null,
        usd: vaults.find((v) => v.kind === "usd") ?? null,
        tradersOweUs: traders.positive,
        weOweParties: parties.negative,
    };
}
