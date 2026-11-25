import { useAnnounce } from '@astryxdesign/core/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import type { DashboardData, Decision } from '../../../src/contracts';
import { decidePatch, loadPatches } from './api';
import { patchKeys } from './query-keys';

export function usePatches(token: string | null) {
  const client = useQueryClient();
  const announce = useAnnounce();
  const queryKey = patchKeys.dashboard(token);
  const query = useQuery<DashboardData>({
    queryKey,
    enabled: (current) => token !== null && current.state.data?.closed !== true,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      try {
        return await loadPatches(token!, signal);
      } catch (error) {
        if (!axios.isCancel(error))
          announce('Could not load patches. Use Retry to try again.', 'assertive');
        throw error;
      }
    },
  });
  const mutation = useMutation({
    mutationFn: ({ patchId, decision }: { patchId: string; decision: Decision }) => {
      if (token === null) throw new Error('Dashboard token is missing');
      return decidePatch(token, patchId, decision);
    },
    onMutate: () => client.cancelQueries({ queryKey, exact: true }),
    onSuccess: async (result) => {
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData<DashboardData>(queryKey, (previous) => ({
        patches: previous?.patches.map((patch) =>
          patch.id === result.patch.id ? result.patch : patch,
        ) ?? [result.patch],
        closed: result.closed,
      }));
      announce(`Patch ${result.patch.status}. The recorded decision is shown with the patch.`);
    },
    onError: () => announce('Decision failed. No decision was confirmed. Try again.', 'assertive'),
  });
  return { query, mutation };
}
