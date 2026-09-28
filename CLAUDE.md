# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file, fully offline dashboard that visualizes Nextflow / nf-core `execution_trace.txt`
files. The user drops one or more trace files onto the page; everything is parsed and charted
client-side. There is no server, no build step, no package manager, no tests.

Entire project: `pipeline_dashboard_offline.html` (~4 MB, 1935 lines) + this file + `README.md`.

## Running it

```bash
open pipeline_dashboard_offline.html    # macOS; or just double-click it
```

No install, no dev server. Reload the browser to pick up edits. Trace files are read via
`FileReader` (drag-drop or file picker), so the page works from `file://` with no network.

## Editing this file safely

The 4 MB is almost entirely vendored libraries inlined as single enormous lines. **Never
`Read`/`cat` the whole file** — read the ranges you need:

| Lines | Contents |
|-------|----------|
| 15 | plotly.js v2.26.0 minified (3.6 MB, one line) — do not touch |
| 22 | Bootstrap 5.3.2 CSS minified (one line) — do not touch |
| 31 | Bootstrap 5.3.2 JS bundle minified (one line) — do not touch |
| 34–185 | Hand-written CSS: `:root` dark-theme tokens + component classes |
| 187–479 | Hand-written HTML: header, upload zone, filter bar, metric grid, tab nav, one `.tab-pane` per tab |
| 480–1934 | Hand-written app JS, the only real code |

Plotly and Bootstrap are inlined deliberately — offline use is the point. Don't replace them with
CDN links. Bootstrap is loaded but the layout is almost entirely custom CSS; prefer the existing
`--bg/--surface/--border/--text/--muted/--accent…` tokens and the `.chart-panel` /
`.metric-card` / `.data-table` / `.fbtn` classes over adding Bootstrap utility classes.

## Architecture

One unidirectional flow, no framework, no reactivity. Global mutable `state` (line 500) +
explicit re-render calls.

1. **Parse** — `parseTrace(text, runName, runId)` (569) splits the TSV, resolves columns by
   *header name* (not position), and returns flat task objects. Each file = one "run"; runs are
   never merged, every task keeps `runId`/`runName`.
2. **Store** — `handleFiles` (606) pushes `{id, name, tasks}` onto `state.runs`, then
   `onDataLoaded` (627) repopulates the sample/run dropdowns and run chips and reveals `#dashboard`.
3. **Filter** — every renderer starts from `getTasks({ignoreStatus, ignoreSample, ignoreRun})`
   (688), which reads the filter DOM controls directly (they are the source of truth, not `state`)
   and drops non-sample tags via `isRealSample`.
4. **Render** — `updateAll()` (714) → `renderMetrics()` + `renderActiveTab()` (719), a plain
   if/else dispatch on `state.activeTab` to one `renderX()` per tab. Charts go through
   `Plotly.react(div, traces, layout, {responsive:true})`; empty results call `Plotly.purge` and
   write a `.chart-empty` placeholder.

### Adding a tab

Four edits, all following the existing pattern: a `<button class="tab-btn" data-tab="foo">` in the
tab nav (244), a `<div id="pane-foo" class="tab-pane" style="display:none">` with a chart div, a
`renderFoo()` function, and a branch in `renderActiveTab()`. `switchTab` (705) derives pane
visibility from `data-tab` → `#pane-<tab>`, so the id must match exactly.

### Conventions that matter

- **Units are normalized at parse time, not display time**: timestamps → `Date`, durations → ms
  (`parseDurMs`), memory → bytes (`parseMemB`). Renderers work in ms/bytes and format only at the
  edge with `fmtHours` / `fmtBytes`. Missing values are `null` (traces use `-`), never 0.
- **Sample identity** comes from the trace `tag` column: `extractSample` takes everything before
  `@`. `isRealSample` (676) filters out reference/index tasks — it hardcodes `genome.fa`,
  `grch38`, `blocklist_breakpoints*` plus a "no dash but has a dot" filename heuristic. This is a
  pipeline-specific blocklist; extend it here when new non-sample tags show up.
- **Concurrency curves** are all the same event-sweep: emit `+x` at `start` and `-x` at `complete`,
  sort by time, and record the running total *before and after* each timestamp so Plotly draws a
  true step function. `buildConcurrentData` (801, CPUs) and `buildConcurrentMemData` (946, bytes)
  are the reusable versions; `renderAllocMem`, `renderActualCpu`, the queue-depth chart, and the
  per-sample peaks in `computeSampleStats` each re-implement the sweep over a different quantity.
- **Allocated vs actual** is the analytical theme of the dashboard: allocated = `cpus` and the
  `memory` directive; actual = `%cpu ÷ 100` effective cores and `peak_rss`. The efficiency tabs
  (`renderCpuEff` 1395, `renderMemEff` 1507) pair them as dim/bright bars sorted worst-ratio-first.
  Keep that dim-allocated / bright-actual visual language when touching them.
- **Colors**: `sampleColor(s)` (492) assigns palette entries from `PALETTE` on first use and
  memoizes in `sampleColorMap`, so a sample keeps its color across tabs. Fills append an alpha
  suffix to the hex (`+ 'b0'`).
- Tables render by string-building `innerHTML`; sort handlers (`sortBy` 1192, `sortTypical` 1381)
  flip a module-level dir flag, update the `.sort-arrow` span, and re-render.

### Known rough edges

- `state.sortKey` / `state.sortDir` (504) are dead — the sample table actually uses the
  module-level `sortKey` / `sortDir` at line 1190.
- `renderTypicalSample` caches its stats in `_cachedTypicalStats` (1379); `sortTypical` and
  `downloadTypicalTSV` read that cache, so it is stale until the Typical Sample tab re-renders.
- `getTasks` re-flattens and re-filters all runs on every render; fine for typical trace sizes,
  the thing to look at first if many large traces get slow.
