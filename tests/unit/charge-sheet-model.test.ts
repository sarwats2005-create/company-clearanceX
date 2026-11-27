import { describe, expect, it } from "vitest";
import type { ChargeSheetData } from "@/features/charges/queries";
import { branchDinar, confirmSentence, newRow, payerVault, rowPreview, sheetSummary, toInput, vaultFor, vaultOutflows } from "@/features/charges/sheet-model";

const SELF = "p-self";
const CHINA = "p-china";
const A = "t-ahmed";
const H = "t-haider";
const types: ChargeSheetData["chargeTypes"] = [
    { id: "ct-customs", name: "كمرك بصرة", defaultCurrency: "USD", defaultPartyId: CHINA, isFee: false, isDefaultLine: false, defaultAmount: null },
    { id: "ct-port", name: "غرامة ميناء", defaultCurrency: "IQD", defaultPartyId: SELF, isFee: false, isDefaultLine: false, defaultAmount: "50000" },
    { id: "ct-fee", name: "أتعاب شركة", defaultCurrency: "USD", defaultPartyId: null, isFee: true, isDefaultLine: false, defaultAmount: "300.00" },
];
const base = (shared: boolean): ChargeSheetData => ({
    container: shared
        ? {
              id: "c1",
              containerNumber: "CMAU3390418",
              isShared: true,
              splitUnit: "meters",
              shares: [
                  { traderId: A, name: "أحمد", shareValue: "4.000" },
                  { traderId: H, name: "حيدر", shareValue: "5.500" },
              ],
          }
        : { id: "c1", containerNumber: "MSCU4829175", isShared: false, splitUnit: null, shares: [{ traderId: A, name: "أحمد", shareValue: null }] },
    chargeTypes: types,
    parties: [
        { id: SELF, name: "شركتنا", isSelf: true, isBranch: false },
        { id: CHINA, name: "شركة التخليص - الصين", isSelf: false, isBranch: false },
        { id: "p-umm", name: "شراكة تخليص أم قصر", isSelf: false, isBranch: true },
    ],
    vaults: [
        { id: "v-main", name: "القاصة الرئيسية", allowedCurrencies: ["IQD"], partyId: null },
        { id: "v-usd", name: "قاصة الدولار", allowedCurrencies: ["USD"], partyId: null },
        { id: "v-branch", name: "قاصة الشراكة", allowedCurrencies: ["IQD"], partyId: "p-umm" },
    ],
    defaultVaults: { IQD: "v-main", USD: "v-usd" },
});

describe("newRow", () => {
    it("prefills amount, currency, payer and (for our company) the default vault", () => {
        const d = base(false);
        expect(newRow(types[0], d)).toMatchObject({ amount: "", currency: "USD", paidByPartyId: CHINA, vaultId: null, splitMode: "by_share" });
        expect(newRow(types[1], d)).toMatchObject({ amount: "50000", currency: "IQD", paidByPartyId: SELF, vaultId: "v-main" });
        expect(newRow(types[2], d)).toMatchObject({ amount: "300", currency: "USD", paidByPartyId: null });
    });
});

describe("rowPreview", () => {
    it("shows each trader's part on a shared container (PRD §5.6)", () => {
        const d = base(true);
        expect(rowPreview({ ...newRow(types[0], d), amount: "2,000" }, d)).toEqual({
            kind: "parts",
            parts: [
                { traderId: A, amount: "842.11" },
                { traderId: H, amount: "1157.89" },
            ],
        });
    });

    it("shows what is left in a manual split", () => {
        const d = base(true);
        expect(rowPreview({ ...newRow(types[0], d), amount: "900", splitMode: "manual", manual: { [A]: "500" } }, d)).toEqual({
            kind: "remaining",
            remaining: "400.00",
        });
    });

    it("has nothing to show without a valid amount", () => {
        const d = base(true);
        expect(rowPreview({ ...newRow(types[0], d), amount: "abc" }, d)).toEqual({ kind: "none" });
    });
});

describe("confirmSentence", () => {
    it("names the trader and the fee part on a normal container (PRD §5.4)", () => {
        const d = base(false);
        const rows = { "ct-customs": { ...newRow(types[0], d), amount: "2100" }, "ct-fee": newRow(types[2], d) };
        expect(confirmSentence(d, ["ct-customs", "ct-fee"], rows)).toBe("سيتم تسجيل 2,400 $ على التاجر أحمد عن الحاوية MSCU4829175، منها 300 $ أتعاب");
    });

    it("lists each trader's part on a shared container (PRD §5.4)", () => {
        const d = base(true);
        const rows = { "ct-customs": { ...newRow(types[0], d), amount: "2400" } };
        expect(confirmSentence(d, ["ct-customs"], rows)).toBe("سيتم تسجيل 2,400 $ عن الحاوية CMAU3390418: أحمد 1,010.53 $ · حيدر 1,389.47 $");
    });

    it("joins two currencies", () => {
        const d = base(false);
        const rows = { "ct-customs": { ...newRow(types[0], d), amount: "2000" }, "ct-port": newRow(types[1], d) };
        expect(confirmSentence(d, ["ct-customs", "ct-port"], rows)).toBe("سيتم تسجيل 2,000 $ و 50,000 د.ع على التاجر أحمد عن الحاوية MSCU4829175");
    });
});

describe("sheetSummary", () => {
    it("totals per currency and the fee part", () => {
        const d = base(false);
        const rows = { "ct-customs": { ...newRow(types[0], d), amount: "2100" }, "ct-fee": newRow(types[2], d), "ct-port": newRow(types[1], d) };
        const s = sheetSummary(d, ["ct-customs", "ct-fee", "ct-port"], rows);
        expect(s.total).toEqual({ IQD: "50000", USD: "2400.00" });
        expect(s.fees).toEqual({ IQD: "0", USD: "300.00" });
    });
});

describe("sheetSummary on a shared container", () => {
    it("counts a row whose manual split is unfinished in the total, but not in any trader's part", () => {
        const d = base(true);
        const rows = {
            "ct-customs": { ...newRow(types[0], d), amount: "2000" },
            "ct-fee": { ...newRow(types[2], d), amount: "900", splitMode: "manual" as const, manual: { [A]: "500" } },
        };
        const s = sheetSummary(d, ["ct-customs", "ct-fee"], rows);
        expect(s.total).toEqual({ IQD: "0", USD: "2900.00" });
        expect(s.fees).toEqual({ IQD: "0", USD: "900.00" });
        expect(s.perTrader[A]).toEqual({ IQD: "0", USD: "842.11" });
        expect(s.unsplit).toBe(1);
    });
});

describe("toInput and vaultOutflows", () => {
    it("sends only what the server needs, in tile order", () => {
        const d = base(true);
        const rows = {
            "ct-port": newRow(types[1], d),
            "ct-fee": { ...newRow(types[2], d), splitMode: "single_trader" as const, splitTraderId: H, note: "  " },
            "ct-customs": { ...newRow(types[0], d), amount: "2000", splitMode: "manual" as const, manual: { [A]: "2000", [H]: "" } },
        };
        const input = toInput(d, "2026-11-20", ["ct-customs", "ct-port", "ct-fee"], rows);
        expect(input.rows.map((r) => r.chargeTypeId)).toEqual(["ct-customs", "ct-port", "ct-fee"]);
        expect(input.rows[0]).toMatchObject({ splitMode: "manual", manual: { [A]: "2000" }, vaultId: null, paidByPartyId: CHINA });
        expect(input.rows[1]).toMatchObject({ vaultId: "v-main", paidByPartyId: SELF, splitMode: "by_share" });
        expect(input.rows[2]).toMatchObject({ paidByPartyId: null, vaultId: null, splitMode: "single_trader", splitTraderId: H, note: null });
        expect(vaultOutflows(d, ["ct-customs", "ct-port", "ct-fee"], rows)).toEqual([{ vaultId: "v-main", currency: "IQD", amount: "50000" }]);
    });

    it("never sends a split for a normal container", () => {
        const d = base(false);
        const rows = { "ct-customs": { ...newRow(types[0], d), amount: "10", splitMode: "manual" as const } };
        expect(toInput(d, "2026-11-20", ["ct-customs"], rows).rows[0].splitMode).toBe("by_share");
    });
});

describe("the branch (Umm Qasr partnership) as payer", () => {
    const d = base(false);
    it("pays from its own vault by default; the owner can pay for it from his dinar vault", () => {
        expect(payerVault(d, "p-umm", "IQD")).toBe("v-branch");
        expect(payerVault(d, "p-umm", "IQD", "v-main")).toBe("v-main");
        expect(payerVault(d, "p-umm", "IQD", "v-usd")).toBe("v-branch");
        // Our own company never pays from the branch's vault.
        expect(vaultFor(d, "IQD", "v-branch")).toBe("v-main");
    });
    it("turns a dollar expense into dinar at the typed rate, and sends the rate", () => {
        const row = { ...newRow(d.chargeTypes[0], d), paidByPartyId: "p-umm", vaultId: "v-branch", amount: "500", currency: "USD" as const, fxRate: "1,320" };
        expect(branchDinar(d, row)).toBe("660000");
        expect(vaultOutflows(d, [d.chargeTypes[0].id], { [d.chargeTypes[0].id]: row })).toEqual([{ vaultId: "v-branch", currency: "IQD", amount: "660000" }]);
        expect(toInput(d, "2026-11-27", [d.chargeTypes[0].id], { [d.chargeTypes[0].id]: row }).rows[0]).toMatchObject({ vaultId: "v-branch", fxRate: "1,320" });
    });
});
