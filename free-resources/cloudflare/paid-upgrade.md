# Cloudflare $5 Paid Upgrades

**Verified:** 2026-11-25

Cloudflare has one $5 account subscription: **Workers Paid**. It also has several add-ons that start at $5/month. They are different purchases.

## 1. Workers Paid

- Cost: **$5 USD/month minimum** per account.
- Reset: Free daily limits still reset at 00:00 UTC. Paid monthly included allocation resets on the subscription renewal date.
- Egress: Workers has no bandwidth or egress charge.
- Zone plan: Workers Paid is separate from the zone plan. A Free zone stays a Free zone.

Workers Paid replaces the metered Free daily allocations with monthly included allocations. The two table columns are alternatives, not additions. R2 and Workers AI keep their own stated free allocations.

### 1.1 Compute

| Product | Workers Free comparison | Paid included allocation and rate after |
| --- | --- | --- |
| Workers requests | 100,000/day | 10M/month + $0.30/million |
| Workers CPU time | 10 ms/invocation | 30M CPU-ms/month + $0.02/million CPU-ms |
| Durable Objects requests | 100,000/day | 1M/month + $0.15/million |
| Durable Objects duration | 13,000 GB-s/day | 400,000 GB-s/month + $12.50/million GB-s |
| Durable Objects SQLite rows read | 5M/day | 25 billion/month + $0.001/million |
| Durable Objects SQLite rows written | 100,000/day | 50M/month + $1.00/million |
| Durable Objects SQLite storage | 5 GB | 5 GB-month + $0.20/GB-month |
| Workflows | 100,000 requests/day; 10 ms CPU/invocation; 1 GB storage | Workers Paid rates after included allocation |

Workers Paid raises the CPU limit. It allows up to 5 minutes per invocation, with 30 seconds as the default.

### 1.2 Storage and data

| Product | Workers Free comparison | Paid included allocation and rate after |
| --- | --- | --- |
| Workers KV reads | 100,000/day | 10M/month + $0.50/million |
| Workers KV writes, deletes, lists | 1,000/day each | 1M/month each + $5.00/million |
| Workers KV storage | 1 GB; 1,000 namespaces | 1 GB + $0.50/GB-month; first 1,000 namespaces + $0.10/additional/month |
| D1 rows read | 5M/day | First 25 billion/month + $0.001/million |
| D1 rows written | 100,000/day | First 50M/month + $1.00/million |
| D1 storage | 5 GB total | First 5 GB + $0.75/GB-month |
| D1 databases | 10 | First 100,000 + $0.10/additional/month |
| Hyperdrive queries | 100,000/day | Unlimited |
| R2 Standard storage | 10 GB-month/month | $0.015/GB-month |
| R2 Standard Class A operations | 1M/month | $4.50/million |
| R2 Standard Class B operations | 10M/month | $0.36/million |
| R2 Infrequent Access | Not on Free plan | $0.01/GB-month; $9.00/M Class A; $0.90/M Class B; $0.01/GB retrieval |
| Queues operations | 10,000/day | 1M/month + $0.40/million |
| Queues count | 10,000 | First 10,000 + $0.10/additional/month |
| Vectorize queried dimensions | 30M/month | 50M/month + $0.01/million |
| Vectorize stored dimensions | 5M | 10M + $0.05/100M |
| Vectorize indexes | 100 | First 50,000 + $0.10/additional/month |

R2 egress remains free for direct R2 access.

### 1.3 AI and media

| Product | Workers Free comparison | Paid included allocation and rate after |
| --- | --- | --- |
| Workers AI | 10,000 Neurons/day | Same 10,000/day free, then $0.011/1,000 Neurons |
| AI Gateway | 10 gateways; free core features | Paid gateway limits depend on logs and Unified Billing |
| Images transformations | 5,000/month | First 5,000 + $0.50/1,000 |
| Images storage | Not on Free plan | $5/100,000 images/month |
| Images delivery | Not on Free plan | $1/100,000 images/month |
| Browser Run | 10 minutes/day; 3 concurrent browsers | 10 hours/month + 10 concurrent browsers, then $0.09/hour + $2.00/browser |
| Stream | No free minutes | $5/1,000 minutes stored; $1/1,000 minutes delivered |

### 1.4 Observability

| Product | Workers Free comparison | Paid included allocation and rate after |
| --- | --- | --- |
| Workers Logs | 200,000 events/day; 3-day retention until 2026-12-01 | 20M events/month + $0.60/million; 7-day retention; pricing changes 2026-12-01 |
| Workers Analytics Engine data points | 100,000/day | 10M/month + $0.25/million |
| Workers Analytics Engine read queries | 10,000/day | 1M/month + $1.00/million |
| Workers Trace Events Logpush | Paid-only | 10M requests/month + $0.05/million |

### 1.5 Other included products

- Containers: 25 GiB-hours memory + $0.0000025/GiB-second; 375 vCPU-min + $0.000020/vCPU-second; 200 GB-hours disk + $0.00000007/GB-second.
- Workers Builds: no free build minutes; $0.005/minute.
- Durable Objects KV storage backend: Paid only. 1M read, write, and delete units each, plus 1 GB included.

## 2. Other $5 add-ons

These add-ons do not replace Workers Paid.

| Add-on | Starting price | What it does | Important limit or note |
| --- | --- | --- | --- |
| Smart Shield + Argo Smart Routing | $5/month | Optimized routes, Smart Routing, and Tiered Caching | Tiered Cache has a free option. Buy this for Argo and Smart Shield. |
| Load Balancing | $5/month | Global traffic rules, health checks, and failover | Price starts at $5/month. Final cost depends on configuration. |
| Stream | $5/month | Video storage, encoding, and playback | Pro and Business zone plans include 100 stored minutes and 10,000 delivered minutes. Free zone does not. |
| Automatic Platform Optimization (APO) | $5/month on Free zone | WordPress CDN and cache optimization | Included with Pro, Business, and Enterprise zone plans. |

Prices that also use $5 but are not subscriptions:

- Images storage: $5 per 100,000 images/month.
- Zaraz: $5 per additional 1,000,000 events/month after the free allocation.

## 3. What does not change

Workers Paid does not change these limits:

- REST API: 1,200 requests per 5 minutes; 200 requests/second per IP.
- GraphQL API: 300 queries per 5 minutes.
- Zero Trust: 50 users. The next tier is $7/user/month.
- DNS: 200 records for new Free zones; 1,000 for older Free zones; 3,500 for Pro and Business zones.
- Zone plan: A Free zone remains a Free zone.

Only Enterprise can ask Support for API rate-limit increases.

## 4. Caveats

For shared Durable Objects and Vectorize caveats, see [Free limits](./free-limits.md#6-notes-and-caveats).

1. **Workers Logpush conflict.** The Workers pricing page includes 10M requests/month. The general plans page shows no included amount. This document uses the Workers pricing page value.
2. **Analytics Engine billing.** Product docs say “Currently, you will not be billed.” The pricing page shows paid rates. Verify the invoice before you budget.
3. **Browser Run naming.** The current docs use Browser Run. The pricing page still uses Browser Rendering. The current docs include 10 hours/month and 10 concurrent browsers.
4. **Workers Logs change.** Observability pricing starts on 2026-12-01. The $0.60/million rate may not apply after that date.

## 5. Sources

- Workers pricing: <https://developers.cloudflare.com/workers/platform/pricing/>
- Workers limits: <https://developers.cloudflare.com/workers/platform/limits/>
- Workers AI pricing: <https://developers.cloudflare.com/workers-ai/platform/pricing/>
- Images pricing: <https://developers.cloudflare.com/images/pricing/>
- Analytics Engine pricing: <https://developers.cloudflare.com/analytics/analytics-engine/pricing/>
- Browser Run pricing: <https://developers.cloudflare.com/browser-run/pricing/>
- Compute and Storage pricing: <https://www.cloudflare.com/plans>
- Network and CDN pricing: <https://www.cloudflare.com/plans/network-cdn>
- Zero Trust pricing: <https://www.cloudflare.com/plans/sase-zero-trust>
- API limits: <https://developers.cloudflare.com/fundamentals/api/reference/limits/>
- DNS record limits: <https://developers.cloudflare.com/dns/manage-dns-records/>
