# Master Prompt: Container Clearance Manager

This file has 5 parts:

| Part | What it is | Who uses it |
|---|---|---|
| **0. Setup checklist** | Accounts and commands to run **before** the AI starts | You (10–15 minutes) |
| **1. Master prompt** | The big prompt you paste into your AI coding tool | Paste once |
| **2. Milestone prompts** | 10 short prompts, one per build step | Paste one at a time (step mode) |
| **3. Fix-it prompts** | Ready prompts for the most common problems | When something breaks |
| **4. Final review prompt** | Makes the AI check everything against the PRD | At the end |

**Two ways to build:**
- **One-shot mode:** paste Part 1 and add the line `MODE: ONE-SHOT`. The AI builds all 10 milestones in order and stops only if a check fails. This is fastest, but you see the result only at the end.
- **Step mode (recommended for your first build):** paste Part 1 with `MODE: STEP`, then send the milestone prompts from Part 2 one by one, and open the app after each. You catch mistakes early, and each step costs less to fix.

Works best with **Claude Code**. Cursor and Windsurf also work.

---

## Part 0: Setup checklist (do this first)

### 0.1 Accounts you need (all have free tiers to start)
- [ ] **GitHub** account and an empty private repo, e.g. `container-clearance`.
- [ ] **Neon** (neon.tech): create a project, region close to Iraq (e.g. *AWS Europe Frankfurt*). Copy two connection strings from "Connect":
  - **pooled** (host contains `-pooler`): this becomes `DATABASE_URL`
  - **direct / unpooled**: this becomes `DATABASE_URL_UNPOOLED`
- [ ] **Railway** (railway.app): sign in with GitHub. Don't create the service yet; the AI's last milestone tells you how.
- [ ] **Cloudflare** (cloudflare.com): add your domain (or buy one there). Needed only at the end.

### 0.2 On your computer
You need **Node.js 22** and **pnpm** (`npm i -g pnpm`), plus Git.

```bash
# 1. Get the Untitled UI starter kit as your project
git clone https://github.com/untitleduico/untitledui-nextjs-starter-kit container-clearance
cd container-clearance
rm -rf .git && git init && git branch -M main
git remote add origin https://github.com/<your-user>/container-clearance.git

# 2. Install
pnpm install

# 3. Put the spec files in the project
mkdir -p docs/mockups
#   copy PRD.md            → docs/PRD.md
#   copy client-excel-template.xlsx → docs/client-excel-template.xlsx
#   (optional) copy the mockup images you made with IMAGE_PROMPTS.md → docs/mockups/

# 4. Create .env.local (the AI will create .env.example; fill real values here)
#   DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
#   DATABASE_URL_UNPOOLED=postgresql://.../neondb?sslmode=require
#   BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
#   BETTER_AUTH_URL=http://localhost:3000
#   APP_URL=http://localhost:3000
#   OWNER_USERNAME=admin
#   OWNER_PASSWORD=<a strong password>
#   OWNER_NAME=<owner's name in Arabic>
#   TZ=Asia/Baghdad
```

### 0.3 Connect the Untitled UI MCP (so the AI can fetch components itself)
**Claude Code** (run in the project folder):
```bash
claude mcp add --transport http untitledui https://www.untitledui.com/react/api/mcp
claude mcp list          # should show "untitledui" as connected
```
**Cursor:** create `.cursor/mcp.json`:
```json
{ "mcpServers": { "untitledui": { "url": "https://www.untitledui.com/react/api/mcp" } } }
```
Restart Cursor, then check *Settings → Tools & MCP* shows a green dot.

> Free components need no login. PRO components need an Untitled UI PRO license (`npx untitledui@latest login`). This project only needs the **free** ones.

### 0.4 Start the AI
Open Claude Code in the project folder (`claude`) and paste **Part 1**.

---

## Part 1: Master prompt (copy everything inside the box)

````text
MODE: STEP        ← change to "MODE: ONE-SHOT" to build everything in one go

# ROLE
You are a senior full-stack TypeScript engineer and a careful product designer. You are building a production web application for a real business. You write clean, tested, accessible code and you never guess about money.

# THE PRODUCT
"Container Clearance Manager" (نظام إدارة تخليص الحاويات): an Arabic, right-to-left web app for a container clearance company in Basra, Iraq. It replaces their Excel workbook. It tracks containers by container number through 4 statuses, records charges per container and who paid them, keeps exact IQD and USD balances for traders, parties and vaults with a double-entry ledger, prints numbered receipts and statements, and shows a simple dashboard.

The ONLY user is the company owner: about 50 years old, not technical, reads Arabic, uses a desktop in the office and an Android phone at the port. Every screen must be usable without training. "Simple to use" must NEVER mean "missing features".

# SOURCE OF TRUTH
1. Read `docs/PRD.md` COMPLETELY before writing any code. It defines every screen, field, rule, table and test. Follow it exactly.
2. Read the starter kit's `CLAUDE.md` and follow its conventions (Aria* import prefix, kebab-case files, semantic color classes only, icons as component references, opacity-50 for disabled).
3. This project uses Next.js 16. Its APIs differ from older versions. Before writing routing, caching, middleware/proxy, or Server Action code, read the relevant guides in `node_modules/next/dist/docs/`.
4. If `docs/mockups/` contains images, use them as visual reference for layout and feel (the PRD wins on content).
5. If this prompt and the PRD disagree, follow the PRD and tell me.

# STACK (fixed; do not swap without asking)
- Untitled UI Next.js starter kit (already cloned here): Next.js 16 App Router, React 19.3, TypeScript 6 strict, Tailwind CSS 4.3, React Aria Components, @untitledui/icons, motion, recharts, react-hotkeys-hook
- Untitled UI MCP server "untitledui" is connected. Use `search_components`, `get_component`, `get_component_bundle` and `search_icons` to find and install FREE components (it returns `npx untitledui@latest add <name> --yes` commands; run them). Never write a component from scratch if a free Untitled UI one fits. If `npx untitledui init` is required first, run it and keep the existing files.
- Database: Neon Postgres via Drizzle ORM + drizzle-kit, `pg` driver, pooled URL for the app, unpooled for migrations
- Auth: Better Auth (Drizzle adapter, username plugin, sign-up disabled, single owner)
- Validation: Zod · Money: decimal.js · i18n: next-intl (`messages/ar.json`) · Excel: exceljs · Toasts: sonner (styled with Untitled UI tokens) · Font: IBM Plex Sans Arabic via next/font/google
- Tests: Vitest (unit/integration), Playwright (e2e, RTL)
- Package manager: pnpm · Deploy: Railway (one Node service) behind Cloudflare proxy

# NON-NEGOTIABLE RULES
0. ONLY 3 FIELDS ARE REQUIRED on a container: container number, shipping line, trader (or traders for a shared container). Everything else is optional.
1. CONTAINER NUMBER IS UNIQUE. Normalize (trim, uppercase, strip spaces and dashes) before save and search. DB unique index plus a live "already exists" check in the form with a link to the existing container.
2. DOUBLE-ENTRY LEDGER. Every money movement goes through ONE function, `postEntry()`, in `src/features/ledger/`. It writes one journal_entries row and balanced journal_lines (per currency, debits = credits) inside ONE DB transaction. Balances are ALWAYS computed from lines, never stored, never typed. Use the posting table in PRD §6.3 exactly (A1–A15).
3. IMMUTABLE MONEY. Never UPDATE or DELETE journal lines. Cancelling = `reverseEntry()` (a reversing entry with its own receipt number), plus marking the original cancelled with a reason. Add DB triggers that block updates and deletes (PRD §12.3).
4. CURRENCIES NEVER MIX. Every account exists per currency (IQD main, USD). Cross-currency actions store the user-typed rate and use the FX clearing account exactly as PRD §6.3 A4x/A11 shows. Vaults only accept their allowed currencies.
5. MONEY IS NEVER A JS number. DB numeric(18,2), strings across the wire, decimal.js in logic. IQD rounds to whole dinar, USD to cents.
6. RECEIPT NUMBERS (ق-000123 …) come from a row-locked `receipt_sequences` table (SELECT … FOR UPDATE) inside the same transaction. No gaps, no duplicates.
7. THE USER NEVER SEES "debit/credit". Show عليه (owes us, red) / له (we owe, green) / مسدد (settled, gray). Every status and balance = color + icon + word.
8. ARABIC RTL EVERYWHERE. `<html lang="ar" dir="rtl">`, React Aria `I18nProvider locale="ar-IQ"`. The free Untitled UI components use PHYSICAL direction classes (~290 uses of pl-/pr-/ml-/mr-/left-/right-/border-l/border-r/rounded-l/rounded-r/text-left/text-right, including with md:/lg:/hover: prefixes). Write a codemod script `scripts/rtl-codemod.ts` that converts them to LOGICAL classes (ps-/pe-/ms-/me-/start-/end-/border-s/border-e/rounded-s/rounded-e/text-start/text-end), run it on src/components/**, and re-run it after every `untitledui add`. Mirror directional icons only (arrows, chevrons) with `rtl:-scale-x-100`. Wrap numbers, container numbers, receipt numbers, phones and dates in <bdi> / dir="ltr".
9. LAYERING. Pages read via `features/*/queries.ts` (server-only) and write only via `features/*/actions.ts` ("use server": session check → Zod → service → revalidate → typed result with Arabic messages). `features/*/service.ts` holds business rules inside `db.transaction` and writes the audit log. No Drizzle/SQL in components.
10. ALL UI TEXT lives in `messages/ar.json` (use the copy dictionary in PRD §9). Error messages are Arabic, under the field, never only at the top.
11. ACCESSIBILITY AND SENIOR-FRIENDLY UX (PRD §10.5): root font-size 112.5% by default (text-size setting 100/112.5/125%), buttons and inputs size "lg", touch targets ≥ 48px, labels above fields, no icon-only buttons (except close X with aria-label), contrast ≥ 4.5:1, visible focus rings, prefers-reduced-motion respected, no emoji as icons, nothing important hidden behind hover.
12. RESPONSIVE, MOBILE-FIRST (PRD §11): right sidebar ≥1024px; collapsible sidebar 768–1023; mobile header + 5-item bottom nav + sticky primary action <768; tables become cards <768; NO horizontal page scroll at 360px.
13. LIGHT THEME ONLY in v1: force light in the next-themes provider (forcedTheme="light"). Replace the brand scale in `src/styles/theme.css` with the navy scale from PRD §10.3. Never use raw palette classes (text-gray-600, bg-blue-700): only semantic classes (text-primary, bg-secondary, fg-brand-primary, border-secondary …).
14. CONFIRM BEFORE MONEY. Every money save shows a confirmation dialog with one full Arabic sentence describing the effect (PRD §8.7), then shows the receipt with Print / Save PDF / WhatsApp.
15. NEVER LOSE TYPED DATA. On a server error, keep form values and show the Arabic error. Warn before leaving a form with unsaved changes.
16. SHARED CONTAINERS (PRD §5.3, §5.6): one container can belong to several traders with shares (meters / m³ / % / equal). Every charge is split between them by a single tested pure function `splitAmount()`; allocations always add up exactly; per-charge override (one trader / manual). Single-trader containers use the same code (one share row = 100%).
17. THE CONTAINER FORM (PRD §8.5) is specified down to spacing, alignment and behavior. Build it EXACTLY as written there: essentials card first, optional sections folded, numbered path, 8px spacing grid, labels above fields, one straight start edge, sticky action bar, draft autosave.
18. NO SECRETS IN CODE. Use .env.local; keep .env.example complete and documented.

# HOW YOU WORK
- Follow the milestones in Part 2 IN ORDER (they are repeated below for one-shot mode). Each milestone ends with its "DONE WHEN" checks.
- Before each milestone: write a short plan (files to create/change, components to fetch from the MCP).
- Write tests FIRST for the ledger (M2) and for any money-related service.
- After each milestone run: `pnpm typecheck && pnpm lint && pnpm test` (and `pnpm e2e` from M9). Fix everything before moving on. Never skip, disable or weaken a test to make it pass.
- Commit after each milestone: `feat(mX): <summary>`.
- When the PRD leaves a small detail open, choose the simplest option that keeps balances correct and the UI simple, write it in `DECISIONS.md` (date, decision, reason), and continue. Ask me only if the choice would change what the owner sees or how money is calculated.
- Keep `README.md` up to date (how to run, scripts, env vars).
- MODE: STEP → after finishing a milestone, STOP and give me: (1) what you built, (2) how to see it in the browser (exact URL and steps), (3) anything I must do. Wait for my next message.
- MODE: ONE-SHOT → continue to the next milestone automatically. Stop only if a DONE WHEN check fails twice, or you need a secret/value from me. At the very end give me the same 3-point report for the whole app.

# MILESTONES (summary; full text in Part 2)
M1 Foundation & RTL · M2 Ledger core (TDD) · M3 Settings · M4 Containers, shared containers & charges · M5 Money actions & receipts · M6 Accounts & statements · M7 Home dashboard & global search · M8 Reports, Excel import & backup · M9 Polish, responsiveness & e2e · M10 Security & deploy

Start now with M1.
````

> In **one-shot mode**, also paste all of Part 2 right after Part 1 in the same message, so the AI has every milestone's details.

---

## Part 2: Milestone prompts (send one at a time in step mode)

Each prompt has **DONE WHEN** checks. Check them yourself in the browser before sending the next one.

### M1: Foundation and RTL
```text
M1 — Foundation & RTL. Follow docs/PRD.md §10, §11, §12, §13.

1. Project hygiene: add scripts typecheck, lint (eslint for Next 16 + prettier check), test (vitest), e2e (playwright), db:generate, db:migrate, db:seed, db:demo. Add vitest + playwright configs. Use pnpm.
2. RTL + language: <html lang="ar" dir="rtl">, React Aria I18nProvider locale "ar-IQ", next-intl with messages/ar.json (seed it with PRD §9 keys).
3. Write scripts/rtl-codemod.ts (physical → logical Tailwind classes, incl. variant prefixes like md:, lg:, hover:, group-hover:, data-*:). Run it on src/components/**. Print a before/after count. Verify with grep that no physical direction classes remain (list any intentional exceptions in DECISIONS.md).
4. Theme: replace the brand scale in src/styles/theme.css with the navy scale (PRD §10.3); set --font-body and --font-display to IBM Plex Sans Arabic (next/font/google, weights 400/500/600/700, subsets arabic+latin); themeColor #1E3A8A; force light theme; root font-size from a text-size setting (default 112.5%, stored in a cookie so SSR renders the right size); tabular-nums utility for amounts.
5. App shell in app/(app)/layout.tsx: right sidebar (SidebarNavigationSimple, RTL) with nav items Home/Containers/Money/Accounts/Reports/Settings using @untitledui/icons; mobile header; a custom bottom nav for <768px (5 items: الرئيسية، الحاويات، المالية، الحسابات، المزيد; icon + label; safe-area padding); top bar with a wide global search trigger and a "+ جديد" dropdown; sonner Toaster styled with Untitled UI tokens. Empty placeholder pages for every route in PRD §13.2. Arabic 404 page.
6. Database: Drizzle config; db/schema.ts with ALL enums and tables from PRD §12 (plus Better Auth tables via its Drizzle adapter); db/triggers.sql with the balanced-entry constraint trigger, immutability triggers and currency checks; first migration; enable pg_trgm; views account_balances and container_totals; indexes.
7. Auth: Better Auth with username plugin, sign-up disabled; login page per PRD §7.1 (big fields, show password, remember me, Arabic errors, rate limit 5/15min); protect all routes except /login, /api/auth/*, /api/health; logout in the account card.
8. Seed (db/seed.ts) exactly as PRD §12.4. Health route /api/health checks DB.
9. Our base components in src/components/app/: page-header, money-amount (formats IQD/USD with separators, currency after number, <bdi>), status-badge, balance-badge (عليه/له/مسدد), bdi-text.

DONE WHEN: `pnpm db:migrate && pnpm db:seed` works on Neon; I can log in at http://localhost:3000/login with OWNER_USERNAME; the shell shows Arabic RTL with the sidebar on the RIGHT on desktop and the bottom nav on a 390px phone view; the grep for physical direction classes is clean; typecheck/lint/test pass.
```

### M2: Ledger core (tests first)
```text
M2 — Ledger core, TEST-DRIVEN. Follow PRD §6 and §13.4 exactly.

1. Write Vitest tests FIRST (they must fail), against a real Postgres (Neon dev branch or local docker Postgres; document which in README):
   - one test per posting A1–A15 in PRD §6.3: lines are balanced per currency and hit the right accounts;
   - the worked example PRD §5.5 ends with trader 0, China co. 0, Umm Qasr 0, fee income 300 USD, USD vault 300;
   - A4x cross-currency receive (debt 2,400 USD, paid 3,144,000 IQD at 1,310) and A11 exchange; rate stored; rounding rules;
   - reverseEntry restores previous balances and gets its own receipt number; original is marked cancelled;
   - 20 concurrent postEntry calls with receiptKind "in" → 20 unique, consecutive numbers;
   - splitAmount(): every case listed in PRD §15.1 (incl. the §5.6 shared-container example and rounding leftovers);
   - DB triggers reject an unbalanced entry, an UPDATE and a DELETE on journal_lines, a line whose currency differs from its account, a vault account in a disallowed currency.
2. Implement src/features/ledger/: post-entry.ts, reverse-entry.ts, postings.ts (pure functions per action returning lines), balances.ts (getBalance, getBalances), statements.ts (getStatement with opening, running balance, closing), receipt-numbers.ts, accounts.ts (lazy account resolution).
3. Implement lib/money.ts (decimal.js helpers, parse "2,400" and Arabic-Indic digits "٢٤٠٠"), lib/tafqeet.ts (Arabic words for IQD and USD, ending "لا غير") with the test cases in PRD §15.1, lib/format.ts, lib/digits.ts.

DONE WHEN: all ledger, tafqeet and money tests pass; coverage of src/features/ledger ≥ 90%; no `number` type is used for money anywhere (grep for parseFloat/Number( in money code returns nothing).
```

### M3: Settings
```text
M3 — Settings. Follow PRD §8.10 and §7.6.

Build /settings with a start-side sub-navigation (desktop) / list (phone) and these sections: company info (logo upload ≤300KB via the Untitled UI file upload component), charge types (seeded with the owner's 7 types) (sortable list; edit modal with name, default currency, default party, "is fee" toggle, per-size default amounts table, active), parties (system "شركتنا" locked; mark one as default clearance company), vault defaults, shipping lines, ports of loading, container sizes (with length m and volume m³), shared-container default split unit, expense categories, receipts (prefix + next number, can only increase, live preview), currency & default rate, alerts (arrived-warning days), display (text size, digits), account (change password, logout). Opening balances wizard and Excel import are placeholders here (built in M6/M8). Audit log page lists audit_log with filters.
Rule: anything used in a record can only be deactivated (show why when the delete option is missing).
Every save → toast "تم الحفظ" with undo for 5 seconds.

DONE WHEN: the 7 seeded charge types (كمرك بصرة، غرامة شركة الشحن، غرامة ميناء، أجور نقل بحري، أتعاب شركة، أجور نقل الجوي، أتعاب أجور نقل) appear in order; I can add a new charge type "أجور التفريغ" in IQD paid by Umm Qasr with a 40ft default of 150,000; I can add a port of loading and edit a size's length/volume; deactivate a shipping line; change text size to "كبير جداً" and the whole UI grows; all forms show Arabic validation errors under the fields.
```

### M4: Containers and charges
```text
M4 — Containers & charges. Follow PRD §5, §7.2, §8.4–8.6.

1. Containers list (/containers): TableCard + Table + pagination; filters (status chips, trader ComboBox, line, date range, "late only" toggle; filters move into a slideout on phone); sort; Excel export of current filter; cards on phone; bulk status change (MAY).
2. Container form (new/edit): build PRD §8.5 EXACTLY. Read §8.5.1–8.5.6 before coding and follow the spacing table and the 8 alignment rules literally. Sections: ① الأساسيات (container number, shipping line, trader, "حاوية مشتركة" switch; brand start border; always open) → ①b الحصص (when shared: split unit segmented control, trader share rows, "+ إضافة تاجر آخر", fill bar with capacity from the size, % must total 100) → ② تفاصيل الشحنة (port of loading, B/L number, size as segmented buttons, quantity, fax, clearance company) → ③ البضاعة → ④ التواريخ والملاحظات. Optional sections folded with "اختياري · n من m" and a value preview; fold state remembered. Live duplicate check ("✓ متاح" / error with link), soft ISO-6346 warning, inline add trader / line / port, remembered last line and port, draft autosave + restore banner, error summary + focus first error, Ctrl/⌘+Enter, unsaved-changes guard, sticky action bar (حفظ الحاوية / حفظ وإضافة أخرى / إلغاء), summary panel ≥1280px, bottom nav hidden on this page on phone. "حفظ وإضافة أخرى" keeps line, port and date.
3. Container page: "next step: add charges" hint after creation; header (number big, LTR, line, port, B/L), status steps (build container-status-steps.tsx; horizontal on desktop, vertical on phone) with forward/skip/back rules and dialogs; info card; charges table with per-row cancel (reason required) and "cancel and replace"; money summary per currency (costs, fee/profit, total) + trader overall balance with link; timeline (status history, charges, tagged payments, edits); ⋯ menu (print, WhatsApp, archive).
4. Shared containers on the container page: الحصص card (fill bar, per-trader share/%, totals, balance, optional delivered tick), "تعديل الحصص", and "إعادة توزيع المصاريف" (preview old/new per trader → cancel + re-post in one tx). Print one sheet per trader.
5. "إضافة مصاريف" slideout from the start side: checkbox tiles per active charge type, rows with amount (size default), currency toggle, paid-by select (hidden for fee → "ربح الشركة"), vault select when paid by شركتنا (only vaults allowing that currency), split control for shared containers (حسب الحصص / على تاجر واحد / يدوي with live "المتبقي") with per-trader preview under each row, note; "المصاريف المعتادة" button; live totals; confirmation sentence; ONE transaction for all rows via postEntry (A1/A2/A3), writing container_charge_allocations.
6. Print page /print/container/[id] (and ?trader= for one trader's share).

DONE WHEN: I can add container MSCU4829175 (only number, line MSC and a new trader) in under 30 seconds and the form matches PRD §8.5 at 390px and 1440px; I can add shared container CMAU3390418 (أحمد 4 م, حيدر 5.5 م, 40 قدم) and the charges split exactly as PRD §5.6; adding it again shows the duplicate error with a link; on MSCU4829175 I add كمرك بصرة 2,000 $ (China co.), غرامة ميناء 100 $ (Umm Qasr) and أتعاب شركة 300 $ in one go and see "2,400 $ على التاجر … منها 300 $ أتعاب"; I move it to "وصلت أم قصر"; cancelling the port fine updates totals; changing a share and re-splitting moves only trader balances; everything looks right at 390px.
```

### M5: Money actions and receipts
```text
M5 — Money. Follow PRD §6.3–6.6, §7.3, §8.7.

1. /money: grid of large tiles (green in, red out, blue internal) for: قبض من تاجر، قبض من جهة، إيداع، دفع لجهة، دفع لتاجر، سحب، مصروف عام، تحويل بين القاصات، تصريف عملة, plus a link to the journal.
2. One form per action at /money/new/[action] with only the fields in the PRD table: big money input + currency toggle, vault select filtered by currency with defaults, date (today), note; trader/party ComboBox showing current IQD/USD balances; "pay full balance" buttons; "pay in the other currency" toggle with rate (pre-filled from settings / last used) and live converted amount (either side editable); optional container tags; negative-vault warning.
3. ConfirmMoneyDialog: FeaturedIcon, the full Arabic sentence from PRD §8.7, summary list, "تأكيد وحفظ" / "رجوع".
4. Receipt page /money/receipts/[id] and print page /print/receipt/[id] (A5 layout from PRD §6.5, logo, تفقيط per currency, rate, container numbers, signatures, "ملغى" watermark when cancelled); buttons Print / Save PDF (?autoprint=1) / WhatsApp (wa.me with Arabic summary; to the trader's phone when known) / Cancel with reason.
5. Journal /money/journal: table with filters (type, account, currency, date range, receipt no.), status badge, Excel export, row → receipt.
6. Update the "+ جديد" dropdown in the top bar to open these forms.

DONE WHEN: I record "Ahmed pays 3,144,000 د.ع against his 2,400 $ debt at 1,310" and get receipt ق-000001 with both amounts and words; his USD balance becomes مسدد; I pay China co. 2,000 $ (ص-000001); printing shows a clean A5 receipt; cancelling the receipt gets its own number and restores balances.
```

### M6: Accounts and statements
```text
M6 — Accounts. Follow PRD §7.4, §8.8.

Tabs التجار | الجهات | القاصات under /accounts.
- Traders list: name, phone, active containers, IQD and USD balance badges, filter "عليهم ديون فقط", sort by debt, "+ تاجر جديد", cards on phone. Trader page: header with two big balance cards, actions (استلام دفعة primary, دفع للتاجر, كشف حساب), tabs (statement, containers, info). Statement: date range with presets, currency tabs, opening row, rows with عليه/له/الرصيد, totals row, Print (A4 /print/statement/...), Excel, WhatsApp summary.
- Parties: same pattern, primary action "دفع", headline "المستحق لهم علينا".
- Vaults: card grid (main vault wide, brand solid), "+ قاصة جديدة" dashed card, vault form (name, type radio cards, allowed currencies, notes), vault page with movements and quick actions (إيداع، سحب، تحويل، تصريف).
- Opening balances wizard in settings (traders → parties → vaults; IQD + USD + direction per row; posts A13).

DONE WHEN: every balance shown equals the account_balances view; Ahmed's statement for this month prints on A4 with a correct running balance; I can create a vault "صيرفة الأمين" accepting IQD and USD and exchange 1,000 $ into it.
```

### M7: Home dashboard and global search
```text
M7 — Home & search. Follow PRD §8.2, §8.3, §7.5.

- Home: greeting with date; 4 status metric cards with FeaturedIcon (tap = filter the list); warning alerts (arrived > N days; expected arrival passed); money strip (main vault first, USD vault, total traders owe us, total we owe parties); 3 big quick actions; the big current-containers list (non-delivered + delivered in last 7 days, newest first, 25/page, days-in-status with amber when late, stacked totals per currency); cards on phone; skeletons; empty state with illustration.
- Global search modal (Ctrl/⌘+K and tap): grouped results (containers by partial number with status badge, traders, receipts by "ق-123" or "123", parties), keyboard navigation, recent searches. Uses pg_trgm; must answer < 300ms with demo data ×100.

DONE WHEN: with `pnpm db:demo` loaded, the home page loads in under 1 second, tapping "وصلت أم قصر" filters the list, typing "4829" finds MSCU4829175, and the phone layout shows cards + bottom nav with no horizontal scroll.
```

### M8: Reports, Excel import and backup
```text
M8 — Reports, import, backup. Follow PRD §8.9, US-26, US-28.

- /reports landing with cards; reports: الأرباح (fee income by period/trader/container, bar chart by month with charts-base/recharts, general expenses, net per currency), الحاويات, الديون, يومية القاصة (per vault & currency: opening, in, out, closing + movements; print), المصاريف العامة. Each: date range, print page, Excel export.
- Excel import (settings): upload .xlsx ≤5MB, map the "تفاصيل" sheet (header row 6, same columns as docs/client-excel-template.xlsx), preview with per-row errors (duplicate number, missing trader, bad number), confirm creating missing traders, import containers + their charge columns mapped to the new types (كمرك → كمرك بصرة، غرامة الشركة → غرامة شركة الشحن، غرامة الميناء → غرامة ميناء, paid by the row's "شركة" party or the default clearance company; اتعاب الشركة → أتعاب شركة as fee) dated on the registration date. The Excel "اسم الخط" column fills the required shipping line; rows without it get a line the owner picks in the preview. Also accept "قبض الحساب" rows as opening receipts (MAY).
- Full backup: one .xlsx with a sheet per table.

DONE WHEN: the profit report for this month shows the 300 $ fee from the worked example; importing a copy of the template with 3 filled rows creates 3 containers and their charges; the backup file opens in Excel.
```

### M9: Polish, responsiveness and end-to-end tests
```text
M9 — Polish. Follow PRD §8.12, §10.5, §11, §15.2, §16.

- Go through EVERY page at 360, 390, 768, 1024, 1440 px: no horizontal scroll, tables → cards on phone, sticky primary actions, safe-area bottom nav, readable at text size 125%.
- Every page has loading skeletons, an empty state, an error state that keeps typed data, offline banner, disabled-while-saving buttons (isLoading + showTextWhileLoading).
- Keyboard: logical RTL tab order, Enter submits, Esc closes dialogs, focus returns to the trigger.
- Contrast check on all badges and text; aria-labels on any icon-only control; decorative icons aria-hidden.
- Playwright e2e (RTL) at 390 and 1440 for the flow in PRD §15.2, plus visual snapshots of Home, Container and Money.
- Lighthouse accessibility ≥ 95 on Home, Container, Money.

DONE WHEN: `pnpm e2e` passes at both sizes; the Definition of Done items in PRD §16 that relate to UI are all true; you give me a list of every page with a screenshot path from the e2e run.
```

### M10: Security and deploy
```text
M10 — Security & deploy. Follow PRD §14.

- Security headers (CSP allowing self + Google Fonts, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy); confirm the app-level login rate limit; ensure every server action checks the session.
- Railway: add railway.json (or nixpacks/railpack config) with build `pnpm build`, start `pnpm start`, pre-deploy `pnpm db:migrate`, healthcheck `/api/health`, Node 22, TZ=Asia/Baghdad.
- Write DEPLOY.md for a BEGINNER, step by step with exact clicks: create the Railway project from the GitHub repo; set every env var (table with where to get each one); run the seed once; add the custom domain in Railway; in Cloudflare add the CNAME (proxied/orange cloud), SSL/TLS "Full (strict)", Always Use HTTPS, WAF managed rules, Bot Fight Mode, a rate-limit rule for /login and /api/auth/* (10/min/IP), cache bypass except /_next/static and fonts; optional Cloudflare Access; Neon backup/PITR notes; how to download the in-app backup weekly; how to roll back a bad deploy in Railway.
- Final: README.md (what it is, how to run locally, scripts, env vars), DECISIONS.md complete.

DONE WHEN: `pnpm build` succeeds with no warnings that matter; DEPLOY.md lets someone who has never deployed follow it; all checks in PRD §16 are ticked or listed as remaining with a reason.
```

---

## Part 3: Fix-it prompts

Copy the one that matches your problem.

**The layout looks mirrored wrong or icons point the wrong way**
```text
Some parts of the UI are not right-to-left correctly: <describe page and element, or attach a screenshot>. Re-run scripts/rtl-codemod.ts on src/components/**, grep for any remaining physical classes (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r/rounded-l/rounded-r/text-left/text-right incl. variant prefixes), fix them, mirror only directional icons with rtl:-scale-x-100, and check numbers are wrapped in <bdi>. Show me the before/after grep counts.
```

**A balance looks wrong**
```text
The balance for <trader/party/vault> shows <X> but I expect <Y>. Do NOT change any data. Print the journal lines for that account from the DB, explain line by line how the balance is computed, find where the posting differs from PRD §6.3, write a failing test that reproduces it, then fix the posting code and show the test passing.
```

**The AI used a component that doesn't exist / looks generic**
```text
Before writing UI, search the Untitled UI MCP (search_components, list_components) for a free component that fits "<need>". Install it with the returned `npx untitledui@latest add … --yes` command, run the RTL codemod, then use it. Replace the custom component you wrote. Use only semantic color classes.
```

**Text too small / buttons too small**
```text
The owner is 50+. Check every page at text size "عادي" and "كبير جداً": body ≥ 16px at 100%, buttons and inputs size "lg" (≥ 48px), labels above fields, no icon-only buttons. List what you changed.
```

**Build fails on Railway**
```text
The Railway deploy failed. Here is the log: <paste>. Explain the cause in plain words, fix it, and tell me exactly what (if anything) I must change in Railway settings or env vars.
```

**Next.js errors about APIs that "don't exist"**
```text
This is Next.js 16. Read node_modules/next/dist/docs/ for <the feature> and rewrite the code to the current API. Don't downgrade Next.js.
```

**A form lost what I typed after an error**
```text
After a server error the form on <page> lost my input. Make all forms keep their values on error (return field values + errors from the action, or keep client state), show the Arabic error under the field, and add an e2e test for it.
```

---

## Part 4: Final review prompt
```text
Do a full review of the app against docs/PRD.md.
1. Go through PRD §16 (Definition of Done) and §7 (all user stories US-1…US-31). For each item answer ✅ done / ⚠️ partial / ❌ missing, with the file or test that proves it.
2. Run typecheck, lint, test, e2e and paste the summary.
3. Run the worked example from PRD §5.5 against a fresh database and show every balance.
4. List anything you decided on your own (DECISIONS.md) that changes what the owner sees.
5. Fix every ❌ and ⚠️ you can, then repeat the table.
```
