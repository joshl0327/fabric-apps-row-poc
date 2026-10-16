# Visual standards

## Which visual for which question

| Question | Use | Rules |
|---|---|---|
| One headline number | Card (modern card visual) | With a comparison; see KPI cards |
| Trend over continuous time | Line chart | ≤ 4 series; more → small multiples. End labels, not point labels |
| Values by discrete period (years) | Clustered column | Data labels when ≤ 12 columns |
| Compare categories | Horizontal bar | Sorted by value, descending. > 10 categories → top 10 + "Other", or a table |
| Part-to-whole | 100% stacked bar | ≤ 5 parts. Pie/donut only on request and only for ≤ 3 parts |
| Composition over time | Stacked column | ≤ 5 segments |
| Distribution | Column histogram (binned) | Bins documented in the title or subtitle |
| Relationship between two measures | Scatter | ≤ 3 color groups |
| Ranked list with detail | Table with data bars | Right-aligned numbers |
| Hierarchical breakdown | Matrix | Expand/collapse; stepped layout |
| Location matters to the decision | Azure Map | Only then. Never filled map or Bing map |
| Progress to target | Card with a target comparison, or a bar with a target line | No gauges |
| Exceptions to act on | Table with status icon + text | Sorted by severity, then value |

**Avoid:** dual-axis/combo charts with two scales, gauges, 3D anything, pie/donut > 3 slices, word clouds, Q&A visual, filled or Bing maps, more than 8 series in one chart, scrolling tables on landing pages.

## KPI cards

- 3–5 cards per strip, equal width, ordered by importance left to right. White card with a green (`brand.accent`) accent bar on the left edge.
- Each card: label (business name with unit), value, and one comparison (vs prior year, target or plan) shown as text with an arrow, colored with the semantic good/bad tokens. Color never carries the direction alone.
- A card must add something the page's charts don't: a total, a rate, or a comparison. Don't repeat the single number a chart already shows.
- Formats: counts `#,0`; miles `#,0.0`; percentages `0.0%`; currency `$#,0` (K/M abbreviations only when > 6 digits).
- Callout size comes from the theme; don't override per card.

## Titles, labels and formats

- Every visual has a title phrased as what it answers, in sentence case and heading navy (from the theme): "Line miles by planned year", "Feeders overdue by district". Uppercase is reserved for the page title and navigator.
- Font: Arial throughout (theme). Don't override per visual.
- No raw field names anywhere. Rename in the projection (`displayName`) or fix the model's display name.
- Axis titles off when the visual title states the unit.
- Dates: `MMM d, yyyy` in tables; `yyyy` for years; axis labels follow the period grain.
- Bars start at zero. Gridlines stay recessive (theme).
- Data labels: bars and columns when ≤ 12 marks; lines get end labels; never a number on every point.

## Sorting

- Categories: by value, descending.
- Time: chronological.
- Ordered categories (e.g. `DATE_CERTAINTY`): by their sort column (`SORT_ORDER`).
- Alphabetical only for lists meant for lookup.

## Tables and matrices

- Landing pages: ≤ 4 visible rows and ≤ 6 columns, or no table.
- Detail pages: ≤ 10 columns; frozen headers; numbers right-aligned; totals row only when the total means something.
- Conditional formatting: data bars in the sequential tint of brand primary; status via icon + text; never fill whole rows with color.

## Slicers

- Filter band: dropdowns. Search on for > 20 values. Single-select for year unless comparison across years is the point.
- Tile slicers only for ≤ 5 values (e.g. date certainty), and only when the choice is central to the page.
- Max 3 slicers in the title band (white dropdown boxes, white labels on navy); extra filters go to the filter pane (visible, locked where appropriate).
- Same slicer in the same slot on every page; sync slicers across pages that share a dimension.

## Interactions

- Slicers filter the whole page.
- KPI cards don't filter other visuals.
- Charts cross-highlight each other by default; switch to filter where highlighting misleads (e.g. averages).
- On landing pages, tables don't filter charts.
- Drill-down only where a real hierarchy exists (district → substation → feeder).
