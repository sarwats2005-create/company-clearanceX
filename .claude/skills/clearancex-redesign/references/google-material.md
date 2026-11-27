# Google's native apps and Material Design: what to borrow

How Google designs its own apps (Material 3 and Material 3 Expressive) and its research for people new to
technology (Next Billion Users), translated to this Arabic, RTL, Tailwind + Untitled UI web app. We **borrow
principles and numbers, not the Material look**: no Material components, no Roboto, no Material icons.

## Contents
1. Material 3 Expressive: Google's research on older users
2. Next Billion Users: designing for people new to technology
3. Touch targets and spacing numbers
4. Layout sizes (window size classes)
5. Right-to-left (bidirectionality)
6. Motion (summary; details in `motion.md`)
7. Sources

## 1. Material 3 Expressive: what Google measured
Google ran **46 studies with more than 18,000 participants** over three years (eye tracking, surveys, focus
groups, experiments, usability tests).

- **Key elements were spotted up to 4× faster** in expressive designs across 10 apps. In the email case study, an enlarged Send button was found 4× faster.
- **Users aged 45+ performed on par with younger users.** This is the strongest evidence we have for this owner's age group.
- People of all ages preferred it (up to 87% among 18–24-year-olds).
- The tools: **colour, shape, size, motion and containment**. Examples: make the key action larger, give it its own colour, place it where the hand already is (above the keyboard), and put high-contrast containers around groups.
- Warnings in the same research:
  - **Removing text labels decreased usability.**
  - Unstructured image grids hurt usability.
  - A strong minority prefer calmer versions.
  - Familiarity changes results.

**→ For ClearanceX** (this is why the redesign looks the way it does):
- *Size*: one big primary action per screen (`size="xl"` buttons, the vault hero). Secondary actions are smaller.
- *Colour*: the key action gets the brand gradient. Money in is green, money out is red. Neutral things stay neutral.
- *Containment*: every group sits in a `surface` card; the most important group sits in a `bg-hero` card.
- *Shape*: round action buttons in the hero, pill status badges, rounded cards. Shape tells the kind of thing.
- *Labels always stay.* Never trade a label for space.
- *Calm by default*: bold colour only where it carries meaning, so the screen doesn't shout everywhere.

## 2. Next Billion Users (NBU): people new to technology
Google's NBU team designs for people coming online with little digital experience. That is close to this owner.

- **Icon + text together** is clearer than either alone. Some common icons (the ☰ "hamburger" menu) are **not understood** by new users. → We use a labelled bottom tab bar and a labelled "المزيد" tile grid, never a bare ☰.
- **Fewer visual elements.** For low-literate users, unnecessary visuals confuse; one research team used only two icons in its interface. → Each card shows one idea, and decoration stays out of the way.
- **Voice and one-tap access** (Google's Voice Playbook): important controls should "take up greater space on the screen and require no more than one tap". → The main vault is one tap from every screen.
- **Language and familiarity**: Google Pay won first-time users in India with phone-number login, language choice, regional languages and visual cues. → Arabic only, Iraqi words, numbers in Latin digits (as the owner uses them), container numbers in Latin.
- **Typing is hard**: older users type slowly while looking at the keyboard. → Prefer choosing to typing (logo picker, default lines, remembered last values, segmented buttons for currency and size).

## 3. Touch targets and spacing numbers
| Rule | Material | Apple | This app |
| --- | --- | --- | --- |
| Minimum touch target | **48 × 48 dp** | 44 × 44 pt | ≥ 44px everywhere, 48–56px for main actions |
| Space between targets | **≥ 8 dp** | — | `gap-2` (≈ 9px) minimum, `gap-3` preferred |
| Base grid | **8 dp**, small items on 4 dp | — | Tailwind's 4-unit scale (see `spacing-layout.md`) |
| Side margins | **16 dp** on phones, **24 dp** on larger screens | — | `px-4` phone, `md:px-6`, `lg:px-8` |

A small icon can sit inside a bigger touch area (a 24dp icon in a 48dp target). Use padding to make the
target big, not a bigger icon.

## 4. Layout sizes (window size classes, from Android's adaptive guidance)
| Class | Width | Typical device | Material layout | This app (Tailwind) |
| --- | --- | --- | --- | --- |
| Compact | < 600 | phone portrait | 1 pane, bottom navigation | default + `sm:` (< 768px): one column, floating tab bar |
| Medium | 600–839 | tablet portrait, foldable | 1–2 panes, navigation rail | `md:` (768px): tables instead of cards, 2-column grids |
| Expanded | 840–1199 | tablet landscape | 2 panes | `lg:` (1024px): sidebar appears, tab bar hides |
| Large / XL | 1200–1599 / ≥ 1600 | desktop | 2–3 panes | `xl:` (1280px): summary side panels (e.g. the container form summary) |

Android notes compact covers 99.96% of phones in portrait. Design phone-first, then let bigger screens show more
**side by side**; never show *different* features on different screens.

## 5. Right-to-left (bidirectionality)
- **Mirror** what shows direction or progress: back/forward arrows, chevrons ("next" points left in Arabic), progress bars, sliders, steppers, sheets that slide from the start side.
- **Don't mirror** real-world objects (keyboard, headset, printer), clocks and time icons, brand logos (WhatsApp, shipping lines), or Latin text inside icons.
- **Checkmarks**: design systems disagree. We keep checkmarks unmirrored (the universal ✓).
- **Numbers and codes** stay left-to-right inside RTL text: wrap them in `<bdi>` with `.num` or `.cn`. A negative amount carries a left-to-right mark so "-50,000 د.ع" reads correctly.
- Use logical Tailwind classes (`ps-`, `pe-`, `start-`, `end-`, `ms-`, `rounded-s-`). `pnpm lint` fails on physical ones.

## 6. Motion (summary)
Material splits motion into **standard** (functional, short) and **emphasized** (expressive, longer) easing.
Emphasized decelerate for things entering is commonly given as `cubic-bezier(0.05, 0.7, 0.1, 1)`, and emphasized
accelerate for things leaving as `cubic-bezier(0.3, 0, 0.8, 0.15)`. Duration tokens run from 50 ms (short1) to
1000 ms (extra-long4). The official token page didn't load during research, so these values come from
secondary sources that agree with each other. Our own curves and timings are in `motion.md`.

## 7. Sources
- [Google Design: Expressive Material Design research](https://design.google/library/expressive-material-design-google-research)
- [Android: use window size classes](https://developer.android.com/develop/adaptive-apps/guides/use-window-size-classes)
- [Material: applying density (touch targets 48dp, 8dp spacing)](https://material.io/design/layout/applying-density.html), [Material spacing methods](https://material.io/design/layout/spacing-methods.html), [Material metrics & keylines (16dp margins)](https://m1.material.io/layout/metrics-keylines.html), [Google accessibility: touch target size](https://support.google.com/accessibility/android/answer/7101858?authuser=1)
- [Material bidirectionality](https://m2.material.io/go/design-bidirectionality), [Wikimedia Codex bidirectionality](https://doc.wikimedia.org/codex/latest/style-guide/bidirectionality.html), [Adobe Spectrum bi-directionality](https://spectrum.adobe.com/page/bi-directionality)
- [Google Next Billion Users: Voice Playbook](https://nextbillionusers.google/tools/voice-playbook.pdf), [Google blog: voice-first users](https://blog.google/innovation-and-ai/technology/next-billion-users/voice-users-playbook/), [Design for the Next Billion Users (summary)](https://medium.com/@leonidstasivskyi/design-for-next-billion-users-how-to-build-products-for-everyone-not-just-silicon-valley-c47decf52e94), [136 UI guidelines for low-literate smartphone users (CSCW 2021)](https://www.shivanikapania.com/assets/cscw2021paper.pdf)
- Motion tokens (secondary): [Motion design tokens guide](https://camoa.github.io/dev-guides/css/css-craft/motion-design-tokens), [Flutter Easing class](https://api.flutter.dev/flutter/material/Easing-class.html), [Compose easing tokens](https://skill-wiki.github.io/atom/android-compose/rule-motion-easing-tokens)
