/**
 * Arabic UI strings (PRD §9). Every user-facing string lives in src/messages/ar.json;
 * components read them with t("group.key", { var: value }).
 */
import messages from "@/messages/ar.json";

type Messages = typeof messages;
type Leaves<T, P extends string = ""> = {
    [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends readonly unknown[] ? never : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
    let node: unknown = messages;
    for (const part of key.split(".")) node = (node as Record<string, unknown>)?.[part];
    if (typeof node !== "string") return key;
    if (!vars) return node;
    return node.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export { messages };
