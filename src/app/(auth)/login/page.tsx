import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app/logo";
import { getCompanyName } from "@/features/settings/queries";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

/** Login: the brand gradient behind one white card. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    if (await getSession()) redirect("/");
    const { next } = await searchParams;
    const company = await getCompanyName();

    return (
        <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-hero px-4 py-12">
            <svg aria-hidden="true" viewBox="0 0 200 120" className="pointer-events-none absolute -start-16 -bottom-10 w-[32rem] opacity-[0.07]">
                <rect x="4" y="4" width="192" height="112" rx="10" fill="none" stroke="white" strokeWidth="5" />
                {[30, 60, 90, 120, 150].map((x) => (
                    <path key={x} d={`M${x} 18v84`} stroke="white" strokeWidth="5" strokeLinecap="round" />
                ))}
            </svg>
            <div className="rise-in relative flex w-full max-w-md flex-col gap-8 rounded-[2rem] bg-primary p-7 shadow-hero sm:p-9">
                <div className="flex flex-col items-center gap-4 text-center">
                    <LogoMark className="size-16" />
                    <div className="flex flex-col gap-1">
                        <h1 className="text-display-xs font-semibold text-primary">{company}</h1>
                        <p className="text-md text-tertiary">ادخل لمتابعة الحاويات والحسابات</p>
                    </div>
                </div>
                <LoginForm next={next ?? "/"} />
            </div>
        </main>
    );
}
