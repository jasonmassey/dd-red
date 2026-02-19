import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Bead, PaginatedResponse } from '../lib/types';

export function useBeads(projectId: string) {
  return useQuery({
    queryKey: ['beads', projectId],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Bead>>(
        `/beads?projectId=${projectId}&limit=500`
      );
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!.data;
    },
    enabled: !!projectId,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
}

export function useReadyBeads(projectId: string) {
  const { data: beads } = useBeads(projectId);

  const readyBeads = beads?.filter((bead) => {
    if (bead.status !== 'pending') return false;
    if (!bead.preInstructions) return false;

    const blockedByCompleted = bead.blockedBy.every((blockerId) => {
      const blocker = beads?.find((b) => b.id === blockerId);
      return blocker?.status === 'completed';
    });

    return blockedByCompleted;
  });

  return readyBeads || [];
}

export function useUpdateBead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      beadId: string;
      projectId: string;
      priority?: number;
      status?: string;
      preInstructions?: string;
    }) => {
      const { beadId, ...body } = input;
      const response = await api.patch<Bead>(`/beads/${beadId}`, body);
      if (!response.success) throw new Error(response.error);
      return response.data!;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['beads', variables.projectId] });
    },
  });
}
