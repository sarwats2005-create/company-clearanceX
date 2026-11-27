# UX principles, laws and patterns, applied to ClearanceX

The classic rules of UI/UX, each with what it means **for this owner and this app**. Use it as a lens when
designing a screen and as a checklist when reviewing one.

## Contents
1. Nielsen's 10 usability heuristics
2. The UX "laws"
3. Patterns proven with non-technical users (GOV.UK and others)
4. Forms
5. Money screens
6. Errors, empty states and confirmations
7. Writing (UX copy) in Arabic for this owner
8. Accessibility minimums
9. Sources

## 1. Nielsen's 10 usability heuristics
| # | Heuristic | In ClearanceX |
| --- | --- | --- |
| 1 | **Visibility of system status** | Every save shows a toast naming what was saved and its receipt number; buttons show a spinner while saving; the step bar shows where you are in adding a container. |
| 2 | **Match the real world** | Iraqi Arabic words the owner uses (قاصة، وصل، كمرك، عليه/له), never "debit/credit". Receipts look like his paper receipts. Shipping lines show their real logos. |
| 3 | **User control and freedom** | "تخطي الآن" on the expenses step, "رجوع" on every confirmation, cancelling a receipt posts a reversal instead of deleting. Never a dead end. |
| 4 | **Consistency and standards** | Same icon and colour for the same thing everywhere (`visual-system.md`); same place for the main action on every page. |
| 5 | **Error prevention** | Duplicate container numbers are caught while typing; a vault going below zero asks again; defaults fill the most likely value. |
| 6 | **Recognition rather than recall** | Pick the line by logo, the expense type from a list, the trader from a searchable list; remember the last-used line and port. |
| 7 | **Flexibility and efficiency** | Starred default lines, "حفظ وإضافة أخرى" for a whole ship, Ctrl+Enter to save and Ctrl K to search for faster users, invisible to others. |
| 8 | **Aesthetic and minimalist design** | One loud thing per screen; optional fields folded away; no decoration that doesn't carry meaning. |
| 9 | **Help users recover from errors** | Errors in plain Arabic next to the field, saying what to do ("اكتب المبلغ"), and the form scrolls to the first one. |
| 10 | **Help and documentation** | Hints under fields ("يظهر وحده في صفحة المصاريف…"), empty states that say what to do next. No manual needed. |

## 2. The UX "laws"
- **Jakob's law**: people spend most of their time in *other* apps, so they expect yours to work the same way. → WhatsApp-style sharing, phone-Settings-style settings, a bank-app-style vault card. Don't invent new interactions.
- **Fitts's law**: the time to hit a target depends on its size and distance. → Big main buttons near the thumb (sticky bottom bars on phones); the destructive trash is small and away from Save.
- **Hick's law**: more choices mean slower decisions. → The add-line popup shows only types *not yet added*; the "+ جديد" menu has 6 items, not 9; optional fields are folded.
- **Miller / chunking**: people hold a few items at once. → Settings in 4 groups of 2–4; long numbers in mono font with spacing; amounts with thousands separators.
- **Doherty threshold (~400 ms)**: below about 400 ms a response feels instant and people stay in flow. → Feedback within 100 ms (press scale). Small toggles should change on screen at once and save in the background. The expense-line star still waits for the server today, so making it instant is a known improvement.
- **Peak-end rule**: people judge an experience by its best moment and its end. → End every task on a clear success: "تم! أُضيفت الحاوية ومصاريفها", the receipt with its WhatsApp button.
- **Tesler's law (conservation of complexity)**: complexity has to live somewhere, so put it in the app, not on the owner. → Splitting shared-container charges, exchange rates and vault choice are computed and pre-filled; the owner confirms.
- **Aesthetic–usability effect**: people find good-looking interfaces easier to use and forgive small problems. → This is why the owner's "flat and ugly" complaint matters even when everything technically works.
- **Von Restorff (isolation) effect**: the one thing that looks different is remembered. → Only one gradient hero / one gradient button per screen.
- **Serial position effect**: first and last items are remembered best. → Home first, Settings last in navigation; the most-used actions (قبض، دفع) first in the hero.

## 3. Patterns proven with non-technical users
- **One thing per page** (GOV.UK, NHS): starting with one question per page measurably works better for the public than complex forms, and GOV.UK dropped accordion forms. → Adding a container is short steps (container, then expenses), and each step has one clear job. Merge steps only when testing shows it helps.
- **Check your answers** (GOV.UK): show everything in one plain summary before committing. → Our confirmation dialog with the full sentence and per-line list.
- **Progressive disclosure**: show the basics; reveal the rest on demand. → Required fields open, optional sections folded with "اختياري · 0 من 4".
- **Defaults and memory**: the best field is the one already filled correctly. → Last-used line/port/date, default vault per currency, starred expense lines with their currency.
- **Undo over "are you sure?"** for reversible things; confirmation only for money and destructive acts. → Removing an expense line is one tap (it isn't saved yet); saving money always confirms.

## 4. Forms
- Labels above fields, always visible (no placeholder-only labels). A placeholder shows an *example* ("مثال: MSCU4829175").
- Mark what's required; everything else says "(اختياري)".
- Pick, don't type: segmented buttons for ≤ 5 options (currency, size), a searchable list for many (traders), logos for brands.
- Validate as soon as a field is left; never clear what the owner typed on an error.
- Draft safety: unsaved forms survive a refresh (the container form's draft) and leaving asks first.
- Enter moves to the next field; the Save button is always reachable (sticky bar on phones).

## 5. Money screens (fintech lessons from `app-reviews.md`)
- Show the amount, currency, from and to **before** saving (Wise's "price upfront").
- Signs and colours never lie: green = money in / we are owed, red = money out / we owe. Words beside colour ("عليه"، "له") for colour-blind users.
- Never animate or flash a balance. Never hide which vault the money came from.
- Every movement produces a numbered receipt that can be printed or sent.
- Warn before a vault goes negative, and let the owner proceed knowingly ("نعم، احفظ رغم ذلك").

## 6. Errors, empty states and confirmations
- **Error message formula**: what happened + what to do, in his words. ✗ "Invalid input". ✓ "اكتب المبلغ بالأرقام فقط، مثل 2400".
- Several errors: a summary at the top with links to each field, plus each field marked.
- **Empty state formula**: icon tile + why it's empty + the one action that fills it ("لا توجد حاويات بعد" + "حاوية جديدة").
- **Confirmation formula**: a full sentence of the consequence + a specific button label ("نعم، احفظ المصاريف", never just "OK").
- Success: a toast that names the thing, and where relevant a next step ("فتح الحاوية").

## 7. Writing (UX copy) in Arabic for this owner
- Short sentences; one idea each. Verbs on buttons ("حفظ"، "إرسال واتساب"، "إضافة سطر").
- No technical words: not "sync", "record", "entity", "dashboard". English only for container numbers and line names.
- The same word for the same thing everywhere (always "القاصة", never sometimes "الخزنة").
- Numbers: Latin digits (as he uses them), thousands separators, currency always shown (د.ع / $).
- Use the `design:ux-copy` skill when writing new copy.

## 8. Accessibility minimums (WCAG 2.1 AA)
- Text contrast ≥ 4.5:1 (≥ 3:1 for large text), including white text on gradients: check the lightest part of the gradient.
- Everything works by keyboard; visible focus ring (`outline-focus-ring`).
- Icon-only buttons have `aria-label` (and a tooltip); decorative icons `aria-hidden`.
- Colour is never the only signal (status pills have icon + word; money has عليه/له).
- Respect reduced motion; support the text-size setting; touch targets ≥ 44px.
- Use the `design:accessibility-review` skill for a full audit.

## 9. Sources
- [NN/g: 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Laws of UX](https://lawsofux.com/) (Jakob, Fitts, Hick, Miller, Doherty, Peak-end, Tesler, Aesthetic–usability, Von Restorff, Serial position)
- [GOV.UK Design System: question pages](https://design-system.service.gov.uk/patterns/question-pages), [GOV.UK Service Manual: form structure](https://www.gov.uk/service-manual/design/form-structure), [GDS blog: one thing per page](https://designnotes.blog.gov.uk/2015/07/03/one-thing-per-page/), [GDS user research: no more accordions](https://userresearch.blog.gov.uk/2015/08/13/no-more-accordions-how-to-choose-a-form-structure/), [GDS 2024: GOV.UK Forms testing](https://gds.blog.gov.uk/2024/01/12/how-were-making-it-easier-to-access-government-forms-online/), [NHS: question pages](https://service-manual.nhs.uk/design-system/patterns/question-pages)
- [Smashing: designing for older adults](https://smashingmagazine.com/2024/02/guide-designing-older-adults)
- [W3C: WCAG 2.1](https://www.w3.org/TR/WCAG21/)
