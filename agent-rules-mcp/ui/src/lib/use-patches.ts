import { useAnnounce } from '@astryxdesign/core/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import type { DashboardData, Decision } from '../../../src/contracts';
import { decidePatch, loadPatches, renewAccess } from './api';
import { patchKeys } from './query-keys';

export function usePatches() {
  const client = useQueryClient();
  const announce = useAnnounce();
  const queryKey = patchKeys.dashboard(null);
  const query = useQuery<DashboardData>({
    queryKey,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      try {
        return await loadPatches(signal);
      } catch (error) {
        if (!axios.isCancel(error))
          announce('Could not load reviews. Sign in or renew access to continue.', 'assertive');
        throw error;
      }
    },
  });
  const mutation = useMutation({
    mutationFn: ({ patchId, decision }: { patchId: string; decision: Decision }) =>
      decidePatch(patchId, decision),
    onMutate: () => client.cancelQueries({ queryKey, exact: true }),
    onSuccess: async (result) => {
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData<DashboardData>(queryKey, (previous) => ({
        patches: previous?.patches.map((patch) =>
          patch.id === result.patch.id ? result.patch : patch,
        ) ?? [result.patch],
        closed: false,
        ...(previous?.accessExpiresAt ? { accessExpiresAt: previous.accessExpiresAt } : {}),
      }));
      announce(`Patch ${result.patch.status}. The recorded decision is shown with the patch.`);
    },
    onError: () => announce('Decision failed. No decision was confirmed. Try again.', 'assertive'),
  });
  const renewal = useMutation({
    mutationFn: renewAccess,
    onSuccess: (value) => {
      client.setQueryData<DashboardData>(queryKey, value);
      announce('Review access renewed.');
    },
    onError: () => announce('Access renewal failed. Sign in again.', 'assertive'),
  });
  return { query, mutation, renewal };
}
