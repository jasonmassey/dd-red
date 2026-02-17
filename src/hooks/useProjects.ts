import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Project } from '../lib/types';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get<Project[]>('/projects');
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
  });
}
