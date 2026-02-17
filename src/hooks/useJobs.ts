import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Job, JobStats, WorkerType, PaginatedResponse } from '../lib/types';

export function useJobs(projectId?: string) {
  return useQuery({
    queryKey: ['jobs', projectId],
    queryFn: async () => {
      const endpoint = projectId ? `/jobs?projectId=${projectId}` : '/jobs';
      const response = await api.get<PaginatedResponse<Job>>(endpoint);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!.data;
    },
    refetchInterval: 10_000,
  });
}

export function useJobStats() {
  return useQuery({
    queryKey: ['jobStats'],
    queryFn: async () => {
      const response = await api.get<JobStats>('/jobs/stats');
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    refetchInterval: 5_000,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      beadId?: string;
      prompt: string;
      workerType?: WorkerType;
      priority?: number;
    }) => {
      const response = await api.post<Job>('/jobs', input);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobStats'] });
      queryClient.invalidateQueries({ queryKey: ['beads'] });
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.post<Job>(`/jobs/${jobId}/retry`);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobStats'] });
    },
  });
}
