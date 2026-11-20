import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiscoverFilters, NewEventInput, OnboardingInput, SwipeDecision } from '@shared/types';
import { api } from './api';
import { useSession } from './session';

/** Query keys in one place so invalidation stays consistent. */
export const keys = {
  health: ['health'] as const,
  students: ['students'] as const,
  student: (id: string) => ['student', id] as const,
  recommendations: (id: string, filters: DiscoverFilters) => ['recommendations', id, filters] as const,
  comparison: (id: string) => ['comparison', id] as const,
  matches: (id: string) => ['matches', id] as const,
  event: (eventId: string, viewer: string) => ['event', eventId, viewer] as const,
  people: (eventId: string, viewer: string) => ['people', eventId, viewer] as const,
};

/** AI-backed queries are expensive; never refetch them just because the window regained focus. */
const AI_QUERY_OPTIONS = { staleTime: Infinity, refetchOnWindowFocus: false, retry: false } as const;

export const useHealth = () => useQuery({ queryKey: keys.health, queryFn: api.health, staleTime: 60_000 });
export const useStudents = () => useQuery({ queryKey: keys.students, queryFn: api.students });

export function useCurrentStudent() {
  const { studentId } = useSession();
  return useQuery({ queryKey: keys.student(studentId), queryFn: () => api.student(studentId) });
}

export function useRecommendations(filters: DiscoverFilters) {
  const { studentId } = useSession();
  return useQuery({ queryKey: keys.recommendations(studentId, filters), queryFn: () => api.recommendations(studentId, filters), ...AI_QUERY_OPTIONS });
}

export function useComparison(enabled: boolean) {
  const { studentId } = useSession();
  return useQuery({ queryKey: keys.comparison(studentId), queryFn: () => api.comparison(studentId), enabled, ...AI_QUERY_OPTIONS });
}

export function useMatches() {
  const { studentId } = useSession();
  return useQuery({ queryKey: keys.matches(studentId), queryFn: () => api.matches(studentId) });
}

export function useEvent(eventId: string) {
  const { studentId } = useSession();
  return useQuery({ queryKey: keys.event(eventId, studentId), queryFn: () => api.event(eventId, studentId) });
}

export function usePeople(eventId: string, enabled = true) {
  const { studentId } = useSession();
  return useQuery({ queryKey: keys.people(eventId, studentId), queryFn: () => api.people(eventId, studentId), enabled });
}

/** Invalidates everything that depends on a single event's social state. */
function useEventInvalidation() {
  const queryClient = useQueryClient();
  const { studentId } = useSession();
  return (eventId: string) => {
    void queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    void queryClient.invalidateQueries({ queryKey: ['people', eventId] });
    void queryClient.invalidateQueries({ queryKey: keys.matches(studentId) });
    void queryClient.invalidateQueries({ queryKey: keys.comparison(studentId) });
  };
}

export function useSwipe() {
  const { studentId } = useSession();
  const invalidate = useEventInvalidation();
  return useMutation({
    mutationFn: ({ eventId, decision }: { eventId: string; decision: SwipeDecision }) => api.swipe(eventId, studentId, decision),
    onSuccess: (_event, { eventId }) => invalidate(eventId),
  });
}

export function useUnswipe() {
  const { studentId } = useSession();
  const invalidate = useEventInvalidation();
  return useMutation({
    mutationFn: (eventId: string) => api.unswipe(eventId, studentId),
    onSuccess: (_event, eventId) => invalidate(eventId),
  });
}

export function useConnect() {
  const { studentId } = useSession();
  const invalidate = useEventInvalidation();
  return useMutation({
    mutationFn: ({ eventId, optIn }: { eventId: string; optIn: boolean }) => api.connect(eventId, studentId, optIn),
    onSuccess: (_event, { eventId }) => invalidate(eventId),
  });
}

export function useSaveOnboarding() {
  const { studentId } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OnboardingInput) => api.saveOnboarding(studentId, input),
    onSuccess: (student) => {
      queryClient.setQueryData(keys.student(studentId), student);
      void queryClient.invalidateQueries({ queryKey: ['recommendations', studentId] });
      void queryClient.invalidateQueries({ queryKey: keys.comparison(studentId) });
      void queryClient.invalidateQueries({ queryKey: keys.students });
    },
  });
}

export function useUpdateSettings() {
  const { studentId } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: { socialVisible: boolean }) => api.updateSettings(studentId, settings),
    onSuccess: (student) => queryClient.setQueryData(keys.student(studentId), student),
  });
}

/** A new event changes every other student's deck, so drop all cached recommendations. */
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { studentId } = useSession();
  return useMutation({
    mutationFn: (input: NewEventInput) => api.createEvent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      void queryClient.invalidateQueries({ queryKey: keys.matches(studentId) });
    },
  });
}

export function useResetDemo() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: api.resetDemo, onSuccess: () => queryClient.clear() });
}
