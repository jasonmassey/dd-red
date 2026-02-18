import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Job, JobStats, WorkerType, PaginatedResponse, JobStatus } from '../lib/types';

export function useJobs(projectId?: string, status?: JobStatus) {
  return useQuery({
    queryKey: ['jobs', projectId, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId);
      if (status) params.append('status', status);
      const endpoint = `/jobs${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get<PaginatedResponse<Job>>(endpoint);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!.data;
    },
    refetchInterval: status === 'completed' ? false : 10_000,
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
