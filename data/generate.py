#!/usr/bin/env python3
"""Generate a synthetic right-of-way (ROW) clearing dataset for a fictional
electric cooperative.

Everything here is invented. There are no real utilities, cooperatives,
vendors, people, places, or addresses in the output.

The script produces two core datasets joined on ``feeder_id`` plus two small
dimension tables:

* ``districts.csv``           - 5 districts (dimension)
* ``vendors.csv``             - canonical vendor list (dimension)
* ``circuits.csv``            - circuit details, the clean system of record
* ``row_clearing_plan.xlsx``  - the hand-maintained spreadsheet, deliberately messy
* ``answer_key.csv``          - every value we damaged on purpose, for testing

The clearing plan reproduces the data-quality problems of a shared spreadsheet
(text in date columns, free-typed vendor names, join problems). Cleaning those
problems in Snowflake is the point of the POC, so the answer key records each
injected issue precisely enough to prove the cleaning rules catch them all.

Deterministic: same ``--seed`` and ``--as-of`` produce identical CSV rows and
identical spreadsheet cell values on every run.
"""

from __future__ import annotations

import argparse
import datetime as dt
import itertools
import random
from pathlib import Path

import numpy as np
import pandas as pd
from openpyxl import Workbook

# --------------------------------------------------------------------------
# Static invented vocabulary (no real names)
# --------------------------------------------------------------------------

DISTRICTS = [
    (1, "North Ridge"),
    (2, "Pine Hollow"),
    (3, "Cedar Valley"),
    (4, "Stone Creek"),
    (5, "Elk Meadow"),
]

# vendor_id, vendor_name (canonical), vendor_type
VENDORS = [
    (1, "Summit Vegetation Management", "contractor"),
    (2, "Clearline Tree Service", "contractor"),
    (3, "Greenway Land and Timber", "contractor"),
    (4, "Ironwood Forestry", "contractor"),
    (5, "Trailhead Vegetation Control", "contractor"),
    (6, "North District Line Crew", "in-house crew"),
]

# Hand-typed variants of each canonical vendor name. These are what shows up in
# the messy spreadsheet: abbreviations, case, stray spaces, Inc/LLC suffixes,
# "&" vs "and", and the odd typo. Each vendor has 2-4 variants.
VENDOR_VARIANTS = {
    "Summit Vegetation Management": [
        "Summit Veg Mgmt",
        "summit vegetation management",
        "Summit Vegetation Management LLC",
        "Summit Vegitation Mgmt",  # typo
    ],
    "Clearline Tree Service": [
        "Clearline Tree Svc",
        "Clearline Tree",
        "clearline tree service ",  # trailing space
        "Clearine Tree Service",  # typo
    ],
    "Greenway Land and Timber": [
        "Greenway Land & Timber",
        "Greenway Land and Timber Inc",
        "greenway land and timber",
        "Greenway Land and Timber ",  # trailing space
    ],
    "Ironwood Forestry": [
        "Ironwood Forestry LLC",
        " Ironwood Forestry",  # leading space
        "ironwood forestry",
        "Ironwod Forestry",  # typo
    ],
    "Trailhead Vegetation Control": [
        "Trailhead Veg Control",
        "Trailhead Vegetation Control Inc",
        "trailhead vegetation control",
        "Trailhead Veg. Control",
    ],
    "North District Line Crew": [
        "North District Crew",
        "north district line crew",
        "In-House Crew",
    ],
}

SUBSTATION_WORDS = [
    "Cedar", "Maple", "Willow", "Granite", "Harbor", "Juniper", "Sunset",
    "Prairie", "Ridgeway", "Lakeside", "Hillcrest", "Birchwood", "Fox Run",
    "Clearwater", "Millbrook", "Stonegate", "Oakdale", "Riverbend", "Highland",
    "Meadowlark", "Timber", "Sandstone", "Copper", "Silverton", "Brookside",
    "Ridgeline", "Eagle Point", "Deer Creek", "Aspen", "Cypress", "Pinecrest",
    "Redfield", "Foxglove", "Moss Landing",
]

CIRCUIT_WORDS = [
    "Cedar", "Maple", "Willow", "Hawk", "Otter", "Birch", "Falcon", "Trout",
    "Heron", "Badger", "Sage", "Marsh", "Quartz", "Sable", "Laurel",
]
CIRCUIT_FEATURES = [
    "Flats", "Ridge", "Loop", "Tap", "Spur", "Line", "Branch", "Crossing",
    "Hollow", "Bend", "Gap", "Run",
]

WORK_TYPES = ["trim", "mow", "herbicide", "hazard tree", "inspection"]

NOTES = [
    "landowner gate locked",
    "crew delayed by storms",
    "access road washed out",
    "pending landowner permission",
    "coordinate with county crew",
    "heavy regrowth observed",
    "bridge weight limit on approach",
    "seasonal nesting restriction",
    "reroute around wetland",
    "waiting on vendor schedule",
    "shared span with phone co",
    "steep terrain, bucket access only",
]

# --------------------------------------------------------------------------
# Injection counts. These drive both the damage and the summary; the summary
# must equal the answer-key counts, so they are defined once here.
# --------------------------------------------------------------------------

TARGET_FEEDERS = 150

N_DUPLICATE = 2      # feeders that appear twice in the plan
N_ORPHAN = 2         # feeder_ids in the plan that are not in circuits.csv
N_FEEDER_FORMAT = 3  # feeder_ids written in a different text format

N_NEXT_NONDATE = 9   # ~6% of feeders: text in "Next Clearing"
N_NEXT_DATEFMT = 3   # date typed in an odd text format
N_NEXT_BLANK = 2     # blank cell

N_LAST_NONDATE = 3   # ~2% of feeders: text in "Last Cleared"
N_LAST_DATEFMT = 2
N_LAST_BLANK = 1

N_VENDOR_VARIANT = 38  # ~25% of feeders: hand-typed vendor variant
N_VENDOR_BLANK = 4     # blank vendor cell


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--seed", type=int, default=42,
                   help="random seed (default 42)")
    p.add_argument("--out", type=Path, default=Path("data/out"),
                   help="output directory (default data/out)")
    p.add_argument("--as-of", type=str, default=None,
                   help="reference date YYYY-MM-DD (default today)")
    return p.parse_args()


def nondate_pool(year: int) -> list[tuple[str, str, object]]:
    """Text values that get typed into a date column, with the clean target we
    would expect cleaning rules to infer: (raw, certainty, planned_year).

    ``planned_year`` is "" when none can be inferred.
    """
    return [
        ("Next Year", "next year", year),
        ("TBD", "TBD", ""),
        ("per vendor", "TBD", ""),
        (f"Q3 {year}", "tentative", year),
        (f"Spring {year}", "tentative", year),
        (f"{year}?", "tentative", year),
        (f"10/20/{year} - TBD", "tentative", year),  # embedded date, still tentative
    ]


def embedded_date_iso(raw: str, year: int) -> str:
    """The clean date we would expect to recover from a non-date string, if any.

    Only the "MM/DD/YYYY - TBD" shape carries a recoverable date.
    """
    if raw == f"10/20/{year} - TBD":
        return f"{year}-10-20"
    return ""


def odd_date_formats(d: dt.date) -> list[str]:
    """A real date typed as text in formats Excel will NOT read as a date."""
    return [
        f"{d.month}/{d.day}/{str(d.year)[2:]}",  # 3/15/27
        d.strftime("%Y-%m-%d"),                  # 2027-03-15 (ISO text)
        d.strftime("%m-%d-%Y") + " ",            # 03-15-2027 (trailing space)
    ]


# --------------------------------------------------------------------------
# Build the clean dimensions and circuits
# --------------------------------------------------------------------------

def build_circuits(rng: random.Random, nrng: np.random.Generator):
    """Return (circuits_rows, feeder_index).

    circuits_rows: list of dicts, one per feeder (the clean system of record).
    """
    district_names = [name for _, name in DISTRICTS]

    # Unique 3-digit substation numbers.
    sub_numbers = rng.sample(range(100, 1000), 40)
    sub_words = SUBSTATION_WORDS[:]
    rng.shuffle(sub_words)

    circuits = []
    si = 0
    while len(circuits) < TARGET_FEEDERS:
        sub_num = sub_numbers[si]
        word = sub_words[si % len(sub_words)]
        sub_name = f"{word} Substation"
        home_district = rng.choice(district_names)
        n_circuits = rng.randint(3, 8)

        for circuit_num in range(1, n_circuits + 1):
            feeder_id = f"{sub_num}-{circuit_num}"
            cword = rng.choice(CIRCUIT_WORDS)
            feature = rng.choice(CIRCUIT_FEATURES)
            circuit_name = f"{cword} {feature} {circuit_num}"
            line_miles = round(float(nrng.uniform(2.0, 60.0)), 1)

            # ~10% of feeders are handled by a neighboring district.
            if rng.random() < 0.10:
                others = [d for d in district_names if d != home_district]
                responsibility = rng.choice(others)
            else:
                responsibility = home_district

            circuits.append({
                "feeder_id": feeder_id,
                "circuit_num": circuit_num,
                "circuit_name": circuit_name,
                "substation_num": sub_num,
                "substation_name": sub_name,
                "line_miles": line_miles,
                "row_responsibility": responsibility,
            })
        si += 1

    used_subs = {c["substation_num"] for c in circuits}
    return circuits, used_subs, sub_numbers


# --------------------------------------------------------------------------
# Build the plan truth (one clean record per feeder) then assemble + damage
# --------------------------------------------------------------------------

def build_plan_truth(circuits, rng: random.Random, as_of: dt.date):
    """Attach a clean clearing record to each feeder as the underlying truth."""
    vendor_names = [name for _, name, _ in VENDORS]
    rows = []
    for c in circuits:
        last_cleared = as_of - dt.timedelta(days=rng.randint(60, 1460))
        if rng.random() < 0.10:
            # overdue: next clearing already in the past
            next_clearing = as_of - dt.timedelta(days=rng.randint(10, 200))
        else:
            next_clearing = as_of + dt.timedelta(days=rng.randint(30, 900))
        rows.append({
            "role": "real",
            "feeder_id": c["feeder_id"],
            "feeder_display": c["feeder_id"],   # may be mangled later
            "last_cleared": last_cleared,       # cell value (date / str / None)
            "last_work": rng.choice(WORK_TYPES),
            "next_clearing": next_clearing,
            "vendor": rng.choice(vendor_names),  # canonical truth
            "vendor_cell": None,                 # filled below
            "notes": rng.choice(NOTES),
        })
        rows[-1]["vendor_cell"] = rows[-1]["vendor"]
    return rows


def assemble_rows(real_rows, used_subs, sub_pool, rng: random.Random, as_of):
    """Insert duplicate and orphan rows into the plan, returning the final
    ordered row list. Records duplicate/orphan answer-key entries (excel_row
    filled later)."""
    vendor_names = [name for _, name, _ in VENDORS]
    answer = []
    rows = list(real_rows)

    # Duplicates: pick real feeders and insert an identical extra row.
    dup_rows = rng.sample(real_rows, N_DUPLICATE)
    for src in dup_rows:
        copy = dict(src)
        copy["role"] = "dup"
        idx = rng.randint(0, len(rows))
        rows.insert(idx, copy)
        answer.append({
            "_row": copy, "column": "Feeder ID",
            "feeder_id": src["feeder_id"], "raw_value": src["feeder_id"],
            "expected_value": src["feeder_id"], "issue_type": "duplicate_feeder",
            "expected_date_certainty": "", "expected_planned_year": "",
        })

    # Orphans: feeder_ids whose substation is not in circuits.csv.
    free_subs = [s for s in sub_pool if s not in used_subs]
    for i in range(N_ORPHAN):
        sub = free_subs[i]
        orphan_id = f"{sub}-{rng.randint(1, 8)}"
        orow = {
            "role": "orphan",
            "feeder_id": orphan_id,
            "feeder_display": orphan_id,
            "last_cleared": as_of - dt.timedelta(days=rng.randint(60, 1460)),
            "last_work": rng.choice(WORK_TYPES),
            "next_clearing": as_of + dt.timedelta(days=rng.randint(30, 900)),
            "vendor": rng.choice(vendor_names),
            "vendor_cell": None,
            "notes": rng.choice(NOTES),
        }
        orow["vendor_cell"] = orow["vendor"]
        idx = rng.randint(0, len(rows))
        rows.insert(idx, orow)
        answer.append({
            "_row": orow, "column": "Feeder ID",
            "feeder_id": "", "raw_value": orphan_id,
            "expected_value": "", "issue_type": "orphan_feeder",
            "expected_date_certainty": "", "expected_planned_year": "",
        })

    return rows, answer


def damage(real_rows, rng: random.Random, as_of: dt.date):
    """Apply the data-quality damage to the real feeder rows. Returns a list of
    answer-key entries (excel_row filled later)."""
    answer = []
    year = as_of.year + 1
    pool = nondate_pool(year)

    # Assign the non-date text values by cycling through every pattern in `pool`
    # rather than drawing them at random, so each pattern appears at least once.
    # Next Clearing is damaged first and takes the first 9 cycle items, which
    # covers all 7 distinct patterns (the earlier random draw left "Next Year"
    # and the "<date> - TBD" shape never appearing for Next Clearing). The main
    # `rng` stream is left untouched — each iteration still spends one
    # `rng.choice(pool)` draw — so every other value in the dataset is identical.
    nondate_cycle = itertools.cycle(pool)

    def sample(n):
        return rng.sample(real_rows, n)

    # ---- Feeder ID text format (different formatting, same feeder) ----
    for row in sample(N_FEEDER_FORMAT):
        sub, circ = row["feeder_id"].split("-")
        choices = [f"{sub}-0{circ}", f"{sub} - {circ}", f"{sub}- {circ}"]
        raw = rng.choice(choices)
        row["feeder_display"] = raw
        answer.append({
            "_row": row, "column": "Feeder ID",
            "feeder_id": row["feeder_id"], "raw_value": raw,
            "expected_value": row["feeder_id"], "issue_type": "feeder_format",
            "expected_date_certainty": "", "expected_planned_year": "",
        })

    # ---- Date-column damage ----
    def damage_date(col_key, col_label, n_nondate, n_datefmt, n_blank):
        chosen = sample(n_nondate + n_datefmt + n_blank)
        i = 0
        for row in chosen[:n_nondate]:
            rng.choice(pool)  # spend the draw so the main rng stream is unchanged
            raw, certainty, planned = next(nondate_cycle)
            row[col_key] = raw
            answer.append({
                "_row": row, "column": col_label,
                "feeder_id": row["feeder_id"], "raw_value": raw,
                "expected_value": embedded_date_iso(raw, year),
                "issue_type": "non_date",
                "expected_date_certainty": certainty,
                "expected_planned_year": planned,
            })
        i = n_nondate
        for row in chosen[i:i + n_datefmt]:
            true_date = row[col_key]
            raw = rng.choice(odd_date_formats(true_date))
            row[col_key] = raw
            answer.append({
                "_row": row, "column": col_label,
                "feeder_id": row["feeder_id"], "raw_value": raw,
                "expected_value": true_date.strftime("%Y-%m-%d"),
                "issue_type": "date_format",
                "expected_date_certainty": "confirmed",
                "expected_planned_year": true_date.year,
            })
        i += n_datefmt
        for row in chosen[i:i + n_blank]:
            row[col_key] = None
            answer.append({
                "_row": row, "column": col_label,
                "feeder_id": row["feeder_id"], "raw_value": "",
                "expected_value": "", "issue_type": "blank",
                "expected_date_certainty": "TBD", "expected_planned_year": "",
            })

    damage_date("next_clearing", "Next Clearing",
                N_NEXT_NONDATE, N_NEXT_DATEFMT, N_NEXT_BLANK)
    damage_date("last_cleared", "Last Cleared",
                N_LAST_NONDATE, N_LAST_DATEFMT, N_LAST_BLANK)

    # ---- Vendor-column damage ----
    vendor_chosen = sample(N_VENDOR_VARIANT + N_VENDOR_BLANK)
    for row in vendor_chosen[:N_VENDOR_VARIANT]:
        canonical = row["vendor"]
        raw = rng.choice(VENDOR_VARIANTS[canonical])
        row["vendor_cell"] = raw
        answer.append({
            "_row": row, "column": "Vendor",
            "feeder_id": row["feeder_id"], "raw_value": raw,
            "expected_value": canonical, "issue_type": "vendor_variant",
            "expected_date_certainty": "", "expected_planned_year": "",
        })
    for row in vendor_chosen[N_VENDOR_VARIANT:]:
        row["vendor_cell"] = None
        answer.append({
            "_row": row, "column": "Vendor",
            "feeder_id": row["feeder_id"], "raw_value": "",
            "expected_value": "", "issue_type": "blank",
            "expected_date_certainty": "", "expected_planned_year": "",
        })

    return answer


def age_last_cleared(real_rows, rng: random.Random, as_of: dt.date,
                     n_min: int = 3, n_max: int = 5):
    """Push a few feeders' true last-cleared date to 6-8 years before as-of, so
    the "Feeders Not Cleared 5+ Years" measure has something to report.

    Uses its own `rng` (never the main stream), so the rest of the dataset stays
    byte-for-byte identical. Only rows whose last_cleared is still a real date
    are eligible — rows whose Last Cleared cell was damaged to text or blank keep
    that damage, and their answer-key dates stay correct.
    """
    eligible = [r for r in real_rows if isinstance(r["last_cleared"], dt.date)]
    n = rng.randint(n_min, n_max)
    for row in rng.sample(eligible, n):
        row["last_cleared"] = as_of - dt.timedelta(days=rng.randint(6 * 365, 8 * 365))


# --------------------------------------------------------------------------
# Writers
# --------------------------------------------------------------------------

def write_plan_xlsx(rows, path: Path):
    wb = Workbook()
    ws = wb.active
    ws.title = "ROW Clearing Plan"
    headers = ["Feeder ID", "Last Cleared", "Last Work Done",
               "Next Clearing", "Vendor", "Notes"]
    ws.append(headers)

    for row in rows:
        ws.append([
            row["feeder_display"],
            row["last_cleared"],
            row["last_work"],
            row["next_clearing"],
            row["vendor_cell"],
            row["notes"],
        ])

    # Real dates get a date number format; text/blank cells are left as-is.
    for r, row in enumerate(rows, start=2):
        for c, key in ((2, "last_cleared"), (4, "next_clearing")):
            if isinstance(row[key], dt.date):
                ws.cell(row=r, column=c).number_format = "m/d/yyyy"

    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


def main() -> None:
    args = parse_args()
    as_of = (dt.date.fromisoformat(args.as_of) if args.as_of
             else dt.date.today())
    rng = random.Random(args.seed)
    nrng = np.random.default_rng(args.seed)
    out = args.out
    out.mkdir(parents=True, exist_ok=True)

    # Dimensions
    pd.DataFrame(DISTRICTS, columns=["district_id", "district_name"]) \
        .to_csv(out / "districts.csv", index=False)
    pd.DataFrame(VENDORS, columns=["vendor_id", "vendor_name", "vendor_type"]) \
        .to_csv(out / "vendors.csv", index=False)

    # Circuits (clean system of record)
    circuits, used_subs, sub_pool = build_circuits(rng, nrng)
    circuit_cols = ["feeder_id", "circuit_num", "circuit_name",
                    "substation_num", "substation_name", "line_miles",
                    "row_responsibility"]
    pd.DataFrame(circuits, columns=circuit_cols) \
        .to_csv(out / "circuits.csv", index=False)

    # Clearing plan: truth -> damage -> age a few -> assemble -> write
    real_rows = build_plan_truth(circuits, rng, as_of)
    answer = damage(real_rows, rng, as_of)
    # A few feeders last cleared 6-8 years ago. Own rng (seed-derived) so nothing
    # else in the dataset shifts.
    age_last_cleared(real_rows, random.Random(args.seed + 1000), as_of)
    rows, extra_answer = assemble_rows(real_rows, used_subs, sub_pool, rng, as_of)
    answer += extra_answer

    write_plan_xlsx(rows, out / "row_clearing_plan.xlsx")

    # Answer key: fill excel_row from final ordering, then write.
    row_position = {id(row): i + 2 for i, row in enumerate(rows)}
    ak_cols = ["excel_row", "feeder_id", "column", "raw_value",
               "expected_value", "issue_type", "expected_date_certainty",
               "expected_planned_year"]
    for a in answer:
        a["excel_row"] = row_position[id(a.pop("_row"))]
    answer.sort(key=lambda a: (a["excel_row"], a["column"]))
    pd.DataFrame(answer, columns=ak_cols) \
        .to_csv(out / "answer_key.csv", index=False)

    # ---- Summary ----
    issue_counts = {}
    for a in answer:
        issue_counts[a["issue_type"]] = issue_counts.get(a["issue_type"], 0) + 1

    print(f"as-of: {as_of.isoformat()}   seed: {args.seed}   out: {out}")
    print("Files written:")
    print(f"  districts.csv           {len(DISTRICTS):>4} rows")
    print(f"  vendors.csv             {len(VENDORS):>4} rows")
    print(f"  circuits.csv            {len(circuits):>4} rows")
    print(f"  row_clearing_plan.xlsx  {len(rows):>4} data rows")
    print(f"  answer_key.csv          {len(answer):>4} rows")
    print("Injected issues (match answer_key):")
    for issue in ("non_date", "date_format", "blank", "vendor_variant",
                  "duplicate_feeder", "orphan_feeder", "feeder_format"):
        print(f"  {issue:<17} {issue_counts.get(issue, 0):>4}")


if __name__ == "__main__":
    main()
