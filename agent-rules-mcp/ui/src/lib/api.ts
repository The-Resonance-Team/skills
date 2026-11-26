import { dashboardSchema, decisionResultSchema } from '../../../src/contracts';
import type { Decision } from '../../../src/contracts';

import { api } from './client';

export async function loadPatches(signal: AbortSignal) {
  const { data } = await api.get<unknown>('/api/patches', { signal });
  return dashboardSchema.parse(data);
}

export async function decidePatch(patchId: string, decision: Decision) {
  const { data } = await api.post<unknown>('/api/decide', { patchId, decision });
  return decisionResultSchema.parse(data);
}

export async function renewAccess() {
  const { data } = await api.post<unknown>('/api/renew');
  return dashboardSchema.parse(data);
}
