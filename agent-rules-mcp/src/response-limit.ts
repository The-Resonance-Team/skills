export const maxResponseBytes = 18000;

export function requireSafeResponse(value: unknown): void {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maxResponseBytes) {
    throw new Error(
      'Response is too large to return safely; stop until complete retrieval is supported.',
    );
  }
}
