# Claude Design to Next.js/React Workflow

Convert Claude Design HTML exports to production Next.js/React code using team rules and domain modeling to catch gaps.

## Process

### 1. Design intake

Read the Claude Design HTML export. Extract:
- **Components** — buttons, forms, tables, cards, modals
- **Layouts** — page structure, spacing, responsive behavior
- **Interactions** — click handlers, state transitions, navigation
- **Data shapes** — what fields appear, what's required, what's optional

Output: component inventory + data model sketch.

### 2. Spec alignment

Compare design against spec (e.g. `docs/specs/hrm/hrm-v1.md`):
- **Missing** — spec requires, design lacks
- **Partial** — design shows some but not all spec behavior
- **Wrong** — design contradicts spec

Report gaps. Don't implement yet — get alignment first.

### 3. Domain modeling

Challenge design terms against `CONTEXT.md` glossary:
- "Account" vs "User" vs "Employee" — which concept?
- "Clock in" vs "Attendance record" — same thing or different?
- "Department" vs "Team" — overlap?

Test edge cases:
- What if employee has no department?
- What if availability request is approved then rejected?
- What if pay band min > max?

Update `CONTEXT.md` inline when terms resolve.

### 4. Implementation

Apply team rules:
- **Ponytail pattern** — mock data with `// ponytail:` comment + upgrade path
- **Component library** — use what the design or user specifies; if neither specifies, default to **shadcn/ui** as the reference standard
- **JSX escaping** — `&apos;`, `&quot;`, `&lt;`, `&gt;` in text content
- **Barrel imports** — folder with ≥2 files gets `index.ts`
- **DTOs intact** — pass through controller → service seam
- **date-fns** — all time processing, never raw `Date` arithmetic

Structure (CRUD pattern):
```
apps/[app]/src/app/[feature]/
├── page.tsx (list)
├── new/page.tsx (create form)
└── [id]/
    ├── page.tsx (detail)
    └── edit/page.tsx (edit form)
```

For nested resources:
```
apps/[app]/src/app/[feature]/
├── page.tsx (parent list)
└── [parentId]/
    ├── page.tsx (parent detail)
    └── [child]/page.tsx (nested resource)
```

Hooks pattern (ponytail mock data):
```ts
// ponytail: module-level mutable mock store. Upgrade path: swap for real API.
const MOCK_DATA: T[] = [...];

export function useList() {
  return useQuery({ queryKey: ["resource"], queryFn: async () => MOCK_DATA });
}

export function useCreate() {
  return useMutation({
    mutationFn: async (item: T) => {
      MOCK_DATA.push({ ...item, id: `id-${Date.now()}` });
      return item;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resource"] }),
  });
}
```

### 5. Code review

Two-axis review against fixed point (commit SHA):

**Standards axis** — team rules + Fowler smells:
- Mysterious Name — function/variable name doesn't reveal purpose
- Duplicated Code — same logic in multiple places
- Feature Envy — method reaches into another object's data
- Data Clumps — same fields travel together (bundle into type)
- Primitive Obsession — primitive standing in for domain concept
- Speculative Generality — abstraction for needs spec doesn't have

**Spec axis** — requirements coverage:
- Missing — spec asked, code lacks
- Scope creep — code has, spec didn't ask
- Wrong — implemented but incorrectly

Report per file/hunk. Cite rule or spec line.

### 6. Verification

Chrome DevTools MCP to confirm design match:
- Open page in browser
- Take snapshot
- Compare against design HTML
- Fix visual/interaction gaps

Run verification:
```bash
# Typecheck (project-specific — adapt to package manager)
pnpm typecheck  # or: npm run typecheck, bun run typecheck, yarn typecheck

# Lint
pnpm lint       # or: npm run lint, bun run lint, yarn lint

# Tests (if applicable)
pnpm test       # or: npm test, bun test, vitest, jest
```

## Leading words

- **Ponytail** — mock data with known ceiling + upgrade path
- **Seam** — where module's interface lives (controller/service, component/hook)
- **Depth** — behavior behind interface (small surface, big implementation)
- **Leading word** — compact concept from pretraining that anchors behavior

## Pruning

- **Duplication** — same meaning in two places → one source of truth
- **Sediment** — stale layers → delete what no longer bears on task
- **No-ops** — instruction model already obeys → delete

## When to split workflow

- **By sequence** — design intake → spec alignment → domain modeling → implementation → review → verification. Each step has completion criterion.
- **By invocation** — code review is separate skill, invoked after implementation.

## Completion criteria

- **Design intake** — component inventory + data model sketch produced
- **Spec alignment** — gaps reported, user confirmed scope
- **Domain modeling** — terms resolved, CONTEXT.md updated
- **Implementation** — typecheck + lint pass, pages render
- **Code review** — findings reported per axis
- **Verification** — Chrome DevTools confirms design match
