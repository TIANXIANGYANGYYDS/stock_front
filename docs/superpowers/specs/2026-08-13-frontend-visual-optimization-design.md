# Frontend Visual Optimization Design

Date: 2026-08-13
Status: Approved by user delegation

## Objective

Improve the frontend into a clearer, more cohesive professional A-share decision terminal without changing the primary application framework or reducing any business data. Existing navigation, index strip, decision three-column layout, market intelligence composition, news stream/detail composition, creator ranking/stream/detail composition, APIs, and request behavior remain intact.

## Design Read

The product serves high-frequency A-share research and decision users. It should feel like a restrained institutional trading desk: dense, precise, calm, and trustworthy. The visual system evolves from the existing navy terminal identity rather than replacing it.

Design dials:

- `DESIGN_VARIANCE: 4` — preserve the main grid while introducing clearer hierarchy and fewer repeated card treatments.
- `MOTION_INTENSITY: 3` — use motion only for hover, focus, view changes, loading, and overlays.
- `VISUAL_DENSITY: 8` — retain all data while improving scan paths and small-screen legibility.

## Considered Directions

### A. Institutional Trading Desk — selected

Flat navy surfaces, thin separators, restrained cyan focus color, semantic red/green market colors, stronger numeric hierarchy, compact controls, and minimal glow. This is closest to the current product identity and requires no structural rewrite.

### B. Glass Data Lab

Translucent layers, gradients, broader blur, and more dimensional cards. Rejected because it increases visual noise and weakens dense financial readability.

### C. Industrial Console

Near-black surfaces, sharp corners, mostly monospaced typography, and very compact spacing. Rejected because it would overcorrect the current style and reduce Chinese long-form content comfort.

## Current-State Audit

1. Business data and interaction architecture are already substantial and must be preserved.
2. `terminal.css` and Tailwind-heavy legacy market components use different visual languages.
3. Repeated rounded gradient cards create excessive chrome and flatten hierarchy.
4. Cyan appears in too many labels, borders, and selected states, reducing its signaling value.
5. The top search hint and settings icon are non-functional chrome. They will be removed; live data connection status remains.
6. Small desktop text is often 8–10 px. It fits but impairs fast scanning.
7. Mobile preserves data by stacking and shrinking nearly everything. It needs readable typography, touch targets, sticky section switching where useful, and better overflow handling.
8. Focus states are implemented only in parts of the interface and motion reduction is absent.
9. Market analysis uses gradients, emoji, heavy rounding, and hover scaling unlike the rest of the terminal.

## Visual System

### Color

- Keep a deep navy application background.
- Separate four surface levels: application, panel, raised/selected, and control.
- Use cyan only for active navigation, selection indicators, focus rings, live links, and high-value labels.
- Preserve Chinese-market semantic colors: red for rise/bullish and green for fall/bearish.
- Use amber only for delayed, pending, and risk states.
- Increase muted text contrast while keeping metadata visually subordinate.
- Remove broad decorative radial gradients and most glow effects. A subtle brand glow may remain.

### Shape

- Use an 8 px panel radius, 6 px control radius, and 4 px tag radius.
- Pills are reserved for status and compact categorical tags.
- Replace nested card-on-card visuals with section separators and restrained raised surfaces.

### Typography

- Use the existing local/system font strategy; do not add remote font dependencies.
- Apply a unified Chinese-first UI stack with tabular numerals.
- Use 12 px as the practical metadata floor on normal desktop layouts, with 11 px reserved for dense chart legends.
- Emphasize current prices, scores, and primary titles through size and weight, not color alone.
- Use the local monospace stack only for codes, dates, times, and numeric telemetry.

### Spacing

- Adopt a 4 px base scale with common increments of 4, 8, 12, 16, and 20 px.
- Reduce oversized section headers and duplicate wrappers.
- Preserve dense rows but give titles, values, and metadata distinct horizontal anchors.

### Motion and Interaction

- Use 120–180 ms opacity, color, border, and background transitions.
- Avoid layout-scale hover effects in data rows and market analysis cards.
- Add consistent `:focus-visible` rings across all native buttons, inputs, selects, and links.
- Disable non-essential transitions and animations under `prefers-reduced-motion: reduce`.
- Keep loading pulse/skeleton motion but reduce amplitude.

## Global Header

- Preserve the two-tier top header and all five index data items.
- Remove the non-functional global search hint and settings button.
- Keep the data connection state and make its live/delayed/error status visually explicit.
- Simplify the logo surface and navigation active state; remove excess glow.
- Improve index ticker alignment so name/code, price, and change form a consistent scan grid.
- On narrow screens, retain horizontal navigation and index scrolling, but increase touch target and text legibility.

## Decision Workspace

- Preserve the stock list, candlestick workspace, and market snapshot three-column structure.
- Make the chart the clear primary surface through quieter side panels and a more disciplined toolbar.
- Convert stock list selection to a flat accent rail plus background tint; eliminate row translation.
- Standardize quote header, date chips, indicator controls, chart navigation, snapshot sections, and data tables.
- Keep all real-time, historical, indicator, chip-distribution, and source-status information.
- Preserve the current temporary real-time daily bar behavior and request contracts.

## Market Intelligence

- Replace the legacy Tailwind/gradient market analysis skin with native terminal classes.
- Keep analysis date, source, main-line count, reasons, advice, risk, ranking window, heat map, and sector data.
- Display analysis cards as compact ranked rows with a semantic priority rail instead of border-heavy floating cards.
- Use the same panel headers, controls, tags, and modal language as the rest of the terminal.

## News Intelligence

- Preserve search in the filter bar, all time/sort controls, result summary, stream data, sector tags, and detail content.
- Clarify selected article state with one accent rail and a restrained tint.
- Improve headline/body contrast, metadata alignment, and small-screen filter wrapping.
- Keep stream/detail split on desktop and stacked layout on smaller widths.

## Creator Intelligence

- Preserve all overview metrics, filters, ranking, works, analysis detail, source text, and responsive dialog behavior.
- Convert overview cards into a continuous metric rail with separators while retaining the four values.
- Normalize ranking and article rows with the same selection grammar used by stocks and news.
- Improve mobile readability by increasing the effective type scale, keeping the ranking/latest switch visible, and preventing tiny compressed labels.

## Responsive Strategy

- `> 1280 px`: existing multi-column workspaces remain.
- `1101–1280 px`: secondary detail may use the existing drawer behavior; main data columns remain usable.
- `721–1100 px`: workspaces stack while preserving all sections; charts and panels receive explicit minimum heights.
- `<= 720 px`: navigation and indices scroll horizontally; controls wrap into full-width groups; primary text stays readable; detail views remain full-screen where already implemented.
- No business-data field is hidden solely to simplify the layout. Dense metadata may wrap or move below primary values.

## Accessibility

- Maintain semantic buttons/inputs and existing ARIA labels.
- Add global keyboard focus visibility.
- Ensure color is not the only active/error/delayed cue.
- Keep touch targets at least 32 px in dense desktop controls and 40 px on narrow screens where feasible.
- Respect reduced motion.
- Retain readable contrast for all secondary and faint text.

## Implementation Boundaries

- Do not change API contracts, request libraries, data state ownership, or data filtering semantics.
- Do not replace the main layout framework or introduce a new UI framework.
- Do not remove business data.
- Prefer token and CSS changes; change component markup only where needed to remove fake controls, replace legacy styling, or add semantic class hooks.
- Avoid unrelated refactors.

## Verification

- Add tests for removal of inert header controls and preservation of live status/index data.
- Add focused component assertions for the redesigned market analysis structure and visible date/data labels.
- Run the complete Vitest suite.
- Run an explicit TypeScript no-emit check over all source files.
- Run the Vite production build.
- Capture and inspect desktop and mobile screenshots for all four views.
- Check horizontal overflow, keyboard focus, reduced motion, and critical loading/error/empty states.

