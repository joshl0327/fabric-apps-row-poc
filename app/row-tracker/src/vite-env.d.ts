/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build-time switch for the one-time "Import feeders" panel; off unless
   * exactly "true". See src/services/featureFlags.ts. */
  readonly VITE_ENABLE_FEEDER_IMPORT?: string;
}
