import { entity, authenticated, uuid, text, date, set } from '@microsoft/rayfin-core';

// Append-only audit trail: one row per saved feeder change. This is the second
// half of Phase 3's exit test — "every edit produces an audit row" — and the row
// no user can edit or delete.
//
// Permissions (see docs/app-notes.md):
//   - read   : any signed-in user
//   - create : any signed-in user, BUT a row-level policy pins `changed_by` to
//              the caller's own email claim, so the browser cannot forge who made
//              the change. DAB compiles this to `@claims.email eq @item.changed_by`.
//   - NO update, NO delete decorator at all. Rayfin/DAB therefore generate no
//     updateChangeLog / deleteChangeLog mutation, so the log cannot be altered
//     through the API. (Proven from the generated client types — see
//     docs/app-notes.md "Proving append-only".)
//
// `changed_at` is set by the client: the decorator surface has no server-set /
// auto-now timestamp (only a static `default`), confirmed against
// @microsoft/rayfin-core DateFieldOptions. Recorded as a known gap next to the
// two-writes gap in docs/app-notes.md.
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.email.eq(item.changed_by),
})
export class ChangeLog {
  @uuid() id!: string;

  // The feeder this change applies to (business id, e.g. "214-1"). Not unique —
  // a feeder has many log rows. Plain text, no relationship (matches the model;
  // avoids the {property}_id FK naming limitation, see known-limitations.md).
  @text({ max: 20 }) feeder_id!: string;

  // Only 'update' is written for now; 'create' is reserved for a future path.
  @set('create', 'update') action!: 'create' | 'update';

  // The signed-in email. The create policy requires this equals claims.email.
  @text({ max: 200 }) changed_by!: string;

  @date() changed_at!: Date;

  // JSON of ONLY the fields that changed: before_json holds the old values,
  // after_json the new ones; a cleared value is recorded as null. `max` is set
  // so the column is NVARCHAR(2000), not NVARCHAR(MAX) (known-limitations.md).
  @text({ max: 2000 }) before_json!: string;
  @text({ max: 2000 }) after_json!: string;

  @text({ max: 250, optional: true }) reason?: string;
}
