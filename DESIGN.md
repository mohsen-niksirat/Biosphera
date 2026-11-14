# Biosphera — Design Direction (v2 redesign)

## Design Read

Reading this as: a full-screen scientific simulation instrument for curious minds,
in a deep-ocean bioluminescent laboratory language.
Dial: **ENERGY 2 / RHYTHM 2 / MOTION 1**.

- ENERGY 2: confident and precise, not loud. The living canvas provides the drama; chrome stays calm.
- RHYTHM 2: one consistent panel language, with deliberate breaks (header readout strip vs floating toolbars vs modal dialogs).
- MOTION 1: hover/focus/entrance transitions only. A simulation app must not compete with its own canvas.

## Style anchor

A research-vessel observation deck: dark abyssal surfaces, lab-instrument data
readouts, one bioluminescent accent. Explicitly NOT a SaaS dashboard, NOT
glassmorphism-everywhere, NOT a marketing page.

## Identity motif (the thing that makes it Biosphera)

1. **Bioluminescent pulse** — the accent teal appears ONLY on live/active things:
   active brush, playing state, focus rings, unlocked trophies, live values.
   Zero accents elsewhere; the accent is a status signal, not decoration.
2. **Instrument readouts** — every number renders in the mono stack with its unit
   (`128`, `Gen 14`, `42s`), labels in small caps. The UI speaks like lab equipment.

## Palette (2 surface tones + ink + 1 accent; data colors are functional encoding)

| Role | Hex | Reason |
|---|---|---|
| Abyss (page bg) | `#050d14` | Deep-sea water column; near-black blue-teal, distinct from generic slate |
| Panel | `#0c1a24` | Elevated surface, 1 step up from abyss |
| Panel raised | `#12242f` | Interactive surfaces (inputs, hover) |
| Ink (text) | `#dcecf2` | Cold foam-white; ≥ 12:1 on abyss |
| Ink muted | `#8fa9b3` | Secondary text; ≥ 5:1 on panel (verified) |
| **Accent (bio-teal)** | `#3fe0d0` | The single accent. Dark ink on accent: `#04211d` |
| Danger | `#fb7185` | Destructive actions only (Reset, Terminate) |

Functional data colors (shared with the canvas renderer, not decoration):
herbivore `#34d399`, carnivore `#fb7185`, omnivore `#fbbf24`, vegetation `#34d399`/`#10b981`.

## Typography

- UI: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
- Data: `ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace`
- Reason: Biosphera is a zero-dependency offline PWA; webfonts would break the
  promise. System stacks are the honest choice; mono-for-numbers is the instrument voice.
- Scale: 11px uppercase labels (+0.08em, used sparingly) · 13px body · 13-14px mono values · 16px modal titles. No large mono display type.

## Layout system

- Header 56px: logo mark + wordmark · readout strip (center, scrolls on narrow) · grouped icon actions (right).
- Canvas fills the remaining viewport, full-bleed.
- Floating layers over canvas: inspector (right), ecology chart (bottom-left), trends (top-right), toolbar (bottom-center), hint (top-center).
- Spacing: 4px base grid; panel padding 16px; control gaps 6-8px; group separators.
- Radius: 8px controls · 12px panels/modals · full-round ONLY for toast + segmented speed control. Nothing else is pill-shaped.
- Elevation: one shadow tier for floating layers (`0 8px 24px rgba(0,0,0,.45)`); modals slightly deeper. No glow shadows.

## Glass policy (written purpose per antislop R-10)

Backdrop blur ONLY on floating overlays that sit on top of the moving canvas
(inspector, drawers, toolbar, hint, toast) — purpose: text readability over
animated organisms. Surfaces stay high-opacity (≥ .88) so they survive with blur
unsupported. Header, modals, mobile menu: fully solid, zero blur.

## Motion tokens

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);   /* entrances */
--ease-snappy: cubic-bezier(0.4, 0, 0.2, 1);     /* hovers, toggles */
--dur-fast: 150ms;  --dur-base: 200ms;  --dur-medium: 280ms;
```
Transitions limited to `opacity, transform, background-color, border-color, color, box-shadow`.
Everything wrapped in `@media (prefers-reduced-motion: reduce)` → transitions/animations off.

## Icon system

Inline SVG sprite in `index.html` (`<symbol>` + `<use>`), 24px viewBox,
1.5px stroke, round caps/joins, `currentColor`. Replaces ALL UI-chrome emojis
(buttons, headers, legends, badges). Emojis remain ONLY as per-trophy artwork
inside trophy cards (content, not chrome). Every icon-only control gets
`aria-label`; decorative icons get `aria-hidden="true"`.

## Accessibility commitments

- Visible `:focus-visible` ring (2px accent) on every interactive element; never `outline: none` bare.
- Touch targets ≥ 44px on coarse pointers; 28-32px is acceptable only with mouse pointer.
- Modals: `role="dialog"`, `aria-modal`, labelled title, Escape closes, backdrop click closes.
- Toast is `role="status"` + `aria-live="polite"`.
- Zoom is never disabled in the viewport meta.
- Text selection allowed everywhere except canvas HUD chrome.

## Anti-patterns explicitly banned here

Em-dash in copy · pill-everything radii · glow on multiple element types ·
blur on solid-surface containers · template icon sets (sparkle/robot/orb) ·
fake stats or testimonials · dead controls · zoom blocking.
