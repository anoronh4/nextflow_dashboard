// ═══════════════════════════════════════════════
// CHART 1: CONCURRENT CPU (stacked area by sample)
// ═══════════════════════════════════════════════
// ── Event sweeps ─────────────────────────────────────────────────────────
// Every concurrency curve is the same trick: each task adds +value when it starts and -value
// when it ends; sort those events by time and keep a running total.

// Stacked step series, one per sample. At each distinct timestamp the running totals are
// recorded twice, before and after applying that timestamp's events, so Plotly draws vertical
// steps instead of slopes. `record` transforms a total when it is stored (e.g. bytes → GB).
function stackedSteps(tasks, from, to, value, record = v => v) {
  const samples = [...new Set(tasks.map(t => t.sampleId))].sort();
  const evs = [];
  tasks.forEach(t => {
    const v = value(t);
    evs.push({ t: from(t).getTime(), d: +v, s: t.sampleId });
    evs.push({ t: to(t).getTime(),   d: -v, s: t.sampleId });
  });
  evs.sort((a, b) => a.t - b.t);

  const cur = {}, byS = {}, times = [];
  samples.forEach(s => { cur[s] = 0; byS[s] = []; });
  let i = 0;
  while (i < evs.length) {
    const t = evs[i].t;
    times.push(new Date(t));                                   // left edge of the step
    samples.forEach(s => byS[s].push(record(cur[s])));
    while (i < evs.length && evs[i].t === t) { cur[evs[i].s] += evs[i].d; i++; }
    times.push(new Date(t));                                   // right edge
    samples.forEach(s => byS[s].push(record(cur[s])));
  }
  return { times, byS, samples };
}

// Highest running total of `value` over tasks' start→complete windows (events applied one by
// one in time order). Used for the Peak CPUs card and per-sample peaks in Typical Sample.
function peakConcurrent(tasks, value) {
  const evs = tasks
    .flatMap(t => [[t.start.getTime(), +value(t)], [t.complete.getTime(), -value(t)]])
    .sort((a, b) => a[0] - b[0]);
  let cur = 0, peak = 0;
  evs.forEach(([, d]) => { cur += d; if (cur > peak) peak = cur; });
  return peak;
}

function buildConcurrentData(tasks) {
  const valid = tasks.filter(t => t.start && t.complete);
  if (!valid.length) return null;
  return stackedSteps(valid, t => t.start, t => t.complete, t => t.cpus);
}

function renderConcurrent() {
  const div = document.getElementById('chart-concurrent');
  const tasks = getTasks();
  const data = buildConcurrentData(tasks);

  if (!data) {
    Plotly.purge(div);
    div.innerHTML = '<div class="chart-empty">No tasks with timing data for the selected filters</div>';
    return;
  }

  const traces = data.samples.map(s => ({
    type: 'scatter', mode: 'lines', name: s,
    x: data.times, y: data.byS[s],
    stackgroup: 'cpu',
    line: { width: 0, color: sampleColor(s) },
    fillcolor: sampleColor(s) + 'b0',
    hovertemplate: `<b>${s}</b><br>%{x|%b %d %H:%M:%S}<br>CPUs: %{y}<extra></extra>`,
  }));

  plot(div, traces, {
    xaxis: { tickformat:'%b %d\n%H:%M', title:'' },
    yaxis: { title:'Concurrent CPUs', zeroline:false },
    hovermode: 'x unified',
    margin: { t:20, r:20, b:55, l:65 },
  });
}

// ═══════════════════════════════════════════════
// CHART 2: CONCURRENT ACTUAL CPU (stacked area by sample)
// Uses %cpu (the real utilisation recorded by Nextflow) divided by 100 to give
// effective cores. A task allocated 8 CPUs but running at 125% contributes 1.25
// effective cores — not 8. Compare with the Allocated tab to find waste.
// ═══════════════════════════════════════════════
function renderActualCpu() {
  const div = document.getElementById('chart-actualcpu');
  const tasks = getTasks();

  // Only tasks that actually ran (have timing + a non-zero %cpu reading).
  // CACHED tasks have near-zero %cpu and would flatten the curve, so they
  // are worth filtering out here even if the status toggle includes them.
  const valid = tasks.filter(t => t.start && t.complete && t.cpuPct > 0);
  if (!valid.length) {
    Plotly.purge(div);
    div.innerHTML = '<div class="chart-empty">No tasks with CPU utilisation data for the selected filters. Try including Completed / Failed tasks.</div>';
    return;
  }

  // Each task contributes cpuPct/100 effective cores; clamp negatives from float drift.
  const { times, byS, samples } = stackedSteps(
    valid, t => t.start, t => t.complete, t => t.cpuPct / 100, v => Math.max(0, v));

  const traces = samples.map(s => ({
    type: 'scatter', mode: 'lines', name: s,
    x: times, y: byS[s],
    stackgroup: 'actualcpu',
    line: { width: 0, color: sampleColor(s) },
    fillcolor: sampleColor(s) + 'b0',
    hovertemplate: `<b>${s}</b><br>%{x|%b %d %H:%M:%S}<br>Effective cores: %{y:.2f}<extra></extra>`,
  }));

  plot(div, traces, {
    xaxis: { tickformat:'%b %d\n%H:%M', title:'' },
    yaxis: { title:'Effective CPU cores (%cpu ÷ 100)', zeroline:false },
    hovermode: 'x unified',
    margin: { t:20, r:20, b:55, l:75 },
  });
}

// ═══════════════════════════════════════════════
// CHART 3: CONCURRENT MEMORY (stacked area by sample)
// Uses the same event-driven step-function approach as the CPU chart.
// Each task contributes its peak_rss bytes for its entire start→complete window.
// ═══════════════════════════════════════════════
function buildConcurrentMemData(tasks) {
  const valid = tasks.filter(t => t.start && t.complete && t.peakRss);
  if (!valid.length) return null;
  return stackedSteps(valid, t => t.start, t => t.complete, t => t.peakRss, v => v / 1073741824); // bytes → GB
}

function renderMemory() {
  const div = document.getElementById('chart-memory');
  const tasks = getTasks();
  const data = buildConcurrentMemData(tasks);

  if (!data) {
    Plotly.purge(div);
    div.innerHTML = '<div class="chart-empty">No tasks with both timing and memory data for the selected filters</div>';
    return;
  }

  const traces = data.samples.map(s => ({
    type: 'scatter', mode: 'lines', name: s,
    x: data.times, y: data.byS[s],
    stackgroup: 'mem',
    line: { width: 0, color: sampleColor(s) },
    fillcolor: sampleColor(s) + 'b0',
    hovertemplate: `<b>${s}</b><br>%{x|%b %d %H:%M:%S}<br>RAM: %{y:.2f} GB<extra></extra>`,
  }));

  plot(div, traces, {
    xaxis: { tickformat:'%b %d\n%H:%M', title:'' },
    yaxis: { title:'Concurrent RAM (GB)', zeroline:false },
    hovermode: 'x unified',
    margin: { t:20, r:20, b:55, l:75 },
  });
}

// ═══════════════════════════════════════════════
// CHART 3: CONCURRENT ALLOCATED MEMORY (stacked area by sample)
// Uses the `memory` column (pipeline-configured allocation ceiling),
// not peak_rss (actual usage). Useful for seeing reserved cluster capacity.
// ═══════════════════════════════════════════════
function renderAllocMem() {
  const div = document.getElementById('chart-allocmem');
  const tasks = getTasks();

  // Reuse the same step-function builder, swapping peakRss → allocMem
  const valid = tasks.filter(t => t.start && t.complete && t.allocMem);
  if (!valid.length) {
    Plotly.purge(div);
    div.innerHTML = '<div class="chart-empty">No tasks with both timing and allocated memory data for the selected filters</div>';
    return;
  }

  const { times, byS, samples } = stackedSteps(
    valid, t => t.start, t => t.complete, t => t.allocMem, v => v / 1073741824); // bytes → GB

  const traces = samples.map(s => ({
    type: 'scatter', mode: 'lines', name: s,
    x: times, y: byS[s],
    stackgroup: 'allocmem',
    line: { width: 0, color: sampleColor(s) },
    fillcolor: sampleColor(s) + 'b0',
    hovertemplate: `<b>${s}</b><br>%{x|%b %d %H:%M:%S}<br>Allocated: %{y:.2f} GB<extra></extra>`,
  }));

  plot(div, traces, {
    xaxis: { tickformat:'%b %d\n%H:%M', title:'' },
    yaxis: { title:'Allocated RAM (GB)', zeroline:false },
    hovermode: 'x unified',
    margin: { t:20, r:20, b:55, l:75 },
  });
}

