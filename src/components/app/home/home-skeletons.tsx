import { cx } from "@/utils/cx";

const bar = "rounded-md bg-secondary motion-safe:animate-pulse";

/** Same shape as the overview band, so nothing jumps when the numbers arrive. */
export function OverviewSkeleton() {
    return (
        <div aria-hidden="true">
            {[0, 1].map((row) => (
                <div key={row} className="grid grid-cols-2 border-b border-secondary lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={cx(
                                "flex flex-col gap-3 py-4 lg:pe-6",
                                i % 2 === 1 ? "border-s border-secondary ps-4" : "pe-4",
                                i >= 2 && "border-t border-secondary lg:border-t-0",
                                i === 2 && "lg:border-s",
                                i > 0 && "lg:ps-6",
                            )}
                        >
                            <span className={cx(bar, "h-4 w-24")} />
                            <span className={cx(bar, row === 0 ? "h-9 w-14" : "h-7 w-32")} />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export function ListSkeleton() {
    return (
        <div aria-hidden="true" className="flex flex-col gap-4">
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
