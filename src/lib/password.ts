/**
 * Password hashing with scrypt (node:crypto). Stored as scrypt$N$r$p$salt$hash (base64).
 *
 * Cost follows the OWASP Password Storage Cheat Sheet minimum for scrypt (one of its equivalent settings:
 * N=2^15, r=8, p=3). Hashes made with older, cheaper settings still verify, and `needsRehash` tells the login
 * to quietly re-hash them with the current cost.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 32768;
const R = 8;
const P = 3;
const KEYLEN = 64;
/** scrypt needs 128·N·r bytes (32 MB here); Node's default cap is 32 MB, so allow headroom. */
const MAXMEM = 96 * 1024 * 1024;
/** Longest password we hash. Stops someone sending megabytes to make the server burn CPU. */
export const MAX_PASSWORD_LENGTH = 256;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
    return new Promise((resolve, reject) =>
        scryptCb(password.normalize("NFKC"), salt, keylen, { maxmem: MAXMEM, ...opts }, (err, key) => (err ? reject(err) : resolve(key))),
    );
}

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
    return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    if (password.length > MAX_PASSWORD_LENGTH) return false;
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, "base64");
    if (!expected.length) return false;
    // Refuse absurd stored parameters instead of letting them exhaust memory.
    if (Number(n) > 1_048_576 || Number(r) > 32 || Number(p) > 16) return false;
    try {
        const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
        return timingSafeEqual(key, expected);
    } catch {
        return false;
    }
}

/** True when a stored hash was made with weaker settings than today's, so it should be re-hashed after a good login. */
export function needsRehash(stored: string): boolean {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return true;
    return Number(parts[1]) < N || Number(parts[2]) < R || Number(parts[3]) < P;
}

/** Common passwords people pick first; refused as a new password. Lower-case, compared case-insensitively. */
const COMMON = new Set([
    "password",
    "password1",
    "password123",
    "1234567890",
    "12345678910",
    "0123456789",
    "qwertyuiop",
    "iloveyou12",
    "aaaaaaaaaa",
    "1111111111",
    "0000000000",
    "123123123123",
    "abcdefghij",
    "abc1234567",
    "admin12345",
    "welcome123",
    "change-me-please",
    "changeme123",
    "07701234567",
]);

/**
 * The rules for a new password, as Arabic error messages (empty list = OK). Follows NIST SP 800-63B:
 * length matters most, no forced symbol rules, but refuse common and guessable choices.
 */
export function passwordProblems(password: string, username?: string): string[] {
    const out: string[] = [];
    const p = password.normalize("NFKC");
    const lower = p.toLowerCase();
    if (p.length < 10) out.push("كلمة المرور يجب أن تكون 10 أحرف على الأقل");
    if (p.length > MAX_PASSWORD_LENGTH) out.push("كلمة المرور طويلة جداً");
    if (COMMON.has(lower) || /^(.)\1+$/.test(p) || /^\d+$/.test(p)) out.push("كلمة المرور سهلة التخمين. أضف حروفاً وكلمات");
    if (username && username.trim().length >= 3 && lower.includes(username.trim().toLowerCase())) out.push("لا تستخدم اسم المستخدم داخل كلمة المرور");
    return out;
}
