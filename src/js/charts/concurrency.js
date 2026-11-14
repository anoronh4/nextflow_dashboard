// ═══════════════════════════════════════════════
// CHART 1: CONCURRENT CPU (stacked area by sample)
// ═══════════════════════════════════════════════
function buildConcurrentData(tasks) {
  const valid = tasks.filter(t => t.start && t.complete);
  if (!valid.length) return null;

  const samples = [...new Set(valid.map(t => t.sampleId))].sort();

  // Build sorted event list
  const evs = [];
  valid.forEach(t => {
    evs.push({ t: t.start.getTime(),    d: +t.cpus,   s: t.sampleId });
    evs.push({ t: t.complete.getTime(), d: -t.cpus,   s: t.sampleId });
  });
  evs.sort((a,b) => a.t - b.t);

  const state_cpu = {};
  samples.forEach(s => state_cpu[s] = 0);
  const times = [];
  const byS = {};
  samples.forEach(s => byS[s] = []);

  let i = 0;
  while (i < evs.length) {
    const t = evs[i].t;
    // Record BEFORE applying events at this timestamp (left edge of step)
    times.push(new Date(t));
    samples.forEach(s => byS[s].push(state_cpu[s]));
    // Apply all events at this exact timestamp
    while (i < evs.length && evs[i].t === t) {
      state_cpu[evs[i].s] = (state_cpu[evs[i].s]||0) + evs[i].d;
      i++;
    }
    // Record AFTER (right edge of step)
    times.push(new Date(t));
    samples.forEach(s => byS[s].push(state_cpu[s]));
  }

  return { times, byS, samples };
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

  const samples = [...new Set(valid.map(t => t.sampleId))].sort();

  // Each task contributes cpuPct/100 effective cores for its execution window.
  const evs = [];
  valid.forEach(t => {
    const effectiveCores = t.cpuPct / 100;
    evs.push({ t: t.start.getTime(),    d: +effectiveCores, s: t.sampleId });
    evs.push({ t: t.complete.getTime(), d: -effectiveCores, s: t.sampleId });
  });
  evs.sort((a,b) => a.t - b.t);

  const state_cpu = {};
  samples.forEach(s => state_cpu[s] = 0);
  const times = [];
  const byS = {};
  samples.forEach(s => byS[s] = []);

  let i = 0;
  while (i < evs.length) {
    const t = evs[i].t;
    times.push(new Date(t));
    samples.forEach(s => byS[s].push(Math.max(0, state_cpu[s]))); // clamp negatives from float drift
    while (i < evs.length && evs[i].t === t) {
      state_cpu[evs[i].s] = (state_cpu[evs[i].s] || 0) + evs[i].d;
      i++;
    }
    times.push(new Date(t));
    samples.forEach(s => byS[s].push(Math.max(0, state_cpu[s])));
  }

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

  const samples = [...new Set(valid.map(t => t.sampleId))].sort();

  const evs = [];
  valid.forEach(t => {
    evs.push({ t: t.start.getTime(),    d: +t.peakRss,  s: t.sampleId });
    evs.push({ t: t.complete.getTime(), d: -t.peakRss,  s: t.sampleId });
  });
  evs.sort((a,b) => a.t - b.t);

  const state_mem = {};
  samples.forEach(s => state_mem[s] = 0);
  const times = [];
  const byS = {};
  samples.forEach(s => byS[s] = []);

  let i = 0;
  while (i < evs.length) {
    const t = evs[i].t;
    // Record BEFORE applying events at this timestamp (left edge of step)
    times.push(new Date(t));
    samples.forEach(s => byS[s].push(state_mem[s] / 1073741824)); // bytes → GB
    // Apply all events at this exact timestamp
    while (i < evs.length && evs[i].t === t) {
      state_mem[evs[i].s] = (state_mem[evs[i].s] || 0) + evs[i].d;
      i++;
    }
    // Record AFTER (right edge of step)
    times.push(new Date(t));
    samples.forEach(s => byS[s].push(state_mem[s] / 1073741824)); // bytes → GB
  }

  return { times, byS, samples };
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

  const samples = [...new Set(valid.map(t => t.sampleId))].sort();
  const evs = [];
  valid.forEach(t => {
    evs.push({ t: t.start.getTime(),    d: +t.allocMem, s: t.sampleId });
    evs.push({ t: t.complete.getTime(), d: -t.allocMem, s: t.sampleId });
  });
  evs.sort((a,b) => a.t - b.t);

  const state_mem = {};
  samples.forEach(s => state_mem[s] = 0);
  const times = [];
  const byS = {};
  samples.forEach(s => byS[s] = []);

  let i = 0;
  while (i < evs.length) {
    const t = evs[i].t;
    times.push(new Date(t));
    samples.forEach(s => byS[s].push(state_mem[s] / 1073741824));
    while (i < evs.length && evs[i].t === t) {
      state_mem[evs[i].s] = (state_mem[evs[i].s] || 0) + evs[i].d;
      i++;
    }
    times.push(new Date(t));
    samples.forEach(s => byS[s].push(state_mem[s] / 1073741824));
  }

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

