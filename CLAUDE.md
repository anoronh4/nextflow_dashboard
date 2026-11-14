# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file, fully offline dashboard that visualizes Nextflow / nf-core `execution_trace.txt`
files. The user drops one or more trace files onto the page; everything is parsed and charted
client-side. There is no server, no package manager and no test suite; one small stdlib Python script (`build.py`) bundles the source into the shareable single file.

Source lives in `src/` (open `src/index.html` while editing; no build needed to test).
`pipeline_dashboard_offline.html` at the root is a **generated** single-file bundle for sharing:
`python3 build.py` inlines everything under `src/` into it. Never hand-edit it. Also in the repo:
`README.md`, and `examples/` (synthetic demo traces, their seeded generator, and the README
images; regenerate the images from those traces after visible UI changes, see `examples/README.md`).

## Running it

```bash
open src/index.html                     # while editing: reload the browser after each change
python3 build.py                        # regenerate pipeline_dashboard_offline.html from src/
python3 build.py --check                # exits 1 if the bundle is stale (run before committing)
open pipeline_dashboard_offline.html    # the shareable single file
```

No install, no dev server, no package manager. `build.py` is Python 3 standard library only. Both
pages work from `file://` with no network. Trace files are read via `FileReader` (drag-drop or file
picker). **Workflow:** edit `src/`, reload `src/index.html`, then `python3 build.py`, and commit
`src/` and the regenerated bundle together.

## Source layout

All files are classic scripts sharing globals. **No ES modules**: browsers refuse `import` over
`file://`. Inline `onclick="…"` attributes in `index.html` call these globals directly.
`index.html` loads them in this order; most files only declare functions, and the only top-level
side effects (event listeners) are in `app.js`, which loads last.

| File | Owns |
|------|------|
| `src/index.html` | Markup: header, filter bar, metric grid, tab nav, one `.tab-pane` per tab; asset tags |
| `src/css/app.css` | `:root` dark-theme tokens + component classes |
| `src/vendor/*` | Plotly 2.26.0, Bootstrap 5.3.2 CSS + JS bundle. Minified, never edit, never `Read` whole |
| `src/js/state.js` | the global `state` object |
| `src/js/parse.js` | `parseTrace` and unit normalisation |
| `src/js/format.js` | `fmtBytes`, `fmtHours`, `arrMedian`, `arrQuantile` |
| `src/js/colors.js` | `PALETTE`, `DISTINCT_PALETTE`, `sampleColor`, `processColor` |
| `src/js/plot.js` | `plot()`, shared theme, large-text PNG export |
| `src/js/filters.js` | status/process filters, `isRealSample`, `getTasks` |
| `src/js/anonymize.js` | aliases, `sampleLabel` / `runLabel`, dropdown/chip labels |
| `src/js/charts/*.js` | one file per tab (concurrency = the 4 concurrent charts; efficiency = CPU + Memory) |
| `src/js/app.js` | file loading, drag-and-drop, `switchTab`, `updateAll`, `renderActiveTab`, metric cards |

`build.py` refuses non-local asset URLs, unrecognised asset tags, and files containing `</script` /
`</style`, since any of these would break the offline bundle. Keep asset tags exactly
`<script src="..."></script>` / `<link rel="stylesheet" href="...">`, one per line. Plotly and
Bootstrap are vendored deliberately (offline use is the point), so never replace them with CDN
links. Bootstrap is loaded but the layout is almost entirely custom CSS; prefer the existing
`--bg/--surface/--border/--text/--muted/--accent…` tokens and the `.chart-panel` / `.metric-card` /
`.data-table` / `.fbtn` classes over adding Bootstrap utility classes.

## Architecture

One unidirectional flow, no framework, no reactivity. Global mutable `state` (`state.js`) +
explicit re-render calls.

1. **Parse** — `parseTrace(text, runName, runId)` (`parse.js`) splits the TSV, resolves columns by
   *header name* (not position), and returns flat task objects. Each file = one "run"; runs are
   never merged, every task keeps `runId`/`runName`.
2. **Store** — `handleFiles` (`app.js`) pushes `{id, name, tasks}` onto `state.runs`, then
   `onDataLoaded` (`app.js`) repopulates the sample/run dropdowns and run chips and reveals `#dashboard`.
3. **Filter** — every renderer starts from `getTasks({ignoreStatus, ignoreSample, ignoreRun})`
   (`filters.js`), which reads the filter DOM controls directly (they are the source of truth, not `state`)
   and drops non-sample tags via `isRealSample`. The Processes multi-select is the exception: it
   lives in `state.excludedProcs` (a set of *unchecked* `procShort` names, so newly loaded
   processes default to on) and is applied unconditionally — no `ignore*` flag bypasses it.
   When `state.anonymize` is on, `getTasks` returns copies with `sampleId`/`tag` replaced by
   `Sample 001`-style aliases and `runName` by `Run N` (`anonymize.js`). Anything that
   displays a sample or run must come from `getTasks` or go through `sampleLabel` / `runLabel` —
   never read `state.runs[].name` or raw task IDs for display.
4. **Render** — `updateAll()` (`app.js`) → `renderMetrics()` + `renderActiveTab()` (`app.js`), a plain
   if/else dispatch on `state.activeTab` to one `renderX()` per tab. Charts go through
   `plot(div, traces, layout)` (`plot.js`), never `Plotly.react` directly: it merges the
   chart's layout with the shared dark theme (`PLOT_FONT` / `AXIS_STYLE` / `LEGEND_STYLE`, merged
   per key, so a chart only states what differs) and attaches `PLOT_CONFIG`, which adds the two
   large-text PNG export buttons (`exportPlot(gd, 'dark'|'light')`). Export re-renders an off-screen
   copy with scaled fonts/lines/markers and the `.chart-title` as the plot title; the light theme
   remaps dark UI hexes via `LIGHT_REMAP`. New theme colors should go in `LIGHT_REMAP` too.
   Empty results call `Plotly.purge` and write a `.chart-empty` placeholder.

### Adding a tab

Create `src/js/charts/foo.js` with a `renderFoo()` that starts from `getTasks()` and draws with
`plot()`. In `src/index.html` add the `<script src="js/charts/foo.js"></script>` tag (before
`app.js`), a `<button class="tab-btn" data-tab="foo">` in the tab nav, and a
`<div id="pane-foo" class="tab-pane" style="display:none">` with a chart div. Then add a branch in
`renderActiveTab()` in `src/js/app.js`. `switchTab` derives pane visibility from
`data-tab` → `#pane-<tab>`, so the id must match exactly.

### Conventions that matter

- **Units are normalized at parse time, not display time**: timestamps → `Date`, durations → ms
  (`parseDurMs`), memory → bytes (`parseMemB`). Renderers work in ms/bytes and format only at the
  edge with `fmtHours` / `fmtBytes`. Missing values are `null` (traces use `-`), never 0.
- **Sample identity** comes from the trace `tag` column: `extractSample` takes everything before
  `@`. `isRealSample` (`filters.js`) filters out reference/index tasks — it hardcodes `genome.fa`,
  `grch38`, `blocklist_breakpoints*` plus a "no dash but has a dot" filename heuristic. This is a
  pipeline-specific blocklist; extend it here when new non-sample tags show up.
- **Concurrency curves** are all the same event-sweep: emit `+x` at `start` and `-x` at `complete`,
  sort by time, and record the running total *before and after* each timestamp so Plotly draws a
  true step function. `buildConcurrentData` (`charts/concurrency.js`, CPUs) and `buildConcurrentMemData` (`charts/concurrency.js`, bytes)
  are the reusable versions; `renderAllocMem`, `renderActualCpu`, the queue-depth chart, and the
  per-sample peaks in `computeSampleStats` each re-implement the sweep over a different quantity.
- **Allocated vs actual** is the analytical theme of the dashboard: allocated = `cpus` and the
  `memory` directive; actual = `%cpu ÷ 100` effective cores and `peak_rss`. The efficiency tabs
  (`renderCpuEff`, `renderMemEff` in `charts/efficiency.js`) pair them as dim/bright bars sorted worst-ratio-first.
  Keep that dim-allocated / bright-actual visual language when touching them.
- **Colors**: samples and processes both draw from `DISTINCT_PALETTE`. `sampleColor(s)` uses the
  sample's A→Z rank among all loaded samples (`sampleRank`, rebuilt in `assignAliases`), so stacked
  charts — which also order A→Z — put consecutive slots on touching bands; it resolves anonymized
  aliases to the real ID. `processColor(name)` uses A→Z rank among processes checked in the
  Processes filter, shared by Job Timeline and Process Durations. The palette order is
  farthest-point in OKLab and every consecutive pair (incl. 16→1 wrap) clears CVD ΔE ≥ 8 — don't
  reorder or append by eye; re-check with the dataviz skill's `validate_palette.js` (adjacent and
  `--pairs all`). `PALETTE` remains only for header run chips. Fills append an alpha suffix to the
  hex (`+ 'b0'`).
- Tables render by string-building `innerHTML`; sort handlers (`sortBy` in `charts/sample-table.js`, `sortTypical` in `charts/typical.js`)
  flip a module-level dir flag, update the `.sort-arrow` span, and re-render.

### Known rough edges

- `state.sortKey` / `state.sortDir` (`state.js`) are dead — the sample table actually uses the
  module-level `sortKey` / `sortDir` in `charts/sample-table.js`.
- `renderTypicalSample` caches its stats in `_cachedTypicalStats` (`charts/typical.js`); `sortTypical` and
  `downloadTypicalTSV` read that cache, so it is stale until the Typical Sample tab re-renders.
- `getTasks` re-flattens and re-filters all runs on every render; fine for typical trace sizes,
  the thing to look at first if many large traces get slow.
