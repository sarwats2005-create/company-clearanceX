import type { FC, SVGProps } from "react";
import { Anchor, Building07, ClockRewind, Container, CurrencyDollarCircle, Lock01, MarkerPin01, Receipt, ReceiptCheck, Safe, Tag01, Type01, Users01 } from "@untitledui/icons";
import type { TileColor } from "@/components/app/icon-tile";

export interface SettingsSection {
    slug: string;
    title: string;
    description: string;
    icon: FC<SVGProps<SVGSVGElement>>;
    color: TileColor;
}

export interface SettingsGroup {
    title: string;
    sections: SettingsSection[];
}

/**
 * Settings in small groups, each item with its own colored icon (like a phone's Settings app, which this
 * owner already knows how to use). Opening balances, import and the audit log viewer arrive in Phase 2.
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
    {
        title: "الشركة والمال",
        sections: [
            { slug: "company", title: "معلومات الشركة", description: "الاسم والهاتف والعنوان ونص أسفل الوصل", icon: Building07, color: "brand" },
            { slug: "vaults", title: "القاصات", description: "القاصة التي تُختار أولاً لكل عملة", icon: Safe, color: "gold" },
            { slug: "currency", title: "سعر الصرف والتنبيهات", description: "سعر الدولار الافتراضي وأيام التنبيه", icon: CurrencyDollarCircle, color: "green" },
            { slug: "receipts", title: "الوصولات", description: "حرف الوصل والرقم التالي", icon: ReceiptCheck, color: "teal" },
        ],
    },
    {
        title: "المصاريف",
        sections: [
            { slug: "charge-types", title: "أنواع المصاريف", description: "كمرك، غرامات، نقل، أتعاب… والسطور الافتراضية وعملتها", icon: Receipt, color: "pink" },
            { slug: "parties", title: "الجهات", description: "شركات التخليص والشركاء الذين يدفعون المصاريف", icon: Users01, color: "purple" },
            { slug: "expense-categories", title: "تصنيفات المصاريف العامة", description: "إيجار، رواتب، وقود…", icon: Tag01, color: "red" },
        ],
    },
    {
        title: "الحاويات",
        sections: [
            { slug: "shipping-lines", title: "خطوط الشحن", description: "الخطوط وشعاراتها: MSC، Maersk، CMA CGM…", icon: Anchor, color: "blue" },
            { slug: "ports", title: "موانئ التحميل", description: "الموانئ التي تُحمَّل منها الحاويات", icon: MarkerPin01, color: "sky" },
            { slug: "sizes", title: "أحجام الحاويات", description: "الطول والحجم لتقسيم الحاويات المشتركة", icon: Container, color: "orange" },
        ],
    },
    {
        title: "الحماية",
        sections: [
            {
                slug: "restore",
                title: "نقاط الاسترجاع",
                description: "احفظ نسخة من كل بياناتك وارجع إليها، أو ابدأ من جديد",
                icon: ClockRewind,
                color: "teal",
            },
        ],
    },
    {
        title: "هذا الجهاز وحسابي",
        sections: [
            { slug: "display", title: "العرض", description: "حجم الخط على هذا الجهاز", icon: Type01, color: "indigo" },
            { slug: "account", title: "الحساب", description: "تغيير كلمة المرور وتسجيل الخروج", icon: Lock01, color: "gray" },
        ],
    },
];

/** Every settings page, in display order. */
export const SETTINGS_SECTIONS: SettingsSection[] = SETTINGS_GROUPS.flatMap((g) => g.sections);
