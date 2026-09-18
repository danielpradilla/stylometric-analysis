# Tasks and Opportunities

Working list of improvement opportunities identified during a codebase review on 2026-09-18. Not prioritized by urgency; group headings describe the area, not severity.

## Privacy and analytics

- `index.html` and `style-guide.html` now load Google Analytics (`gtag.js`, measurement ID `G-XYG5QF5DZL`). The `README.md` privacy claim ("Uploaded files are read locally in the browser; no text is sent to a server") is still accurate for the analyzed text itself, but the app now sends page-view and visitor telemetry to Google. Update the README to describe what analytics collects, and add a cookie/consent notice if the site expects EU visitors.
- No `Content-Security-Policy` or other security headers are set. `.htaccess` only disables directory listing (`Options -Indexes`). Now that an external script origin (`googletagmanager.com`) is loaded, a CSP would constrain what that script (or any future injected script) can do.

## Testing

- `tests/analysis-core.test.mjs` is a single 40-line script covering one happy-path comparison and one reference audit call. It does not test: `tokenizeWords` edge cases (apostrophes, Unicode combining marks, empty input), `punctuationProfile`, `referenceStyleAudit`'s `available: false` path, or the `strict`/`lenient` sensitivity weight branches.
- `app.mjs` (333 lines: DOM binding, chart drawing, file reading, export) has no test coverage. It is not exported as testable functions, so a UI test would need a DOM environment (jsdom) or browser automation.
- No CI workflow exists (`.github/workflows/` is absent), so `npm test` does not run automatically on push or pull request.

## Performance

- `referenceStyleAudit` runs `compareTexts` once per reference-chunk pair (O(n^2) in chunk count) plus once per candidate-vs-chunk comparison. Each `compareTexts` call rebuilds vocabularies and n-gram vectors from scratch. For a long reference text (many chunks), this is the dominant cost and is not memoized.
- `analyze()` in `app.mjs` runs synchronously on the main thread. A very large pasted or uploaded text (tens of thousands of words) will block the UI during tokenization, n-gram construction, and chart rendering, with no loading state or file-size guard.

## Accessibility

- The three `<canvas>` charts (`methodRadar`, `wordLengthChart`, `sentenceChart`) have no `aria-label`, `role="img"`, or text alternative. Screen reader users get the surrounding `<h3>` only, not the chart's data.
- The similarity meter (`#scoreBar`) is marked `aria-hidden="true"`; the adjacent `#scoreValue` text covers the number, so this is likely fine, but worth a manual screen-reader pass to confirm nothing depends on the visual bar.

## Documentation

- README describes DreamHost Basic Auth protection for the deployment but does not mention Google Analytics, since the tracking script was added after the README was last edited.
- No CONTRIBUTING notes or explanation of the cache-busting convention (`?v=YYYYMMDD` query strings on `app.mjs`), which is currently updated by hand on each deploy and easy to forget.

## Feature scope (lower priority)

- `AI_MARKERS` in `analysis-core.mjs` is a fixed list of ~14 English phrases. It will miss AI-writing patterns outside that list and produce false positives for writers who happen to use those words naturally; this is already partly acknowledged by the "not a standalone AI detector" note in the UI, but the limitation is not documented in the README's Methods section.
- `exportJson()` always downloads to the same filename (`stylometric-analysis.json`), so repeated exports rely on the browser's own duplicate-renaming rather than a timestamped name.
