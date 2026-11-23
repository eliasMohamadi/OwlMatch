import type {
  AuthState,
  ComparisonResponse,
  ConciergeResponse,
  DiscoverFilters,
  EventView,
  HealthResponse,
  MatchesResponse,
  NewEventInput,
  OnboardingInput,
  PeopleResponse,
  RecommendationsResponse,
  Student,
  StudentSummary,
  SwipeDecision,
} from '@shared/types';

/** Typed client for the OwlMatch API. All AI calls happen server-side. */

/** App settings a student can change; send only the ones that change. */
export type StudentSettings = Partial<Pick<Student, 'socialVisible' | 'showMatchSheet'>>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * The demo student an admin acts as in this tab. The server ignores it for
 * signed-in students, who always act as themselves.
 */
let actingAs: string | null = null;
export function setActingAs(studentId: string | null): void {
  actingAs = studentId;
}

/** Called when the server says the session ended, so the app can show the sign-in page. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (actingAs) headers['X-OwlMatch-As'] = actingAs;
  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; details?: unknown };
  if (response.status === 401 && !path.startsWith('/api/auth/')) onUnauthorized();
  if (!response.ok) throw new ApiError(response.status, data.error ?? 'Request failed', data.details);
  return data as T;
}

function filtersToQuery(filters: DiscoverFilters): string {
  const params = new URLSearchParams();
  if (filters.campus) params.set('campus', filters.campus);
  if (filters.categories?.length) params.set('categories', filters.categories.join(','));
  if (filters.when && filters.when !== 'any') params.set('when', filters.when);
  if (filters.kind && filters.kind !== 'all') params.set('kind', filters.kind);
  if (filters.query) params.set('q', filters.query);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const api = {
  health: () => request<HealthResponse>('GET', '/api/health'),
  resetDemo: () => request<{ ok: true }>('POST', '/api/demo/reset'),

  me: () => request<AuthState>('GET', '/api/auth/me'),
  adminSignIn: (password: string) => request<AuthState>('POST', '/api/auth/admin', { password }),
  signOut: () => request<{ ok: true }>('POST', '/api/auth/signout'),

  /** Admin only: the demo students they can act as. */
  students: () => request<StudentSummary[]>('GET', '/api/students'),
  student: (id: string) => request<Student>('GET', `/api/students/${id}`),
  saveOnboarding: (id: string, input: OnboardingInput) => request<Student>('PUT', `/api/students/${id}/onboarding`, input),
  updateSettings: (id: string, settings: StudentSettings) => request<Student>('PATCH', `/api/students/${id}/settings`, settings),

  recommendations: (id: string, filters: DiscoverFilters) =>
    request<RecommendationsResponse>('GET', `/api/students/${id}/recommendations${filtersToQuery(filters)}`),
  comparison: (id: string) => request<ComparisonResponse>('GET', `/api/students/${id}/comparison`),
  concierge: (id: string, message: string) => request<ConciergeResponse>('POST', `/api/students/${id}/concierge`, { message }),
  matches: (id: string) => request<MatchesResponse>('GET', `/api/students/${id}/matches`),

  // Event actions always apply to the signed-in student (or the admin's chosen demo student).
  event: (eventId: string) => request<EventView>('GET', `/api/events/${eventId}`),
  createEvent: (input: Omit<NewEventInput, 'organizerId'>) => request<EventView>('POST', '/api/events', input),
  removeEvent: (eventId: string) => request<{ ok: true }>('DELETE', `/api/events/${eventId}`),
  swipe: (eventId: string, decision: SwipeDecision) => request<EventView>('POST', `/api/events/${eventId}/swipe`, { decision }),
  unswipe: (eventId: string) => request<EventView>('DELETE', `/api/events/${eventId}/swipe`),
  connect: (eventId: string, optIn: boolean) => request<EventView>('POST', `/api/events/${eventId}/connect`, { optIn }),
  people: (eventId: string) => request<PeopleResponse>('GET', `/api/events/${eventId}/people`),
  approve: (eventId: string, studentId: string) => request<{ ok: true }>('POST', `/api/events/${eventId}/requests/${studentId}/approve`),
  report: (eventId: string, reason: string) => request<{ ok: true }>('POST', `/api/events/${eventId}/report`, { reason }),
  uploadImage: (dataUrl: string) => request<{ url: string }>('POST', '/api/uploads', { dataUrl }),
};
