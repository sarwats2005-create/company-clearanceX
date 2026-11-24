import { describe, expect, it } from "vitest";
import { capacityFor, fillSummary, sharePercents, shareWeights } from "@/features/containers/shares";

const two = [
    { traderId: "a", shareValue: "4" },
    { traderId: "b", shareValue: "5.5" },
];

describe("shareWeights", () => {
    it("uses the typed shares for meters, m³ and percent", () => {
        expect(shareWeights("meters", two)).toEqual([
            { traderId: "a", weight: "4" },
            { traderId: "b", weight: "5.5" },
        ]);
    });

    it("gives everyone 1 for equal, and a normal container is one share of 1", () => {
        expect(shareWeights("equal", two).map((w) => w.weight)).toEqual(["1", "1"]);
        expect(shareWeights(null, [{ traderId: "a", shareValue: null }])).toEqual([{ traderId: "a", weight: "1" }]);
    });

    it("treats a blank share as zero", () => {
        expect(shareWeights("cbm", [{ traderId: "a", shareValue: null }])[0].weight).toBe("0");
    });
});

describe("sharePercents", () => {
    it("shows each trader's part of the total (PRD §8.5 example 42.1% / 57.9%)", () => {
        expect(sharePercents("meters", two)).toEqual([
            { traderId: "a", percent: "42.1" },
            { traderId: "b", percent: "57.9" },
        ]);
    });

    it("returns zeros instead of dividing by zero", () => {
        expect(sharePercents("meters", [{ traderId: "a", shareValue: null }])).toEqual([{ traderId: "a", percent: "0" }]);
    });
});

describe("capacity and fill", () => {
    const size = { lengthM: "12.00", volumeM3: "67.00" };

    it("takes the capacity from the size for the chosen unit", () => {
        expect(capacityFor(size, "meters")).toBe("12");
        expect(capacityFor(size, "cbm")).toBe("67");
        expect(capacityFor(size, "percent")).toBe("100");
        expect(capacityFor(size, "equal")).toBeNull();
        expect(capacityFor(null, "meters")).toBeNull();
    });

    it("shows the free space and warns when over capacity", () => {
        expect(fillSummary("meters", two, "12")).toEqual({ used: "9.5", free: "2.5", over: false });
        expect(fillSummary("meters", [...two, { traderId: "c", shareValue: "3" }], "12")).toEqual({ used: "12.5", free: "0", over: true });
        expect(fillSummary("meters", two, null)).toEqual({ used: "9.5", free: null, over: false });
    });
});
