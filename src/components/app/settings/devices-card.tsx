"use client";

import { Laptop01, LogOut01, Phone01, ShieldTick } from "@untitledui/icons";
import { CardTitle, IconTile } from "@/components/app/icon-tile";
import { Button } from "@/components/base/buttons/button";
import { signOutDeviceAction, signOutOtherDevicesAction } from "@/features/settings/actions";
import { useAction } from "@/hooks/use-action";
import { formatDateTime } from "@/lib/format";

export interface DeviceRow {
    id: string;
    userAgent: string | null;
    ip: string | null;
    lastSeenAt: string;
    createdAt: string;
    isCurrent: boolean;
}

/** A plain name for a browser's user-agent text: "هاتف آيفون · Safari", "كمبيوتر ويندوز · Chrome". */
export function deviceName(ua: string | null): { name: string; phone: boolean } {
    const u = ua ?? "";
    const phone = /iPhone|Android.+Mobile|Mobile/i.test(u);
    const os = /iPhone|iPad/i.test(u)
        ? phone
            ? "هاتف آيفون"
            : "آيباد"
        : /Android/i.test(u)
          ? phone
              ? "هاتف أندرويد"
              : "جهاز أندرويد"
          : /Windows/i.test(u)
            ? "كمبيوتر ويندوز"
            : /Mac OS X|Macintosh/i.test(u)
              ? "كمبيوتر ماك"
              : /Linux/i.test(u)
                ? "كمبيوتر لينكس"
                : "جهاز غير معروف";
    const browser = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "";
    return { name: browser ? `${os} · ${browser}` : os, phone };
}

/**
 * "الأجهزة المسجّل دخولها": every device signed in as the owner. If a phone is lost or someone else used the
 * account, he can sign that device out, or all the others at once.
 */
export function DevicesCard({ devices }: { devices: DeviceRow[] }) {
    const one = useAction(signOutDeviceAction, { success: "تم تسجيل خروج الجهاز" });
    const others = useAction(signOutOtherDevicesAction, { success: (d) => (d.count ? `تم تسجيل خروج ${d.count} من الأجهزة الأخرى` : "لا توجد أجهزة أخرى") });
    const otherCount = devices.filter((d) => !d.isCurrent).length;
    // The current device first, then the most recently used; long lists are summarised.
    const SHOWN = 8;
    const ordered = [...devices.filter((d) => d.isCurrent), ...devices.filter((d) => !d.isCurrent)];
    const shown = ordered.slice(0, SHOWN);
    const hidden = ordered.length - shown.length;

    return (
        <section aria-labelledby="devices-title" className="surface flex max-w-2xl flex-col gap-4 p-5 md:p-6">
            <CardTitle
                id="devices-title"
                icon={ShieldTick}
                color="green"
                title="الأجهزة المسجّل دخولها"
                hint="إذا رأيت جهازاً لا تعرفه، سجّل خروجه ثم غيّر كلمة المرور."
            />
            <ul className="flex flex-col divide-y divide-secondary">
                {shown.map((d) => {
                    const { name, phone } = deviceName(d.userAgent);
                    return (
                        <li key={d.id} className="flex min-h-18 flex-wrap items-center gap-3 py-3">
                            <IconTile icon={phone ? Phone01 : Laptop01} color={d.isCurrent ? "green" : "gray"} size="md" />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="flex flex-wrap items-center gap-2 text-md font-semibold text-primary">
                                    {name}
                                    {d.isCurrent && (
                                        <span className="rounded-full bg-success-primary px-2 py-0.5 text-xs font-semibold text-success-primary">هذا الجهاز</span>
                                    )}
                                </span>
                                <span className="text-sm text-tertiary">
                                    آخر استخدام <bdi className="num">{formatDateTime(new Date(d.lastSeenAt))}</bdi>
                                    {d.ip && (
                                        <>
                                            {" · "}
                                            <bdi className="num">{d.ip}</bdi>
                                        </>
                                    )}
                                </span>
                            </div>
                            {!d.isCurrent && (
                                <Button size="md" color="secondary-destructive" iconLeading={LogOut01} isLoading={one.pending} onClick={() => one.run(d.id)}>
                                    تسجيل خروج
                                </Button>
                            )}
                        </li>
                    );
                })}
            </ul>
            {hidden > 0 && <p className="text-sm text-tertiary">و{hidden} أجهزة أقدم لم تُعرض هنا.</p>}
            {otherCount > 0 && (
                <Button size="lg" color="secondary-destructive" iconLeading={LogOut01} isLoading={others.pending} onClick={() => others.run()} className="self-start">
                    تسجيل الخروج من كل الأجهزة الأخرى ({otherCount})
                </Button>
            )}
        </section>
    );
}
