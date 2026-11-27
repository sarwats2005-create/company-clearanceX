"use client";

import { type FormEvent, startTransition, useActionState, useState } from "react";
import { AlertCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { type LoginState, loginAction } from "@/features/auth/actions";

export function LoginForm({ next }: { next: string }) {
    const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
    const [remember, setRemember] = useState(true);

    // Dispatch by hand so React does not reset the form after a failed try (React Aria would then
    // clear the username too). `action` stays on the form for logins before the JS has loaded.
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
    };

    return (
        <form action={action} onSubmit={onSubmit} className="flex flex-col gap-5">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="remember" value={remember ? "on" : "off"} />
            <Input name="username" label="اسم المستخدم" size="lg" autoComplete="username" isRequired autoFocus />
            <Input name="password" type="password" label="كلمة المرور" size="lg" autoComplete="current-password" isRequired />
            <Checkbox size="md" label="تذكرني على هذا الجهاز" isSelected={remember} onChange={setRemember} />
            {state.error && (
                <p role="alert" className="flex items-center gap-2 text-md text-error-primary">
                    <AlertCircle className="size-5 shrink-0" />
                    {state.error}
                </p>
            )}
            <Button type="submit" size="xl" isLoading={pending} showTextWhileLoading className="w-full">
                {pending ? "جارٍ الدخول…" : "دخول"}
            </Button>
        </form>
    );
}
