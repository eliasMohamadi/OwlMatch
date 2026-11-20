import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AiPage } from '../features/ai/AiPage';
import { DiscoverPage } from '../features/discovery/DiscoverPage';
import { CreateEventPage } from '../features/events/CreateEventPage';
import { EventDetailsPage } from '../features/events/EventDetailsPage';
import { MatchesPage } from '../features/matches/MatchesPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { useCurrentStudent } from '../lib/queries';
import { useSession } from '../lib/session';

/** Sends students who haven't onboarded yet to the welcome flow. */
function RequireOnboarding() {
  const { data: student, isLoading } = useCurrentStudent();
  if (isLoading) return null;
  if (student && !student.onboarded) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

export function App() {
  // Keying by student resets all per-page state when the demo student switches.
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
          <Route path="/events/:eventId" element={<EventDetailsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/discover" replace />} />
    </Routes>
  );
}
