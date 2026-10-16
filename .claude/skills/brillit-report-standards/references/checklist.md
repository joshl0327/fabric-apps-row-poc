# Pre-handoff checklist

Run this after Microsoft's own pre-flight checklist and before the reviewer pass. Any "no" becomes a fix or a recorded deviation.

## Framework
- [ ] Every visible page has the white brand bar (logo + navigator) and the navy title band (uppercase title + dynamic subtitle).
- [ ] Regions match the page role in `page-framework.md`; nothing overlaps except the two band shapes.
- [ ] The full-color logo sits only on white.
- [ ] Navigator on every visible page; drillthrough/tooltip/About pages hidden; Back button on drillthrough pages.
- [ ] Title band slicers: ≤ 3 dropdowns, same slots across pages, Reset button at the right end.
- [ ] KPI strip: 3–5 equal cards with the green accent bar, each with a comparison shown as text + arrow.
- [ ] Arial everywhere; visual titles in heading navy, sentence case.

## Visuals
- [ ] Each visual's type matches the question per `visual-standards.md`; nothing from the avoid list.
- [ ] Titles say what each visual answers; no raw field names or "Sum of …" anywhere.
- [ ] Formats: counts, miles, percentages and dates as specified.
- [ ] Sorting: value desc for categories, chronological for time, sort column for ordered categories.
- [ ] Explicit measures only.

## Color
- [ ] Theme generated from the brand tokens and registered; no hard-coded hex in visuals.
- [ ] `color_map` honored: each measure/entity has one color across pages.
- [ ] Status colors only for status/direction, always with icon or text.
- [ ] No web-green (`#00c18c`) text on white; green text uses `brand.accentText`.
- [ ] Data labels or a table view wherever low-contrast categorical slots appear.

## Interaction
- [ ] Bookmarks named `<Page> · <State>`, display-only for view toggles, ≤ 6 total; every transition tested.
- [ ] Slicers synced across pages for shared dimensions.
- [ ] Cards don't filter; landing-page tables don't filter charts.

## Accessibility
- [ ] Alt text on every data visual.
- [ ] Text contrast AA; color never the only signal.
- [ ] Tab order follows reading order (header → filters → KPIs → body).

## Documentation
- [ ] `_brief/report-spec.md` lists any deviations with reasons.
- [ ] About page lists measure definitions, sources, refresh cadence and contact.
