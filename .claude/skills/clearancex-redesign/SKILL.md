---
name: clearancex-redesign
description: The owner's redesign brief for the ClearanceX container-clearance app (Arabic, RTL, Next.js + Untitled UI), used by a ~50-year-old owner with little tech experience. Use this skill whenever you work on ANY page, component, color, layout, icon, flow or the design system of this app, including the home dashboard, main vault (القاصة), adding a container, charges or expenses (المصاريف), shipping lines, receipts, statements, WhatsApp sharing or the settings pages. Also use it when the user says the UI is flat, ugly, too complicated, asks to "redesign", "make it look better", "make it easier", or asks which design system or apps to copy, even if they don't mention the brief.
---

# ClearanceX redesign

The owner rejected the current "elegant pass" look (white surfaces, hairlines, almost no icons, see `DECISIONS.md` §Architecture 4). They called it flat and overcomplicated. This brief **replaces** that direction. When `DECISIONS.md`, `docs/IMAGE_PROMPTS.md` Part F or older mockups disagree with this skill, this skill wins, and you should log the change in `DECISIONS.md`.

Who it is for: one owner in Basra, about 50, reads Iraqi Arabic, comfortable with WhatsApp and basic Excel, uncomfortable with "software words". Every decision is judged by one question: **could this person do it on the first try, without being shown?**

## Read before you start

1. `references/owner-requirements.md`: the owner's own words and the full list of demands. Read it every time; it is the source of truth.
2. `references/ux-research.md`: what the best-rated apps do and why people love them, plus the design-system recommendation. Read it before you choose any look or pattern.
3. `references/feature-specs.md`: exact behaviour for the expense lines, WhatsApp receipts, shipping-line logos and the main vault. Read the section for the feature you are touching.
4. `references/visual-system.md`: colors, gradients, cards, icons, type and motion. Read it before you change any style.

## How to work

1. **Research first, then design.** The owner asked that the design come from studying top-rated apps, not from your taste. Before a page redesign, check `references/ux-research.md`. If a pattern you need isn't there (for example a new kind of screen), search the web for how top-rated apps (Revolut, Wise, Monzo, WhatsApp, Apple Design Award winners) handle it and what users say about them in reviews, then add what you learned to that file with the source links. Tell the owner in plain words which app the idea comes from and why people like it.
2. **Redesign the page, not just the paint.** For each page, first remove steps: count the taps for its main job before and after, and say both numbers. Then apply the visual system. A new color on a page that still needs three taps is not a redesign.
3. **Cover every page.** The owner wants every page, component, color and the design system redone. Keep a checklist in your reply or plan, using the page list in `references/owner-requirements.md` (it includes Settings and all of its sub-pages, which were missed last time).
4. **Stay inside the codebase rules.** Arabic RTL only, strings in `src/messages/ar.json` via `t()`, logical Tailwind classes (`ps-`, `start-`), semantic color tokens (`bg-primary`, `text-secondary`, never `bg-gray-100`), `Aria*` prefixed imports from `react-aria-components`, kebab-case file names, Untitled UI components from `src/components/base` and `src/components/application` before building your own.
5. **Show it working.** Run the app and look at each changed page at phone width (390 px) and desktop (1440 px). Check: every icon has a text label, tap targets are at least 48 px, body text at least 16 px, nothing scrolls sideways, RTL arrows point the right way. Send the owner screenshots, not a description.
6. **Explain in plain words.** The owner is a beginner. Say what changed and why in short sentences, without terms like "component", "token" or "state". Example: "The main vault balance is now the first thing on the home page, in a big blue card. You no longer need three taps to see it."

## Non-negotiables (why each matters)

- **Main vault is loud and one tap away.** It is the owner's cash. It is the hero card at the top of the home dashboard (balance in both currencies, last movements, quick actions) and it has its own page reachable in one tap from anywhere (nav item plus the hero card itself). Today it takes three taps, which the owner called out directly.
- **Expenses are entered while adding the container.** Re-adding fees after the container is saved is the second thing the owner called out. Adding a container is short steps with the expenses inside the flow, pre-filled from the owner's default expense types (`references/feature-specs.md` §1).
- **Icons everywhere, always with a label.** Icons tell this owner what is going on at a glance; a label under or beside each icon removes guessing. Never an icon alone except the universal close X, and even that gets an `aria-label`.
- **Shipping lines are picked by logo**, not by a flat list of names (`references/feature-specs.md` §3).
- **Anything about money can be sent on WhatsApp**: a container's details, any debit or credit receipt, a statement. The owner chooses picture (JPEG of the receipt) or text before sending (`references/feature-specs.md` §2).
- **Depth, not flatness.** Gradient backgrounds and sleek raised cards give the app the "good design taste" the owner wants (`references/visual-system.md`). Keep text contrast at 4.5:1 on top of any gradient.

## What not to do

- Don't hide things behind menus to make a screen look clean. For this owner, a visible big button beats a tidy "⋯" menu.
- Don't use English UI words. English appears only in container numbers and shipping-line names.
- Don't add a feature without the matching setting, or a setting without a way to change it from the page where it's used (the expense-types rule in §1 of the specs is the model).
- Don't ship trademarked carrier logo files inside the repo without the owner's OK; see `references/feature-specs.md` §3 for the upload approach.
