# What top-rated apps do, and what we took from them

Researched 2026-11-27. Add new findings at the bottom with their sources. Most sources are design-agency
write-ups and benchmark rankings, not independent user studies, so treat them as expert opinion.

## The answer to "is there one design system that has everything?"

No single public design system covers all of the owner's demands (logo pickers, WhatsApp receipts,
default expense lines, Arabic RTL, older users). The best fit is what the app already runs on:

- **Keep Untitled UI + React Aria** as the engine: accessible (keyboard, screen readers), RTL-ready,
  free, already in the code. Replacing it would cost weeks and give the owner nothing they can see.
- **Change its skin and its patterns**, borrowing from the apps below. That is what the redesign did.

## Apps people love, and why

| App | Why people like it | What we borrowed |
| --- | --- | --- |
| **Revolut** | Money first: the balance is the biggest thing on screen; round action buttons with a word under each; colorful category icons. Ranked near the top of UK banking-app UX benchmarks. | The main vault "hero" card with big white numbers and round قبض / دفع / تحويل / تصريف / مصروف buttons. |
| **Monzo** | Plain language, no jargon, bright and friendly; topped the 11:FS UK feature benchmark (98/100, later 100). | Plain Arabic everywhere ("لنا عند التجار", not "debit"); a friendly confirmation sentence before saving money. |
| **Wise** | Currency clarity: every amount shows its currency clearly, flags and symbols. | Every line shows دولار/دينار; currency is a big two-button switch, never a hidden dropdown. |
| **WhatsApp** | The app this owner already uses every day: one big obvious action, green = send. | The green WhatsApp button; sending a picture of the receipt exactly like sending a photo. |
| **iPhone / Android Settings** | Each row has a small colored icon tile; groups of related rows in white cards. Older users already know it. | Settings home: grouped white cards, a colored icon tile per row. |
| **Apple Design Award 2026, Interaction winners** (e.g. Moonlitt) | Praised for "easy onboarding" and "simple, intuitive" controls tailored to the device. | One clear next step after each action (the add-container step bar). |

## Rules for older, low-tech users (and why)

- **Icons always with a word.** Icons alone are ambiguous even to experienced users; older users rely on the label. (Smashing Magazine, "A Guide To Designing For Older Adults", 2024.)
- **Big tap targets, space between them.** Treat Apple's 44px as the minimum, not the goal; 48px+ with 12–16px between targets prevents mis-taps.
- **Body text 16px+, 18–20px for main content**, sans-serif, generous line height. The app already scales text (Settings → العرض).
- **Show, don't hide.** A visible big button beats a "⋯" menu. Put the most important thing (the vault) on the first screen.
- **Test with the real person.** Guidelines are a starting point; watch the owner use it.

## Sources

- [LogRocket: great examples of fintech UX](https://blog.logrocket.com/ux-design/great-examples-fintech-ux)
- [11:FS: feature benchmarking of UK banks and challengers](https://www.11fs.com/article/feature-benchmarking-ranking-the-uks-banks-and-challengers)
- [11:FS: Monzo retains top spot with a perfect score](https://www.11fs.com/article/monzo-retains-top-spot-in-uk-banks-and-challengers-ranking-with-perfect-score)
- [Mind the Product: UX that builds trust, what top fintechs get right](https://www.mindtheproduct.com/ux-that-builds-trust-what-top-fintechs-get-right/)
- [Kota: how Revolut and Monzo use UX to build trust](https://kota.co.uk/blog/how-fintech-brands-like-revolut-and-monzo-use-ux-to-build-trust)
- [Smashing Magazine: a guide to designing for older adults (2024)](https://smashingmagazine.com/2024/02/guide-designing-older-adults)
- [Smashing Magazine: designing age-inclusive products (2023)](https://smashingmagazine.com/2023/07/designing-age-inclusive-products-guidelines-best-practices)
- [UX Collective: a guide to interface design for older adults](https://uxdesign.cc/a-guide-to-interface-design-for-older-adults-31109468d46d)
- [Apple Newsroom: 2026 Apple Design Award winners](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/)
