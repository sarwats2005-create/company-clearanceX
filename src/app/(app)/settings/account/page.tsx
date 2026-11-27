import { AccountForm } from "@/components/app/settings/account-form";
import { DevicesCard } from "@/components/app/settings/devices-card";
import { SectionShell } from "@/components/app/settings/section-shell";
import { db } from "@/db";
import { requireSession } from "@/lib/auth";
import { listUserSessions } from "@/lib/auth-core";

export const metadata = { title: "الحساب" };

export default async function Page() {
    const s = await requireSession();
    const devices = await listUserSessions(db, s.userId);
    return (
        <SectionShell title="الحساب">
            <div className="flex flex-col gap-5">
                <AccountForm name={s.name} username={s.username} />
                <DevicesCard
                    devices={devices.map((d) => ({
                        id: d.id,
                        userAgent: d.userAgent,
                        ip: d.ip,
                        lastSeenAt: d.lastSeenAt.toISOString(),
                        createdAt: d.createdAt.toISOString(),
                        isCurrent: d.id === s.sessionId,
                    }))}
                />
            </div>
        </SectionShell>
    );
}
