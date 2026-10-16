# Navigation and bookmarks

Record the choices in the design brief: `navigation_model` and each page's `navigation` list. Microsoft's authoring mode handles the `pageNavigator`, `actionButton` and `bookmarkNavigator` mechanics.

## Primary navigation

- `navigation_model: page_navigator` — horizontal tabs in the `nav` region of the white brand bar, styled like the site's menu: uppercase bold Arial, no tab fills. It stays in sync as pages are added, which is why it's the default.
- The navigator shows peer pages only. Drillthrough, tooltip and About pages are hidden.
- More than 6 visible pages: split the report, or switch to a left button rail as a recorded deviation (the brand bar fits about 6 labels).
- Active tab: `brand.primary` text with a `brand.accent` underline; inactive tabs in `text.primary`; hover in `text.secondary`.

## Buttons

Buttons cover actions the navigator can't:

| Button | Where | Action |
|---|---|---|
| Reset | Right end of the `filters` region (on the navy band; white outline button) | Clear all slicers |
| Info (ⓘ) | Far right of `nav` on the brand bar | Page navigation to About |
| Back | Left of `nav` on drillthrough pages (replaces the navigator) | Back |
| Details | Above a table, right-aligned | Drillthrough to the entity's page; enabled when one row is selected |

Labels say where they go ("Feeder details"), never "Click here". Same size and style everywhere (theme).

## Write-back buttons (translytical task flows)

Microsoft's authoring mode can build a `DataFunction` button that calls a Fabric User Data Function. The design brief's navigation vocabulary doesn't list it, so record these in the brief as page placements instead.

- The User Data Function must already be published; the button needs its workspace ID, item ID, function name and parameter list. Build the button only after that phase, and only against the dev workspace.
- Place it on the detail or drillthrough page, next to the inputs that feed it (input/list slicers, or a selected row). Bind every required parameter.
- Label it with the action and its object ("Update clearing status"), never "Submit". Primary style: navy fill, white text.
- Show the result: auto-refresh on, and a text line or card that confirms what changed.

## Drillthrough

- One drillthrough page per entity that people investigate (here: feeder).
- Keep all filters on; the page title names the drilled entity with a measure (e.g. `"Feeder " & SELECTEDVALUE(...)`).
- Reached by right-click → Drill through, and by the Details button.

## Bookmarks

Use bookmarks only for:

1. **View toggles on one page** — e.g. Chart ↔ Table for the same question.
2. **Guided steps** in a narrative report.

Not for page navigation (that's the navigator) and not for resetting filters (that's the Reset button).

Rules:

- Name: `<Page> · <State>` — e.g. `Clearing Cycle · Table view`, `Clearing Cycle · Chart view`.
- View toggles capture **display only** (Data unchecked) and **selected visuals** only, so slicer choices survive the toggle.
- Every toggle set includes its default state (`<Page> · Chart view` is the default when the page loads).
- Group bookmarks by page. At most 6 per report; beyond that, use pages.
- Toggle control: a two-button segmented control at the top-right of the visual area it changes, active state in `brand.accent`. Use a bookmark navigator only for narrative steps.
- Test every transition in both directions, with slicers set and cleared.

## Tooltips

- Report-page tooltips (320 × 240, hidden) for entity-level hover on detail tables and maps: 1–3 small visuals in the same tokens.
- Default tooltips stay on elsewhere; rename fields so tooltips show business names.

## Cross-page consistency

- Sync slicers for shared dimensions (district, planned year) across pages.
- Same slicer in the same slot on every page; the subtitle shows the active filters.
