# Evaluation results

Date: 2026-11-25. Ten real task queries, expected rule IDs hand-labelled in
`cases.ts`. The local eval server used 256-dimensional query embeddings from
`@cf/google/embeddinggemma-2` through the Cloudflare MCP. Three independent
subagents ran the same benchmark.

| Run | Semantic recall@5 | Lexical recall@5 | Mean response bytes | Mean wall time |
| --- | --- | --- | --- | --- |
| A | 0.78 | 0.65 | 1,640 | 0.59 ms |
| B | 0.78 | 0.65 | 1,640 | 0.74 ms |
| C | 0.78 | 0.65 | 1,640 | 0.84 ms |

All three runs agreed on every case. Semantic search was equal or better on
nine cases. One case lost to lexical search: "Convert a Claude Design export
into a Next.js page". Lexical search found `i18n` at rank 5; semantic search
substituted `libraries`.

The first request was an outlier in each run (1.55 ms, 2.13 ms, 2.27 ms),
consistent with cold-start cost. Later requests stayed below 1.5 ms.

The response was about 1,640 bytes, or roughly 410 tokens, for five candidates.
The full catalog is about 250,000 bytes. On-demand retrieval is the token
saving; the tool schemas are still present in every request.

## Interpretation

The current retrieval text uses the rule title, the router scope cell, the
first paragraph, and rule headings. Adding headings raised semantic recall from
0.65 to 0.78. The remaining gap is concentrated in cross-domain tasks where a
workflow and several rules share the query. The benchmark measures rule
selection, not whether the agent followed the rule after reading it.
