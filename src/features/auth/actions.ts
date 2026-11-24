"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { audit } from "@/features/audit/log";
import { clientIp, login, logout } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export interface LoginState {
    error?: string;
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!username || !password) return { error: "اكتب اسم المستخدم وكلمة المرور" };
    const result = await login(username, password, await clientIp(), form.get("remember") !== "off");
    if (!result.ok) return { error: result.error === "rate_limited" ? "حاول مرة أخرى بعد 15 دقيقة" : "اسم المستخدم أو كلمة المرور غير صحيحة" };
    await audit(db, { table: "users", recordId: result.userId, action: "login", userId: result.userId });
    redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
    await logout();
    redirect("/login");
}
