/** Trimmed view of the authenticated user shown in the UI. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Auth service contract used by the React layer.
 *
 * Two implementations ship with this template:
 *
 * - {@link MockAuthService} — used when the API URL points at localhost.
 *   Signs into the bundled local backend with a fixture email/password.
 * - {@link RayfinAuthService} — used in production. Wraps the Fabric
 *   brokered auth flow from `@microsoft/rayfin-auth-provider-fabric`.
 *
 * `bootstrapAuth()` picks the right one from VITE_* env vars at startup.
 */
export interface IAuthService {
  /**
   * True when this service requires Fabric/Entra interactive sign-in.
   * The AuthPage uses this to choose its loading-state label.
   */
  readonly fabricAuthEnabled: boolean;

  /**
   * Acquire a session interactively. For Fabric this opens the broker
   * popup and must be called from a user-gesture handler.
   */
  signIn(): Promise<AuthUser>;

  signOut(): Promise<void>;

  /** Return the current session's user, or `null` if not signed in. */
  getCurrentUser(): Promise<AuthUser | null>;

  /**
   * Try to acquire a session via the embedded (iframe) Fabric flow without
   * any UI. Returns `null` when not running inside a Fabric iframe.
   */
  initEmbeddedAuth(): Promise<AuthUser | null>;

  /**
   * Return every claim the app can read for the signed-in user, for the
   * diagnostic "Who am I" panel. The Rayfin session is opaque, so in practice
   * this is whatever the session `user` exposes (id, email, name). It answers
   * the open design question — do Entra groups/roles reach the app — once the
   * app is deployed and signed in through Fabric. Locally the values are
   * synthetic. Display only; never gate logic on these.
   */
  getDiagnosticClaims(): Promise<Record<string, unknown>>;
}

/** Map the raw session user shape to the trimmed view used in the UI. */
export function toAuthUser(user: {
  id: string;
  email: string;
  name?: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
  };
}
