import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormPageHeader } from "@/components/app/form-page-header";
import { MoneyForm } from "@/components/app/money/money-form";
import { MONEY_KIND_META } from "@/components/app/money/money-kinds";
import { db } from "@/db";
import { KIND_BY_SLUG } from "@/features/money/form-model";
import { getMoneyFormOptions } from "@/features/money/queries";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/format";

type Params = Promise<{ action: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const kind = KIND_BY_SLUG[(await params).action];
    return { title: kind ? MONEY_KIND_META[kind].title : "المالية" };
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function NewMoneyPage({ params, searchParams }: { params: Params; searchParams: Search }) {
    await requireSession();
    const kind = KIND_BY_SLUG[(await params).action];
    if (!kind) notFound();
    const sp = await searchParams;
    const options = await getMoneyFormOptions(db);
    const meta = MONEY_KIND_META[kind];
    return (
        <>
            <FormPageHeader parent={{ href: "/money", label: "المالية" }} title={meta.title} description={meta.hint} />
            <MoneyForm
                key={kind}
                kind={kind}
                options={options}
                today={todayISO()}
                prefill={{ trader: one(sp.trader), party: one(sp.party), vault: one(sp.vault), currency: one(sp.currency) }}
            />
        </>
    );
}
