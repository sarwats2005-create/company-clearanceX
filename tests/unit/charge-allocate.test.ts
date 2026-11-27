import { describe, expect, it } from "vitest";
import { allocateCharge, chargeMemo, summarizeCharges } from "@/features/charges/allocate";
import { SplitError } from "@/features/charges/split";

const A = "trader-a";
const H = "trader-h";
const shared = [
    { traderId: A, shareValue: "4" },
    { traderId: H, shareValue: "5.5" },
];

describe("allocateCharge", () => {
    it("puts the whole amount on the only trader of a normal container", () => {
        expect(
            allocateCharge({ amount: "2000", currency: "USD", unit: null, shares: [{ traderId: A, shareValue: null }], split: { mode: "by_share" } }),
        ).toEqual([{ traderId: A, amount: "2000.00" }]);
    });

    it("splits by shares like PRD §5.6 (842.11 / 1,157.89 and 54,737 / 75,263)", () => {
        expect(allocateCharge({ amount: "2000", currency: "USD", unit: "meters", shares: shared, split: { mode: "by_share" } })).toEqual([
            { traderId: A, amount: "842.11" },
            { traderId: H, amount: "1157.89" },
        ]);
        expect(allocateCharge({ amount: "130000", currency: "IQD", unit: "meters", shares: shared, split: { mode: "by_share" } })).toEqual([
            { traderId: A, amount: "54737" },
            { traderId: H, amount: "75263" },
        ]);
    });

    it("splits equally when the container's unit is equal, whatever the stored values", () => {
        const eq = [
            { traderId: A, shareValue: null },
            { traderId: H, shareValue: null },
        ];
        expect(allocateCharge({ amount: "100", currency: "USD", unit: "equal", shares: eq, split: { mode: "by_share" } })).toEqual([
            { traderId: A, amount: "50.00" },
            { traderId: H, amount: "50.00" },
        ]);
    });

    it("puts everything on one trader", () => {
        expect(allocateCharge({ amount: "300", currency: "USD", unit: "meters", shares: shared, split: { mode: "single_trader", traderId: H } })).toEqual([
            { traderId: A, amount: "0.00" },
            { traderId: H, amount: "300.00" },
        ]);
    });

    it("takes typed amounts when they add up to the total (PRD §5.6 manual 900 / 0)", () => {
        expect(allocateCharge({ amount: "900", currency: "USD", unit: "meters", shares: shared, split: { mode: "manual", amounts: { [A]: "900" } } })).toEqual([
            { traderId: A, amount: "900.00" },
            { traderId: H, amount: "0.00" },
        ]);
    });

    it("reports what is left when typed amounts don't add up", () => {
        try {
            allocateCharge({ amount: "900", currency: "USD", unit: "meters", shares: shared, split: { mode: "manual", amounts: { [A]: "500", [H]: "300" } } });
            expect.unreachable();
        } catch (e) {
            expect(e).toBeInstanceOf(SplitError);
            expect((e as SplitError).remaining).toBe("100.00");
        }
    });
});

describe("chargeMemo", () => {
    it("names the trader's share in the container's unit", () => {
        expect(chargeMemo({ mode: "by_share" }, "meters", shared, A)).toBe("حصتك 4 م من 9.5 م");
        expect(
            chargeMemo(
                { mode: "by_share" },
                "cbm",
                [
                    { traderId: A, shareValue: "28" },
                    { traderId: H, shareValue: "33" },
                ],
                A,
            ),
        ).toBe("حصتك 28 م³ من 61 م³");
        expect(
            chargeMemo(
                { mode: "by_share" },
                "percent",
                [
                    { traderId: A, shareValue: "40" },
                    { traderId: H, shareValue: "60" },
                ],
                H,
            ),
        ).toBe("حصتك 60%");
        expect(chargeMemo({ mode: "by_share" }, "equal", [...shared, { traderId: "x", shareValue: null }], A)).toBe("حصة متساوية (1 من 3)");
    });

    it("says how a charge was split when it was not by shares", () => {
        expect(chargeMemo({ mode: "manual", amounts: {} }, "meters", shared, A)).toBe("توزيع يدوي");
        expect(chargeMemo({ mode: "single_trader", traderId: A }, "meters", shared, A)).toBe("على تاجر واحد");
    });

    it("has nothing to add for a normal container", () => {
        expect(chargeMemo({ mode: "by_share" }, null, [{ traderId: A, shareValue: null }], A)).toBeNull();
    });
});

describe("summarizeCharges", () => {
    it("adds costs, fees and each trader's part per currency", () => {
        const s = summarizeCharges([
            {
                amount: "2000",
                currency: "USD",
                isFee: false,
                allocations: [
                    { traderId: A, amount: "842.11" },
                    { traderId: H, amount: "1157.89" },
                ],
            },
            {
                amount: "130000",
                currency: "IQD",
                isFee: false,
                allocations: [
                    { traderId: A, amount: "54737" },
                    { traderId: H, amount: "75263" },
                ],
            },
            {
                amount: "300",
                currency: "USD",
                isFee: true,
                allocations: [
                    { traderId: A, amount: "126.32" },
                    { traderId: H, amount: "173.68" },
                ],
            },
            {
                amount: "900",
                currency: "USD",
                isFee: false,
                allocations: [
                    { traderId: A, amount: "900" },
                    { traderId: H, amount: "0" },
                ],
            },
        ]);
        expect(s.costs).toEqual({ IQD: "130000", USD: "2900.00" });
        expect(s.fees).toEqual({ IQD: "0", USD: "300.00" });
        expect(s.total).toEqual({ IQD: "130000", USD: "3200.00" });
        expect(s.perTrader[A]).toEqual({ IQD: "54737", USD: "1868.43" });
        expect(s.perTrader[H]).toEqual({ IQD: "75263", USD: "1331.57" });
    });
});
