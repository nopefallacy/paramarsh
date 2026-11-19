# Paramarsh — Beyond the Surface

Front-page prototype (G1/G2 in the blueprint) and brand foundations.

- `index.html` is the home page documentary: prologue, the name, four chapters, epilogue and close.
- `brand.html` covers brand foundations: the idea, mark, line language, the honesty rule, paper and inks, the sheet devices, type, charts, motion and voice.

## Run locally

```bash
python3 .claude/serve.py 5318
```

Then open http://localhost:5318.

## The concept

*Parāmarśa* (परामर्श) is the step of inference between seeing smoke on a hill and knowing there is fire: reasoning from the surface to what lies beneath, with honesty about which is which.

The site is a **printed survey sheet**. It uses buff paper, a double neatline with registration marks, a margin that shows the sheet number and the hour, and a map printed in separate inks: brown terrain, blue water, green living systems, vermilion people and yellow roads. The paper takes the light of the time of day as you scroll.

- **Prologue:** the sheet looks plain from far away. A glass (loupe) reveals the detailed map beneath wherever you look, then grows until the whole surface is gone.
- **Competence:** the map comes apart into its printing plates, one layer of knowledge at a time. It then goes back down "in register" with a press-like settle.
- **Consistency:** 50 tree rings, one per project cycle. The sun moves around them while the structure holds.
- **Transparency:** a geological section under a conclusion. Unknown boundaries are drawn dashed, with a "?".
- **Benevolence:** a decision as a ripple that reaches one person, then a community, then the world around them.
- **Epilogue:** the same map printed at night. The vermilion houses from the morning are now lights.

**Honesty rule:** solid lines mean observed or verified. Dashed lines mean inferred, illustrative or unknown.

**Type:** Zodiak and Ranade (Indian Type Foundry), with Eczar for Devanagari.

## Structure

```
assets/css/tokens.css   paper, inks, type, spacing
assets/css/home.css     the sheet, cartouches, chapters
assets/js/main.js       scroll orchestration (GSAP ScrollTrigger + Lenis), glass, plates, night, margin
assets/js/atlas.js      generated terrain printed to plates: relief, contours, water, people, roads; night sheet
assets/js/rings.js      Consistency: tree rings + project lifecycle
assets/js/strata.js     Transparency: cross-section of a conclusion
assets/js/ripple.js     Benevolence: who a decision reaches
```

There is no WebGL and no build step. The plates are rendered to canvases once and moved with CSS transforms. Reduced motion is supported through the OS setting and through a footer toggle.

## Before publishing

- Proof-point links (`#how`, `#work`, …) are placeholders for the corporate pages (G6).
- The illustrative road example, the lifecycle questions and the map annotations ("school", "weekly haat") should be checked or replaced with approved Paramarsh material.
- Benevolence should eventually use real, consented documentary photography and video (blueprint §07).
- The mark is a proposal. If a logo already exists, the ring system can work as a supporting device.
