# Measures: ROW Clearing Plan

All measures live on `@Measures`, each with a description, format string and
display folder (AGENTS.md conventions). Base measures (`Feeders in Plan`,
`Line Miles in Plan`) are defined first; the rest build on them.

Validation queries are in `tests/dax/10_measures.dax`. Results are "as of"
**Today = 2026-10-16**; measures that use `TODAY()` (overdue, due soon, years
since) move with the real date. Checked against the R1 profile in
`docs/decisions.md`.

| Folder | Measure | Plain-English definition | Format | Checked result |
|---|---|---|---|---|
| 10 - Plan | Feeders in Plan | Distinct feeders that have a plan row in the current filter context. | `#,0` | 153 |
| 10 - Plan | Line Miles in Plan | Line miles of the feeders in the plan, each feeder counted once; responds to vendor and certainty filters. | `#,0.0` | 4,634.7 (= `SUM(DIM_CIRCUIT[LINE_MILES])`) |
| 10 - Plan | % Plan Date Confirmed | Feeders with certainty "confirmed" ÷ Feeders in Plan. | `0.0%` | 92.8% (142 / 153) |
| 10 - Plan | Feeders Next Year | Feeders with certainty "next year". | `#,0` | 2 |
| 10 - Plan | Feeders TBD | Feeders with certainty "TBD". | `#,0` | 8 |
| 20 - Clearing Cycle | Feeders Overdue | Feeders with a real next-clearing date (confirmed or tentative, not blank) before today. | `#,0` | 14 |
| 20 - Clearing Cycle | Line Miles Overdue | Line miles on the overdue feeders (same rule as Feeders Overdue). | `#,0.0` | 522.9 |
| 20 - Clearing Cycle | Feeders Due Soon | Feeders whose next-clearing date falls from today through today + 90 days. | `#,0` | 10 |
| 20 - Clearing Cycle | Avg Years Since Last Clearing | Average years from each feeder's last-cleared date to today, blanks excluded. | `0.0` | 2.2 |
| 20 - Clearing Cycle | Feeders Not Cleared 5+ Years | Feeders whose last-cleared date is more than 5 years before today; blanks excluded (counted separately). | `#,0` | 3 |
| 30 - Vendors | Line Miles by Vendor | Line Miles in Plan surfaced for vendor-workload visuals; reuses the base measure and splits by the vendor on the visual. | `#,0.0` | 4,634.7 total; splits by vendor (incl. Unassigned 168.1) |
| 40 - Data Quality | DQ Issues | Count of data-quality issues logged from the source spreadsheet (rows in FACT_DQ_ISSUE), including the 2 orphans. | `#,0` | 69 |
| 40 - Data Quality | Feeders with DQ Issues | Distinct in-plan feeders (match a circuit) with at least one issue; orphans excluded. | `#,0` | 63 |
| 40 - Data Quality | % Feeders with DQ Issues | Feeders with DQ Issues ÷ Feeders in Plan. | `0.0%` | 41.2% (63 / 153) |
| 40 - Data Quality | Orphans to Review | Issues of type `orphan_feeder` (feeders in the spreadsheet with no matching circuit). | `#,0` | 2 |
| 90 - Helpers | Clearing Status | Per-feeder status text ("Overdue" / "Due soon" / "Scheduled" / "No date") for the Clearing Plan table + conditional format; BLANK for feeders with no plan row. | text | Scheduled 119, Overdue 14, Due soon 10, No date 10 (=153) |
| 90 - Helpers | Feeder Detail Title | Dynamic drillthrough title naming the selected feeder. | text | "Feeder (select a feeder)" with none selected |

## Notes

- **"Today" is `TODAY()`** (decided; `docs/decisions.md`). Recorded figures for
  the date-relative measures will drift as the date moves.
- **Overdue guard:** a blank `NEXT_CLEARING_DATE` coerces below today in DAX, so
  Feeders/Line Miles Overdue explicitly require `NOT ISBLANK(NEXT_CLEARING_DATE)`
  on top of the confirmed/tentative certainty filter (there are confirmed/
  tentative feeders with no date; 143 of 153 feeders carry a next-clearing date).
- **Certainty mix (after the prompt 09 cleaning-rule change):** confirmed 142,
  tentative 1, next year 2, TBD 8 (= 153). 143 feeders carry a next-clearing
  date. The quarter/season/"year?" feeders (858-3, 658-6, 189-6) moved from
  tentative to **TBD** (planned year kept) so every confirmed/tentative feeder
  carries a real date and the report agrees with the app's form rule; the only
  tentative left is the one `10/20/<year> - TBD` feeder (704-2), which keeps its
  recovered date. Was tentative 4 / TBD 5 before the change. See
  `docs/decisions.md` (2026-10-16).
- **Base-measure reuse:** the percentage, overdue, due-soon and vendor measures
  all build on `Feeders in Plan` / `Line Miles in Plan` so a definition is
  written once.
- `DIM_CIRCUIT[LINE_MILES]` set to **don't summarize** so it is never implicitly
  summed on a visual; line miles always go through the measures.
