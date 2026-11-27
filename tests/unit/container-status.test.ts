import { describe, expect, it } from "vitest";
import { STATUS_ORDER, planStatusChange } from "@/features/containers/status";

const at = (status: (typeof STATUS_ORDER)[number], arrivedOn: string | null = null, deliveredOn: string | null = null) => ({ status, arrivedOn, deliveredOn });

describe("planStatusChange", () => {
    it("moves one step forward with no note needed", () => {
        const plan = planStatusChange(at("confirmed"), "on_the_way", "2026-11-05");
        expect(plan.isBackward).toBe(false);
        expect(plan.steps).toEqual([{ from: "confirmed", to: "on_the_way" }]);
        expect(plan.dates).toEqual({});
    });

    it("records every skipped step with the same date", () => {
        const plan = planStatusChange(at("confirmed"), "delivered", "2026-11-20");
        expect(plan.steps).toEqual([
            { from: "confirmed", to: "on_the_way" },
            { from: "on_the_way", to: "arrived" },
            { from: "arrived", to: "delivered" },
        ]);
        expect(plan.dates).toEqual({ arrivedOn: "2026-11-20", deliveredOn: "2026-11-20" });
    });

    it("sets arrivedOn when the container arrives", () => {
        expect(planStatusChange(at("on_the_way"), "arrived", "2026-11-14").dates).toEqual({ arrivedOn: "2026-11-14" });
    });

    it("keeps an existing arrival date when moving on to delivered", () => {
        expect(planStatusChange(at("arrived", "2026-11-14"), "delivered", "2026-11-20").dates).toEqual({ deliveredOn: "2026-11-20" });
    });

    it("needs a reason to move backward", () => {
        expect(() => planStatusChange(at("arrived", "2026-11-14"), "on_the_way", "2026-11-15")).toThrow("اكتب سبب الرجوع");
        expect(() => planStatusChange(at("arrived", "2026-11-14"), "on_the_way", "2026-11-15", "   ")).toThrow("اكتب سبب الرجوع");
    });

    it("moving backward is one step in the history and clears the later dates", () => {
        const plan = planStatusChange(at("delivered", "2026-11-14", "2026-11-20"), "on_the_way", "2026-11-21", "أدخلت بالخطأ");
        expect(plan.isBackward).toBe(true);
        expect(plan.steps).toEqual([{ from: "delivered", to: "on_the_way" }]);
        expect(plan.dates).toEqual({ arrivedOn: null, deliveredOn: null });
        expect(planStatusChange(at("delivered", "2026-11-14", "2026-11-20"), "arrived", "2026-11-21", "خطأ").dates).toEqual({ deliveredOn: null });
    });

    it("refuses the current status and a bad date", () => {
        expect(() => planStatusChange(at("arrived"), "arrived", "2026-11-14")).toThrow("في هذه المرحلة");
        expect(() => planStatusChange(at("confirmed"), "arrived", "14/11/2026")).toThrow("التاريخ");
    });

    it("lists the statuses in order", () => {
        expect(STATUS_ORDER).toEqual(["confirmed", "on_the_way", "arrived", "delivered"]);
    });
});
