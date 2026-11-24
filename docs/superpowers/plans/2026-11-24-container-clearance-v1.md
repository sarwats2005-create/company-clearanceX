# Container Clearance Manager v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Arabic RTL container clearance web app defined in `docs/PRD.md` v2.1, starting from the Untitled UI Next.js starter kit.

**Architecture:** One Next.js 16 App Router app. Server Components read through `src/features/*/queries.ts`; Server Actions in `src/features/*/actions.ts` validate with Zod and call `service.ts` functions that run inside one Postgres transaction. All money goes through one double-entry ledger (`src/features/ledger`). The UI is Untitled UI React components converted to logical (RTL) classes, styled with the "elegant pass" from `docs/IMAGE_PROMPTS.md` Part F.

**Tech Stack:** Next.js 16.4, React 19.3, TypeScript 6, Tailwind 4.3, React Aria, @untitledui/icons, Drizzle ORM 0.45 + drizzle-kit, pg, Zod 4, decimal.js, sonner, Vitest 5, Postgres 16 (Neon in production).

**Spec:** `docs/PRD.md` (v2.1) + `docs/IMAGE_PROMPTS.md` Part F (visual direction) + `docs/mockups/*`.

## Global Constraints
- Only 3 required container fields: container number, shipping line, trader(s) (PRD §5.2).
- Container number normalized `trim → uppercase → strip spaces/dashes`, unique index (PRD §5.2).
- Money never as JS `number`: `numeric(18,2)` in DB, strings in TS, `decimal.js` for math; IQD rounds to 0 dp, USD to 2 dp (PRD §6.3).
- Every money movement = one `journal_entries` row + balanced `journal_lines` per currency, in one transaction; lines immutable (DB triggers) (PRD §6.1, §12.3).
- Receipt numbers `{prefix}-{6 digits}` from row-locked `receipt_sequences`; prefixes ق/ص/ت/ع (PRD §6.5).
- UI shows عليه (red) / له (green) / مسدد (gray), never debit/credit (PRD §6.1).
- `<html lang="ar" dir="rtl">`; no physical direction classes in `src/components` (PRD §10.2).
- Semantic color classes only; navy brand scale from PRD §10.3; accent `#B88A44` only on logo mark and active-nav marker (IMAGE_PROMPTS F3).
- One primary (navy) button per screen; two font weights (600/400); hairline dividers over boxes (IMAGE_PROMPTS F3).
- Dates `dd/MM/yyyy`, Latin digits; written months use Iraqi names (PRD §10.5 item 9).
- Root font-size from text-size cookie: 100% / 112.5% (default) / 125%.
- Animations: transform/opacity only, ≤ 250 ms, custom ease-out `cubic-bezier(0.23,1,0.32,1)`, buttons `:active scale(0.97)`, respect `prefers-reduced-motion` (emil-design-eng).

## Decisions taken while planning (recorded in `DECISIONS.md`)
1. **Auth:** a small first-party session module (scrypt hash via `node:crypto`, random 32-byte token stored as SHA-256 in `sessions`, httpOnly cookie `cc_session`, 30 days) instead of Better Auth. Fewer moving parts for a single-owner app; same security properties. Login rate limit kept in a `login_attempts` table (5 per 15 min per username+IP).
2. **i18n:** `src/messages/ar.json` + a typed `t(key, vars)` helper instead of next-intl (Arabic only, no locale routing needed). Strings still live in one file.
3. **Untitled UI MCP/CLI** is blocked from this build machine's network; the free components already in the starter kit cover every need. Missing pieces (progress steps, bottom nav, segmented control) are built in `src/components/app/` with the same tokens.

## Review Focus
1. **A shared container whose shares are all zero or blank.** Expect a field error "الحصة يجب أن تكون أكبر من صفر", never a divide-by-zero. Owner: Task 3 (`splitAmount` test `rejects zero total weight`).
2. **Amounts typed with Arabic-Indic digits or commas ("٢٬٤٠٠", "2,400").** Expect them parsed to "2400.00". Owner: Task 2 (`parseAmount` tests).
3. **The same container number typed with a different case or spaces ("mscu 482917-5").** Expect a duplicate error, not a second container. Owner: Task 6 (service test `normalizes before unique check`).
4. **Two receipts saved at the same moment.** Expect two consecutive unique numbers. Owner: Task 4 (concurrency test).
5. **Paying a vault more than its balance.** Expect the negative-balance warning before saving, with the save still allowed after confirmation. Owner: Task 8 (`willGoNegative` test).

---

### Task 1: Foundation (RTL, theme, fonts, shell, DB wiring)
**Files:** Create `scripts/rtl-codemod.mjs`, `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `src/db/sql/0001_triggers.sql`, `src/lib/i18n.ts`, `src/messages/ar.json`, `src/components/app/*` (shell pieces), `src/app/(app)/layout.tsx`, `.env.example`, `vitest.config.ts`. Modify `src/styles/theme.css`, `src/app/layout.tsx`, `src/providers/theme.tsx`, `package.json`.
**Interfaces — Produces:** `db` (drizzle node-postgres), `withTx(fn)`, all tables/enums of PRD §12 (+ `sessions`, `login_attempts`), `t(key, vars?)`.
- [ ] Codemod run: `node scripts/rtl-codemod.mjs src/components` prints before/after counts; then `grep -rEn "(^|[ \"'\`:])-?(pl|pr|ml|mr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right)(-|\b)" src/components` returns nothing.
- [ ] `pnpm typecheck` passes; `pnpm db:migrate` applies schema + triggers to local Postgres.
- [ ] Commit `feat(m1): foundation`.

### Task 2: Money, digits, formatting, tafqeet, container number (TDD)
**Files:** `src/lib/money.ts`, `src/lib/format.ts`, `src/lib/tafqeet.ts`, `src/lib/container-number.ts`, tests in `tests/unit/*.test.ts`.
**Produces:** `parseAmount(input: string, currency: Currency): string | null`, `roundTo(amount: string, currency): string`, `formatMoney(amount: string, currency, opts?)`, `formatDate(d: Date|string)`, `iraqiMonth(i)`, `toArabicWords(amount: string, currency): string`, `normalizeContainerNumber(s): string`, `isIso6346(s): boolean`.
- [ ] Tests: `parseAmount("٢٬٤٠٠","USD")==="2400.00"`, `parseAmount("2,400","IQD")==="2400"`, `parseAmount("abc","USD")===null`, `parseAmount("-5","USD")===null`; `formatMoney("3144000","IQD")==="3,144,000 د.ع"`, `formatMoney("2400.00","USD")==="2,400 $"`, `formatMoney("2400.5","USD")==="2,400.50 $"`; `toArabicWords("2400","USD")` = "ألفان وأربعمائة دولار أمريكي لا غير", `toArabicWords("3144000","IQD")` = "ثلاثة ملايين ومائة وأربعة وأربعون ألف دينار عراقي لا غير", `toArabicWords("0","IQD")` = "صفر دينار عراقي لا غير", `toArabicWords("2400.50","USD")` = "ألفان وأربعمائة دولار أمريكي وخمسون سنتاً لا غير"; `normalizeContainerNumber(" mscu 482917-5 ")==="MSCU4829175"`, `isIso6346("MSCU4829175")===true`.
- [ ] Run → fail; implement; run → pass. Commit.

### Task 3: splitAmount (TDD)
**Files:** `src/features/charges/split.ts`, `tests/unit/split.test.ts`.
**Produces:** `splitAmount(total: string, currency: Currency, shares: {traderId: string; weight: string}[], mode: "by_share"|"single_trader"|"manual"|"equal", opts?: {traderId?: string; manual?: Record<string,string>}): {traderId: string; amount: string}[]` — throws `SplitError` with code `zero_weight | manual_mismatch | unknown_trader`.
- [ ] Tests: PRD §5.6 rows exactly (842.11/1157.89; 54737/75263; 126.32/173.68); `100 USD equal 3 ways → 33.34, 33.33, 33.33`; leftover goes to largest share (tie → first row); manual sum ≠ total → `manual_mismatch`; zero weights → `zero_weight`; single_trader puts everything on that trader. Commit.

### Task 4: Ledger core (TDD against Postgres `clearance_test`)
**Files:** `src/features/ledger/{accounts,post-entry,reverse-entry,postings,balances,statements,receipt-numbers}.ts`, `tests/integration/ledger.test.ts`, `tests/helpers/db.ts`.
**Consumes:** schema, `splitAmount`. **Produces:** `postEntry(tx, PostEntryInput): Promise<{entryId; receiptNo: string|null}>`, `reverseEntry(tx, entryId, reason, date): Promise<{entryId; receiptNo}>`, `getBalances(db, kind, refId): Promise<{IQD: string; USD: string}>`, `getStatement(db, ref, currency, from?, to?)`, posting builders `postings.containerCharge / receiveFromTrader / receiveFromTraderFx / payParty / payTrader / receiveFromParty / deposit / withdraw / transfer / exchange / generalExpense / opening`.
- [ ] Tests: every posting balanced per currency; PRD §5.5 example ends trader 0 / China 0 / UmmQasr 0 / fee income 300 / USD vault 300; PRD §5.6 shared example balances; FX receive 3,144,000 IQD @1310 clears 2,400 USD; reversal restores balances and gets its own number; 20 concurrent posts → numbers 1..20 unique; DB rejects unbalanced entry, UPDATE/DELETE on lines, currency mismatch. Commit.

### Task 5: Auth + settings
**Files:** `src/lib/auth.ts`, `src/app/(auth)/login/*`, `src/proxy.ts`, `src/features/settings/*`, `src/app/(app)/settings/**`, `src/db/seed.ts`.
**Produces:** `requireSession(): Promise<{userId; name}>`, `getSession()`, `login(username, password, ip)`, `logout()`.
- [ ] Test: password hash verify; rate limit after 5 failures. Seed is idempotent (run twice → same row counts). Settings pages for charge types (7 seeded, order), parties, shipping lines, ports, sizes (length/volume), expense categories, receipts, rate, display. Commit.

### Task 6: Containers (form §8.5, list, page, status, shares)
**Files:** `src/features/containers/*`, `src/app/(app)/containers/**`, `src/components/app/container-form/*`.
**Produces:** `createContainer(input)`, `updateContainer(id, input)`, `changeStatus(id, to, date, note?)`, queries `listContainers(filters)`, `getContainer(id)`.
- [ ] Tests: normalizes before unique check; shared shares saved; status skip/back rules. Form built exactly per PRD §8.5 spacing table. Commit.

### Task 7: Charges slideout + split preview + cancel/re-split
**Files:** `src/features/charges/{service,actions}.ts`, `src/components/app/charges-sheet.tsx`.
- [ ] Tests: addCharges posts one entry per charge with allocations summing to amount; cancelCharge reverses. Commit.

### Task 8: Money actions, receipts, journal
**Files:** `src/features/money/*`, `src/app/(app)/money/**`, `src/app/print/receipt/[id]/page.tsx`.
- [ ] Tests: each action builds the PRD §6.3 lines; `willGoNegative`. Commit.

### Task 9: Accounts (traders, parties, vaults, statements) + print statement
- [ ] Statement running balance test. Commit.

### Task 10: Home dashboard + global search
- [ ] Query test: counts per status; trigram search finds "4829". Commit.

### Task 11: Polish + verification
- [ ] typecheck, lint, unit+integration tests, `next build`; Playwright screenshots at 390 and 1440 of Home, Container form, Container page, Money, Statement; fix issues. Commit.

### Phase 2 (next plan): reports, Excel import/backup, opening-balances wizard, audit-log viewer, deploy docs (PRD M8, M10).
