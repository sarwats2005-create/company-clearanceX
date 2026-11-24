import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { LedgerError } from "@/features/ledger/post-entry";
import { SplitError } from "@/features/charges/split";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { DomainError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { zodFieldErrors } from "@/lib/zod-errors";

/** Postgres error code (Drizzle puts the driver error in `cause`). */
export function pgCode(err: unknown): string | undefined {
    const e = err as { code?: string; cause?: { code?: string } };
    return e?.cause?.code ?? e?.code;
}

function pgConstraint(err: unknown): string | undefined {
    const e = err as { constraint?: string; cause?: { constraint?: string } };
    return e?.cause?.constraint ?? e?.constraint;
}

export { zodFieldErrors };

/**
 * Runs the body of a server action and turns any failure into an Arabic ActionResult.
 * Next.js redirects/notFound are re-thrown untouched.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
    try {
        return ok(await fn());
    } catch (err) {
        unstable_rethrow(err);
        if (err instanceof ZodError) {
            const fieldErrors = zodFieldErrors(err);
            return fail(Object.values(fieldErrors)[0] ?? t("error.required"), fieldErrors);
        }
        if (err instanceof DomainError) return fail(err.message, err.field ? { [err.field]: err.message } : undefined);
        if (err instanceof SplitError) {
            if (err.code === "zero_weight") return fail(t("error.shareZero"));
            if (err.code === "manual_mismatch") return fail(t("error.manualSplitTotal", { total: "", remaining: err.remaining ?? "" }));
            return fail(t("error.server"));
        }
        if (err instanceof LedgerError) {
            if (err.code === "already_cancelled") return fail("هذه الحركة ملغاة مسبقاً");
            console.error("[ledger]", err);
            return fail(t("error.server"));
        }
        if (pgCode(err) === "23505") {
            if (pgConstraint(err) === "containers_container_number_unique") return fail(t("error.duplicateContainer"), { containerNumber: t("error.duplicateContainer") });
            return fail("هذا الاسم أو الرقم موجود مسبقاً");
        }
        console.error("[action]", err);
        return fail(t("error.server"));
    }
}
