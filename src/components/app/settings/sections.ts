export interface SettingsSection {
    slug: string;
    title: string;
    description: string;
}

/** Settings sub-pages in display order (PRD §8.10; opening balances, import, backup and audit log arrive in Phase 2). */
export const SETTINGS_SECTIONS: SettingsSection[] = [
    { slug: "company", title: "معلومات الشركة", description: "الاسم والهاتف والعنوان ونص أسفل الوصل" },
    { slug: "charge-types", title: "أنواع المصاريف", description: "كمرك، غرامات، أجور نقل، أتعاب… وترتيبها" },
    { slug: "parties", title: "الجهات", description: "شركات التخليص والشركاء الذين يدفعون المصاريف" },
    { slug: "shipping-lines", title: "خطوط الشحن", description: "MSC، Maersk، CMA CGM…" },
    { slug: "ports", title: "موانئ التحميل", description: "الموانئ التي تُحمَّل منها الحاويات" },
    { slug: "sizes", title: "أحجام الحاويات", description: "الطول والحجم لتقسيم الحاويات المشتركة" },
    { slug: "expense-categories", title: "تصنيفات المصاريف العامة", description: "إيجار، رواتب، وقود…" },
    { slug: "receipts", title: "الوصولات", description: "حرف الوصل والرقم التالي" },
    { slug: "vaults", title: "القاصات", description: "القاصة التي تُختار أولاً لكل عملة" },
    { slug: "currency", title: "سعر الصرف والتنبيهات", description: "سعر الدولار الافتراضي وأيام التنبيه" },
    { slug: "display", title: "العرض", description: "حجم الخط على هذا الجهاز" },
    { slug: "account", title: "الحساب", description: "تغيير كلمة المرور وتسجيل الخروج" },
];
