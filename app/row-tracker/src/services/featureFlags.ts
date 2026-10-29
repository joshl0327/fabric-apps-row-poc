// Build-time feature switches. Vite statically inlines `import.meta.env.*`, so a
// flag that is unset at build time compiles to a constant `false` and the gated
// UI is tree-shaken out of the bundle.

// A read-only bag of env values; `import.meta.env` and test fixtures both
// satisfy it. Typed as a record (not a single optional key) so it isn't a weak
// type that `ImportMetaEnv` fails to match.
type FeederImportEnv = Record<string, unknown>;

/**
 * The one-time "Import feeders" panel (prompt 09) is OFF by default. It is only
 * shown when the app is built with `VITE_ENABLE_FEEDER_IMPORT=true`, i.e. for a
 * deliberate feeder-load deploy. Any other value (including unset) hides it.
 *
 * `env` is injectable for tests; it defaults to the real build-time env.
 */
export function isFeederImportEnabled(
  env: FeederImportEnv = import.meta.env
): boolean {
  return env.VITE_ENABLE_FEEDER_IMPORT === 'true';
}
