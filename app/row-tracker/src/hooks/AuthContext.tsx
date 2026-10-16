import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { type AuthUser, type IAuthService } from '@/services/IAuthService';

interface AuthContextValue {
  user: AuthUser | null;
  /** Diagnostic: every claim the app can read for the user. Display only. */
  claims: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<AuthUser>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  fabricAuthEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  authService: IAuthService;
}

export function AuthProvider({ children, authService }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshClaims = useCallback(async () => {
    try {
      setClaims(await authService.getDiagnosticClaims());
    } catch {
      setClaims(null);
    }
  }, [authService]);

  useEffect(() => {
    let cancelled = false;
    authService
      .initEmbeddedAuth()
      .then((embedded) => embedded ?? authService.getCurrentUser())
      .then((current) => {
        if (!cancelled && current) {
          setUser(current);
          void refreshClaims();
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authService, refreshClaims]);

  const signIn = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const loggedInUser = await authService.signIn();
      setUser(loggedInUser);
      void refreshClaims();
      return loggedInUser;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [authService, refreshClaims]);

  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
      window.location.reload();
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, [authService]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      claims,
      loading,
      error,
      signIn,
      signOut,
      isAuthenticated: !!user,
      fabricAuthEnabled: authService.fabricAuthEnabled,
    }),
    [user, claims, loading, error, signIn, signOut, authService]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
