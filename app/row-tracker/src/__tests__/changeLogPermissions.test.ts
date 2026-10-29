import { describe, expect, it } from 'vitest';

import { ConfigGenerator, SchemaAnalyzer } from '@microsoft/rayfin-core/analysis';

// Proof that the ChangeLog audit trail is append-only. The DAB permission config
// is generated purely from the entity decorators (Symbol.metadata), in-memory —
// no deploy, no `rayfin up`, no database. DAB only exposes a GraphQL mutation for
// an action some role grants, so "no update/delete action in the config" is
// exactly "no updateChangeLog/deleteChangeLog mutation on the API" — the same
// mechanism already observed for create in docs/app-notes.md "Deployed results".
//
// The generated client *types* expose .create/.update/.delete on every entity
// regardless of grants, so the type surface cannot prove this; the DAB config
// (which drives the GraphQL schema) is the authoritative artifact.
//
// We read the entities from the `tsc`-compiled output rather than the .ts source
// because the entity files use TC39 Stage-3 decorators that the test runner's
// swc transform does not parse; `tsc -b` (part of `npm run build`) lowers them.
// Run `npm run build` before the suite — the DoD order — so this artifact exists.
import { schema } from '../../rayfin/.temp/compiled/data/schema.js';

// A loose view of the generated DAB config — enough to read permissions without
// coupling the test to the generator's full (storage-aware) action union.
type DabAction = string | { action: string; policy?: { database?: string } };
type DabEntity = { permissions: { role: string; actions: DabAction[] }[] };

function entities(): Record<string, DabEntity> {
  // Silence the analyzer's per-field progress logging in the test output.
  const analyzed = new SchemaAnalyzer(schema, 'mssql', { log: () => {} }).analyzeEntities();
  const cfg = new ConfigGenerator('mssql').generateConfig(analyzed);
  return cfg.entities as unknown as Record<string, DabEntity>;
}

const actionName = (a: DabAction): string => (typeof a === 'string' ? a : a.action);

/** Every action any role is granted on an entity, by name. */
function grantedActions(entityName: string): string[] {
  return entities()[entityName].permissions.flatMap((p) =>
    p.actions.map(actionName)
  );
}

describe('ChangeLog is append-only (generated DAB config)', () => {
  it('exposes only read and create — never update or delete', () => {
    const actions = grantedActions('ChangeLog');
    expect(actions.sort()).toEqual(['create', 'read']);
    expect(actions).not.toContain('update');
    expect(actions).not.toContain('delete');
    expect(actions).not.toContain('*');
  });

  it('grants ChangeLog only to the authenticated role (no anonymous access)', () => {
    const roles = entities().ChangeLog.permissions.map((p) => p.role);
    expect(roles).toEqual(['authenticated']);
  });

  it('pins create to the caller email via a row-level policy', () => {
    const create = entities()
      .ChangeLog.permissions[0].actions.find(
        (a): a is Exclude<DabAction, string> =>
          typeof a !== 'string' && a.action === 'create'
      );
    expect(create?.policy?.database).toBe('@claims.email eq @item.changed_by');
  });

  it('leaves ClearingPlan unchanged (read + update, still no create/delete)', () => {
    expect(grantedActions('ClearingPlan').sort()).toEqual(['read', 'update']);
  });
});
