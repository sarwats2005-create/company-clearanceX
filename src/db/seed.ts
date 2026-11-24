/**
 * pnpm db:seed — reference data from PRD §12.4. Idempotent: running it again changes nothing
 * (rows are matched by their unique names; existing rows are never overwritten).
 */
import "dotenv/config";
import { eq, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
    chargeTypes,
    companySettings,
    containerSizes,
    expenseCategories,
    parties,
    portsOfLoading,
    receiptSequences,
    shippingLines,
    users,
    vaults,
} from "@/db/schema";
import { hashPassword } from "@/lib/password";

export const SEED = {
    company: "سرور البصرة",
    parties: {
        self: "شركتنا",
        china: "شركة التخليص - الصين",
        ummQasr: "شراكة تخليص أم قصر",
    },
    vaults: { main: "القاصة الرئيسية", usd: "قاصة الدولار" },
    shippingLines: ["MSC", "Maersk", "CMA CGM", "COSCO", "Hapag-Lloyd", "ONE", "Evergreen", "Yang Ming", "ZIM", "HMM"],
    ports: [
        ["شنغهاي", "الصين"],
        ["نينغبو", "الصين"],
        ["تشينغداو", "الصين"],
        ["شنزن (يانتيان)", "الصين"],
        ["قوانغتشو (نانشا)", "الصين"],
        ["شيامن", "الصين"],
        ["تيانجين", "الصين"],
        ["جبل علي", "الإمارات"],
        ["مرسين", "تركيا"],
    ] as const,
    sizes: [
        { code: "20ft", label: "20 قدم", lengthM: "5.90", volumeM3: "33.00" },
        { code: "40ft", label: "40 قدم", lengthM: "12.00", volumeM3: "67.00" },
        { code: "40hc", label: "40 قدم عالي", lengthM: "12.00", volumeM3: "76.00" },
        { code: "45ft", label: "45 قدم", lengthM: "13.50", volumeM3: "86.00" },
    ],
    chargeTypes: [
        { name: "كمرك بصرة", currency: "USD", party: "china", isFee: false },
        { name: "غرامة شركة الشحن", currency: "USD", party: "china", isFee: false },
        { name: "غرامة ميناء", currency: "IQD", party: "ummQasr", isFee: false },
        { name: "أجور نقل بحري", currency: "USD", party: "china", isFee: false },
        { name: "أتعاب شركة", currency: "USD", party: null, isFee: true },
        { name: "أجور نقل الجوي", currency: "USD", party: "china", isFee: false },
        { name: "أتعاب أجور نقل", currency: "USD", party: null, isFee: true },
    ] as const,
    expenseCategories: ["إيجار", "رواتب", "وقود ونقل", "ضيافة", "أخرى"],
};

export async function seed(db: DbOrTx, owner: { username: string; password: string; name: string }) {
    // Owner (only when that username doesn't exist yet; the password is never reset by the seed).
    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = ${owner.username.trim().toLowerCase()}`);
    if (!existing) {
        await db.insert(users).values({ name: owner.name, username: owner.username.trim().toLowerCase(), passwordHash: await hashPassword(owner.password) });
    }

    await db
        .insert(parties)
        .values([
            { name: SEED.parties.self, kind: "self", isSystem: true },
            { name: SEED.parties.china, kind: "clearance_company" },
            { name: SEED.parties.ummQasr, kind: "partner" },
        ])
        .onConflictDoNothing();
    await db
        .insert(vaults)
        .values([
            { name: SEED.vaults.main, kind: "main", allowedCurrencies: ["IQD"], isSystem: true },
            { name: SEED.vaults.usd, kind: "usd", allowedCurrencies: ["USD"], isSystem: true },
        ])
        .onConflictDoNothing();
    await db
        .insert(shippingLines)
        .values(SEED.shippingLines.map((name, i) => ({ name, sortOrder: i })))
        .onConflictDoNothing();
    await db
        .insert(portsOfLoading)
        .values(SEED.ports.map(([name, country], i) => ({ name, country, sortOrder: i })))
        .onConflictDoNothing();
    await db
        .insert(containerSizes)
        .values(SEED.sizes.map((s, i) => ({ ...s, sortOrder: i })))
        .onConflictDoNothing();
    await db
        .insert(expenseCategories)
        .values(SEED.expenseCategories.map((name, i) => ({ name, sortOrder: i })))
        .onConflictDoNothing();
    await db
        .insert(receiptSequences)
        .values([
            { kind: "in", prefix: "ق", nextNumber: 1 },
            { kind: "out", prefix: "ص", nextNumber: 1 },
            { kind: "transfer", prefix: "ت", nextNumber: 1 },
            { kind: "exchange", prefix: "ع", nextNumber: 1 },
        ])
        .onConflictDoNothing();

    const partyId = async (name: string) => (await db.select({ id: parties.id }).from(parties).where(eq(parties.name, name)))[0]?.id ?? null;
    const china = await partyId(SEED.parties.china);
    const ummQasr = await partyId(SEED.parties.ummQasr);
    await db
        .insert(chargeTypes)
        .values(
            SEED.chargeTypes.map((c, i) => ({
                name: c.name,
                defaultCurrency: c.currency,
                defaultPartyId: c.party === "china" ? china : c.party === "ummQasr" ? ummQasr : null,
                isFee: c.isFee,
                sortOrder: i,
            })),
        )
        .onConflictDoNothing();

    const vaultId = async (name: string) => (await db.select({ id: vaults.id }).from(vaults).where(eq(vaults.name, name)))[0]?.id ?? null;
    await db.insert(companySettings).values({ id: 1, name: SEED.company, defaultUsdIqdRate: "1310" }).onConflictDoNothing();
    await db.update(companySettings).set({ defaultClearancePartyId: china }).where(isNull(companySettings.defaultClearancePartyId));
    await db.update(companySettings).set({ defaultVaultIqdId: await vaultId(SEED.vaults.main) }).where(isNull(companySettings.defaultVaultIqdId));
    await db.update(companySettings).set({ defaultVaultUsdId: await vaultId(SEED.vaults.usd) }).where(isNull(companySettings.defaultVaultUsdId));
}

if (process.argv[1]?.endsWith("seed.ts")) {
    const { OWNER_USERNAME, OWNER_PASSWORD, OWNER_NAME } = process.env;
    if (!OWNER_USERNAME || !OWNER_PASSWORD || OWNER_PASSWORD.length < 8) {
        console.error("Set OWNER_USERNAME and OWNER_PASSWORD (at least 8 characters) before seeding.");
        process.exit(1);
    }
    void (async () => {
        const { db, pool } = await import("@/db");
        try {
            await seed(db, { username: OWNER_USERNAME, password: OWNER_PASSWORD, name: OWNER_NAME || "المالك" });
            console.log("seed complete");
        } catch (err) {
            console.error(err);
            process.exitCode = 1;
        } finally {
            await pool.end();
        }
    })();
}
