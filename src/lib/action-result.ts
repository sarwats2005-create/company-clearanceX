/** What every server action returns (PRD §13.3). Messages are Arabic and shown as-is. */
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({ ok: false, message, fieldErrors });
