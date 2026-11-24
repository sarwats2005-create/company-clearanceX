"use client";

import { useState } from "react";
import { LogOut01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { logoutAction } from "@/features/auth/actions";
import { changePasswordAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";

export function AccountForm({ name, username }: { name: string; username: string }) {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const save = useAction(changePasswordAction, {
        success: "تم تغيير كلمة المرور",
        onSuccess: () => {
            setCurrent("");
            setNext("");
        },
    });
    const err = save.fieldErrors;

    return (
        <div className="flex max-w-xl flex-col gap-8">
            <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-md">
                <dt className="text-tertiary">الاسم</dt>
                <dd className="text-primary">{name}</dd>
                <dt className="text-tertiary">اسم المستخدم</dt>
                <dd className="text-primary">
                    <bdi>{username}</bdi>
                </dd>
            </dl>
            <form
                className="flex flex-col gap-5 border-t border-secondary pt-6"
                onSubmit={(e) => {
                    e.preventDefault();
                    save.run({ current, next });
                }}
            >
                <h3 className="text-md font-semibold text-primary">تغيير كلمة المرور</h3>
                <Input type="password" label="كلمة المرور الحالية" size="lg" autoComplete="current-password" value={current} onChange={setCurrent} isInvalid={!!err.current} hint={err.current} />
                <Input
                    type="password"
                    label="كلمة المرور الجديدة"
                    size="lg"
                    autoComplete="new-password"
                    value={next}
                    onChange={setNext}
                    isInvalid={!!err.next}
                    hint={err.next ?? "8 أحرف على الأقل. سيتم تسجيل خروج الأجهزة الأخرى."}
                />
                <div>
                    <Button type="submit" size="lg" isLoading={save.pending} isDisabled={!current || !next}>
                        تغيير كلمة المرور
                    </Button>
                </div>
            </form>
            <form action={logoutAction} className="border-t border-secondary pt-6">
                <Button type="submit" color="secondary-destructive" size="lg" iconLeading={LogOut01}>
                    تسجيل الخروج
                </Button>
            </form>
        </div>
    );
}
