// A small, dependency-free CSV parser — enough for the feeder export the load
// reads (prompt 09). We write our own rather than add a dependency (AGENTS.md:
// no new npm packages without asking). It handles the shapes Snowsight's CSV
// download produces: quoted fields, commas and newlines inside quotes, doubled
// quotes ("") as an escaped quote, a UTF-8 BOM, and CRLF or LF line endings.

/**
 * Parse CSV text into an array of records, each an array of string fields.
 * Quoted fields keep their inner commas/newlines; "" inside a quoted field
 * becomes a single ". A trailing blank line is ignored. Empty input yields [].
 */
export function parseCsv(text: string): string[][] {
  // Strip a leading UTF-8 BOM if present.
  let input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // Normalise CRLF/CR to LF so the scanner only deals with one line ending.
  input = input.replace(/\r\n?/g, '\n');

  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n') {
      record.push(field);
      rows.push(record);
      field = '';
      record = [];
    } else {
      field += ch;
    }
  }

  // Flush the final field/record if the text didn't end on a newline.
  if (field !== '' || record.length > 0) {
    record.push(field);
    rows.push(record);
  }

  return rows;
}
