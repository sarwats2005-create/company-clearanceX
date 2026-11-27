import type { ReactNode } from "react";
import { LinkTabs } from "@/components/app/link-tabs";
import type { AccountSegment } from "@/features/accounts/model";

const TABS: { segment: AccountSegment; label: string }[] = [
    { segment: "traders", label: "التجار" },
    { segment: "parties", label: "الجهات" },
    { segment: "vaults", label: "القاصات" },
];

/** "الحسابات" title with the التجار | الجهات | القاصات tabs (PRD §8.8). The active tab carries the navy rule. */
export function AccountsHeader({ current, description, actions }: { current: AccountSegment; description: ReactNode; actions?: ReactNode }) {
    return (
        <header className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="text-display-xs font-semibold text-primary">الحسابات</h1>
                    <p className="text-md text-tertiary">{description}</p>
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>}
            </div>
            <LinkTabs label="أقسام الحسابات" items={TABS.map((t) => ({ href: `/accounts/${t.segment}`, label: t.label, isActive: t.segment === current }))} />
        </header>
    );
}
