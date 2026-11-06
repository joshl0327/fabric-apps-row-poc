// @generated — do not edit.

// Connector: row_pbi_poc (fabric-semanticmodel)

import type { ConnectorConfig } from '@microsoft/rayfin-connectors';
import type { FabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';

/**
 * Typed connector schema for "row_pbi_poc" (fabric-semanticmodel).
 * Plug into your AppConnectorsSchema in your RayfinClient setup.
 */
export type RowPbiPocSchema = FabricSemanticModel<'executeQuery'>;

export const connectorConfig = {
  connector: 'fabric-semanticmodel',
} as const satisfies ConnectorConfig;
