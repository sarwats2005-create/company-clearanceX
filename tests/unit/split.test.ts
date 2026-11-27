import { describe, expect, it } from "vitest";
import { SplitError, splitAmount } from "@/features/charges/split";

const AHMED = "ahmed";
const HAIDER = "haider";
// PRD §5.6: CMAU3390418, 40ft = 12 m, Ahmed 4 m, Haider 5.5 m
const shared = [
    { traderId: AHMED, weight: "4" },
    { traderId: HAIDER, weight: "5.5" },
];

const amounts = (r: { traderId: string; amount: string }[]) => r.map((a) => a.amount);

describe("splitAmount by share (PRD §5.6)", () => {
    it("splits customs 2,000 $ into 842.11 / 1,157.89", () => {
        expect(splitAmount("2000", "USD", shared, "by_share")).toEqual([
            { traderId: AHMED, amount: "842.11" },
            { traderId: HAIDER, amount: "1157.89" },
        ]);
    });
    it("splits a port fine of 130,000 IQD into 54,737 / 75,263", () => {
        expect(amounts(splitAmount("130000", "IQD", shared, "by_share"))).toEqual(["54737", "75263"]);
    });
    it("splits the fee 300 $ into 126.32 / 173.68", () => {
        expect(amounts(splitAmount("300", "USD", shared, "by_share"))).toEqual(["126.32", "173.68"]);
    });
    it("gives the leftover to the largest share", () => {
        // 1.00 by 1:1:2 → 0.25, 0.25, 0.50 (exact); 0.10 by 1:1:1 → 0.03 each + 0.01 to first (tie)
        expect(amounts(splitAmount("1", "USD", [{ traderId: "a", weight: "1" }, { traderId: "b", weight: "1" }, { traderId: "c", weight: "2" }], "by_share"))).toEqual(["0.25", "0.25", "0.50"]);
        // 10 IQD by 1:2:2 → 2, 4, 4 exact; 7 IQD by 1:3:3 → 1, 3, 3 exact; 11 IQD by 1:1:1:3 → 1.83→2, 2, 2, 5.5→6 = 12 → -1 to largest (6→5)
        expect(amounts(splitAmount("11", "IQD", [{ traderId: "a", weight: "1" }, { traderId: "b", weight: "1" }, { traderId: "c", weight: "1" }, { traderId: "d", weight: "3" }], "by_share"))).toEqual(["2", "2", "2", "5"]);
    });
    it("always adds up exactly to the total", () => {
        const r = splitAmount("999.99", "USD", [{ traderId: "a", weight: "3" }, { traderId: "b", weight: "3" }, { traderId: "c", weight: "3.7" }], "by_share");
        const sum = r.reduce((s, a) => s + Math.round(Number(a.amount) * 100), 0);
        expect(sum).toBe(99999);
    });
    it("rejects shares that are all zero or blank (never divides by zero)", () => {
        const fn = () => splitAmount("100", "USD", [{ traderId: "a", weight: "0" }, { traderId: "b", weight: "" }], "by_share");
        expect(fn).toThrow(SplitError);
        try {
            fn();
        } catch (e) {
            expect((e as SplitError).code).toBe("zero_weight");
        }
    });
    it("rejects a negative share", () => {
        expect(() => splitAmount("100", "USD", [{ traderId: "a", weight: "-1" }, { traderId: "b", weight: "3" }], "by_share")).toThrow(
            expect.objectContaining({ code: "zero_weight" }),
        );
    });
});

describe("splitAmount equal", () => {
    it("splits 100 $ three ways into 33.34 / 33.33 / 33.33", () => {
        const three = [{ traderId: "a", weight: "" }, { traderId: "b", weight: "" }, { traderId: "c", weight: "" }];
        expect(amounts(splitAmount("100", "USD", three, "equal"))).toEqual(["33.34", "33.33", "33.33"]);
    });
});

describe("splitAmount single trader", () => {
    it("puts everything on that trader", () => {
        expect(splitAmount("900", "USD", shared, "single_trader", { traderId: HAIDER })).toEqual([
            { traderId: AHMED, amount: "0.00" },
            { traderId: HAIDER, amount: "900.00" },
        ]);
    });
    it("rejects a trader that is not on the container", () => {
        expect(() => splitAmount("900", "USD", shared, "single_trader", { traderId: "nobody" })).toThrow(
            expect.objectContaining({ code: "unknown_trader" }),
        );
    });
});

describe("splitAmount manual", () => {
    it("uses the typed amounts when they add up (PRD §5.6 sea freight 900 / 0)", () => {
        expect(amounts(splitAmount("900", "USD", shared, "manual", { manual: { [AHMED]: "900", [HAIDER]: "0" } }))).toEqual(["900.00", "0.00"]);
    });
    it("treats a missing trader as zero", () => {
        expect(amounts(splitAmount("900", "USD", shared, "manual", { manual: { [AHMED]: "900" } }))).toEqual(["900.00", "0.00"]);
    });
    it("rejects amounts that don't add up to the total", () => {
        expect(() => splitAmount("900", "USD", shared, "manual", { manual: { [AHMED]: "500", [HAIDER]: "300" } })).toThrow(
            expect.objectContaining({ code: "manual_mismatch", remaining: "100.00" }),
        );
    });
    it("rejects an amount for a trader not on the container", () => {
        expect(() => splitAmount("900", "USD", shared, "manual", { manual: { nobody: "900" } })).toThrow(expect.objectContaining({ code: "unknown_trader" }));
    });
    it("accepts Arabic digits in manual amounts", () => {
        expect(amounts(splitAmount("900", "USD", shared, "manual", { manual: { [AHMED]: "٤٠٠", [HAIDER]: "500" } }))).toEqual(["400.00", "500.00"]);
    });
});

describe("splitAmount with one trader", () => {
    it("gives the whole amount to the only trader", () => {
        expect(splitAmount("2400", "USD", [{ traderId: AHMED, weight: "" }], "equal")).toEqual([{ traderId: AHMED, amount: "2400.00" }]);
    });
});
