# Fixtures & Seed Rules — one contract for dev, tests, and e2e

Applies to any repo with seed scripts, fixture generators, demo data, or a deterministic test database. Consumers without fixtures omit this file.

## Fixture code is code (mandatory)

1. **Typecheck the fixture and keep it out of the runtime build** — Put seed/fixture paths inside the repo's typecheck program (or a dedicated `tsconfig.seed.json` included by the root gate), and exclude them from `tsconfig.build.json`. A seed that only runs is a seed that drifts. The root gate must fail on a broken fixture.
2. **Import the production algorithm; never copy it** — Crypto envelopes, transfer-memo/ID formats, plan and price catalogs, embedding/model clients, storage disks, and status transitions come from the owning production module. If the fixture needs a deterministic variant, extract one pure function used by both. A copied algorithm makes the fixture lie.
3. **One model registry drives reset and idempotency** — Keep one ordered list of owned models in foreign-key-safe delete order. It feeds both the reset and the row-count check. Constrain the list to real client keys so a renamed model is a type error, and make a new model one row. Never keep a second count list.
4. **Deterministic generation is per domain** — Give each seed domain its own RNG instance, seeded from the domain name. A shared global sequence makes adding or reordering a domain change another domain's rows. Dates use one explicit timezone anchor (`TZDate`); never host-local `new Date()`/`setHours()` for fixture data. Test the anchor under `TZ=UTC`.
5. **One persona registry** — The seed and the e2e suite import the same account list (name, email, role, route, password). The seed's protected-account guard uses that list. Specs carry no email literals.
6. **Schema-coupled defaults have one registry and a write-time assertion** — Vector dimensions, model names, enum defaults, and plan prices live together. The fixture asserts the value's shape before insert (for example, the embedding length equals the column width), and the default model and endpoint come from the same pair.
7. **Destructive fixtures fail closed** — A seed that writes or deletes production-shaped data requires an explicit opt-in env var and a local-host check by default. Keep the guard a pure function with a negative test. An unreadable guard file is a failure, not a skip.
8. **Fixture copy follows the catalog** — Seed strings that users see obey `rules/i18n.md` #13. Display labels stay in the message catalog, never in a shared types package.

Completion criterion: a second run changes no owned row count, a fresh checkout's root gate typechecks the fixture, and the protected personas still sign in.
