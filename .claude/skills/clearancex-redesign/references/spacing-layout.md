# Spacing, sizing and layout

## Contents
1. The unit: watch out, this app's rem is 18px
2. The spacing scale (which gap for what)
3. Sizes: touch targets, text, icons
4. Page anatomy
5. Card anatomy
6. Hierarchy and grouping rules
7. Review checklist

## 1. The unit: this app's rem is 18px
`app.css` sets `html { font-size: 112.5% }`, so **1rem = 18px** (16px or 20px with the text-size setting:
`data-text-size="sm"` / `"lg"`). Tailwind spacing is rem-based, so **one spacing step (`1`) is 4.5px, not 4px**,
and everything grows with the owner's chosen text size. That is on purpose: a bigger text setting also gives
bigger buttons and gaps.

| Class | Default 16px root | This app (18px) |
| --- | --- | --- |
| `1` | 4px | 4.5px |
| `2` | 8px | 9px |
| `3` | 12px | 13.5px |
| `4` | 16px | 18px |
| `5` | 20px | 22.5px |
| `6` | 24px | 27px |
| `8` | 32px | 36px |
| `11` (h-11) | 44px | **49.5px**: meets Material's 48 |
| `12` | 48px | 54px |
| `14` | 56px | 63px |

Breakpoints (`sm`/`md`/`lg`/`xl`) are media queries and **don't** grow with the root size. Custom ones in
`theme.css`: `xxs` 320px, `xs` 600px.

## 2. The spacing scale (which gap for what)
Material's rule (8-unit grid, 4 for small things) maps to Tailwind's even steps. Use **only these**:

| Gap | Use for |
| --- | --- |
| `gap-1` / `gap-1.5` | Icon ↔ its text inside a button, pill or badge |
| `gap-2` | Items inside one control (chips in a row, button + button in a toolbar). The minimum between two tap targets. |
| `gap-3` | Cards in a grid, rows of tiles, list items that are separate cards |
| `gap-4` / `gap-5` | Fields inside a form card, blocks inside one card |
| `gap-6` / `gap-7` | Sections of a page (between cards) |
| `p-4` (phone) → `md:p-6` | Inside a card |
| `px-4` → `md:px-6` → `lg:px-8` | Page side margins (Material: 16 on phones, 24 on larger) |

Rule of proximity: **the space inside a group must be smaller than the space between groups**. If a label sits
as far from its field as from the next field, the eye can't pair them.

## 3. Sizes
**Touch targets**
- Minimum 44px everywhere (`h-11`/`size-11`). Main actions are 48–56px (`size="lg"`/`"xl"` buttons, `min-h-14` list rows, `min-h-18` settings rows).
- At least `gap-2` between neighbouring targets. Destructive buttons (trash) never touch the main action.
- Make icon buttons big through padding, not a bigger icon (`IconButton` is 44px with a 20px icon).

**Text** (older-adult guidance: never below 16px for body; 18–20px for main content)
- Body: `text-md` (≈18px here). Hints and second lines: `text-sm`, never smaller for anything the owner must read.
- `text-xs` only for decorative meta (a step number in a badge, the "Ctrl K" hint).
- Titles: `text-display-xs` for page titles, `text-lg` for card titles. Money: `text-xl`→`text-display-md` with `.num`.
- Two weights only: 600 (`font-semibold`) for titles and amounts, 400 for the rest. Never letter-space Arabic.

**Icons**
- In text and buttons: `size-5` (20px), on phones' tab bar `size-6`.
- `IconTile` sizes: `sm` (32) in dense lists and the sidebar, `md` (40) in cards and lists, `lg` (48) in page headers, `xl` (56) for heroes.

## 4. Page anatomy (top to bottom)
1. **Page header**: icon tile + title + one-line description, actions on the end side (left in RTL). One primary action at most.
2. **The most important thing on this page**: the hero (vault) or the key card. It must be visible without scrolling on a 390×844 phone.
3. **Alerts** that need action (late containers): orange cards with a bell icon and a "عرض" link.
4. **Content cards** in priority order, `gap-6` apart.
5. On phones, leave room for the floating tab bar: `main` has `pb-32`. A sticky action bar sits **above** it (`bottom: tab bar + 0.75rem`).

## 5. Card anatomy (`surface`)
- `CardTitle` row: icon tile, title, optional hint, actions at the end.
- Body with `gap-4`/`gap-5`; lists inside cards use `divide-y divide-secondary` and no outer border.
- A sub-area inside a card (a summary, an empty state) uses `rounded-2xl bg-secondary p-4`: a tinted inset, not another shadowed card. **Never nest shadows.**
- Empty states: an icon tile + one sentence saying what to do next + the button that does it.

## 6. Hierarchy and grouping rules
- **One loud thing per screen** (gradient hero, or one `xl` primary button). If two things shout, neither is heard.
- Colour carries meaning (green in, red out, gold vault, see `visual-system.md`), so don't spend it on decoration.
- Align to one edge: in RTL everything starts at the right; numbers in tables align to the end (left).
- Long forms: one card per topic, folded when optional ("اختياري · 0 من 4"), the required card first and open.
- Lists longer than a phone screen get a filter or search above them, never only scrolling.

## 7. Review checklist
- [ ] Spacing uses only the scale above; inner gaps < outer gaps.
- [ ] No touch target under 44px; main actions ≥ 48px; ≥ `gap-2` between targets.
- [ ] No body text under `text-sm`; main content `text-md` or larger.
- [ ] One primary action per screen; the key content visible without scrolling on a phone.
- [ ] Cards don't contain shadowed cards; insets use `bg-secondary`.
- [ ] Bottom content isn't hidden under the floating tab bar or a sticky bar.
