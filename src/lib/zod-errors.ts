import type { ZodError } from "zod";

/** Zod issues → { "shares.1.shareValue": "message" } (first message per field). Used by the server and by forms. */
export function zodFieldErrors(err: ZodError): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        out[key] ??= issue.message;
    }
    return out;
}
