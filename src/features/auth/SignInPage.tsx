import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { AuthState } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { ApiError, api } from '../../lib/api';
import { useHealth } from '../../lib/queries';
import { AUTH_QUERY_KEY } from '../../lib/session';

const AUTH_ERRORS: Record<string, string> = {
  domain: 'That account is not a KSU student or staff email. Sign in with your KSU Microsoft account.',
  cancelled: 'Sign-in was cancelled.',
  expired: 'The sign-in took too long or was opened in another tab. Please try again.',
  'not-configured': 'Microsoft sign-in is not set up on this server yet.',
  failed: 'Microsoft sign-in did not complete. Please try again.',
};

function readAuthError(): string | null {
  const code = new URLSearchParams(window.location.search).get('auth_error');
  if (!code) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return AUTH_ERRORS[code] ?? AUTH_ERRORS.failed;
}

export function SignInPage() {
  const { data: health, isError: serverDown } = useHealth();
  const [error] = useState(readAuthError);
  const domains = health?.auth.allowedEmailDomains ?? [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Logo />
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-ink">Sign in to OwlMatch</h1>
      <p className="mt-2 text-muted">Discover campus activities that fit you, and find people to go with.</p>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      {serverDown && (
        <p role="alert" className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-danger">
          Can't reach the OwlMatch server.
        </p>
      )}

      <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <Button
          block
          size="lg"
          variant="dark"
          disabled={!health?.auth.microsoft}
          icon={<MicrosoftMark />}
          onClick={() => window.location.assign('/api/auth/microsoft/start')}
        >
          Sign in with Microsoft
        </Button>
        <p className="mt-4 flex gap-2 text-sm text-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ink" aria-hidden />
          <span>
            Use your KSU account{domains.length > 0 && <> ({domains.map((d) => `@${d}`).join(' or ')})</>}. Microsoft checks your password and asks
            you to approve the sign-in in Microsoft Authenticator.
          </span>
        </p>
        {health && !health.auth.microsoft && <p className="mt-3 text-sm text-danger">Microsoft sign-in is not configured on this server.</p>}
      </section>

      {health?.auth.admin && <AdminSignIn />}

      <p className="mt-8 text-center text-xs text-muted">OwlMatch is a student-built project inspired by KSU. It is not operated or endorsed by KSU.</p>
    </main>
  );
}

function AdminSignIn() {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const state = await api.adminSignIn(password);
      queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, state);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <details className="mt-4 rounded-[var(--radius-card)] border border-line bg-white p-5">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink">
        <KeyRound size={16} aria-hidden /> Admin sign-in (demo students)
      </summary>
      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
        <label htmlFor="admin-password" className="block text-sm font-semibold text-ink">
          Admin password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border-2 border-line p-3 focus:border-ink focus:outline-none"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" block variant="outline" loading={pending} disabled={password.length === 0}>
          Sign in as admin
        </Button>
      </form>
    </details>
  );
}

function MicrosoftMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
