import {
  DATE_CERTAINTIES,
  NOTES_MAX,
  VENDORS,
  type FeederEdit,
} from './clearingPlanModel';

// Field and cross-field rules for a feeder edit. COPIED VERBATIM from
// app/row-tracker/src/services/validation.ts (field names kept identical). The
// two apps write the same table and must enforce the same rules; they cannot
// share code without a shared package (out of scope), so this is a deliberate
// duplicate — a known gap recorded in the README and docs/governance.md. If the
// rules change in one app, change them in the other in the same PR.
//
// This is the ONLY place the cross-field rules are enforced. Rayfin schema
// validation and DAB are per-field only, so a direct API write could still store
// an inconsistent row (same finding as the first app; see docs/app-notes.md).

export type FeederErrors = Partial<Record<keyof FeederEdit, string>>;

const isValidDateString = (value: string): boolean =>
  value !== '' && !Number.isNaN(new Date(value).getTime());

/** Returns an empty object when the input is valid. */
export function validateFeeder(input: FeederEdit): FeederErrors {
  const errors: FeederErrors = {};

  // --- Per-field rules (mirror the entity decorators) ---
  if (!VENDORS.includes(input.vendor)) {
    errors.vendor = 'Choose a vendor from the list.';
  }
  if (!DATE_CERTAINTIES.includes(input.date_certainty)) {
    errors.date_certainty = 'Choose a date certainty from the list.';
  }
  if (input.notes.length > NOTES_MAX) {
    errors.notes = `Notes must be ${NOTES_MAX} characters or fewer.`;
  }
  if (input.last_cleared_date !== '' && !isValidDateString(input.last_cleared_date)) {
    errors.last_cleared_date = 'Enter a valid date.';
  }
  if (input.next_clearing_date !== '' && !isValidDateString(input.next_clearing_date)) {
    errors.next_clearing_date = 'Enter a valid date.';
  }
  if (input.planned_year !== '') {
    const year = Number(input.planned_year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      errors.planned_year = 'Enter a four-digit year.';
    }
  }

  // --- Cross-field rules ---
  const certainty = input.date_certainty;
  const hasNextDate = input.next_clearing_date !== '';
  const hasPlannedYear = input.planned_year !== '';

  if (certainty === 'confirmed' || certainty === 'tentative') {
    if (!hasNextDate && !errors.next_clearing_date) {
      errors.next_clearing_date =
        'A confirmed or tentative feeder needs a next clearing date.';
    }
  } else if (certainty === 'next year') {
    if (!hasPlannedYear && !errors.planned_year) {
      errors.planned_year = '"Next year" needs a planned year.';
    }
    if (hasNextDate) {
      errors.next_clearing_date =
        '"Next year" has no exact date yet — clear the next clearing date.';
    }
  } else if (certainty === 'TBD') {
    if (hasNextDate) {
      errors.next_clearing_date =
        'TBD has no date — clear the next clearing date.';
    }
  }

  return errors;
}

export const hasErrors = (errors: FeederErrors): boolean =>
  Object.keys(errors).length > 0;
