import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Demo session. OwlMatch has no university SSO in this build, so the active
 * student is chosen with a clearly labeled demo switcher and remembered per tab.
 * `?as=<studentId>` in the URL lets two tabs run as two different students.
 */
const STORAGE_KEY = 'owlmatch.studentId';
const DEFAULT_STUDENT_ID = 'stu-jordan';

function initialStudentId(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('as');
  if (fromUrl) return fromUrl;
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY) ?? DEFAULT_STUDENT_ID;
  } catch {
    return DEFAULT_STUDENT_ID;
  }
}

interface SessionValue {
  studentId: string;
  switchStudent: (id: string) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [studentId, setStudentId] = useState(initialStudentId);

  const switchStudent = useCallback((id: string) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, id);
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage can be unavailable (private mode); the in-memory session still works.
    }
    setStudentId(id);
  }, []);

  const value = useMemo(() => ({ studentId, switchStudent }), [studentId, switchStudent]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
