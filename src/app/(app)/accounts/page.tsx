import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

/** الحسابات opens on the traders tab (PRD §8.8). */
export default async function AccountsPage() {
    await requireSession();
    redirect("/accounts/traders");
}
