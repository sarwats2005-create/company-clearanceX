# PRD: Container Clearance Manager (نظام إدارة تخليص الحاويات)

| | |
|---|---|
| **Version** | 2.1 · 2026-11-24 (owner's new rules: 7 charge types, port of loading, B/L number, only 3 required fields, shared containers, detailed container form design) |
| **Product owner** | saro |
| **End client** | A container clearance company in Basra, Iraq (owner in their 50s) |
| **Status** | Ready to build |
| **Companion files** | `MASTER_PROMPT.md` (build instructions for the AI coding tool), `IMAGE_PROMPTS.md` (mockups and brand art), `client-excel-template.xlsx` (the client's current workbook) |

> **How to read this document.** Sections 1–4 explain *what* and *why*. Sections 5–9 define *exactly what the app does* (lifecycle, money, screens, copy). Sections 10–15 define *how it is built* (UI system, data, backend, security, tests). Section 16 is the acceptance checklist. Section 17 lists decisions made without the owner. Anything marked **MUST** is non-negotiable. Anything marked **SHOULD** is strongly expected. **MAY** is optional.

---

## Table of contents
1. Product summary
2. Users and their world
3. Goals, non-goals, anti-goals
4. Glossary
5. Container lifecycle
6. Money model (the heart of the app)
7. Feature specification and user stories
8. Screen-by-screen specification
9. Arabic UI copy dictionary
10. Design system (Untitled UI React, RTL, tokens)
11. Responsiveness
12. Data model
13. Backend architecture
14. Hosting, security, operations
15. Testing strategy
16. Acceptance checklist (Definition of Done)
17. Decisions made without the owner
18. Phase 2 roadmap

---

## 1. Product summary

Container Clearance Manager is an Arabic, right-to-left web application that replaces the Excel workbook `سرور البصرة 2026.xlsx` that a Basra clearance company uses to run its business.

It does four jobs:

1. **Tracks containers** from the moment a trader hands one over until it is delivered, keyed by the **container number**.
2. **Records every charge** on a container (customs, fines, shipping, the company's fee) and who paid it.
3. **Keeps exact money balances** for traders, outside parties (clearance companies, partners), and cash vaults, in **Iraqi dinar (IQD, main)** and **US dollars (USD)** separately.
4. **Prints numbered receipts and statements** for every money movement.

**The one-sentence promise to the client:** "Open the app and in five seconds you know where every container is, who owes you, whom you owe, how much cash you have, and how much you earned."

### 1.1 What the Excel does today (and what is wrong with it)

| Excel sheet | What it holds | Problem the app fixes |
|---|---|---|
| تفاصيل (details) | One row per container: trader, container no., fax, cartons, goods, weight, line, size, count, company, customs, company fine, port fine, company fees, total, registration date, arrival date, destination, notes | No status. Duplicate container numbers possible. Charges are fixed columns (can't add a new charge type). No record of who paid each charge. |
| ديون التجار (trader debts) | Per trader: total billed − total received = debt | Typos in names break the SUMIFS. Single currency. |
| قبض الحساب (receipts) | Money received from traders | No receipt numbers. No currency. |
| قاصة (vault) | Money in, with amount in USD and IQD, amount in words, receipt no. | Only one vault. Totals mix sources. Receipt numbers typed by hand. |
| صرف عام (general spending) | Money out (name, USD, IQD, date) | No categories. No link to vault. |
| ديون الشركات (company debts) | Customs owed to each company − transfers paid = remaining | Only customs is tracked. Fines paid by partners are lost. |

Every column above exists in the app (see §5.2 and §12). Nothing the client tracks today is lost.

---

## 2. Users and their world

### 2.1 Primary persona: the owner (المالك)
- **Age:** about 50. Comfortable with WhatsApp and Excel basics. Not comfortable with "software words".
- **Language:** Iraqi Arabic. Reads Arabic; English only for container numbers and shipping-line names.
- **Devices:** an office desktop or laptop (main), plus an Android phone when at the port or out of the office.
- **Eyesight:** may use reading glasses, so needs large text and high contrast.
- **Work pattern:** many short sessions a day:
  - check a container's status for a trader who called
  - add charges after a payment at the port
  - record cash received
  - print a receipt
  - look at the day's cash before going home
- **Fears:** losing money records, typing a wrong number, not knowing whether something was saved.

### 2.2 Secondary people (they do not log in in v1)
- **Traders (التجار):** receive printed or WhatsApp-shared receipts and statements.
- **Parties (الجهات):** the China clearance company (شركة التخليص - الصين), the Umm Qasr partnership clearance party (شراكة تخليص أم قصر), and others. They receive payments and receipts.

### 2.3 v1 access model
- One user: the owner. The data model MUST keep a `users` table with a `role` column so staff accounts can be added in Phase 2 without migration pain.

---

## 3. Goals, non-goals, anti-goals

### 3.1 Goals (v1 MUST deliver)
- G1. Containers keyed by a **unique container number**, with 4 statuses and a full history.
- G2. Fully dynamic **charge types**, each with a default currency, default paying party, and optional default amounts per container size, all managed in Settings.
- G3. **Every money amount records who paid, who received, how much, and in which currency** (double-entry under the hood).
- G4. Separate **IQD and USD balances** for every trader, party, and vault, with a **manually typed exchange rate** whenever money crosses currencies.
- G5. **Main vault (IQD)**, **USD vault**, and **unlimited custom vaults** (a person, an exchange shop, a trader, anything).
- G6. **Numbered receipts** (letter + number) for every money movement, printable as A5 / PDF and shareable on WhatsApp.
- G7. **Account statements** (كشف حساب) for every trader, party, and vault, with running balance, print, and Excel export.
- G8. **Home dashboard** showing all current containers as a big list with status, plus money at a glance.
- G9. **Profit visibility:** the company fee (اتعاب) per container, per trader, per period.
- G10. A UI that a 50+ year-old uses **without training** on desktop, tablet, and phone.

### 3.2 Non-goals (v1)
- Staff accounts and permissions (Phase 2).
- Automatic exchange rates (no reliable source in Iraq).
- Integration with customs, the port, or shipping-line tracking.
- English UI (strings live in a translation file so English can be added later).
- Native mobile app (the responsive web app covers phones).
- Dark mode (Phase 2; the starter kit supports it, but v1 is forced light).

### 3.3 Anti-goals (a failure even if it "works")
- A balance that can't be explained line by line.
- A money record that can be silently edited or deleted.
- Any screen that makes the owner think about "debit" and "credit". The UI says **عليه** (owes us) and **له** (we owe him).
- Tiny text, icon-only buttons, English jargon, or hidden actions behind hover.
- Rounding errors from floating-point math.
- A form that loses typed data on an error.
- Two containers with the same number.

---

## 4. Glossary

| Arabic (UI) | Code name | Meaning |
|---|---|---|
| حاوية | `container` | One shipping container, identified by its number (e.g. `MSCU4829175`). |
| رقم الحاوية | `containerNumber` | The unique key. Usually ISO 6346: 4 letters + 7 digits. |
| تاجر | `trader` | The customer who owns the goods. |
| جهة | `party` | Anyone who pays charges for us or whom we pay: our company itself, clearance companies, partners, others. |
| شركتنا | `party.kind = self` | Our own company as a payer (cash comes from one of our vaults). |
| نوع مصروف | `chargeType` | A kind of charge: customs, fine, shipping, fee... User-defined. |
| مصروف / رسم | `charge` | One charge line on a container. |
| اتعاب | `fee` (charge type with `isFee = true`) | The company's own service fee. **This is the profit.** |
| قاصة | `vault` | A place money sits: main vault, USD vault, a person, an exchange shop. |
| قبض | `receipt in` | Money received. Receipt letter **ق**. |
| صرف | `payment out` | Money paid. Receipt letter **ص**. |
| تحويل | `transfer` | Money moved between two vaults. Letter **ت**. |
| تصريف عملة | `exchange` | Changing USD↔IQD. Letter **ع**. |
| كشف حساب | `statement` | List of movements with running balance. |
| عليه | debit balance (trader/party) | He owes us. Red. |
| له | credit balance (trader/party) | We owe him. Green. |
| سعر الصرف | `fxRate` | Dinar per 1 USD, typed by the user (e.g. 1,310). |
| رصيد افتتاحي | `openingBalance` | Starting balance when moving from Excel to the app. |
| ملغى | cancelled | A record reversed by a cancellation entry. |
| خط الشحن | `shippingLine` | The shipping company (MSC, CMA CGM, Evergreen…). Required on every container. |
| ميناء التحميل | `portOfLoading` | The port where the container was loaded (Shanghai, Ningbo…). Optional, managed in Settings. |
| رقم البوليصة | `billOfLadingNumber` | Bill of lading (B/L) number. Optional. |
| حاوية مشتركة | `isShared` | One container carrying goods for more than one trader. |
| حصة | `share` | How much of a shared container one trader filled (meters, m³, %, or equal). |
| التوزيع | `split` | How one charge is divided between the traders of a shared container. |

---

## 5. Container lifecycle

### 5.1 Statuses

| # | Code | Arabic label | Meaning | Color / icon (Untitled UI) |
|---|---|---|---|---|
| 1 | `confirmed` | تم التأكيد | Job accepted, container entered in the system | gray badge · `ClipboardCheck` |
| 2 | `on_the_way` | في الطريق إلى أم قصر | Shipped, on the way to Umm Qasr port | warning (amber) · `Ship01` (fallback `Navigation`) |
| 3 | `arrived` | وصلت أم قصر | Arrived at Umm Qasr, under clearance | blue · `Anchor` |
| 4 | `delivered` | تم التسليم | Handed to the trader. Done. | success (green) · `PackageCheck` |

> Icon names are from `@untitledui/icons`. If a name doesn't exist, the builder MUST pick the closest icon with `search_icons` in the Untitled UI MCP and record the choice in `DECISIONS.md`.

**Rules**
- New containers start at `confirmed`.
- Moving **forward** one step: one tap on the next step in the status bar → confirm dialog with a date (default today) and an optional note.
- **Skipping** steps is allowed (e.g. confirmed → arrived). The skipped steps are recorded with the same date.
- Moving **backward** is allowed but requires a reason (text, required). It is shown in the history with a warning style.
- Status dates: `arrivedOn` is set when status becomes `arrived`; `deliveredOn` when `delivered`. Moving back clears the later dates.
- Every change writes a row to `container_status_history`.

### 5.2 Container fields

> **Owner's rule (2026-11-24):** only **3 things are required**: the **container number**, the **shipping line**, and the **trader** (or traders, for a shared container). **Everything else is optional.** The registration date fills itself with today.

| Field | Arabic label | Type | Required | Validation and behavior |
|---|---|---|---|---|
| containerNumber | رقم الحاوية | text | **yes** | Normalize: trim, uppercase, remove spaces and dashes. **Unique** (DB unique index). Live check while typing (debounced 400ms): if it exists, show an inline error "هذه الحاوية مسجلة مسبقاً" plus a link "فتح الحاوية". If it doesn't match `^[A-Z]{4}\d{7}$`, show a **soft warning** (amber hint, not blocking): "الرقم لا يطابق الشكل المعتاد (4 أحرف + 7 أرقام). تأكد منه". Input is `dir="ltr"`, `autoCapitalize="characters"`, and shown in large Latin characters. |
| shippingLineId | خط الشحن | link | **yes** | ComboBox with search. Last option "+ إضافة خط جديد" adds a line inline. Seed list: MSC, Maersk, CMA CGM, COSCO, Hapag-Lloyd, ONE, Evergreen, Yang Ming, ZIM, HMM. Managed in Settings. |
| traders (shares) | التاجر | 1..n links | **yes (at least one)** | Normal container: one trader ComboBox. Shared container: a list of traders with their share (see §5.3). ComboBox last option: "+ إضافة تاجر جديد" opens a small modal (name required, phone optional) and selects the new trader. |
| portOfLoadingId | ميناء التحميل | link | no | ComboBox, "+ إضافة ميناء" inline. **Managed in Settings.** Seed list: Shanghai, Ningbo, Qingdao, Shenzhen (Yantian), Guangzhou (Nansha), Xiamen, Tianjin, Jebel Ali, Mersin. |
| billOfLadingNumber | رقم البوليصة (B/L) | text | no | Trim, uppercase, ≤ 40, `dir="ltr"`. Not unique (one B/L can cover several containers). Searchable in global search. |
| containerSizeId | حجم الحاوية | link | no | Segmented buttons (big tap targets): 20 قدم · 40 قدم · 40 قدم عالي · 45 قدم. Managed in Settings, where each size also has a **length in meters** and a **volume in m³** (§5.3). |
| quantity | عدد | integer | no | Default 1, ≥ 1. |
| faxNumber | فاكس | text | no | Free text (≤ 50). |
| companyPartyId | شركة التخليص | link to party | no | Select from parties. Default: the party marked "default clearance company" in Settings (seed: China clearance company). |
| goods | البضاعة | text | no | ≤ 200, with suggestions from past values. In a shared container this field moves into each trader's share row. |
| cartons | عدد الكراتين | integer | no | ≥ 0. Per share row in a shared container. |
| weightKg | الوزن (كغم) | decimal | no | ≥ 0, up to 2 decimals. Per share row in a shared container. |
| destination | الجهة | text | no | ≤ 100, with suggestions from past values. |
| registeredOn | تاريخ التسجيل | date | auto | Default today; editable. |
| expectedArrivalOn | تاريخ الوصول المتوقع | date | no | |
| arrivedOn | تاريخ الوصول | date | auto | Set by status change, editable. |
| deliveredOn | تاريخ التسليم | date | auto | Set by status change, editable. |
| notes | ملاحظة | long text | no | ≤ 2,000. |

### 5.3 Shared containers (حاوية مشتركة): one container, several traders

Sometimes one container carries goods for **more than one trader**. The owner must then divide each charge between the traders, according to **how much of the container each trader filled**. The owner's rule is that the split must be **fully flexible and easy for now**, until they settle on one fixed way.

**How the owner sets it up (in the container form):**
1. Turn on the switch **"حاوية مشتركة (لأكثر من تاجر)"**.
2. Pick how space is measured for this container (**وحدة التقسيم**), as big segmented buttons:
   - **متر طولي** (length in meters), e.g. "4 م"
   - **متر مكعب** (volume, m³), e.g. "28 م³"
   - **نسبة مئوية** (percentage), e.g. "40%"
   - **بالتساوي** (equal split between traders)
3. Add a row per trader with: trader, **share** (number in the chosen unit; hidden for "equal"), and optional goods, cartons, and weight for that trader.
4. Under the rows, a **fill bar** shows the container being filled. It has one colored segment per trader, with labels like "أحمد 4 م · حيدر 5.5 م · فارغ 2.5 م", against the size's capacity (e.g. 40 قدم = 12 م).
   - If the shares exceed the capacity, show an amber warning (not blocking): "مجموع الحصص أكبر من سعة الحاوية".
   - For percentages, the shares must add up to 100% (blocking error: "مجموع النسب يجب أن يساوي 100%").

**Default capacities (editable per size in Settings):**

| Size | Length (m) | Volume (m³) |
|---|---|---|
| 20 قدم | 5.9 | 33 |
| 40 قدم | 12.0 | 67 |
| 40 قدم عالي | 12.0 | 76 |
| 45 قدم | 13.5 | 86 |

**How charges are split:**
- **Default:** each charge is split **in proportion to the shares**: trader share ÷ sum of all shares. Empty space is **not** charged to anyone; it is shown but not billed. (This is my call; see §17.)
- **Per charge, the owner can change the split** in the charges slideout, using a small "التوزيع" control on each row:
  - **حسب الحصص** (by shares): the default
  - **على تاجر واحد** (all on one trader): pick the trader
  - **يدوي** (manual): type an amount per trader. The amounts must add up to the charge total, and a live "المتبقي" (remaining) counter shows the difference.
- The fee (أتعاب) is split the same way and can also be typed per trader.
- **Rounding:** IQD to whole dinar, USD to cents. Any leftover (e.g. 0.01 $) goes to the trader with the largest share, or the first row on a tie, so the parts always add up exactly to the total.
- **Live preview:** every charge row shows the per-trader amounts under it before saving, e.g. "أحمد 842.11 $ · حيدر 1,157.89 $".

**Changing shares later:** charges already saved are money records, so they are **not** re-split silently. The container page offers **"إعادة توزيع المصاريف"** (re-split charges). It lists every affected charge with old and new amounts per trader, and on confirmation it cancels and re-posts those charges in one transaction.

**Normal (single-trader) container:** internally this is just one share of 100%. The same tables and code are used, so there is no special case.

**Status:** a shared container has **one status** (it is one physical box). Each share row MAY have its own "سُلّم للتاجر" (delivered to this trader) tick with a date, shown on the container page.

**Statements:** a trader's statement shows their part only, with the share in the description, e.g. "كمرك بصرة · MSCU4829175 · حصتك 4 م من 9.5 م".

### 5.4 Charges on a container

A **charge** is a line on a container: `chargeType + amount + currency + paidBy (party) + [paidFromVault if paidBy = our company] + split (shared containers) + note`.

**Charge types the owner uses (seeded, all editable in Settings):**

| # | Charge type | Default currency | Default paid by | Is fee (profit)? |
|---|---|---|---|---|
| 1 | كمرك بصرة | USD | شركة التخليص - الصين | no |
| 2 | غرامة شركة الشحن | USD | شركة التخليص - الصين | no |
| 3 | غرامة ميناء | IQD | شراكة تخليص أم قصر | no |
| 4 | أجور نقل بحري | USD | شركة التخليص - الصين | no |
| 5 | أتعاب شركة | USD | — (company profit) | **yes** |
| 6 | أجور نقل الجوي | USD | شركة التخليص - الصين | no |
| 7 | أتعاب أجور نقل | USD | — (company profit) | **yes** (my call; see §17) |

The currency and default payer of each type are my guesses. The owner can change them in Settings on day one.

**Adding charges (the "إضافة مصاريف" slideout):**
1. The owner taps "إضافة مصاريف" on the container page.
2. A slideout opens from the **start side** (right in RTL) with a grid of large checkbox tiles, one per active charge type, in the order set in Settings.
3. Ticking a tile adds a row below with:
   - amount (pre-filled from the default amount for this container's size, if any)
   - currency (pre-filled from the type's default; segmented IQD / USD)
   - paid by (pre-filled from the type's default party)
   - vault (only shown when paid by = شركتنا, and only listing vaults that accept that currency)
   - **split** (only for shared containers, see §5.3)
   - note
4. A button "المصاريف المعتادة" (usual charges) ticks every charge type that has a default amount for this size and fills the rows.
5. A live summary at the bottom shows the totals per currency, how much of it is fees (profit), and, for shared containers, the total per trader.
6. "حفظ المصاريف" opens the confirmation dialog.
   - Single trader: "سيتم تسجيل 2,400 $ على التاجر أحمد عن الحاوية MSCU4829175، منها 300 $ أتعاب".
   - Shared: "سيتم تسجيل 2,400 $ عن الحاوية MSCU4829175: أحمد 1,010.53 $ · حيدر 1,389.47 $".
   - On confirm, all rows are posted **in one database transaction**.

**Editing a charge:** not allowed directly (money records are immutable). The owner taps "إلغاء" on the charge, gives a reason, and adds a new one. The UI SHOULD offer "إلغاء وإضافة بدلاً منه" (cancel and replace), which pre-fills the slideout with the old values.

**The fee (أتعاب):** any charge type with `isFee = true` posts to **fee income** instead of a party. Its "paid by" field is hidden and replaced with the label "ربح الشركة" (company profit). Seeded fee types: أتعاب شركة and أتعاب أجور نقل.

### 5.4a Container money summary (shown on the container page)

| Line | IQD | USD |
|---|---|---|
| Pass-through costs (all non-fee charges) | sum | sum |
| Company fees (profit) | sum | sum |
| **Total billed for this container** | sum | sum |
| Owed to parties for this container (by party) | per party | per party |
| **Shared containers:** total per trader (a table, one row per trader with their share) | per trader | per trader |

Trader payments are **not** allocated to containers (see §6.6), so the container page does not claim "paid/unpaid". It shows each trader's **overall** balance with a link to their statement.

### 5.5 Worked example (confirmed by the owner)

| Event | Trader Ahmed (USD) | China clearance co. (USD) | Umm Qasr partner (USD) | Fee income (USD) | USD vault |
|---|---|---|---|---|---|
| كمرك بصرة $2,000, paid by China co. | عليه 2,000 | له 2,000 | | | |
| غرامة ميناء $100, paid by Umm Qasr | عليه 2,100 | له 2,000 | له 100 | | |
| أتعاب شركة $300 | عليه 2,400 | | | 300 | |
| Ahmed pays $2,400 cash → USD vault (receipt ق-000001) | 0 | | | | +2,400 |
| We pay China $2,000 from USD vault (receipt ص-000001) | | 0 | | | +400 |
| We pay Umm Qasr $100 from USD vault (receipt ص-000002) | | | 0 | | +300 |
| **End** | **0** | **0** | **0** | **300** | **300** |

The $300 left in the vault equals the $300 fee income. This example MUST be an automated test (§15).

### 5.6 Worked example: shared container

Container **CMAU3390418** (40 قدم = 12 م) is shared, with the split unit **متر طولي**: أحمد كاظم 4 م, حيدر عبد الله 5.5 م (total 9.5 م, 2.5 م empty).

| Charge | Total | أحمد (4 ÷ 9.5 = 42.105%) | حيدر (5.5 ÷ 9.5 = 57.895%) | Check |
|---|---|---|---|---|
| كمرك بصرة, paid by China co. | 2,000.00 $ | 842.11 $ | 1,157.89 $ | 2,000.00 ✓ |
| غرامة ميناء, paid by Umm Qasr | 130,000 د.ع | 54,737 د.ع | 75,263 د.ع | 130,000 ✓ |
| أتعاب شركة (fee) | 300.00 $ | 126.32 $ | 173.68 $ | 300.00 ✓ |
| أجور نقل بحري, **manual** split | 900.00 $ | 900.00 $ | 0.00 $ | 900.00 ✓ |
| **Owes us** | | **1,868.43 $ + 54,737 د.ع** | **1,331.57 $ + 75,263 د.ع** | |

Ledger for the customs line (one entry): Dr أحمد (USD) 842.11 · Dr حيدر (USD) 1,157.89 · Cr China co. (USD) 2,000.00. China co. is owed the full 2,000 $; it doesn't care how we split it. This example MUST be an automated test too.

---

## 6. Money model

### 6.1 Principles
1. **Double-entry ledger.** Every money event is one `journal_entry` with ≥ 2 `journal_lines`. For **each currency** inside an entry, total debit = total credit.
2. **Balances are computed** from lines (`SUM(debit) − SUM(credit)`), never stored, never typed.
3. **Immutable.** Entries and lines are insert-only. Mistakes are fixed by a **cancellation** (a reversing entry) and a new correct entry.
4. **Currencies never mix.** Every account exists per currency. Cross-currency events go through an FX clearing account with the typed rate stored on the entry.
5. **Plain language on top.** The UI never shows "debit/credit". It shows عليه/له, "من" (from), "إلى" (to).

### 6.2 Accounts

| Kind | One per | Example | Normal balance shown as |
|---|---|---|---|
| `trader` | trader × currency | Ahmed (USD) | debit = عليه (red), credit = له (green) |
| `party` | party × currency | China clearance co. (USD) | credit = له (we owe them, green), debit = عليه (they owe us, red) |
| `vault` | vault × allowed currency | Main vault (IQD) | debit = الرصيد (balance) |
| `fee_income` | currency | Fee income (USD) | credit = profit |
| `general_expense` | expense category × currency | Rent (IQD) | debit = spent |
| `owner_equity` | currency | Owner capital (IQD) | |
| `fx` | currency | FX clearing (IQD) | technical, hidden from normal screens |
| `opening` | currency | Opening balances | technical |

Accounts are created **lazily** the first time they're used (`UNIQUE(kind, refId, currency)`).

> **Party balance wording:** on a party's page the headline reads "المستحق لهم علينا: 2,000 $" (we owe them) or "المستحق لنا عليهم: …" (they owe us). In lists, use the same عليه/له badges as traders, where له = we owe them.

### 6.3 Money actions and their postings

Every action below is one form in the app (§8.6). "Dr" = debit, "Cr" = credit. All amounts are in the currency chosen on the form unless noted.

| # | Action (Arabic tile) | Receipt | Dr | Cr | Notes |
|---|---|---|---|---|---|
| A1 | Container charge paid by a party | none (container record) | Trader (one line **per trader** in a shared container, using the split) | Party (full amount) | From the charges slideout. |
| A2 | Container charge paid by us (شركتنا) | **ص** | Trader (per trader, split) | Vault | Vault must allow the currency. |
| A3 | Company fee (أتعاب) | none | Trader (per trader, split) | Fee income | |
| A4 | **قبض من تاجر** (receive from trader) | **ق** | Vault | Trader | Same currency. |
| A4x | قبض من تاجر, paid in the other currency | **ق** | Vault (paid currency) / FX (debt currency) | FX (paid currency) / Trader (debt currency) | Rate typed. Example: debt $2,400, paid 3,144,000 IQD at 1,310. |
| A5 | **دفع لجهة** (pay a party) | **ص** | Party | Vault | Cross-currency allowed like A4x. |
| A6 | **دفع لتاجر** (pay / refund / advance a trader) | **ص** | Trader | Vault | |
| A7 | **قبض من جهة** (receive from a party, e.g. refund) | **ق** | Vault | Party | |
| A8 | **إيداع** (owner deposit / capital in) | **ق** | Vault | Owner equity | |
| A9 | **سحب** (owner withdrawal) | **ص** | Owner equity | Vault | |
| A10 | **تحويل بين القاصات** (vault transfer) | **ت** | Vault B | Vault A | Same currency. |
| A11 | **تصريف عملة** (currency exchange) | **ع** | Vault (to-currency) + FX (from-currency) | FX (to-currency) + Vault (from-currency) | Can be the same vault (if it allows both) or two vaults. Rate typed. |
| A12 | **مصروف عام** (general expense) | **ص** | General expense (category) | Vault | Rent, salaries, fuel, etc. |
| A13 | **رصيد افتتاحي** (opening balance) | none | Account or Opening | Opening or Account | Settings → opening balances wizard only. |
| A14 | **إلغاء** (cancel any entry) | same letter as original | exact reverse | exact reverse | Original marked `cancelled` with reason. Both stay visible. |
| A15 | **تسوية بين جهتين** (MAY, offset a trader against a party) | **ت** | Party | Trader | e.g. a party collects directly from a trader on our behalf. |

**Worked cross-currency example (A4x):** Ahmed owes $2,400. He pays 3,144,000 IQD. The owner types rate 1,310.
- Line 1: Dr Main vault (IQD) 3,144,000
- Line 2: Cr FX (IQD) 3,144,000
- Line 3: Dr FX (USD) 2,400
- Line 4: Cr Ahmed (USD) 2,400
- Stored: `fxRate = 1310`, `fromAmount = 3,144,000 IQD`, `toAmount = 2,400 USD`.
- The form computes the other side live and lets the owner adjust either amount (the rate then recomputes). Rounding: IQD to whole dinar, USD to cents.

### 6.4 Currencies and vaults
- Currencies: **IQD** (main, no decimals in UI) and **USD** (2 decimals, hidden when `.00`).
- Each vault has `allowedCurrencies` (one or both). Seeds:
  - **القاصة الرئيسية** (main vault): IQD only, `isMain = true`
  - **قاصة الدولار** (USD vault): USD only
- Money forms MUST only list vaults that accept the chosen currency. The default vault for IQD is the main vault, and for USD the USD vault.
- A vault balance may go negative only after an explicit warning: "رصيد القاصة سيصبح سالباً. هل تريد المتابعة؟"
- **"Main vault comes back every transaction":** the main vault's page shows every cash movement in IQD. The Home "money strip" always shows the main vault first.

### 6.5 Receipts
- **Numbering:** each receipt kind has its own counter: `in` (ق), `out` (ص), `transfer` (ت), `exchange` (ع). Format: `{prefix}-{number padded to 6}`, e.g. `ق-000123`. Prefixes and next numbers are editable in Settings (a number can only move **up**, never down, to avoid duplicates).
- Numbers are assigned **inside the same DB transaction** as the entry, using `SELECT … FOR UPDATE` on `receipt_sequences`. No gaps, no duplicates (tested with 20 concurrent posts).
- **Receipt print layout (A5 portrait; also prints 2-up on A4):**
  ```
  ┌──────────────────────────────────────────────┐
  │  [logo]   اسم الشركة                  وصل قبض │
  │           الهاتف · العنوان          ق-000123 │
  │──────────────────────────────────────────────│
  │ التاريخ: 22/11/2026                           │
  │ استلمنا من: التاجر أحمد كاظم                    │
  │ إلى قاصة: قاصة الدولار                         │
  │ المبلغ:  2,400 $                              │
  │ فقط: ألفان وأربعمائة دولار أمريكي لا غير         │
  │ سعر الصرف: — | الحاويات: MSCU4829175           │
  │ ملاحظة: …                                     │
  │──────────────────────────────────────────────│
  │ توقيع المستلم: ________   توقيع المسلم: ______ │
  │                     [ ملغى ]  (if cancelled)   │
  └──────────────────────────────────────────────┘
  ```
- **Amount in words (تفقيط):** Arabic words for both currencies ("دينار عراقي", "دولار أمريكي" and "سنت"), ending with "لا غير". This is a tested utility.
- Cancelled receipts print with a large diagonal "ملغى" watermark and the cancellation reason.
- **Actions on every receipt:** طباعة (print), حفظ PDF (browser print → Save as PDF), مشاركة واتساب (WhatsApp share: opens `https://wa.me/?text=` with a text summary and, if the trader has a phone, `https://wa.me/<phone>?text=`).

### 6.6 How trader payments relate to containers
- Payments reduce the trader's **overall** balance per currency (like the Excel "ديون التجار" sheet).
- The receive form MAY tag one or more of the trader's containers (`entry_containers`) for reference. Tags appear on the receipt and on the container timeline, but do not change any math.

### 6.7 Profit
- **Profit = sum of fee-income lines** for the period (per currency), minus cancellations.
- The profit report shows profit by period, per trader, and per container.
- General expenses are shown on the same report as "مصاريف عامة" with a **net** line per currency: "صافي الربح = الاتعاب − المصاريف العامة".

---

## 7. Feature specification and user stories

Each story has acceptance criteria (AC). The builder MUST implement all ACs.

### 7.1 Authentication
- **US-1.** As the owner, I log in with a username and password so that my data is private.
  - AC: There is no sign-up page. The first account comes from the seed (env vars). A wrong password shows "اسم المستخدم أو كلمة المرور غير صحيحة". After 5 failed tries in 15 minutes, show "حاول مرة أخرى بعد 15 دقيقة". The session lasts 30 days with "تذكرني" (remember me) on by default. Logout is in the account menu.
- **US-2.** As the owner, I change my password in Settings.
  - AC: The current password is required. The new one must be ≥ 8 characters with show/hide toggles. A success toast appears.

### 7.2 Containers
- **US-3.** I add a container with only the container number, shipping line and trader in under 30 seconds.
  - AC: Only these 3 are required; everything else is optional and folded away (§8.5). Enter moves to the next field. Saving goes straight to the new container's page with a toast "تمت إضافة الحاوية" and a "next step: add charges" hint. "حفظ وإضافة أخرى" keeps the line, port and date for the next container.
- **US-4.** I can never add the same container number twice.
  - AC: Live inline error with a link to the existing container. The server also rejects it (unique index), with the same Arabic message.
- **US-5.** I find any container by typing part of its number anywhere in the app.
  - AC: Global search (§8.2) matches partial numbers, case-insensitive. Results appear within 300ms for 10,000 containers.
- **US-6.** I move a container to the next status with one tap and a confirmation.
  - AC: As in §5.1. The history shows who/when/note.
- **US-7.** I add several charges to a container at once.
  - AC: As in §5.4, including "usual charges", the live totals, the confirmation sentence, and the single transaction.
- **US-8.** I cancel a wrong charge without breaking balances.
  - AC: A reason is required. A reversing entry is posted. The charge shows struck through with a "ملغى" badge and the reason on hover/tap.
- **US-9.** I print a container sheet (all fields, charges, history) for the trader. For a shared container, I can print one sheet per trader showing only their share.
- **US-30.** I mark a container as shared between several traders, enter each trader's share (meters, m³, %, or equal), and every charge is split between them automatically.
  - AC: As in §5.3 and §5.6. A fill bar shows each trader's share and the empty space. Each charge row previews the per-trader amounts. Per charge, I can switch the split to "one trader" or "manual"; manual amounts must add up to the total. Parts always add up exactly (rounding rule). Each trader's statement shows only their part, with their share.
- **US-31.** I change the shares of a shared container after charges were added, and re-split the charges safely.
  - AC: "إعادة توزيع المصاريف" lists every affected charge with old/new amounts per trader. On confirm, the old charges are cancelled and re-posted in one transaction. Balances update everywhere.

### 7.3 Money
- **US-10.** I record money received from a trader and print the receipt immediately.
- **US-11.** I record a dinar payment against a dollar debt with today's rate.
- **US-12.** I pay a party (China company / Umm Qasr / other) and print the receipt.
- **US-13.** I move money between vaults, exchange currency, deposit, withdraw, and record general expenses.
- **US-14.** I cancel any receipt with a reason, and the cancellation gets its own number.
- **US-15.** I see every movement in a journal and filter by type, account, currency, date, and receipt number, then export to Excel.
- AC for all money stories:
  - The form asks only for what that action needs.
  - Defaults are filled in.
  - The confirmation dialog shows the full Arabic sentence before saving.
  - After saving, the receipt opens with Print / PDF / WhatsApp.
  - Balances update everywhere instantly (server revalidation).

### 7.4 Accounts
- **US-16.** I see all traders with their IQD and USD balances (عليه/له), sorted by largest debt first.
- **US-17.** I open a trader and see the statement for any date range with running balance, then print / export / share it.
- **US-18.** Same as above for parties, with a "pay" shortcut.
- **US-19.** I create a custom vault (person / exchange shop / trader / other), choose its currencies, and see its movements.

### 7.5 Dashboard and reports
- **US-20.** When I open the app I see container counts per status, a big list of current containers, warnings, and money at a glance (§8.3).
- **US-21.** I see the profit for today / this month / any range.
- **US-22.** I see the day's cash per vault (opening, in, out, closing) to close the day.
- **US-23.** I see who owes me and whom I owe in one page.

### 7.6 Settings and setup
- **US-24.** I manage charge types, parties, shipping lines, sizes, expense categories, receipt prefixes, the default rate, the warning days, my company profile and logo.
- **US-25.** I enter opening balances when I start using the app (traders, parties, vaults).
- **US-26.** I import my existing containers from my Excel file (same columns as the template).
  - AC: Upload `.xlsx`, then see a preview table with row-level errors (missing trader, duplicate number). Import valid rows. New traders and shipping lines are created automatically after confirmation (rows with no shipping line get one the owner picks for all of them in the preview). The Excel charge columns are mapped to the new charge types: كمرك → كمرك بصرة, غرامة الشركة → غرامة شركة الشحن, غرامة الميناء → غرامة ميناء (paid by the row's "شركة" party), and اتعاب الشركة → أتعاب شركة (fee income), dated on the registration date.
- **US-27.** I make the text bigger or smaller (عادي / كبير / كبير جداً), and it stays on this device.
- **US-28.** I download a full backup of all data as Excel.
- **US-29.** I see a history of every change (سجل التغييرات) in Settings.

---

## 8. Screen-by-screen specification

### 8.1 Global layout

**Desktop (≥ 1024px):**
```
┌──────────────────────────────────────────────────────┬────────────┐
│  [🔍 ابحث برقم الحاوية أو اسم التاجر أو رقم الوصل ]  [+ جديد ▾] │  الشعار    │
│──────────────────────────────────────────────────────│ ▣ الرئيسية │
│                                                      │ ▢ الحاويات │
│                 page content                         │ ▢ المالية  │
│                                                      │ ▢ الحسابات │
│                                                      │ ▢ التقارير │
│                                                      │ ▢ الإعدادات│
│                                                      │ ───────── │
│                                                      │ [حساب المالك]│
└──────────────────────────────────────────────────────┴────────────┘
```
- Sidebar on the **right** (start side in RTL), 280px. Untitled UI `SidebarNavigationSimple`, converted to RTL (border on the start/end side using logical classes).
- Top bar: global search (wide) and a "+ جديد" dropdown (new container, receive, pay, transfer, exchange, expense).
- Page header pattern: title (display-xs), one-line description, and the primary action button at the end of the row.

**Phone (< 768px):**
```
┌─────────────────────────────┐
│ ☰  الشعار          🔍  +    │  ← mobile header
│─────────────────────────────│
│        page content         │
│                             │
│ [ sticky primary action ]   │
│─────────────────────────────│
│ الرئيسية الحاويات المالية الحسابات المزيد │  ← bottom nav, 5 items, icon + label
└─────────────────────────────┘
```
- "المزيد" (more) opens a sheet with Reports, Settings, Logout.

### 8.2 Global search
- Shortcut `Ctrl+K` / `⌘K` (react-hotkeys-hook). Also a tap on the search field.
- Opens a modal with one big input, with results grouped into: الحاويات (container number or B/L number match, partial), التجار (name), الوصولات (receipt number like `ق-123` or just `123`), الجهات.
- Each result shows a key line + secondary line + status badge (for containers).
- Arrow keys / Enter open a result, and Esc closes. Recent searches (last 5) show when the input is empty.

### 8.3 Home (الرئيسية)

```
┌ مساء الخير، {اسم المالك}   (greeting by time of day) ─────────────────────────┐
│ الأحد 22/11/2026                                                    │
├──────────────┬──────────────┬──────────────┬──────────────┐         │
│ تم التأكيد    │ في الطريق     │ وصلت أم قصر   │ سُلّمت هذا الشهر │  ← 4 metric cards
│    12        │    8         │    5         │    21        │    (tap = filter)
├──────────────┴──────────────┴──────────────┴──────────────┘         │
│ ⚠ 3 حاويات في أم قصر منذ أكثر من 7 أيام  [عرض]                         │  ← warning alert
├──────────────────────────────────────────────────────────────────────┤
│ القاصة الرئيسية  48,250,000 د.ع │ قاصة الدولار 12,400 $ │ لنا عند التجار … │ علينا للجهات … │
├──────────────────────────────────────────────────────────────────────┤
│ [+ حاوية جديدة]   [+ قبض]   [+ صرف]                                     │  ← big quick actions
├──────────────────────────────────────────────────────────────────────┤
│ الحاويات الحالية                    [الكل|تم التأكيد|في الطريق|وصلت]   │
│ ┌────────────┬───────────┬─────────┬──────────────┬────────┬────────┐ │
│ │ رقم الحاوية │ التاجر     │ البضاعة  │ الحالة         │ منذ     │ المصاريف │ │
│ │ MSCU4829175│ أحمد كاظم │ أجهزة    │ ⚓ وصلت أم قصر │ 9 أيام ⚠│ 2,400 $ │ │
│ └────────────┴───────────┴─────────┴──────────────┴────────┴────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```
- **Metric cards:** count per status. "Delivered" shows the current month. Tapping filters the list. Each card has a status icon in a `FeaturedIcon` (light theme, status color).
- **Warning alert:** containers with status `arrived` and `arrivedOn` older than N days (Settings). A second alert covers containers `on_the_way` whose `expectedArrivalOn` is in the past.
- **Money strip:** 4 compact cards, with the main vault first. The amount text is display-sm and bold.
- **Container list:** shows non-delivered containers by default (plus delivered in the last 7 days), newest first, with server pagination at 25 per page.
  - Columns: number (bold, LTR), trader (for shared containers: the first name + a "+1" chip with a share icon), goods, status badge, "منذ" (days in current status; amber when over the warning limit), total charges (per currency, stacked).
  - Row tap opens the container.
  - Phone: cards.
- **Empty state (no containers yet):** Untitled UI `EmptyState` with the box illustration, the title "لا توجد حاويات بعد", the text "ابدأ بإضافة أول حاوية", and a "+ حاوية جديدة" button.
- **Loading:** skeleton cards and rows.

### 8.4 Containers list (الحاويات)
- Header: title, count, and "+ حاوية جديدة" (primary, lg).
- Filters bar (wraps on phone into a "تصفية" slideout):
  - status (multi-select chips)
  - trader (ComboBox)
  - shipping line
  - date range (registration)
  - toggle "حاويات متأخرة فقط" (late only)
- Table (Untitled UI `TableCard` + `Table`), sortable by number, trader, status, registration date, and arrival date, with `PaginationCardDefault`.
- Bulk actions (MAY): select rows → change status for many (e.g. a whole ship arrived).
- Export: "تصدير Excel" of the current filter.

### 8.5 Add / edit container form (حاوية جديدة): detailed design

This is the most-used form in the app. It MUST be built exactly as specified here so the first build is right.

#### 8.5.1 What the owner should feel
| Feeling to create | How the design does it |
|---|---|
| "I know where to start." | The page opens with the cursor already in **رقم الحاوية**. Only one card is highlighted, "الأساسيات", and it holds the only 3 required fields. |
| "This is short." | The optional sections are **folded** by default. Their headers say what's inside and how many fields are filled ("2 من 6"), so nothing feels hidden. |
| "I'm not lost." | A numbered path ① ② ③ ④ on the section headers, the same order every time, one column of fields with one straight start edge, and a live summary of what has been entered (desktop). |
| "I can't break anything." | Required fields are clearly marked, errors are explained under the field in plain Arabic, there is a duplicate warning before saving, a draft is kept if the page closes, and a "you have unsaved changes" guard. |
| "It worked." | Saving goes to the new container's page with a green toast and a clear next step: **"الخطوة التالية: إضافة المصاريف"**. |

#### 8.5.2 Structure (always in this order)

| # | Section (card) | Open by default? | Fields |
|---|---|---|---|
| ① | **الأساسيات** (essentials), required | Always open; cannot fold | رقم الحاوية · خط الشحن · التاجر · switch "حاوية مشتركة (لأكثر من تاجر)" |
| ①b | **الحصص** (shares), only when the switch is on | Open | split unit (متر طولي / متر مكعب / نسبة / بالتساوي) · trader rows (trader, share, goods, cartons, weight) · "+ إضافة تاجر آخر" · fill bar |
| ② | **تفاصيل الشحنة** (shipment details), optional | Folded | ميناء التحميل · رقم البوليصة · حجم الحاوية · عدد · فاكس · شركة التخليص |
| ③ | **البضاعة** (goods), optional; hidden for shared containers because it lives in each share row | Folded | البضاعة · عدد الكراتين · الوزن · الجهة |
| ④ | **التواريخ والملاحظات** (dates and notes), optional | Folded | تاريخ التسجيل (today) · تاريخ الوصول المتوقع · ملاحظة |

- In **edit mode**, every section that has data starts **open**.
- The fold/unfold state of each section is remembered on this device (localStorage), so an owner who always fills "البوليصة" sees section ② open next time.
- Folded section headers show a one-line preview of the filled values, e.g. "Shanghai · B/L COSU62341 · 40 قدم".

#### 8.5.3 Desktop wireframe (≥ 1024px)

```
                         ← 32px →                                              sidebar (right)
┌──────────────────────────────────────────────────────────────────────────┬───────────┐
│ الحاويات › حاوية جديدة                         (breadcrumb, text-sm, 24px below)│           │
│ حاوية جديدة                                   (display-xs title)          │           │
│ أدخل الأساسيات الثلاثة. باقي التفاصيل اختيارية ويمكن إضافتها لاحقاً.  (text-md gray)│           │
│                                                                          │           │
│ ┌──── form column (max 720px) ─────────────┐  ┌── summary (320px) ──┐    │           │
│ │ ① الأساسيات                    مطلوب     │  │ ملخص الحاوية         │    │           │
│ │ ───────────────────────────────────────  │  │ رقم: MSCU4829175 ✓   │    │           │
│ │ رقم الحاوية *                            │  │ الخط: MSC ✓          │    │           │
│ │ [            MSCU4829175 ]  ✓ متاح       │  │ التاجر: أحمد كاظم ✓   │    │           │
│ │                                          │  │ ─────────────        │    │           │
│ │ خط الشحن *                               │  │ الحجم: —             │    │           │
│ │ [ MSC                               ▾ ]  │  │ البوليصة: —          │    │           │
│ │                                          │  │                      │    │           │
│ │ التاجر *                                 │  │ ✓ جاهز للحفظ          │    │           │
│ │ [ أحمد كاظم                         ▾ ]  │  └──────────────────────┘    │           │
│ │                                          │      (sticky, top: 24px)     │           │
│ │ ( ◯ ) حاوية مشتركة (لأكثر من تاجر)        │                              │           │
│ └──────────────────────────────────────────┘                              │           │
│              ↕ 24px                                                       │           │
│ ┌──────────────────────────────────────────┐                              │           │
│ │ ② تفاصيل الشحنة         اختياري · 0 من 6 ⌄│  (folded header, 64px tall)  │           │
│ └──────────────────────────────────────────┘                              │           │
│ ┌──────────────────────────────────────────┐                              │           │
│ │ ③ البضاعة               اختياري · 0 من 4 ⌄│                              │           │
│ └──────────────────────────────────────────┘                              │           │
│ ┌──────────────────────────────────────────┐                              │           │
│ │ ④ التواريخ والملاحظات    اختياري · 1 من 3 ⌄│                              │           │
│ └──────────────────────────────────────────┘                              │           │
│══════════════════════════════════════════════════════════════════════════│           │
│ [ حفظ الحاوية ]  [ حفظ وإضافة أخرى ]   [ إلغاء ]        (sticky action bar)│           │
└──────────────────────────────────────────────────────────────────────────┴───────────┘
```

Section ② unfolded (two-column grid only for short paired fields):
```
│ ② تفاصيل الشحنة                                اختياري ⌃ │
│ ─────────────────────────────────────────────────────── │
│ ميناء التحميل (اختياري)                                  │
│ [ Shanghai                                          ▾ ] │
│                                                         │
│ رقم البوليصة B/L (اختياري)                               │
│ [                                       COSU62341 ]     │
│                                                         │
│ حجم الحاوية (اختياري)                                    │
│ [ 20 قدم ][ 40 قدم ][ 40 قدم عالي ][ 45 قدم ]  (segmented) │
│                                                         │
│ عدد (اختياري)              │  فاكس (اختياري)              │
│ [ 1 ]                      │  [            ]             │
│                                                         │
│ شركة التخليص (اختياري)                                   │
│ [ شركة التخليص - الصين                              ▾ ] │
```

Shares card (switch on):
```
│ ①b الحصص                                                     │
│ ─────────────────────────────────────────────────────────── │
│ وحدة التقسيم                                                 │
│ [ متر طولي ●][ متر مكعب ][ نسبة % ][ بالتساوي ]                │
│                                                             │
│ ┌ 1 ───────────────────────────────────────────────── 🗑 ┐ │
│ │ التاجر *                    │ الحصة (متر) *               │ │
│ │ [ أحمد كاظم            ▾ ]  │ [ 4 ]                      │ │
│ │ البضاعة (اختياري)  │ الكراتين (اختياري) │ الوزن (اختياري)  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌ 2 ───────────────────────────────────────────────── 🗑 ┐ │
│ │ [ حيدر عبد الله        ▾ ]  │ [ 5.5 ]                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ [ + إضافة تاجر آخر ]                                         │
│                                                             │
│ امتلاء الحاوية (40 قدم = 12 م)                                │
│ [███████ أحمد 4 م ███████████ حيدر 5.5 م ██████░░░ فارغ 2.5 م] │
│ ستُقسَّم المصاريف: أحمد 42.1% · حيدر 57.9%                      │
```

#### 8.5.4 Phone wireframe (< 768px)
```
┌─────────────────────────────┐
│ →  حاوية جديدة               │  ← header with back arrow (mirrored for RTL)
│─────────────────────────────│ 16px side padding
│ ① الأساسيات         مطلوب   │
│ رقم الحاوية *               │
│ [          MSCU4829175 ]    │
│ خط الشحن *                  │
│ [ MSC                  ▾ ]  │
│ التاجر *                    │
│ [ أحمد كاظم            ▾ ]  │
│ (◯) حاوية مشتركة            │
│─────────────────────────────│ 16px gap
│ ② تفاصيل الشحنة  0 من 6  ⌄  │
│ ③ البضاعة        0 من 4  ⌄  │
│ ④ التواريخ        1 من 3  ⌄  │
│                             │
│ (no summary panel on phone; │
│  the save bar shows "جاهز") │
│═════════════════════════════│
│ [      حفظ الحاوية       ]  │  ← sticky, full width, above safe area
│ حفظ وإضافة أخرى · إلغاء      │  ← text buttons
└─────────────────────────────┘
```
- On phone, the bottom navigation is **hidden** on this page (it's a focused task). The back arrow and the guard for unsaved changes replace it.
- Shares rows stack as one card per trader. The fill bar stays full width.

#### 8.5.5 Spacing and alignment rules (MUST follow exactly)

All spacing is on an **8px grid** (4px for tiny internal gaps). Tailwind v4 classes are given; at the default 112.5% text size everything scales together.

| Element | Rule | Tailwind |
|---|---|---|
| Page side padding | 16px phone · 24px tablet · 32px desktop | `px-4 md:px-6 lg:px-8` |
| Page top padding | 24px phone · 32px desktop | `pt-6 lg:pt-8` |
| Breadcrumb → title | 16px | `mt-4` |
| Title → description | 4px | `mt-1` |
| Description → first card | 24px phone · 32px desktop | `mt-6 lg:mt-8` |
| Form column width | max 720px, full width below that | `w-full max-w-[720px]` |
| Summary panel | 320px, 32px gap from form, sticky `top-6`, only ≥ 1280px | `hidden xl:block w-80 gap-8 sticky top-6` |
| Card | 12px radius, 1px border, very soft shadow, white | `rounded-xl ring-1 ring-secondary shadow-xs bg-primary` |
| Card inner padding | 16px phone · 24px desktop | `p-4 md:p-6` |
| Gap between cards (sections) | 24px | `gap-6` (in a `flex flex-col`) |
| Section header → first field | 20px, with a 1px divider between | `pb-4 border-b border-secondary mb-5` |
| Gap between fields (vertical) | 20px | `gap-5` |
| Label → input | 6px | `gap-1.5` |
| Input → hint/error | 6px | `gap-1.5` |
| Two-column rows (short paired fields only, ≥ 768px) | 16px column gap; each column equal width | `grid md:grid-cols-2 gap-x-4 gap-y-5` |
| Inputs | Untitled UI `size="lg"` (≈ 48–50px tall at 112.5%), full width of their column | `size="lg"`, `w-full` |
| Folded section header | 64px tall, whole header is the tap target | `min-h-16` |
| Sticky action bar | 16px padding, top border, white, safe-area aware, buttons 48px+ | `sticky bottom-0 p-4 border-t border-secondary bg-primary pb-[max(1rem,env(safe-area-inset-bottom))]` |
| Space below last card (so the sticky bar never covers content) | 96px | `pb-24` |

**Alignment rules (RTL):**
1. **One straight start edge.** Every label, input, hint, and section title starts on the same right edge of the column. No centered labels, and no labels beside inputs.
2. **Labels above inputs, always.** Required fields have a red `*` after the label. Optional fields have a gray "(اختياري)". Never use the placeholder as the label; placeholders are examples ("مثال: MSCU4829175").
3. **Two columns only for short pairs** that belong together (عدد + فاكس, الكراتين + الوزن, two dates). Never put a long field (trader, line, notes) in a half column. On phone, everything is one column.
4. **Latin-content inputs** (container number, B/L, fax, numbers) use `dir="ltr"` with `text-end`, so the typed text sits on the **same right edge** as the Arabic labels above it.
5. **Section headers:** number badge ① and title at the start edge; "مطلوب" / "اختياري · 0 من 6" and the fold chevron at the end edge, all vertically centered.
6. **Action bar:** the primary button "حفظ الحاوية" sits **first** (rightmost in RTL), then "حفظ وإضافة أخرى" (secondary), then "إلغاء" (tertiary). On desktop the buttons align with the start of the form column. On phone the primary is full width, with the other two as text buttons under it.
7. **Visual weight:** the "الأساسيات" card has a 2px brand-colored start border (`border-s-2 border-brand`) to mark it as the place to start. All other cards use the normal border.
8. **Icons:** each section header has one 20px line icon (essentials `Container`/`Package`, shipment `Ship01`, goods `Box`, dates `Calendar`), decorative and `aria-hidden`.

#### 8.5.6 Behavior
- **Focus:** `رقم الحاوية` is auto-focused on open. **Enter** moves to the next field (and doesn't submit) until the last required field, where it opens the save confirmation. **Ctrl/⌘+Enter** saves from anywhere.
- **Live checks:** the container number shows a status line under the input: "✓ متاح" (green), "هذه الحاوية مسجلة مسبقاً · فتح الحاوية" (red), or the ISO soft warning (amber).
- **Remembered choices:** the last used shipping line and port of loading are pre-selected (as suggestions, clearly visible, easy to change).
- **Draft safety:** the form autosaves a draft to localStorage every 2 seconds. If the page reopens with a draft, a banner appears: "لديك حاوية لم تُحفظ (MSCU…). [متابعة] [حذف المسودة]".
- **Errors on save:** scroll to and focus the first invalid field. If there's more than one error, show a small summary alert at the top of the form, "يرجى تصحيح حقلين", with links to each field.
- **Saving:** the primary button shows "جارٍ الحفظ…" with a spinner, and the form is disabled.
- **After save:**
  - "حفظ الحاوية": go to the container page. Toast "تمت إضافة الحاوية MSCU4829175". The page shows a highlighted hint card: "الخطوة التالية: إضافة المصاريف" with the button.
  - "حفظ وإضافة أخرى": stay on the form. Clear it but **keep the shipping line, port of loading, and registration date** (a whole ship often arrives together). Focus the container number. Show a toast with a link to the saved container.
- **Edit mode:** the same layout, with the title "تعديل الحاوية MSCU4829175" and all filled sections open. Changing the container number is allowed (still unique) and is logged in the audit. Turning off "shared" when charges exist is blocked with an explanation (re-split first).

### 8.6 Container page

```
┌─────────────────────────────────────────────────────────────────────┐
│ MSCU4829175                                    [تعديل] [طباعة] [⋯] │
│ أحمد كاظم · أجهزة كهربائية · 40 قدم · MSC · Shanghai · B/L COSU62341 │
├─────────────────────────────────────────────────────────────────────┤
│ (1)تم التأكيد ──── (2)في الطريق ──── (3)وصلت أم قصر ──── (4)تم التسليم │ ← progress steps
│   01/11            05/11            14/11 ●            [نقل إلى هذه المرحلة]│
├──────────────────────────────┬──────────────────────────────────────┤
│ المصاريف        [+ إضافة مصاريف]│ ملخص الحساب                             │
│ كمرك      2,000 $  الصين       │ تكاليف: 2,100 $                       │
│ غرامة ميناء 100 $  أم قصر       │ اتعاب (ربح): 300 $                      │
│ اتعاب      300 $  ربح الشركة    │ المجموع على التاجر: 2,400 $             │
│                                │ رصيد التاجر الكلي: عليه 2,400 $ [كشف]   │
├──────────────────────────────┴──────────────────────────────────────┤
│ معلومات الحاوية (cards of fields)                                     │
├─────────────────────────────────────────────────────────────────────┤
│ السجل: timeline of status changes, charges, payments tagged, edits   │
└─────────────────────────────────────────────────────────────────────┘
```
- **Shared container:** under the status steps, a **"الحصص"** card shows the fill bar, one row per trader (share, %, their total charges per currency, their overall balance, and an optional "سُلّم" tick), a button "تعديل الحصص", and, when shares changed after charges were saved, an amber alert with "إعادة توزيع المصاريف". The charges table gets a "التوزيع" column ("حسب الحصص" / trader name / "يدوي") that expands to show per-trader amounts.
- After a new container is saved, a highlighted hint card at the top reads "الخطوة التالية: إضافة المصاريف" with the button (dismissed once charges exist).
- Phone: a vertical status stepper, sections stacked, and a sticky "إضافة مصاريف" button.
- The `⋯` menu holds: WhatsApp share (container summary), print container sheet, and cancel container (only when no active charges; marks it archived, never deletes).

### 8.7 Money (المالية)
- **"معاملة جديدة" grid:** 9 large tiles (≥ 120px tall, icon + title + one-line hint) with a colored accent strip on the start side, plus a journal link:
  - **Green (money in):** قبض من تاجر, قبض من جهة, إيداع
  - **Red (money out):** دفع لجهة, دفع لتاجر, سحب, مصروف عام
  - **Blue (internal):** تحويل بين القاصات, تصريف عملة
  - Below the grid: a gray link to the journal (سجل المعاملات)

**Common form fields:** التاريخ (date, default today), المبلغ (amount, a large `InputNumber` with a currency segmented control), القاصة (vault, filtered by currency, with a default), ملاحظة (note).

| Form | Extra fields |
|---|---|
| قبض من تاجر | التاجر (ComboBox shows current balances under the name). "تسديد الدين كاملاً" (pay full debt) button fills the amount. Toggle "الدفع بعملة أخرى" (pay in the other currency) reveals: debt currency, rate (pre-filled with the last rate), and the converted amount (live). Optional: tag containers (multi-select of the trader's containers). |
| دفع لجهة | الجهة (shows "المستحق لهم"), "تسديد كامل المستحق" (pay everything owed) button, same cross-currency toggle. |
| دفع لتاجر | التاجر. Reason chips: "إرجاع" (refund), "سلفة" (advance), "أخرى" (other). |
| قبض من جهة | الجهة. |
| إيداع / سحب | القاصة only. |
| تحويل | من قاصة → إلى قاصة (same currency, can't be the same vault). |
| تصريف عملة | from currency, from vault, amount → rate → to currency, to vault, amount (live; either amount editable). |
| مصروف عام | التصنيف (category, with inline add), المستفيد (payee, free text). |

**Confirmation dialog** (Untitled UI `Modal` + `FeaturedIcon`):
- Title "تأكيد العملية"
- The full sentence, for example: "سيتم استلام **3,144,000 د.ع** من التاجر **أحمد كاظم** إلى **القاصة الرئيسية** مقابل **2,400 $** بسعر صرف **1,310**"
- A summary list
- Buttons: "تأكيد وحفظ" (primary, lg) and "رجوع" (secondary)

**After saving:** go to the receipt page and show the toast "تم الحفظ · وصل رقم ق-000124".

**Journal (سجل المعاملات):**
- Table columns: receipt no., date, type badge, from → to, amount (per currency), note, status (active / ملغى)
- Filters, and Excel export
- Row → receipt page

**Receipt page:** the on-screen receipt preview (same layout as print) with actions: طباعة, حفظ PDF, واتساب, إلغاء الوصل (cancel; destructive; asks for a reason).

### 8.8 Accounts (الحسابات)
Tabs (Untitled UI `Tabs`, type "button-border" or "underline"): **التجار** | **الجهات** | **القاصات**.

**Traders list:**
- Columns: name, phone, active containers, IQD balance badge, USD balance badge.
- Filter "عليهم ديون فقط" (only with debts). Sort by debt.
- "+ تاجر جديد".
- Phone: cards.

**Trader page:**
- Header: name, phone (tap to call), and two big balance cards (IQD, USD), each "عليه/له + amount".
- Buttons: "استلام دفعة" (primary), "دفع للتاجر", "كشف حساب".
- Tabs: كشف الحساب (statement), الحاويات (containers), معلومات (info).
- **Statement:**
  - Date range picker with presets (this month, last month, this year, all).
  - Currency tabs (IQD / USD).
  - Table: date, receipt/container no., description, عليه (debit), له (credit), الرصيد (running balance with عليه/له).
  - An opening balance row at the top for the range, and a totals row at the bottom.
  - Actions: طباعة (A4 statement layout with header and signature), Excel, WhatsApp (text summary: name, range, closing balances).

**Parties list and page:** the same pattern, with "دفع" as the primary action. It also shows a per-container breakdown "المستحق لهم حسب الحاوية" (MAY).

**Vaults:**
- Card grid. The main vault card is wider and uses the brand solid color with white text. Each card shows the name, type icon, and balances per allowed currency.
- "+ قاصة جديدة" card (dashed border).
- The vault page has a movement list (statement) like traders, plus quick actions: إيداع, سحب, تحويل, تصريف.
- Vault form: name, type (radio cards: شخص person, محل صيرفة exchange shop, تاجر trader, أخرى other), allowed currencies (checkboxes), notes.

### 8.9 Reports (التقارير)
A landing page of report cards (icon + title + description). Each report has a date range, a print layout, and an Excel export.

| Report | Content |
|---|---|
| الأرباح (profit) | Fee income per currency for the range, a bar chart by month (recharts via Untitled UI `charts-base`), a table by trader and by container, general expenses, and net profit. |
| الحاويات (containers) | Counts by status, new containers per month, average days arrived→delivered, and a list of late containers. |
| الديون (debts) | Two tables: traders who owe us (sorted), and parties we owe (sorted), with totals per currency. |
| يومية القاصة (daily cash) | For a chosen day (default today): per vault and currency, the opening balance, money in, money out, and closing balance, plus the list of movements. A "طباعة يومية" button. |
| المصاريف العامة (general expenses) | By category and month. |
| كشف حساب (statement) | A shortcut to pick any trader, party, or vault. |

### 8.10 Settings (الإعدادات)
A left/start sub-navigation (desktop) or a list (phone) with these sections:
1. **معلومات الشركة** (company): name, phone, address, logo upload (stored in DB as a small image ≤ 300KB, or on a Railway volume), receipt footer text.
2. **أنواع المصاريف** (charge types): a sortable list (drag or up/down buttons).
   - Seeded with the owner's 7 types: كمرك بصرة، غرامة شركة الشحن، غرامة ميناء، أجور نقل بحري، أتعاب شركة، أجور نقل الجوي، أتعاب أجور نقل.
   - The edit modal has: name, default currency, default paying party, "هذا أتعاب (ربح)" toggle, default amount per size (a small table: size → amount), and active toggle.
3. **الجهات** (parties): name, kind, phone, notes, active. One party is marked "الشركة الافتراضية" for new containers. "شركتنا" is a system party and cannot be deactivated.
4. **القاصات** (vaults): a link to the vaults tab, plus the default vault per currency.
5. **خطوط الشحن** (shipping lines), **موانئ التحميل** (ports of loading), **تصنيفات المصاريف العامة** (expense categories): simple lists with add, rename, order, and deactivate.
   - **أحجام الحاويات** (container sizes): label, **length (m)** and **volume (m³)** used by shared-container splits (defaults in §5.3).
   - **الحاويات المشتركة** (shared containers): the default split unit (default متر طولي).
6. **الوصولات** (receipts): prefix and next number per kind, with a preview "الوصل التالي: ق-000124".
7. **العملة وسعر الصرف** (currency): the default USD→IQD rate (pre-fill only), and the date the rate was last changed.
8. **التنبيهات** (alerts): the "arrived too long" days (default 7).
9. **العرض** (display): text size (عادي 100% / كبير 112.5% default / كبير جداً 125%), and digits (Western 123 default / Arabic-Indic ١٢٣).
10. **الأرصدة الافتتاحية** (opening balances): a wizard with steps for traders, parties, and vaults. Each row is a name + IQD amount + USD amount + direction (عليه/له).
11. **استيراد من Excel** (import): US-26.
12. **النسخ الاحتياطي** (backup): "تحميل نسخة كاملة (Excel)", one sheet per table.
13. **سجل التغييرات** (audit log): a filterable list.
14. **الحساب** (account): change password, logout.

Rule: anything already used in a record can only be **deactivated**, never deleted.

### 8.11 Print pages
- Routes: `/print/receipt/[id]`, `/print/statement/[kind]/[id]?from&to&currency`, `/print/container/[id]`, `/print/report/[name]?…`.
- No navigation chrome. `@media print` with `@page { size: A5 portrait; margin: 10mm }` for receipts and A4 for statements and reports.
- Uses the company logo and name. The font is embedded through the web font.
- The page auto-opens the print dialog when opened with `?autoprint=1`.

### 8.12 System states (every screen)

| State | Behavior |
|---|---|
| Loading | Skeletons shaped like the content, with no spinners for whole pages. |
| Empty | Untitled UI `EmptyState` with an illustration, a plain sentence, and the primary action. |
| Error (server) | An inline alert "حدث خطأ. لم يتم حفظ أي شيء. حاول مرة أخرى." with a retry button. Typed data is kept. |
| Offline | A top banner "لا يوجد اتصال بالإنترنت" while the browser is offline. Saving buttons are disabled with an explanation. |
| Not found | A friendly Arabic 404 with "العودة للرئيسية". |
| Saving | The button shows `isLoading` + `showTextWhileLoading` ("جارٍ الحفظ…") and the form is disabled, preventing double submit. |
| Success | A toast with a link to the record. Non-money edits get "تراجع" (undo) for 5 seconds. |

---

## 9. Arabic UI copy dictionary

All UI strings MUST live in `messages/ar.json` (next-intl). Key strings:

| Key | Arabic |
|---|---|
| nav.home / containers / money / accounts / reports / settings / more | الرئيسية / الحاويات / المالية / الحسابات / التقارير / الإعدادات / المزيد |
| status.confirmed / on_the_way / arrived / delivered | تم التأكيد / في الطريق إلى أم قصر / وصلت أم قصر / تم التسليم |
| balance.owesUs / weOwe / settled | عليه / له / مسدد |
| action.save / cancel / back / confirmSave / print / pdf / whatsapp / exportExcel | حفظ / إلغاء / رجوع / تأكيد وحفظ / طباعة / حفظ PDF / مشاركة واتساب / تصدير Excel |
| action.newContainer / addCharges / usualCharges / receive / pay | حاوية جديدة / إضافة مصاريف / المصاريف المعتادة / قبض / صرف |
| money.receiveFromTrader / payParty / payTrader / receiveFromParty / deposit / withdraw / transfer / exchange / generalExpense | قبض من تاجر / دفع لجهة / دفع لتاجر / قبض من جهة / إيداع / سحب / تحويل بين القاصات / تصريف عملة / مصروف عام |
| currency.IQD / USD | دينار عراقي (د.ع) / دولار أمريكي ($) |
| error.required | هذا الحقل مطلوب |
| error.duplicateContainer | هذه الحاوية مسجلة مسبقاً |
| error.amountPositive | يجب أن يكون المبلغ أكبر من صفر |
| error.vaultCurrency | هذه القاصة لا تقبل هذه العملة |
| error.server | حدث خطأ. لم يتم حفظ أي شيء. حاول مرة أخرى. |
| warn.negativeVault | رصيد القاصة سيصبح سالباً. هل تريد المتابعة؟ |
| warn.unsaved | لديك تغييرات غير محفوظة. هل تريد الخروج؟ |
| toast.saved | تم الحفظ |
| toast.receiptSaved | تم الحفظ · وصل رقم {number} |
| empty.containers | لا توجد حاويات بعد. اضغط "حاوية جديدة" للبدء. |
| confirm.receive | سيتم استلام {amount} من {from} إلى {vault} |
| confirm.charges | سيتم تسجيل {total} على التاجر {trader} عن الحاوية {number}، منها {fee} أتعاب |
| confirm.chargesShared | سيتم تسجيل {total} عن الحاوية {number}: {perTrader} |
| form.required / optional | مطلوب / اختياري |
| form.containerAvailable | ✓ متاح |
| form.sharedSwitch | حاوية مشتركة (لأكثر من تاجر) |
| form.splitUnit.meters / cbm / percent / equal | متر طولي / متر مكعب / نسبة مئوية / بالتساوي |
| form.addTrader | + إضافة تاجر آخر |
| form.fillBar | امتلاء الحاوية ({size} = {capacity}) |
| form.saveAndNew | حفظ وإضافة أخرى |
| form.nextStep | الخطوة التالية: إضافة المصاريف |
| form.draftFound | لديك حاوية لم تُحفظ ({number}). |
| error.percentTotal | مجموع النسب يجب أن يساوي 100% |
| warn.sharesOverCapacity | مجموع الحصص أكبر من سعة الحاوية |
| error.manualSplitTotal | مجموع المبالغ يجب أن يساوي {total}. المتبقي: {remaining} |
| action.resplit | إعادة توزيع المصاريف |

Tone: polite, short, and direct. Use "أنت" implicitly (imperatives like "اضغط", "اختر"). No technical words (no "خادم", "قاعدة بيانات", "خطأ 500").

---

## 10. Design system

### 10.1 Component library: Untitled UI React (free, open source, MIT)
- The base is the official starter kit `untitleduico/untitledui-nextjs-starter-kit`. Its stack is Next.js 16, React 19.3, TypeScript 6, Tailwind CSS 4.3, React Aria Components, `@untitledui/icons`, motion, recharts, and next-themes.
- Extra components are added with the **Untitled UI MCP** (`https://www.untitledui.com/react/api/mcp`) and CLI (`npx untitledui@latest add <name> --yes`). Only **free** components are assumed; PRO components require a license.
- MUST follow the starter kit's `CLAUDE.md` conventions:
  - React Aria imports are prefixed `Aria*`.
  - Files are kebab-case.
  - Styling uses semantic color classes only (`text-primary`, `bg-secondary`, `border-secondary`, `fg-brand-primary`, …). Never raw palette classes like `text-gray-600`.
  - Disabled states use `opacity-50`.
  - `transition duration-100 ease-linear` for small transitions.
  - Icons are passed as component references.

**Component mapping (what to use where):**

| Need | Untitled UI component (path in starter kit) |
|---|---|
| App shell | `application/app-navigation/sidebar-navigation/sidebar-simple.tsx`, `base-components/mobile-header.tsx` (+ custom bottom nav) |
| Buttons | `base/buttons/button.tsx` (use `size="lg"` by default, `xl` for hero actions) |
| Text / number / date inputs | `base/input/input.tsx`, `input-number.tsx`, `application/date-picker/date-picker.tsx`, `date-range-picker.tsx` |
| Pick lists | `base/select/select.tsx`, `combobox.tsx`, `multi-select.tsx` |
| Toggles / radios / checkboxes | `base/toggle/toggle.tsx`, `base/radio-buttons/radio-buttons.tsx`, `base/checkbox/checkbox.tsx` |
| Segmented control (currency) | `base/button-group/button-group.tsx` |
| Status / balance chips | `base/badges/badges.tsx` (`BadgeWithIcon`, `BadgeWithDot`) |
| Icons in circles | `foundations/featured-icon/…` |
| Tables | `application/table/table.tsx` (`TableCard`, `Table`) + `application/pagination/pagination.tsx` |
| Tabs | `application/tabs/tabs.tsx` |
| Dialogs | `application/modals/modal.tsx` |
| Side sheets | `application/slideout-menus/slideout-menu.tsx` |
| Empty states | `application/empty-state/empty-state.tsx` + `shared-assets/illustrations` |
| Charts | `application/charts/charts-base.tsx` (recharts) |
| Loading | `application/loading-indicator/loading-indicator.tsx` |
| Tooltips | `base/tooltip/tooltip.tsx` (never the only place information lives) |
| File upload (logo, Excel import) | `application/file-upload/file-upload-base.tsx` |
| Toasts | **Not in the free kit.** Use `sonner`, styled with Untitled UI tokens (rounded-xl, `bg-primary`, `ring-secondary`, `FeaturedIcon` sm), positioned bottom-center on phone and bottom-start on desktop. |
| Progress steps (status bar) | Build `container-status-steps.tsx` with tokens; check the MCP for a free "progress steps" component first. |

### 10.2 Right-to-left (RTL): MUST
The free Untitled UI components use **physical** direction classes (about 290 uses of `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, and none of the logical ones). Left as-is, they look broken in Arabic. The builder MUST:
1. Set `<html lang="ar" dir="rtl">` and wrap the app in React Aria `I18nProvider locale="ar-IQ"` (drives date pickers, number fields, and keyboard direction).
2. Run a one-time codemod over `src/components/**` to convert physical classes to **logical** classes:
   - `pl-*`→`ps-*`, `pr-*`→`pe-*`, `ml-*`→`ms-*`, `mr-*`→`me-*`
   - `left-*`→`start-*`, `right-*`→`end-*`
   - `border-l`→`border-s`, `border-r`→`border-e`
   - `rounded-l*`→`rounded-s*`, `rounded-r*`→`rounded-e*`
   - `text-left`→`text-start`, `text-right`→`text-end`
   - `space-x-*` → use `gap` (or add `rtl:space-x-reverse`)
   - Include variant-prefixed classes (`md:pl-4`, `lg:border-r`, etc.).
3. Mirror direction-meaning icons (arrows, chevrons, "back") with `rtl:-scale-x-100`. Do **not** mirror icons that aren't directional (checkmarks, ship, anchor, clock).
4. Slideouts open from the start side and close toward it. Pagination "previous/next" arrows point the right way.
5. Numbers, container numbers, receipt numbers, phone numbers, and dates are wrapped in `<bdi>` or given `dir="ltr"`, with `unicode-bidi: isolate`, so "2,400 $" and "MSCU4829175" never get scrambled.
6. Add a Playwright visual check of the Home, Container, and Money pages in RTL at 375 and 1440px.

### 10.3 Brand tokens (override `src/styles/theme.css`)
Replace the purple brand scale with **navy**:

```css
--color-brand-25:  rgb(246 249 254);
--color-brand-50:  rgb(238 243 253);
--color-brand-100: rgb(222 231 251);
--color-brand-200: rgb(194 210 246);
--color-brand-300: rgb(139 165 230);
--color-brand-400: rgb(83 117 207);
--color-brand-500: rgb(44 79 175);
--color-brand-600: rgb(30 58 138);   /* #1E3A8A primary buttons */
--color-brand-700: rgb(25 47 115);
--color-brand-800: rgb(21 38 94);
--color-brand-900: rgb(18 31 77);
--color-brand-950: rgb(11 20 52);
```
- Keep Untitled UI's own gray, error, warning, and success scales (they already pass contrast).
- `viewport.themeColor = "#1E3A8A"`.

**Semantic money and status mapping (always color + icon + word):**

| Meaning | Badge color | Icon |
|---|---|---|
| عليه (owes us) | `error` | `ArrowUpLeft` (or `TrendUp01`) |
| له (we owe) | `success` | `ArrowDownRight` (or `TrendDown01`) |
| مسدد (settled) | `gray` | `CheckCircle` |
| Money-in tiles and receipts | `success` | `ArrowCircleDown` / `Wallet02` |
| Money-out tiles and receipts | `error` | `ArrowCircleUp` |
| Internal (transfer, exchange) | `blue` | `SwitchHorizontal01` / `CurrencyDollarCircle` |
| Status colors | see §5.1 | |

### 10.4 Typography
- Font: **IBM Plex Sans Arabic** (Google Fonts; Arabic + Latin; weights 400, 500, 600, 700) via `next/font/google`. It sets `--font-body` and `--font-display` in `theme.css`, replacing Inter.
  - This is my pick; the design database had no strong Arabic match. Alternatives if the client prefers: Noto Kufi Arabic, Cairo, Tajawal.
- **Base size:** the root font-size is driven by the Text size setting: **112.5% (18px) default**, 100%, or 125%. Tailwind v4 sizes are rem-based, so the whole UI scales together.
- `font-variant-numeric: tabular-nums` on all amounts and tables.
- Line height 1.6 for Arabic body text. Never use letter-spacing on Arabic.
- Minimum text size: 14px for captions (at the 100% setting). Body is 16–18px.

### 10.5 UX rules for a 50+ non-technical user (MUST)
1. **One primary action per screen**, big and filled (`size="lg"` or `xl`). Secondary actions are outlined. Destructive actions are red and always confirmed.
2. **Labels always visible** above inputs. Placeholders are examples only. Hints sit under the field. Errors sit under the field, in plain Arabic, in red with an icon.
3. **Touch targets ≥ 48px** tall, with ≥ 8px gaps. **No icon-only buttons** except where a visible tooltip and `aria-label` exist and the meaning is universal (close X).
4. **Smart defaults:** today's date, main vault, the last exchange rate, the charge type's currency and party, and the default clearance company.
5. **Say what will happen before money is saved** (the confirmation sentence), and say what happened after (toast + receipt).
6. **Nothing important hides behind hover.** Every hover tooltip also works on tap/focus.
7. **Undo** for non-money edits (5 seconds). **Cancel with reason** for money.
8. **Consistent places:** the primary action sits at the end of the page header (left side in RTL) on desktop, and sticky at the bottom on phone.
9. **Plain numbers:** thousands separators, the currency symbol after the number ("2,400 $", "3,144,000 د.ع"), and no decimals for IQD.
    - **Dates:** numeric `dd/MM/yyyy` with Latin digits everywhere (e.g. 24/11/2026). Where a month name is written out (greeting, report titles), use the **Iraqi month names**: كانون الثاني، شباط، آذار، نيسان، أيار، حزيران، تموز، آب، أيلول، تشرين الأول، تشرين الثاني، كانون الأول. Never "نوفمبر"-style names, and never mix Arabic-Indic and Latin digits on one screen.
10. **Forgiving inputs:**
    - Amount fields accept "2400", "2,400", and Arabic-Indic digits "٢٤٠٠".
    - Container number accepts lowercase and spaces (it's normalized).
    - Phone numbers accept 07xx and +964.
11. **Focus visible** (Untitled UI focus rings stay on). Keyboard order follows RTL reading order.
12. **Motion:** 100–200ms fades and slides only, honoring `prefers-reduced-motion`. No bouncing or parallax.
13. **Contrast** ≥ 4.5:1 for text and ≥ 3:1 for icons and borders that carry meaning.
14. **Language:** the owner's own words from the Excel file (كمرك، اتعاب، قاصة، قبض، صرف). No English in the UI except container numbers, line names, and currency codes.

---

## 11. Responsiveness

Mobile-first CSS. Desktop is the main daily device, and the phone must be fully usable for every action.

| Width | Navigation | Tables | Forms | Primary action |
|---|---|---|---|---|
| < 768 (phone) | Mobile header + **bottom nav (5 items, icon + label)** | Become **cards** (key fields only, tap to open) | Single column, full-width inputs | **Sticky bottom bar** |
| 768–1023 (tablet) | Collapsible sidebar (hamburger) | Key columns, the rest in an expandable row | Two columns where natural | Page header |
| ≥ 1024 (desktop) | Fixed right sidebar 280px | Full tables | Two or three columns in cards | Page header end |
| ≥ 1440 | Content max-width 1280px, centered | | | |

- MUST have no horizontal page scroll at 360px. Wide tables on tablet scroll inside their card only.
- Safe-area insets for the bottom nav on iOS (`env(safe-area-inset-bottom)`).
- Test sizes: 360, 390, 768, 1024, 1440.
- Pull-to-refresh is not needed (data revalidates on navigation).
- Phone keyboard: amount fields use `inputMode="decimal"`, phone fields `inputMode="tel"`, and the container number uses `autoCapitalize="characters"`.

---

## 12. Data model

PostgreSQL on **Neon**, accessed with **Drizzle ORM** and migrated with drizzle-kit. Conventions:
- Primary keys are `uuid` with `gen_random_uuid()`.
- Timestamps are `timestamptz`.
- Money is `numeric(18,2)` and rates `numeric(14,4)`.
- Table and column names are `snake_case`.
- Every table has `created_at`, and editable tables have `updated_at` too.

### 12.1 Enums
```
currency            : 'IQD' | 'USD'
container_status    : 'confirmed' | 'on_the_way' | 'arrived' | 'delivered'
split_unit          : 'meters' | 'cbm' | 'percent' | 'equal'
split_mode          : 'by_share' | 'single_trader' | 'manual'
party_kind          : 'self' | 'clearance_company' | 'partner' | 'other'
vault_kind          : 'main' | 'usd' | 'person' | 'exchange_shop' | 'trader' | 'other'
account_kind        : 'trader' | 'party' | 'vault' | 'fee_income' | 'general_expense' | 'owner_equity' | 'fx' | 'opening'
entry_type          : 'container_charge' | 'receive_from_trader' | 'receive_from_party' | 'pay_party' | 'pay_trader'
                      | 'deposit' | 'withdraw' | 'transfer' | 'exchange' | 'general_expense' | 'opening_balance'
                      | 'trader_party_offset' | 'reversal'
receipt_kind        : 'in' | 'out' | 'transfer' | 'exchange'
user_role           : 'owner'   (Phase 2: 'staff')
```

### 12.2 Tables
```
users                id, name, username UNIQUE, password_hash, role user_role, is_active, created_at, updated_at
(+ Better Auth tables: session, account, verification — generated by its Drizzle adapter)

company_settings     id (singleton row), name, phone, address, logo (bytea or url), receipt_footer,
                     default_usd_iqd_rate numeric(14,4), rate_updated_at, arrived_warning_days int default 7,
                     default_clearance_party_id → parties, default_vault_iqd_id → vaults, default_vault_usd_id → vaults

traders              id, name, phone, city, notes, is_active, created_at, updated_at
                     UNIQUE (lower(name)) WHERE is_active
parties              id, name, kind party_kind, phone, notes, is_system bool, is_active, created_at, updated_at
vaults               id, name, kind vault_kind, allowed_currencies currency[], notes, is_system bool, is_active, ...
shipping_lines       id, name UNIQUE, is_active
container_sizes      id, code UNIQUE, label, length_m numeric(6,2), volume_m3 numeric(7,2), sort_order, is_active
ports_of_loading     id, name UNIQUE, country, sort_order, is_active
charge_types         id, name UNIQUE, default_currency currency, default_party_id → parties NULL,
                     is_fee bool default false, sort_order, is_active
charge_type_defaults id, charge_type_id → charge_types, container_size_id → container_sizes NULL, amount numeric(18,2)
                     UNIQUE (charge_type_id, container_size_id)
expense_categories   id, name UNIQUE, is_active

containers           id, container_number text UNIQUE NOT NULL, shipping_line_id → shipping_lines NOT NULL,
                     port_of_loading_id → ports_of_loading NULL, bill_of_lading_number text NULL,
                     is_shared bool default false, split_unit split_unit NULL (required when is_shared),
                     fax_number, container_size_id, quantity int default 1,
                     company_party_id → parties, destination,
                     status container_status default 'confirmed',
                     registered_on date NOT NULL, expected_arrival_on date, arrived_on date, delivered_on date,
                     status_changed_at timestamptz, notes, archived_at, created_at, updated_at
container_shares     id, container_id → containers, trader_id → traders, share_value numeric(10,3) NULL (NULL when 'equal'),
                     goods, cartons int, weight_kg numeric(12,2), delivered_on date NULL, sort_order,
                     UNIQUE (container_id, trader_id)
                     (a normal container has exactly ONE row; goods/cartons/weight live here for every container)
container_status_history id, container_id, from_status NULL, to_status, changed_on date, note, is_backward bool, created_at, user_id
container_charges    id, container_id, charge_type_id, amount, currency, paid_by_party_id NULL (NULL when fee),
                     paid_from_vault_id NULL, split_mode split_mode default 'by_share', journal_entry_id → journal_entries, note,
                     cancelled_at, cancel_reason, created_at, user_id

container_charge_allocations id, charge_id → container_charges, trader_id → traders, amount numeric(18,2)
                     (one row per trader; amounts add up exactly to the charge amount; written in the same tx as the charge)

accounts             id, kind account_kind, ref_id uuid NULL, currency, name, UNIQUE (kind, ref_id, currency)
journal_entries      id, type entry_type, receipt_kind NULL, receipt_no text UNIQUE NULL,
                     entry_date date NOT NULL, description, counterparty_label,
                     container_id NULL, fx_rate numeric(14,4) NULL,
                     reverses_entry_id NULL → journal_entries, cancelled_at, cancel_reason,
                     created_at, user_id
journal_lines        id, entry_id → journal_entries, account_id → accounts, currency,
                     debit numeric(18,2) default 0 CHECK (debit >= 0),
                     credit numeric(18,2) default 0 CHECK (credit >= 0),
                     CHECK (debit = 0 OR credit = 0), CHECK (debit > 0 OR credit > 0)
entry_containers     entry_id, container_id, PRIMARY KEY (entry_id, container_id)
receipt_sequences    kind receipt_kind PRIMARY KEY, prefix text, next_number int
audit_log            id, table_name, record_id, action ('create'|'update'|'cancel'|'status'|'login'),
                     before jsonb, after jsonb, user_id, at timestamptz
```

### 12.3 Integrity, views, indexes
- **Balanced entries:** a `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` on `journal_lines` checks, at commit, that for the entry, `SUM(debit) = SUM(credit)` per currency. The service layer also checks before insert, so the error message stays friendly.
- **Immutability:** a trigger blocks `UPDATE`/`DELETE` on `journal_lines`. On `journal_entries`, only `cancelled_at` and `cancel_reason` may be updated.
- **Account currency match:** a line's currency MUST equal its account's currency (trigger or service check).
- **Vault currency:** a vault account may only exist for currencies in `vaults.allowed_currencies`.
- **Views:**
  - `account_balances(account_id, kind, ref_id, currency, balance)` = `SUM(debit − credit)` over non-reversed lines (reversals cancel naturally because they're posted).
  - `container_totals(container_id, currency, costs, fees, total)` and `container_trader_totals(container_id, trader_id, currency, costs, fees, total)` (from allocations).
- **Indexes:**
  - `containers(status)`, `containers(trader_id)`, `containers(registered_on)`
  - a `pg_trgm` GIN index on `containers.container_number` and `traders.name` (partial search)
  - `journal_lines(account_id)`, `journal_lines(entry_id)`
  - `journal_entries(entry_date)`, `journal_entries(receipt_no)`
- Performance target: the Home page under 1s and search under 300ms with 10,000 containers and 100,000 journal lines.

### 12.4 Seed data
- Owner user from `OWNER_USERNAME`/`OWNER_PASSWORD`/`OWNER_NAME`.
- Parties:
  - شركتنا (`self`, system)
  - شركة التخليص - الصين (`clearance_company`, default company)
  - شراكة تخليص أم قصر (`partner`)
- Vaults:
  - القاصة الرئيسية (`main`, `{IQD}`, system)
  - قاصة الدولار (`usd`, `{USD}`, system)
- Charge types:

| Name | Currency | Party | Fee |
|---|---|---|---|
| كمرك بصرة | USD | China co. | no |
| غرامة شركة الشحن | USD | China co. | no |
| غرامة ميناء | IQD | Umm Qasr partner | no |
| أجور نقل بحري | USD | China co. | no |
| أتعاب شركة | USD | — | **yes** |
| أجور نقل الجوي | USD | China co. | no |
| أتعاب أجور نقل | USD | — | **yes** |

- Sizes with capacity: 20ft (5.9 m, 33 m³), 40ft (12.0 m, 67 m³), 40HC (12.0 m, 76 m³), 45ft (13.5 m, 86 m³).
- Ports of loading: Shanghai, Ningbo, Qingdao, Shenzhen (Yantian), Guangzhou (Nansha), Xiamen, Tianjin, Jebel Ali, Mersin.
- Shipping lines: §5.2 list.
- Expense categories: إيجار (rent), رواتب (salaries), وقود ونقل (fuel and transport), ضيافة (hospitality), أخرى (other).
- Receipt sequences: ق/ص/ت/ع starting at 1.
- Default rate: 1310 (pre-fill only; the owner changes it).
- `db:demo` (separate command): 10 traders, 30 containers across all statuses, charges, and payments in both currencies.

---

## 13. Backend architecture

### 13.1 Stack
- **Next.js 16 (App Router)** from the Untitled UI starter kit, **TypeScript strict**, **Server Components** for reads, and **Server Actions** for writes.
  - Note: Next.js 16 has breaking changes. The builder MUST read `node_modules/next/dist/docs/` before writing routing and caching code, as the starter kit's `CLAUDE.md` says.
- **Drizzle ORM** + `pg` (node-postgres) with the **Neon pooled connection string** (`-pooler` host, `sslmode=require`). Railway runs a long-lived Node process, so one shared `Pool` (max 10) is used.
- **Zod** for every input. **decimal.js** for every money calculation.
- **Better Auth** with the Drizzle adapter: username + password (username plugin), sign-up disabled, and sessions in the DB.
- **next-intl** for strings (Arabic only for now).
- **exceljs** for Excel import and export.
- **sonner** for toasts and **react-hotkeys-hook** (already in the kit) for shortcuts.

### 13.2 Code layout
```
src/
  app/
    (auth)/login/page.tsx
    (app)/layout.tsx                 ← shell: sidebar, mobile header, bottom nav, search, toaster
    (app)/page.tsx                   ← Home
    (app)/containers/page.tsx  new/page.tsx  [id]/page.tsx  [id]/edit/page.tsx
    (app)/money/page.tsx  new/[action]/page.tsx  journal/page.tsx  receipts/[id]/page.tsx
    (app)/accounts/traders/…  parties/…  vaults/…
    (app)/reports/page.tsx  [report]/page.tsx
    (app)/settings/[section]/page.tsx
    print/receipt/[id]/page.tsx  print/statement/[kind]/[id]/page.tsx  print/container/[id]/page.tsx  print/report/[name]/page.tsx
    api/export/[name]/route.ts  api/import/containers/route.ts  api/health/route.ts  api/auth/[...all]/route.ts
  components/          ← Untitled UI (converted to RTL)
  components/app/      ← our components: status-badge, balance-badge, money-amount, money-input, currency-toggle,
                          confirm-money-dialog, container-status-steps, data-table-or-cards, page-header, bottom-nav,
                          global-search, vault-select, trader-combobox, party-select, receipt-view, statement-table
  features/
    containers/  (actions.ts, service.ts, queries.ts, schemas.ts)
    charges/
    ledger/      (post-entry.ts, reverse-entry.ts, balances.ts, statements.ts, receipt-numbers.ts, postings.ts)
    traders/  parties/  vaults/  reports/  settings/  imports/  search/  audit/
  db/ schema.ts  index.ts  seed.ts  demo.ts  triggers.sql
  lib/ money.ts  tafqeet.ts  container-number.ts  format.ts  digits.ts  whatsapp.ts  auth.ts
  messages/ ar.json
tests/ unit/  e2e/
```

### 13.3 Layer rules (MUST)
- **Pages/components:** read through `features/*/queries.ts` (server-only), and write only by calling `features/*/actions.ts`.
- **actions.ts:** `"use server"`. Checks the session, parses with Zod, calls the service, calls `revalidatePath`/`revalidateTag`, and returns `{ ok: true, data } | { ok: false, fieldErrors?, message }` (Arabic messages).
- **service.ts:** business rules, all in `db.transaction(...)`, and writes the audit log.
- **No SQL or Drizzle calls in components.** `server-only` is imported in queries and services.

### 13.4 Ledger API (single entry point for money)
```ts
postEntry(tx, {
  type: EntryType,
  date: string,                // yyyy-mm-dd
  receiptKind?: ReceiptKind,   // assigns next number inside tx
  description: string,
  counterpartyLabel?: string,
  containerId?: string,
  containerTags?: string[],
  fxRate?: string,
  lines: Array<{ account: AccountRef; currency: Currency; debit?: string; credit?: string }>,
}): Promise<{ entryId: string; receiptNo?: string }>

reverseEntry(tx, entryId, reason): Promise<{ entryId: string; receiptNo?: string }>
getBalance(accountRef, currency): Promise<string>
getBalances(kind, refId): Promise<{ IQD: string; USD: string }>
getStatement(accountRef, currency, from, to): Promise<{ opening: string; rows: StatementRow[]; closing: string }>
```
- `AccountRef = { kind: AccountKind; refId?: string }` is resolved or created lazily inside the tx.
- `features/ledger/postings.ts` holds one pure function per action (A1–A15) that returns the `lines` array, which makes it easy to unit test.

### 13.5 Other services
- `containers.service`: `create` (container + shares in one tx), `update`, `setShares`, `changeStatus` (forward/skip/back with reason), `archive`, `addCharges` (multi-row in one tx, writes allocations), `cancelCharge`, `previewResplit`, `resplitCharges` (cancel + re-post in one tx).
- `features/charges/split.ts`: pure function `splitAmount(total, currency, shares, mode, manual?) → allocations[]` with the rounding rule from §5.3 (largest share gets the remainder). Fully unit-tested.
- `search.queries`: a trigram search across containers (number and B/L), traders, receipts, and parties (limit 5 per group).
- `reports.queries`: profit, containers, debts, daily cash, and expenses, all through SQL aggregates on `account_balances` and `journal_lines`.
- `imports.service`: parses the client Excel (header row = row 6 of "تفاصيل", as in the template), validates, previews, and commits.
- `lib/tafqeet.ts`: `toArabicWords(amount: string, currency: Currency): string`.
- `lib/container-number.ts`: `normalize()`, `isIso6346()` (MAY also validate the check digit, shown as a soft warning only).
- `lib/format.ts`: `formatMoney(amount, currency, {digits})`, `formatDate`, `formatNumber`.
- `lib/whatsapp.ts`: builds `wa.me` links with URL-encoded Arabic text.

---

## 14. Hosting, security, operations

### 14.1 Railway
- One service from the GitHub repo, which auto-deploys on push to `main`.
- Node 22. Build `pnpm build`, start `pnpm start`, **pre-deploy** `pnpm db:migrate`.
- Env vars: `DATABASE_URL` (Neon pooled), `DATABASE_URL_UNPOOLED` (for migrations), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `OWNER_USERNAME`, `OWNER_PASSWORD`, `OWNER_NAME` (seed only), and `TZ=Asia/Baghdad`.
- Health check: `/api/health` (checks DB connectivity).
- Railway region close to the Neon region (e.g. both EU-central) to keep latency low.

### 14.2 Neon
- Production branch plus a `dev` branch for development.
- Use the pooled connection for the app and the unpooled one for migrations.
- Check point-in-time restore retention on the chosen plan, and write it in `DEPLOY.md`.

### 14.3 Cloudflare in front
- The domain's DNS is on Cloudflare. The `CNAME` to the Railway custom domain is **proxied (orange cloud)**.
- SSL/TLS **Full (strict)**. "Always Use HTTPS" on. HSTS on (after testing).
- WAF managed rules on. Bot Fight Mode on.
- **Rate-limit rule:** `/login` and `/api/auth/*` at 10 requests/minute per IP.
- Cache rule: bypass cache for everything except `/_next/static/*` and fonts.
- MAY: **Cloudflare Access** (Zero Trust) in front of the whole app for an extra login layer, e.g. one-time PIN to the owner's email.

### 14.4 App security
- All routes except `/login`, `/api/auth/*`, and `/api/health` require a session (Next middleware/proxy + a check inside every action).
- Headers: `Content-Security-Policy` (self + Google Fonts), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- Passwords are hashed with scrypt/argon2 (Better Auth default). Cookies are `httpOnly`, `secure`, and `sameSite=lax`.
- The login rate limit lives in the app too, not only Cloudflare.
- Excel import: max 5MB, `.xlsx` only, parsed server-side, with no formulas evaluated.
- Secrets live only in Railway env, never in the repo.

### 14.5 Operations
- **Backups:** Neon PITR, plus the owner's "download full backup" button. `DEPLOY.md` SHOULD describe a weekly manual download habit.
- **Logs:** Railway logs. Errors are logged with a request id. Sentry is optional.
- **Time zone:** all "today" logic uses `Asia/Baghdad`.

---

## 15. Testing strategy

### 15.1 Unit (Vitest), MUST pass before any milestone is done
- Every posting function A1–A15 produces balanced lines per currency.
- The worked example (§5.5) ends with trader 0, parties 0, fee income 300 USD, and the USD vault 300.
- Cross-currency receive (A4x) and exchange (A11): correct lines, rate stored, and rounding rules.
- A reversal restores the exact previous balances.
- Receipt numbering: 20 concurrent `postEntry` calls produce 20 unique, gapless numbers (integration test against a Neon dev branch or local Postgres).
- `tafqeet`: 0, 1, 2, 11, 100, 1,000, 2,400, 1,000,000, 3,144,000 IQD; 2,400.50 USD.
- `container-number`: normalization, ISO format, uniqueness errors.
- `format`: separators, currency placement, digits setting.
- Excel import: header mapping, a duplicate row, a missing trader, and a missing shipping line.
- `splitAmount`: proportional split by meters / m³ / % / equal; the §5.6 example exactly; rounding leftovers (e.g. 100 $ split 3 ways = 33.34 + 33.33 + 33.33); IQD whole-dinar rounding; manual split that doesn't add up is rejected; single-trader mode.
- The shared-container example (§5.6) posts balanced entries, and each trader's balance matches the table.
- Re-split: changing shares and re-splitting leaves the party balance unchanged and moves only trader balances.

### 15.2 End-to-end (Playwright, RTL, at 390px and 1440px)
1. Login.
2. Add a trader inline while adding a container (only number, line, and trader filled; save in under 30 seconds).
3. Add charges with "usual charges".
3b. Add a shared container with two traders (meters), add charges, and check the per-trader amounts and statements.
4. Move the status to Arrived.
5. Receive a payment in IQD against a USD debt.
6. Print the receipt (check the print page renders the number and the amount in words).
7. Check the trader statement closing balance.
8. Cancel the receipt and check the balance goes back.
9. Visual snapshots of Home, Container, and Money pages (RTL layout check).

### 15.3 Manual checklist before handing to the client
- Read every screen at 125% text size on a phone.
- Print a receipt on real A5 and A4 paper.
- Try every form with wrong input and check the Arabic messages.
- Run the whole §5.5 example by hand.

---

## 16. Acceptance checklist (Definition of Done)

- [ ] All user stories US-1 to US-31 meet their acceptance criteria.
- [ ] The container form matches §8.5 (structure, spacing table, alignment rules, behavior) at 390px and 1440px.
- [ ] The shared-container example (§5.6) passes as an automated test.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm e2e` all pass.
- [ ] The worked example (§5.5) passes as an automated test and by hand.
- [ ] No physical direction classes remain in `src/components` (`grep` for `\b(pl|pr|ml|mr|left|right)-` returns nothing relevant).
- [ ] No raw palette color classes (`text-gray-*`, `bg-blue-*`, …) in our code.
- [ ] No hard-coded Arabic strings in components (all in `messages/ar.json`).
- [ ] No horizontal scroll at 360px on any page.
- [ ] Every money form shows the confirmation sentence and produces a printable, numbered receipt.
- [ ] Every balance on screen matches `account_balances`.
- [ ] Lighthouse accessibility ≥ 95 on Home, Container, and Money pages.
- [ ] Deployed on Railway behind Cloudflare with SSL Full (strict), the WAF on, and the login rate-limited.
- [ ] `README.md`, `DEPLOY.md`, and `DECISIONS.md` written.

---

## 17. Decisions made without the owner (please confirm)

1. The **fee (اتعاب) is a charge type** with `isFee = true` and default amounts per container size. It is editable per container.
2. **Trader payments reduce the trader's overall balance**, not one container. Containers can be tagged on a payment for reference.
3. **"عدد" (count)** is a quantity field (default 1). Each record is still one container number. Goods, cartons and weight now live on the trader's share row (one row for a normal container).
4. **"شركة"** on a container links to the parties list (default: China clearance company).
5. **Receipt letters:** ق (in), ص (out), ت (transfer), ع (exchange), each with its own counter. Editable.
6. **Light theme only** in v1. Navy brand. IBM Plex Sans Arabic. Default text size 18px. Western digits by default.
7. **Money records are never edited or deleted.** Cancel = reversing entry with its own receipt number.
8. **PDF = the browser's "Save as PDF"** from print pages (reliable Arabic shaping, no PDF library).
9. **"Arrived too long" warning** after 7 days (editable).
10. **Better Auth** single owner login. No sign-up page.
11. **Seed charge-type currencies and payers** (كمرك بصرة in USD paid by China co., غرامة ميناء in IQD paid by Umm Qasr, …) are guesses. The owner should adjust them in Settings on day one.
12. **Toasts via `sonner`**, because the free Untitled UI kit has no toast component.
13. **Excel import** of the client's existing filled workbook is included in v1 (US-26), since the template sheet layout is known.
14. **Container statuses can be skipped or reversed** (with a reason).
15. **"أتعاب أجور نقل" is treated as company profit (fee)**, like "أتعاب شركة", because it's named أتعاب. If it's actually a cost paid to someone, the owner switches off "هذا أتعاب" in Settings.
16. **Port of loading vs shipping line:** the owner's examples for port of loading (CMA, MSC, Evergreen) are shipping-line names, which already have their own required field "خط الشحن". So "ميناء التحميل" is a separate optional list of **ports** (Shanghai, Ningbo…). If the owner meant something else, rename the field in Settings.
17. **Shared containers: empty space is not charged.** Charges are split only between the traders, in proportion to their shares. The fill bar still shows the empty space.
18. **Shared containers: one status for the whole container**, plus an optional per-trader "delivered" tick.
19. **Changing shares never silently changes saved charges.** The owner re-splits explicitly, and the app cancels and re-posts the affected charges.
20. **Default split unit = متر طولي** (meters), editable in Settings and per container.

---

## 18. Phase 2 roadmap
- Staff accounts with roles (e.g. a clerk who can't see profit or vaults).
- Document photos and scans per container (bill of lading, customs declaration), stored in Cloudflare R2.
- Dark mode and English UI.
- A trader portal: a private link where a trader sees their containers and statement.
- A daily WhatsApp summary to the owner (WhatsApp Business API).
- A calendar of expected arrivals.
- Container-level settlement (allocate payments to containers).
- Multi-company (sell the app to other clearance offices, with a separate database or schema per client).
