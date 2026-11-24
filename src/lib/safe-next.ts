const BASE = "http://app.invalid";

/**
 * Where login sends the owner back to: a page of this app only. The text is read the way a browser reads it
 * (backslashes become slashes, tabs and new lines are dropped), so "/\evil.com" or "/\t/evil.com" cannot leave.
 */
export function safeNext(next: FormDataEntryValue | null): string {
    const s = typeof next === "string" ? next : "";
    if (!s.startsWith("/")) return "/";
    try {
        const url = new URL(s, BASE);
        return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : "/";
    } catch {
        return "/";
    }
}
