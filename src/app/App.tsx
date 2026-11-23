import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AiPage } from '../features/ai/AiPage';
import { SignInPage } from '../features/auth/SignInPage';
import { DiscoverPage } from '../features/discovery/DiscoverPage';
import { CreateEventPage } from '../features/events/CreateEventPage';
import { EventDetailsPage } from '../features/events/EventDetailsPage';
import { MatchesPage } from '../features/matches/MatchesPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { useCurrentStudent } from '../lib/queries';
import { useSession, useSessionState } from '../lib/session';

/** Sends students who haven't onboarded yet to the welcome flow. */
function RequireOnboarding() {
  const { data: student, isLoading } = useCurrentStudent();
  if (isLoading) return null;
  if (student && !student.onboarded) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

/** Nothing below this renders until the browser has a valid session. */
export function App() {
  const session = useSessionState();
  if (session.status === 'loading') return null;
  if (session.status === 'signed-out') return <SignInPage />;
  return <SignedInApp />;
}

function SignedInApp() {
  // Keying by student resets all per-page state when an admin switches demo students.
  const { studentId } = useSession();
  return (
    <Routes key={studentId}>
      <Route path="/welcome" element={<OnboardingPage />} />
      <Route element={<RequireOnboarding />}>
        <Route element={<AppShell />}>
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/create" element={<CreateEventPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/events/:eventId" element={<EventDetailsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/discover" replace />} />
    </Routes>
  );
}
