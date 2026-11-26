export const maxResponseBytes = 18000;

export function responseBytes(value: unknown): number {
  const result = {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  };
  return new TextEncoder().encode(JSON.stringify(result)).byteLength;
}

export function requireSafeResponse(value: unknown): void {
  if (responseBytes(value) > maxResponseBytes) {
    throw new Error(
      'Response is too large to return safely; stop until complete retrieval is supported.',
    );
  }
}
