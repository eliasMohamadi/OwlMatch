import type {
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

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; details?: unknown };
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

  students: () => request<StudentSummary[]>('GET', '/api/students'),
  student: (id: string) => request<Student>('GET', `/api/students/${id}`),
  saveOnboarding: (id: string, input: OnboardingInput) => request<Student>('PUT', `/api/students/${id}/onboarding`, input),
  updateSettings: (id: string, settings: { socialVisible: boolean }) => request<Student>('PATCH', `/api/students/${id}/settings`, settings),

  recommendations: (id: string, filters: DiscoverFilters) =>
    request<RecommendationsResponse>('GET', `/api/students/${id}/recommendations${filtersToQuery(filters)}`),
  comparison: (id: string) => request<ComparisonResponse>('GET', `/api/students/${id}/comparison`),
  concierge: (id: string, message: string) => request<ConciergeResponse>('POST', `/api/students/${id}/concierge`, { message }),
  matches: (id: string) => request<MatchesResponse>('GET', `/api/students/${id}/matches`),

  event: (eventId: string, viewer: string) => request<EventView>('GET', `/api/events/${eventId}?viewer=${encodeURIComponent(viewer)}`),
  createEvent: (input: NewEventInput) => request<EventView>('POST', '/api/events', input),
  removeEvent: (eventId: string, hostId: string) => request<{ ok: true }>('DELETE', `/api/events/${eventId}`, { hostId }),
  swipe: (eventId: string, studentId: string, decision: SwipeDecision) =>
    request<EventView>('POST', `/api/events/${eventId}/swipe`, { studentId, decision }),
  unswipe: (eventId: string, studentId: string) => request<EventView>('DELETE', `/api/events/${eventId}/swipe`, { studentId }),
  connect: (eventId: string, studentId: string, optIn: boolean) =>
    request<EventView>('POST', `/api/events/${eventId}/connect`, { studentId, optIn }),
  people: (eventId: string, viewer: string) => request<PeopleResponse>('GET', `/api/events/${eventId}/people?viewer=${encodeURIComponent(viewer)}`),
  approve: (eventId: string, studentId: string, hostId: string) =>
    request<{ ok: true }>('POST', `/api/events/${eventId}/requests/${studentId}/approve`, { hostId }),
  report: (eventId: string, studentId: string, reason: string) =>
    request<{ ok: true }>('POST', `/api/events/${eventId}/report`, { studentId, reason }),
  uploadImage: (dataUrl: string) => request<{ url: string }>('POST', '/api/uploads', { dataUrl }),
};
