import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext (where login sends you back)", () => {
    it("keeps a page of this app, with its query", () => {
        expect(safeNext("/containers?status=arrived&page=2")).toBe("/containers?status=arrived&page=2");
        expect(safeNext("/accounts/traders/abc#statement")).toBe("/accounts/traders/abc#statement");
    });
    it("sends anything that would leave the app to the home page", () => {
        for (const evil of ["//evil.com", "/\\evil.com", "\\\\evil.com", "/\t/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com"]) {
            expect(safeNext(evil), evil).toBe("/");
        }
    });
    it("falls back to the home page when nothing was sent", () => {
        expect(safeNext(null)).toBe("/");
        expect(safeNext("")).toBe("/");
    });
});
