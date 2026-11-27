import { describe, expect, it } from "vitest";
import { journalQuery, parseJournalParams } from "@/features/money/journal-params";

describe("journal URL params", () => {
    it("keeps valid filters and drops anything odd", () => {
        expect(parseJournalParams({ q: "  أحمد ", kind: "in", from: "2026-11-01", to: "bad", page: "3" })).toEqual({
            q: "أحمد",
            kind: "in",
            from: "2026-11-01",
            to: undefined,
            page: 3,
        });
        expect(parseJournalParams({ kind: "drop table", page: "-1", q: ["a", "b"] })).toEqual({
            q: undefined,
            kind: undefined,
            from: undefined,
            to: undefined,
            page: undefined,
        });
    });

    it("builds the query back, resetting the page on demand", () => {
        expect(journalQuery({ q: "ص-1", kind: "out", page: 4 }, { page: 1 })).toBe("?q=%D8%B5-1&kind=out");
        expect(journalQuery({})).toBe("");
    });
});
