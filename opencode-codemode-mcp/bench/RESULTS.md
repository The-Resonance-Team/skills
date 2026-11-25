# Measurement results

Date: 2026-11-25. Workload: 5,000 generated records, filter and aggregate,
return one summary object. All runs returned `blocked: 715`, `groups: 11`,
`total: 356045`.

| Path | Wall time | Server CPU time | Response bytes | Approx. tokens |
| --- | --- | --- | --- | --- |
| Local Bun, direct call | 0.41 ms | 0.11 ms | 74 | 19 |
| Local workerd, warm MCP + sandbox path | 3.57 ms | 0 ms | 225 | 56 |
| Local workerd, cold MCP + sandbox path | 27.34 ms | 0.2 ms | 225 | 56 |
| Real Cloudflare Worker, plain isolate, median of 12 | 59.54 ms | 0 ms | 56 | 14 |

Range for the real Worker: 37.62 ms to 208.98 ms, average 70.62 ms. The first
calls include connection setup. The Cloudflare test Worker had no Dynamic
Worker binding, no workflow, and no Durable Object. It ran the same CPU workload
in a plain module Worker on the Workers Free account.

If the model receives the 5,000 raw records instead of the summary, that is
260,940 bytes or about 65,235 tokens. The sandbox summary is about 14 to 56
tokens. This is the main benefit of Code Mode for this workload. The cost is
extra wall time and extra infrastructure. We did not measure Cloudflare billing
cost, and we did not test Dynamic Workers because the account has no Workers
Paid plan.

The Cloudflare test Worker was named `codemode-bench-probe` in account
`8ed76430c66005e2fd7487ba441febee`. It was removed after measurement.
