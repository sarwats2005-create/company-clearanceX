import type { FC, SVGProps } from "react";
import { Container, Grid01, Settings01, Users01, Wallet02 } from "@untitledui/icons";
import type { MessageKey } from "@/lib/i18n";

type Icon = FC<SVGProps<SVGSVGElement>>;

export interface NavItem {
    href: string;
    label: MessageKey;
    icon: Icon;
}

/** Main navigation, in this order everywhere (PRD §8.1). Reports arrive in Phase 2. */
export const NAV_ITEMS: NavItem[] = [
    { href: "/", label: "nav.home", icon: Grid01 },
    { href: "/containers", label: "nav.containers", icon: Container },
    { href: "/money", label: "nav.money", icon: Wallet02 },
    { href: "/accounts", label: "nav.accounts", icon: Users01 },
    { href: "/settings", label: "nav.settings", icon: Settings01 },
];

/** Items of the "+ جديد" menu (PRD §8.1). */
export const NEW_ITEMS: { href: string; label: MessageKey }[] = [
    { href: "/containers/new", label: "action.newContainer" },
    { href: "/money/new/receive-trader", label: "money.receiveFromTrader" },
    { href: "/money/new/pay-party", label: "money.payParty" },
    { href: "/money/new/transfer", label: "money.transfer" },
    { href: "/money/new/exchange", label: "money.exchange" },
    { href: "/money/new/expense", label: "money.generalExpense" },
];

export function isActive(pathname: string, href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
