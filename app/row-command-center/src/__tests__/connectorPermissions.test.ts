import { describe, expect, it } from 'vitest';

import { ConnectorConfigGenerator, ConnectorSchemaAnalyzer } from '@microsoft/rayfin-core/analysis';

// Proof that this app's SQL-database connector grants exactly the right actions
// on the two shared tables, and that ChangeLogs pins `changed_by` server-side.
//
// The DAB permission config is generated purely from the connector entity
// decorators (Symbol.metadata), in-memory — no deploy, no `rayfin up`, no
// database. DAB only exposes a GraphQL mutation for an action a role grants, so
// "no update/delete action in the config" is exactly "no update*/delete* mutation
// on the API" — the same mechanism the first app relies on (app/row-tracker's
// changeLogPermissions.test.ts), here applied to Category A connector entities
// via ConnectorSchemaAnalyzer + ConnectorConfigGenerator.
//
// fabric-sqldatabase analyzes under the 'mssql' dialect (it is a real SQL DB;
// ConnectorDialect only names the warehouse/lakehouse flavors).
//
// Entities are read from the `tsc`-compiled output (TC39 Stage-3 decorators the
// vitest swc transform does not parse). Run `npm run build` first — the DoD
// order — so rayfin/.temp/compiled/ exists.
import { ClearingPlans } from '../../rayfin/.temp/compiled/connectors/row-tracker/ClearingPlans.js';
import { ChangeLogs } from '../../rayfin/.temp/compiled/connectors/row-tracker/ChangeLogs.js';

type DabAction = string | { action: string; policy?: { database?: string } };
type DabEntity = { permissions: { role: string; actions: DabAction[] }[] };

function entities(): Record<string, DabEntity> {
  const analyzed = new ConnectorSchemaAnalyzer(
    [ClearingPlans, ChangeLogs],
    'mssql',
    { log: () => {} },
  ).analyzeEntities();
  const cfg = new ConnectorConfigGenerator('mssql').generateConfig(analyzed);
  return cfg.entities as unknown as Record<string, DabEntity>;
}

const actionName = (a: DabAction): string => (typeof a === 'string' ? a : a.action);

/** Every action any role is granted on an entity, by name. */
function grantedActions(entityName: string): string[] {
  return entities()[entityName].permissions.flatMap((p) => p.actions.map(actionName));
}

describe('row-tracker SQL connector permissions (generated DAB config)', () => {
  it('ClearingPlans grants read + update — no create, no delete, no *', () => {
    const actions = grantedActions('ClearingPlans');
    expect(actions.sort()).toEqual(['read', 'update']);
    expect(actions).not.toContain('create');
    expect(actions).not.toContain('delete');
    expect(actions).not.toContain('*');
  });

  it('ChangeLogs grants read + create — no update, no delete, no * (append-only)', () => {
    const actions = grantedActions('ChangeLogs');
    expect(actions.sort()).toEqual(['create', 'read']);
    expect(actions).not.toContain('update');
    expect(actions).not.toContain('delete');
    expect(actions).not.toContain('*');
  });

  it('grants both tables only to the authenticated role (no anonymous access)', () => {
    expect(entities().ClearingPlans.permissions.map((p) => p.role)).toEqual(['authenticated']);
    expect(entities().ChangeLogs.permissions.map((p) => p.role)).toEqual(['authenticated']);
  });

  it('pins ChangeLogs create to the caller email via a row-level policy', () => {
    const create = entities()
      .ChangeLogs.permissions.flatMap((p) => p.actions)
      .find(
        (a): a is Exclude<DabAction, string> =>
          typeof a !== 'string' && a.action === 'create',
      );
    // The connector policy keys on the mapped GraphQL field name (changedBy),
    // where the first app's native entity used the column name (changed_by).
    // Same enforcement: the browser cannot forge who made the change.
    expect(create?.policy?.database).toBe('@claims.email eq @item.changedBy');
  });
});
