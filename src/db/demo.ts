/**
 * pnpm db:demo — sample data for showing the app (PRD §12): 10 traders, 30 containers across every
 * status (some late, some shared), charges in both currencies, and payments. Dates are relative to
 * today so the home page always has something to show. Runs only on a database with no containers,
 * so it can never mix with real work. Run `pnpm db:seed` first.
 */
import "dotenv/config";
import { asc, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { chargeTypes, containerSizes, containers, parties, portsOfLoading, shippingLines, traders, vaults } from "@/db/schema";
import type { ChargeRowInput } from "@/features/charges/schemas";
import { addCharges } from "@/features/charges/service";
import { changeStatus, createContainer } from "@/features/containers/service";
import { postMoney } from "@/features/money/service";
import { hasValidCheckDigit } from "@/lib/container-number";
import { todayISO } from "@/lib/format";

const TRADERS = [
    { name: "أحمد كاظم", phone: "07701234567", city: "البصرة" },
    { name: "حيدر عبد الله", phone: "07801112233", city: "البصرة" },
    { name: "علي حسين الموسوي", phone: "07709876543", city: "بغداد" },
    { name: "مصطفى جبار", phone: "07502223344", city: "الناصرية" },
    { name: "كرار عباس", phone: "07813334455", city: "العمارة" },
    { name: "محمد رياض", phone: "07714445566", city: "البصرة" },
    { name: "سجاد ناظم", phone: "07725556677", city: "الكوت" },
    { name: "ياسر طالب", phone: "07736667788", city: "الحلة" },
    { name: "عمار فاضل", phone: "07747778899", city: "النجف" },
    { name: "حسن مهدي", phone: "07758889900", city: "كربلاء" },
];

const GOODS = ["أجهزة كهربائية", "ملابس", "أثاث", "مواد بناء", "قطع غيار سيارات", "أحذية", "أدوات منزلية", "إطارات", "سيراميك", "ألعاب أطفال"];
const OWNER_CODES = ["MSCU", "MAEU", "CMAU", "CSNU", "HLXU", "ONEU", "EGHU", "YMLU", "ZIMU", "HMMU"];

/** A real-looking ISO 6346 number: owner code + serial + the check digit that makes it valid. */
function containerNumber(i: number): string {
    for (let serial = 482917 + i * 7919; ; serial++) {
        const base = `${OWNER_CODES[i % OWNER_CODES.length]}${String(serial % 1_000_000).padStart(6, "0")}`;
        for (let d = 0; d <= 9; d++) if (hasValidCheckDigit(`${base}${d}`)) return `${base}${d}`;
    }
}

function addDays(iso: string, n: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

const maxDate = (a: string, b: string) => (a > b ? a : b);

export async function demo(db: DbOrTx, ownerId: string, today: string = todayISO()): Promise<{ containers: number; traders: number }> {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(containers);
    if (Number(n) > 0) throw new Error("يوجد بيانات حاويات في قاعدة البيانات. بيانات العرض تُضاف إلى قاعدة بيانات فارغة فقط.");

    const lines = await db.select().from(shippingLines).orderBy(asc(shippingLines.sortOrder));
    const ports = await db.select().from(portsOfLoading).orderBy(asc(portsOfLoading.sortOrder));
    const sizes = await db.select().from(containerSizes).orderBy(asc(containerSizes.sortOrder));
    const types = await db.select().from(chargeTypes).orderBy(asc(chargeTypes.sortOrder));
    const allParties = await db.select().from(parties);
    const allVaults = await db.select().from(vaults);
    const type = (name: string) => types.find((t) => t.name === name)!;
    const self = allParties.find((p) => p.kind === "self")!;
    const china = allParties.find((p) => p.name === "شركة التخليص - الصين") ?? allParties.find((p) => p.kind === "clearance_company")!;
    const ummQasr = allParties.find((p) => p.name === "شراكة تخليص أم قصر") ?? allParties.find((p) => p.kind === "partner")!;
    const main = allVaults.find((v) => v.kind === "main")!;
    const usd = allVaults.find((v) => v.kind === "usd")!;
    // The partnership is the owner's branch with its own dinar vault (owner's request 2026-11-27).
    const branchVault = allVaults.find((v) => v.partyId === ummQasr?.id);
    if (!lines.length || !types.length || !self || !china || !ummQasr || !main || !usd || !branchVault) throw new Error("شغّل pnpm db:seed أولاً.");

    const traderIds = (await db.insert(traders).values(TRADERS).returning({ id: traders.id })).map((t) => t.id);

    // Opening cash so the vaults start positive.
    const opening = addDays(today, -90);
    await postMoney(db, { kind: "deposit", date: opening, vaultId: main.id, amount: "60000000", currency: "IQD", note: "رصيد افتتاحي" }, ownerId);
    await postMoney(db, { kind: "deposit", date: opening, vaultId: branchVault.id, amount: "8000000", currency: "IQD", note: "رصيد افتتاحي" }, ownerId);
    await postMoney(db, { kind: "deposit", date: opening, vaultId: usd.id, amount: "45000", currency: "USD", note: "رصيد افتتاحي" }, ownerId);

    const monthStart = `${today.slice(0, 7)}-01`;
    for (let i = 0; i < 30; i++) {
        // 7 confirmed · 8 on the way (2 late) · 7 arrived (3 waiting too long) · 8 delivered (4 this month).
        const stage = i < 7 ? "confirmed" : i < 15 ? "on_the_way" : i < 22 ? "arrived" : "delivered";
        const registeredOn = addDays(today, stage === "confirmed" ? -i : stage === "on_the_way" ? -(18 + i) : stage === "arrived" ? -(40 + i) : -(60 + i * 2));
        const shared = [3, 10, 18, 24].includes(i);
        const t1 = traderIds[i % 10];
        const t2 = traderIds[(i + 3) % 10];
        const size = sizes[i % sizes.length];
        const expectedArrivalOn =
            stage === "on_the_way" ? addDays(today, i === 7 ? -3 : i === 8 ? -1 : 2 + (i - 9) * 3) : stage === "confirmed" ? addDays(registeredOn, 35) : null;

        const { id } = await createContainer(
            db,
            {
                containerNumber: containerNumber(i),
                shippingLineId: lines[i % lines.length].id,
                portOfLoadingId: ports[i % ports.length]?.id ?? null,
                billOfLadingNumber: i % 3 === 0 ? `MEDU${String(8812340 + i * 13)}` : null,
                containerSizeId: size?.id ?? null,
                isShared: shared,
                splitUnit: shared ? "meters" : null,
                shares: shared
                    ? [
                          { traderId: t1, shareValue: "7", goods: GOODS[i % 10], cartons: String(200 + i * 10) },
                          { traderId: t2, shareValue: "5", goods: GOODS[(i + 4) % 10], cartons: String(120 + i * 5) },
                      ]
                    : [{ traderId: t1, goods: GOODS[i % 10], cartons: String(300 + i * 15) }],
                registeredOn,
                expectedArrivalOn,
                destination: i % 4 === 0 ? "بغداد" : "البصرة",
            },
            ownerId,
        );

        if (stage === "confirmed") {
            if (i % 2 === 0) {
                await addCharges(
                    db,
                    { containerId: id, date: registeredOn, rows: [{ chargeTypeId: type("أتعاب شركة").id, amount: "250", currency: "USD" }] },
                    ownerId,
                );
            }
            continue;
        }

        const shippedOn = addDays(registeredOn, 5);
        await changeStatus(db, id, { to: "on_the_way", date: shippedOn }, ownerId);
        const rows: ChargeRowInput[] = [
            { chargeTypeId: type("كمرك بصرة").id, amount: String(1200 + (i % 5) * 300), currency: "USD", paidByPartyId: china.id },
            { chargeTypeId: type("أجور نقل بحري").id, amount: String(1800 + (i % 3) * 250), currency: "USD", paidByPartyId: china.id },
            { chargeTypeId: type("أتعاب شركة").id, amount: String(250 + (i % 4) * 50), currency: "USD" },
        ];
        await addCharges(db, { containerId: id, date: shippedOn, rows }, ownerId);

        if (stage === "on_the_way") continue;

        const arrivedOn = stage === "arrived" ? addDays(today, i === 15 ? -12 : i === 16 ? -10 : i === 17 ? -9 : -(i - 17)) : addDays(registeredOn, 30);
        await changeStatus(db, id, { to: "arrived", date: arrivedOn }, ownerId);
        const portRows: ChargeRowInput[] = [
            // Port fines: some paid by the Umm Qasr partnership from its vault (the trader owes the partnership), some from our own main vault.
            i % 2 === 0
                ? { chargeTypeId: type("غرامة ميناء").id, amount: String(250000 + (i % 4) * 75000), currency: "IQD", paidByPartyId: ummQasr.id, vaultId: branchVault.id }
                : { chargeTypeId: type("غرامة ميناء").id, amount: String(300000 + (i % 3) * 50000), currency: "IQD", paidByPartyId: self.id, vaultId: main.id },
        ];
        if (i % 3 === 0) portRows.push({ chargeTypeId: type("غرامة شركة الشحن").id, amount: "450", currency: "USD", paidByPartyId: china.id });
        await addCharges(db, { containerId: id, date: arrivedOn, rows: portRows, allowNegative: true }, ownerId);

        if (stage === "delivered") {
            const deliveredOn = i < 26 ? maxDate(monthStart, addDays(today, -(i - 22) * 2)) : addDays(today, -(35 + (i - 26) * 8));
            await changeStatus(db, id, { to: "delivered", date: maxDate(deliveredOn, arrivedOn) }, ownerId);
        }
    }

    // Traders pay part of what they owe (dollars into the dollar vault, dinars into the main vault).
    for (let k = 0; k < 10; k++) {
        const date = addDays(today, -(2 + k * 3));
        await postMoney(
            db,
            { kind: "receive_trader", date, traderId: traderIds[k], vaultId: usd.id, amount: String(1500 + k * 400), currency: "USD" },
            ownerId,
        );
        if (k % 3 === 0) {
            await postMoney(
                db,
                { kind: "receive_trader", date, traderId: traderIds[k], vaultId: main.id, amount: String(400000 + k * 50000), currency: "IQD" },
                ownerId,
            );
        }
    }
    // We settle part of what we owe the clearance companies.
    await postMoney(
        db,
        { kind: "pay_party", date: addDays(today, -6), partyId: china.id, vaultId: usd.id, amount: "18000", currency: "USD", allowNegative: true },
        ownerId,
    );
    // A trader pays the partnership's part into the owner's vault; the owner then hands it over.
    await postMoney(
        db,
        { kind: "receive_trader", date: addDays(today, -4), traderId: traderIds[0], vaultId: main.id, amount: "250000", currency: "IQD", branchAmount: "250000" },
        ownerId,
    );
    await postMoney(
        db,
        { kind: "transfer", date: addDays(today, -3), fromVaultId: main.id, toVaultId: branchVault.id, amount: "250000", currency: "IQD", settleBranch: true },
        ownerId,
    );

    return { containers: 30, traders: TRADERS.length };
}

if (process.argv[1]?.endsWith("demo.ts")) {
    void (async () => {
        const { db, pool, withTx } = await import("@/db");
        const { users } = await import("@/db/schema");
        try {
            const [owner] = await db.select({ id: users.id }).from(users).orderBy(asc(users.createdAt)).limit(1);
            if (!owner) throw new Error("شغّل pnpm db:seed أولاً.");
            const out = await withTx((tx) => demo(tx, owner.id));
            console.log(`demo data added: ${out.traders} traders, ${out.containers} containers`);
        } catch (err) {
            console.error(err instanceof Error ? err.message : err);
            process.exitCode = 1;
        } finally {
            await pool.end();
        }
    })();
}
