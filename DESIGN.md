---
name: Sell Your Shelf
description: A paper-led UK book marketplace where covers carry the colour and brand green punctuates.
colors:
  ground: "#2D4A3E"
  ground-deep: "#1F3329"
  ground-raised: "#38594B"
  paper: "#FAF7F2"
  paper-warm: "#F2EDE4"
  paper-deep: "#E8E2D6"
  sheet: "#FFFFFF"
  ink: "#1A1D1B"
  ink-soft: "#55605A"
  ink-faint: "#67716B"
  on-ground: "#FAF7F2"
  action: "#8A5A16"
  action-deep: "#6E4711"
  accent: "#C08A3E"
  rule: "#DED6C9"
  notice-bg: "#FFF7E6"
  notice-line: "#E8C97A"
  notice-ink: "#6A4F0E"
  notice-strong: "#B85C00"
  danger-bg: "#FDECEC"
  danger-line: "#FCA5A5"
  danger-ink: "#991B1B"
  danger-strong: "#7F1D1D"
  cond-like-new: "#3F7A55"
  cond-very-good: "#38618C"
  cond-good: "#A8792B"
  cond-acceptable: "#67716B"
typography:
  display:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(38px, 4.4vw, 60px)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.014em"
  headline:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(28px, 3.2vw, 42px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.014em"
  title:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.008em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: "normal"
  label:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.15em"
  figure:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "normal"
  body-prose:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.64
    letterSpacing: "normal"
  emphasis:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  control:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  meta:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  fine:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "4px"
  md: "8px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "22px"
  lg: "40px"
  xl: "76px"
  xxl: "92px"
components:
  cta-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  cta-primary-hover:
    backgroundColor: "{colors.action-deep}"
  cta-light:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ground-deep}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  cta-quiet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "11px 22px"
  chip-category:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
  chip-category-hover:
    backgroundColor: "{colors.paper-warm}"
  card-listing:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "14px 2px 0"
  panel-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px"
  input-search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "13px 20px"
---

# Design System: Sell Your Shelf

## Overview

**Creative North Star: "The Independent Bookshop, Properly Run"**

This is the category standard executed at reference craft, chosen deliberately after a full direction round in which a more inventive instrument-and-viewfinder world was designed, built, and set aside. That is worth stating plainly: the conventional path here is a decision, not a default, and it is not to be re-litigated or quietly subverted with imported quirk.

The system triangulates three references, each contributing exactly one thing. **Fable** proves that a deep green can carry a page without turning it into a brochure, and that real covers can do the work commissioned illustration usually does. **Daunt** contributes letterspaced restraint and the confidence to leave space empty. **Vinted** contributes transactional clarity — prices legible at a glance, tabular and unambiguous, because this is a marketplace before it is a mood.

The resulting world is **paper-led with green as punctuation**. Warm paper carries the reading; brand green holds the navigation, one trust band, the closing panel and the footer — roughly an eighth of the page rather than three-quarters. That ratio is the single most important thing here. Green is a pinned brand commitment and it is not decorative, but at page scale it flattens the covers, and the covers are the product.

**Key Characteristics:**
- Warm paper ground; brand green as punctuation, never as the field
- Literata at weight 600 for every heading, sentence case, never shouted in caps
- Archivo for the wordmark, all UI, and every figure — always tabular
- Book covers at generous scale, carrying all the colour the page needs
- Hairline rules; no brackets, no heavy borders, no instrument chrome
- Rounded pill actions against otherwise square-ish geometry
- Every text tone verified at 4.5:1 or better on its own ground

## Colors

A warm, low-chroma palette in three families: one green, a paper-to-ink neutral run, and a single brass action colour.

### Primary
- **Brand Green** (`#2D4A3E`): A pinned brand commitment and the colour of the app icon. Holds the nav, the trust band, the closing panel and the footer. It is punctuation, not ground.
- **Green Deep** (`#1F3329`): Nav and footer, where the band must sit behind content without competing.
- **Green Raised** (`#38594B`): The fill behind a cover fallback, so a missing image still reads as brand rather than as a hole.

### Secondary
- **Brass** (`#8A5A16`): The single action colour. Chosen to replace the retired gold trim, and darkened specifically so white text on the fill clears 4.5:1. Every primary action on the site is this colour or nothing.
- **Brass Light** (`#C08A3E`): Focus rings, text selection, and the active nav underline. Never used for text.

### Neutral
- **Paper** (`#FAF7F2`): The reading ground and the dominant surface of the site.
- **Paper Warm** (`#F2EDE4`) / **Paper Deep** (`#E8E2D6`): Hover and pressed states on paper.
- **Sheet** (`#FFFFFF`): Panels that must lift off paper — the reading-shelf card, dropdowns, the steps band.
- **Ink** (`#1A1D1B`): Primary text. Near-black, never pure black.
- **Ink Soft** (`#55605A`): Body copy and labels. **6.13:1** on paper.
- **Ink Faint** (`#67716B`): Authors, condition, row numbers. **4.73:1** on paper.
- **Rule** (`#DED6C9`): The hairline. Warm, never grey.

### Tertiary
Condition reads as a small coloured dot beside a word, not a filled badge: Like New `#3F7A55`, Very Good `#38618C`, Good `#A8792B`, Acceptable `#67716B`.

**Feedback** exists only on transactional surfaces — basket, checkout, order states. Marketing surfaces have no notices, and adding one there is a sign the copy is doing the wrong job. Notice: `#FFF7E6` ground, `#E8C97A` rule, `#6A4F0E` text, `#B85C00` for emphasis. Danger: `#FDECEC` ground, `#FCA5A5` rule, `#991B1B` text, `#7F1D1D` for emphasis.

### Named Rules

**The Punctuation Rule.** Green appears on roughly one-eighth of any page: nav, one band, the closing panel, footer. A green section adjacent to another green section is a defect. The covers supply the colour; the brand supplies the accents.

**The Warm Neutral Rule.** No neutral here is chromatically neutral. Test: if a tone has equal R, G and B it is wrong. `#F5F5F5`, `#E5E5E5` and `#CCCCCC` break the world instantly.

**The Legible Faint Rule.** There is no such thing as a decorative text tone. `--color-ink-faint` exists to be quieter, not lighter than legible, and it is pinned at 4.73:1. Any new muted tone is measured against its actual ground before it ships — the tone this replaced looked correct and was 2.99:1.

## Typography

**Display Font:** Literata (variable weight, fallback Georgia, serif)
**Body / UI Font:** Archivo (variable width axis, fallback system-ui)

**Character:** A sturdy reading serif against a neutral grotesk. Literata was chosen over Libre Caslon Display, which ships in one weight and whose hairlines thin out on colour, and over Bodoni Moda, whose register is fashion rather than bookish. The variable weight axis is the point: this face holds at 600 on paper and on green alike.

### Hierarchy
- **Display** (Literata 600, `clamp(38px, 4.4vw, 60px)`, 1.08, `-0.014em`): The hero headline. Sentence case.
- **Headline** (Literata 600, `clamp(28px, 3.2vw, 42px)`, 1.12): Section headings.
- **Title** (Literata 600, 21px): Step and sub-section headings.
- **Body** (Archivo 400, 18px lede / 15.5px prose, 1.62): Reading copy.
- **Long-form body** (Archivo 400, 17px, 1.7, Ink): Blog article copy only. A step above UI prose and a shade darker, because here the reader settles in rather than scans — Ink Soft across a whole article is a strain that Ink is not. Nothing outside an article body uses this step.
- **Label** (Literata 600, 12.5px, `0.15em`, uppercase): Region marks — "READING SHELF", footer column heads, stat labels.

### Named Rules

**The Sentence Case Rule.** Headings are set in sentence case. This world does not shout; an all-caps headline belongs to the instrument direction that was set aside.

**The Tabular Money Rule.** Every price, total and figure is set in Archivo with `tabular-nums lining-nums`. Prices in a column must align on the decimal, always.

**The Label Weight Rule.** Region marks are 12.5px Literata **600** at `0.15em`. Daunt's wide tracking works on a wordmark at size; at label scale, loose tracking plus light weight dissolves. Tracking above `0.18em` at this size is a defect.

## Layout

Content sits in a 1160px container with 32px gutters, dropping to 20px below 640px. Bands run full width and alternate paper → white → paper so that "paper-led" does not flatten into a single beige field.

The homepage hero is a two-column grid (`1fr .9fr`) that collapses to one column at 900px. The marketplace grid runs 4 columns, to 3 at 900px and 2 at 640px. Section rhythm is generous — 92px between major bands, 76px inside the hero.

**Breakpoints are 900px and 640px. There are only two.**

### Named Rules

**The Two-Breakpoint Rule.** 900 and 640. A third breakpoint is drift; the previous system had eight, mixing `min-width` and `max-width`, and no one could reason about it.

**The Track Floor Rule.** Every grid column is `minmax(0, 1fr)`, never bare `1fr`. A bare `1fr` will not shrink below its content's min-content width, which pushes the page into horizontal scroll — the cause of every overflow bug in this build. Card titles now clamp to two lines rather than using `nowrap`, which removes the worst offender, but the rule stands: any long unbroken string re-creates it.

## Elevation & Depth

Flat, with one exception: **covers cast shadows, surfaces do not.** A book cover carries `0 8px 20px rgba(26,29,27,.16)`, deepening to `0 18px 34px rgba(26,29,27,.24)` on hover with a 4px lift. Everything else — panels, cards, bands — separates by hairline rule or by a tonal step between paper, warm paper and sheet.

### Shadow Vocabulary
- **Cover rest** (`box-shadow: 0 8px 20px rgba(26,29,27,.16)`): Every cover image, so books sit on the page as objects.
- **Cover hover** (`box-shadow: 0 18px 34px rgba(26,29,27,.24)` with `translateY(-4px)`): Marketplace cards only.
- **Dropdown** (`box-shadow: 0 16px 34px rgba(26,29,27,.26)`): Search suggestions and overlay panels.

### Named Rules

**The Objects-Cast-Shadows Rule.** Shadow belongs to things that would physically cast one — a book on a table. Panels and bands are regions, not objects, and separate by rule or tone.

## Shapes

Two radii do almost all the work: **4px** on covers and cards, **999px** on every action and chip. Panels take 8px. Nothing else exists. Actions are unambiguously pill-shaped — Fable's confidence — while content stays near-square so covers read as rectangles rather than as rounded tiles.

Borders are 1px `#DED6C9` on paper and `rgba(255,255,255,0.22)` on green. There are no 2px borders in this system.

### Named Rules

**The Pill-or-Square Rule.** If it can be clicked, it is a pill. If it holds content, it is square or 4px. There is no middle radius, and a 12px-rounded button is drift from a previous system.

## Components

Components are quiet: they frame covers and prices without competing. Restraint is the point.

### Buttons
- **Primary:** Brass fill, white text, pill, `14px 28px`, Archivo 600 at 15px. Hover darkens to Brass Deep.
- **Light (on green):** Paper fill, deep green text, same geometry. The store-adjacent action inside green panels.
- **Quiet:** Transparent with a 1px rule border and ink text, `11px 22px`. Used for "See all".
- **Focus:** A 2px Brass Light ring at 3px offset, global. Every interactive element has one.

### Chips
- **Category:** Paper fill, 1px rule, pill, `10px 18px`, Archivo 500 at 14px. Hover fills Paper Warm.
- **Condition:** Not a badge — a 7px coloured dot beside a 12px Ink Faint word. Non-interactive.

### Cards / Containers
- **Listing card:** No background, no border. A 4px-radius cover with its shadow, then title (15px Archivo 600), author (13px Ink Faint), and a footer row of price (16px, tabular) and condition. Hovers as a 4px lift on the cover's shadow. The card is the cover; the chrome is absent by design.
- **Sheet panel:** White, 1px rule, 8px radius, 24px padding. The reading-shelf card and the search dropdown.

### Inputs / Fields
- **Search:** Paper fill, no visible border at rest, left half of a pill, `13px 20px` at 15px. Pairs with a brass submit that completes the pill.
- **Focus:** The global Brass Light ring.

### Navigation
Deep green band, 56px, 1px rule-dim bottom border. The symbol sits beside an **Archivo 600 wordmark at 16px** — never a serif, which reads limp at this scale. Links are 13.5px Archivo 600 at 82% white, going solid with a Brass Light underline when active. Below 900px the row collapses to search and a menu button.

### The Utility Row Rule
Share is page **utility**, not page **action**, and it always sits at the right edge of the page's top identity row — the breadcrumb trail on a listing or book page, the name row on a shelf. It never joins the buy column: a third pill of the same shape beside *Add to basket* dilutes the only action that earns money.

Three consequences, each of them measured rather than assumed:
- **The corner must be free.** A fixed panel parked top-right makes the rule impossible. The basket widget sits bottom-right on every breakpoint for exactly this reason.
- **Below 640px the label goes, not the button.** Share collapses to its icon in place; the accessible name stays on the button.
- **A row that can't hold both, doesn't.** The shelf header column is ~240px on a phone and an @username alone needs 210 — so there the action drops below the facts rather than colliding with the name. Measure the column before assuming a row fits.

### Signature Component: The Reading Shelf
A white panel holding five real covers in a row above a ruled list of titles and tabular prices, closing on a total. The total is labelled **"Total of N listings shown"** — precisely, because a total implying "what your shelf is worth" would be a claim the product cannot support. It is the clearest expression of the system: real covers, real prices, honest arithmetic, quiet frame.

## Do's and Don'ts

### Do:
- **Do** keep green to roughly an eighth of a page — nav, one band, the closing panel, footer.
- **Do** set every heading in Literata 600, sentence case.
- **Do** set every price and figure in Archivo with tabular lining numerals.
- **Do** give covers room and let them supply the colour.
- **Do** use `minmax(0, 1fr)` for every grid track.
- **Do** measure any new muted tone against its actual background before shipping it.
- **Do** label derived figures precisely — say what was counted.

### Don't:
- **Don't** add a third breakpoint. There are two: 900 and 640.
- **Don't** put a display serif in the wordmark or anywhere below about 18px.
- **Don't** set a heading in all caps; that belongs to the direction that was set aside.
- **Don't** give a panel or band a drop shadow. Only covers cast shadows.
- **Don't** introduce a radius between 8px and 999px.
- **Don't** use a cool or pure grey anywhere. If R, G and B are equal, it is wrong.
- **Don't** render unfiltered live inventory on a marketing surface — it shows the current audience's cheapest stock, and PRODUCT.md records curation as a product requirement.
- **Don't** re-open the direction. The conventional path was chosen deliberately over a built alternative; execute it straight.
