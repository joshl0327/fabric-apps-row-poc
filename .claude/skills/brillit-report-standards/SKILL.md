---
name: brillit-report-standards
description: BrilliT house standards for Power BI reports — brillit.com brand (navy, logo blue, green, Arial), page framework (brand bar with logo and navigation, navy title band with title and slicers, KPI strip, body regions), visual selection, KPI cards, color and shading, navigation and bookmarks, and the theme built from brand tokens. Use whenever planning, designing, authoring or reviewing a Power BI report, together with the powerbi-report-cli skill.
---

# BrilliT Power BI report standards — v0.2 (draft for team review)

Brand derived from brillit.com: navy `#002f6e`, logo blue `#015a9c`, green `#00c18c`, heading navy `#193768`, Arial.

## How this works with Microsoft's report skill

Microsoft's `powerbi-report-cli` skill owns the workflow and the file mechanics: planning rounds, the `Design Brief:` contract in `_brief/report-spec.md`, PBIR authoring, validation and preview. Keep following it.

This skill supplies BrilliT's design decisions so they aren't reinvented per report. Apply it at these points:

| Microsoft step | Apply from this skill |
|---|---|
| Planning round 3 / design step 2 — page plan, archetypes | Page roles and region grid: `references/page-framework.md` |
| Planning round 4 / design step 1 — design identity | Tone and signature below. Don't offer generic tone options unless asked. |
| Design steps 3–4 — chart choice, visual configuration | `references/visual-standards.md` |
| Design step 5 / authoring theming — theme | Build with `node themes/build-theme.mjs` from `themes/brand-tokens.json`; register the generated theme file |
| Design brief `navigation_model`, buttons, bookmarks | `references/navigation-and-bookmarks.md` |
| Design brief `color_map`, conditional formatting | `references/color-and-shading.md` |
| Design step 7, authoring screenshot review, reviewer pass | `references/checklist.md` |

**Precedence.** These standards override Microsoft's generic design choices (tone catalog, archetype default regions, default palette). Microsoft's authoring mechanics, validation rules, approval gate and safety rules always apply. When a standard can't be met, record it under `deviations` in the design brief with the reason.

## Recording the standards in the design brief

In `_brief/report-spec.md` → `Design Brief:`:

```yaml
design_identity:
  tone: "Brand-Forward — BrilliT house framework with <client | BrilliT> brand tokens"
  signature: "White brand bar with logo and uppercase navigation (green active underline), navy title band with white uppercase page title and slicers, green accent bar on KPI cards"
navigation_model: page_navigator
theme:
  base: "themes/<Name>-<hash>.json, generated from themes/brand-tokens.json on Microsoft's base theme"
  user_overrides: "Keep the bands, region grid, semantic colors, Arial and token values"
standards: "brillit-report-standards v0.2"
deviations: []   # each: { rule: <rule>, page: <page>, reason: <why> }
```

Use the region names and coordinates from `references/page-framework.md` in every page's `layout_contract`.

## Non-negotiables

1. Every page uses the brand bar, the navy title band and the region grid for its role. The full-color logo only sits on white.
2. One primary navigation model per report: the page navigator in the nav region. Drillthrough and tooltip pages are hidden; drillthrough pages have a Back button.
3. KPI strips use the modern card visual: 3–5 cards, each with a comparison (vs prior year, target or plan).
4. Explicit measures only, with human-readable names on every axis, legend, header and card.
5. One value axis per chart — no dual-axis combos. Sort by value unless the axis is time or an ordered category.
6. All colors come from tokens. Categorical slots in fixed order; good/warning/bad only for status or direction, never as a series color, and always with an icon or text. No web-green text on white.
7. Alt text on every data visual; WCAG AA contrast for text.

## Files

| File | Covers |
|---|---|
| `references/page-framework.md` | Canvas, grid, standard regions, page roles, standard page set |
| `references/visual-standards.md` | Which visual for which question, KPI cards, titles, formats, sorting, tables, slicers, interactions |
| `references/color-and-shading.md` | Token roles, surfaces and shading, categorical/sequential/diverging/status color, conditional formatting |
| `references/navigation-and-bookmarks.md` | Navigator, buttons, drillthrough, bookmarks, tooltips |
| `references/checklist.md` | Pre-handoff and review checklist |
| `themes/brand-tokens.json` (repo root) | Brand values for this report (BrilliT house or client) |
| `themes/assets/brillit-logo.png` (repo root) | Logo for the brand bar (POC crop from the website; replace with the official file) |
| `themes/build-theme.mjs` (repo root) | Builds `themes/<Name>-<hash>.json` from the tokens on top of `assets/ms-base-theme.json`; checks contrast; output passes `powerbi-report-author validate` (CLI 0.5.0) |
| `assets/ms-base-theme.json` | Microsoft's base theme from microsoft/skills-for-fabric (MIT, see `assets/LICENSE-microsoft.txt`); keeps its per-visual safeguards |

## Changing the standards

The BI team owns these files. Change them by PR, bump the version above, and note the change in `CHANGELOG.md` in this folder. A new client brand is a new tokens file, not new rules.
