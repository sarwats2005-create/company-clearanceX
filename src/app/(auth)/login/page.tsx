import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app/logo";
import { getCompanyName } from "@/features/settings/queries";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    if (await getSession()) redirect("/");
    const { next } = await searchParams;
    const company = await getCompanyName();

    return (
        <main className="flex min-h-dvh items-center justify-center bg-primary px-4 py-12">
            <div className="flex w-full max-w-sm flex-col gap-8">
                <div className="flex flex-col items-center gap-4 text-center">
                    <LogoMark className="size-12" />
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
