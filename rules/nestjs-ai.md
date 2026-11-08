# NestJS AI Rules — `@nestjs/ai` for models, agents and embeddings

Applies to NestJS services that call a language model, embed text, or expose tools to a model. Include this file only for those apps; `rules/nestjs.md` covers the rest of the API.

> **Docs (read before writing calls)**: [overview](https://docs.nestjs.com/ai/overview) · [models](https://docs.nestjs.com/ai/models) · [tools](https://docs.nestjs.com/ai/tools) · [agents](https://docs.nestjs.com/ai/agents) · [embeddings](https://docs.nestjs.com/ai/embeddings) · [testing](https://docs.nestjs.com/ai/testing). Token-lean raw markdown: `https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/ai/{overview,models,tools,agents,embeddings,testing}.md`. Use Context7 first per `rules/libraries.md` #7.

## Model registry and calls

1. **`@nestjs/ai` owns the provider and every model call** — Register named models and embedding models once in `AiModule.forRoot()` / `forRootAsync()`, then call them through `AiService` (`generateText`, `generateObject`, `streamText`, `embed`, `embedMany`). Construct `@ai-sdk/*` providers only in the module factory, from `ConfigService`.
   - Feature services do not import `generateText`, `streamText` or `embed` from `ai`, and do not call `createOpenAICompatible` or another provider factory. Keep one model registry, not one client per service.
   - `@InjectModel()` / `@InjectEmbeddingModel()` is the raw-SDK escape hatch. It drops `AiService` timeouts, retries, fallback, budgets and usage events; use it only when the call needs the SDK directly. `AiTools.select()` keeps agent-function schemas, scopes and enhancers for a raw call.
2. **Pin the package pair, then prove a clean install** — `@nestjs/ai` and its `@nestjs/resilience` peer are pre-1.0: pin exact versions and match the `ai` major the package declares (`ai` 7 for `@nestjs/ai` 0.0.x). Run `bun install --frozen-lockfile` after adding them; a package present only in `node_modules` is missing in production.
3. **Structured output is a schema, not a prompt** — Use `generateObject()` with a Zod schema and `.describe()` on every field. `AiOutputError` means the answer did not match; do not parse JSON by hand. A plain-text fallback is an application decision: keep it in one service and remember the endpoint's refusal for the process.

## Agent functions

4. **A model-callable method is a provider method with `@AgentFunction()`** — Give it a `name`, a `description` and an object `inputSchema`; list it by name or provider class in the call's `tools`. Do not hand-roll a tool schema, a dispatch loop or a second authorization path.
5. **Pass `caller`, declare `scopes`** — `caller: { request }` in a route; `caller: { user, scopes }` in a queue job. A method with `scopes` runs only when the caller holds them. Guards, interceptors, pipes and filters run with context type `'ai'`; a shared enhancer checks `context.getType()` before `switchToHttp()`.
6. **Use `@nestjs/ai/workflows` only for durable or approved runs** — A run that waits for a person or survives a restart stores `caller` as `user`/`scopes`; its providers are `@Public()`. Pass `ctx.idempotencyKey` to every side effect. A request/response chat does not need a workflow.

## Streaming, usage and embeddings

7. **Stream through `AiTextStream`** — `streamText()` exposes `toUIMessageStream()`, `pipeUIMessageStreamToResponse()`, `text`, `usage` and `steps`. Use `pipeUIMessageStreamToResponse()` when the route writes directly; use `toUIMessageStream()` only when the app must mirror chunks (resumable SSE). Feature services do not pipe the raw `ai` SDK stream.
8. **Record usage once, in the AI seam** — Set `onUsage` / `onEmbeddingUsage` on the module or the one wrapper service for tokens, cost and latency; call sites do not duplicate counters. `pricing` is per million tokens; a model without it reports no cost.
9. **Embeddings have no fallback** — `embed()` / `embedMany()` use the `embeddingModels` registry. Never compare vectors from two models; changing the model or dimensions requires a re-index. Store vectors in `pgvector` or a vector database.

## Tests and runtime

10. **No provider in tests** — Use `FakeModel`, `FakeEmbeddingModel`, `overrideModels()`, `overrideEmbeddingModels()` and `callTool()` from `@nestjs/ai/testing`. Register a real `AiModule.forRoot()` with fakes so retries, timeouts, schemas, agent functions and streaming run as in production. Keep one success-path test for the pipeline; a mocked SDK call proves only the mock.
11. **A standalone script imports `reflect-metadata` first** — `@nestjs/ai` is ESM-only; Bun and Node 22+ load it from the CommonJS build. A script that boots `NestFactory.createApplicationContext()` imports `reflect-metadata` before the decorated modules. The normal `main.ts` gets it from `@nestjs/core`.
