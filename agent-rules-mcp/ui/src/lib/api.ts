import { dashboardSchema, decisionResultSchema } from '../../../src/contracts';
import type { Decision } from '../../../src/contracts';

import { api } from './client';

export async function loadPatches(token: string, signal: AbortSignal) {
  const { data } = await api.get<unknown>('/api/patches', { params: { token }, signal });
  return dashboardSchema.parse(data);
}

export async function decidePatch(token: string, patchId: string, decision: Decision) {
  const { data } = await api.post<unknown>('/api/decide', { token, patchId, decision });
  return decisionResultSchema.parse(data);
}
