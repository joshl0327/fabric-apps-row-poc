# Changelog — brillit-report-standards

## 0.3 — composite-model standards
- Added a "Composite models (DirectQuery fact + Import dimensions)" section:
  use `TREATAS` (not `RELATED`) across a limited cross-source relationship, and
  cast DirectQuery datetime columns to date at the source.
- Noted the two neighbouring model-build lessons (TOM-only `Int64` reverting on
  refresh; Desktop writing the `$schema` lines) are agent rules in `AGENTS.md`,
  not house design standards.

## 0.2 — brand from brillit.com
- Brand tokens sampled from brillit.com: navy `#002f6e`, logo blue `#015a9c`, green `#00c18c`, heading navy `#193768`; Arial as the font.
- Page framework now mirrors the website: white brand bar (logo + uppercase navigator) above a navy title band (title + slicers).
- Green restricted to accents (it's 2.33:1 on white); `brand.accentText` `#007f5b` for green text.
- Categorical order re-validated for colorblind separation with the brand blue and green; red left out so it never competes with "bad".
- Title band holds at most 3 slicers; navigator fits about 6 pages.

## 0.1 — draft
- First draft for team review: page framework, visual standards, KPI cards, color and shading, navigation and bookmarks, checklist.
