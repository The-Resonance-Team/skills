# Approval dashboard browser QA

Date: 2026-11-26. Target: local Vite build of `ui/` with a mocked
`/api/patches` response containing one pending rule patch.

- Desktop and 375px-equivalent snapshots showed the stable board, expiry text,
  plain unified patch, Allow/Deny controls, and a wrapped diff view.
- No horizontal overflow: `scrollWidth` equals `innerWidth`.
- Console errors: none after adding the empty favicon link.
- Lighthouse snapshot (mobile): Accessibility 96, Best Practices 100, SEO 60,
  Agentic Browsing 33. The remaining accessibility failure is the pre-existing
  Astryx neutral-theme secondary text contrast (#9e9e9e on white, 2.67:1), which
  also affects table headers. SEO and agentic-browsing findings concern missing
  site-level metadata, not the approval workflow.
- Performance trace: CLS 0.00. Mocks disable the HTTP cache, so trace timings
  are not production measurements.
- `astryx doctor --built dist`: 27 pass, 0 warn, 0 fail.
- `modern-web-guidance legacy-scan src --json`: 0 findings across 12 files.

Screenshots and reports are in the session temp directory:
`dashboard-mobile.png`, `lighthouse/`, and `dashboard-trace.json`.

Browser support policy: Baseline Widely available. Split view is offered only
when the viewport is at least 1024px; the wrapped unified view and plain text
patch remain available at every width. The stock Pierre widget's CSS-generated
change markers are supplemented by the literal JSDiff text alternative so
meaning is present in the DOM.
