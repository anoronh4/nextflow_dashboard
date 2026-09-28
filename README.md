# Nextflow Pipeline Performance Dashboard

An offline, single-file dashboard for exploring Nextflow / nf-core `execution_trace.txt` files.

Drop one or more trace files onto the page and it charts where your pipeline's CPU-hours, memory,
and wall-clock time actually went — **broken down by sample**, and across **multiple runs at once**.

Everything runs in the browser. No install, no server, no upload, no network: open the HTML file
and it works, including on an air-gapped machine or straight off a shared drive.

## Quick start

1. Open `pipeline_dashboard_offline.html` in any modern browser (double-click it).
2. Drag your `execution_trace.txt` files onto the drop zone — or click it and pick them.
3. Each file becomes one **run**. Load several to compare runs side by side.

Runs are labelled from the file's parent directory when you drop a folder (e.g.
`2026-01-25_14-56-25/execution_trace.txt` → `2026-01-25_14-56-25`), otherwise from the filename.
Give files distinct names if you're loading several from the same place.

## Why not just use the built-in Nextflow report?

Nextflow's `-with-report` / `-with-timeline` output is good at answering *"which **process** is
slow or over-provisioned in **this** run?"* This dashboard is built for the questions that report
doesn't cover:

| | Built-in report | This dashboard |
|---|---|---|
| **Runs per view** | One run per HTML file | Many runs loaded together, with a run filter and colour-coded chips |
| **Grouping** | By process | By **sample** (from the trace `tag` column) *and* by process |
| **Resource usage** | Distributions per process (box plots, % utilisation) | Distributions **plus** wall-clock **concurrency curves** — how many CPUs / GB were actually in flight at each moment |
| **Over-provisioning** | % utilisation per process | Processes **ranked worst-first**, allocated vs actual in absolute cores and GB, so you know which directive to edit and by how much |
| **Queue time** | Not charted | Submit→start wait distribution per process, plus pending-task count over time |
| **Per-sample cost** | — | Median CPU-hours / walltime / RAM / bytes written per sample, with quartiles and a TSV export |
| **Works retroactively** | Needs `-with-report` at launch time | Works on any trace file you already have, including runs finished months ago |

Three practical consequences:

- **Capacity planning.** The built-in report tells you a process used 8 CPUs for 20 minutes. It
  won't tell you that at 3 a.m. your run was holding 1,400 CPUs and 6 TB of RAM at once. The
  concurrency tabs do, which is what you need to size a queue or justify a cluster request.
- **Per-sample cost.** Trace files carry the `tag` (sample) for every task, but the built-in
  report never groups by it. Here every time series is stacked by sample, and the *Typical Sample*
  tab turns that into a defensible "one sample costs ~N CPU-hours" figure for quoting or budgeting.
- **Post-hoc analysis.** A trace file is a few hundred KB of TSV and is usually the one artefact
  still around after the work directory is cleaned up. You can analyse and compare old runs you
  never thought to profile.

This is a complement, not a replacement — the built-in report still wins for per-task drill-down,
exit codes, container and work-directory details.

## The tabs

- **Concurrent CPU (allocated)** — CPUs held by running jobs over time, stacked by sample. Your
  real cluster footprint.
- **Concurrent CPU (actual)** — the same curve using `%cpu ÷ 100`, i.e. cores genuinely computing.
  The gap between this and the allocated curve is wasted allocation.
- **Concurrent Memory (peak RSS / allocated)** — the same two views for RAM.
- **Job Timeline** — Gantt chart, one bar per job, y-axis sample, colour process. Capped at 1,200
  bars; use the Sample filter to zoom in.
- **Sample Breakdown** — sortable table of jobs, failures, cache hits, CPU-hours, wall-hours, peak
  CPUs and peak RAM per sample per run.
- **Process Durations** — runtime box plots per process, top 25 by median.
- **Memory / CPU Efficiency** — allocated vs actual per process, sorted most-over-provisioned
  first, with per-task spread underneath. Start here to tune `cpus` / `memory` directives.
- **Typical Sample** — median and quartile cost of a sample, a CPU-hours vs bytes-written scatter,
  and a per-sample table with **Download TSV**.
- **Queue Wait** — how long tasks sat between submit and start, per process, plus how many were
  pending simultaneously. Tall peaks mean you were starved of cluster slots, not slow.

Filters at the top (status Completed / Failed / Cached, sample, run) apply to every tab.

## What the trace file needs to contain

Columns are matched by **header name**, so extra or reordered columns are fine — but a chart is
empty if its column is missing. The fields used are:

```
task_id  process  tag  status  cpus  memory  submit  start  complete
duration  realtime  %cpu  peak_rss  write_bytes
```

nf-core pipelines already write a wide field set, so their `execution_trace.txt` usually works
as-is. For a custom pipeline, add to `nextflow.config`:

```groovy
trace {
    enabled = true
    fields  = 'task_id,process,tag,status,cpus,memory,submit,start,complete,duration,realtime,%cpu,peak_rss,write_bytes'
}
```

**`tag` is the important one.** Sample identity comes from the `tag` directive (everything before
an `@`, so `SAMPLE-01@bwa_mem` → `SAMPLE-01`). If your processes don't set `tag`, the column will
be empty, every task is treated as a non-sample task, and the dashboard will look empty.

## Limitations

- Reference and index tasks are filtered out of all charts by a small built-in blocklist
  (`genome.fa`, `grch38`, `blocklist_breakpoints*`, and bare filename-style tags). It is tuned for
  one set of pipelines — if a real sample of yours disappears, or a reference task shows up as a
  sample, that list is what needs editing (`isRealSample` in the HTML file).
- Box-plot and bar tabs show the top 25 processes; the Gantt shows the first 1,200 tasks.
- Nothing is persisted — reloading the page clears loaded runs.
