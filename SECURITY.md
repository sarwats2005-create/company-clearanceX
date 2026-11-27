# Security

How the app protects the business data, what was checked, and the few settings only the owner can switch on.
Last full review: 2026-11-27, against the OWASP Top 10:2025, OWASP ASVS, the OWASP cheat sheets (sessions,
passwords, CSRF, headers, CSV injection), the Next.js 16 security guides, and Neon's security guidance.

## Contents
1. What protects the data (in the code)
2. What the review found and fixed
3. Owner to-do list (settings only you can change)
4. Rules for future changes
5. Reporting a problem
6. Sources

## 1. What protects the data

**Who can get in**
- One owner login. Passwords are hashed with scrypt at OWASP's minimum cost (N=2^15, r=8, p=3). Older hashes are upgraded automatically at the next login. Passwords are never stored or logged in plain text, and the database refuses any password value that isn't a hash.
- New passwords: at least 10 characters. Common, all-digit, one-repeated-character passwords and passwords containing the username are refused (NIST SP 800-63B).
- Login limits (15 minutes): 5 failures per username + IP, **20 per username from any IP**, 30 per IP for any username. Changing the password counts as a login attempt too. A wrong username and a wrong password take the same time and give the same message.

**Staying signed in**
- Session tokens are 32 random bytes. Only their SHA-256 is stored, so a database leak doesn't give working logins.
- Cookie: `__Host-cc_session` in production. It is HttpOnly (scripts can't read it), Secure (HTTPS only), SameSite=Lax, and the `__Host-` prefix means no other site or subdomain can set it.
- Sessions end after 30 days at most. They also end after 14 days unused with "تذكرني", or 12 hours unused without it.
- Settings → الحساب lists every signed-in device (type, browser, IP, last use). You can sign out one device or all the others. Changing the password signs out every other device.

**What each request may do**
- Every page, every server action (34 of them) and every Excel export checks the session on the server first. The proxy redirect is only a convenience, never the protection (OWASP: CVE-2025-29927 showed middleware-only checks can be bypassed).
- Server actions are POST-only with Next.js's built-in Origin check against cross-site requests. Every input is validated with zod and has length limits.
- All database queries are parameterized (Drizzle), so there's no SQL injection. The code has no raw HTML injection or `eval`.

**In the browser**
- Content-Security-Policy with a fresh nonce on every request. Only the app's own scripts run, so an injected script is refused. The app can't be framed by another site, can't post forms elsewhere, and can't load code from other sites.
- HSTS (HTTPS only, 2 years), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` (record ids in our page addresses aren't sent to WhatsApp or Google), `Permissions-Policy` (no camera, microphone, location or payments), cross-origin isolation headers, and no `X-Powered-By`.
- `Cache-Control: no-store` on every page and export, so business data isn't kept in browser or proxy caches.

**In the database**
- Money records can't be rewritten: ledger lines and charge splits can't be changed or deleted, journal entries can't be deleted (only cancelled with a reversal), and every entry must balance per currency. These are Postgres triggers, so they hold even for someone with direct database access.
- **The audit log can't be changed or deleted** (new trigger).
- 15 CHECK rules refuse impossible values: negative or two-sided ledger lines, zero/negative charges and rates, receipt numbers below 1, negative quantities and weights, oversized or non-image logos, malformed usernames, session ids or password hashes. They were added `NOT VALID` and then validated, so a deploy can never fail on old rows.
- Queries time out after 30 seconds. A transaction left open is closed after 60 seconds, and a lost connection doesn't crash the server.
- **Restore points** (Settings → نقاط الاسترجاع): the database itself makes each copy, checks it with a SHA-256 checksum before restoring, and saves an automatic copy before every restore or fresh start. "Start fresh" is refused unless the owner saved a point that same day, and today's point can't be deleted. Restore and start fresh ask for the password again (wrong tries count toward the login limits). Logins, devices and the audit log are never copied or wiped. The app's restricted user can't write points or empty tables itself; it can only call these guarded functions.
- A ready-made **restricted database user** (`scripts/sql/create-app-role.sql`): the running app gets data access only, can't drop or alter tables or remove the safety triggers, and can only add to history. Turning it on is in the owner to-do list below.

**Data that goes out**
- Excel exports write values as text cells, which spreadsheets never run as formulas (no CSV/formula injection).
- WhatsApp pictures are drawn in the browser. Nothing is uploaded to any service.
- Shipping-line logos: only the line's website domain goes to Google's icon service, never business data. Uploaded logos are re-drawn small in the browser, and the server accepts only PNG, JPEG or WebP data under ~150 KB (no SVG, which can carry scripts).

**Supply chain**
- Dependencies are locked by `pnpm-lock.yaml`. `pnpm audit:deps` checks for known problems: 0 known vulnerabilities at the last review, after pinning patched versions of `uuid` and `postcss-selector-parser`.

## 2. What the review found and fixed

| # | Finding (OWASP 2025 category) | Fix |
| --- | --- | --- |
| 1 | No browser security headers at all: no CSP, HSTS, framing protection or nosniff (A02 Security Misconfiguration) | Nonce CSP in `src/proxy.ts`, other headers in `next.config.mjs`, `poweredByHeader: false` |
| 2 | Login limit counted only username + IP, and trusted a client-supplied `CF-Connecting-IP`, so rotating or faking IPs gave unlimited guesses (A07 Authentication Failures) | Separate per-username and per-IP limits. Cloudflare's header is trusted only with `TRUST_CLOUDFLARE=1` |
| 3 | Sessions had no idle timeout, no device list and no way to sign out a lost phone (A07) | Idle timeouts, last-seen tracking, device list, sign out one or all other devices |
| 4 | Password hashing below the OWASP minimum cost; 8-character minimum with no common-password check (A04 Cryptographic Failures / A07) | Stronger scrypt with automatic upgrade at login; 10+ characters with guessable passwords refused |
| 5 | Changing the password had no guessing limit (A07) | Same limits as login |
| 6 | Audit log could be edited or deleted (A09 Logging & Alerting Failures) | Append-only trigger |
| 7 | No database-level checks on values (A06 Insecure Design) | 15 CHECK constraints |
| 8 | App connects as the database owner (A01 Broken Access Control / least privilege) | Restricted-user script and a startup warning while the owner is used |
| 9 | Two pages queried data before checking the session (A01) | Session check first |
| 10 | Two moderate dependency advisories (A03 Supply Chain Failures) | Patched versions pinned with overrides |
| 11 | No query or transaction timeouts, and a dropped DB connection could crash the server (A10 Mishandling of Exceptional Conditions) | Pool timeouts and an error handler |
| 12 | Login didn't cap input length, so huge passwords could waste CPU (A10) | Capped at 256 characters before hashing |

## 3. Owner to-do list (settings only you can change)

Do these once. ★ = most important.

1. ★ **Turn on two-step login (2FA)** on every account that can reach the app or its data: GitHub, Railway, Neon, Cloudflare and the email that receives their password resets. Anyone who gets into one of these gets the data, whatever the app does.
2. ★ **Backups (Neon).** Restore points live inside the same database, so they protect against mistakes, not against losing the database. Use a Neon plan with a long restore window (7–30 days of point-in-time restore), and once a month create a named branch as a snapshot (Neon → Branches → Create branch). Once, test restoring to a branch before you ever need it.
3. ★ **Restricted database user.** In Neon's SQL Editor, as the owner, run `scripts/sql/create-app-role.sql` with your own long random password. In Railway, set `DATABASE_URL` to the **pooled** string with user `clearance_app` and that password. Keep `DATABASE_URL_UNPOOLED` as the owner's direct string (used only to update tables at start). The startup warning "the app connects as the database owner" disappears when it's done.
4. **Cloudflare.** Since the domain goes through Cloudflare, set `TRUST_CLOUDFLARE=1` in Railway so login limits see the real visitor IP. In Cloudflare: SSL/TLS mode **Full (strict)**, "Always Use HTTPS" on. Better still, disable the public `*.up.railway.app` address in Railway (Settings → Networking) so the app is reachable only through Cloudflare.
5. **Neon IP allow-list** (paid plans): allow only Railway's outbound addresses. Never `0.0.0.0/0`.
6. **Secrets.** Database passwords and `OWNER_PASSWORD` live only in Railway variables, never in the code or in chats. If one ever leaks, reset it in Neon or Railway at once.
7. **Use a strong app password** (10+ characters, several words) and change it from Settings → الحساب. Check the device list there now and then.
8. **After this update deploys, everyone signs in once more.** The login cookie got its new secure name, so old sign-ins end. This is expected.

## 4. Rules for future changes
- Every new server action starts with `await requireSession()` and validates its input with zod. Treat it as a public POST endpoint.
- Never use `sql.raw`, `dangerouslySetInnerHTML` or `eval`. Never put secrets in code or in `NEXT_PUBLIC_*` variables.
- New external images or scripts must be added to the CSP in `src/proxy.ts` deliberately. Never add `'unsafe-inline'` to `script-src`.
- New money tables get the same immutability triggers. New value rules go into `src/db/sql/0002_hardening.sql` via `cc_add_check`.
- Run `pnpm audit:deps`, `pnpm test` and `pnpm build` before every deploy.
- A new table goes into `cc_restore_tables()` in `src/db/sql/0003_restore_points.sql` (or, if it holds logins or history, into the excluded list in `tests/integration/restore.test.ts`).
- Use the `security-review` skill on every branch before merging.

## 5. Reporting a problem
If you think something is wrong (a login you don't recognise, a device you don't know, numbers that changed):
1. Settings → الحساب → "تسجيل الخروج من كل الأجهزة الأخرى", then change the password.
2. Change the Railway and Neon passwords.
3. Look at the audit log in Neon's SQL Editor: `select * from audit_log order by at desc limit 100;`

## 6. Sources
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/)
- [OWASP Next.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html), [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP ASVS 4.0.3 V3 Sessions](https://github.com/OWASP/ASVS/blob/v4.0.3/4.0/en/0x12-V3-Session-management.md), [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- [Next.js: Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy) (also in `node_modules/next/dist/docs`), [MDN: session management](https://developer.mozilla.org/en-US/docs/Web/Security/Authentication/Session_management)
- [Neon security overview](https://github.com/neondatabase/website/blob/main/content/docs/security/security-overview.md), [Postgres security best practices](https://www.bytebase.com/reference/postgres/how-to/postgres-security-best-practices/)
- [NIST SP 800-63B sessions](https://pages.nist.gov/800-63-4/sp800-63b/session)
