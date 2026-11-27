import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { vaults } from "@/db/schema";
import { requireSession } from "@/lib/auth";

/** One tap to the main vault from anywhere: the nav item "القاصة" lands here and goes straight to its page. */
export default async function MainVaultShortcut() {
    await requireSession();
    const [main] = await db
        .select({ id: vaults.id })
        .from(vaults)
        .where(and(eq(vaults.kind, "main"), eq(vaults.isActive, true)))
        .limit(1);
    redirect(main ? `/accounts/vaults/${main.id}` : "/accounts/vaults");
}
