# Workers AI Neuron Calculation

**Verified:** 2026-11-25

Workers AI does not count one request as one unit. It uses **Neurons**. A Neuron is a unit of GPU compute for an AI request.

## 1. Free allocation

- Workers Free includes **10,000 Neurons per day**.
- Workers Paid keeps the same 10,000 free Neurons per day.
- The daily limit resets at **00:00 UTC**.
- After the free allocation, Workers Paid costs **$0.011 per 1,000 Neurons**.
- Workers Free returns an error after the cap. It does not create a bill.

## 2. Calculation rule

Each model has its own rate. Use the unit that matches the task.

| Task | Formula |
| --- | --- |
| Text generation | `(input tokens / 1,000,000 × input rate) + (output tokens / 1,000,000 × output rate)` |
| Embeddings | `input tokens / 1,000,000 × rate` |
| Audio transcription | `audio minutes × rate` |
| Text-to-speech | `characters / 1,000 × rate` |
| Image generation | `tiles × tile rate + steps × step rate` |

Some models list a **cached input token** rate. Cached tokens use fewer Neurons.

## 3. Examples

The examples use the 10,000 Neuron daily allocation.

| Task | Model | Rate | Example | Neurons used | Daily amount |
| --- | --- | --- | --- | --- | --- |
| Chat | `@cf/meta/llama-3.2-1b-instruct` | 2,457/M input; 18,252/M output | 1,000 input + 500 output tokens | 11.58 | 863 such requests |
| Embedding | `@cf/baai/bge-small-en-v1.5` | 1,841/M input | 1M input tokens | 1,841 | 5.43M input tokens |
| Embedding | `@cf/google/embeddinggemma-2` | 154/M input | 1M input tokens | 154 | 64.9M input tokens |
| Speech to text | `@cf/openai/whisper` | 41.14 per audio minute | 1 minute audio | 41.14 | 243 minutes |
| Text to speech | `@cf/deepgram/aura-1` | 1,363.64 per 1,000 characters | 1,000 characters | 1,363.64 | 7,333 characters |

## 4. Separate rate limits

Neurons are not the only limit. Each task type also has a request rate limit.

| Task | Requests per minute |
| --- | --- |
| Text generation | 300 |
| Text embeddings | 3,000 |
| `@cf/baai/bge-large-en-v1.5` embeddings | 1,500 |
| Summarization | 1,500 |
| Text classification | 2,000 |
| Automatic speech recognition | 720 |
| Image-to-text | 720 |
| Text-to-image | 720 |
| Translation | 720 |
| Image classification | 3,000 |
| Object detection | 3,000 |

`@cf/runwayml/stable-diffusion-v1-5-img2img` is an exception. Its limit is 1,500 requests/minute.

A request can fail from the rate limit while Neurons remain.

## 5. Paid-only models

Some frontier models need Workers Paid or prepaid AI Gateway credits. Examples:

- `@cf/moonshotai/kimi-k2.6`
- `@cf/zai-org/glm-5.2`
- `@cf/deepseek-ai/deepseek-v4-pro-0813`
- `@cf/thinkingmachines/inkling-2-small`

With standard Workers AI billing, these models allow 20 requests/minute. With prepaid AI Gateway credits and Unified Billing, they allow 50 requests/minute.

## 6. Token-saving rules

- Set `max_tokens` low. Output tokens often cost more than input tokens.
- Shorten system prompts. Every input token counts.
- Use cached input tokens when the model supports them.
- Batch embedding requests. Batching does not reduce Neuron use, but it reduces request overhead.
- Monitor Neuron use in the Workers AI dashboard.

## 7. Sources

- Pricing and Neuron rates: <https://developers.cloudflare.com/workers-ai/platform/pricing/>
- Request rate limits: <https://developers.cloudflare.com/workers-ai/platform/limits/>
