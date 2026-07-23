import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { login as loginRequest, getSession } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";

/**
 * Dead-simple username auth. A rep types their name (and the shared team
 * password, if the admin set one), we get back a signed token, and we keep it
 * in localStorage. No Clerk, no OAuth, no per-person passwords.
 */

const TOKEN_KEY = "jt:token";

export interface SessionUser {
  id: number;
  name: string;
  role: "admin" | "rep";
  avatarUrl: string | null;
}

interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: SessionUser | null;
  signIn: (name: string, password?: string) => Promise<void>;
  signOut: () => void;
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode / storage disabled — session just won't persist */
  }
}

// Register the token getter once, at module load, so every generated API call
// carries the bearer header. Reads localStorage fresh each time.
setAuthTokenGetter(() => readToken());

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  // On boot, if we have a stored token, confirm it's still valid.
  useEffect(() => {
    let cancelled = false;
    const token = readToken();
    if (!token) {
      setIsLoaded(true);
      return;
    }
    getSession()
      .then((u) => {
        if (cancelled) return;
        setUser(u as SessionUser);
      })
      .catch(() => {
        if (cancelled) return;
        // Stale/invalid token — clear it so we drop to the login screen.
        writeToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      isLoaded,
      isSignedIn: !!user,
      user,
      async signIn(name: string, password?: string) {
        const res = await loginRequest({ name, password: password ?? null });
        writeToken(res.token);
        setUser(res.user as SessionUser);
        // Drop any cached data from a previous identity.
        queryClient.clear();
      },
      signOut() {
        writeToken(null);
        setUser(null);
        queryClient.clear();
      },
    }),
    [isLoaded, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
