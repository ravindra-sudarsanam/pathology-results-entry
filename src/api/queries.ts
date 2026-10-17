import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { CreatePatientRequest, ResultEntry, SaveResultRequest } from './contracts';

export const queryKeys = {
  patients: ['patients'] as const,
  patient: (patientId: string) => ['patients', patientId] as const,
  results: (patientId: string) => ['patients', patientId, 'results'] as const,
  referenceConfig: ['reference-config'] as const,
};

export function usePatients() {
  return useQuery({ queryKey: queryKeys.patients, queryFn: api.listPatients });
}

export function usePatient(patientId: string) {
  return useQuery({ queryKey: queryKeys.patient(patientId), queryFn: () => api.getPatient(patientId) });
}

/** Ranges change rarely; one fetch per session is enough. */
export function useReferenceConfig() {
  return useQuery({ queryKey: queryKeys.referenceConfig, queryFn: api.getReferenceConfig, staleTime: Infinity });
}

export function usePatientResults(patientId: string) {
  return useQuery({ queryKey: queryKeys.results(patientId), queryFn: () => api.listResults(patientId) });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePatientRequest) => api.createPatient(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.patients, exact: true }),
  });
}

export function useSaveResult(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveResultRequest) => api.saveResult(patientId, data),
    onSuccess: (saved) => {
      // Show the server-classified entry immediately, then refetch in the background.
      queryClient.setQueryData<ResultEntry[]>(queryKeys.results(patientId), (current) =>
        current ? [saved, ...current.filter((entry) => entry.id !== saved.id)] : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.results(patientId) });
      // The patient list shows each patient's latest result summary.
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients, exact: true });
    },
  });
}
