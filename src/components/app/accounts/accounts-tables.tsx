import { BalanceText, SideAmount } from "@/components/app/balance-text";
import { PARTY_KIND_LABEL } from "@/features/accounts/model";
import type { PartyAccountRow, TraderAccountRow } from "@/features/accounts/queries";
import { containersText } from "@/lib/format";
import { cx } from "@/utils/cx";

const rowLink =
    "outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus-ring";

/** Traders with both balances (PRD §8.8): a hairline table on wide screens, stacked rows on phones. Rows open the trader. */
export function TradersTable({ rows }: { rows: TraderAccountRow[] }) {
    return (
        <>
            <div className="surface hidden overflow-hidden px-3 py-1 md:block">
                <table className="w-full table-fixed border-collapse text-md">
                    <thead>
                        <tr className="border-b border-secondary text-sm text-tertiary">
                            <th scope="col" className="px-3 py-3 text-start font-medium">
                                التاجر
                            </th>
                            <th scope="col" className="w-[17%] px-3 py-3 text-start font-medium">
                                الهاتف
                            </th>
                            <th scope="col" className="w-[15%] px-3 py-3 text-start font-medium">
                                حاويات قيد العمل
                            </th>
                            <th scope="col" className="w-[19%] px-3 py-3 text-end font-medium">
                                بالدولار
                            </th>
                            <th scope="col" className="w-[19%] px-3 py-3 text-end font-medium">
                                بالدينار
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="relative border-b border-secondary transition-colors last:border-b-0 duration-100 hover:bg-primary_hover">
                                <td className="px-3 py-3.5">
                                    <a href={`/accounts/traders/${r.id}`} className={cx("flex min-w-0 flex-col", rowLink)}>
                                        <span className="truncate font-semibold text-primary">{r.name}</span>
                                        {r.city && <span className="truncate text-sm text-tertiary">{r.city}</span>}
                                    </a>
                                </td>
                                <td className="px-3 py-3.5 text-tertiary">{r.phone ? <bdi className="num">{r.phone}</bdi> : "—"}</td>
                                <td className="px-3 py-3.5 text-secondary">
                                    {r.activeContainers ? containersText(r.activeContainers) : <span className="text-quaternary">—</span>}
                                </td>
                                <td className="px-3 py-3.5 text-end">
                                    <SideAmount amount={r.balance.USD} currency="USD" />
                                </td>
                                <td className="px-3 py-3.5 text-end">
                                    <SideAmount amount={r.balance.IQD} currency="IQD" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="surface flex flex-col divide-y divide-secondary px-4 md:hidden">
                {rows.map((r) => (
                    <li key={r.id}>
                        <a
                            href={`/accounts/traders/${r.id}`}
                            className="flex flex-col gap-1 py-3.5 outline-focus-ring transition-colors duration-100 focus-visible:outline-2 active:bg-primary_hover"
                        >
                            <span className="flex items-baseline justify-between gap-3">
                                <span className="truncate text-md font-semibold text-primary">{r.name}</span>
                                <BalanceText amounts={r.balance} className="shrink-0 justify-end text-md" />
                            </span>
                            <span className="flex flex-wrap gap-x-2 text-sm text-tertiary">
                                {r.phone && <bdi className="num">{r.phone}</bdi>}
                                {r.city && <span>{r.city}</span>}
                                {r.activeContainers > 0 && <span>{containersText(r.activeContainers)} قيد العمل</span>}
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </>
    );
}

/** Parties except our company (PRD §8.8), what we owe first. له (green) = we owe them. */
export function PartiesTable({ rows }: { rows: PartyAccountRow[] }) {
    return (
        <>
            <div className="surface hidden overflow-hidden px-3 py-1 md:block">
                <table className="w-full table-fixed border-collapse text-md">
                    <thead>
                        <tr className="border-b border-secondary text-sm text-tertiary">
                            <th scope="col" className="px-3 py-3 text-start font-medium">
                                الجهة
                            </th>
                            <th scope="col" className="w-[17%] px-3 py-3 text-start font-medium">
                                الهاتف
                            </th>
                            <th scope="col" className="w-[21%] px-3 py-3 text-end font-medium">
                                بالدولار
                            </th>
                            <th scope="col" className="w-[21%] px-3 py-3 text-end font-medium">
                                بالدينار
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr
                                key={r.id}
                                className={cx(
                                    "relative border-b border-secondary transition-colors duration-100 hover:bg-primary_hover",
                                    !r.isActive && "opacity-70",
                                )}
                            >
                                <td className="px-3 py-3.5">
                                    <a href={`/accounts/parties/${r.id}`} className={cx("flex min-w-0 flex-col", rowLink)}>
                                        <span className="truncate font-semibold text-primary">{r.name}</span>
                                        <span className="truncate text-sm text-tertiary">
                                            {PARTY_KIND_LABEL[r.kind]}
                                            {!r.isActive && " · موقوفة"}
                                        </span>
                                    </a>
                                </td>
                                <td className="px-3 py-3.5 text-tertiary">{r.phone ? <bdi className="num">{r.phone}</bdi> : "—"}</td>
                                <td className="px-3 py-3.5 text-end">
                                    <SideAmount amount={r.balance.USD} currency="USD" />
                                </td>
                                <td className="px-3 py-3.5 text-end">
                                    <SideAmount amount={r.balance.IQD} currency="IQD" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="surface flex flex-col divide-y divide-secondary px-4 md:hidden">
                {rows.map((r) => (
                    <li key={r.id}>
                        <a
                            href={`/accounts/parties/${r.id}`}
                            className={cx(
                                "flex flex-col gap-1 py-3.5 outline-focus-ring transition-colors duration-100 focus-visible:outline-2 active:bg-primary_hover",
                                !r.isActive && "opacity-70",
                            )}
                        >
                            <span className="flex items-baseline justify-between gap-3">
                                <span className="truncate text-md font-semibold text-primary">{r.name}</span>
                                <BalanceText amounts={r.balance} className="shrink-0 justify-end text-md" />
                            </span>
                            <span className="text-sm text-tertiary">
                                {PARTY_KIND_LABEL[r.kind]}
                                {r.phone && (
                                    <>
                                        {" · "}
                                        <bdi className="num">{r.phone}</bdi>
                                    </>
                                )}
                                {!r.isActive && " · موقوفة"}
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </>
    );
}
