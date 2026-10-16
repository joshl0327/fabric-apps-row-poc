# Color and shading

All values live in `themes/brand-tokens.json` (BrilliT values sampled from brillit.com). Visuals reference theme colors (data colors, good/neutral/bad, foreground/background), never hard-coded hex in PBIR, so a client brand swap is a theme rebuild, not a report edit. Shapes and buttons that need a token color (bands, accent bars) take it from the tokens file and are listed in the design brief.

## BrilliT palette at a glance

| Role | Hex | Where it comes from |
|---|---|---|
| Navy (`brand.primary`, `surface.headerBand`) | `#002f6e` | Title bands on the About and Services pages |
| Logo blue (`brand.secondary`, categorical slot 1) | `#015a9c` | "brill" in the logo |
| Green (`brand.accent`) | `#00c18c` | "IT", "INNOVATION", heading rules, service headings |
| Green for text (`brand.accentText`) | `#007f5b` | Darkened so green text passes 4.5:1 on white |
| Heading navy (`text.heading`) | `#193768` | Section headings and icons; used for visual titles |
| Font | Arial | Set by request (the site uses Proxima Nova) |

## Token roles

| Token | Used for |
|---|---|
| `brand.primary` | Title band, sequential ramp end, table accent, active nav text |
| `brand.secondary` | Main series (categorical slot 1), data bars |
| `brand.accent` | Active-tab underline, KPI card accent bar, highlights on the navy band. Not for text on white |
| `brand.accentText` | Any green text on white |
| `surface.page` | Page background (light cool gray) |
| `surface.card` | Visual containers, KPI cards |
| `surface.alt` | Table banding |
| `surface.border` | 1 px container border; the rule under the brand bar |
| `surface.brandBar` | White brand bar behind the logo and navigator |
| `surface.headerBand` / `surface.headerText` | Navy title band and the white text on it |
| `text.primary` / `text.secondary` / `text.muted` | Values / labels / axes and footnotes |
| `text.heading` | Visual titles (set in the theme's title text class) |
| `chrome.gridline` | Gridlines (recessive) |
| `categorical[1..6]` | Series identity, in fixed order |
| `sequential.min` → `sequential.max` | Magnitude: light blue to navy |
| `diverging.negative` / `center` / `positive` | Variance: orange ↔ gray ↔ blue (no red/green, colorblind-safe) |
| `semantic.good` / `warning` / `bad` | Status and direction only |

## Contrast rules that come from the brand

- The web green is 2.33:1 on white — below the 4.5:1 text minimum and the 3:1 graphics minimum. Use it for accents with another cue (underline + bold label, accent bar beside a labeled value), and use `brand.accentText` for green text.
- Green on the navy band is 5.5:1 — fine for text there.
- Logo blue on navy is 1.8:1 — the full-color logo stays on the white brand bar.
- White on navy is 12.9:1; heading navy on white is 11.8:1.

## Shading

- Page: `surface.page`. Visuals: `surface.card` with `surface.border`, 8 px radius, no shadow.
- Brand bar: white with a 1 px border rule below. Title band: navy. Nothing else on the page uses navy as a large fill.
- KPI cards: white, green accent bar on the left edge.
- Selected state (active tab, active toggle): navy bold text with a green underline.

## Categorical color

- Order: logo blue `#015a9c`, orange `#eb6834`, green `#00c18c`, yellow `#eda100`, violet `#6250d6`, pink `#e87ba4`. This order passed a colorblind-separation check on white and on the page surface (worst adjacent CVD ΔE 10.1, normal-vision ΔE 22.5). Don't reorder by taste; re-check if you change it.
- Six slots: more than 6 series → fold into "Other" or use small multiples. Red is left out on purpose so it never competes with the "bad" status color.
- Slots 3, 4 and 6 are below 3:1 on white: when they're used, show data labels or offer a table view.
- A measure or entity keeps its color on every page — record it in the design brief's `color_map`.
- Single-series bars use slot 1; don't rainbow categories.

## Status and direction

- `good` / `warning` / `bad` only mean status or direction (overdue, on track, worse than last year), always with an icon or text ("▲ 4.2% vs PY", "Overdue"). Never a series color.

## Text

- Values, labels and legends use text tokens, never the series color.
- WCAG AA: 4.5:1 for body text, 3:1 for large text and graphics.

## Conditional formatting

- Rules are driven by measures (e.g. a `Status Color` or threshold measure), not literal values typed into the visual — thresholds stay reviewable in the model and no data values get embedded in PBIR.
- Document thresholds in `docs/decisions.md`.

## Changing the brand

1. Copy `themes/brand-tokens.json` to `themes/brand-tokens.<client>.json` and replace the values.
2. Check the categorical palette for colorblind separation and contrast against `surface.card` with a CVD checker. Reorder slots until adjacent pairs separate; change the order, not the rule.
3. Run `node themes/build-theme.mjs themes/brand-tokens.<client>.json`. It checks text contrast, flags low-contrast categorical slots, and writes `themes/<Name>-<hash>.json` with a matching theme name (Power BI caches themes by name; the hash changes whenever the tokens do).
4. Register that file in the report (authoring mode → theming): copy it to `StaticResources/RegisteredResources/` and reference the same name in `report.json`, then `powerbi-report-author validate`.
