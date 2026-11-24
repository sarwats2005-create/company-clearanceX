# Image Prompts: Container Clearance Manager

Ready-to-paste prompts for making **screen mockups** (to show and sell the app to your client), **app art** (logo, login picture, empty-state drawings), and **marketing images**. Every prompt matches the PRD design: Untitled UI look, navy brand, Arabic right-to-left, big friendly text.

---

## Start here (3 steps)

1. **Pick what you need** from the menu below.
2. **Copy the prompt** (the grey box) into the tool it recommends. Each prompt already contains the full style, so you don't need to add anything.
3. **Check the result** against the "✅ Good result" list under the prompt. If it's off, use the fix-it prompts in Part E.

### Menu

| # | Image | Use it for | Best tool |
|---|---|---|---|
| **A. Screen mockups (show the client)** ||||
| A1 | Home dashboard (desktop) | First impression, pitch | GPT Image / ChatGPT |
| A2 | Home on a phone | Show it works on mobile | GPT Image |
| A3 | Container page | Explain tracking + charges | GPT Image |
| A4 | "Add charges" panel | Show how easy entering costs is | GPT Image |
| A5 | New transaction tiles | Show money features | GPT Image |
| A6 | Confirmation before saving | Show "no mistakes" safety | GPT Image |
| A7 | Printed receipt on a desk | Show numbered receipts | Midjourney / GPT Image |
| A8 | Trader statement | Show account statements | GPT Image |
| A9 | Vaults | Show main + extra vaults | GPT Image |
| A10 | Profit report | Show the owner his profit | GPT Image |
| A11 | Settings: charge types | Show it's flexible | GPT Image |
| A12 | Login screen | First screen | GPT Image |
| A13 | **Add container form** (desktop) ★ | Show how easy adding a container is | GPT Image |
| A14 | **Shared container** (form on a phone) | Show splitting costs between traders | GPT Image |
| **B. App art (goes inside the app)** ||||
| B1 | App icon / logo mark | Favicon, sidebar, receipts | Ideogram / GPT Image |
| B2 | Logo with Arabic name | Receipts header, login | Ideogram (then fix text) |
| B3 | Login illustration (Umm Qasr port) | Login page side panel | Midjourney / GPT Image |
| B4–B7 | Empty-state drawings (4) | "Nothing here yet" screens | GPT Image |
| **C. Selling the app** ||||
| C1 | Laptop hero photo | Pitch deck cover, website | Midjourney |
| C2 | Phone in hand at the port | "Works anywhere" slide | Midjourney |
| C3 | Before / after (Excel vs app) | The strongest selling slide | GPT Image |
| C4 | Square social post | WhatsApp / Instagram status | GPT Image |
| **D. Shared kit** | Style block, sample data, negative prompt, tool settings | Read once | |
| **E. Fix-it prompts** | When a result is wrong | | |

### Which tool for what (simple rule)
- **Screens and UI mockups → GPT Image (in ChatGPT) or Gemini image.** These follow long layout instructions best.
- **Photos and illustrations → Midjourney.** Most beautiful lighting and art.
- **Logos with letters → Ideogram.** Best at spelling.
- **Editing an image you already have** (change a color, fix a part) → ChatGPT image edit or any "edit with reference" tool, using the fix-it prompts in Part E.

### The one thing to know about Arabic text
Image AIs often **scramble Arabic letters**, and sometimes English too. So:
- The prompts ask for **short, real Arabic labels**. You'll often get them right in GPT Image, but not always.
- If a label comes out wrong, either use fix-it prompt **E1**, or put the image into **Canva / Figma** and type the correct Arabic on top (use the font *IBM Plex Sans Arabic*).
- For a pitch, you can say: "this is a design preview; the real app has perfect Arabic", which is true, because the real app uses real fonts.

### How to make all images look like one product
1. Make **A1 first**. When you like it, keep it.
2. For every next image, **attach A1 as a reference** and add: *"Match the exact visual style, colors, fonts and spacing of the attached image."*
   - In Midjourney, use `--sref <A1 image URL>`.
3. Use the **same sample data** (Part D2) everywhere, so the numbers tell one story.

### Use the mockups when building
Save your best screens into your project at `docs/mockups/` (e.g. `a1-home-desktop.png`). The master prompt tells the AI coding tool to look at them as a visual guide.

---

## D. Shared kit (read once)

### D1. Style block (already inside every prompt below; here so you can reuse it)
```
Style: Untitled UI design system look. Clean, modern, light theme SaaS web app. Page background very light gray #F9FAFB, white cards with 1px light gray #EAECF0 borders, 12px rounded corners, very soft subtle shadows. Primary color deep navy blue #1E3A8A for main buttons and active navigation. Text near-black #101828, secondary text gray #475467. Semantic colors: red #D92D20 for "owes us" amounts, green #079455 for "we owe" and money in, amber #DC6803 for warnings and "on the way", blue #1570EF for "arrived". Status badges are soft pill shapes with a small line icon and a word. Thin consistent line icons (Untitled UI icons style), no emoji. Arabic right-to-left layout: navigation sidebar on the RIGHT, text right-aligned, reading from right to left. Large friendly Arabic sans-serif typography similar to IBM Plex Sans Arabic, generous spacing, big buttons 48px tall. Designed for a 50-year-old non-technical business owner: calm, clear, uncluttered, high contrast, nothing tiny. Container numbers and amounts are in Latin digits. Ultra sharp, pixel-perfect UI screenshot, no device frame, no watermark.
```

### D2. Sample data (keep it consistent)
| Thing | Value |
|---|---|
| Company | سرور البصرة للتخليص الكمركي (Sorour Basra Customs Clearance) |
| Owner greeting | مساء الخير، أبو علي |
| Traders | أحمد كاظم · حيدر عبد الله · مصطفى جاسم · علي حسين · كرار محمد |
| Containers | MSCU4829175 · TGHU7716032 · CMAU3390418 · MRKU2208741 · COSU6105529 · HLXU8834410 |
| Goods | أجهزة كهربائية · ملابس · أثاث · قطع غيار · مواد غذائية |
| Shipping lines | MSC · Maersk · CMA CGM · COSCO · Hapag-Lloyd |
| Statuses (counts) | تم التأكيد 12 · في الطريق 8 · وصلت أم قصر 5 · سُلّمت هذا الشهر 21 |
| Main vault | 48,250,000 د.ع |
| USD vault | 12,400 $ |
| Traders owe us | 18,600 $ · 9,750,000 د.ع |
| We owe parties | 14,200 $ |
| Charge types | كمرك بصرة · غرامة شركة الشحن · غرامة ميناء · أجور نقل بحري · أتعاب شركة · أجور نقل الجوي · أتعاب أجور نقل |
| Worked example | كمرك بصرة 2,000 $ (China co.) · غرامة ميناء 100 $ (Umm Qasr) · أتعاب شركة 300 $ → trader owes 2,400 $ |
| Shared container | CMAU3390418 · 40 قدم (12 م) · أحمد كاظم 4 م · حيدر عبد الله 5.5 م · فارغ 2.5 م |
| Port / B/L | Shanghai · B/L COSU62341 |
| Receipt | ق-000124 · 22/11/2026 · 2,400 $ |
| Exchange rate | 1,310 |

### D3. Negative prompt (things to avoid; add to tools that support it)
```
no left-side sidebar, no left-to-right layout, no dark mode, no purple, no neon, no gradients on UI, no glassmorphism, no 3D UI, no emoji, no stock-photo people inside UI screens, no lorem ipsum, no gibberish letters, no tiny text, no cluttered dashboard, no device frame, no watermark, no blurry text
```
Midjourney format: `--no left sidebar, dark mode, purple, emoji, gibberish text, clutter, watermark`

### D4. Tool settings cheat sheet
| Tool | Where to put size | Good settings |
|---|---|---|
| **ChatGPT / GPT Image** | Say it in words: "landscape 3:2" / "portrait 2:3" / "square" | Ask for "high quality". If text is wrong, reply "Fix only the text in …" (E1). |
| **Midjourney (v7)** | `--ar 16:9` | add `--style raw --v 7`; for consistency `--sref <URL of A1>`; `--q 2` for detail |
| **Ideogram** | Choose aspect ratio in the menu | Style "Design" for logos, "Realistic" for photos. Turn **Magic Prompt OFF** so it keeps your exact text. |
| **Gemini image / others** | Say it in words | Attach A1 as a style reference for every screen. |

---

## A. Screen mockups

> Each prompt is complete: copy the whole box. **Tool** and **Size** are above each box.

### A1. Home dashboard (desktop) ★ make this first
**Tool:** GPT Image · **Size:** landscape 3:2 (or 16:10)
```
Create a high-fidelity desktop web app screenshot of the home dashboard of "Container Clearance Manager", an Arabic right-to-left app for a customs clearance company in Basra, Iraq.

LAYOUT (right-to-left):
- RIGHT side: a white vertical navigation sidebar, 280px wide, with a small navy logo at the top and these menu items each with a thin line icon and an Arabic label: الرئيسية (active, highlighted with a light navy background), الحاويات, المالية, الحسابات, التقارير, الإعدادات. At the bottom of the sidebar, a small account card with the name "أبو علي".
- TOP BAR: a very wide search field with a magnifier icon and the placeholder "ابحث برقم الحاوية أو اسم التاجر", and a navy "+ جديد" button.
- PAGE TITLE: "مساء الخير، أبو علي" with today's date under it in gray.
- ROW OF 4 METRIC CARDS: each white card has a soft colored round icon, a label and a big number: "تم التأكيد" 12 (gray clipboard icon), "في الطريق" 8 (amber ship icon), "وصلت أم قصر" 5 (blue anchor icon), "سُلّمت هذا الشهر" 21 (green package-check icon).
- A thin amber warning banner: "3 حاويات في أم قصر منذ أكثر من 7 أيام" with a small "عرض" link.
- MONEY STRIP of 4 compact cards: "القاصة الرئيسية 48,250,000 د.ع" (navy, emphasized), "قاصة الدولار 12,400 $", "لنا عند التجار 18,600 $" in red, "علينا للجهات 14,200 $" in green.
- THREE BIG BUTTONS in a row: navy filled "+ حاوية جديدة", outlined "+ قبض", outlined "+ صرف".
- MAIN TABLE CARD titled "الحاويات الحالية" with filter tabs (الكل, تم التأكيد, في الطريق, وصلت). Columns: رقم الحاوية, التاجر, البضاعة, الحالة, منذ, المصاريف. 6 rows with real-looking data: MSCU4829175 · أحمد كاظم · أجهزة كهربائية · blue badge "وصلت أم قصر" · "9 أيام" in amber · 2,400 $; TGHU7716032 · حيدر عبد الله · ملابس · amber badge "في الطريق" · 4 أيام · 1,850 $; CMAU3390418 · مصطفى جاسم · أثاث · gray badge "تم التأكيد" · يومين · 0; and 3 more similar rows. Container numbers are bold Latin characters.

STYLE: Untitled UI design system look. Clean modern light theme, page background #F9FAFB, white cards with 1px #EAECF0 borders, 12px rounded corners, very soft shadows. Primary color deep navy #1E3A8A. Red #D92D20 for owed-to-us amounts, green #079455 for we-owe, amber #DC6803 warnings, blue #1570EF arrived. Pill badges with icon + word. Thin line icons, no emoji. Large friendly Arabic sans-serif type like IBM Plex Sans Arabic, generous white space, big 48px buttons. Calm, clear, uncluttered, made for a 50-year-old non-technical owner. Pixel-perfect, ultra sharp, no device frame.
```
✅ **Good result:** sidebar on the **right**; 4 cards in a row; numbers readable; nothing purple or dark; it looks calm, not crowded.

### A2. Home on a phone
**Tool:** GPT Image · **Size:** portrait 2:3 (attach A1 as a style reference)
```
Create a high-fidelity mobile web app screenshot (one phone screen, 390×844 proportions, no phone frame) of the same Arabic right-to-left "Container Clearance Manager" home screen, matching the attached desktop design's exact style.

TOP: a slim header with a hamburger menu on the right, a small navy logo in the center, and search and "+" icons on the left.
Greeting "مساء الخير، أبو علي".
A 2×2 grid of compact metric cards: تم التأكيد 12 (gray), في الطريق 8 (amber), وصلت أم قصر 5 (blue), سُلّمت 21 (green), each with an icon.
A horizontal swipeable strip of money cards: "القاصة الرئيسية 48,250,000 د.ع" first.
A list of container CARDS (not a table): each card shows the bold Latin container number (MSCU4829175) on the right, the trader name "أحمد كاظم" and goods under it, a colored status pill on the left, and "2,400 $" at the bottom. 3 cards visible.
A sticky full-width navy button above the bottom bar: "+ حاوية جديدة".
BOTTOM NAVIGATION BAR with 5 items, each icon + Arabic label: الرئيسية (active, navy), الحاويات, المالية, الحسابات, المزيد.

STYLE: Untitled UI look, light theme, background #F9FAFB, white cards with light borders and 12px corners, navy #1E3A8A primary, large friendly Arabic sans-serif type, big touch targets, right-to-left, no emoji, pixel-perfect.
```
✅ **Good result:** cards instead of a table; bottom bar with 5 labelled icons; the button is big and easy to tap.

### A3. Container page
**Tool:** GPT Image · **Size:** landscape 3:2
```
Create a high-fidelity desktop web app screenshot of a CONTAINER DETAIL page in the Arabic right-to-left "Container Clearance Manager" app (same style as the attached reference, if any).

Right navigation sidebar as in the dashboard (الحاويات active).
HEADER: a very large bold Latin container number "MSCU4829175". Under it in gray: "أحمد كاظم · أجهزة كهربائية · 40 قدم · MSC · Shanghai · B/L COSU62341". On the left side of the header: outlined buttons "تعديل" and "طباعة" and a "⋯" button.
STATUS PROGRESS STEPS across the full width, read right to left: (1) تم التأكيد 01/11 ✓ green, (2) في الطريق 05/11 ✓ green, (3) وصلت أم قصر 14/11 (current, blue, highlighted ring), (4) تم التسليم (upcoming, gray) with a small navy button under it "نقل إلى هذه المرحلة".
TWO COLUMNS below:
- Right column card "المصاريف" with a navy button "+ إضافة مصاريف". A clean table: كمرك بصرة · 2,000 $ · chip "شركة التخليص - الصين"; غرامة ميناء · 100 $ · chip "شراكة أم قصر"; أتعاب شركة · 300 $ · green chip "ربح الشركة".
- Left column card "ملخص الحساب": تكاليف 2,100 $; اتعاب (ربح) 300 $ in green; a bold total "المجموع على التاجر 2,400 $"; a red pill "رصيد التاجر: عليه 2,400 $" with a link "كشف الحساب".
BELOW: an info card grid with labeled fields (كارتون 850, وزن 12,400 كغم, الخط MSC, الحجم 40 قدم, فاكس 2231, الجهة بغداد), and a vertical timeline "السجل" with dated events and small icons.

STYLE: Untitled UI look, light #F9FAFB background, white cards, 1px #EAECF0 borders, 12px corners, navy #1E3A8A primary, green #079455 profit, red #D92D20 owed, blue #1570EF current step. Large friendly Arabic type (IBM Plex Sans Arabic style), thin line icons, generous spacing, no emoji, pixel-perfect.
```
✅ **Good result:** the 4 steps read from right to left; the profit is clearly green; the total is the most visible number.

### A4. "Add charges" panel
**Tool:** GPT Image · **Size:** landscape 3:2
```
Create a high-fidelity web app screenshot showing a SIDE PANEL sliding in from the RIGHT edge over a dimmed container page, in the Arabic right-to-left "Container Clearance Manager" app.

Panel (about 520px wide, white, soft shadow, rounded inner corners):
- Title "إضافة مصاريف" with a close X, subtitle "الحاوية MSCU4829175 · 40 قدم".
- A secondary button with a small sparkle/wand line icon: "المصاريف المعتادة".
- A 2-column grid of large checkbox tiles: كمرك بصرة (checked, navy border), غرامة شركة الشحن, غرامة ميناء (checked), أجور نقل بحري, أتعاب شركة (checked), أجور نقل الجوي, أتعاب أجور نقل.
- For each checked tile, a form row: a big amount input showing "2,000", a small segmented toggle "د.ع | $" with $ selected, a dropdown "دفعها: شركة التخليص - الصين". The fee row shows a green label "ربح الشركة" instead of the dropdown.
- A summary box at the bottom: "المجموع: 2,400 $ · منها اتعاب 300 $".
- A full-width navy button pinned at the bottom: "حفظ المصاريف".

STYLE: Untitled UI look, light theme, navy #1E3A8A, labels above inputs, 48px tall inputs and buttons, large friendly Arabic type, generous spacing, thin line icons, no emoji, pixel-perfect, right-to-left.
```
✅ **Good result:** the panel comes from the right; the inputs are big; the summary is easy to see.

### A5. New transaction tiles
**Tool:** GPT Image · **Size:** landscape 3:2
```
Create a high-fidelity desktop web app screenshot of the "معاملة جديدة" (new transaction) page in the Arabic right-to-left "Container Clearance Manager" app. Right navigation sidebar with المالية active.

The page title is "معاملة جديدة" with the subtitle "اختر نوع العملية". Below it is a grid of 9 large white tiles (3 columns × 3 rows), each about 120px tall, with a round soft-colored icon, a bold Arabic title and one short gray hint line:
GREEN accent (money in): "قبض من تاجر" (wallet icon), "قبض من جهة", "إيداع".
RED accent (money out): "دفع لجهة", "دفع لتاجر", "سحب", "مصروف عام".
BLUE accent (internal): "تحويل بين القاصات" (two arrows icon), "تصريف عملة" (currency exchange icon).
Each tile has a thin colored strip on its right edge matching its group. A small gray link under the grid: "سجل المعاملات".

STYLE: Untitled UI look, light #F9FAFB background, white tiles with 1px borders, 12px corners, soft hover shadow on one tile, navy #1E3A8A headings, green #079455, red #D92D20, blue #1570EF accents, large friendly Arabic type, very touch-friendly, no emoji, pixel-perfect.
```

### A6. Confirmation before saving money
**Tool:** GPT Image · **Size:** landscape 4:3
```
Create a high-fidelity web app screenshot of a centered confirmation dialog over a dimmed page, in the Arabic right-to-left "Container Clearance Manager" app.

Dialog (white, 12px corners, soft shadow, about 480px wide):
- At the top, a large soft green circle icon containing a money-in arrow.
- Title "تأكيد العملية".
- One big clear sentence: "سيتم استلام 3,144,000 د.ع من التاجر أحمد كاظم إلى القاصة الرئيسية مقابل 2,400 $ بسعر صرف 1,310", with the amounts in bold.
- A light gray summary box with 4 rows of label/value: من · أحمد كاظم; إلى · القاصة الرئيسية; التاريخ · 22/11/2026; نوع الوصل · قبض.
- Two full-width buttons side by side: navy filled "تأكيد وحفظ" and white outlined "رجوع".

STYLE: Untitled UI look, calm and reassuring, large friendly Arabic type (IBM Plex Sans Arabic style), generous padding, no emoji, pixel-perfect.
```

### A7. Printed receipt on a desk
**Tool:** Midjourney (photo) or GPT Image · **Size:** portrait 3:4
```
Top-down photograph of a printed A5 paper receipt lying on a clean light wooden office desk, next to a black pen and a small glass of Iraqi tea. The receipt is in Arabic, right-to-left, printed in black ink with thin navy lines:
- At the top right, a small navy container-icon logo and the company name "سرور البصرة للتخليص الكمركي"
- At the top left, a bordered box with "وصل قبض" and the number "ق-000124"
- Rows: التاريخ 22/11/2026 · استلمنا من: أحمد كاظم · إلى: قاصة الدولار · المبلغ: 2,400 $ in large bold digits
- A line "فقط ألفان وأربعمائة دولار أمريكي لا غير"
- A small line "الحاوية: MSCU4829175"
- Two signature lines at the bottom: "توقيع المستلم" and "توقيع المسلم"
Soft natural window light, realistic paper texture, shallow depth of field, professional and trustworthy.
```
Midjourney: add `--ar 3:4 --style raw --v 7 --no gibberish text, watermark`

### A8. Trader statement
**Tool:** GPT Image · **Size:** landscape 3:2
```
Create a high-fidelity desktop web app screenshot of a TRADER ACCOUNT STATEMENT page in the Arabic right-to-left "Container Clearance Manager" app. Right navigation sidebar with الحسابات active.

HEADER: the trader name "أحمد كاظم" with the phone "0770 123 4567" (Latin digits) and a small call icon. Two big balance cards side by side: "الدولار: عليه 2,400 $" with a red pill and "الدينار: مسدد" with a gray pill. Buttons: navy "استلام دفعة", outlined "دفع للتاجر".
TABS: كشف الحساب (active) · الحاويات · معلومات.
FILTER ROW: a date range field "01/11/2026 – 22/11/2026", quick chips "هذا الشهر" (selected), "الشهر الماضي", "هذه السنة", and a currency toggle "$ | د.ع".
TABLE with columns التاريخ, الرقم, البيان, عليه, له, الرصيد:
- a first row "رصيد سابق" with 0
- 05/11 · MSCU4829175 · كمرك بصرة · 2,000 · – · عليه 2,000
- 14/11 · MSCU4829175 · غرامة ميناء · 100 · – · عليه 2,100
- 14/11 · MSCU4829175 · أتعاب شركة · 300 · – · عليه 2,400
- 22/11 · ق-000124 · قبض نقدي · – · 2,400 · مسدد
- a bold totals row at the bottom
Action buttons at the top left of the table: "طباعة", "Excel", and a green "واتساب".

STYLE: Untitled UI look, light theme, white table card with soft row dividers (no zebra stripes), red #D92D20 for عليه, green #079455 for له, navy #1E3A8A primary, tabular Latin digits with thousands separators, large friendly Arabic type, no emoji, pixel-perfect.
```

### A9. Vaults
**Tool:** GPT Image · **Size:** landscape 3:2
```
Create a high-fidelity desktop web app screenshot of the VAULTS page ("القاصات") in the Arabic right-to-left "Container Clearance Manager" app. Right navigation sidebar with الحسابات active and a tab bar التجار · الجهات · القاصات (active).

A card grid:
- A wide featured card in solid deep navy #1E3A8A with white text: a safe icon, "القاصة الرئيسية", and a huge number "48,250,000 د.ع".
- A white card with a dollar icon: "قاصة الدولار", "12,400 $".
- Three smaller white cards: "صيرفة الأمين" with a storefront icon showing two balances "3,500,000 د.ع" and "800 $"; "أبو حسن" with a person icon "1,200 $"; "التاجر علي حسين" with a briefcase icon "650,000 د.ع".
- A dashed-border card with a plus icon: "+ قاصة جديدة".
Each card has small text buttons at the bottom: "كشف", "إيداع", "سحب".

STYLE: Untitled UI look, light #F9FAFB background, 12px corners, soft shadows, large bold numbers, friendly Arabic type, thin line icons, no emoji, pixel-perfect.
```

### A10. Profit report
**Tool:** GPT Image · **Size:** landscape 3:2
```
Create a high-fidelity desktop web app screenshot of the PROFIT REPORT page ("تقرير الأرباح") in the Arabic right-to-left "Container Clearance Manager" app. Right navigation sidebar with التقارير active.

TOP: a date range "01/01/2026 – 22/11/2026", and buttons "طباعة" and "Excel".
THREE metric cards: "إجمالي الاتعاب 48,300 $" (green icon), "المصاريف العامة 9,200,000 د.ع" (red icon), "صافي الربح" showing two lines "48,300 $" and "-9,200,000 د.ع".
A clean bar chart card "الاتعاب حسب الشهر" with 11 navy bars (Jan to Nov, Arabic month names along the axis, read right to left), light grid lines, and a tooltip on the tallest bar "تشرين الأول: 6,100 $".
A table card "حسب التاجر": أحمد كاظم 9,600 $ · 32 حاوية; حيدر عبد الله 7,200 $ · 24 حاوية; and 3 more rows.

STYLE: Untitled UI look, light theme, navy #1E3A8A bars, green #079455 positive, red #D92D20 negative, large friendly Arabic type, tabular digits, no emoji, pixel-perfect.
```

### A11. Settings: charge types
**Tool:** GPT Image · **Size:** landscape 3:2
```
Create a high-fidelity desktop web app screenshot of the SETTINGS page, section "أنواع المصاريف", in the Arabic right-to-left "Container Clearance Manager" app.

On the right, the main navigation sidebar (الإعدادات active). Next to it, a settings sub-menu list: معلومات الشركة, أنواع المصاريف (active), الجهات, القاصات, خطوط الشحن, الوصولات, العملة وسعر الصرف, العرض.
The settings sub-menu also lists موانئ التحميل and أحجام الحاويات.
The main area has the title "أنواع المصاريف" and a navy button "+ نوع جديد". A list of rows, each with a drag handle, a name, a currency pill, a default-payer chip and an on/off toggle: كمرك بصرة · $ · شركة التخليص - الصين · on; غرامة شركة الشحن · $ · الصين · on; غرامة ميناء · د.ع · شراكة أم قصر · on; أجور نقل بحري · $ · الصين · on; أتعاب شركة · $ · green chip "ربح الشركة" · on; أجور نقل الجوي · $ · الصين · on; أتعاب أجور نقل · $ · green chip "ربح الشركة" · on.
An edit modal is open on top for "أتعاب شركة": fields "الاسم", "العملة الافتراضية" (toggle), a switch "هذا أتعاب (ربح)" turned on, and a small table "المبلغ الافتراضي حسب الحجم": 20 قدم 250 $ · 40 قدم 300 $ · 40 قدم عالي 300 $. Buttons "حفظ" (navy) and "إلغاء".

STYLE: Untitled UI look, light theme, large labels above inputs, 48px inputs, friendly Arabic type, thin line icons, no emoji, pixel-perfect.
```

### A12. Login screen
**Tool:** GPT Image · **Size:** landscape 16:10
```
Create a high-fidelity web app LOGIN screen for the Arabic right-to-left "Container Clearance Manager" app.

RIGHT HALF: a white area with a centered form: a navy container-icon logo, the title "تسجيل الدخول", a short gray line "مرحباً بك، أدخل بياناتك", a big labeled input "اسم المستخدم", a big labeled input "كلمة المرور" with an eye icon, a checkbox "تذكرني" (checked), and one full-width navy button "دخول".
LEFT HALF: a calm flat-vector illustration of Umm Qasr port at golden hour: stacked shipping containers in navy, amber, teal and soft red, a tall gantry crane, a cargo ship, soft sky gradient, and small birds. Rounded 24px corners on the illustration panel.

STYLE: Untitled UI look, light, trustworthy, plenty of white space, large friendly Arabic type, no emoji, pixel-perfect.
```

### A13. Add container form (desktop) ★ shows the calm, guided form
**Tool:** GPT Image · **Size:** landscape 3:2 (attach A1 as a style reference)
```
Create a high-fidelity desktop web app screenshot of the "حاوية جديدة" (new container) form in the Arabic right-to-left "Container Clearance Manager" app. Match the attached reference style exactly.

Right navigation sidebar with الحاويات active.
TOP OF PAGE: a small gray breadcrumb "الحاويات › حاوية جديدة", a title "حاوية جديدة", and one gray helper line: "أدخل الأساسيات الثلاثة. باقي التفاصيل اختيارية ويمكن إضافتها لاحقاً."
MAIN FORM COLUMN (about 720px wide, aligned to the right, lots of breathing room, one single straight right edge for all labels and fields):
- CARD ① "الأساسيات" with a small red tag "مطلوب" and a 2px navy line on its right edge. Inside, three full-width fields stacked with generous equal spacing, each with its label ABOVE the input:
  "رقم الحاوية *" → input containing "MSCU4829175" in large Latin letters, with a small green line under it "✓ متاح";
  "خط الشحن *" → a dropdown showing "MSC";
  "التاجر *" → a searchable dropdown showing "أحمد كاظم".
  Under them, a toggle switch (off) labeled "حاوية مشتركة (لأكثر من تاجر)".
- Three FOLDED cards below, each a single 64px row with a number badge, a title, a gray "اختياري · 0 من 6" counter and a chevron: "② تفاصيل الشحنة", "③ البضاعة", "④ التواريخ والملاحظات".
SUMMARY PANEL on the left side (320px, sticky): a white card "ملخص الحاوية" listing رقم MSCU4829175 ✓, الخط MSC ✓, التاجر أحمد كاظم ✓, then gray dashes for the optional items, and a green line "✓ جاهز للحفظ".
STICKY ACTION BAR at the bottom with a top border: a navy filled button "حفظ الحاوية" (rightmost), an outlined "حفظ وإضافة أخرى", and a plain "إلغاء".

STYLE: Untitled UI design system look, light #F9FAFB background, white cards with 1px #EAECF0 borders and 12px corners, very soft shadows, navy #1E3A8A primary, green #079455 success hints. 8px spacing grid, labels above inputs, 48px tall inputs and buttons. Calm, uncluttered, guided feeling, made for a 50-year-old non-technical owner. Large friendly Arabic sans-serif (IBM Plex Sans Arabic style), thin line icons, no emoji, pixel-perfect.
```
✅ **Good result:** you only see 3 fields to fill; the rest is folded away; everything lines up on one right edge; the save button is obvious. This image is the best reference to give the AI coding tool for the form.

### A14. Shared container (form on a phone)
**Tool:** GPT Image · **Size:** portrait 2:3 (attach A1 or A13 as a style reference)
```
Create a high-fidelity mobile web app screenshot (one phone screen, 390×844 proportions, no phone frame) of the Arabic right-to-left "Container Clearance Manager" new-container form with the "حاوية مشتركة" switch turned ON. Match the attached reference style.

TOP: a slim header with a back arrow on the right and the title "حاوية جديدة".
Card "① الأساسيات" (compact): رقم الحاوية "CMAU3390418", خط الشحن "CMA CGM", and the toggle "حاوية مشتركة (لأكثر من تاجر)" switched ON in navy.
Card "الحصص":
- label "وحدة التقسيم" with a 4-option segmented control: "متر طولي" (selected, navy), "متر مكعب", "نسبة %", "بالتساوي";
- two stacked trader cards, each with a number badge and a small trash icon: card 1 "أحمد كاظم" with share field "4" and unit "م"; card 2 "حيدر عبد الله" with share field "5.5" and unit "م";
- an outlined button "+ إضافة تاجر آخر";
- a horizontal FILL BAR titled "امتلاء الحاوية (40 قدم = 12 م)" split into a navy segment "أحمد 4 م", a teal segment "حيدر 5.5 م" and a light gray striped segment "فارغ 2.5 م";
- a small gray line under it: "ستُقسَّم المصاريف: أحمد 42.1% · حيدر 57.9%".
STICKY BOTTOM: a full-width navy button "حفظ الحاوية" with small text links "حفظ وإضافة أخرى · إلغاء" under it.

STYLE: Untitled UI look, light theme, white cards with light borders and 12px corners, 16px side padding, labels above inputs, 48px touch targets, large friendly Arabic type, right-to-left, no emoji, pixel-perfect.
```
✅ **Good result:** the fill bar makes the split obvious at a glance; each trader is its own clear card; it still feels simple.

---

## B. App art (used inside the app)

### B1. App icon / logo mark
**Tool:** Ideogram (Design style, Magic Prompt OFF) or GPT Image · **Size:** square 1:1
```
Minimal flat vector app icon for a container customs clearance management system. A simple geometric shipping container seen at a three-quarter angle, with a bold check mark formed by the container's door lines. Deep navy #1E3A8A container, one amber #F59E0B accent stripe, on a white rounded-square background. Bold clean shapes that remain readable at 32px. No text, no gradients, no shadows, professional logistics brand, centered, generous padding.
```
✅ **Good result:** it's still recognizable when you shrink it to the size of a fingernail. Export as PNG 512×512, then make `icon.png` and `favicon.ico` from it.

### B2. Logo with Arabic name (horizontal lockup)
**Tool:** Ideogram (Design style, Magic Prompt OFF) · **Size:** wide 3:1
```
Horizontal logo lockup on a white background: on the right, a minimal navy #1E3A8A shipping-container icon with a check mark built from the door lines and a small amber accent; on the left of it, the Arabic company name "سرور البصرة" in a clean modern bold Arabic sans-serif, with a smaller line under it "للتخليص الكمركي" in gray. Right-to-left reading order, balanced spacing, flat vector, no gradients, no extra text.
```
**Tip:** if the Arabic letters are wrong, keep only the icon, and type the name in Canva with *IBM Plex Sans Arabic Bold*.

### B3. Login illustration (Umm Qasr port)
**Tool:** Midjourney or GPT Image · **Size:** portrait 4:5
```
Flat vector illustration of the port of Umm Qasr, Iraq, at golden hour: neatly stacked shipping containers in deep navy, amber, teal and soft coral, a tall blue gantry crane lifting one container, a large cargo ship at the quay, calm water reflections, a soft warm sky gradient from peach to light blue, a few small birds. Clean modern corporate illustration style, simple shapes, subtle grain texture, no text, no people, calm and trustworthy mood, plenty of sky space at the top.
```
Midjourney: add `--ar 4:5 --style raw --v 7 --no text, letters, watermark`

### B4–B7. Empty-state drawings (make all 4 in one style)
**Tool:** GPT Image · **Size:** square 1:1 · make B4 first, then attach it as a reference for B5–B7

**B4. No containers yet**
```
Small friendly empty-state illustration for a web app, in the minimal Untitled UI illustration style: soft light-gray and white shapes with thin gray outlines and a single navy #1E3A8A accent. A single open empty shipping container on a soft round light-gray background circle, with a small floating plus sign. Lots of white space, no text, no shadows, transparent-looking white background, 1:1.
```
**B5. No transactions yet**
```
Same minimal Untitled UI empty-state illustration style as the attached image: soft light-gray shapes, thin gray outlines, one navy #1E3A8A accent. An empty receipt paper and a closed wallet on a soft round light-gray background circle. No text, lots of white space, 1:1.
```
**B6. Search found nothing**
```
Same minimal Untitled UI empty-state illustration style as the attached image: a magnifying glass over a small stack of containers with a little question mark, soft light-gray shapes, thin gray outlines, one navy accent, soft round light-gray background circle. No text, 1:1.
```
**B7. No traders yet**
```
Same minimal Untitled UI empty-state illustration style as the attached image: an empty contact card with a simple person silhouette and a small plus sign, soft light-gray shapes, thin gray outlines, one navy accent, soft round light-gray background circle. No text, 1:1.
```
✅ **Good result:** all 4 look like they come from the same set; they're quiet (gray) with just one navy touch. Save them as `src/components/shared-assets/illustrations/empty-*.png` (or ask the AI coding tool to trace them to SVG).

---

## C. Selling the app

### C1. Laptop hero photo (pitch cover)
**Tool:** Midjourney · **Size:** `--ar 16:9`
```
Cinematic photograph of a modern office desk in Basra at golden hour. A sleek silver laptop shows a clean light-themed Arabic right-to-left business dashboard with four colored status cards and a list of shipping containers. Through the large window behind, slightly blurred, a port with stacked colorful shipping containers and cranes. A middle-aged Iraqi businessman's hands resting near the keyboard, a small glass of tea beside the laptop, prayer beads on the desk. Warm natural light, shallow depth of field, premium, trustworthy, photorealistic --ar 16:9 --style raw --v 7 --no text overlay, watermark, distorted hands
```
**Tip:** for a sharper screen, place your real A1 screenshot onto the laptop screen in Canva (use the "mockup" or "frame" feature).

### C2. Phone in hand at the port
**Tool:** Midjourney · **Size:** `--ar 4:5`
```
Close-up photograph of a man's hand holding a modern Android phone at the Umm Qasr container port, the phone screen showing a clean light Arabic mobile app with container cards and colored status pills. Behind him, out of focus, stacked shipping containers and a gantry crane under bright midday sun. Natural, authentic, slightly warm tones, photorealistic, sharp phone in focus --ar 4:5 --style raw --v 7 --no text overlay, watermark, extra fingers
```

### C3. Before / after (Excel vs the app) ★ strongest selling slide
**Tool:** GPT Image · **Size:** landscape 16:9
```
A clean split-screen comparison graphic for a sales presentation, divided vertically in the middle.
RIGHT side labeled "قبل" (before): a cluttered, confusing Excel spreadsheet in Arabic with many tiny gray cells, yellow highlights, red error triangles and messy columns, slightly desaturated, with a small red "✗" badge.
LEFT side labeled "بعد" (after): the clean, light, navy-accented Arabic dashboard of "Container Clearance Manager" with 4 colored status cards and a neat container list, bright and calm, with a small green "✓" badge.
Between them, a soft navy arrow pointing from "قبل" to "بعد". White background, generous margins, modern presentation style, large clear Arabic labels.
```

### C4. Square social post (WhatsApp / Instagram status)
**Tool:** GPT Image · **Size:** square 1:1
```
Square social media promo image in Arabic, right-to-left. Deep navy #1E3A8A background with a subtle pattern of thin container outlines. At the top, the big white headline "كل حاوياتك وحساباتك في مكان واحد". Center: a tilted phone mockup showing a light Arabic container-tracking app with colored status pills. Bottom: three short white bullet points with small amber check icons: "تتبع الحاويات برقمها", "وصولات مرقمة وكشوفات حساب", "الدينار والدولار بدون أخطاء". A small white logo mark in the corner. Clean, modern, bold, high contrast.
```
**Tip:** check the 3 Arabic lines carefully. Retype them in Canva if any letter is off.

---

## E. Fix-it prompts (reply to the tool with these)

**E1. Arabic text is scrambled or wrong**
```
Keep the image exactly the same. Only fix the text: the label at <where> must read exactly "<correct Arabic text>". Use a clean Arabic sans-serif, right-to-left, same size and color as before. Do not change anything else.
```

**E2. The sidebar is on the left (should be right)**
```
Mirror the layout to Arabic right-to-left: move the navigation sidebar to the RIGHT edge, right-align all text, and order the cards and table columns from right to left. Keep all content, colors and style the same.
```

**E3. Too crowded / text too small**
```
Simplify this screen for a 50-year-old user: make all text 25% larger, increase spacing between elements, keep only the most important items, and make the main button bigger. Keep the same style and colors.
```

**E4. Wrong colors (purple / dark / too colorful)**
```
Change the color scheme only: light gray #F9FAFB background, white cards, deep navy #1E3A8A for the main buttons and active menu, red #D92D20 only for amounts owed to us, green #079455 only for money in, amber #DC6803 only for warnings. Remove all purple, gradients and dark backgrounds.
```

**E5. Make a phone version of a desktop screen**
```
Create the mobile version (390×844, no frame) of the attached desktop screen: replace the sidebar with a 5-item bottom navigation bar (الرئيسية، الحاويات، المالية، الحسابات، المزيد), turn tables into stacked cards, put the main action in a sticky full-width button above the bottom bar, single column. Keep the same style, colors and Arabic right-to-left layout.
```

**E6. Doesn't match the other images**
```
Match the exact visual style of the attached reference image: same background color, card style, border radius, shadows, font style, icon style and navy color. Keep this image's content.
```

---

## F. Google Stitch: the "elegant pass" (added after the first Stitch review)

The first Stitch run got the **structure right**: right-to-left, the right screens, readable. But it looks like a generic admin template. These rules and prompts push it toward the calm, expensive look of products like **Stripe Dashboard, Mercury (banking) and Linear**: fewer boxes, more air, quieter color, and numbers as the hero.

### F1. Why it doesn't feel elegant yet (what to change)
| Problem in the first run | Elegant version |
|---|---|
| **Boxes everywhere.** Every number sits in its own bordered card, and cards sit inside cards (8 boxes above the fold on Home). | Group with **space and thin dividers**, not borders. One white surface per area. On Home, the 4 statuses + 4 money figures become **one calm overview band** split by hairline dividers. |
| **Everything is bold.** Titles, labels, numbers and buttons all at 700, so nothing stands out. | **Two weights only:** 600 for titles and key numbers, 400 for everything else. Labels small (13–14px) and gray. Big numbers in **medium (500)** weight, large size, with tabular digits. |
| **Pastel icon squares** on every card (Material-style). | **No icon tiles.** Small monochrome line icons in gray, only where they help. Color is reserved for status dots and money direction. |
| **Too many navy buttons.** Home has "+ جديد", "+ حاوية جديدة" and 2 outlined money buttons; Vaults has 3. | **Exactly one navy button per screen.** Everything else is a quiet ghost or text button. |
| **Flat gray background + gray borders + shadows** all at once. | Pure white page, a very light sidebar `#FAFAFA` with a hairline edge, borders `#F2F4F7`, **no shadows** except on floating menus and dialogs. Bigger radius (16px) on the few surfaces that remain. |
| **No signature.** It could be any app. | A **brand signature**: a thin 2px navy rule under the page title area, the container number set in **IBM Plex Mono** with letter-spacing, and a restrained warm accent `#B88A44` (Basra sand/brass) used only on the logo and the active-nav marker. |
| **Generic stock logo and cartoon avatar.** | Use our logo from B1. Use initials in a soft circle instead of a cartoon face. |

### F2. Mistakes to fix in the first run (tell Stitch about these)
- **A3 container page:** the charges table has the wrong column titles ("رقم الحاوية / المصاريف / الحالة"). They should be "نوع المصروف / المبلغ / دفعها". The info cards repeat values ("الجهة: بغداد" twice, MSC twice) and one is broken ("الحجم: 4قدم").
- **A13 form summary:** a misspelled duplicate row ("التاحد MSC").
- **A8 statement:** a placeholder title "TABLE CARD", an empty white card, a scrambled currency toggle ("ع.ع | د.$"), and the wrong active menu item (المالية instead of الحسابات).
- **A5 tiles:** a broken title "دفڑ سحب" (should be "سحب").
- **A9 vaults:** the "التاجر الأمين" card mixes "$ 800 د.ع". The header has two extra money buttons.
- **All screens:** the date is "٢٤ نوفمبر ٢٠٢٦". It should be Latin digits with the Iraqi month name: "24 تشرين الثاني 2026". Arabic-Indic digits must not be mixed with Latin ones.
- **A14 shared container:** the essentials card lost the trader field's place. When "shared" is on, it should say "التجار ← في الحصص بالأسفل" so the owner knows where traders went.

### F3. Global style prompt (paste into Stitch FIRST, as the project's design direction)
```
Restyle the whole project with an elegant, premium, calm look — think Stripe Dashboard, Mercury banking and Linear — while keeping the Arabic right-to-left layout, all content and all features.

RULES:
1. Fewer boxes: group content with whitespace and 1px hairline dividers (#F2F4F7) instead of bordered cards. Never put a card inside a card. Only tables, forms and dialogs sit on a white surface with 16px radius and a hairline border. No drop shadows except on dropdowns and dialogs.
2. Background pure white #FFFFFF. Sidebar #FAFAFA with a hairline edge. Generous whitespace: 32px page padding, 48px between major sections.
3. Typography: IBM Plex Sans Arabic. Only two weights: 600 for page titles, section titles and key figures; 400 for everything else. Labels 13–14px in gray #667085. Large figures (balances, counts) 32–40px, weight 500, near-black #101828, tabular Latin digits; the currency symbol smaller and gray. Container numbers in IBM Plex Mono 600 with slight letter-spacing.
4. Color discipline: navy #1E3A8A only for the ONE primary button per screen, the active navigation item and focus rings. Status shown as a small colored dot + gray text (gray confirmed, amber #DC6803 on the way, blue #1570EF arrived, green #079455 delivered). Money direction: red #D92D20 "عليه", green #079455 "له" — text color only, no colored backgrounds. One warm signature accent #B88A44 used only for the logo mark and a 3px marker beside the active navigation item.
5. Icons: thin 1.5px monochrome line icons in gray, 20px, no colored icon tiles, no emoji, no cartoon avatars (use initials in a soft gray circle).
6. Buttons: one solid navy primary per screen; all other actions are ghost (text + icon) or hairline-outlined. 44–48px tall, 10px radius.
7. Tables: no outer border, no zebra stripes, 56px rows, hairline dividers, gray 13px column titles, numbers aligned at the end edge, row hover very light gray.
8. Dates: Latin digits with Iraqi month names (e.g. "24 تشرين الثاني 2026"); never Arabic-Indic digits.
9. Overall feeling: quiet, confident, expensive, very easy to read for a 50-year-old — large type, lots of air, nothing shouting.
```

### F4. Per-screen elegant prompts (after F3, regenerate each screen)

**F4.1 Home (desktop)**
```
Regenerate the home dashboard with the elegant style. Top: greeting "مساء الخير، أبو علي" (600) and the date "24 تشرين الثاني 2026" in gray. Then ONE overview band on a white surface with hairline vertical dividers and no inner boxes: four status figures (label with a small colored dot + a 36px number: تم التأكيد 12 · في الطريق 8 · وصلت أم قصر 5 · سُلّمت هذا الشهر 21), and under a hairline, four money figures in the same style (القاصة الرئيسية 48,250,000 د.ع · قاصة الدولار 12,400 $ · لنا عند التجار 18,600 $ in red text · علينا للجهات 14,200 $ in green text). A slim, quiet amber text line with a dot: "3 حاويات في أم قصر منذ أكثر من 7 أيام — عرض". Then the "الحاويات الحالية" table (no outer box, hairline rows, status as dot + text, container numbers in IBM Plex Mono). The only navy button on the page is "+ حاوية جديدة" at the end of the table header; "قبض" and "صرف" are ghost buttons. Keep the right sidebar (#FAFAFA, initials avatar).
```

**F4.2 Container page**
```
Regenerate the container page with the elegant style. Header: container number "MSCU4829175" in IBM Plex Mono 600 at 32px, under it one gray line "أحمد كاظم · أجهزة كهربائية · 40 قدم · MSC · Shanghai · B/L COSU62341"; ghost buttons "تعديل", "طباعة", "⋯". A minimal status line: 4 steps as small circles joined by a thin line, completed steps navy with a check, the current step a navy ring with its date, the next step gray with a quiet text button "نقل إلى هذه المرحلة". Two columns separated by whitespace (no boxes): right "المصاريف" as a clean table with titles "نوع المصروف / المبلغ / دفعها" (rows: كمرك بصرة 2,000 $ شركة التخليص - الصين; غرامة ميناء 100 $ شراكة أم قصر; أتعاب شركة 300 $ ربح الشركة in green text) and the only navy button "+ إضافة مصاريف"; left "ملخص الحساب" as a simple list with a hairline before the total "المجموع على التاجر 2,400 $" (600, 28px) and "رصيد التاجر: عليه 2,400 $" in red text. Below: container info as a two-column definition list (label gray, value black) — no icon boxes, no repeated values. A thin vertical timeline "السجل".
```

**F4.3 Add container form**
```
Regenerate the "حاوية جديدة" form with the elegant style. One centered form column 640px wide on white, no outer card for the essentials — instead a section title "1 الأساسيات" with a small gray "مطلوب" and a 2px navy rule on its start side. Three fields with labels above (14px gray), 48px inputs with hairline borders and 10px radius: رقم الحاوية (IBM Plex Mono, with "✓ متاح" in green 13px), خط الشحن, التاجر; then a toggle "حاوية مشتركة (لأكثر من تاجر)". Below, three folded sections as simple rows separated by hairlines (title + gray "اختياري · 0 من 6" + chevron), no boxes. A slim summary on the left side as plain text lines with small green checks. Bottom sticky bar: one navy button "حفظ الحاوية", ghost "حفظ وإضافة أخرى", text "إلغاء".
```

**F4.4 Vaults**
```
Regenerate the vaults page with the elegant style. One featured main vault panel in deep navy #1E3A8A with white text: small label "القاصة الرئيسية", huge figure "48,250,000" with a small gray-white "د.ع", and quiet white ghost actions "كشف · إيداع · سحب". The other vaults as a clean list (not boxes): each row shows a small gray line icon, the vault name, its balances in 20px medium tabular digits (e.g. "3,500,000 د.ع · 800 $"), and a chevron; hairline dividers between rows. One navy button "+ قاصة جديدة" in the header; no other filled buttons.
```

**F4.5 Trader statement**
```
Regenerate the trader statement with the elegant style. Header: "أحمد كاظم" (600, 28px), phone in gray Latin digits. Two balance figures side by side with a hairline divider, no boxes: "الدولار" label and "2,400 $" in red text with a small "عليه" tag; "الدينار" label and "مسدد" in gray. One navy button "استلام دفعة", ghost "دفع للتاجر". Tabs as simple underlined text. Filters in one quiet row: date range field, text chips "هذا الشهر" (selected, navy underline), "الشهر الماضي", "هذه السنة", and a clean two-option toggle "$ | د.ع". Ghost actions "طباعة · Excel · واتساب". The table: no outer box, columns التاريخ / الرقم / البيان / عليه / له / الرصيد, hairline rows, amounts tabular; a bold totals row at the bottom. Correct active sidebar item: الحسابات.
```

**F4.6 Phone home**
```
Regenerate the phone home with the elegant style: white background, a compact greeting, a horizontal swipe row of minimal figure blocks (label + big number, separated by hairlines, no boxes), status as dot + text, container rows as clean list items with hairline dividers (number in IBM Plex Mono, trader and goods in gray, amount at the end), one sticky navy button "+ حاوية جديدة", and a bottom navigation with thin gray icons and a navy active item.
```

### F5. Tips for Stitch specifically
- Run **F3 first**, then regenerate screens one by one with F4. Stitch keeps the project style, so each new screen inherits it.
- If a screen drifts, reply with: *"Apply the project's elegant style rules strictly: fewer boxes, one navy button, two font weights, hairline dividers, no icon tiles."*
- Export the **design system .md** again after the elegant pass and put it in `docs/mockups/`. The AI coding tool can read the exact colors and type scale from it.
- Stitch's HTML export is a **visual reference only**. Don't paste it into the app code. The real app is built from Untitled UI components by the master prompt.
