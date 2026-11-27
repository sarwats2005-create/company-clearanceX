import { cx } from "@/utils/cx";

const bar = "rounded-md bg-secondary motion-safe:animate-pulse";

/** Same shape as the overview (vault card, tiles, debts), so nothing jumps when the numbers arrive. */
export function OverviewSkeleton() {
    return (
        <div aria-hidden="true" className="flex flex-col gap-6">
            <div className="h-72 rounded-[1.75rem] bg-hero opacity-90 motion-safe:animate-pulse md:h-64" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="surface flex h-36 flex-col justify-between p-4">
                        <span className={cx(bar, "size-10 rounded-xl")} />
                        <span className={cx(bar, "h-8 w-16")} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ListSkeleton() {
    return (
        <div aria-hidden="true" className="surface flex flex-col gap-4 p-4 md:p-6">
            <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-2">
                    <span className={cx(bar, "h-6 w-36")} />
                    <span className={cx(bar, "h-4 w-20")} />
                </div>
                <span className={cx(bar, "h-11 w-36 rounded-lg")} />
            </div>
            <div className="flex flex-wrap gap-2">
                {[16, 24, 20, 24, 28].map((w, i) => (
                    <span key={i} className={cx(bar, "h-10 rounded-full")} style={{ width: `${w * 4}px` }} />
                ))}
            </div>
            <ul className="flex flex-col divide-y divide-secondary border-y border-secondary">
                {Array.from({ length: 6 }, (_, i) => (
                    <li key={i} className="flex items-center justify-between gap-4 py-4">
                        <span className="flex flex-col gap-2">
                            <span className={cx(bar, "h-5 w-36")} />
                            <span className={cx(bar, "h-4 w-24")} />
                        </span>
                        <span className={cx(bar, "h-4 w-20")} />
                    </li>
                ))}
            </ul>
        </div>
    );
}
