# Real-User QA Rules — Functional browser pass

Applies to any repo with a browser UI when a change touches a screen, control, or workflow. Use it with or without a screenshot QA harness. Consumers that run only backend jobs omit this file.

## Coverage matrix (mandatory)

1. **Write one coverage matrix before the pass** — One row for every affected route, control, mutation, state (empty, loading, error), and viewport. Each row carries the URL, the observed result, and evidence: a screenshot, console output, or network status. Use the shape `route | control | before → after | URL | evidence | width`. "Walk every tab" is not a bound; "every affected row has evidence" is. Completion criterion: no cell is blank.
2. **Walk the workflow from entry to result** — Sign in as the fixture persona, open the entry route, use the control, submit the mutation, read the resulting state, and sign out. Completion criterion: each mutation row records the state before, the state after, and the final URL.
3. **Capture both browser views in the same pass** — Use browse MCP for the signed-in session, navigation, tabs, and dialogs. Use chrome-devtools MCP for console errors, network statuses, and forced failure states. Completion criterion: the matrix records zero console errors and the expected status for every API call; a known failure has a reason and a linked row.
4. **Include the supported widths** — Record 1280px and 768px rows when layout, navigation, or dialogs change; include the menu path at narrow widths. Completion criterion: each affected route has a narrow-width row.
5. **Send the matrix with the diff for review** — A UI change without a matrix is incomplete. The reviewer checks for missing rows and asks for the absent evidence; this is a judgement call, not a lint rule.
