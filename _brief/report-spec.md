# Report Spec — ROW Clearing Plan

## Report identity
- Report name: ROW Clearing Plan
- Semantic model: row_pbi_poc (local PBIP, `powerbi/row_pbi_poc.SemanticModel`)
- Audience: vegetation management lead, district managers, operations leadership
- Primary purpose: track which feeders are overdue / due soon and who owns them,
  how firm the clearing plan is, and where the source spreadsheet was unreliable
- Delivery target: local PBIP only (no publish)

## Semantic model binding
- Entry mode:       Local Model
- Model name:       row_pbi_poc
- connectionString: byPath `../row_pbi_poc.SemanticModel`

## User decisions and constraints
- Scope: four content pages (Plan Overview, Clearing Plan, Vendors and
  Districts, Data Quality), one hidden Feeder Detail drillthrough, one hidden
  About page. (Decided in prompt 05.)
- Page count: 6 (4 visible + 2 hidden)
- Interactivity:
  - Navigation model: `page_navigator` (uppercase tabs in the brand bar).
  - Global slicers, synced across the 4 visible pages, same slot each page:
    District (`DIM_DISTRICT[DISTRICT_NAME]`), Vendor (`DIM_VENDOR[VENDOR_NAME]`),
    Date Certainty (`DIM_DATE_CERTAINTY[DATE_CERTAINTY]`) — 3 dropdowns.
  - Reset button at the right of the filter band on every visible page.
  - Info (ⓘ) button → About (hidden).
  - Clearing Plan: Overdue ↔ Due Soon view toggle (segmented control, bookmarks
    `Clearing Plan · Overdue` [default] and `Clearing Plan · Due soon`,
    display-only visibility swap between two visual-filtered tables).
  - Feeder Detail: hidden drillthrough on `DIM_CIRCUIT[FEEDER_ID]`, Back button
    replacing the navigator; reached by right-click → Drill through and by the
    "Feeder details" button above the Clearing Plan table.
- Design direction: BrilliT house brand (brand-forward), standards v0.2.
- Publishing: none (local only).
- Tooling: Power BI Desktop + powerbi-report-author CLI (authoring mode);
  theme `themes/BrilliT-da2828ff.json`.
- Model edit permissions: measures complete (R2); no further model changes
  expected for the report build.
- Accessibility: WCAG AA text contrast; alt text on every data visual; status
  always carries an icon or text, never color alone; tab order header → filters
  → KPIs → body.
- Data caveats: synthetic data, single static snapshot (no prior period);
  `Feeders Next Year` and `Feeders Not Cleared 5+ Years` are 0 in this data;
  2 orphan feeders have no circuit; 4 confirmed/tentative feeders have no date.

## Narrative
- Core story: The plan covers 153 feeders / 4,634.7 line miles; 92.8 % have a
  confirmed date, but 14 feeders are already overdue and 10 are due within 90
  days. The source spreadsheet carried 69 data-quality problems now cleaned.
- Audience promise: in one click, see what's overdue/at-risk, who owns it, how
  firm the plan is, and how bad the source data was.
- Key questions answered:
  1. How many feeders and line miles are in the plan, by district and certainty?
  2. Which feeders are overdue or due soon, and which vendor has them?
  3. How firm is the schedule (date-certainty mix)?
  4. How is the work split across vendors, vendor types and districts?
  5. Where were the source data-quality problems, and which feeders do they hit?

## Design identity (BrilliT standards v0.2)
- Tone: Brand-Forward — BrilliT house framework with BrilliT brand tokens.
- Signature: white brand bar with logo and uppercase navigation (green active
  underline), navy title band with white uppercase page title and slicers,
  green accent bar on KPI cards.

## Page plan
1. **Plan Overview** — Executive Summary (variant L1) — the landing snapshot.
   - Visuals: 4 KPI cards; stacked column "Next clearings by month" (legend =
     certainty); horizontal bar "Feeders by district".
   - Measures: Feeders in Plan, Line Miles in Plan, % Plan Date Confirmed,
     Feeders Overdue (cards); Feeders in Plan (charts).
2. **Clearing Plan** — Analytical/Detail — the action list.
   - Visuals: 3 KPI cards; one-row-per-feeder table with a status column;
     Overdue ↔ Due Soon segmented toggle; "Feeder details" drillthrough button.
   - Measures: Feeders Overdue, Line Miles Overdue, Feeders Due Soon (cards);
     table uses columns + a Clearing Status indicator.
3. **Vendors and Districts** — Comparative/Analytical (2×2).
   - Visuals: 3 KPI cards; line-miles-by-vendor bar; feeders-by-vendor-type bar;
     line-miles-by-district bar; district-by-certainty 100 % stacked bar.
   - Measures: Line Miles in Plan, Feeders in Plan, Line Miles Overdue (cards);
     Line Miles by Vendor, Line Miles in Plan, Feeders in Plan (charts).
4. **Data Quality** — Analytical — the before/after.
   - Visuals: 4 KPI cards; issues-by-type bar; issues-by-source-column bar;
     raw-vs-clean detail table.
   - Measures: DQ Issues, Feeders with DQ Issues, % Feeders with DQ Issues,
     Orphans to Review (cards); DQ Issues (bars); table uses issue columns.
5. **Feeder Detail** (hidden drillthrough) — one feeder's profile.
   - Visuals: context cards; feeder attribute panel; that feeder's DQ issues.
   - Measures: Line Miles in Plan, Avg Years Since Last Clearing, DQ Issues.
6. **About** (hidden, info button) — purpose, audience, measure definitions,
   sources, refresh cadence, contact.

## Design system summary
- Theme: `themes/BrilliT-da2828ff.json`, generated from `themes/brand-tokens.json`.
  Base palette: navy `#002f6e`, logo blue `#015a9c`, green `#00c18c`, Arial.
- Color semantics: Feeders / Line Miles / DQ Issues series use logo blue
  (`categorical[1]`); magnitude bars use the sequential blue→navy ramp; date
  certainty legend uses the fixed categorical order (confirmed `#015a9c`,
  tentative `#eb6834`, next year `#00c18c`, TBD `#eda100`); Overdue uses
  `semantic.bad` and Due Soon `semantic.warning`, always with icon + text.
- Typography: Arial throughout (theme); visual titles heading navy `#193768`,
  sentence case; page titles + navigator uppercase.
- Layout: 1920×1080, 12×12 grid, margin 32, gutter 24, snap 8; white cards with
  1 px border, 8 px radius, no shadow, on the light page surface.
- Accessibility: AA contrast on every text/background pair; green text only via
  `brand.accentText`; alt text on every chart; status never color-only.

## Model requirements
- Existing measures (R2, all present on `@Measures`): Feeders in Plan, Line
  Miles in Plan, % Plan Date Confirmed, Feeders Next Year, Feeders TBD, Feeders
  Overdue, Line Miles Overdue, Feeders Due Soon, Avg Years Since Last Clearing,
  Feeders Not Cleared 5+ Years, Line Miles by Vendor, DQ Issues, Feeders with DQ
  Issues, % Feeders with DQ Issues, Orphans to Review.
- New measures: one small helper for the Clearing Plan status column and the
  dynamic drillthrough title (built in Part C if needed):
  - `Clearing Status` (text, 90 - Helpers) — "Overdue" / "Due soon" /
    "Scheduled" / "No date", for the table status column + conditional format.
  - `Feeder Detail Title` (text, 90 - Helpers) — `"Feeder " & SELECTEDVALUE(...)`
    for the drillthrough page title.
  These are report-support helpers; they will be proposed/added through the MCP
  server and logged in `docs/decisions.md` before use.
- New calculated columns: none.
- Relationship/sort requirements: none new (DATE_CERTAINTY already sorts by
  SORT_ORDER; DIM_DATE active→NEXT_CLEARING_DATE, inactive→LAST_CLEARED_DATE).

## Canonical design contract

```yaml
Design Brief:
  generated_by: powerbi-report-cli
  contract_version: 1
  mode: greenfield
  design_identity:
    tone: "Brand-Forward — BrilliT house framework with BrilliT brand tokens"
    signature: "White brand bar with logo + uppercase navigation (green active underline); navy title band with white uppercase page title and slicers; green accent bar on KPI cards"
  archetype: Executive Summary
  navigation_model: page_navigator
  color_map:
    - measure: '@Measures'[Feeders in Plan]
      color: "#015a9c"
      tint: "#d6e6f3"
    - measure: '@Measures'[Line Miles in Plan]
      color: "#015a9c"
      tint: "#d6e6f3"
    - measure: '@Measures'[Line Miles by Vendor]
      color: "#015a9c"
      tint: "#d6e6f3"
    - measure: '@Measures'[DQ Issues]
      color: "#015a9c"
      tint: "#d6e6f3"
    - measure: '@Measures'[Feeders Overdue]
      color: "#d03b3b"
      tint: "#f6d8d8"
    - measure: '@Measures'[Feeders Due Soon]
      color: "#fab219"
      tint: "#fdecc8"
  pages:
    - name: Plan Overview
      role: landing
      archetype: Executive
      layout_variant: A
      variant_rationale: "Two-panel landing (hero timeline + ranked district bar) reads the snapshot in one glance."
      navigation:
        - element: page_navigator
          action: PageNavigation
          label: "PLAN OVERVIEW / CLEARING PLAN / VENDORS / DATA QUALITY"
        - element: button
          action: PageNavigation
          target: About
          label: "About"
        - element: button
          action: ClearAllSlicers
          label: "Reset"
      page_background: "#f3f5f8"
      layout_summary: "Brand bar + navy title band; 4-card KPI strip; hero stacked column of next clearings by month (left), ranked district bar (right)."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            brandbar_bg: [1, 1, 13, 2]
            titleband_bg: [1, 2, 13, 3]
            brand:   [1, 1, 4, 2]
            nav:     [6, 1, 13, 2]
            header:  [1, 2, 8, 3]
            filters: [8, 2, 13, 3]
            kpis:    [1, 3, 13, 5]
            hero:    [1, 5, 8, 13]
            ranking: [8, 5, 13, 13]
        placements:
          - { id: brandbar_shape, region: brandbar_bg, kind: shape, purpose: "White brand bar with 1px bottom rule" }
          - { id: titleband_shape, region: titleband_bg, kind: shape, purpose: "Navy title band behind title + slicers" }
          - { id: logo, region: brand, kind: image, purpose: "BrilliT logo on white" }
          - { id: page_navigator, region: nav, kind: pageNavigator, purpose: "Primary navigation" }
          - { id: info_button, region: nav, kind: button, purpose: "Go to About", slot: 2, of: 2 }
          - { id: page_title, region: header, kind: textbox, text: "PLAN OVERVIEW" }
          - { id: subtitle, region: header, kind: textbox, text: "Data as of the latest refresh · active filters shown" }
          - { id: district_slicer, region: filters, kind: slicer, field_bindings: DIM_DISTRICT[DISTRICT_NAME], slicer_type: dropdown, slot: 1, of: 4 }
          - { id: vendor_slicer, region: filters, kind: slicer, field_bindings: DIM_VENDOR[VENDOR_NAME], slicer_type: dropdown, slot: 2, of: 4 }
          - { id: certainty_slicer, region: filters, kind: slicer, field_bindings: DIM_DATE_CERTAINTY[DATE_CERTAINTY], slicer_type: dropdown, slot: 3, of: 4 }
          - { id: reset_button, region: filters, kind: button, purpose: "Clear all slicers", slot: 4, of: 4 }
          - { id: card_feeders, region: kpis, kind: cardVisual, purpose: "How many feeders are in the plan?", field_bindings: '@Measures'[Feeders in Plan], color_strategy: measure_match, slot: 1, of: 4 }
          - { id: card_miles, region: kpis, kind: cardVisual, purpose: "How many line miles are in the plan?", field_bindings: '@Measures'[Line Miles in Plan], color_strategy: measure_match, slot: 2, of: 4 }
          - { id: card_confirmed, region: kpis, kind: cardVisual, purpose: "How firm is the plan?", field_bindings: '@Measures'[% Plan Date Confirmed], color_strategy: none, insight_basis: "Reference target 100% confirmed", slot: 3, of: 4 }
          - { id: card_overdue, region: kpis, kind: cardVisual, purpose: "How many feeders are overdue?", field_bindings: '@Measures'[Feeders Overdue], color_strategy: semantic, callout_value_basis: "Feeders Due Soon shown as the context reference", slot: 4, of: 4 }
          - { id: clearings_by_month, region: hero, kind: columnChart, purpose: "When are clearings due, and how firm are they?", field_bindings: { Category: DIM_DATE[Month Year], Y: '@Measures'[Feeders in Plan], Legend: DIM_DATE_CERTAINTY[DATE_CERTAINTY] }, sort_policy: natural_order, color_strategy: unique }
          - { id: feeders_by_district, region: ranking, kind: barChart, purpose: "Which districts hold the most feeders?", field_bindings: { Category: DIM_DISTRICT[DISTRICT_NAME], Y: '@Measures'[Feeders in Plan] }, sort_policy: value_desc, color_strategy: measure_match }
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: hero, pct_of_content: 47 }
          balance_rationale: "KPI strip (rows 3-4), hero timeline (cols 1-7) and ranked district bar (cols 8-12) fill the content area; hero is the designated main visual at 47% and the ranked bar stays readable at 40%."
    - name: Clearing Plan
      role: detail
      archetype: Analytical
      layout_variant: B
      variant_rationale: "A single wide action table is the page's job; a thin controls row carries the view toggle and drillthrough button."
      navigation:
        - element: page_navigator
          action: PageNavigation
          label: "Peer pages"
        - element: button
          action: ClearAllSlicers
          label: "Reset"
        - element: button
          action: Drillthrough
          target: Feeder Detail
          label: "Feeder details"
        - element: bookmark_navigator
          action: Bookmark
          target: "Clearing Plan · Overdue / Clearing Plan · Due soon"
          label: "Overdue / Due soon toggle"
      page_background: "#f3f5f8"
      layout_summary: "3 KPI cards; a controls row (note + Overdue/Due-soon toggle + Feeder details button); a one-row-per-feeder table with a status column."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            brandbar_bg: [1, 1, 13, 2]
            titleband_bg: [1, 2, 13, 3]
            brand:    [1, 1, 4, 2]
            nav:      [6, 1, 13, 2]
            header:   [1, 2, 8, 3]
            filters:  [8, 2, 13, 3]
            kpis:     [1, 3, 13, 5]
            controls: [1, 5, 13, 6]
            table:    [1, 6, 13, 13]
        placements:
          - { id: brandbar_shape, region: brandbar_bg, kind: shape, purpose: "White brand bar" }
          - { id: titleband_shape, region: titleband_bg, kind: shape, purpose: "Navy title band" }
          - { id: logo, region: brand, kind: image, purpose: "BrilliT logo" }
          - { id: page_navigator, region: nav, kind: pageNavigator, purpose: "Primary navigation" }
          - { id: info_button, region: nav, kind: button, purpose: "Go to About", slot: 2, of: 2 }
          - { id: page_title, region: header, kind: textbox, text: "CLEARING PLAN" }
          - { id: subtitle, region: header, kind: textbox, text: "Overdue and due-soon feeders · active filters shown" }
          - { id: district_slicer, region: filters, kind: slicer, field_bindings: DIM_DISTRICT[DISTRICT_NAME], slicer_type: dropdown, slot: 1, of: 4 }
          - { id: vendor_slicer, region: filters, kind: slicer, field_bindings: DIM_VENDOR[VENDOR_NAME], slicer_type: dropdown, slot: 2, of: 4 }
          - { id: certainty_slicer, region: filters, kind: slicer, field_bindings: DIM_DATE_CERTAINTY[DATE_CERTAINTY], slicer_type: dropdown, slot: 3, of: 4 }
          - { id: reset_button, region: filters, kind: button, purpose: "Clear all slicers", slot: 4, of: 4 }
          - { id: card_overdue, region: kpis, kind: cardVisual, purpose: "How many feeders are overdue?", field_bindings: '@Measures'[Feeders Overdue], color_strategy: semantic, slot: 1, of: 3 }
          - { id: card_miles_overdue, region: kpis, kind: cardVisual, purpose: "How many line miles are overdue?", field_bindings: '@Measures'[Line Miles Overdue], color_strategy: semantic, slot: 2, of: 3 }
          - { id: card_due_soon, region: kpis, kind: cardVisual, purpose: "How many feeders are due within 90 days?", field_bindings: '@Measures'[Feeders Due Soon], color_strategy: semantic, slot: 3, of: 3 }
          - { id: table_note, region: controls, kind: textbox, text: "Clearing status flagged per feeder (icon + text)", slot: 1, of: 3 }
          - { id: view_toggle, region: controls, kind: bookmarkNavigator, purpose: "Toggle Overdue vs Due Soon view", slot: 2, of: 3 }
          - { id: drillthrough_button, region: controls, kind: button, purpose: "Drill to the selected feeder", slot: 3, of: 3 }
          - { id: feeder_table, region: table, kind: tableEx, purpose: "Which feeders need action, with owner and dates?", field_bindings: [DIM_CIRCUIT[FEEDER_ID], DIM_CIRCUIT[CIRCUIT_NAME], DIM_DISTRICT[DISTRICT_NAME], DIM_VENDOR[VENDOR_NAME], FACT_ROW_PLAN[LAST_CLEARED_DATE], FACT_ROW_PLAN[NEXT_CLEARING_DATE], DIM_DATE_CERTAINTY[DATE_CERTAINTY], '@Measures'[Clearing Status], FACT_ROW_PLAN[NOTES]], sort_policy: natural_order, color_strategy: semantic }
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: table, pct_of_content: 70 }
          balance_rationale: "Detail page: the feeder action table is the hero (70%); the KPI strip frames it with overdue/due-soon totals and the controls row carries the toggle and drillthrough. No empty bands."
    - name: Vendors and Districts
      role: detail
      archetype: Comparative
      layout_variant: C
      variant_rationale: "Four balanced quadrants compare vendor and district workload without any single chart dominating."
      navigation:
        - element: page_navigator
          action: PageNavigation
          label: "Peer pages"
        - element: button
          action: ClearAllSlicers
          label: "Reset"
      page_background: "#f3f5f8"
      layout_summary: "3 KPI cards; 2×2 of line-miles-by-vendor, feeders-by-vendor-type, line-miles-by-district, district-by-certainty."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            brandbar_bg: [1, 1, 13, 2]
            titleband_bg: [1, 2, 13, 3]
            brand:   [1, 1, 4, 2]
            nav:     [6, 1, 13, 2]
            header:  [1, 2, 8, 3]
            filters: [8, 2, 13, 3]
            kpis:    [1, 3, 13, 5]
            tl:      [1, 5, 7, 9]
            tr:      [7, 5, 13, 9]
            bl:      [1, 9, 7, 13]
            br:      [7, 9, 13, 13]
        placements:
          - { id: brandbar_shape, region: brandbar_bg, kind: shape, purpose: "White brand bar" }
          - { id: titleband_shape, region: titleband_bg, kind: shape, purpose: "Navy title band" }
          - { id: logo, region: brand, kind: image, purpose: "BrilliT logo" }
          - { id: page_navigator, region: nav, kind: pageNavigator, purpose: "Primary navigation" }
          - { id: info_button, region: nav, kind: button, purpose: "Go to About", slot: 2, of: 2 }
          - { id: page_title, region: header, kind: textbox, text: "VENDORS AND DISTRICTS" }
          - { id: subtitle, region: header, kind: textbox, text: "Workload split by vendor, vendor type and district · active filters shown" }
          - { id: district_slicer, region: filters, kind: slicer, field_bindings: DIM_DISTRICT[DISTRICT_NAME], slicer_type: dropdown, slot: 1, of: 4 }
          - { id: vendor_slicer, region: filters, kind: slicer, field_bindings: DIM_VENDOR[VENDOR_NAME], slicer_type: dropdown, slot: 2, of: 4 }
          - { id: certainty_slicer, region: filters, kind: slicer, field_bindings: DIM_DATE_CERTAINTY[DATE_CERTAINTY], slicer_type: dropdown, slot: 3, of: 4 }
          - { id: reset_button, region: filters, kind: button, purpose: "Clear all slicers", slot: 4, of: 4 }
          - { id: card_miles, region: kpis, kind: cardVisual, purpose: "Total line miles in plan?", field_bindings: '@Measures'[Line Miles in Plan], color_strategy: measure_match, slot: 1, of: 3 }
          - { id: card_feeders, region: kpis, kind: cardVisual, purpose: "Total feeders in plan?", field_bindings: '@Measures'[Feeders in Plan], color_strategy: measure_match, slot: 2, of: 3 }
          - { id: card_miles_overdue, region: kpis, kind: cardVisual, purpose: "Line miles overdue?", field_bindings: '@Measures'[Line Miles Overdue], color_strategy: semantic, slot: 3, of: 3 }
          - { id: miles_by_vendor, region: tl, kind: barChart, purpose: "Which vendors carry the most line miles?", field_bindings: { Category: DIM_VENDOR[VENDOR_NAME], Y: '@Measures'[Line Miles by Vendor] }, sort_policy: value_desc, color_strategy: measure_match }
          - { id: feeders_by_vendor_type, region: tr, kind: barChart, purpose: "How is work split across vendor types?", field_bindings: { Category: DIM_VENDOR[VENDOR_TYPE], Y: '@Measures'[Feeders in Plan] }, sort_policy: value_desc, color_strategy: measure_match }
          - { id: miles_by_district, region: bl, kind: barChart, purpose: "Which districts carry the most line miles?", field_bindings: { Category: DIM_DISTRICT[DISTRICT_NAME], Y: '@Measures'[Line Miles in Plan] }, sort_policy: value_desc, color_strategy: measure_match }
          - { id: district_by_certainty, region: br, kind: barChart, purpose: "How firm is each district's plan?", field_bindings: { Category: DIM_DISTRICT[DISTRICT_NAME], Y: '@Measures'[Feeders in Plan], Legend: DIM_DATE_CERTAINTY[DATE_CERTAINTY] }, sort_policy: value_desc, color_strategy: unique, chart_note: "100% stacked" }
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: tl, pct_of_content: 20 }
          balance_rationale: "Four equal 6×4 quadrants (20% each) plus the KPI strip (20%) fill the content area; comparison page with no single dominant chart."
    - name: Data Quality
      role: detail
      archetype: Analytical
      layout_variant: B
      variant_rationale: "Two driver bars over a wide raw-vs-clean table shows the before/after without crowding."
      navigation:
        - element: page_navigator
          action: PageNavigation
          label: "Peer pages"
        - element: button
          action: ClearAllSlicers
          label: "Reset"
      page_background: "#f3f5f8"
      layout_summary: "4 KPI cards; issues-by-type and issues-by-source bars; wide raw-vs-clean detail table."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            brandbar_bg: [1, 1, 13, 2]
            titleband_bg: [1, 2, 13, 3]
            brand:    [1, 1, 4, 2]
            nav:      [6, 1, 13, 2]
            header:   [1, 2, 8, 3]
            filters:  [8, 2, 13, 3]
            kpis:     [1, 3, 13, 5]
            by_type:  [1, 5, 7, 9]
            by_source:[7, 5, 13, 9]
            rawclean: [1, 9, 13, 13]
        placements:
          - { id: brandbar_shape, region: brandbar_bg, kind: shape, purpose: "White brand bar" }
          - { id: titleband_shape, region: titleband_bg, kind: shape, purpose: "Navy title band" }
          - { id: logo, region: brand, kind: image, purpose: "BrilliT logo" }
          - { id: page_navigator, region: nav, kind: pageNavigator, purpose: "Primary navigation" }
          - { id: info_button, region: nav, kind: button, purpose: "Go to About", slot: 2, of: 2 }
          - { id: page_title, region: header, kind: textbox, text: "DATA QUALITY" }
          - { id: subtitle, region: header, kind: textbox, text: "Source-spreadsheet problems caught and cleaned · active filters shown" }
          - { id: district_slicer, region: filters, kind: slicer, field_bindings: DIM_DISTRICT[DISTRICT_NAME], slicer_type: dropdown, slot: 1, of: 4 }
          - { id: vendor_slicer, region: filters, kind: slicer, field_bindings: DIM_VENDOR[VENDOR_NAME], slicer_type: dropdown, slot: 2, of: 4 }
          - { id: certainty_slicer, region: filters, kind: slicer, field_bindings: DIM_DATE_CERTAINTY[DATE_CERTAINTY], slicer_type: dropdown, slot: 3, of: 4 }
          - { id: reset_button, region: filters, kind: button, purpose: "Clear all slicers", slot: 4, of: 4 }
          - { id: card_issues, region: kpis, kind: cardVisual, purpose: "How many data-quality issues were caught?", field_bindings: '@Measures'[DQ Issues], color_strategy: measure_match, slot: 1, of: 4 }
          - { id: card_feeders_dq, region: kpis, kind: cardVisual, purpose: "How many feeders are affected?", field_bindings: '@Measures'[Feeders with DQ Issues], color_strategy: measure_match, slot: 2, of: 4 }
          - { id: card_pct_dq, region: kpis, kind: cardVisual, purpose: "What share of plan feeders are affected?", field_bindings: '@Measures'[% Feeders with DQ Issues], color_strategy: none, slot: 3, of: 4 }
          - { id: card_orphans, region: kpis, kind: cardVisual, purpose: "How many orphan feeders need review?", field_bindings: '@Measures'[Orphans to Review], color_strategy: semantic, slot: 4, of: 4 }
          - { id: issues_by_type, region: by_type, kind: barChart, purpose: "Which issue types were most common?", field_bindings: { Category: FACT_DQ_ISSUE[ISSUE_TYPE], Y: '@Measures'[DQ Issues] }, sort_policy: value_desc, color_strategy: measure_match }
          - { id: issues_by_source, region: by_source, kind: barChart, purpose: "Which source columns were unreliable?", field_bindings: { Category: FACT_DQ_ISSUE[SOURCE_COLUMN], Y: '@Measures'[DQ Issues] }, sort_policy: value_desc, color_strategy: measure_match }
          - { id: raw_vs_clean, region: rawclean, kind: tableEx, purpose: "What did each problem look like before and after cleaning?", field_bindings: [FACT_DQ_ISSUE[FEEDER_ID], FACT_DQ_ISSUE[ISSUE_TYPE], FACT_DQ_ISSUE[SOURCE_COLUMN], FACT_DQ_ISSUE[RAW_VALUE], FACT_DQ_ISSUE[CLEAN_VALUE]], sort_policy: natural_order, color_strategy: none }
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: rawclean, pct_of_content: 40 }
          balance_rationale: "Two 6×4 driver bars (20% each) over a full-width raw-vs-clean table (40%); KPI strip 20%. Table under 45% and the before/after is the page's payoff."
    - name: Feeder Detail
      role: drillthrough
      archetype: Analytical
      layout_variant: A
      variant_rationale: "One feeder: attribute panel beside its DQ issues, framed by context cards."
      navigation:
        - element: button
          action: Back
          label: "Back"
      page_background: "#f3f5f8"
      drillthrough_binding: DIM_CIRCUIT[FEEDER_ID]
      layout_summary: "Back button replaces the navigator; context cards; feeder attribute panel (left) and that feeder's DQ issues (right)."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            brandbar_bg: [1, 1, 13, 2]
            titleband_bg: [1, 2, 13, 3]
            brand:   [1, 1, 4, 2]
            nav:     [6, 1, 13, 2]
            header:  [1, 2, 8, 3]
            filters: [8, 2, 13, 3]
            kpis:    [1, 3, 13, 5]
            attrs:   [1, 5, 7, 13]
            dq:      [7, 5, 13, 13]
        placements:
          - { id: brandbar_shape, region: brandbar_bg, kind: shape, purpose: "White brand bar" }
          - { id: titleband_shape, region: titleband_bg, kind: shape, purpose: "Navy title band" }
          - { id: logo, region: brand, kind: image, purpose: "BrilliT logo" }
          - { id: back_button, region: nav, kind: button, purpose: "Return to prior page (replaces navigator)" }
          - { id: page_title, region: header, kind: textbox, text: "FEEDER DETAIL", purpose: "Bound at build to Feeder Detail Title measure (selected feeder)" }
          - { id: subtitle, region: header, kind: textbox, text: "Circuit, plan, work history and data-quality issues for the selected feeder" }
          - { id: card_miles, region: kpis, kind: cardVisual, purpose: "Line miles on this feeder?", field_bindings: '@Measures'[Line Miles in Plan], color_strategy: measure_match, slot: 1, of: 3 }
          - { id: card_years, region: kpis, kind: cardVisual, purpose: "Years since last clearing?", field_bindings: '@Measures'[Avg Years Since Last Clearing], color_strategy: none, slot: 2, of: 3 }
          - { id: card_issues, region: kpis, kind: cardVisual, purpose: "DQ issues on this feeder?", field_bindings: '@Measures'[DQ Issues], color_strategy: measure_match, slot: 3, of: 3 }
          - { id: feeder_attrs, region: attrs, kind: tableEx, purpose: "What are this feeder's circuit, plan and work details?", field_bindings: [DIM_CIRCUIT[CIRCUIT_NAME], DIM_CIRCUIT[SUBSTATION_NAME], DIM_DISTRICT[DISTRICT_NAME], DIM_VENDOR[VENDOR_NAME], FACT_ROW_PLAN[PLANNED_YEAR], FACT_ROW_PLAN[LAST_CLEARED_DATE], FACT_ROW_PLAN[NEXT_CLEARING_DATE], DIM_DATE_CERTAINTY[DATE_CERTAINTY], FACT_ROW_PLAN[LAST_WORK_DONE], FACT_ROW_PLAN[NOTES]], sort_policy: none, color_strategy: none }
          - { id: feeder_dq, region: dq, kind: tableEx, purpose: "What data-quality issues does this feeder have?", field_bindings: [FACT_DQ_ISSUE[ISSUE_TYPE], FACT_DQ_ISSUE[SOURCE_COLUMN], FACT_DQ_ISSUE[RAW_VALUE], FACT_DQ_ISSUE[CLEAN_VALUE]], sort_policy: natural_order, color_strategy: none }
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: attrs, pct_of_content: 40 }
          balance_rationale: "Two balanced 6×8 panels (attributes and DQ issues, 40% each) under a 3-card context strip; no dead space."
    - name: About
      role: detail
      archetype: Narrative
      layout_variant: A
      variant_rationale: "A reference page: one readable text column of definitions and sources."
      navigation:
        - element: button
          action: Back
          label: "Back"
      page_background: "#f3f5f8"
      layout_summary: "Brand bar + title band; a full-width text region with purpose, audience, measure definitions, sources, refresh and contact."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            brandbar_bg: [1, 1, 13, 2]
            titleband_bg: [1, 2, 13, 3]
            brand:  [1, 1, 4, 2]
            nav:    [6, 1, 13, 2]
            header: [1, 2, 8, 3]
            body:   [1, 3, 13, 13]
        placements:
          - { id: brandbar_shape, region: brandbar_bg, kind: shape, purpose: "White brand bar" }
          - { id: titleband_shape, region: titleband_bg, kind: shape, purpose: "Navy title band" }
          - { id: logo, region: brand, kind: image, purpose: "BrilliT logo" }
          - { id: back_button, region: nav, kind: button, purpose: "Return to prior page" }
          - { id: page_title, region: header, kind: textbox, text: "ABOUT THIS REPORT" }
          - { id: about_text, region: body, kind: textbox, text: "Purpose, audience, measure definitions, data sources, refresh cadence and contact.", purpose: "Reference content for the report" }
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: body, pct_of_content: 83 }
          balance_rationale: "About is a text reference page; one readable full-width column is intentional. Narrative role, higher text share is expected."
  interaction_pattern:
    drill_targets: [Feeder Detail]
    cross_filter_rules:
      - "KPI cardVisuals: None (cards never filter other visuals)"
      - "Clearing Plan / Feeder Detail tables: None on their own page (lookup tables don't filter)"
      - "Charts on Plan Overview, Vendors and Districts, Data Quality: Filter (not Highlight) so averages/part-to-whole read correctly"
  accessibility:
    alt_text_strategy: headline+trend
    contrast_notes: "Web green #00c18c only as accent with a second cue; green text uses #007f5b; navy band text white (12.9:1); low-contrast categorical slots 3/4/6 always paired with data labels."
  theme:
    base: "themes/BrilliT-da2828ff.json, generated from themes/brand-tokens.json on Microsoft's base theme"
    user_overrides: "Keep the bands, region grid, semantic colors, Arial and token values; do not hard-code hex in visuals"
  standards: "brillit-report-standards v0.2"
  deviations:
    - rule: "Each KPI card shows a comparison (vs prior year / target / plan)"
      page: "all"
      reason: "Synthetic data is a single static snapshot with no prior period or KPI time series. Cards show the value with a contextual secondary instead (% Plan Date Confirmed vs 100% target; Feeders Overdue with Feeders Due Soon as context). To review when real/periodic data exists."
    - rule: "Overdue rows highlighted (report-requirements wording)"
      page: "Clearing Plan"
      reason: "Color standard forbids filling whole rows with color; overdue/due-soon is shown via a Clearing Status column (icon + text + single-cell background) instead of full-row fill. Standards win."
    - rule: "Standard page set includes a hidden tooltip page"
      page: "report"
      reason: "No report-page tooltip in v1 (optional per standards). Default tooltips with business-named fields are used; add an entity tooltip later if hover detail is needed."
```

## Implementation notes
- Model changes: add two 90 - Helpers measures (`Clearing Status`,
  `Feeder Detail Title`) via the MCP server before authoring their visuals; log
  in `docs/decisions.md`. No other model changes.
- PBIR/report authoring: authoring mode builds pages in spec order onto the
  existing `powerbi/row_pbi_poc.Report`; register `BrilliT-da2828ff.json` first.
- Validation: `powerbi-report-author validate` after each page; reload Desktop;
  screenshot; review against `references/checklist.md`.
- Desktop screenshot verification: every page, retained in `review/screenshots/`.
- Publishing boundary: local PBIP only; no Fabric calls.
- Risks: KPI comparison gap (see deviations); the Overdue/Due-soon bookmark
  toggle must stay display-only so slicers survive; low-contrast categorical
  slots need data labels; 4 confirmed/tentative feeders with no date appear in
  the table with a "No date" status.
