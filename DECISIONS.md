# Decisions log

Choices made while building, so the owner and the next developer know *why*.
Product decisions waiting for the owner are in `docs/PRD.md` §17.

## Architecture
1. **Auth is a small first-party module, not Better Auth.** Single owner login, so: scrypt password hash (`node:crypto`), a random 32-byte session token in an httpOnly cookie `cc_session` (30 days), stored in the `sessions` table only as its SHA-256. Login is rate-limited to 5 failures per 15 minutes per username + IP (`login_attempts`). Fewer moving parts, same security properties.
2. **Strings live in `src/messages/ar.json` with a typed `t(key, vars)` helper instead of next-intl.** The app is Arabic-only with no locale routing, so a library adds nothing. Every user-facing string is still in one file.
3. **Untitled UI MCP/CLI could not be reached from the build machine.** The free components already in the starter kit cover the needs. Missing pieces (status steps, bottom nav, segmented control, sidebar in the "elegant" style) are in `src/components/app/` and use the same tokens.
4. **(Replaced 2026-11-27, see "Redesign" below.)** ~~Visual direction = IMAGE_PROMPTS.md Part F ("elegant pass")~~: white surfaces, hairline dividers instead of boxes, one navy button per screen, two font weights (600/400, 500 for big figures), IBM Plex Sans Arabic + IBM Plex Mono for container numbers, brass accent `#B88A44` only on the logo and the active-nav marker. The sidebar is custom (not `SidebarNavigationSimple`) to get this look.
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

## Containers (Task 6)
- A container that already has charges keeps its traders: a normal container can't change its trader or become shared, and a shared one can't stop being shared. Move money with "re-split" on the charge instead.
- A shared container needs at least two traders. "Equal" split stores no share values; a normal container is one share with no value.
- In the add/edit form, Enter goes to the next field and never saves. Ctrl/⌘+Enter saves.
- Latin and number inputs use `num [direction:ltr] text-end`, so what you type sits on the right edge like the Arabic labels.
- Counts follow Arabic number agreement (`countAr` in `src/lib/format.ts`): حاويتان، 3 تجار، 11 تاجراً.
- Shipping icon is `Anchor` (`Ship01` is not in the free icon set).
- Cancelled (archived) containers are read-only.

## Charges (Task 7)
- The "إضافة مصاريف" sheet has one date for the whole batch (today by default), because charges are often entered after the day they were paid.
- A charge paid by "شركتنا" comes out of a vault chosen on the row and gets an out receipt (ص). If a vault would go below zero, the confirmation says so and the owner must confirm again.
- The live split preview and the saved split use the same function (`allocateCharge`), so what the owner sees is exactly what is posted.
- Editing a charge = cancel it with a reason, then add it again. "إلغاء وإضافة بدلاً منه" does both and reopens the sheet with the old values.
- After shares change, "إعادة توزيع المصاريف" cancels and re-posts the affected charges in one transaction, dated today. Manual and one-trader splits are left alone while those traders are still on the container.

## Money, receipts and printing (Task 8)
- One form handles the nine money actions (`/money/new/<action>`); it only shows what that action needs. Defaults: today, the Settings vault for the chosen currency, and the last exchange rate used (unless the rate in Settings was changed after it).
- "الدفع بعملة أخرى": the paid amount, the rate and the debt amount stay in step. Typing the amount or the rate recomputes the debt; typing the debt recomputes the rate. Exchange works the same way between "ما يخرج" and "ما يدخل".
- Every action asks for confirmation with the full sentence. If a vault would go below zero, the dialog says by how much and the button becomes "نعم، احفظ رغم ذلك"; the server refuses without that confirmation.
- Receipts keep the names they were printed with (stored on the entry), so renaming a trader or vault later never changes an old receipt.
- Cancelling a receipt posts a reversal with its own number of the same letter. Cancelling the receipt of a container charge goes through the charge, so the container page stays right. A cancellation itself cannot be cancelled.
- The journal (سجل المعاملات) lists receipts only, meaning every movement of cash. Charges paid by a party and company fees move no cash, so they appear on the container page and in statements instead.
- Print pages live outside the app layout: `/print/receipt/[id]` (A5) and `/print/container/[id]` (A4). `?autoprint=1` opens the print dialog; "حفظ PDF" uses the browser's "Save as PDF". WhatsApp opens `wa.me` with a text summary, addressed to the trader or party when they have a phone (0770… becomes 964770…).
- Negative amounts carry a left-to-right mark before the minus so "-50,000 د.ع" reads correctly inside Arabic text.
- Deferred: tagging containers on a receipt (optional in the PRD) and the journal's Excel export (Task 11).

## Accounts and statements (Task 9)
- الحسابات has three tabs: التجار, الجهات, القاصات (`/accounts/traders|parties|vaults`). Each list shows totals per currency at the top.
- Traders and parties are sorted by debt. The two currencies are compared in dinars at the default rate from Settings (dollars × rate + dinars). Traders: largest debt first. Parties: what we owe them most first. Our own company (شركتنا) has no account page; its money is the vaults.
- Party wording follows PRD §6.2: "له" in green means we owe them. The party page says "المستحق لهم علينا" or "المستحق لنا عليهم".
- A statement opens on "الكل" (every movement) in the currency that holds a balance (dollars first). Presets: هذا الشهر, الشهر الماضي, هذه السنة, الكل, or any two dates. Everything lives in the URL, so a statement can be bookmarked or printed as shown.
- With a start date the statement opens with "الرصيد في بداية الفترة" and ends with the totals and the closing balance. Cancelled receipts stay in the statement, marked "ملغى", next to the line that cancels them.
- Printing: `/print/statement/<traders|parties|vaults>/<id>` on A4 with both signature lines. WhatsApp (traders and parties) sends the name, the period and the closing balance in both currencies at the end of the period.
- Vaults: the main vault is the wide navy card. A new vault has a name, a kind (شخص، محل صيرفة، تاجر، أخرى), one or both currencies, and notes. A currency the vault has already used, or that it is the Settings default for, can't be removed. A vault can be stopped only when it is empty, is not one of the two built-in vaults, and is not a Settings default.
- From a trader's containers tab, "حاوية جديدة" opens the container form with that trader already picked.
- Deferred to Task 11: the statement's Excel export and the Settings "القاصات" section (default vault per currency). Not built: the per-container breakdown on a party page (optional in the PRD).

## Home and search (Task 10)
- Home follows Part F4.1: greeting with the owner's name and today's date, then one hairline band with four status figures (تم التأكيد, في الطريق, وصلت أم قصر, سُلّمت هذا الشهر) over four money figures (main vault, dollar vault, لنا عند التجار in red, علينا للجهات in green). Each figure is a link; the money ones open the vault or account list.
- Tapping a status figure filters "الحاويات الحالية" below and scrolls to it; tapping it again shows everything. The chips above the list do the same without moving the page. "الكل" means not delivered yet, plus delivered in the last 7 days; "سُلّمت هذا الشهر" lists the deliveries since the 1st, so the number and the list always agree.
- Amber lines warn about containers in Umm Qasr longer than the Settings limit, and containers past their expected arrival. Each opens the containers list filtered to exactly those.
- The only navy button is "+ حاوية جديدة". "قبض من تاجر" and "دفع لجهة" sit quietly in the header. With no containers at all, the list becomes the box empty state with the same button.
- "منذ" in container lists is the number of days in the current status for every status (amber once late).
- Search (top bar, Ctrl/⌘+K, or the magnifier on phones) looks in containers (number or B/L, any case or spacing, part of it is enough), traders (name ignoring hamza, or phone), receipts (ق-12, ق12 or 12) and parties. Five per group, cancelled containers left out. Arrow keys and Enter work; the last five searches are remembered on the device.
- `pnpm db:demo` adds sample data (10 traders, 30 containers in every status, some late and some shared, charges and payments in both currencies) to a database with no containers, for showing the app. It refuses to run on a database that already has containers.

## Polish (Task 11)
- Settings has a new "القاصات" section: the vault each money form picks first for dinars and for dollars. Only an active vault that holds that currency can be chosen; a vault set here can't be stopped.
- "تصدير Excel" downloads the containers list (as filtered), the journal (as filtered) and any statement (same period and currency, from the "Excel" button next to طباعة). Each file is one right-to-left sheet with a title row, real dates and amounts in their currency format, and a totals row on statements. File names are in English (containers-2026-11-24.xlsx) because Chrome drops Arabic download names; the Arabic title is inside the sheet.
- The kit's date pickers are translated (they are not used on any screen today; the app uses its own date field).

## Redesign (2026-11-27)
The owner found the Part F look flat and the flows too long. The full brief lives in the project skill
`.claude/skills/clearancex-redesign/`; these are the decisions it led to.
1. **Kept Untitled UI + React Aria, changed the skin and the patterns.** No public design system covers logo pickers, WhatsApp pictures, default expense lines and Arabic RTL together; replacing the kit would cost weeks the owner can't see. Patterns come from Revolut/Monzo/Wise (money first, round actions, plain words), WhatsApp, and phone Settings (colored icon tiles). Research and sources: `references/ux-research.md`.
2. **Gradient background, raised white cards, colored icon tiles** (`bg-app`, `surface`, `bg-hero`, `IconTile` in `src/styles/app.css` / `icon-tile.tsx`). Every icon has a label. Status is a colored pill with an icon.
3. **The main vault is the first thing on the home page** (gradient hero with big balances and round actions) and has its own nav item `/vault` (redirects to the main vault page). The phone tab bar is الرئيسية، الحاويات، القاصة، الحسابات، المزيد; المالية and الإعدادات moved under المزيد.
4. **Expenses are step 2 of adding a container.** Saving a new container opens the expenses sheet by itself (`?new=1`, removed after opening). The sheet opens with the starred default lines already filled; "+ إضافة سطر" adds others from a popup; a star on a line (or in Settings) makes it a default line with the currency it shows (`charge_types.is_default_line`). The old "tick tiles" grid is gone.
5. **Shipping line logos**: `shipping_lines.logo` (owner-uploaded, resized to ≤160px in the browser, PNG/JPEG/WebP only, no SVG) and `shipping_lines.website` (its site icon via Google's favicon service until a logo is uploaded; only the domain is sent). No carrier logo files are committed to the repo. The add-container form picks the line from a logo grid.
6. **WhatsApp picture or text** on receipts, the container page and statements (`whatsapp-share.tsx`, `html-to-image`). Phones use the share sheet with the JPEG file; computers copy + save the picture and open the chat.
7. **Fixed:** `Dropdown.Item` with `unstyled` dropped its children (`src/components/base/dropdown/dropdown.tsx`).

## Security hardening (2026-11-27)
Full details, findings and owner to-dos: `SECURITY.md`.
1. **Nonce-based CSP in `src/proxy.ts`** (Next.js guide), other headers in `next.config.mjs`. `style-src` keeps `'unsafe-inline'` because React style attributes and the UI kit need it; styles can't run code. WhatsApp pictures convert data URLs without `fetch()` so `connect-src 'self'` stays strict.
2. **Session cookie renamed to `__Host-cc_session` in production**: everyone signs in once after the deploy.
3. **Login limits per username, per IP and per pair**. `CF-Connecting-IP` is trusted only with `TRUST_CLOUDFLARE=1`; otherwise the last `X-Forwarded-For` hop (added by Railway) is used.
4. **scrypt N=2^15, r=8, p=3** (OWASP equivalent minimum), re-hashed at login. The new-password minimum is 10 characters (NIST: length over composition rules).
5. **Database guards live in `src/db/sql/0002_hardening.sql`** (runs every start, idempotent): audit log append-only, CHECK constraints added `NOT VALID` then validated, so a deploy never fails on old rows.
6. **Least-privilege role is opt-in** (`scripts/sql/create-app-role.sql`) because it needs a password only the owner should choose. `setup.ts` warns at start while the app still uses the owner role.

## Restore points and start fresh (2026-11-27)
- Points are stored in the same database (`restore_points.data` jsonb, compressed by Postgres) and built by the
  database itself (`cc_create_restore_point`), so the data never leaves Postgres, numbers keep every digit, and the
  app can't plant a fake point. A SHA-256 checksum refuses a damaged point before anything is wiped.
- Restore, start fresh and delete are SECURITY DEFINER functions with the owner's rules inside them: an automatic
  point before every restore/reset, reset only with a manual point from today (Asia/Baghdad), no deleting today's
  point. Wiping uses TRUNCATE so the row-level immutability triggers stay in force for normal use.
- Restore copies only columns that exist both now and in the point, so a point from before a new column still
  restores (new columns get their default). A test fails if a new table isn't added to `cc_restore_tables()` or to
  the deliberately-excluded list.
- Restore and start fresh ask for the password again and count wrong tries toward the login limits.
- A point in the same database is not a backup against losing the database: Neon's point-in-time restore is still
  the owner's job (SECURITY.md §3).

## The Umm Qasr partnership as a branch (2026-11-27)
- Modelled as two sets of books in the one ledger:
  - the branch owns its vault and the `trader_branch` receivables;
  - the owner↔branch account is the branch's existing party account (owner's side) plus a hidden mirror `branch_owner` (branch's side), so every entry balances for each side too.
- Old charges that credited the partnership as a plain party keep their meaning: the owner owes the branch. They need no conversion.
- Reads of a trader (`kind "trader"`) include `trader_branch`: lists, totals, statements and receipts show the customer's one total. `getTraderSplit` gives the two parts.
- Branch-paid dollar expenses are converted to dinar when saved; the vault is dinar only, as the owner chose. The owner paying for the branch is limited to his dinar vaults.
- Only one branch (unique partial index) because the business has one. Supporting more would need a branch dimension on `trader_branch` accounts.
