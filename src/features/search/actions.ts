"use server";

import { db } from "@/db";
import { requireSession } from "@/lib/auth";
import { type SearchResults, globalSearch } from "./queries";

const EMPTY: SearchResults = { containers: [], traders: [], parties: [], receipts: [] };

/** Search box (PRD §8.2). A failure shows "no results" rather than an error page. */
export async function searchAction(q: string): Promise<SearchResults> {
    await requireSession();
    try {
        return await globalSearch(db, String(q ?? ""));
    } catch (err) {
        console.error("[search]", err);
        return EMPTY;
    }
}
