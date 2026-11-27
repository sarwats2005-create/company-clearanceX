---
name: clearancex-redesign
description: The owner's redesign brief and UI/UX handbook for the ClearanceX container-clearance app (Arabic, RTL, Next.js + Untitled UI), used by a ~50-year-old owner with little tech experience. Includes real app-store review research (Revolut, Wise, Monzo, WhatsApp, Google Wallet/Pay/Photos), Google Material 3 research, UX laws and heuristics, and rules for animation, spacing and responsive layouts. Use this skill whenever you work on ANY page, component, color, layout, spacing, animation, transition, loading state, phone/tablet/desktop layout, icon, flow or the design system of this app, including the home dashboard, main vault (القاصة), adding a container, charges or expenses (المصاريف), shipping lines, receipts, statements, WhatsApp sharing or the settings pages. Also use it when the user says the UI is flat, ugly, too complicated, slow, cramped or broken on phone, asks to "redesign", "make it look better", "make it easier", or asks which design system or apps to copy, even if they don't mention the brief.
---

# ClearanceX redesign

The owner rejected the current "elegant pass" look (white surfaces, hairlines, almost no icons, see `DECISIONS.md` §Architecture 4). They called it flat and overcomplicated. This brief **replaces** that direction. When `DECISIONS.md`, `docs/IMAGE_PROMPTS.md` Part F or older mockups disagree with this skill, this skill wins, and you should log the change in `DECISIONS.md`.

Who it is for: one owner in Basra, about 50, reads Iraqi Arabic, comfortable with WhatsApp and basic Excel, uncomfortable with "software words". Every decision is judged by one question: **could this person do it on the first try, without being shown?**

## Read before you start

Always read the first one. Then read the ones that match what you are touching. Each has a contents list and
ends with a review checklist and its sources.

| File | Read it when | What's inside |
| --- | --- | --- |
| `references/owner-requirements.md` | **Every time** | The owner's own words, all demands, the page checklist, later requests (add new ones with a date) |
| `references/app-reviews.md` | Choosing a pattern or changing something the owner already uses | What real users praise and hate in Revolut, Wise, Monzo, WhatsApp, Google Wallet/Pay, Google Photos/Gmail; why redesigns get rolled back |
| `references/google-material.md` | Sizing, layout, RTL, or "how would Google do it" | Material 3 Expressive research (45+ users on par, key buttons found 4× faster, labels matter), Next Billion Users, touch targets, window size classes, RTL mirroring |
| `references/ux-principles.md` | Designing or reviewing any screen | Nielsen's 10 heuristics, the UX laws (Jakob, Fitts, Hick…), GOV.UK one-thing-per-page, forms, money screens, errors and empty states, Arabic copy, accessibility |
| `references/visual-system.md` | Changing any style | Our surfaces, gradients, icon tiles and colour meanings, status pills, shape, navigation |
| `references/spacing-layout.md` | Placing or sizing anything | The 18px rem (spacing steps are 4.5px), the gap scale, touch targets, text and icon sizes, page and card anatomy |
| `references/motion.md` | Adding any animation, transition or loading state | NN/g durations (100–300ms), easing, our tokens and recipes, when not to animate, spinner vs skeleton, reduced motion |
| `references/responsive.md` | Anything that must work on phone and computer (everything) | Breakpoints, what changes per size, table→cards, safe areas and thumbs, how to test at 390px |
| `references/feature-specs.md` | Touching expenses, the add-container flow, logos, WhatsApp or the vault | Exact behaviour as built |
| `references/ux-research.md` | Quick overview | Short summary of the apps we borrowed from, and the design-system decision |

## How to work

1. **Research first, then design.** The owner asked that the design come from studying top-rated apps, not from your taste. Before a page redesign, check `references/app-reviews.md`, `references/google-material.md` and `references/ux-principles.md`. If a pattern you need isn't there (for example a new kind of screen), search the web for how top-rated apps (Revolut, Wise, Monzo, WhatsApp, Google's own apps, Apple Design Award winners) handle it and what users say about them in reviews, then add what you learned to `references/app-reviews.md` with the source links. Tell the owner in plain words which app the idea comes from and why people like it.
2. **Redesign the page, not just the paint.** For each page, first remove steps: count the taps for its main job before and after, and say both numbers. Then apply the visual system. A new color on a page that still needs three taps is not a redesign.
3. **Cover every page.** The owner wants every page, component, color and the design system redone. Keep a checklist in your reply or plan, using the page list in `references/owner-requirements.md` (it includes Settings and all of its sub-pages, which were missed last time).
4. **Stay inside the codebase rules.** Arabic RTL only, strings in `src/messages/ar.json` via `t()`, logical Tailwind classes (`ps-`, `start-`), semantic color tokens (`bg-primary`, `text-secondary`, never `bg-gray-100`), `Aria*` prefixed imports from `react-aria-components`, kebab-case file names, Untitled UI components from `src/components/base` and `src/components/application` before building your own.
5. **Run the checklists.** Before calling a page done, go through the review checklists at the end of `spacing-layout.md`, `motion.md`, `responsive.md` and the heuristics table in `ux-principles.md`. Also ask the four questions from `app-reviews.md` §7: fewer taps? nothing familiar moved? every number shown before it's saved? always a next step?
6. **Show it working.** Run the app and look at each changed page at phone width (390 px) and desktop (1440 px). Check: every icon has a text label, tap targets are at least 48 px, body text at least 16 px, nothing scrolls sideways, RTL arrows point the right way. Send the owner screenshots, not a description.
7. **Explain in plain words.** The owner is a beginner. Say what changed and why in short sentences, without terms like "component", "token" or "state". Example: "The main vault balance is now the first thing on the home page, in a big blue card. You no longer need three taps to see it."

## Non-negotiables (why each matters)

- **Main vault is loud and one tap away.** It is the owner's cash. It is the hero card at the top of the home dashboard (balance in both currencies and quick actions, `references/feature-specs.md` §5) and it has its own page reachable in one tap from anywhere (nav item plus the hero card itself). Today it takes three taps, which the owner called out directly.
- **Expenses are entered while adding the container.** Re-adding fees after the container is saved is the second thing the owner called out. Adding a container is short steps with the expenses inside the flow, pre-filled from the owner's default expense types (`references/feature-specs.md` §1 and §2).
- **Icons everywhere, always with a label.** Icons tell this owner what is going on at a glance; a label under or beside each icon removes guessing. Never an icon alone except the universal close X, and even that gets an `aria-label`.
- **Shipping lines are picked by logo**, not by a flat list of names (`references/feature-specs.md` §3).
- **Anything about money can be sent on WhatsApp**: a container's details, any debit or credit receipt, a statement. The owner chooses picture (JPEG of the receipt) or text before sending (`references/feature-specs.md` §4).
- **Depth, not flatness.** Gradient backgrounds and sleek raised cards give the app the "good design taste" the owner wants (`references/visual-system.md`). Keep text contrast at 4.5:1 on top of any gradient.

## What not to do

- Don't hide things behind menus to make a screen look clean. For this owner, a visible big button beats a tidy "⋯" menu.
- Don't use English UI words. English appears only in container numbers and shipping-line names.
- Don't add a feature without the matching setting, or a setting without a way to change it from the page where it's used (the expense-types rule in §1 of the specs is the model).
- Don't ship trademarked carrier logo files inside the repo without the owner's OK; see `references/feature-specs.md` §3 for the upload approach.
