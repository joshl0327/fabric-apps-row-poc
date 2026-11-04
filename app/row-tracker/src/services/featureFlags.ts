// Build-time feature switches. Vite statically inlines `import.meta.env.*`, so
// the flag's value is a build-time constant. The gated UI is hidden by a
// RUNTIME check (`isFeederImportEnabled`), NOT tree-shaken out: the call is a
// cross-module reference Rollup can't fold, so the panel's code and strings stay
// in the bundle either way — only the inlined literal
// `VITE_ENABLE_FEEDER_IMPORT:"true"|"false"` differs. The deploy workflow greps
// the shipped bundle for that literal to confirm what actually shipped.

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
