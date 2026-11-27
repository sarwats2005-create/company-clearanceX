"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Building07, ClockRewind, Container, Receipt, SearchLg, User01, XClose } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";
import { BalanceText } from "@/components/app/balance-text";
import { RECEIPT_KIND_LABEL } from "@/components/app/money/money-kinds";
import { StatusDot } from "@/components/app/status-dot";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { PARTY_KIND_LABEL } from "@/features/accounts/model";
import { searchAction } from "@/features/search/actions";
import { pushRecent } from "@/features/search/model";
import type { SearchResults } from "@/features/search/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { cx } from "@/utils/cx";

const RECENT_KEY = "cc.recentSearches";

function readRecent(): string[] {
    try {
        const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
    } catch {
        return [];
    }
}

function saveRecent(list: string[]) {
    try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
        /* private mode: recent searches are a convenience only */
    }
}

interface Hit {
    key: string;
    href: string;
    icon: typeof Container;
    title: ReactNode;
    sub: ReactNode;
    end?: ReactNode;
}

function toGroups(r: SearchResults): { label: string; hits: Hit[] }[] {
    return [
        {
            label: "الحاويات",
            hits: r.containers.map((c) => ({
                key: `c${c.id}`,
                href: `/containers/${c.id}`,
                icon: Container,
                title: <bdi className="cn font-semibold">{c.containerNumber}</bdi>,
                sub: [c.traderNames.join("، "), c.shippingLineName, c.billOfLadingNumber && `B/L ${c.billOfLadingNumber}`].filter(Boolean).join(" · "),
                end: <StatusDot status={c.status} short />,
            })),
        },
        {
            label: "التجار",
            hits: r.traders.map((t) => ({
                key: `t${t.id}`,
                href: `/accounts/traders/${t.id}`,
                icon: User01,
                title: t.name,
                sub: t.phone ? <bdi className="num">{t.phone}</bdi> : "تاجر",
                end: <BalanceText amounts={t.balance} className="justify-end text-sm" />,
            })),
        },
        {
            label: "الوصولات",
            hits: r.receipts.map((x) => ({
                key: `r${x.id}`,
                href: `/money/receipts/${x.id}`,
                icon: Receipt,
                title: (
                    <span className="inline-flex items-baseline gap-2">
                        <bdi className="num font-semibold">{x.receiptNo}</bdi>
                        {x.cancelled && <span className="text-sm text-error-primary">{x.type === "reversal" ? "وصل إلغاء" : "ملغى"}</span>}
                    </span>
                ),
                sub: [x.receiptKind ? RECEIPT_KIND_LABEL[x.receiptKind] : null, x.counterparty, formatDate(x.date)].filter(Boolean).join(" · "),
                end:
                    x.amount && x.currency ? (
                        <bdi className={cx("num text-sm whitespace-nowrap", x.cancelled ? "text-tertiary line-through" : "text-secondary")}>
                            {formatMoney(x.amount, x.currency)}
                        </bdi>
                    ) : null,
            })),
        },
        {
            label: "الجهات",
            hits: r.parties.map((p) => ({
                key: `p${p.id}`,
                href: `/accounts/parties/${p.id}`,
                icon: Building07,
                title: p.name,
                sub: PARTY_KIND_LABEL[p.kind],
                end: <BalanceText amounts={p.balance} className="justify-end text-sm" />,
            })),
        },
    ].filter((g) => g.hits.length);
}

/**
 * Global search (PRD §8.2): a wide field in the desktop top bar or an icon in the phone header, ⌘K / Ctrl+K,
 * results grouped by containers, traders, receipts and parties, arrow keys + Enter, the last 5 searches.
 */
export function GlobalSearch({ variant }: { variant: "bar" | "icon" }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(0);
    const [recent, setRecent] = useState<string[]>([]);
    const seq = useRef(0);

    useHotkeys("mod+k", () => setOpen(true), { enabled: variant === "bar", enableOnFormTags: true, preventDefault: true });

    useEffect(() => {
        if (!open) return;
        setRecent(readRecent());
        setQ("");
        setResults(null);
        setActive(0);
    }, [open]);

    useEffect(() => {
        const s = q.trim();
        if (!s) {
            setResults(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const id = ++seq.current;
        const timer = window.setTimeout(async () => {
            const r = await searchAction(s).catch(() => null);
            if (id !== seq.current) return;
            setResults(r);
            setActive(0);
            setLoading(false);
        }, 200);
        return () => window.clearTimeout(timer);
    }, [q]);

    const groups = useMemo(() => (results ? toGroups(results) : []), [results]);
    const flat = groups.flatMap((g) => g.hits);

    const go = (hit: Hit) => {
        const next = pushRecent(recent, q);
        saveRecent(next);
        setOpen(false);
        router.push(hit.href);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!flat.length) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const n = (active + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length;
            setActive(n);
            document.getElementById(`search-opt-${n}`)?.scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
            e.preventDefault();
            go(flat[Math.min(active, flat.length - 1)]);
        }
    };

    const trigger =
        variant === "bar" ? (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-12 w-full max-w-xl cursor-pointer items-center gap-2.5 rounded-2xl bg-primary px-4 text-md text-placeholder shadow-card ring-1 ring-secondary outline-focus-ring transition-[background-color] duration-150 ease-smooth ring-inset hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
            >
                <SearchLg className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                <span className="flex-1 truncate text-start">ابحث برقم الحاوية أو اسم التاجر أو رقم الوصل</span>
                <kbd className="hidden rounded-md px-1.5 py-0.5 font-sans text-xs text-quaternary ring-1 ring-secondary ring-inset xl:inline">Ctrl K</kbd>
            </button>
        ) : (
            <button
                type="button"
                aria-label="بحث"
                onClick={() => setOpen(true)}
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl bg-primary shadow-xs ring-1 ring-secondary outline-focus-ring transition-[background-color,transform] duration-150 ease-smooth ring-inset hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97]"
            >
                <SearchLg className="size-5 text-fg-quaternary" aria-hidden="true" />
            </button>
        );

    let index = -1;
    const hasQuery = q.trim().length > 0;

    return (
        <>
            {trigger}
            <ModalOverlay isOpen={open} onOpenChange={setOpen} isDismissable className="items-start pt-3 sm:items-start sm:pt-[12vh]">
                <Modal className="max-w-2xl">
                    <Dialog aria-label="البحث">
                        <div className="flex max-h-[inherit] flex-col">
                            <div className="flex items-center gap-3 border-b border-secondary px-4 sm:px-5">
                                <SearchLg className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                <input
                                    autoFocus
                                    role="combobox"
                                    aria-expanded={flat.length > 0}
                                    aria-controls="search-results"
                                    aria-activedescendant={flat.length ? `search-opt-${active}` : undefined}
                                    aria-autocomplete="list"
                                    aria-label="ابحث برقم الحاوية أو اسم التاجر أو رقم الوصل"
                                    placeholder="رقم الحاوية، اسم التاجر، رقم الوصل…"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    onKeyDown={onKeyDown}
                                    className="h-14 min-w-0 flex-1 bg-transparent text-lg text-primary outline-hidden placeholder:text-placeholder"
                                />
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    aria-label="إغلاق"
                                    className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-quaternary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
                                >
                                    <XClose className="size-5" aria-hidden="true" />
                                </button>
                            </div>

                            <div id="search-results" role="listbox" aria-label="نتائج البحث" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                                {!hasQuery &&
                                    (recent.length ? (
                                        <div className="flex flex-col">
                                            <p className="px-3 pt-2 pb-1 text-sm text-tertiary">آخر ما بحثت عنه</p>
                                            {recent.map((r) => (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() => setQ(r)}
                                                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-start text-md text-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
                                                >
                                                    <ClockRewind className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                                    <bdi>{r}</bdi>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="px-3 py-8 text-center text-md text-tertiary">
                                            اكتب جزءاً من رقم الحاوية، أو اسم التاجر، أو رقم الوصل مثل ق-12.
                                        </p>
                                    ))}

                                {hasQuery && !flat.length && (
                                    <p className="px-3 py-8 text-center text-md text-tertiary" role="status">
                                        {loading || !results ? "جارٍ البحث…" : `لا توجد نتائج لـ «${q.trim()}»`}
                                    </p>
                                )}

                                {groups.map((g) => (
                                    <div key={g.label} role="group" aria-label={g.label} className="flex flex-col pb-2">
                                        <p aria-hidden="true" className="px-3 pt-2 pb-1 text-sm text-tertiary">
                                            {g.label}
                                        </p>
                                        {g.hits.map((h) => {
                                            index += 1;
                                            const i = index;
                                            const Icon = h.icon;
                                            return (
                                                <div
                                                    key={h.key}
                                                    id={`search-opt-${i}`}
                                                    role="option"
                                                    aria-selected={i === active}
                                                    onClick={() => go(h)}
                                                    onMouseMove={() => i !== active && setActive(i)}
                                                    className={cx(
                                                        "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                                                        i === active && "bg-primary_hover",
                                                    )}
                                                >
                                                    <Icon className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                                    <span className="flex min-w-0 flex-1 flex-col">
                                                        <span className="truncate text-md text-primary">{h.title}</span>
                                                        <span className="truncate text-sm text-tertiary">{h.sub}</span>
                                                    </span>
                                                    {/* Capped so the name keeps room; two balances wrap onto two lines on a phone. */}
                                                    {h.end && <span className="max-w-[48%] shrink-0">{h.end}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>

                            <p className="hidden border-t border-secondary px-5 py-2.5 text-xs text-quaternary sm:block">
                                ↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق
                            </p>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </>
    );
}
