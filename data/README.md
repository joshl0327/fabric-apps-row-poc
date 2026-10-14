# Synthetic ROW data

`generate.py` creates a synthetic right-of-way (ROW) clearing dataset for a
fictional electric cooperative. **Everything is invented** — no real utilities,
vendors, people, places, or addresses. Output goes to `data/out/`, which is
gitignored; re-create it any time by running the script.

## Setup

From the repo root (works in PowerShell and Git Bash):

```sh
python -m venv .venv
```

Activate it:

```powershell
# PowerShell
.venv\Scripts\Activate.ps1
```

```sh
# Git Bash
source .venv/Scripts/activate
```

Install pinned dependencies:

```sh
pip install -r requirements.txt
```

## Run

```sh
python data/generate.py
```

Options:

| flag | default | meaning |
|------|---------|---------|
| `--seed` | `42` | random seed; same seed + `--as-of` is reproducible |
| `--out` | `data/out` | output directory |
| `--as-of` | today | reference date (`YYYY-MM-DD`) for "last cleared" / "next clearing" |

Example: `python data/generate.py --seed 7 --as-of 2026-10-14 --out data/out`

The script prints row counts per file and a count of each injected issue type.
Those issue counts equal the number of rows in `answer_key.csv` of that type.

## Output files (`data/out/`)

**Dimensions**

- `districts.csv` — 5 districts (`district_id`, `district_name`).
- `vendors.csv` — the clean, canonical vendor list (`vendor_id`,
  `vendor_name`, `vendor_type`). One of these is an in-house crew.

**Core dataset 1 — circuit details (clean system of record)**

- `circuits.csv` — one row per feeder (~150). Key column `feeder_id` is
  `substation_num + "-" + circuit_num` (e.g. `104-2`). Also includes
  `circuit_name`, `substation_name`, `line_miles`, and `row_responsibility`
  (the district responsible for clearing the ROW).

**Core dataset 2 — ROW clearing plan (the messy spreadsheet)**

- `row_clearing_plan.xlsx` — one sheet laid out the way a team keeps it by
  hand: `Feeder ID`, `Last Cleared`, `Last Work Done`, `Next Clearing`,
  `Vendor`, `Notes`. It deliberately contains data-quality problems:
  - **Non-dates in date columns** — e.g. `TBD`, `Next Year`, `Q3 2027`,
    `Spring 2027`, `2027?`, `10/20/2027 - TBD`, `per vendor`; a few real dates
    typed as odd text (`3/15/27`, `2027-03-15`, trailing spaces); some blanks.
  - **Vendor name variants** — hand-typed versions of the canonical names
    (abbreviations, case, stray spaces, `Inc`/`LLC`, `&` vs `and`, typos);
    a few blanks.
  - **Join problems** — 2 feeder_ids that appear twice, 2 that don't exist in
    `circuits.csv`, and 3 written in a different text format (e.g. `104-02`,
    `104 - 2`).

**Answer key (for testing the cleaning logic)**

- `answer_key.csv` — one row for every value the script deliberately damaged:
  `excel_row`, `feeder_id` (as it should be), `column`, `raw_value`,
  `expected_value`, `issue_type` (`non_date`, `date_format`, `blank`,
  `vendor_variant`, `duplicate_feeder`, `orphan_feeder`, `feeder_format`), and
  for date issues `expected_date_certainty` (`confirmed`, `tentative`,
  `next year`, `TBD`) plus `expected_planned_year` where one can be inferred.
  This file is **not** a data source; it is how we prove the Snowflake
  cleaning rules catch every injected problem.

## Reproducibility

The same `--seed` and `--as-of` produce identical CSV rows and identical
spreadsheet cell values on every run.
