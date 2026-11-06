// #region rayfin:app-owned — copied verbatim by the Rayfin CLI; edit freely.
//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

// Connector wiring for the app's Rayfin client (`src/lib/rayfin-client.ts`). Below the
// `@generated` line it declares each connector's typed schema (`AppConnectorsSchema`), routing
// config (`connectorConfigs`) and client-side runtime (`connectorRuntimes`), keyed by connector
// name. The template ships with no connectors, so all three are empty until the first
// `npx rayfin connector add`.

import type { TypedConnectorsApi } from "@microsoft/rayfin-connectors";
import type { FabricSemanticModel } from "@microsoft/rayfin-connector-fabric-semanticmodel";

/**
 * The connectors as `useSemanticModelQuery` addresses them: by a connector name chosen at
 * run time. The generated `AppConnectorsSchema` lists only the names scaffolded so far,
 * and it is empty in the template.
 */
export type SemanticModelConnectors = TypedConnectorsApi<Record<string, FabricSemanticModel<"executeQuery">>>;
// #endregion rayfin:app-owned

// Hand-owned wiring (the `@generated` marker was removed so `rayfin connector
// add` prints the required wiring instead of rewriting this file). Two
// connectors are wired:
//   - row_pbi_poc  : Category B semantic model (DAX via useSemanticModelQuery)
//   - row-tracker  : Category A Fabric SQL database (typed CRUD entities)
// The SQL connector needs no runtime hook — only Category B (semantic model)
// does, to decode the Arrow response.

import { fabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import type {
  ConnectorConfig,
  ConnectorsRuntime,
} from '@microsoft/rayfin-connectors';

import { connectorConfig as rowPbiPocConfig, type RowPbiPocSchema } from '../../rayfin/connectors/row_pbi_poc/schema';
import { connectorConfig as rowTrackerConfig, type RowTrackerSchema } from '../../rayfin/connectors/row-tracker/schema';

export type AppConnectorsSchema = {
  'row_pbi_poc': RowPbiPocSchema;
  'row-tracker': RowTrackerSchema;
};

export const connectorConfigs: Record<string, ConnectorConfig> = {
  'row_pbi_poc': rowPbiPocConfig,
  'row-tracker': rowTrackerConfig,
};

export const connectorRuntimes: ConnectorsRuntime = {
  'row_pbi_poc': fabricSemanticModel(),
};
