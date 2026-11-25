import { z } from 'zod';

import vectors from './query-vectors.json';

const queryVectors = z.record(z.string(), z.string()).parse(vectors);
const inputSchema = z.object({ input: z.array(z.string()).min(1) });

// Adapter boundary: the offline fixture implements the AI run operation used by searchAi.
export const fixtureAi = {
  run: async (_model: string, input: unknown) => {
    const query = inputSchema.parse(input).input[0].replace(/^task: search result \| query: /, '');
    const embedding = queryVectors[query];
    if (embedding === undefined) throw new Error(`Missing evaluation vector: ${query}`);
    return { data: [{ embedding }] };
  },
} as unknown as Ai;
