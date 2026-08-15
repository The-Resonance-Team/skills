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

## Complex scenarios

### Multi-resource coordination

When pages share data across resources (e.g., employee list → department filter → position detail):

- **Shared query keys** — use consistent queryKey structure: `["resource", parentId, childId]`
- **Cross-resource invalidation** — when parent mutates, invalidate child queries: `onSuccess: () => queryClient.invalidateQueries({ queryKey: ["child", parentId] })`
- **Dependent queries** — use `enabled` flag: `enabled: !!parentId` so child query doesn't fire until parent loads
- **Breadcrumb state** — derive from route params, not component state

### Permission & role modeling

- **PermissionGuard wrapper** — wrap UI elements that require specific permissions: `<PermissionGuard permission={PERMISSIONS.EDIT}><Button>Edit</Button></PermissionGuard>`
- **Route-level guards** — check permission in `layout.tsx` or `page.tsx` before rendering, redirect to 403 if denied
- **Hook-level guards** — `usePermission(permission)` returns boolean, use to conditionally render or disable
- **Permission constants** — centralize in `@restosuite/constants` or similar, never hardcode strings

### Error handling strategy

- **API errors** — surface from hook's `error` field, render in UI, never swallow into `useState`
- **Form validation errors** — zod schema messages, displayed inline below field
- **Not found** — if entity missing (404 or empty result), show "Not found" card with back link
- **Loading states** — skeleton screens (animate-pulse) while `isLoading`, not blank screens
- **Error boundaries** — wrap page in React ErrorBoundary for unexpected crashes

### Form validation patterns

- **Client + server** — zod schema mirrors API DTO validation rules exactly
- **Cross-field validation** — zod `.refine()` for rules like `endDate > startDate`
- **Async validation** — zod `.refine(async (val) => await checkUnique(val))` for uniqueness checks
- **Dirty tracking** — RHF's `formState.isDirty` to enable/disable save button
- **Optimistic save** — disable save button while `mutation.isPending`, re-enable on success/error

### Optimistic updates

Use when latency matters and rollback is safe:

```ts
useMutation({
  mutationFn: updateItem,
  onMutate: async (newItem) => {
    await queryClient.cancelQueries({ queryKey: ["item", id] });
    const previous = queryClient.getQueryData(["item", id]);
    queryClient.setQueryData(["item", id], newItem);
    return { previous };
  },
  onError: (err, newItem, context) => {
    queryClient.setQueryData(["item", id], context.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["item", id] }),
});
```

Skip when: data loss risk, concurrent edits likely, or user needs confirmation.

### Cache invalidation strategy

- **After create** — invalidate list query: `invalidateQueries({ queryKey: ["items"] })`
- **After update** — invalidate both list and detail: `invalidateQueries({ queryKey: ["items"] }), invalidateQueries({ queryKey: ["item", id] })`
- **After delete** — same as update
- **Cross-resource** — when department updates, invalidate positions: `invalidateQueries({ queryKey: ["positions", departmentId] })`

### Nested navigation

- **Breadcrumbs** — derive from `useParams()`, render as `<Link>` chain with separator
- **Back navigation** — `router.back()` for in-app, `router.push(parentPath)` for cross-feature
- **Deep linking** — preserve query params in URL: `?filter=kitchen&page=2`, read with `useSearchParams()`
- **Tab state** — use URL search params, not `useState`, so tabs are shareable/bookmarkable

### Responsive design

- **Mobile-first** — default styles for mobile, `md:` / `lg:` breakpoints for larger screens
- **Breakpoint tokens** — use Tailwind's default: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`, `2xl:1536px`
- **Responsive tables** — stack on mobile (card layout), grid on desktop (table layout)
- **Touch targets** — min 44×44px for buttons/links on mobile

### Accessibility checklist

- **Semantic HTML** — `<button>` for actions, `<a>` for navigation, `<input>` for forms
- **ARIA labels** — `aria-label` for icon-only buttons, `aria-labelledby` for complex widgets
- **Keyboard navigation** — all interactive elements focusable, logical tab order, Enter/Space activate
- **Focus management** — after modal opens, focus first input; after closes, return focus to trigger
- **Color contrast** — WCAG AA: 4.5:1 for text, 3:1 for large text/UI components
- **Screen reader** — `sr-only` class for visually hidden but screen-reader-visible text

### Performance budget

- **Code splitting** — dynamic `import()` for heavy components (charts, editors)
- **Image optimization** — Next.js `<Image>` with `width`, `height`, `alt`, `priority` for above-fold
- **Font loading** — `next/font` with `display: "swap"`, preload critical fonts
- **Bundle size** — keep under 200KB gzipped per page, use `@next/bundle-analyzer` to audit
- **Lazy hydration** — for static content, use `"use client"` only where interactivity needed

### Testing strategy

- **Hook tests** — test mock hooks with React Testing Library: render component, assert data appears
- **Integration tests** — test page renders with mock data, user interactions work
- **E2E tests** — Playwright/Cypress for critical flows: create → edit → delete
- **Visual regression** — Chromatic/Loki for UI snapshot tests
- **Coverage target** — 80% for business logic, 60% for UI components

### Deployment checklist

- **Environment config** — `.env.local` for dev, `.env.production` for prod, never commit secrets
- **Feature flags** — use `process.env.NEXT_PUBLIC_FEATURE_X` for gradual rollouts
- **Preview deploys** — Vercel/Netlify auto-deploy PR branches for review
- **Rollback plan** — keep last 3 deploys available, one-click rollback on critical bug
- **Monitoring** — Sentry for error tracking, PostHog for analytics, Vercel Analytics for performance
