# Visual system (redesign 2026-11)

Defined in `src/styles/app.css` (utilities) and `src/styles/theme.css` (tokens). Use these instead of
inventing new one-off styles.

## Surfaces

| Utility | Use for |
| --- | --- |
| `bg-app` | The page background (soft blue + gold glow over off-white). Set once on the app layout. |
| `surface` | Every content block: white, 1.25rem radius, soft navy shadow. Lists, forms, sections, empty states. |
| `bg-hero` + `shadow-hero` | The loud cards only: the vault hero, the main vault card, the sidebar, the login background. |
| `glass` | Bars floating over content: phone header, phone tab bar, sticky form action bars. |
| `bg-brand-gradient` + `shadow-button-brand` | Primary buttons, the "+ جديد" button, active step circles, active chips. |

Hairline-only layouts (`border-y` + `divide-y` with no card) are the old look. Put lists inside a
`surface` and keep `divide-y` inside it.

## Icon tiles

`<IconTile icon={...} color="..." size="sm|md|lg|xl" />` (`src/components/app/icon-tile.tsx`): a
gradient rounded square with a white icon, like phone settings icons. `CardTitle` = tile + title + hint
+ actions for the top of a card. `PageHeader` and `FormPageHeader` take `icon` + `iconColor`.

Color meaning (keep it consistent so the owner learns it):

| Color | Means |
| --- | --- |
| `brand` | Home, the company |
| `orange` | Containers, "on the way" |
| `gold` | Vaults, money we hold |
| `teal` | Money section |
| `purple` | Accounts, traders/shared |
| `pink` | Expenses (charges) |
| `green` | Money in, fees (profit), delivered, WhatsApp (`whatsapp`) |
| `red` | Money out, debts |
| `blue` / `indigo` | Between vaults, transfers, info, "arrived" |
| `gray` | Settings, history, neutral |

Every icon has a text label next to it. Decorative icons get `aria-hidden`.

## Status

`StatusDot` is now a soft colored pill with the status icon (`STATUS_META` in `status-dot.tsx`):
confirmed = gray CheckCircle, on the way = orange Route, arrived = blue Anchor, delivered = green PackageCheck.

## Shape, type, motion

- Radius: cards 1.25rem, hero 1.75rem, inputs/buttons `rounded-xl`, pills `rounded-full`, dialogs `rounded-3xl`.
- Font: IBM Plex Sans Arabic; container numbers IBM Plex Mono (`.cn`). Numbers `tabular-nums` (`.num`).
- Tap targets ≥ 44px (most are 48–56px). Body text ≥ 16px; the owner can enlarge it in Settings → العرض.
- Motion: `rise-in` for cards appearing, `active:scale-[0.97]` press feedback, 150ms `ease-smooth`. All
  off with reduced motion.
- Colors in code use semantic tokens (`text-primary`, `bg-secondary`, `text-error-primary`…). The
  gradient utilities are the one place raw palette values live.

## Navigation

- Desktop: floating dark gradient sidebar on the start side (right), each item with its icon tile;
  active item glass-white with a gold dot.
- Phone: floating frosted tab bar: الرئيسية، الحاويات، **القاصة**، الحسابات، المزيد. The active tab
  shows its colored tile. "المزيد" opens big tiles for every section.
- "+ جديد" is the one bright button in the top bar; its menu shows each action with its own icon tile.
