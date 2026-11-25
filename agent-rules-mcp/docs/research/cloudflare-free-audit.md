# Cloudflare Free audit for the rules MCP server

**Verified:** 2026-11-25

**Purpose:** Cited Free-plan audit and an implementation comparison for the confirmed requirements. The selected architecture is recorded in [the handoff resolution](../handoff-resolution.md).

**Method:** Read current Cloudflare product documentation and local source, with supplemental read-only account verification. No deployment, account changes, production writes, dependency changes, or production benchmark.

## 1. Scope and observed workload

The user's decisions, also recorded in the [handoff resolution](../handoff-resolution.md), set this scope:

- An approved rule patch becomes a draft PR. Review and merge take place in GitHub. The rules MCP server does not need PR-status sync.
- Rule publication follows a successful rebuild and deployment. There is no live refresh target.
- Approval, denial, and access renewal require a signed-in Cloudflare Access reviewer. Record reviewer identity; possession of a proposal link is insufficient.
- Expired dashboard access is renewable without losing rule patch proposals or history. Pending proposals have a 30-day review window; final history is retained for 90 days after the final outcome. Uncertain submission attempts are retained until resolved.
- An unused approval is valid for 24 hours. A reviewer can approve the same unchanged proposal again after expiry, preserving the previous decision. Renewal must not extend an approval or reset a used approval.
- Reject target-file drift and require refreshed review. Unrelated changes to `main` do not invalidate approval.
- Accepted submissions finish independently of the client connection. Repeated proposal/submission requests return the same logical result. A successful proposal has one draft PR; recovery must not create another. Recover uncertain attempts by matching the GitHub branch/PR and stop recovery once the outcome is known.

These decisions exclude ongoing PR-status polling and live catalog refresh. They explicitly require durable multi-step completion, bounded idempotent recovery, and retention cleanup. Automatic continuation or retry is permitted when it preserves the approval, reviewed diff, and one-PR invariant; blind repetition of an uncertain GitHub write is not permitted.

Local evidence read on this branch:

| Observation | Evidence |
| --- | --- |
| The committed rule catalog contains 29 entries: 23 rules and 6 workflows. It is 317,149 bytes, including 232,257 bytes of rule/workflow content. | Direct JSON and byte counts from [generated/catalog.json](../../generated/catalog.json). These are local artifact measurements. |
| Vectors use `@cf/google/embeddinggemma-2` with 256 dimensions. The 29 vectors contain 7,424 dimensions, or 29,696 raw float32 bytes before encoding and JSON overhead. | [Catalog](../../generated/catalog.json) and [builder](../../scripts/build-catalog.ts). |
| Query embeddings run through the Workers AI binding. Cosine ranking, lexical scores, citation adjustment, and diversity adjustment run in the Worker. | [Search source](../../src/search.ts). |
| `ApprovalStore` is already a SQLite-backed Durable Object. Its synchronous KV methods store dashboard tokens, proposals, and approval records in the object's SQLite storage. `OAUTH_KV` is a separate Workers KV binding. | [Configuration](../../wrangler.jsonc), [approval source](../../src/patches.ts), and the [storage API][do-storage]. |
| `claim()` persists a used approval and `unknown` patch status before the external GitHub work. A successful `finish()` records the PR URL. There is no alarm, renewal method, or automatic deletion in this class at the time inspected. | [Approval source](../../src/patches.ts). This is an observation of current source, not verification of the deployed flow. |
| The current successful draft-PR path makes seven sequential GitHub API requests. Drift checks and branch/PR reconciliation will add requests; seven is the baseline, not the new runner's complete budget. | [GitHub source](../../src/submission.ts). Redirects, authentication traffic, and error paths are additional considerations. |
| The builder reuses vectors by retrieval-text digest and includes source paths and complete source contents in `sourceDigest`. Deployment is triggered by relevant changes on `main`. | [Builder](../../scripts/build-catalog.ts) and [deployment workflow](../../../.github/workflows/deploy-agent-rules-mcp.yml). |

The [existing results](../../eval/RESULTS.md) report semantic recall@5 of 0.78 and lexical recall@5 of 0.65 on ten cases. Their 0.59–0.84 ms mean wall times come from a [local server](../../eval/serve.ts) with [stored query-vector fixtures](../../eval/fixture-ai.ts). They do not measure live embedding latency, deployed Worker CPU, OAuth cost, or FTS5 quality.

The local [Free limits](../../../free-resources/cloudflare/free-limits.md) and [paid upgrade](../../../free-resources/cloudflare/paid-upgrade.md) notes were read as an inventory. Current primary sources below determine this note's limits.

## 2. Current availability and quotas

An included allocation is a capacity budget. It is not evidence that adding the product improves this workload. Account allocations can also be used by other projects.

| Product | Current Free availability and relevant limits | Relevance under the user's decisions |
| --- | --- | --- |
| Workers | 100,000 requests/day per account, reset at 00:00 UTC; 10 ms CPU per HTTP or Cron invocation; 128 MB memory per isolate; 50 external subrequests/invocation and 1,000 to internal services; 6 simultaneous outgoing connections awaiting headers. [Limits][workers-limits], [pricing][workers-pricing]. | The 10 ms CPU budget needs measurement across authentication, parsing, ranking, and response serialization. Network wait is a separate quantity. |
| SQLite Durable Objects | Available on Workers Free. 100,000 requests/day, 13,000 GB-s duration/day, 5 million SQL rows read/day, 100,000 rows written/day, and 5 GB total stored data. The KV storage backend is not available on Free. The KV methods on a SQLite object remain available. [Pricing][do-pricing]. | Already stores approval state. Transactions and persistent storage directly serve the human approval requirement. Extra databases are not required to obtain these properties. |
| Durable Object SQL and alarms | Native SQL API, FTS5 including `fts5vocab`, JSON, synchronous transactions, and alarms are supported. Each object can have one pending alarm. Alarm execution is at least once, with up to six automatic retries. [Storage][do-storage], [alarms][do-alarms]. | Alarms now have confirmed uses: durable submission progress, recovery, and retention cleanup. SQL full-text search remains a separate optional candidate. |
| Workers KV | 100,000 keys read/day; 1,000 keys written/day; 1,000 deletes/day; 1,000 list requests/day; 1 GB storage; one write/second to the same key; values up to 25 MiB. Minimum read `cacheTtl` is currently 30 seconds. [Pricing][kv-pricing], [limits][kv-limits]. | Read-heavy caching is supported. Eventual consistency is a material limit for approval claims and for any freshness promise. OAuth already uses this service. |
| Cron Triggers | Available on Free; five triggers/account; minute is the smallest cron field; schedules use UTC. Free scheduled CPU remains 10 ms, with a 15-minute wall-time limit. Changes can take up to 15 minutes to propagate and scheduled invocations can be missed during propagation. [Cron docs][cron], [Workers limits][workers-limits]. | A small independent repair sweep can restore due jobs/cleanup after alarm retry exhaustion or failed rearming. This is distinct from the excluded PR-status and catalog polling. |
| Workflows | Available on Free: 100,000 new invocations/day shared with Workers, 10 ms CPU, 1 GB-month storage, 3,000 steps/day. Product limits specify 10 ms compute per step, 100 concurrently executing instances/account, 1,024 steps/instance, 100 MB persisted state/instance, and three-day completed-state retention. [Pricing][workflows-pricing], [limits][workflows-limits]. | A genuine candidate for the now-required durable multi-step submission. It still needs application history, approval checks, drift checks, and idempotent GitHub recovery. Section 6 compares it with DO alarms. |
| Queues | Available on Free: 10,000 operations/day and fixed 24-hour message retention. A small message normally uses three operations: write, read, delete. Retries consume additional reads. Maximum message size is 128 KB, including about 100 bytes of metadata. [Pricing][queues-pricing], [limits][queues-limits]. | Durable asynchronous work is now required, but a separate Queue is not established as necessary. Its short retention cannot replace the proposal/history store, and delivery can duplicate. |
| Vectorize | Product-specific introduction explicitly permits Workers Free or Paid. Free allocation: 5 million stored dimensions and 30 million queried dimensions/month; 100 indexes. Maximum 1,536 dimensions/vector, float32 precision, 10 KiB metadata/vector. The general Workers pricing page still contains a conflicting “only available on the Workers paid plan” sentence. [Introduction][vectorize-intro], [product pricing][vectorize-pricing], [limits][vectorize-limits], [general pricing][workers-pricing]. | Documented as available on Free, with the conflict preserved below. Storage capacity greatly exceeds 29 vectors. It would add an index service and would not remove query embedding generation. |
| Workers AI embeddings | Available on Workers Free within 10,000 Neurons/day, reset at 00:00 UTC. Further operations fail after this limit. Text embedding default rate is 3,000 requests/minute; the listed `bge-large-en-v1.5` exception is 1,500/minute. [Pricing][ai-pricing], [limits][ai-limits]. | Already supplies query and changed-document embeddings. Its cost and latency must be measured separately from vector ranking. |
| Cache API | Available on Free, sharing the subrequest budget; 50 calls/request and a 512 MB maximum object. Contents are local to a data center. `put()` requires a GET key; `match()` can miss or return expired/missing data as `undefined`. `stale-while-revalidate` and `stale-if-error` are not supported. [Runtime API][cache], [limits][workers-limits]. | May avoid repeated remote work when equivalent requests repeat. Current exact catalog reads are already bundled. A cache is not persistent history or a freshness guarantee. Hosting caveats appear below. |
| Analytics Engine | Workers Free allocation is 100,000 written data points/day and 10,000 read queries/day. Data retention is three months; up to 250 data points/Worker invocation. Documentation also says usage is not currently billed and publishes prices in advance. [Pricing][analytics-pricing], [limits][analytics-limits]. | Can measure search outcomes, latency, failures, and catalog version if those metrics are needed. Sampling prevents treating it as an exact approval journal. |
| R2 | Included monthly Standard storage: 10 GB-month, one million Class A operations, ten million Class B operations, free direct egress. Requires a separate R2 subscription and checkout; usage beyond the included allocation is billable. The free allocation excludes Infrequent Access storage. [Pricing][r2-pricing], [setup][r2-start]. | Can hold large or separately published artifacts. The current catalog fits in the Worker bundle. R2 is an additional subscription with an included allowance, not a Workers Free hard-cap guarantee. |
| D1 | Available on Free: ten databases, 500 MB/database, 5 GB/account, five million rows read/day, 100,000 rows written/day; 50 queries/Worker invocation and seven-day Time Travel. [Pricing][d1-pricing], [limits][d1-limits]. | Provides SQL, but approval state already has SQL-capable transactional storage. A separate database needs a separate query/access requirement to justify it. |
| AI Gateway | Core analytics, caching, and rate limiting are free on all plans; ten gateways on the free plan. Cacheable requests up to 25 MB; cache TTL up to one month. Accounts creating their first gateway on/after 2026-09-24 use Workers Logs. Older accounts use a 100,000-log total Free allowance. [Pricing][gateway-pricing], [limits][gateway-limits]. | May help if a model-traffic observation or repeated-request requirement exists. It does not provide extra free inference or make every model free. Embedding cache support is not established by the generic caching page alone. |
| Email Sending | Available on Workers Free to account-verified destination addresses. These sends are free and excluded from monthly quota and daily sending limits. Arbitrary recipients require Workers Paid. Up to 200 destination addresses/account, 50 recipients/email, and 25 MiB/message. [Pricing][email-pricing], [limits][email-limits], [2026-11-24 change][email-change]. | Optional team alerts, only if desired. There is no current notification requirement or reason to replace dashboard review with email. |
| Dynamic Workers | Workers Paid only. [Product pricing][dynamic-pricing]. | Excluded by the Workers Free requirement. No research finding changes the separate Code Mode experiment's status. |
| Containers | The Free pricing row is N/A; included runtime allocations belong to Workers Paid. Workers and Durable Objects usage is also charged when using Containers. [Pricing][containers-pricing]. | Excluded by the Workers Free requirement. |

Static asset requests that bypass the Worker are free and unlimited. With `run_worker_first`, matching requests invoke the Worker and consume its allowance. The asset docs specify HTTP 429 when that Free allowance is exhausted, rather than fallback asset delivery. The current configuration has `run_worker_first: true`. Any savings from routing changes would require traffic and access-control analysis; none was measured. [Asset billing][assets], [configuration](../../wrangler.jsonc).

## 3. Durable Object reliability, expiry, and quota failures

### Stored records and dashboard access have separate lifetimes

The storage API is transactional and strongly consistent within one object. `transactionSync()` rolls back if its callback throws. Default output gates hold outgoing network messages until prior storage writes are confirmed; if those writes fail, the object resets and clients receive errors. These properties support one-use approval claims. They do not form a distributed transaction with GitHub. [Storage API][do-storage].

Hibernation discards in-memory state. Persisted state is the recovery source when an object starts again. Runtime/code updates can interrupt work, and shutdown hooks are not guaranteed or provided. A pending `fetch()`, RPC, open outbound connection, or timer can prevent hibernation. Keeping an object in memory is not required to preserve stored records. [Lifecycle][do-lifecycle].

The source inspected checks dashboard and approval `expiresAt` timestamps in application code. A proposal has no matching automatic expiration there. The SQLite storage API does not document a per-record TTL option for these methods. The implementation therefore needs explicit deadline checks and retention cleanup for the newly settled 30/90-day policy. Access expiry, approval expiry, proposal review expiry, and history deletion are separate events. [Approval source](../../src/patches.ts), [contracts](../../src/contracts.ts), [storage methods][do-storage].

**Implication for the chosen product behavior:** an authorized Access reviewer renews access to retained proposals/history. Renewal does not alter the reviewed diff or extend an approval. A new review of an unchanged proposal appends a separate approval decision. Acceptance must record the valid approval and submission attempt durably; later client disconnection or expiry of that already-consumed approval must not turn continuation of the same accepted attempt into a new submission. Uncertain attempts remain outside normal deletion until resolved. These are consequences of the settled requirements, not evidence that current source already satisfies them.

### Failure behavior that is documented

| Failure boundary | Documented behavior | Practical consequence |
| --- | --- | --- |
| Durable Object daily Free requests, duration, row reads, or row writes | Further operations of the exceeded type fail with an error; daily budgets reset at 00:00 UTC. [Pricing][do-pricing]. | The service must not equate a failed storage operation with successful approval or successful renewal. The docs describe rejected operations, not eviction of old proposals to make room. |
| Per-object SQLite storage full | Writes fail with `SQLITE_FULL`; reads and deletes continue so space can be recovered. [Limits FAQ][do-limits]. | This differs from a daily row-write quota failure. The fact that deletes work when storage is full does not promise that deletes bypass a daily write quota. Deletes count as rows written. [Pricing][do-pricing]. |
| Transaction callback throws | `transactionSync()` rolls the transaction back. [Storage API][do-storage]. | A failed atomic claim need not create a half-updated local approval record. GitHub side effects remain outside this boundary. |
| GitHub call succeeds remotely but its response or later local update fails | Cloudflare provides no cross-service transaction in these APIs. The current source persists `unknown` before starting GitHub work. | Resume the same durable attempt and reconcile its branch/PR. A retry is valid only when it cannot create a second PR or change the reviewed diff. A lost response is not proof that the write failed. [Source](../../src/patches.ts), [Workflow idempotency rules][workflow-rules], [GitHub PR API][github-pulls]. |
| Alarm handler throws | At-least-once delivery; exponential backoff from two seconds, up to six retries. A long outage can exhaust retries unless a new alarm is explicitly scheduled. [Alarms][do-alarms]. | An alarm is not an indefinite retry guarantee, exact-once execution, or a renewal/history policy. |

The docs do not promise that Free-plan quota exhaustion deletes stored history. They also do not prove the deployed application recovers correctly from every failure. That needs a separate functional check of the implemented flow. Stored history remains subject to deliberate deletion, namespace migrations, restores, and application policy.

### Alarm costs and scheduling details

Each `setAlarm()` counts as one row written. Alarm invocations count toward Durable Object requests. There is one pending alarm per object; setting another replaces it. Multiple due tasks can be stored and dispatched by that single alarm, but that requires application scheduling logic. Alarms can be delayed by maintenance or failover, and the storage API describes delays up to a minute. [Pricing][do-pricing], [alarms][do-alarms], [storage API][do-storage].

For this workload, submission progress and 30/90-day retention cleanup are confirmed alarm use cases. One alarm must select the earliest due submission/recovery or retention task from persistent state. Setting a distant cleanup alarm must not replace an earlier submission wake-up. A constructor must not overwrite an existing alarm; during an active handler, `getAlarm()` can be `null`, so pending tasks must remain authoritative in storage. [Alarms][do-alarms].

Deleting an expired dashboard capability must preserve its proposals and decision history. Cleanup must skip unresolved submission attempts, use bounded batches, and preserve submission identity against replay. It must not call `deleteAll()` on the shared coordinator: that removes all SQL/KV data and, at this project's compatibility date, its alarm too. [Storage API][do-storage], [configuration](../../wrangler.jsonc).

## 4. FTS5 as a possible search baseline

Cloudflare explicitly lists the SQLite FTS5 module, including `fts5vocab`, as supported in Durable Objects. This is a native platform capability; this research did not find a need for an added search dependency to test it. [SQL API][do-storage].

SQLite's own FTS5 reference documents:

- Full-text `MATCH` queries with phrases, prefixes, Boolean expressions, and proximity. The query has its own syntax, so arbitrary user punctuation is not automatically a valid literal query. [Query syntax][fts-syntax].
- A built-in `bm25()` relevance function with optional column weights. Better matches have **smaller** numeric scores. These scores are not cosine similarity scores. [BM25][fts-bm25].
- A `unicode61` tokenizer with configurable token characters and diacritic handling. Its default diacritic mode has a documented exception for characters containing multiple diacritics; mode `2` addresses that exception. This matters if Vietnamese queries or content become part of the evaluation. [Tokenizer][fts-tokenizer].

FTS5 could therefore supply a lexical baseline with exact term evidence, without an embedding inference request for that lexical query. That statement does not establish equivalent semantic recall. The current handwritten lexical scorer already runs without remote inference when evaluated in isolation; production `searchAi()` currently obtains an embedding before ranking and has no independent lexical fallback. [Search source](../../src/search.ts).

An FTS5 query would execute within a Durable Object and require access to an initialized index. Moving catalog lookup there introduces an object call compared with the current bundled lookup. SQLite queries are synchronous, and Cloudflare warns that expensive SQL queries can block other work in a shared isolate. Native SQL does not imply zero CPU or zero end-to-end latency. [Storage API][do-storage], [architecture guidance][do-architecture].

Writes to virtual tables and secondary indexes count toward SQL row-write usage. The final `SqlStorageCursor.rowsRead` and `rowsWritten` values expose measured SQL work after the cursor is consumed; `sql.databaseSize` exposes database bytes. The number of FTS internal writes must be measured. One indexed document must not be budgeted as exactly one written row. [Storage API][do-storage].

No FTS5 index or benchmark was created. Unknowns include recall@5 against the same labeled tasks, tokenization behavior for rule IDs and package names, index bytes, rows per query/update, object-call latency, cold starts, and total CPU. For 29 entries, documentation alone does not show that FTS5 would improve the current implementation.

## 5. Network wait, CPU, and retrieval costs

### CPU and end-to-end time measure different work

Workers CPU excludes time waiting on `fetch()`, KV, and database I/O. HTTP requests have no fixed wall-time limit while the caller remains connected, but disconnects can cancel work; `waitUntil()` extends execution for at most 30 seconds after response/disconnect. Cron invocations and alarm handlers have a 15-minute wall-time limit. These are not increases to the ordinary Worker's 10 ms Free CPU budget. [Workers limits][workers-limits].

The general Workers limits page documents error `1027` after the daily request cap and error `1102` for exceeded CPU or memory. The static asset page separately documents HTTP 429 for Free requests that invoke the Worker through `run_worker_first`. These should not be collapsed into one assumed error response. [Workers limits][workers-limits], [asset billing][assets].

Authentication, hashing, JSON parsing/serialization, vector decoding, cosine loops, lexical scoring, and response construction still execute locally. Seven sequential GitHub requests can have low CPU but high wall time. Likewise, a slow embedding service can dominate search latency without consuming the entire wait as Worker CPU. These are runtime implications of the source and documented metering, not performance measurements.

A Durable Object's duration allocation is different: time spent active or unable to hibernate consumes GB-s. In particular, pending outbound I/O keeps it in memory and incurs duration usage. The pricing/lifecycle pages make this explicit, despite loose wording about I/O and “compute consumption” in the limits FAQ. [Pricing][do-pricing], [lifecycle][do-lifecycle], [limits FAQ][do-limits].

**Illustrative arithmetic:** using the pricing page's 128 MB = 0.128 GB example, one object active for all 86,400 seconds of a day consumes 11,059.2 GB-s, about 85% of the 13,000 GB-s Free daily allocation. Two such objects exceed it. An idle object eligible for hibernation does not accrue duration. This is why a permanently active timer can be materially different from stored state plus an alarm. It is not a measurement of `ApprovalStore`.

### EmbeddingGemma 2

The current model supports 128, 256, 512, or 768 output dimensions; 768 is the default. Query and document dimensions must match. It supports base64-encoded little-endian float32 output and an 8,192-token context. The model page recommends distinct retrieval prefixes for queries and documents, which the current source uses. [Model documentation][embedding-model], [builder](../../scripts/build-catalog.ts), [search](../../src/search.ts).

Current pricing is **154 Neurons per million input tokens**, or $0.0017 per million input tokens. This model is not in the pricing page's paid-billing-only model list. [Workers AI pricing][ai-pricing].

**Illustrative budget:** 1,000 queries/day at an assumed 200 input tokens each use 200,000 input tokens/day. At the published conversion, that is 30.8 Neurons/day, or 0.308% of the 10,000-Neuron allocation. This excludes document rebuilds and other models/projects. Actual token counts, minimum metering/rounding, retries, throughput, and latency were not measured. The large apparent allowance does not prove a latency benefit.

### Vectorize

The catalog's 29 × 256 dimensions would occupy **7,424 stored dimensions**, about 0.1485% of the five-million Free stored-dimension allocation. The documented pricing calculation includes inserted/stored vectors in queried-dimension accounting. Using its one-load formula, 30,000 queries/month plus 29 vectors at 256 dimensions is **7,687,424 queried dimensions**, about 25.6% of the 30-million allocation. Repeated ingest/upsert activity needs its own accounting. [Pricing definition and examples][vectorize-pricing].

Vectorize stores vectors and performs similarity search; embeddings are generated separately. It does not eliminate the Workers AI query request. With only 29 vectors, there is no measured CPU or latency saving that justifies an additional index. A managed vector index and a local exact comparison are alternative mechanisms whose relevance must be established by quality and runtime results. [Vectorize introduction][vectorize-intro], [current search](../../src/search.ts).

### Caching

The Cache API can return misses and does not replicate entries between data centers. `put()` resolves without guaranteeing the entry was stored. The docs explicitly support functional cache operations on custom domains, exclude dashboard/playground previews, and say the API is unavailable for Workers fronted by Cloudflare Access. The current URL is on `workers.dev`, and Access is used as upstream identity. These facts do not prove that the Worker is Access-fronted, nor do they verify cache effectiveness on its exact route. [Cache API][cache], [configuration](../../wrangler.jsonc).

AI Gateway caching is disabled by default, uses identical request inputs by default, and is volatile. The caching page currently says text and image responses are supported; it does not specifically establish this embedding model's cache behavior. Cache hit/miss evidence and a repeat-query rate are needed before assigning savings. It is not semantic caching. [Gateway caching][gateway-cache].

Inference: cache keys for ranked results would need to distinguish rule catalog versions; keys for embedding reuse would need to distinguish the model, dimensions, and embedding input. Cache eviction must not change approval correctness. None of these observations selects a cache implementation.

## 6. Durable submission completion and retention

### DO alarms compared with Workflows

Both mechanisms now address a confirmed requirement. Cloudflare documents alarms as a way to finish operations without incoming requests, and Workflows as durable multi-step execution with saved state and retries. An HTTP promise or `waitUntil()` alone does not replace either persisted execution mechanism. [Alarms][do-alarms], [Workflows overview][workflows-overview], [Workers limits][workers-limits].

| Concern | Persistent runner in the existing SQLite DO, driven by alarms | Workflows steps, with application history in the DO |
| --- | --- | --- |
| Accept work independently of the client | Commit the approval claim, stable attempt identity, pending phase, and next wake-up before reporting acceptance. Alarm state follows Storage API transaction rules. External HTTP calls stay outside that transaction. [Storage][do-storage], [alarms][do-alarms]. | `create({ id, params })` starts an independent instance; `get(id)` retrieves it. Creating the Workflow and committing the DO's approval/job are separate service operations, so interrupted dispatch still needs a persistent intent and repair path. [Workers API][workflow-api]. |
| Preserve progress through interruption | Store small phase results and GitHub identities after each bounded unit. A restarted alarm begins again; the application must use stored state to resume or reconcile. [Alarms][do-alarms], [lifecycle][do-lifecycle]. | `step.do()` saves serializable output, and completed steps can be reused after infrastructure failure. Use deterministic step names and small results such as SHAs and PR identity. Side effects outside steps may repeat. [API][workflow-api], [rules][workflow-rules-all]. |
| At-least-once behavior | Only one alarm handler runs at a time per object, but it can run again after failure. Its external effects need application idempotency. An in-memory flag is insufficient. [Alarms][do-alarms]. | Steps may retry after a remote write committed but its result was lost. Cloudflare explicitly requires care with idempotent external API calls. Saved step results do not make an unconfirmed external write atomic. [Rules][workflow-rules]. |
| Retry controls | Six automatic retries, backoff beginning at two seconds. Expected transient failures need a persisted next attempt and a new alarm within a bounded application retry policy. Exhausting automatic retries can leave no future wake. [Alarms][do-alarms]. | Default: five retries, ten-second exponential delay, ten-minute timeout per attempt; configurable up to 10,000 retries/step. Exhausted or uncaught errors end the instance as errored. `NonRetryableError` stops retrying permanent failures. Defaults must not be applied blindly to `POST /pulls`. [Retry API][workflow-retries]. |
| CPU and network limits | The front Worker has 10 ms Free CPU. DO CPU wording conflicts, as recorded in section 7. Small phase invocations avoid assuming seven calls' parsing/hashing work fits one CPU budget. Alarm wall time is 15 minutes; network wait still consumes active DO duration. [Workers limits][workers-limits], [DO pricing][do-pricing]. | Limits say 10 ms compute/step and unlimited wall time/step; pricing says 10 ms/invocation. Do not infer a confirmed 70 ms Free CPU allowance from seven steps. The limits table lists 50 external subrequests per instance; budget checks, retries, and pagination as well as the baseline seven calls. [Limits][workflows-limits], [pricing][workflows-pricing]. |
| Free capacity | 100,000 requests/day including alarms; 13,000 GB-s/day; five million rows read/day; 100,000 rows written/day. Progress records, `setAlarm()`, history, and deletes use this budget. [Pricing][do-pricing]. | 3,000 steps/day, 1,024 steps/instance, 1 GB-month storage, 100 executing instances/account, and shared Workers requests. Pricing says step counts exclude retries and rollback handlers; retries still use network/CPU and time. [Pricing][workflows-pricing], [limits][workflows-limits]. |
| Required 30/90-day retention | Application deadlines and a bounded sweep can share the object and its one alarm with submission work. Uncertain attempts are excluded from normal deletion. [Storage][do-storage], [alarms][do-alarms]. | Three-day completed-state retention cannot provide 90-day application history. Keep history and submission identity outside the Workflow. Cleanup can use a DO alarm, a scheduled sweep, or a separate sleeping Workflow. Sleeping can last up to 365 days and does not occupy execution concurrency while waiting, but stored state still consumes the Workflow storage budget. [API][workflow-api], [limits][workflows-limits], [pricing][workflows-pricing]. |
| Repeat requests and IDs | Persist the proposal/request mapping and submission result. Repeated calls return that record and do not claim a second approval or enqueue a second logical submission. This is application behavior built on DO transactions. [Storage][do-storage]. | A duplicate `create` ID is rejected only while that instance exists within retention. After retention, the ID can be used again. `restart()` can erase intermediate state and rerun writes; it is not a repeat-request handler. The durable DO result remains necessary. [Workers API][workflow-api], [restart behavior][workflow-trigger]. |
| Deployments | Default DO code updates defer for up to 300 seconds, then reset; deferral is best effort. Persist phase/schema versions and reconcile outstanding external effects on restart. No shutdown hook completes the job for you. [Code updates][do-code-updates], [lifecycle][do-lifecycle]. | Infrastructure restart recovery is documented through step state. The API pages reviewed do not establish a general code-version pinning or step-schema migration guarantee for this application. Stable step names/output contracts and a deployment-interruption check remain necessary. [Rules][workflow-rules-all], [API][workflow-api]. |
| Additional integration | Adds a small application state machine and scheduler to an existing store. The team owns phase recovery, scheduling correctness, and observability. | Removes some custom step-checkpoint/retry machinery and adds managed execution visibility. Adds a Workflow definition/binding, dispatch/result handoff, separate execution retention, and the same GitHub reconciliation logic. [Overview][workflows-overview], [API][workflow-api]. |

**Illustrative Workflow budget:** seven steps alone permit at most `floor(3,000 / 7) = 428` successful instances/day if no other steps use the allocation. A ten-step path would permit 300/day under that same assumption. Drift checks, reconciliation, final DO writes, and explicit recovery-loop steps change the count. This arithmetic does not estimate actual team volume, remaining account quota, or production capacity. It is not a reason by itself to reject Workflows for a small team.

### GitHub reconciliation is required with either engine

The baseline sequence is: read base ref; create blob; read base tree; create tree; create commit; create branch ref; create draft PR. New checks/recovery add requests. The GitHub contents API can read the target at a specific commit/branch via `ref`; compare the reviewed original against the chosen base commit rather than rejecting every unrelated `main` commit. A changed target requires refreshed review under the settled policy. [Current source](../../src/submission.ts), [contents API][github-content].

Persist one stable proposal/attempt mapping, branch identity, reviewed-content digest, and any known commit/PR identities. A recovery pass must establish that a found branch/PR belongs to that proposal and expected reviewed change, not merely accept a matching title or any branch with a similar prefix. The refs API reads an exact ref; the PR list API supports `head=OWNER:BRANCH`, `base`, and `state=all`, with pagination. Searching all states avoids creating another PR because the original was already closed in GitHub before its local result was saved. This is bounded submission reconciliation, not ongoing merge/close/conflict tracking. [Refs API][github-refs], [PR API][github-pulls].

GitHub's create-PR API has no documented idempotency-key parameter, and its general guidance says conditional requests for unsafe methods such as POST are unsupported unless stated otherwise. Therefore a timed-out POST plus one empty list response does **not** prove that creating another PR is safe. Persist write intent before sending, serialize local ownership, recover existing branch/PR outcomes, and retain uncertainty when evidence cannot rule out an earlier accepted write. A local lease or generation fence protects local state; it does not fence an older in-flight request at GitHub. Exactly one PR is an application invariant requiring fault-path evidence, not a platform promise supplied by either engine. [PR API][github-pulls], [GitHub guidance][github-practices], [Workflow idempotency rules][workflow-rules].

Classify failures: permanent authorization/validation or target drift does not get the same retry as a network failure or rate limit. GitHub directs clients to honor `retry-after` and `x-ratelimit-reset` and use bounded backoff for secondary rate limits. A 422 alone does not prove an existing matching PR; read back and verify. Store the terminal result when known and stop GitHub reconciliation. [PR/refs status codes][github-pulls], [refs API][github-refs], [retry guidance][github-practices].

### Minimal recommendation for the confirmed requirements

**Extend the existing SQLite `ApprovalStore` with a persistent submission runner and a shared alarm for progress, recovery, and retention. Add one small independent scheduled repair pass for unattended recovery after alarm exhaustion or failed rearming, unless an equivalent independent repair mechanism already exists.** Workflows is a valid alternative, but it does not remove the existing DO/history requirement or GitHub recovery work. For this bounded seven-call baseline, the DO approach uses one authoritative state store and one scheduler for both newly required jobs. This is a recommendation based on current scope, not a claim of measured CPU compliance or a deployed change.

The minimum behavior is:

1. **Accept durably and repeatably.** Validate the current approval and bind the attempt to its recorded reviewer, unchanged diff, target, and stable proposal/request identity. Atomically persist the claim, job intent/progress, and wake-up before acknowledging acceptance. Use an appropriate Storage API transaction; `transactionSync()` callbacks cannot await asynchronous APIs. Do not perform GitHub HTTP work inside a storage transaction. A repeated request returns the same recorded proposal/attempt/result.
2. **Advance in bounded phases.** Let the alarm execute a small amount of due work, checkpoint small results, and schedule the next phase. Start with at most one GitHub mutation per phase; bound reads, response sizes, timeouts, and recovery lookups too. Reconcile an uncertain phase before another mutation. Do not run all seven calls again from phase zero or treat a consumed approval as fresh authorization.
3. **Use one due-task schedule.** Select the earliest submission phase, recovery deadline, or retention deadline. Recompute it from persistent state after progress; do not let cleanup replace an earlier retry. Avoid a perpetual `setInterval` or a promise sleeping in memory. The object can hibernate between alarms. [Alarms][do-alarms], [lifecycle][do-lifecycle].
4. **Enforce retention separately from access.** Check the 30-day review deadline on access/decision, preserve decision history through reapproval, retain final history for 90 days, and exclude every unresolved attempt from normal cleanup. Sweep only bounded due records and associated indexes/capabilities. Preserve enough submission identity/result information to prevent accepted replays from creating another PR when history payloads are deleted. Do not wipe the shared coordinator.
5. **Repair lost wake-ups independently.** An hourly Cron is one concrete small option: 24 scheduled invocations/day, plus the DO calls it makes, using one of the five Free account triggers. It checks bounded local due state and repairs the next alarm/cleanup task; it does not poll GitHub when no uncertain attempt exists, and never tracks a known PR's later status. Verify available trigger/request budget before configuring it. [Cron][cron], [Workers limits][workers-limits].

The independent repair is justified by a real failure boundary: alarm retries stop after six, and failed storage/rearm operations are possible on Free. The docs do not promise that a pending application job automatically wakes after a daily quota reset. A later Cron pass can attempt repair when capacity is available; it cannot provide availability while the same account's relevant quotas remain exhausted. No finite Free allocation guarantees completion during a permanent downstream outage.

If Workflows is selected instead, use a deterministic instance ID backed by the durable proposal record, small named steps, explicit retry classification, and a final step that records the submission result in the DO. Keep a durable dispatch intent so a crash between the DO claim and `Workflow.create()` does not strand accepted work. Repeated requests must consult the existing result/instance, not call `restart()`. Retention cleanup and unknown-attempt preservation still need an application-owned mechanism. [API][workflow-api], [retry controls][workflow-retries], [idempotency][workflow-rules].

### Other services and the closed sync scope

Successful catalog build/deployment remains the publication boundary; no live catalog store or runtime refresh loop is required. The builder's source digest identifies router paths and source bodies; a separate artifact digest identifies the generated catalog bytes. Failed deployment leaves the prior served version. [Builder](../../scripts/build-catalog.ts), [deployment workflow](../../../.github/workflows/deploy-agent-rules-mcp.yml).

Queues, D1, R2, Vectorize, AI Gateway, and Email Sending do not gain a demonstrated adoption case merely because submission is now asynchronous. The DO already provides the required authoritative store; a Queue has 24-hour Free retention and duplicate delivery, and a Workflow or DO runner can schedule its own work. Search/index/cache changes remain subject to retrieval and runtime evidence. Existing telemetry or optional Analytics Engine can report runner failures and age of due work, but sampled telemetry cannot replace exact history. [Queues][queues-pricing], [delivery guarantees][queue-delivery], [Analytics Engine writes][analytics-start], [sampling][analytics-sampling].

Analytics/logging has a near-term change: new AI Gateway accounts currently follow the 200,000 Worker log events/day, three-day retention regime. On **2026-12-01**, the shared Observability Free allocation becomes **0.5 GB/day ingestion with seven-day retention**. Ingestion stops at that daily limit and resumes at 00:00 UTC; existing data stays queryable until retention ends. Workers Logs and newer AI Gateway logs share that allowance. [Current Workers pricing][workers-pricing], [upcoming Observability pricing][observability].

## 7. Conflicting or incomplete official evidence

| Topic | Exact evidence | What remains uncertain |
| --- | --- | --- |
| Vectorize on Free | The [product introduction][vectorize-intro] says “available to all users on the Workers Free or Paid plans.” Product pricing and limits contain explicit Free allocations. The [general Workers pricing][workers-pricing] page still says “currently only available on the Workers paid plan.” | Product-specific docs establish documented Free availability, but account provisioning was not tested. The contradictory general sentence should not be silently repeated as a Paid-only rule. |
| Free storage per Durable Object | The [limits table][do-limits] lists 10 GB/object with a 5 GB Free account footnote. Its storage-full FAQ explicitly says **1 GB on Free** and 10 GB on Paid. | Exact current per-object Free enforcement is not consistent across that page. Capacity estimates can conservatively use 1 GB/object while preserving the confirmed 5 GB account cap. This catalog is far below either figure. |
| Durable Object CPU on Free | The [DO limits table][do-limits] gives a 30-second default, up to five minutes. The same page says DOs have the same per-invocation plan limits as Workers, whose [Free table][workers-limits] is 10 ms. | The text does not unambiguously reconcile these claims for Free. Do not promise that moving ranking to a DO grants a confirmed larger Free CPU budget. No enforcement probe was run. |
| Workflows CPU wording | [Pricing][workflows-pricing] says 10 ms/invocation; [limits][workflows-limits] says 10 ms/step and defines a new instance as the request-counting invocation. | Report both units. Neither supports a claim that Free Workflows allow unbounded active computation. |
| Queue consumer CPU wording | [Queue limits][queues-limits] describes configurable five-minute CPU and a generic 30-second default, while also linking shared Workers per-plan limits. | Free Worker CPU should not be assumed to inherit Paid limits from that generic paragraph. |
| Exact quota error behavior | DO, KV, D1, and Workers AI product docs describe Free failures. Vectorize/Queues pages checked do not specify every error code and state transition after daily/monthly exhaustion. Workflow pricing explicitly describes storage-limit errors and a 3,000-step/day Free allocation. | The reviewed pages do not specify every automatic-resume behavior after the daily Workflow step allocation or DO budget is exhausted. Do not assume UTC reset restarts a stopped job/errored Workflow, invent an HTTP status, or equate a billable R2 allowance with a Workers Free cap. |
| Cache availability/effectiveness for this deployment | Runtime docs contain custom-domain, Access-fronting, and preview restrictions. [Cache API][cache]. | No cache hit/expiry behavior was tested on this `workers.dev` deployment. |

D1's documented Free daily read or write exhaustion stops queries and returns errors until reset; total storage exhaustion blocks further inserts/schema/index changes until data is removed. KV operations of the exceeded type fail; Workers AI inference fails past its daily Neuron budget. These are real availability boundaries even when a plan has no overage billing. [D1][d1-pricing], [KV][kv-pricing], [Workers AI][ai-pricing].

## 8. Engineering risks and required evidence

Reviewer authority/identity, 30/90-day retention, 24-hour reapproval, rejection of target-file drift, repeatable results, independent completion, one PR per proposal, and bounded submission reconciliation are settled. The user selected the existing DO with alarms and one hourly repair Cron. Local semantic search remains, with bounded caching and explicit lexical fallback; FTS5 and Vectorize are deferred. PR-status sync and live catalog refresh remain excluded. The following evidence requirements do not reopen those decisions.

| Remaining issue | Evidence or implementation detail still required |
| --- | --- |
| Retrieval quality and AI failure behavior | Check existing required recall and clearly label lexical fallback during inference failure. No FTS5 or Vectorize benchmark is required for the deferred services. |
| Searchable content | Preserve the existing retrieval scope and test semantic/fallback behavior separately. This change does not broaden the searchable corpus. |
| Stable request/proposal identity | Scope idempotency to the authorized caller/repository and exact reviewed input. Concurrent or repeated calls must locate the original record, including after a lost response. A collision must not disclose another reviewer's data or create another logical submission. |
| Proof of safe GitHub recovery | Verify exact branch provenance, expected reviewed change, matching PR identity, all PR states, and pagination. A stale/empty read, authorization failure, or an expired local lease is not proof that an earlier POST did not commit. The API has no documented create-PR idempotency-key contract. [GitHub APIs][github-pulls], [guidance][github-practices]. |
| Concurrent target-file changes | The contents API can read a pinned commit; PR creation takes a base branch name, not an expected base-head SHA. Establish how checks handle `main` moving between target verification and PR creation. Do not claim those separate operations are atomic or invalidate an unchanged target solely because an unrelated commit exists. [Contents][github-content], [PR creation][github-pulls]. |
| Approval and acceptance boundary | Check the 24-hour approval when accepting new work. Replayed continuation of an accepted attempt must preserve its consumed approval and reviewed digest. A fresh approval of an unchanged proposal must append history instead of rewriting the earlier reviewer decision. |
| Retention without replay resurrection | Implement exact deadline anchors, bounded due-record selection, and preservation of every unresolved attempt. Keep submission/result identity sufficient for the supported replay path when deleting 90-day history payloads. Do not recreate a formerly submitted proposal or infer that no PR exists because its local history body was purged. |
| One alarm, interrupted work, and lost wake-ups | Test submission/cleanup deadline arbitration, concurrent new work, constructor behavior, a crash after GitHub acceptance, and rearm failure. The scheduled repair pass needs available Free trigger/request budget and must repair local due work without resuming known PR-status tracking. |
| Quota and retry budgets | Measure phase CPU, DO duration, history bytes, SQL rows, GitHub response sizes and rate-limit behavior. Choose bounded per-run work, network timeouts, and backoff. The catalog's small size does not bound 30/90-day proposal history or indefinite uncertain-attempt storage. Remaining account budget is unknown. |
| Deployment compatibility | A new DO version must read stored phase/history data left by an older version. Test interruption before/after each external mutation and final local write. Workflow step names and output shapes would also require stable replay contracts if that option is used. Default DO update deferral is not a completion guarantee. [Code updates][do-code-updates]. |
| Observable recovery failures | Persist attempt progress and results when storage permits, expose overdue/blocked/uncertain work, and keep exact history separate from sampled telemetry. Automatic retry exhaustion and quota denial must not be reported as successful completion. |

Fault-path checks must cover concurrent submissions, response loss, client disconnects, deployment interruption, exhausted alarm/step retries, cleanup near deadlines, and a failed final result write. Until those checks exist, neither a DO alarm nor a Workflow is proof of one-PR completion. These can be checked against controlled GitHub responses without production writes; no such implementation test was run in this research.

## 9. Measurement gaps

This investigation verified documentation and counted local artifacts. Supplemental read-only checks confirmed Workers Free as the current account plan and zero existing Cron triggers across its one Worker, leaving room for the selected repair trigger. The active deployment predates the branch's Durable Object binding. A paginated legacy-key inventory found one proposal, one expiring approval, and no dashboard records; migration is required.

One authenticated search completed in 1,444 ms as measured around the connected tool call. That single wall-time observation includes transport and authentication; it is not Worker CPU, an inference-only measurement, or a production benchmark.

Remaining account quota usage, Vectorize provisioning, a live propose/approve/apply cycle, reviewer identity/renewal implementation, a submission runner or retention sweep, production CPU, latency distributions, cache hit rate, and FTS5 behavior remain unmeasured. Deferred-service provisioning and FTS5 results are not release prerequisites for the selected design.

Useful follow-up evidence would separate:

1. Worker CPU from end-to-end wall time for authenticated search, metadata, exact retrieval, dashboard access, renewal, and apply.
2. Workers AI token/Neuron usage and latency from local vector/lexical ranking.
3. Durable Object request count, active GB-s, history/job database bytes, SQL rows read/written, and alarm/repair invocations. Account for optional FTS5 work separately.
4. The deployed catalog's source digest from current repository head. Under the user's decision, a newer repository commit alone is not a live refresh failure.
5. Persisted proposal/history continuity, 30/90-day cleanup, 24-hour approvals, and uncertain-attempt protection from access-token lifetime and external-write recovery.
6. If Workflows is used, actual steps/instance and steps/day, retained execution bytes, total subrequests across retries/reconciliation, and completed/errored instance expiry versus the external DO history/result.

These are evidence boundaries, not an instruction to deploy a feature or run production writes.

## Sources

All linked web sources are primary documentation from Cloudflare, GitHub, or SQLite. URLs were read during this research on 2026-11-25. GitHub endpoint pages were read through GitHub's official article-body API. Local source links document branch observations and do not establish deployed behavior.

- Workers: [limits][workers-limits], [pricing][workers-pricing], [asset billing][assets].
- Durable Objects: [pricing][do-pricing], [limits][do-limits], [storage API][do-storage], [alarms][do-alarms], [lifecycle][do-lifecycle], [code updates][do-code-updates], [shared-isolate guidance][do-architecture].
- Workers KV: [pricing][kv-pricing], [limits][kv-limits], [consistency][kv-consistency].
- Background execution: [Cron][cron], [Workflows overview][workflows-overview], [Workers API][workflow-api], [retry controls][workflow-retries], [trigger/restart behavior][workflow-trigger], [Workflow pricing][workflows-pricing], [Workflow limits][workflows-limits], [rules][workflow-rules-all], [idempotency][workflow-rules], [Queue pricing][queues-pricing], [Queue limits][queues-limits], [delivery guarantees][queue-delivery].
- GitHub: [PR list/create API][github-pulls], [refs API][github-refs], [contents API][github-content], [request/retry guidance][github-practices].
- Retrieval: [Vectorize introduction][vectorize-intro], [pricing][vectorize-pricing], [limits][vectorize-limits], [Workers AI pricing][ai-pricing], [AI limits][ai-limits], [EmbeddingGemma 2][embedding-model].
- Caching: [Cache API][cache], [AI Gateway caching][gateway-cache].
- Observability: [Analytics Engine pricing][analytics-pricing], [limits][analytics-limits], [writes][analytics-start], [sampling][analytics-sampling], [upcoming log pricing][observability].
- Other storage: [R2 pricing][r2-pricing], [subscription setup][r2-start], [D1 pricing][d1-pricing], [limits][d1-limits].
- AI Gateway: [pricing][gateway-pricing], [limits][gateway-limits].
- Email: [pricing][email-pricing], [limits][email-limits], [Free sending change][email-change].
- Paid-only runtime products: [Dynamic Workers][dynamic-pricing], [Containers][containers-pricing].
- SQLite FTS5: [query syntax][fts-syntax], [BM25][fts-bm25], [Unicode tokenizer][fts-tokenizer].

[workers-limits]: https://developers.cloudflare.com/workers/platform/limits/
[workers-pricing]: https://developers.cloudflare.com/workers/platform/pricing/
[assets]: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
[do-pricing]: https://developers.cloudflare.com/durable-objects/platform/pricing/
[do-limits]: https://developers.cloudflare.com/durable-objects/platform/limits/
[do-storage]: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
[do-alarms]: https://developers.cloudflare.com/durable-objects/api/alarms/
[do-lifecycle]: https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
[do-code-updates]: https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/
[do-architecture]: https://developers.cloudflare.com/durable-objects/best-practices/architecture-guidance/#shared-isolates
[kv-pricing]: https://developers.cloudflare.com/kv/platform/pricing/
[kv-limits]: https://developers.cloudflare.com/kv/platform/limits/
[kv-consistency]: https://developers.cloudflare.com/kv/concepts/how-kv-works/#consistency
[cron]: https://developers.cloudflare.com/workers/configuration/cron-triggers/
[workflows-pricing]: https://developers.cloudflare.com/workflows/reference/pricing/
[workflows-limits]: https://developers.cloudflare.com/workflows/reference/limits/
[workflows-overview]: https://developers.cloudflare.com/workflows/
[workflow-api]: https://developers.cloudflare.com/workflows/build/workers-api/
[workflow-retries]: https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/
[workflow-trigger]: https://developers.cloudflare.com/workflows/build/trigger-workflows/
[workflow-rules-all]: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
[workflow-rules]: https://developers.cloudflare.com/workflows/build/rules-of-workflows/#ensure-apibinding-calls-are-idempotent
[queues-pricing]: https://developers.cloudflare.com/queues/platform/pricing/
[queues-limits]: https://developers.cloudflare.com/queues/platform/limits/
[queue-delivery]: https://developers.cloudflare.com/queues/reference/delivery-guarantees/
[vectorize-intro]: https://developers.cloudflare.com/vectorize/get-started/intro/#prerequisites
[vectorize-pricing]: https://developers.cloudflare.com/vectorize/platform/pricing/
[vectorize-limits]: https://developers.cloudflare.com/vectorize/platform/limits/
[ai-pricing]: https://developers.cloudflare.com/workers-ai/platform/pricing/
[ai-limits]: https://developers.cloudflare.com/workers-ai/platform/limits/
[embedding-model]: https://developers.cloudflare.com/workers-ai/models/embeddinggemma-2/
[cache]: https://developers.cloudflare.com/workers/runtime-apis/cache/
[analytics-pricing]: https://developers.cloudflare.com/analytics/analytics-engine/pricing/
[analytics-limits]: https://developers.cloudflare.com/analytics/analytics-engine/limits/
[analytics-start]: https://developers.cloudflare.com/analytics/analytics-engine/get-started/#2-write-data-points-from-your-worker
[analytics-sampling]: https://developers.cloudflare.com/analytics/analytics-engine/sampling/
[r2-pricing]: https://developers.cloudflare.com/r2/pricing/
[r2-start]: https://developers.cloudflare.com/r2/get-started/
[d1-pricing]: https://developers.cloudflare.com/d1/platform/pricing/
[d1-limits]: https://developers.cloudflare.com/d1/platform/limits/
[gateway-pricing]: https://developers.cloudflare.com/ai-gateway/reference/pricing/
[gateway-limits]: https://developers.cloudflare.com/ai-gateway/reference/limits/
[gateway-cache]: https://developers.cloudflare.com/ai-gateway/features/caching/
[observability]: https://developers.cloudflare.com/observability/pricing/
[email-pricing]: https://developers.cloudflare.com/email-service/platform/pricing/
[email-limits]: https://developers.cloudflare.com/email-service/platform/limits/
[email-change]: https://developers.cloudflare.com/changelog/post/2026-11-24-email-sending-workers-free/
[dynamic-pricing]: https://developers.cloudflare.com/dynamic-workers/pricing/
[containers-pricing]: https://developers.cloudflare.com/containers/platform/pricing/
[fts-syntax]: https://www.sqlite.org/fts5.html#full_text_query_syntax
[fts-bm25]: https://www.sqlite.org/fts5.html#the_bm25_function
[fts-tokenizer]: https://www.sqlite.org/fts5.html#unicode61_tokenizer
[github-pulls]: https://docs.github.com/en/rest/pulls/pulls
[github-refs]: https://docs.github.com/en/rest/git/refs
[github-content]: https://docs.github.com/en/rest/repos/contents#get-repository-content
[github-practices]: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
