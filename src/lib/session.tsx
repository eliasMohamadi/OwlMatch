import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthState } from '@shared/types';
import { api, setActingAs, setUnauthorizedHandler } from './api';

/**
 * Who is using the app. Students sign in with their university Microsoft
 * account and always act as themselves. A signed-in admin acts as one demo
 * student per tab, chosen with the switcher or `?as=<studentId>` in the URL
 * (so two tabs can run as two different demo students).
 */
const STORAGE_KEY = 'owlmatch.actingAs';
const DEFAULT_DEMO_STUDENT = 'stu-jordan';

function initialActingAs(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('as');
  if (fromUrl) {
    // Remember it for this tab: in-app links drop `?as=`, and a reload must stay on the same student.
    try {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {
      // Storage unavailable (private mode): the choice lasts until reload.
    }
    return fromUrl;
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY) ?? DEFAULT_DEMO_STUDENT;
  } catch {
    return DEFAULT_DEMO_STUDENT;
  }
}

export interface SignedInSession {
  studentId: string;
  role: 'student' | 'admin';
  /** The signed-in student's university email (students only). */
  email: string | null;
  /** Admin only: act as another demo student in this tab. */
  switchStudent: (id: string) => void;
  signOut: () => Promise<void>;
}

type SessionState = { status: 'loading' } | { status: 'signed-out' } | ({ status: 'signed-in' } & SignedInSession);

const SessionContext = createContext<SessionState>({ status: 'loading' });

export const AUTH_QUERY_KEY = ['auth'] as const;

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const auth = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: api.me, staleTime: Infinity, retry: false, refetchOnWindowFocus: true });
  const [actingAs, setActingAsState] = useState(initialActingAs);

  useEffect(() => {
    setUnauthorizedHandler(() => void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }));
  }, [queryClient]);

  const switchStudent = useCallback((id: string) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, id);
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage can be unavailable (private mode); the in-memory choice still works.
    }
    setActingAsState(id);
  }, []);

  /**
   * Ends the session and shows the sign-in page. Order matters: set the
   * signed-out state first so the app re-renders into the sign-in page, then
   * drop everything else that was cached for the old session. (Clearing the
   * whole cache first detached the screen from the sign-in state, so the old
   * page stayed up after signing out.)
   */
  const signOut = useCallback(async () => {
    await api.signOut().catch(() => undefined);
    setActingAs(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: nothing to forget.
    }
    // Start the next sign-in from the app's front door, not the page we left.
    window.history.replaceState(null, '', '/');
    queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, { signedIn: false });
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== AUTH_QUERY_KEY[0] });
  }, [queryClient]);

  const data = auth.data;
  // Set synchronously so the first queries below this provider already carry the header.
  setActingAs(data?.signedIn && data.role === 'admin' ? actingAs : null);

  const value = useMemo<SessionState>(() => {
    if (auth.isPending) return { status: 'loading' };
    if (!data?.signedIn) return { status: 'signed-out' };
    if (data.role === 'admin') return { status: 'signed-in', role: 'admin', studentId: actingAs, email: null, switchStudent, signOut };
    return { status: 'signed-in', role: 'student', studentId: data.studentId, email: data.email, switchStudent: () => undefined, signOut };
  }, [auth.isPending, data, actingAs, switchStudent, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Sign-in status, for the top-level gate. */
export function useSessionState(): SessionState {
  return useContext(SessionContext);
}

/** The signed-in session. Only use below the sign-in gate in App. */
export function useSession(): SignedInSession {
  const value = useContext(SessionContext);
  if (value.status !== 'signed-in') throw new Error('useSession must be used after sign-in');
  return value;
}
