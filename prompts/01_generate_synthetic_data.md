# Prompt 01: synthetic data generator

Given to Claude Code on branch `feat/synthetic-data`. Kept here as a record of
exactly what the agent was asked to do.

---

Read CLAUDE.md first and follow its hard rules.

## Task
Write a Python script, `data/generate.py`, that creates a synthetic right-of-way
(ROW) dataset for a fictional electric cooperative. Everything is invented: no
real utilities, vendors, people, places, or addresses.

There are two core datasets, joined on `feeder_id`, plus small dimension
tables. The second dataset deliberately reproduces the data quality problems of
a hand-maintained shared spreadsheet; cleaning those problems is the point of
the POC.

## Output (all in `data/out/`, which is gitignored)

### Dimensions
1. `districts.csv`: 5 districts (district_id, district_name). Invent neutral
   names such as "North Ridge" or "Pine Hollow".
2. `vendors.csv`: the clean, canonical vendor list (vendor_id, vendor_name,
   vendor_type of "contractor" or "in-house crew"). 5 or 6 invented
   vegetation-management vendors, including one in-house crew. Use generic
   invented names; avoid names of real vegetation-management companies.

### Core dataset 1: circuit details (system of record, clean)
3. `circuits.csv`: one row per feeder, about 150 rows.
   - `feeder_id`: `substation_num + "-" + circuit_num`, e.g. `104-2`. Unique.
   - `circuit_num`: unique within its substation (1 to 8).
   - `circuit_name`: invented, e.g. "Cedar Flats 2".
   - `substation_num` (3 digits) and `substation_name`: about 30 substations,
     each with 3 to 8 circuits.
   - `line_miles`: 2 to 60, one decimal place.
   - `row_responsibility`: the district_name responsible for clearing the ROW.
     Usually the substation's home district, but about 10% of feeders are
     handled by a neighboring district.

### Core dataset 2: ROW clearing plan (the shared spreadsheet, messy)
4. `row_clearing_plan.xlsx`: one sheet, one row per feeder, laid out the way a
   team would keep it by hand. Headers: "Feeder ID", "Last Cleared",
   "Last Work Done", "Next Clearing", "Vendor", "Notes".
   - Last Work Done is one of: trim, mow, herbicide, hazard tree, inspection.
   - Underlying truth: Last Cleared is on or before `--as-of`; Next Clearing is
     mostly in the future, with about 10% overdue (in the past). Notes are
     short and realistic ("landowner gate locked", "crew delayed by storms").

   Inject these data quality issues on purpose:
   - **Non-dates in date columns.** Most date cells are real Excel dates. About
     6% of Next Clearing and 2% of Last Cleared hold text instead, such as
     "Next Year", "10/20/2027 - TBD", "TBD", "Q3 2027", "Spring 2027",
     "per vendor", or "2027?". A few more are text that looks like a date in
     a different format ("3/15/27", "2027-03-15", "03-15-2027 ") or are blank.
   - **Vendor name variants.** About 25% of Vendor cells use a hand-typed
     variant of the canonical name instead of the exact name: abbreviations
     ("Svc", "Tree" without "Service"), case differences, extra or trailing
     spaces, "Inc"/"LLC" suffixes, "&" vs "and", and a small typo or two. Each
     vendor should have 2 to 4 variants. A few Vendor cells are blank.
   - **Join problems (small, on purpose).** 2 feeder_ids that appear twice, 2
     feeder_ids that don't exist in circuits.csv, and 3 written in a
     different format (e.g. "104-02" or "104 - 2"). Every other feeder in
     circuits.csv appears exactly once.

### Answer key (for testing the cleaning logic later)
5. `answer_key.csv`: one row for every value the script deliberately damaged.
   Columns: excel_row, feeder_id (as it should be), column, raw_value,
   expected_value, issue_type (non_date, date_format, blank, vendor_variant,
   duplicate_feeder, orphan_feeder, feeder_format), and for date issues an
   expected_date_certainty of "confirmed", "tentative", "next year", or
   "TBD" plus an expected_planned_year where one can be inferred. This file
   is not loaded as a source; it is how we prove the Snowflake cleaning rules
   catch every problem.

## Requirements
- Deterministic: a fixed random seed (default 42), overridable with `--seed`.
  Running twice with the same seed and `--as-of` produces identical CSVs and
  identical spreadsheet cell values.
- Also accept `--out` (default `data/out`) and `--as-of` (default today).
- Use only `pandas`, `numpy`, and `openpyxl`. Create `requirements.txt` with
  pinned versions that support Python 3.12.
- Print a short summary at the end: row counts per file, and counts of each
  injected issue type (these must match the answer key).
- Add `data/README.md` explaining how to set up the `.venv`, install
  requirements, run the script, and what each output file is for.

## Do not
- Do not create or modify anything in `snowflake/`, `powerbi/`, or `app/`.
- Do not push, open a pull request, or run any `rayfin` or `snow` command.
- Do not commit generated files in `data/out/`.

## When done
Stop before committing. Show me: the files you created, a short diff summary,
and the exact commands I should run to verify the output myself. Then propose
a commit on `feat/synthetic-data`: list the exact files you would stage (by
name, never `git add -A` or `git add .`) and the commit message. Wait for my
approval before running `git add` or `git commit`.
