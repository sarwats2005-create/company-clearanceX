# Owner requirements (source of truth)

Saved 2026-11-27. Keep the owner's words; add new requests at the bottom with a date.

## The owner's message (lightly corrected for spelling)

> The app UI is very flat and overcomplicated. The adding-new-container steps, re-adding fees after a container is entered, the main vault needs three clicks to show while it has to stand loudly on the main dashboard and also on its own page. I don't appreciate the UI/UX. You have to redesign every single page, component, color and design system.
> But not by your choice: by looking at the top apps that have the most satisfying UX (the top-rated ones). See people's reactions, study them, see why people like and feel great about the apps, compare them to our app, then decide, or tell me if you found a great design system that contains all the details I mentioned. This app will be handed to a 50-year-old customer who has little to no tech experience.

## Problems the owner named

1. Everything looks flat.
2. Adding a container takes too many steps.
3. Fees/expenses have to be entered again after the container is saved.
4. The main vault takes three clicks to see. It must be loud on the home dashboard and also have its own page.
5. Settings was not redesigned in the last pass.

## What the owner prefers

1. **Shipping lines with their logos** instead of plain names.
2. **More icons on every page**, so the owner knows what is going on at a glance.
3. **Expense lines on the add-expenses page:**
   - An "add line" (+) button opens a popup list of the expense types saved in Settings.
   - The owner can mark expense types as default, each with its default currency.
   - Default types already appear as lines when the page opens.
   - The owner can change which types are default, and their currency, right from the add-expenses page, not only in Settings.
   - Removing an expense line (or a default type) takes one tap.
4. **WhatsApp sharing for every container detail and every debit or credit transaction**, sent as the receipt itself (JPEG picture) or as plain text. The owner picks which before sending.
5. **Gradient backgrounds and elegant, sleek components** for real design taste.
6. **Redesign Settings** and all its sub-pages.

## Page checklist (every redesign must cover all of these)

Main app (`src/app/(app)/`):
- [ ] Home dashboard (main vault hero first)
- [ ] Containers list
- [ ] Add container (short, expenses inside)
- [ ] Container detail (big actions, WhatsApp share)
- [ ] Edit container
- [ ] Money home, money action form, receipt (WhatsApp picture/text), journal
- [ ] Accounts: traders list + page, parties list + page, vaults list + page
- [ ] Settings home and every sub-page: company, charge-types, parties, shipping-lines (logos), ports, sizes, expense-categories, receipts, vaults, currency, display, account
- [ ] Login
- [ ] Print pages: receipt (A5), container (A4), statement
- [ ] Shared pieces: sidebar, bottom nav, mobile header, global search, dialogs, empty states, toasts

Earlier mockup canvas the owner saw: https://claude.ai/artifact/BEX51MUjAfCAtFDMv5uZLQ (home desktop + phone, vault page, 3-step add container). A starting point only; it lacked Settings, logos, WhatsApp pictures and the gradient look.

## Later requests

- 2026-11-27: "The skill creation is the last step for now; complete the redesign request." Do the redesign in the app itself.
