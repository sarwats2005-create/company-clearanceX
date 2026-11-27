# Motion and animation

Animation here has one job: **show the owner what just happened and where things went**. It is never decoration.
A 50-year-old owner who can't tell whether a tap worked will tap again and save twice, so feedback motion
matters more here than in most apps.

## Contents
1. The research in one table
2. Our curves and timings (use these)
3. Recipes for this codebase
4. When NOT to animate
5. Loading: spinner, skeleton or progress bar
6. Reduced motion
7. Review checklist
8. Sources

## 1. The research in one table
| Source | Rule |
| --- | --- |
| Nielsen Norman Group | Most UI animation is **100–500 ms**. Simple feedback (toggle, checkbox) is **~100 ms** and feels instant. Bigger screen changes (a modal coming in) take **200–300 ms**. **400 ms is "very slow"** and only for big moves across large screens; at 500 ms it "starts to feel like a real drag". Animations are far more often too long than too short. |
| Nielsen Norman Group | **Entering is a little longer than leaving** (a popup takes 300 ms to appear and 200–250 ms to go). Use **ease-out for entering**; ease-in or ease-in-out "can feel unresponsive" because they start slowly. |
| Nielsen Norman Group | The **more often** an animation happens, the **shorter and subtler** it should be. The farther something travels, the more it needs smooth motion. |
| Material 3 | Standard easing for small functional changes, emphasized for expressive ones. Emphasized decelerate is `cubic-bezier(0.05, 0.7, 0.1, 1)` for entering; emphasized accelerate is `cubic-bezier(0.3, 0, 0.8, 0.15)` for leaving. Tokens run 50–1000 ms. |
| Apple HIG | **Don't add motion to frequently used interactions** beyond what standard controls already do. Motion should feel physical and credible, and springs can carry on from the finger's speed. Minimize or remove animation when **Reduce Motion** is on. |
| Emil Kowalski (`emil-design-eng` skill) | Press feedback by scaling to ~0.97, never `ease-in` for UI, exits faster than entries, interruptible transitions. Already applied in this repo (`DECISIONS.md`). |

## 2. Our curves and timings (use these, don't invent new ones)
| Token / class | Value | Use for |
| --- | --- | --- |
| `ease-smooth` | `cubic-bezier(0.23, 1, 0.32, 1)` (strong ease-out) | Almost everything: hovers, presses, cards, popovers |
| `ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Sheets and drawers sliding in (the expenses sheet, "المزيد") |
| `duration-100` | 100 ms | Colour and hover changes, toggles, checkboxes (NN/g "instant") |
| `duration-150` | 150 ms | Press scale, small moves, menu items |
| `duration-200` | 200 ms | Popovers and dropdowns opening, dialog exit |
| `duration-300` | 300 ms | Dialogs and sheets entering. **Upper limit for anything frequent.** |
| `.rise-in` | 360 ms fade + 6px rise | A card or line appearing once (the vault hero, a new expense line) |
| Press | `active:scale-[0.97]` / `data-pressed:scale-[0.97]` | Every button and tappable card: the owner *sees* the tap land |

Exit = about 70% of the entry time (entry 300 → exit 200). Dialogs already do this (`modal.tsx`).

## 3. Recipes for this codebase
- **Tappable card**: `transition-[box-shadow,transform] duration-150 ease-smooth hover:shadow-card-hover active:scale-[0.985]`.
- **Button**: the base `Button` already scales on press. Don't add more motion.
- **Something appears in a list** (a new expense line): add `rise-in` to the new item only, never to the whole list on every render.
- **Status changed / saved**: a toast (`sonner`) plus the changed element updating in place. Don't animate numbers counting up for money: it suggests the value is changing.
- **Moving between steps** (container → expenses): the sheet slides in from the start side with `ease-drawer`, and the step bar's circle turns green. That is the "you moved forward" signal.
- **Chevron hint**: `group-hover:-translate-x-0.5` on the ‹ of a tappable row (it points left in RTL).
- **Animate only `transform` and `opacity`** (plus colour and shadow for hovers). Never animate `width`, `height`, `top` or `left`: it janks on cheap phones.

## 4. When NOT to animate
- Typing, scrolling, number entry, anything done tens of times a session.
- The money figures themselves (no count-up, no flashing balances).
- Page-to-page navigation: instant is better than a fancy transition for this owner.
- Anything that delays the owner reaching a button (no intro animations, no staggered lists longer than ~5 items).
- Parallax and scroll-jacking: never (a vestibular trigger, NN/g).

## 5. Loading: spinner, skeleton or progress bar (NN/g thresholds)
| Wait | Show |
| --- | --- |
| < 1 s | Nothing. An indicator that flashes is worse than none. |
| 1–10 s, whole page | A **skeleton** in the same shape as the real content (`home-skeletons.tsx`), so nothing jumps when it arrives. |
| 1–10 s, one action | A **spinner inside the button** (`isLoading` + `showTextWhileLoading`, e.g. "جارٍ الحفظ…") and the button disabled, so it can't be pressed twice. |
| > 10 s | A **progress bar or a time estimate** ("جارٍ تجهيز الملف… قد يستغرق دقيقة"). |

Evidence on skeletons is mixed: a 136-person test (Viget) found skeletons worst in an **unfamiliar** interface.
They work best when the skeleton matches a layout the owner already knows, so keep skeleton shapes identical to
the loaded page.

## 6. Reduced motion
`app.css` already cuts every animation to 1 ms under `prefers-reduced-motion`. When you add motion:
- Make sure the state change is still obvious **without** the animation (colour, text, icon).
- Never put information only in motion (e.g. a shake as the only error signal; also show the error text).

## 7. Review checklist
- [ ] Every tap gives visible feedback within 100 ms (press scale or colour).
- [ ] Nothing frequent takes longer than 300 ms; nothing at all longer than 400 ms.
- [ ] Entering uses ease-out (`ease-smooth`/`ease-drawer`); exits are shorter.
- [ ] Only transform and opacity move.
- [ ] Works and still makes sense with reduced motion on.
- [ ] Saving buttons show a spinner and can't be pressed twice.

## 8. Sources
- [NN/g: Executing UX animations, duration and motion characteristics](https://www.nngroup.com/articles/animation-duration/)
- [NN/g: Skeleton screens 101](https://nngroup.com/articles/skeleton-screens/), [NN/g video: skeleton screens vs progress bars vs spinners](https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/), [Viget: a bone to pick with skeleton screens](https://viget.com/articles/a-bone-to-pick-with-skeleton-screens)
- [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md), [WWDC23: Animate with springs](https://developer.apple.com/wwdc23/10158), [App Store: reduced motion criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria)
- Material 3 easing values (secondary sources): [Motion design tokens guide](https://camoa.github.io/dev-guides/css/css-craft/motion-design-tokens), [Flutter Easing class](https://api.flutter.dev/flutter/material/Easing-class.html)
- [Val Head: How fast should your UI animations be?](https://valhead.com/?p=2978)
