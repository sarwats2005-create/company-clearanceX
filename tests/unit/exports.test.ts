import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { ContainerRow } from "@/features/containers/queries";
import { containersSheet, journalSheet, statementSheet } from "@/features/exports/sheets";
import { buildWorkbook, contentDisposition } from "@/features/exports/workbook";
import type { Statement } from "@/features/ledger/statements";
import type { JournalRow } from "@/features/money/queries";

async function load(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    return wb.worksheets[0];
}

describe("buildWorkbook (PRD §8.4, §8.7, §8.8 تصدير Excel)", () => {
    it("writes a right-to-left sheet: title, header, money as numbers in their format, dates as real dates", async () => {
        const buf = await buildWorkbook({
            name: "كشف",
            title: "كشف حساب أحمد كاظم",
            subtitle: "الفترة: الكل",
            columns: [
                { header: "التاريخ", width: 12 },
                { header: "البيان", width: 30 },
                { header: "المبلغ", width: 14 },
            ],
            rows: [
                [{ date: "2026-11-24" }, "قبض من تاجر", { money: "2400.5", currency: "USD" }],
                [{ date: "2026-11-01" }, "غرامة ميناء", { money: "250000", currency: "IQD" }],
            ],
            footer: ["المجموع", null, 7],
        });
        const ws = await load(buf);
        expect(ws.views[0]).toMatchObject({ rightToLeft: true });
        expect(ws.getCell("A1").value).toBe("كشف حساب أحمد كاظم");
        expect(ws.getCell("A2").value).toBe("الفترة: الكل");
        const header = ws.getRow(4).values as unknown[];
        expect(header.slice(1)).toEqual(["التاريخ", "البيان", "المبلغ"]);
        expect(ws.getCell("C5").value).toBe(2400.5);
        expect(ws.getCell("C5").numFmt).toContain("0.00");
        expect(ws.getCell("C6").value).toBe(250000);
        expect(ws.getCell("C6").numFmt).not.toContain("0.00");
        const d = ws.getCell("A5").value as Date;
        expect(d).toBeInstanceOf(Date);
        expect(d.toISOString().slice(0, 10)).toBe("2026-11-24");
        expect(ws.getCell("A7").value).toBe("المجموع");
        expect(ws.getCell("C7").value).toBe(7);
        expect(ws.getColumn(2).width).toBe(30);
    });

    it('names the download in plain ASCII (Chromium turns an Arabic filename* into "download" with no extension)', () => {
        expect(contentDisposition("statement-2026-11-24.xlsx")).toBe('attachment; filename="statement-2026-11-24.xlsx"');
        expect(contentDisposition("كشف 2026/11.xlsx")).toBe('attachment; filename="2026-11.xlsx"');
    });
});

const container: ContainerRow = {
    id: "c1",
    containerNumber: "MSCU4829175",
    status: "arrived",
    isShared: true,
    registeredOn: "2026-10-01",
    expectedArrivalOn: null,
    arrivedOn: "2026-11-10",
    deliveredOn: null,
    shippingLineName: "MSC",
    shippingLineLogo: null,
    shippingLineWebsite: null,
    billOfLadingNumber: "MEDU1234567",
    traderNames: ["أحمد كاظم", "حيدر"],
    goods: "أثاث",
    statusSince: "2026-11-10",
    daysInStatus: 14,
    isLate: true,
    totals: { USD: "2400.00" },
};

describe("export sheets", () => {
    it("containers: one row per container, both currencies in their own column", () => {
        const s = containersSheet([container], "كل الحاويات");
        expect(s.columns.map((c) => c.header)).toEqual([
            "رقم الحاوية",
            "خط الشحن",
            "رقم البوليصة",
            "التاجر",
            "البضاعة",
            "الحالة",
            "تاريخ التسجيل",
            "تاريخ الوصول",
            "تاريخ التسليم",
            "المصاريف بالدولار",
            "المصاريف بالدينار",
        ]);
        expect(s.rows[0]).toEqual([
            "MSCU4829175",
            "MSC",
            "MEDU1234567",
            "أحمد كاظم، حيدر",
            "أثاث",
            "وصلت أم قصر",
            { date: "2026-10-01" },
            { date: "2026-11-10" },
            null,
            { money: "2400.00", currency: "USD" },
            null,
        ]);
    });

    it("journal: cancelled receipts and cancellations are marked", () => {
        const row: JournalRow = {
            id: "j1",
            receiptNo: "ق-000001",
            receiptKind: "in",
            type: "receive_from_trader",
            reversesType: null,
            entryDate: "2026-11-24",
            description: "قبض من أحمد",
            from: "أحمد كاظم",
            to: "قاصة الدولار",
            amount: "100.00",
            currency: "USD",
            note: "دفعة",
            containerId: null,
            cancelledAt: new Date(),
            cancelReason: "خطأ",
        };
        const s = journalSheet(
            [row, { ...row, id: "j2", receiptNo: "ق-000002", type: "reversal", reversesType: "receive_from_trader", cancelledAt: null, cancelReason: null }],
            "كل المعاملات",
        );
        expect(s.columns.map((c) => c.header)).toEqual(["رقم الوصل", "التاريخ", "العملية", "من", "إلى", "المبلغ", "ملاحظة", "الحالة"]);
        expect(s.rows[0]).toEqual([
            "ق-000001",
            { date: "2026-11-24" },
            "قبض من تاجر",
            "أحمد كاظم",
            "قاصة الدولار",
            { money: "100.00", currency: "USD" },
            "دفعة",
            "ملغى: خطأ",
        ]);
        expect(s.rows[1][2]).toBe("إلغاء · قبض من تاجر");
        expect(s.rows[1][7]).toBe("قيد إلغاء");
    });

    it("statement: opening line, rows with the running balance in the owner's words, totals", () => {
        const st: Statement = {
            opening: "100.00",
            closing: "-50.00",
            totalDebit: "200.00",
            totalCredit: "350.00",
            rows: [
                {
                    lineId: "l1",
                    entryId: "e1",
                    date: "2026-11-02",
                    type: "container_charge",
                    receiptNo: null,
                    description: "كمرك بصرة",
                    memo: null,
                    containerId: "c1",
                    containerNumber: "MSCU4829175",
                    cancelled: false,
                    debit: "200.00",
                    credit: "0",
                    balance: "300.00",
                },
                {
                    lineId: "l2",
                    entryId: "e2",
                    date: "2026-11-05",
                    type: "receive_from_trader",
                    receiptNo: "ق-000003",
                    description: "قبض",
                    memo: "دفعة نقدية",
                    containerId: null,
                    containerNumber: null,
                    cancelled: true,
                    debit: "0",
                    credit: "350.00",
                    balance: "-50.00",
                },
            ],
        };
        const s = statementSheet(st, { title: "كشف حساب أحمد", range: "من 01/11/2026 إلى 30/11/2026", currency: "USD", mode: "account", withOpening: true });
        expect(s.columns.map((c) => c.header)).toEqual(["التاريخ", "الوصل", "الحاوية", "البيان", "عليه", "له", "الرصيد", ""]);
        expect(s.rows[0]).toEqual([null, null, null, "الرصيد في بداية الفترة", null, null, { money: "100.00", currency: "USD" }, "عليه"]);
        expect(s.rows[1]).toEqual([
            { date: "2026-11-02" },
            null,
            "MSCU4829175",
            "كمرك بصرة",
            { money: "200.00", currency: "USD" },
            null,
            { money: "300.00", currency: "USD" },
            "عليه",
        ]);
        expect(s.rows[2]).toEqual([
            { date: "2026-11-05" },
            "ق-000003",
            null,
            "قبض · دفعة نقدية (ملغى)",
            null,
            { money: "350.00", currency: "USD" },
            { money: "50.00", currency: "USD" },
            "له",
        ]);
        expect(s.footer).toEqual([
            null,
            null,
            null,
            "المجموع",
            { money: "200.00", currency: "USD" },
            { money: "350.00", currency: "USD" },
            { money: "50.00", currency: "USD" },
            "له",
        ]);
        const vault = statementSheet(st, { title: "القاصة", range: "الكل", currency: "USD", mode: "vault", withOpening: false });
        expect(vault.columns.map((c) => c.header)).toEqual(["التاريخ", "الوصل", "الحاوية", "البيان", "داخل", "خارج", "الرصيد"]);
        expect(vault.rows[1][6]).toEqual({ money: "-50.00", currency: "USD" });
    });
});
