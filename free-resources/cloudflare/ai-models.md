# Workers AI Model Picks

**Verified:** 2026-11-25

These picks use current Cloudflare model pages and Neuron rates. They target a 10,000 Neuron daily budget. They are not a quality benchmark.

**Do not use:** `@cf/qwen/qwen3-30b-a3b-fp8`. Cloudflare marked it deprecated on 2026-11-20.

## 1. Generative models

Rates are Neurons per million tokens. Requests/day assumes 1,000 input tokens + 500 output tokens.

| Use case | Model | Input rate | Output rate | Neurons/request | Requests/day | Why pick it |
| --- | --- | --- | --- | --- | --- | --- |
| Best default balance | `@cf/zai-org/glm-4.7-flash` | 5,500 | 36,400 | 23.7 | 421 | Reasoning, function calling, 131k context, 100+ languages |
| Best for high volume / RAG answers | `@cf/ibm-granite/granite-4.0-h-micro` | 1,542 | 10,158 | 6.62 | 1,510 | Cheapest strong model; good for instruction following and tool calls |
| Best for harder reasoning | `@cf/openai/gpt-oss-20b` | 18,182 | 27,273 | 31.82 | 314 | Reasoning levels low/medium/high; function calling; 128k context |
| Structured extraction only | `@cf/cloudflare/clairic-flash` | 9,091 | 0 | 9.09 for 1k input | 1,099 | Typed fields and confidence scores; no output token charge; research preview |

Avoid 70B models on a free budget. `@cf/meta/llama-3.3-70b-instruct-fp8-fast` uses about 129 Neurons for the same request. The daily amount is about 77 requests.

## 2. Embedding models

Rates are Neurons per million input tokens.

| Use case | Model | Rate | Input tokens/day | Notes |
| --- | --- | --- | --- | --- |
| Best efficiency | `@cf/google/embeddinggemma-2` | 154 | 64.9M | Multimodal; 8,192 context; 768 dims; can return 128/256/512 dims |
| Best for Vietnamese and long text | `@cf/baai/bge-m3` | 1,075 | 9.3M | Multilingual; 60k context |
| Alternative low-cost | `@cf/qwen/qwen3-embedding-0.6b` | 1,075 | 9.3M | Low-cost embedding option |
| RAG reranker | `@cf/baai/bge-reranker-base` | 283 | 35.3M | Use after retrieval to improve result order |
| Avoid unless required | `@cf/baai/bge-large-en-v1.5` | 18,582 | 538k | About 18× the cost of `bge-m3` |

## 3. Recommended stacks

- General RAG: `embeddinggemma-2` + `bge-reranker-base` + `granite-4.0-h-micro`
- Multilingual or Vietnamese RAG: `bge-m3` + `bge-reranker-base` + `glm-4.7-flash`
- Agent with tool calls: `glm-4.7-flash`
- Hard reasoning: `gpt-oss-20b`, used only on difficult requests
- Invoice or form extraction: `clairic-flash`

## 4. Token-saving rules

See [AI neuron calculation](./ai-neurons.md#6-token-saving-rules) for shared rules about output tokens, system prompts, cached tokens, batching, and monitoring.

Model-specific rules:

- Use smaller embedding dimensions with `embeddinggemma-2` when storage matters.
- Use task prefixes for `embeddinggemma-2`:
  - Query: `task: search result | query: ...`
  - Document: `title: ... | text: ...`
  - No title: `title: none | text: ...`
- Route easy requests to `granite-4.0-h-micro`. Send hard requests to `glm-4.7-flash`.
- Keep the same embedding dimensions for documents and queries.

## 5. Model pages

- GLM-4.7-Flash: <https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/>
- Granite 4.0 h-micro: <https://developers.cloudflare.com/workers-ai/models/granite-4.0-h-micro/>
- GPT-OSS-20B: <https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/>
- Clairic Flash: <https://developers.cloudflare.com/workers-ai/models/clairic-flash/>
- EmbeddingGemma 2: <https://developers.cloudflare.com/workers-ai/models/embeddinggemma-2/>
- BGE-M3: <https://developers.cloudflare.com/workers-ai/models/bge-m3/>
- Deprecated Qwen3 model: <https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/>
- Neuron rates: <https://developers.cloudflare.com/workers-ai/platform/pricing/>
