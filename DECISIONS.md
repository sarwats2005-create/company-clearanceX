# Decisions log

Choices made while building, so the owner and the next developer know *why*.
Product decisions waiting for the owner are in `docs/PRD.md` §17.

## Architecture
1. **Auth is a small first-party module, not Better Auth.** Single owner login, so: scrypt password hash (`node:crypto`), a random 32-byte session token in an httpOnly cookie `cc_session` (30 days), stored in the `sessions` table only as its SHA-256. Login is rate-limited to 5 failures per 15 minutes per username + IP (`login_attempts`). Fewer moving parts, same security properties.
2. **Strings live in `src/messages/ar.json` with a typed `t(key, vars)` helper instead of next-intl.** The app is Arabic-only with no locale routing, so a library adds nothing. Every user-facing string is still in one file.
3. **Untitled UI MCP/CLI could not be reached from the build machine.** The free components already in the starter kit cover the needs. Missing pieces (status steps, bottom nav, segmented control, sidebar in the "elegant" style) are in `src/components/app/` and use the same tokens.
4. **Visual direction = IMAGE_PROMPTS.md Part F ("elegant pass")**: white surfaces, hairline dividers instead of boxes, one navy button per screen, two font weights (600/400, 500 for big figures), IBM Plex Sans Arabic + IBM Plex Mono for container numbers, brass accent `#B88A44` only on the logo and the active-nav marker. The sidebar is custom (not `SidebarNavigationSimple`) to get this look.
5. **Status is shown as a colored dot + text**, not icon badges (Part F). `Ship01`/`Navigation` icons do not exist in `@untitledui/icons` 0.0.23, which this also avoids.
6. **Reports are hidden from navigation until Phase 2** instead of showing an empty page.
7. **Locale** for React Aria and `Intl` is `ar-IQ-u-ca-gregory-nu-latn`: Arabic (Iraq), Gregorian calendar, Latin digits. Iraqi month names come from our own list in `ar.json` (tested), not from ICU.

## RTL conversion of the kit
- `scripts/rtl-codemod.mjs` converted 393 physical classes in `src/components` to logical ones (`pl→ps`, `left→start`, `rounded-l→rounded-s`, `text-left→text-start`, …). `pnpm lint` re-checks it.
- Kept physical on purpose: `left-1/2` paired with `-translate-x-1/2` (centering; converting would break it).
- Hand fixes: the toggle thumb moves with `rtl:-translate-x-*`; calendar and pagination arrows are swapped so "previous" points right; the submenu chevron is mirrored; slideouts open from the start side (right); dropdowns default to `bottom end` placement.
- Motion (emil-design-eng): custom `ease-smooth` = `cubic-bezier(0.23,1,0.32,1)`, exits faster than entries, no `ease-in`, every button scales to 0.97 while pressed (off with reduced motion).

## Database
- Money `numeric(18,2)` read as strings; all math with `decimal.js` (`src/lib/money.ts`).
- Integrity in Postgres (`src/db/sql/0001_triggers.sql`): balanced entries per currency (deferred constraint trigger), insert-only lines and allocations, entries can only be cancelled, line currency = account currency, vault accounts only in currencies the vault accepts.
- `accounts` unique key uses `NULLS NOT DISTINCT` so system accounts with no `ref_id` (fee income, FX, owner equity) are never duplicated.
- `container_charges.is_fee` is a snapshot of the charge type at posting time, so later changes in Settings don't rewrite history.
- `journal_entries` has a headline `amount`/`currency` and a `meta` JSON for receipt display (from/to labels, the other side of an exchange). Balances never read them; they come from `journal_lines` only.
- `journal_lines.memo` carries per-line notes such as "حصتك 4 م من 9.5 م" for shared containers.
