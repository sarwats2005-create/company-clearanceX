"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/**
 * Calls a server action, shows the Arabic toast, and keeps field errors for the form.
 * Typed data stays in the form when it fails (PRD §8.12).
 */
export function useAction<A extends unknown[], T>(action: (...args: A) => Promise<ActionResult<T>>, opts: { success?: string | ((data: T) => string); onSuccess?: (data: T) => void } = {}) {
    const [pending, startTransition] = useTransition();
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const { success, onSuccess } = opts;

    const run = useCallback(
        (...args: A) =>
            new Promise<ActionResult<T>>((resolve) => {
                startTransition(async () => {
                    let result: ActionResult<T>;
                    try {
                        result = await action(...args);
                    } catch {
                        result = { ok: false, message: "حدث خطأ. لم يتم حفظ أي شيء. حاول مرة أخرى." };
                    }
                    if (result.ok) {
                        setFieldErrors({});
                        setError(null);
                        const msg = typeof success === "function" ? success(result.data) : success;
                        if (msg) toast.success(msg);
                        onSuccess?.(result.data);
                    } else {
                        setFieldErrors(result.fieldErrors ?? {});
                        setError(result.message);
                        toast.error(result.message);
                    }
                    resolve(result);
                });
            }),
        [action, success, onSuccess],
    );

    return { run, pending, fieldErrors, error, setFieldErrors, clear: () => (setFieldErrors({}), setError(null)) };
}
