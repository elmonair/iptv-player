# DESIGN.md

## 1. Design North Star

M2player should feel like a focused streaming control surface.

It is not a marketing site and not a generic SaaS dashboard.

The interface should feel:

- dark
- clear
- calm
- capable
- fast to scan

The best version of this product gets users to content quickly and stays out of the way.

## 2. Color

### Core palette

- Background base: very dark navy / slate
- Surface: slightly lifted dark slate panels
- Surface border: low-contrast slate border
- Primary action: indigo / violet accent
- Secondary accent: warm yellow for media emphasis and counts
- Success: green for active/subscription state
- Error: red for validation and playback issues
- Text primary: near-white
- Text secondary: muted slate gray

### Color behavior

- Use accent color intentionally, mainly for primary actions and focused active states
- Use yellow sparingly for media counts, badges, and highlights
- Keep most of the product in a restrained dark neutral palette
- Avoid rainbow UIs, multiple competing accent colors, and decorative gradients as the main visual language

### Avoid

- bright SaaS-style gradient overload
- crypto-style neon palettes
- pastel cards on dark background
- low-contrast informational text

## 3. Typography

### General

- Sans-serif UI typography
- Strong, simple hierarchy
- Large headings with compact supporting copy
- Minimum readable body size for all surfaces

### Scale guidance

- Page headings: strong and prominent, especially on mobile and TV
- Section headings: clear and compact
- Body copy: readable but restrained
- Metadata: smaller but still legible on dark backgrounds
- Labels: never tiny, never faint to the point of doubt

### Typography behavior

- Keep copy short
- Use direct labels
- Prefer clarity over personality on product surfaces
- Avoid over-styled typography, novelty pairing, or editorial drama in product screens

## 4. Spacing And Layout

### Layout principles

- Use stable, predictable blocks
- Prefer clean vertical flow on mobile
- Keep spacing generous enough to reduce fatigue
- Let major actions breathe

### Product-specific behavior

- Home page is a launch pad, not a hero-driven composition
- Content grids should prioritize scan speed over decoration
- Cards should be easy to distinguish but not feel nested or over-framed
- Metadata should sit close to the content it explains

### Touch and focus

- Minimum target height should remain large across mobile and TV
- Focus states must be obvious on keyboard/remote-driven surfaces
- Avoid tiny icon-only interactions unless they are still very easy to hit and understand

## 5. Components

### Top navigation

- Dark sticky bar
- Compact but readable
- Logo on the left
- Search, guide, user actions on the right
- Mobile keeps only the essentials visible at first glance

### Cards

- Dark panels with subtle border separation
- Medium radius
- Enough padding for readability
- Do not stack cards inside cards unless there is a strong reason

### Buttons

- Large, obvious, high-contrast primary actions
- Secondary actions should still read clearly on dark backgrounds
- Button labels should be plain and task-oriented

### Input fields

- Dark filled inputs
- Clear labels above fields
- High-contrast placeholder and entered text
- Validation messages should be immediate and unambiguous

### Stats and metadata blocks

- Compact and scannable
- Use repetition only when it improves comprehension
- Do not let informational blocks become decorative dashboard clutter

## 6. Motion, Tone, And UX Restraint

### Motion

- Short, calm transitions
- Motion should confirm actions and state changes
- Never let animation delay access to content

### Tone

- practical
- reassuring
- direct

### UX restraint

- Remove repeated explanations
- Prefer one clear explanation over three weaker ones
- Avoid decorative sections on utility screens
- Utility pages should feel calm and efficient

## 7. Screen-Specific Guidance

### Add Playlist

- Utility screen only
- Minimal copy
- Strong form clarity
- No marketing-style side content

### Home Page

- Lead with where the user can go next
- Continue Watching should be high-value and early when present
- Quick actions should feel immediate and obvious
- Playlist status should be clear but not dominate the screen

### Live / Movies / Series Browsing

- Prioritize quick scanning
- Keep category handling predictable
- Make active state and current position obvious

### Player

- Playback is the priority
- Supporting controls should be visible but secondary
- Error overlays should be calm, readable, and actionable

## 8. Explicit Anti-Patterns

Do not introduce:

- startup hero sections inside product pages
- repeated explanatory copy
- stacked decorative info cards with little value
- tiny labels on dark backgrounds
- unclear button hierarchy
- generic SaaS dashboard motifs that slow down media navigation
