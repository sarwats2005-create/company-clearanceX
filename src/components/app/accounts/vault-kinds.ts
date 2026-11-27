import type { FC, SVGProps } from "react";
import { BankNote01, Briefcase01, CoinsSwap01, Safe, User01, Wallet03 } from "@untitledui/icons";
import type { VaultKind } from "@/db/schema";

export const VAULT_KIND_ICON: Record<VaultKind, FC<SVGProps<SVGSVGElement>>> = {
    main: Safe,
    usd: BankNote01,
    person: User01,
    exchange_shop: CoinsSwap01,
    trader: Briefcase01,
    other: Wallet03,
};

export const VAULT_KIND_HINT: Partial<Record<VaultKind, string>> = {
    person: "مال عند شخص تثق به",
    exchange_shop: "رصيد لك عند محل صيرفة",
    trader: "مال تحفظه عند تاجر",
    other: "أي مكان آخر",
};
