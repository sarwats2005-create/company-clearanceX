import { redirect } from "next/navigation";

/** الحسابات opens on the traders tab (PRD §8.8). */
export default function AccountsPage() {
    redirect("/accounts/traders");
}
