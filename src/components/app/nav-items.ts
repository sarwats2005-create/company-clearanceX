import type { FC, SVGProps } from "react";
import {
    ArrowCircleDown,
    ArrowCircleUp,
    Container,
    CoinsSwap01,
    Home03,
    Plus,
    Receipt,
    Safe,
    Settings01,
    SwitchHorizontal01,
    Users01,
    Wallet02,
} from "@untitledui/icons";
import type { TileColor } from "@/components/app/icon-tile";
import type { MessageKey } from "@/lib/i18n";

type Icon = FC<SVGProps<SVGSVGElement>>;

export interface NavItem {
    href: string;
    label: MessageKey;
    icon: Icon;
    color: TileColor;
    /** Extra paths that count as "here" (the vault item lights up on every vault page). */
    match?: RegExp;
    /** Paths that must NOT light this item even though they start with its href. */
    exclude?: RegExp;
}

/** Main navigation, in this order everywhere. The main vault has its own item: one tap from anywhere. */
export const NAV_ITEMS: NavItem[] = [
    { href: "/", label: "nav.home", icon: Home03, color: "brand" },
    { href: "/containers", label: "nav.containers", icon: Container, color: "orange" },
    { href: "/vault", label: "nav.vault", icon: Safe, color: "gold", match: /^\/accounts\/vaults(\/|$)/ },
    { href: "/money", label: "nav.money", icon: Wallet02, color: "teal" },
    { href: "/accounts", label: "nav.accounts", icon: Users01, color: "purple", exclude: /^\/accounts\/vaults(\/|$)/ },
    { href: "/settings", label: "nav.settings", icon: Settings01, color: "gray" },
];

/** Items of the "+ جديد" menu, each with its own icon and color. */
export const NEW_ITEMS: { href: string; label: MessageKey; icon: Icon; color: TileColor }[] = [
    { href: "/containers/new", label: "action.newContainer", icon: Plus, color: "orange" },
    { href: "/money/new/receive-trader", label: "money.receiveFromTrader", icon: ArrowCircleDown, color: "green" },
    { href: "/money/new/pay-party", label: "money.payParty", icon: ArrowCircleUp, color: "red" },
    { href: "/money/new/transfer", label: "money.transfer", icon: SwitchHorizontal01, color: "blue" },
    { href: "/money/new/exchange", label: "money.exchange", icon: CoinsSwap01, color: "purple" },
    { href: "/money/new/expense", label: "money.generalExpense", icon: Receipt, color: "pink" },
];

export function isActive(pathname: string, item: NavItem | string) {
    const it = typeof item === "string" ? ({ href: item } as NavItem) : item;
    if (it.exclude?.test(pathname)) return false;
    if (it.match?.test(pathname)) return true;
    return it.href === "/" ? pathname === "/" : pathname === it.href || pathname.startsWith(`${it.href}/`);
}
