"use client";

import { LogOut01 } from "@untitledui/icons";
import { IconButton } from "@/components/app/icon-button";
import { Button } from "@/components/base/buttons/button";
import { logoutAction } from "@/features/auth/actions";

export function LogoutIconButton({ onDark = false }: { onDark?: boolean }) {
    return (
        <form action={logoutAction}>
            <IconButton type="submit" icon={LogOut01} label="تسجيل الخروج" tone={onDark ? "onDark" : "default"} />
        </form>
    );
}

export function LogoutButton() {
    return (
        <form action={logoutAction}>
            <Button type="submit" color="secondary" size="lg" iconLeading={LogOut01} className="w-full">
                تسجيل الخروج
            </Button>
        </form>
    );
}
