---
name: Genesis Locker
description: Decentralized proof infrastructure for locking tokens and LP - the vault door for on-chain trust.
colors:
  bg: "#080908"
  bg-2: "#0c0d0b"
  card: "#10110f"
  card-2: "#141511"
  accent: "#d9ad4a"
  accent-2: "#f1cb73"
  accent-alt: "#c98a5e"
  success: "#67c790"
  warning: "#f59e0b"
  danger: "#ef4444"
  text: "#f3efe6"
  muted: "#a9a49a"
  dim: "#847f76"
  border: "rgba(221, 179, 83, 0.14)"
  border-2: "rgba(221, 179, 83, 0.09)"
typography:
  display:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4.125rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "0.12em"
rounded:
  sm: "6px"
  md: "10px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#100d05"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
  button-primary-hover:
    backgroundColor: "{colors.accent-2}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
---

# Design System: Genesis Locker

## 1. Overview

**Creative North Star: "The Vault Door"**

Genesis Locker looks like a bank vault, not a slot machine. The base is near-black with a warm undertone (never a cold neutral, never true `#000`), and gold appears the way brushed metal fittings appear on a vault door: at the hinges, the handle, the dial, not smeared across every surface. Most of the interface is quiet - dark cards, muted text, thin gold-tinted hairline borders - so that when gold does appear (a primary action, a locked/renounced badge, the active nav item) it reads as deliberate, not decorative.

This system explicitly rejects the generic DeFi-dashboard template: no purple or violet gradients, no glassmorphism, no neon glow smeared across every card, no identical stat-card grids repeated without hierarchy, no cluttered chain-icon soup competing for attention. It also rejects corporate-fintech sterility - this is not a navy-and-white bank app. It is crypto-native, just the serious, premium end of crypto rather than the meme end.

**Key Characteristics:**
- Warm near-black base, never pure black or pure white
- Gold is a signal reserved for action, trust-state, and active-nav - not a wash
- Flat surfaces at rest; depth communicated through ambient gold glow only on interaction
- Numbers (amounts, dates, percentages, fees) get the strongest typographic weight on any screen
- Plain, factual copy - proof over persuasion

## 2. Colors

A restrained palette: tinted near-black neutrals carry the interface, one gold accent carries meaning, and semantic colors (success green, danger red) are used sparingly and always paired with an icon or label, never color alone.

### Primary
- **Vault Gold** (`#d9ad4a`): The single accent. Used for primary buttons, the active nav indicator, focus rings, locked/renounced trust badges, and the logo mark. Governed by the One Signal Rule below.
- **Bright Gold** (`#f1cb73`): The hover/lit state of Vault Gold - used in gradients (`linear-gradient(180deg, #f1cb73, #d9ad4a)`) and hover transitions, never as a resting fill on its own.

### Neutral
- **Void** (`#080908`): Page background. Warm-tinted black, not `#000`.
- **Recessed Void** (`#0c0d0b`): Sidebar and secondary-surface background, one step back from the page.
- **Vault Panel** (`#10110f`): Card and raised-surface background.
- **Vault Panel Deep** (`#141511`): Nested surface within a card (e.g. a stat row inside a card).
- **Parchment Text** (`#f3efe6`): Primary text. Warm off-white, never pure white.
- **Muted Steel** (`#a9a49a`): Secondary text, descriptions, labels.
- **Dim Steel** (`#847f76`): Tertiary text, timestamps, disabled states.
- **Gold Hairline** (`rgba(221, 179, 83, 0.14)`): Default border color on cards, dividers, and inputs - every border in the system is gold-tinted, never plain white or grey.
- **Gold Hairline Faint** (`rgba(221, 179, 83, 0.09)`): Secondary/inner dividers.

### Semantic
- **Confirmed Green** (`#67c790`): Success states - active locks, "Ownership Renounced", positive trend arrows. Always paired with a checkmark or dot icon, never color alone (colorblind-safe requirement).
- **Caution Amber** (`#f59e0b`): Medium-risk states - "Short Lock", "Low Lock %", "Awaiting Deployment". Deliberately distinct from Vault Gold so a warning is never mistaken for a call-to-action.
- **Alert Red** (`#ef4444`): Danger states - high-risk flags, destructive admin actions. Always paired with a warning icon or explicit label text.
- **Copper** (`#c98a5e`): Secondary categorical accent (e.g. distinguishing LP-type badges from Token-type badges) - a second warm metal tone alongside gold, never used for primary actions.

### Named Rules
**The One Signal Rule.** Gold occupies a small minority of any given screen - the primary CTA, the active nav item, a locked-status badge. If more than one element per view glows gold, the signal is diluted. Secondary actions are outline/ghost, not a second gold button competing for attention.

**The No Cold Neutral Rule.** Every neutral in this system carries a warm undertone toward the gold hue. A pure grey or blue-grey surface is a bug, not a stylistic choice - it signals the value was copied from a generic dark-mode template rather than mixed for this palette.

**The Warning-Is-Not-Gold Rule.** Caution Amber and Vault Gold must never be the same value. If a risk badge and a primary button render in an identical color, a user cannot tell "click this" from "be careful about this" at a glance.

## 3. Typography

**Display/Body Font:** Manrope (with `-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif` fallback)

**Character:** A single geometric-humanist sans carries the entire system - confident at large display weights (800), legible and quiet at body weight (400). No serif, no mono, no second display face. The restraint in font choice mirrors the restraint in color: one typeface family, used with real weight contrast instead of variety.

### Hierarchy
- **Display** (800, `clamp(2.5rem, 5vw, 4.125rem)`, line-height 1.02, letter-spacing -0.025em): Hero headlines only (Home page).
- **Headline** (800, 19px, line-height 1.15): Page titles, section headers.
- **Title** (800, 15px): Card titles, chain names, lock asset names.
- **Body** (400, 14px, line-height 1.5): Default running text and descriptions. Cap prose blocks at 65-75ch.
- **Label** (800, 11px, letter-spacing 0.12em, uppercase): Eyebrow tags, stat labels, section group labels in the sidebar.

### Named Rules
**The Numbers-Win Rule.** Wherever a locked amount, unlock date, percentage, or fee appears alongside its label, the number carries more visual weight (larger size and/or heavier weight, `font-variant-numeric: tabular-nums`) than the label. The label is a caption; the number is the content.

## 4. Elevation

Genesis Locker is flat at rest. There are no structural drop-shadows for card layering - cards sit directly on the background, separated only by a 1px gold-hairline border and a subtle background-lightness step (`--bg` → `--card`). Depth is communicated exclusively through an ambient gold glow that appears in response to interaction (hover, focus, active states), never as a static resting property. A card that glows while nothing is happening is a bug.

### Shadow Vocabulary
- **Interactive glow** (`box-shadow: 0 0 18-24px rgba(217, 173, 74, 0.3-0.5)`): Applied on hover/focus to buttons, active nav icons, and status indicators. Scales in opacity/blur with the importance of the element (primary button hover is stronger than a secondary icon hover).
- **Focus ring** (`box-shadow: 0 0 0 3px rgba(217, 173, 74, 0.22)`): Keyboard focus indicator, applied via `:focus-visible` globally. Never removed without a replacement.

### Named Rules
**The Glow-Not-Shadow Rule.** When a surface needs to communicate "this is interactive" or "this is active," reach for a gold glow, not a dark drop-shadow. Dark shadows on this near-black background barely render and read as a mistake, not a lighting cue.

## 5. Components

### Buttons
- **Shape:** 6px radius (`--r-sm`), never fully square, never pill-shaped except for status badges.
- **Primary:** Background `linear-gradient(180deg, #f1cb73, #d9ad4a)` or solid `#d9ad4a`, text **dark** (`#100d05`) for contrast - never white text on gold. Padding 11px 22px, weight 700-800.
- **Secondary/Ghost:** Transparent background, 1px gold-hairline border (not white/grey), text color `--text`. Hover raises border opacity and adds a faint gold-tinted background wash, never a white-tinted one.
- **Hover:** `translateY(-1px)` plus the interactive glow. No bounce, no scale-pop.

### Cards
- **Corner style:** 10px radius (`--r`).
- **Background:** `--card` (`#10110f`), occasionally `--card-2` for a nested/inset stat row.
- **Border:** 1px solid gold-hairline (`--border`).
- **Shadow strategy:** none at rest; glow only on hover if the card itself is interactive (e.g. a clickable lock card).
- **Internal padding:** 18-20px standard, 14px for dense list rows.

### Inputs / Fields
- **Style:** `--card-2` or `--bg-2` background, 1px gold-hairline border, 10px radius.
- **Focus:** border shifts toward full-opacity gold plus a soft gold glow (`0 0 0 3px rgba(217,173,74,.1), 0 0 24px rgba(217,173,74,.07)`), not a hard blue browser-default ring.

### Navigation (Sidebar)
- Fixed 232px width, `--bg-2` background, gold-hairline right border.
- Nav items: transparent at rest, active item gets a gold-tinted background wash and a left-edge gold indicator bar (the one sanctioned use of a colored side-accent in this system, reserved exclusively for "current page" - not to be reused for cards, alerts, or list items).
- Group labels are uppercase Label-style text in `--dim`.

### Status Badges
- Pill-shaped (`--r-pill`), small dot + label pattern (e.g. green dot + "Active", amber dot + "Awaiting Deployment"). Color is never the only signal - the label text always states the status in words.

## 6. Do's and Don'ts

### Do:
- **Do** use dark text (`#100d05`) on every gold-filled surface (buttons, filled badges) for contrast - never white text on gold.
- **Do** tint every border gold (`rgba(221,179,83, 0.09-0.14)`), including on components ported from older iterations of the app.
- **Do** pair every color-coded status (risk flags, renounced/active badges) with an icon or text label, not color alone.
- **Do** keep gold to a minority of any screen's surface area - one primary action, one active nav state, trust badges. That's it.
- **Do** use `font-variant-numeric: tabular-nums` on any numeric column so figures align.

### Don't:
- **Don't** introduce purple, violet, or blue gradients anywhere - this was the old "Open Locker" theme and every trace should be gone.
- **Don't** use glassmorphism (`backdrop-filter: blur`) as a default card treatment.
- **Don't** add hard, dark `box-shadow` drop-shadows for card elevation - use the gold interactive glow instead, and only on interaction, never at rest.
- **Don't** use `border-left`/`border-right` as a colored accent stripe on cards, alerts, or list rows - the only sanctioned side-accent is the sidebar's active-nav indicator.
- **Don't** build identical repeated stat-card grids without hierarchy - vary size/weight so the most important number wins.
- **Don't** leave raw un-formatted on-chain values (wei, raw addresses, raw hex) in user-facing copy - always format through the existing helpers (`formatEther`, `shortAddress`, etc.).
- **Don't** use white or grey (`rgba(255,255,255,...)`) borders anywhere - every border token is gold-tinted per the No Cold Neutral Rule.
- **Don't** set `--warning` to the same value as `--accent` - they were briefly collapsed to the same gold during the rebrand, which made risk badges indistinguishable from primary buttons. Keep Caution Amber (`#f59e0b`) distinct from Vault Gold (`#d9ad4a`).
