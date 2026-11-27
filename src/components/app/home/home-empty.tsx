"use client";

import { Plus } from "@untitledui/icons";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { Button } from "@/components/base/buttons/button";
import { t } from "@/lib/i18n";

/** First run (PRD §8.3): the box illustration and the one navy button on the page. */
export function HomeEmpty() {
    return (
        <EmptyState size="lg" className="border-y border-secondary py-12">
            <EmptyState.Header pattern="none">
                <EmptyState.Illustration type="box" />
            </EmptyState.Header>
            <EmptyState.Content>
                {/* h2, not the kit's h1: the greeting is the page heading. */}
                <h2 className="text-xl font-semibold text-primary">لا توجد حاويات بعد</h2>
                <EmptyState.Description>ابدأ بإضافة أول حاوية. تحتاج فقط رقم الحاوية وخط الشحن والتاجر.</EmptyState.Description>
            </EmptyState.Content>
            <EmptyState.Footer>
                <Button size="lg" iconLeading={Plus} href="/containers/new">
                    {t("action.newContainer")}
                </Button>
            </EmptyState.Footer>
        </EmptyState>
    );
}
