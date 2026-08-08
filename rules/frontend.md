# Frontend Rules — web, portal, miniapp

Applies to browser clients in the organization (React/Next.js web apps, admin portals, mobile-web miniapps). Include this file for any frontend repo.

## Scope

Client-side standards: API consumption, uploads, styling. Backend-only repos should omit this file.

## API consumption (mandatory)

1. **Axios generic type parameter** — Declare response types via the generic parameter, never manual unwrap:

   ```ts
   const { data } = await api.get<MyType>("/endpoint");
   return data;
   ```

   NEVER write `data?.data as Type`. NEVER create duplicate `unwrap()` helpers — the interceptor handles the envelope.

2. **Native multipart helpers** — Use axios `postForm`/`putForm`/`patchForm` for uploads. Do NOT write a custom `toFormData` helper: native semantics skip undefined/null/empty, repeat `File` arrays per key, and match the server serializer.

## Styling (Tailwind v4)

3. **Check utility availability** — Tailwind v4 resized/renamed utilities. `max-w-sm` no longer exists; use `max-w-[24rem]`. When unsure, check AGENTS.md or the project's Tailwind config before using a utility.

## Barrel imports (mandatory)

4. **Barrels** — A folder with ≥2 non-test files (`components/`, `lib/`, `hooks/`, `features/`, ...) gets an `index.ts` `export *`-ing all members. New files added to a folder are added to its `index.ts` manually. Cross-folder imports go through the barrel (e.g. `@/components/ui`), never a deep file path. Imports **within the same folder** stay relative — never import the folder's own barrel (self-barrel cycles).
