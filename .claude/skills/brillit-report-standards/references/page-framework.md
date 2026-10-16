# Page framework

Mirrors brillit.com: a white bar with the logo and uppercase navigation, then a navy band with the page title — the same pattern as the site's About and Services pages.

## Canvas and grid

- Canvas 1920 × 1080 (Microsoft's greenfield default). Margin 32, gutter 24, snap 8.
- 12 columns × 12 rows. Coordinates use Microsoft's `layout_contract` notation: `[col_start, row_start, col_end, row_end]`, end exclusive. `[1, 1, 13, 2]` is the full width of row 1.
- Visual containers: white card, 1 px border token, 8 px radius, no drop shadow (from the theme). The page background is the light page surface, so cards stand off it.

## Standard regions

Used by landing, analysis and detail pages:

| Region | Grid | Contents |
|---|---|---|
| `brand` | `[1, 1, 4, 2]` | Logo on the white brand bar (≤ 56 px tall). The full-color logo only ever sits on white. |
| `nav` | `[6, 1, 13, 2]` | Page navigator, right-aligned, uppercase bold labels like the site's menu; info button at the far right |
| `header` | `[1, 2, 8, 3]` | On the navy title band: page title (white, uppercase) and subtitle (data-as-of and active filters, light text) |
| `filters` | `[8, 2, 13, 3]` | On the navy title band: up to 3 dropdown slicers, then the Reset button at the right end |
| `kpis` | `[1, 3, 13, 5]` | KPI strip: 3–5 cards of equal width |
| `body` | `[1, 5, 13, 13]` | Role-specific content (below) |

**Bands (the signature).**
- Brand bar: white (`surface.brandBar`) across `[1, 1, 13, 2]`, with a 1 px `surface.border` rule along its bottom edge.
- Title band: a navy (`surface.headerBand`) shape across `[1, 2, 13, 3]`, behind `header` and `filters`. Record it in the `layout_contract` as an intentional overlap (shape behind the title and slicers).
- Green (`brand.accent`) appears as the active-tab underline in the navigator and as the KPI card accent bar. On the navy band it may also be used for small text such as the subtitle's separator dots (5.5:1 contrast on navy).

**Title and subtitle.**
- Title: what the page covers, uppercase, stable across refreshes ("CLEARING CYCLE").
- Subtitle: a measure-driven line in the spirit of the site's "You are here" line, e.g. `Data as of Oct 1, 2026 · District: North · Planned year: 2027`.

## Page roles

| Role | Microsoft archetype | Body layout | Notes |
|---|---|---|---|
| **Landing** (Overview) | Executive Summary | L1: hero chart `[1, 5, 8, 13]` + ranked bar `[8, 5, 13, 13]`. L2: hero `[1, 5, 13, 9]` + two charts `[1, 9, 7, 13]`, `[7, 9, 13, 13]` | ≤ 1 click to the main insight; no tables taller than 4 rows |
| **Analysis** | Analytical Canvas or Comparative Benchmark | 2 × 2 charts: `[1, 5, 7, 9]`, `[7, 5, 13, 9]`, `[1, 9, 7, 13]`, `[7, 9, 13, 13]`; or hero `[1, 5, 13, 9]` + detail table `[1, 9, 13, 13]` | KPI strip may drop to 3 cards |
| **Detail** | Analytical Canvas | KPI strip optional (≤ 3 cards); table or matrix fills `[1, 3, 13, 13]` (or `[1, 5, 13, 13]` with KPIs) | Built for lookup and export; search on slicers |
| **Drillthrough** (hidden) | Analytical Canvas | Context KPIs `[1, 3, 13, 5]`; detail `[1, 5, 13, 13]` | Title names the drilled entity via a measure; Back button at the left of `nav` replaces the navigator |
| **Tooltip** (hidden) | — | 320 × 240 canvas, no bands | 1–3 small visuals; same tokens |
| **About** | — | Text: purpose, audience, measure definitions, data sources, refresh, contact | Reached from the info button, not a tab |

## Standard page set

Most reports follow: **Overview** (landing) → 2–4 **analysis** pages, one per question area → **Detail** → hidden **drillthrough** and **tooltip** pages → **About**.

Navigator labels are 1–3 words that preview the content ("CLEARING CYCLE", "VENDORS", "DATA QUALITY"), never "Page 2".

## Placement rules

- Nothing overlaps except the two band shapes.
- Slicers live only in `filters` (or the drillthrough's context area). More than 3 → move the rest to the filter pane.
- The most important KPI is the left-most card; the hero chart answers the page's main question.
- Every region holds something that answers a distinct question. An empty region is better merged into its neighbor than filled with a duplicate number.
