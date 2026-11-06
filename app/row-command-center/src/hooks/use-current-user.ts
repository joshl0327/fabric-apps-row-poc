import { useAuth } from './auth.context';
import { isLocalBackend } from '@/services/local-backend';
import { LOCAL_USER } from '@/services/local-auth.service';

export interface CurrentUser {
  email: string | null;
  name: string;
}

/**
 * The signed-in user as the app needs it: an email (used as changed_by /
 * updated_by — the ChangeLogs create policy pins the audit row to it) and a
 * display name. Locally this is the synthetic LOCAL_USER; in Fabric it comes
 * from the opaque session. Email may be null if the session carries none, in
 * which case a save is kept but reported "saved but not logged".
 */
export function useCurrentUser(): CurrentUser {
  const { session } = useAuth();
  if (isLocalBackend()) {
    return { email: LOCAL_USER.email, name: LOCAL_USER.name };
  }
  // OpaqueSession is opaque; the deployed Fabric session exposes an identity we
  // read defensively.
  const user = (session as unknown as { user?: { email?: string; name?: string } } | null)?.user;
  return { email: user?.email ?? null, name: user?.name ?? user?.email ?? 'Signed-in user' };
}
