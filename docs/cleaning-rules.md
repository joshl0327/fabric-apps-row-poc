# ROW clearing plan — cleaning rules (plain English)

The clearing plan is a hand-kept spreadsheet, so the same thing gets typed many
ways. These are the rules that turn it into one clean row per feeder in
Snowflake (`ROW_DB.STAGING`). The rules live in SQL
(`snowflake/04_staging_clean.sql`) and are proven against a test answer key
(`snowflake/05_staging_test.sql`). "As-of date" below is 2026-10-14, held in
`STAGING.CLEANING_CONFIG`.

| Problem | Rule | Example (raw → clean) |
|---------|------|-----------------------|
| **Feeder ID typed differently** | Drop spaces; drop leading zeros on the circuit number. Standard form is `substation-circuit`. | `214- 1` → `214-1` ·  `754-03` → `754-3` |
| **Same feeder listed twice** | Keep the last occurrence (highest spreadsheet row); set the earlier copy aside for review. | two rows for `328-4` → one `328-4` |
| **Feeder not in the circuit list** | Can't be matched to a real circuit — left out of the clean plan and sent to review. | `765-3` (no such circuit) → review |
| **Real date typed as text** | Read the date; mark it **confirmed**. | `2024-05-09`, `12-19-2028 ` → `2028-12-19` |
| **"Next Year"** | Next year relative to the as-of date; mark **next year**, no exact date yet. | `Next Year` → planned year **2027** |
| **Quarter / season / "year?"** | No exact date; mark **tentative** and keep the planned year. | `Q3 2027`, `Spring 2027`, `2027?` → tentative, year **2027** |
| **Date with a "TBD" note** | Recover the date but mark it **tentative** (not yet firm). | `10/20/2027 - TBD` → `2027-10-20`, tentative |
| **Blank / "per vendor" / other text** | No date; mark **TBD**. | `per vendor`, `TBD`, *(blank)* → TBD |
| **Last Cleared text** | Keep a real date if one can be read; otherwise leave it empty. | `Q3 2027` → *(empty)* · `2024-01-29` → `2024-01-29` |
| **Vendor name variant** | Normalize (case, spaces, punctuation, `&`↔`and`, drop `Inc`/`LLC`, expand `Veg`/`Mgmt`/`Svc`), then allow a close match for small typos; map to the one canonical name. | `Summit Veg Mgmt`, `summit vegetation management LLC`, `Summit Vegitation Mgmt` → `Summit Vegetation Management` |
| **Vendor by role** | A crew referred to by its type maps to that vendor. | `In-House Crew` → `North District Line Crew` |
| **Vendor we can't match** | Left null and sent to review (never guessed). | *(unrecognized)* → review |
| **Blank vendor** | Left empty. | *(blank)* → *(empty)* |

**Date certainty** is one of: `confirmed` (a real date), `tentative` (a date or
year we're not sure of), `next year`, or `TBD` (unknown).

Anything the rules can't settle on their own — orphan feeders, an unmatchable
vendor, or duplicate rows that disagree — lands in `STAGING.STG_DQ_REVIEW` for a
person to decide. For today's data that is just the two orphan feeders.
