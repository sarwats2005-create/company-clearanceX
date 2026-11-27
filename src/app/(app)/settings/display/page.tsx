import { cookies } from "next/headers";
import { DisplayForm } from "@/components/app/settings/display-form";
import { SectionShell } from "@/components/app/settings/section-shell";
import { requireSession } from "@/lib/auth";
import { TEXT_SIZE_COOKIE, parseTextSize } from "@/lib/text-size";

export const metadata = { title: "العرض" };

export default async function Page() {
    await requireSession();
    const size = parseTextSize((await cookies()).get(TEXT_SIZE_COOKIE)?.value);
    return (
        <SectionShell title="العرض" description="كبّر الخط إذا كانت القراءة متعبة.">
            <DisplayForm initial={size} />
        </SectionShell>
    );
}
