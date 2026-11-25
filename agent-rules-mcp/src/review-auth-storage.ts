import type { ReviewAuth } from './reviewer';

export function putReviewAuth(storage: DurableObjectStorage, id: string, record: ReviewAuth): void {
  storage.kv.put(`auth:${id}`, record);
}

export function readReviewAuth(
  storage: DurableObjectStorage,
  id: string,
  consume = false,
): ReviewAuth | null {
  return storage.transactionSync(() => {
    const record = storage.kv.get<ReviewAuth>(`auth:${id}`);
    if (consume) storage.kv.delete(`auth:${id}`);
    return record !== undefined && record.expiresAt > Date.now() ? record : null;
  });
}
