import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DrainStatus, DrainPreview, DrainStartResult, DrainSummary, DrainDetail } from '../lib/types';

export function useDrainStatus(projectId: string) {
  return useQuery({
    queryKey: ['drain', projectId],
    queryFn: async () => {
      const response = await api.get<DrainStatus>(
        `/projects/${projectId}/drain`
      );
      if (!response.success) throw new Error(response.error);
      return response.data!;
    },
    enabled: !!projectId,
    refetchInterval: 5_000,
  });
}

export function useDrainPreview(projectId: string, maxCount: number = 10) {
  return useQuery({
    queryKey: ['drainPreview', projectId, maxCount],
    queryFn: async () => {
      const response = await api.get<DrainPreview>(
        `/projects/${projectId}/drain/preview?maxCount=${maxCount}`
      );
      if (!response.success) throw new Error(response.error);
      return response.data!;
    },
    enabled: !!projectId,
  });
}

export function useDrainSummary(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['drainSummary', projectId],
    queryFn: async () => {
      const response = await api.get<DrainSummary>(
        `/projects/${projectId}/drain/summary`
      );
      if (!response.success) return null;
      return response.data!;
    },
    enabled: !!projectId && enabled,
    refetchInterval: (query) => {
      // Poll while smoke test checklist is still being generated
      const data = query.state.data;
      if (data && !data.smokeTestChecklist) return 5_000;
      return false;
    },
  });
}

export function useStartDrain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      beadIds?: string[];
      autoSelect?: boolean;
      maxAutoSelect?: number;
      maxJobs?: number;
    }) => {
      const { projectId, ...body } = input;
      const response = await api.post<DrainStartResult>(
        `/projects/${projectId}/drain`,
        body
      );
      if (!response.success) throw new Error(response.error);
      return response.data!;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drain', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobStats'] });
      queryClient.invalidateQueries({ queryKey: ['beads'] });
    },
  });
}

export function useDrainDetail(projectId: string, drainId: string | null) {
  return useQuery({
    queryKey: ['drainDetail', projectId, drainId],
    queryFn: async () => {
      const response = await api.get<DrainDetail>(
        `/projects/${projectId}/drains/${drainId}`
      );
      if (!response.success) throw new Error(response.error);
      return response.data!;
    },
    enabled: !!projectId && !!drainId,
  });
}

export function useStopDrain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await api.delete<{ success: boolean; wasDraining: boolean }>(
        `/projects/${projectId}/drain`
      );
      if (!response.success) throw new Error(response.error);
      return response.data!;
    },
    onSuccess: (_data, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['drain', projectId] });
    },
  });
}
