# Responsiveness: phone, tablet, computer

The owner uses the app on a phone, a tablet and a desktop computer (PRD G10). Each screen size must offer the
**same features in the same places**, only arranged differently. Google's own research and redesign backlash
(`app-reviews.md`) show that moving things between devices or versions confuses people.

## Contents
1. Breakpoints in this app
2. What changes at each size
3. Patterns that adapt
4. Phone specifics (safe areas, keyboard, thumbs)
5. How to test (the scripts we use)
6. Review checklist

## 1. Breakpoints in this app
| Name | Width | Material class | What the owner has |
| --- | --- | --- | --- |
| default | < 640px | compact | Phone portrait. **Design this first.** Test at **390px** (common phones) and **360px** (small Android). |
| `sm` | ≥ 640px | compact/medium | Big phones landscape: 2-column tile grids start |
| `md` | ≥ 768px | medium | Tablet portrait: tables replace card lists, forms get 2 columns |
| `lg` | ≥ 1024px | expanded | Tablet landscape / laptop: **sidebar appears, phone tab bar and phone header hide** |
| `xl` | ≥ 1280px | large | Desktop: side panels (container-form summary), settings in 2 columns |
| (custom) `xs` 600px, `xxs` 320px | | | Used by the kit (toasts); avoid in new code |

## 2. What changes at each size
| Element | Phone (default) | Tablet (`md`) | Computer (`lg`+) |
| --- | --- | --- | --- |
| Navigation | Floating frosted tab bar (5 labelled tabs) + "المزيد" tile sheet | same | Dark gradient sidebar with icon tiles |
| "+ جديد" | Gradient button in the sticky top bar | same | Top bar next to the search |
| Search | Search icon button in the top bar | same | Wide search bar (Ctrl K) |
| Lists (containers, accounts, journal) | **Cards**: logo, number, status pill, trader, totals | **Table** in a `surface` | Table |
| Vault hero | Balances stacked, 5 round actions in one row | Balances side by side | same |
| Forms | One column, **sticky glass action bar** above the tab bar | 2-column field pairs | + summary panel at `xl` |
| Sheets (expenses) | Full-screen sheet | Side sheet, max 44rem | same |
| Dialogs | Bottom-aligned card | Centered | Centered |

## 3. Patterns that adapt
- **Table → cards**: render both and hide one (`hidden md:block` / `md:hidden`), as `containers-list.tsx` does. Card rows put the most important fact on the first line (number + status) and money at the end of the last line.
- **Grids**: `grid-cols-2 lg:grid-cols-4` for tiles; `grid-cols-1 sm:grid-cols-2` for cards with long text.
- **Rows that might overflow**: `flex-wrap` with `gap-x-2 gap-y-1`, and `min-w-0` + `truncate` on the text that may shrink. Status pills and amounts are `whitespace-nowrap`; let the row wrap instead.
- **Fluid widths**: never set fixed px widths on content; use `max-w-*` containers (`max-w-[1280px]` main, `max-w-[42rem]` forms, `max-w-2xl` settings forms).
- **Long words** (container numbers, B/L numbers): keep them `ltr` inside `<bdi>` and allow the row to wrap.

## 4. Phone specifics
- **Safe areas**: anything fixed to the bottom uses `env(safe-area-inset-bottom)` (the tab bar uses `bottom-[max(0.75rem,env(safe-area-inset-bottom))]`).
- **Thumb zone**: the main action of a phone screen sits at the **bottom** (sticky action bar, tab bar), within reach of one hand.
- **Focused tasks hide the tab bar** (add/edit container) so the owner can't wander off mid-form; their own sticky bar replaces it.
- **Keyboard**: number fields use `inputMode="decimal"`/`"numeric"` so the right keyboard opens, and Enter moves to the next field. Never put the save button where the keyboard covers it without a sticky bar.
- **No hover-only features**: everything shown on hover must also work on tap (tooltips are extra, never the only label).
- **No sideways scrolling** ever, except inside a deliberately scrollable box (pill tabs) with `overflow-x-auto`.

## 5. How to test
Run the app with demo data (local Postgres → `pnpm db:setup && pnpm db:demo && pnpm dev`) and use Playwright
(pre-installed in cloud sessions):
1. **Screenshots** at 1440 and 390 (`deviceScaleFactor: 2` for ones the owner sees). Log in as the owner first.
2. **Overflow check** on every changed page at 390px: compare `document.documentElement.scrollWidth` with `clientWidth`, and list every element whose rect leaves the viewport. This caught the status pill overflow in the phone container cards.
3. **Drive the real flow** (add a container → expenses → save) at both sizes, not just screenshots.
4. Restart `next dev` with a clean `.next` if a page shows old classes: stale server modules cause false hydration warnings.

## 6. Review checklist
- [ ] Looks right at 360, 390, 768, 1024 and 1440px.
- [ ] `scrollWidth == clientWidth` at 390px on every changed page.
- [ ] Same features on every size; nothing exists only on desktop.
- [ ] Main action within thumb reach on phones; not hidden by the tab bar or the keyboard.
- [ ] Tables become cards below `md`; cards wrap instead of overflowing.
- [ ] Works with text size set to "large" (Settings → العرض).
