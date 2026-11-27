import { describe, expect, it } from "vitest";
import { toArabicWords } from "@/lib/tafqeet";

describe("toArabicWords", () => {
    it("writes USD amounts", () => {
        expect(toArabicWords("2400", "USD")).toBe("ألفان وأربعمائة دولار أمريكي لا غير");
    });
    it("writes millions of dinars", () => {
        expect(toArabicWords("3144000", "IQD")).toBe("ثلاثة ملايين ومائة وأربعة وأربعون ألف دينار عراقي لا غير");
    });
    it("writes zero", () => {
        expect(toArabicWords("0", "IQD")).toBe("صفر دينار عراقي لا غير");
    });
    it("writes cents", () => {
        expect(toArabicWords("2400.50", "USD")).toBe("ألفان وأربعمائة دولار أمريكي وخمسون سنتاً لا غير");
    });
    it.each([
        ["1", "واحد"],
        ["2", "اثنان"],
        ["10", "عشرة"],
        ["11", "أحد عشر"],
        ["12", "اثنا عشر"],
        ["19", "تسعة عشر"],
        ["20", "عشرون"],
        ["21", "واحد وعشرون"],
        ["100", "مائة"],
        ["200", "مائتان"],
        ["305", "ثلاثمائة وخمسة"],
        ["1000", "ألف"],
        ["1001", "ألف وواحد"],
        ["3000", "ثلاثة آلاف"],
        ["11000", "أحد عشر ألف"],
        ["200000", "مائتا ألف"],
        ["1000000", "مليون"],
        ["2000000", "مليونان"],
        ["130000", "مائة وثلاثون ألف"],
        ["1500000000", "مليار وخمسمائة مليون"],
    ])("writes %s as %s", (n, words) => {
        expect(toArabicWords(n, "IQD")).toBe(`${words} دينار عراقي لا غير`);
    });
    it("writes one cent and two cents", () => {
        expect(toArabicWords("0.01", "USD")).toBe("صفر دولار أمريكي وسنت واحد لا غير");
        expect(toArabicWords("5.02", "USD")).toBe("خمسة دولار أمريكي وسنتان لا غير");
        expect(toArabicWords("5.07", "USD")).toBe("خمسة دولار أمريكي وسبعة سنتات لا غير");
    });
    it("rounds IQD to whole dinars before writing", () => {
        expect(toArabicWords("54736.84", "IQD")).toBe("أربعة وخمسون ألف وسبعمائة وسبعة وثلاثون دينار عراقي لا غير");
    });
});
