import { describe, expect, it } from 'vitest';

import { parseCsv } from '@/services/csv';
import {
  buildSummary,
  parseFeederImport,
  planUpsert,
  reconcile,
  type ImportRecord,
} from '@/services/import';

const HEADER =
  'feeder_id,district_name,vendor,last_cleared_date,last_work_done,next_clearing_date,date_certainty,planned_year,notes';

// A valid export row for each certainty, plus edge cases, assembled per test.
const rows = {
  confirmed: '101-1,Stone Creek,Ironwood Forestry,2021-06-14,trim,2026-11-15,confirmed,,',
  tentative: '704-2,North Ridge,Summit Vegetation Management,,,2027-10-20,tentative,2027,',
  tbdYear: '189-6,Pine Hollow,Unassigned,,,,TBD,2027,known year no date',
  nextYear: '742-2,Elk Meadow,Summit Vegetation Management,,,,next year,2028,',
  // notes with an embedded comma and newline, quoted the way Snowsight exports.
  quotedNotes:
    '203-1,Cedar Valley,Greenway Land and Timber,,,2026-12-01,confirmed,,"gate locked, call first\nsee map"',
};

describe('parseCsv — tokenizer', () => {
  it('keeps commas and newlines inside quoted fields and unescapes ""', () => {
    const out = parseCsv('a,"b,c","line1\nline2","say ""hi"""');
    expect(out).toEqual([['a', 'b,c', 'line1\nline2', 'say "hi"']]);
  });

  it('handles a BOM, CRLF line endings, and a trailing newline', () => {
    const out = parseCsv('﻿x,y\r\n1,2\r\n');
    expect(out).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('parseFeederImport — structural errors', () => {
  it('throws on an empty file', () => {
    expect(() => parseFeederImport('')).toThrow(/empty/i);
  });

  it('throws naming a missing column', () => {
    const header = HEADER.replace(',date_certainty', '');
    expect(() => parseFeederImport(`${header}\n${rows.confirmed}`)).toThrow(
      /date_certainty/
    );
  });
});

describe('parseFeederImport — row validation', () => {
  it('accepts valid rows for every certainty and parses quoted notes', () => {
    const csv = [
      HEADER,
      rows.confirmed,
      rows.tentative,
      rows.tbdYear,
      rows.nextYear,
      rows.quotedNotes,
    ].join('\n');
    const { records, errors } = parseFeederImport(csv);
    expect(errors).toHaveLength(0);
    expect(records).toHaveLength(5);
    expect(records.find((r) => r.feeder_id === '203-1')?.edit.notes).toContain(
      'gate locked, call first'
    );
  });

  it('skips a confirmed feeder with no next clearing date (same rule as the form)', () => {
    const bad = '555-1,Stone Creek,Ironwood Forestry,,,,confirmed,,';
    const { records, errors } = parseFeederImport(`${HEADER}\n${bad}`);
    expect(records).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 1, feeder_id: '555-1' });
    expect(errors[0].reason).toMatch(/next clearing date/i);
  });

  it('skips a row with an unknown vendor and one missing a feeder_id', () => {
    const badVendor = '556-1,Stone Creek,Totally Fake Vendor,,,2027-01-01,confirmed,,';
    const noId = ',Stone Creek,Ironwood Forestry,,,2027-01-01,confirmed,,';
    const { records, errors } = parseFeederImport(
      [HEADER, badVendor, noId].join('\n')
    );
    expect(records).toHaveLength(0);
    expect(errors.map((e) => e.reason)).toEqual([
      expect.stringMatching(/vendor/i),
      expect.stringMatching(/feeder_id is required/i),
    ]);
  });

  it('skips a duplicate feeder_id within the file (keeps the first)', () => {
    const csv = [HEADER, rows.confirmed, rows.confirmed].join('\n');
    const { records, errors } = parseFeederImport(csv);
    expect(records).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/duplicate/i);
  });

  it('ignores a trailing blank line', () => {
    const { records, errors } = parseFeederImport(`${HEADER}\n${rows.confirmed}\n`);
    expect(records).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
});

describe('planUpsert — create vs update decision', () => {
  const records: ImportRecord[] = [
    { feeder_id: '101-1', district_name: 'Stone Creek', edit: {} as never },
    { feeder_id: '189-6', district_name: 'Pine Hollow', edit: {} as never },
  ];

  it('updates existing feeder_ids, creates missing ones, reports leftovers', () => {
    const existing = [
      { id: 'A', feeder_id: '101-1' }, // matches → update
      { id: 'B', feeder_id: '999-9' }, // not in file → leftover
    ];
    const plan = planUpsert(records, existing);

    expect(plan.toUpdate).toEqual([
      { id: 'A', record: records[0] },
    ]);
    expect(plan.toCreate).toEqual([records[1]]);
    expect(plan.leftover).toEqual(['999-9']);
  });

  it('is re-runnable: a second load of the same rows is all updates, no leftovers', () => {
    const existing = [
      { id: 'A', feeder_id: '101-1' },
      { id: 'C', feeder_id: '189-6' },
    ];
    const plan = planUpsert(records, existing);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(2);
    expect(plan.leftover).toHaveLength(0);
  });
});

describe('reconcile + buildSummary — counts', () => {
  const csv = [
    HEADER,
    rows.confirmed, // confirmed, has date
    rows.tentative, // tentative, has date
    rows.tbdYear, // TBD, no date
    rows.nextYear, // next year, no date
  ].join('\n');

  it('counts certainty mix and feeders with a next date', () => {
    const { records } = parseFeederImport(csv);
    const r = reconcile(records);
    expect(r.total).toBe(4);
    expect(r.certainty).toEqual({
      confirmed: 1,
      tentative: 1,
      'next year': 1,
      TBD: 1,
    });
    expect(r.withNextDate).toBe(2); // confirmed + tentative carry a date
  });

  it('summary combines created/updated/skipped with the reconciliation', () => {
    const parsed = parseFeederImport(csv);
    const existing = [{ id: 'A', feeder_id: '101-1' }]; // one match
    const plan = planUpsert(parsed.records, existing);
    const summary = buildSummary(
      plan.toCreate.length,
      plan.toUpdate.length,
      parsed,
      plan
    );
    expect(summary).toMatchObject({
      created: 3,
      updated: 1,
      skipped: 0,
      leftover: [],
    });
    expect(summary.reconciliation.total).toBe(4);
  });
});
