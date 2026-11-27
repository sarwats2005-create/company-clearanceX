# Feature specs (as built 2026-11-27)

## 1. Expense lines on the expenses page (charges sheet)

Code: `src/components/app/charges-sheet.tsx`, `src/features/charges/sheet-model.ts`,
`src/features/settings/service.ts` (`setChargeTypeDefaultLine`), column `charge_types.is_default_line`.

- The sheet opens with every **default line** (expense types marked with a star) already added, each
  filled with its default currency, payer and (per container size) amount. Nothing is ticked first.
- **"+ إضافة سطر"** opens a popup list of the remaining expense types (icon, name, payer · currency ·
  usual amount, a star if default). Tapping one adds its line at the bottom and focuses its amount.
- Each line card has: icon tile + name, a **star pill** ("افتراضي" / "اجعله افتراضياً"), and a red
  **trash** button. One tap removes the line.
- **Star** = this type opens by itself next time, in the currency the line shows now. Star again to stop.
- If the owner switches a line's currency away from the type's default, a link appears under the
  currency switch: "اجعل الدولار عملته الافتراضية". One tap saves it as the default.
- The same star exists in Settings → أنواع المصاريف (row pill + a toggle in the edit dialog).
- Closing the sheet only asks "تجاهل المصاريف؟" if the owner actually typed or changed something.

## 2. Expenses inside the add-container flow

Code: `containers/new/page.tsx`, `container-form.tsx`, `containers/[id]/page.tsx`, `step-bar.tsx`.

- The add page shows a 3-step bar: **1 الحاوية → 2 المصاريف → 3 تم**.
- The main button reads **"حفظ ثم المصاريف ←"**. Saving goes to the container page with `?new=1`,
  which opens the expenses sheet by itself as **"الخطوة 2: مصاريف الحاوية"** (step bar inside), then
  removes `?new=1` from the address so a refresh doesn't reopen it.
- Buttons there: **"حفظ المصاريف وإنهاء"** and **"تخطي الآن"**. Success toast: "تم! أُضيفت الحاوية ومصاريفها".
- "حفظ وإضافة أخرى" still keeps the line/port/date for a whole ship arriving together.

## 3. Shipping lines with logos

Code: `shipping-line-logo.tsx`, `container-form/shipping-line-picker.tsx`,
`settings/shipping-lines-editor.tsx`, columns `shipping_lines.logo`, `shipping_lines.website`.

- Logo source, in order: the picture the owner uploaded (resized in the browser to ≤160px PNG, stored
  as a data URL, server accepts PNG/JPEG/WebP ≤ ~150 KB) → the icon of the line's website (via
  Google's public favicon service; only the domain is sent) → the line's letters on a color.
  The favicon service answers "no icon" with a 16px globe, so anything ≤16px counts as no logo.
- Seeded lines get their websites (msc.com, maersk.com, …) by migration `0001`.
- **We don't ship carrier logo files in the repo**: the owner uploads them (Settings → خطوط الشحن →
  "الشعار"), which keeps trademark files out of our code.
- The add-container form picks the line from a grid of logo tiles (React Aria radio group, keyboard
  friendly) with a "+ خط جديد" tile. Logos also show in container lists, the container page and info.

## 4. WhatsApp: picture or text

Code: `whatsapp-share.tsx` (uses `html-to-image`), used on receipts (`#receipt-doc`), the container
page (`#container-card`) and statements (`#statement-doc`).

- One green-icon button "إرسال واتساب" opens a choice: **صورة (JPEG)** or **نص**.
- Picture: the on-screen element is drawn to a JPEG (2× sharp, white background, `.no-print` parts
  left out). On phones it goes to the system share sheet (`navigator.share` with the file), where
  WhatsApp is one tap. On computers it copies the picture (paste with Ctrl+V), saves it, and opens
  WhatsApp on the trader's chat.
- Text: the same `wa.me` text summary as before, addressed to the trader/party phone when known.
- Every new money action lands on its receipt page, so every debit/credit can be sent.

## 5. Main vault, loud

Code: `vault-hero.tsx`, `home/overview.tsx`, `accounts/vaults/[id]/page.tsx`, route `/vault`.

- Home starts with the vault hero card: deep gradient, vault name, IQD main vault + USD vault balances
  in big white numbers, "فتح القاصة" pill, and 5 round actions (قبض، دفع، تحويل، تصريف، مصروف).
- The vault has its own nav item **القاصة** (sidebar and phone tab bar) → `/vault` redirects to the
  main vault page. That page uses the same hero with إيداع / سحب / تحويل / تصريف.

## 6. Restore points and "start fresh" (Settings → نقاط الاسترجاع)

Owner's rule: the fresh-start option only appears once he has saved a restore point **that same day**.

- **Save** (main job, first and big): optional name, one button. A point is a full copy of every business table: lists, settings, traders, containers, money. Logins, devices, the audit log and the points themselves are never inside a point, so a restore never brings back an old password.
- **List**: name, date and time, "حاويات · حركات مالية · تجار" counts, a "تلقائية" pill on automatic points, "اليوم" on today's manual point. Each has "استرجاع"; old manual points also have "حذف".
- **Restore**: dialog with what will happen (ticked lines), then the password. Before restoring, an automatic point of the current data is saved, so every restore can be undone.
- **Start fresh**: locked card ("يظهر فقط بعد أن تحفظ نقطة استرجاع اليوم") until a manual point exists today. Then a red card opens a dialog with two big choices: "امسح الحاويات والمال فقط" (default: lists, traders and settings stay, balances go to zero, receipt numbers restart at 1) or "امسح كل شيء" (back to the original starting lists). Password required. An automatic point is saved first.
- **Delete**: only manual points, and not on the day they were saved (today's point is the undo for a fresh start). Automatic points delete themselves after 30 days (the newest 5 always stay). At most 30 manual points.
- **Where it is enforced**: inside the database (`src/db/sql/0003_restore_points.sql`), not only in the page. The app's restricted user can't write points or truncate tables itself.
