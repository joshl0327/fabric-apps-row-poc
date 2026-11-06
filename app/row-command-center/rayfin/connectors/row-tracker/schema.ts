// Aggregate schema for the row-tracker Fabric SQL database connector (Category A).
// Overwrites the `connector add` placeholder per the generation contract
// (@microsoft/rayfin-connector-fabric-graphql/assets/docs/index.md): re-export
// each generated entity class, export a `connectorConfig` value, and a
// `<Name>Schema` type for the client.
//
// Only ClearingPlans and ChangeLogs are generated (subset mode). The source also
// exposes Users and storage.objects, which this app does not use, so they are
// deliberately omitted — no entity, no access.
import type { GraphQLBackedConnector } from '@microsoft/rayfin-connector-fabric-graphql';
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';

import { ClearingPlans } from './ClearingPlans.js';
import { ChangeLogs } from './ChangeLogs.js';

export { ClearingPlans } from './ClearingPlans.js';
export { ChangeLogs } from './ChangeLogs.js';

// `as const satisfies` (not `: ConnectorConfig`) so the connector and operations
// literals survive — the marker reads them for the CRUD verbs. `operations` here
// mirrors the connector-wide ceiling in rayfin.yml (read, create, update); each
// entity's @role actions stay a subset of it.
export const connectorConfig = {
  connector: 'fabric-sqldatabase',
  operations: ['read', 'create', 'update'],
  entities: { ClearingPlans, ChangeLogs },
} as const satisfies ConnectorConfig;

export type RowTrackerSchema = GraphQLBackedConnector<
  { ClearingPlans: typeof ClearingPlans; ChangeLogs: typeof ChangeLogs },
  typeof connectorConfig
>;
