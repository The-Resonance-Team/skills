# Test Determinism Rules — CI parity and stable assertions

Applies to repos where CI runs a test command under a pinned runtime version. Consumers without a CI test job omit this file.

## Runtime parity (mandatory)

1. **Run the gate with the CI-pinned runtime before push** — Use `npx -y bun@<pinned version> run verify` (or the Node version in `package.json#engines`), not the local binary. A local canary build hides stable-only failures. Completion: the gate passes under the same version CI installs. Precedent: Graveshift 2026-11 — local Bun canary passed 1336 tests; CI Bun 1.4.4 stable found four failures.

2. **Read failed CI checks before editing code** — Run `gh run view <id> --log-failed` and reproduce with the pinned runtime. Completion: each red check has a named root cause before a fix is written.

## Child processes (mandatory)

3. **Spawn test children with an env allowlist** — Pass `PATH` and the named boot variables only. Forwarding `process.env` leaks runner variables and secrets into the child and can stop boot. Completion: the child receives only listed names. Precedent: Graveshift 2026-11 — an MCP stdio smoke test exited in CI alone.

## Assertions (mandatory)

4. **Assert invariants, not incidental layout** — Exempt paths the runtime controls, such as the directory holding `process.execPath`, from checks that reject host-home paths. Completion: the assertion still rejects every other host-home path.

5. **Parse recorded call arguments with a schema before asserting** — Do not read a property after `toMatchObject` with `expect.stringContaining`; Bun 1.4.4 stable mutates the received value to `{}`. Completion: assertions read a parsed copy.

6. **Use `%#` in `test.each` titles when inputs hold BigInt or complex values** — `%j` calls `JSON.stringify` and throws an unhandled error between tests while every test still reports pass. Completion: the table runs with zero unhandled errors.
