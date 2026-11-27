import { describe, expect, it } from "vitest";
import { activeFilterCount, listQuery, parseListParams } from "@/features/containers/list-params";

const T = "3f2b1c4d-5e6f-4a1b-9c2d-0e1f2a3b4c5d";

describe("containers list params", () => {
    it("reads valid filters and ignores junk", () => {
        const f = parseListParams({ q: "  mscu ", status: "arrived,bogus,on_the_way", trader: T, line: "nope", from: "2026-11-01", to: "31/12/2026", late: "1", sort: "number", dir: "asc", page: "3" });
        expect(f).toEqual({ q: "mscu", statuses: ["arrived", "on_the_way"], traderId: T, shippingLineId: undefined, from: "2026-11-01", to: undefined, lateOnly: true, sort: "number", dir: "asc", page: 3 });
        expect(parseListParams({ page: "-2", sort: "drop table" })).toMatchObject({ page: 1, sort: undefined, statuses: undefined });
    });

    it("writes a query string back, resetting the page when asked", () => {
        const f = parseListParams({ q: "4829", status: "arrived", page: "2" });
        expect(listQuery(f)).toBe("?q=4829&status=arrived&page=2");
        expect(listQuery(f, { page: 1, lateOnly: true })).toBe("?q=4829&status=arrived&late=1");
        expect(listQuery(parseListParams({}))).toBe("");
    });

    it("counts the filters shown on the phone button (search not included)", () => {
        expect(activeFilterCount(parseListParams({ q: "x", status: "arrived,delivered", late: "1", from: "2026-01-01", to: "2026-02-01" }))).toBe(3);
    });
});
