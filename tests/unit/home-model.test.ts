import { describe, expect, it } from "vitest";
import { homeListFilters, homeQuery, lateArrivedText, lateOnTheWayText, parseHomeParams } from "@/features/home/model";

describe("home list chips (PRD §8.3)", () => {
    it("reads ?status= and ?page=, ignoring junk", () => {
        expect(parseHomeParams({})).toEqual({ filter: "all", page: 1 });
        expect(parseHomeParams({ status: "arrived", page: "3" })).toEqual({ filter: "arrived", page: 3 });
        expect(parseHomeParams({ status: "nope", page: "-2" })).toEqual({ filter: "all", page: 1 });
        expect(parseHomeParams({ status: ["on_the_way", "x"], page: "abc" })).toEqual({ filter: "on_the_way", page: 1 });
    });

    it("maps each chip to list filters: current by default, delivered = this month", () => {
        const today = "2026-11-24";
        expect(homeListFilters({ filter: "all", page: 2 }, today)).toEqual({ current: true, page: 2, pageSize: 25 });
        expect(homeListFilters({ filter: "arrived", page: 1 }, today)).toEqual({ statuses: ["arrived"], page: 1, pageSize: 25 });
        expect(homeListFilters({ filter: "delivered", page: 1 }, today)).toEqual({
            statuses: ["delivered"],
            deliveredFrom: "2026-11-01",
            page: 1,
            pageSize: 25,
        });
    });

    it("writes the URL back, dropping the defaults", () => {
        expect(homeQuery({ filter: "all", page: 1 })).toBe("/");
        expect(homeQuery({ filter: "arrived", page: 2 })).toBe("/?status=arrived&page=2");
        expect(homeQuery({ filter: "all", page: 3 })).toBe("/?page=3");
    });
});

describe("late alerts wording", () => {
    it("counts containers and days in correct Arabic", () => {
        expect(lateArrivedText(3, 7)).toBe("3 حاويات في أم قصر منذ أكثر من 7 أيام");
        expect(lateArrivedText(1, 2)).toBe("حاوية واحدة في أم قصر منذ أكثر من يومين");
        expect(lateArrivedText(2, 1)).toBe("حاويتان في أم قصر منذ أكثر من يوم واحد");
        expect(lateArrivedText(12, 14)).toBe("12 حاوية في أم قصر منذ أكثر من 14 يوماً");
        expect(lateOnTheWayText(1)).toBe("حاوية واحدة في الطريق بعد موعد الوصول المتوقع");
        expect(lateOnTheWayText(4)).toBe("4 حاويات في الطريق بعد موعد الوصول المتوقع");
    });
});
