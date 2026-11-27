import { RestorePointsPanel } from "@/components/app/settings/restore-points-panel";
import { SectionShell } from "@/components/app/settings/section-shell";
import { db } from "@/db";
import { hasManualPointToday, listRestorePoints } from "@/features/restore/service";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/format";

export const metadata = { title: "نقاط الاسترجاع" };

export default async function Page() {
    await requireSession();
    const [points, savedToday] = await Promise.all([listRestorePoints(db), hasManualPointToday(db)]);
    return (
        <SectionShell title="نقاط الاسترجاع" description="نسخة كاملة من بياناتك تحفظها بضغطة، وترجع إليها متى شئت.">
            <RestorePointsPanel
                today={todayISO()}
                savedToday={savedToday}
                points={points.map((p) => ({ id: p.id, label: p.label, kind: p.kind, counts: p.counts, createdOn: p.createdOn, createdAt: p.createdAt.toISOString() }))}
            />
        </SectionShell>
    );
}
