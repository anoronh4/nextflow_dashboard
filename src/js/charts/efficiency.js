// ═══════════════════════════════════════════════
// CHART: CPU EFFICIENCY
// Compares median allocated CPUs vs median actual CPUs used (%cpu/100) per process.
// Sorted by utilisation ratio ascending (most over-provisioned at top).
// ═══════════════════════════════════════════════
function renderCpuEff() {
  const barsDiv  = document.getElementById('chart-cpueff-bars');
  const boxesDiv = document.getElementById('chart-cpueff-boxes');
  const tasks = getTasks().filter(t => t.cpus && t.cpuPct > 0);

  if (!tasks.length) {
    [barsDiv, boxesDiv].forEach(d => {
      Plotly.purge(d);
      d.innerHTML = '<div class="chart-empty">No tasks with CPU allocation and %cpu data for the selected filters</div>';
    });
    return;
  }

  // Group by process; actualCpus = %cpu / 100
  const byProc = {};
  tasks.forEach(t => {
    if (!byProc[t.procShort]) byProc[t.procShort] = { alloc: [], actual: [] };
    byProc[t.procShort].alloc.push(t.cpus);
    byProc[t.procShort].actual.push(t.cpuPct / 100);
  });

  const med = arr => {
    const s = arr.slice().sort((a,b) => a-b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
  };

  const procs = Object.entries(byProc).map(([name, {alloc, actual}]) => ({
    name,
    medAlloc:  med(alloc),
    medActual: med(actual),
    ratio:     med(actual) / med(alloc),
    n:         alloc.length,
    actualVals: actual,
  }))
  .filter(p => p.medAlloc > 0)
  .sort((a,b) => a.ratio - b.ratio)   // most wasteful first
  .slice(0, 25)
  .reverse();                          // Plotly horizontal: last = top

  const names       = procs.map(p => p.name);
  const allocVals   = procs.map(p => p.medAlloc);
  const actualVals  = procs.map(p => p.medActual);

  // Allocated bar (dim background)
  const trAlloc = {
    type: 'bar', orientation: 'h', name: 'Allocated CPUs (median)',
    x: allocVals, y: names,
    marker: { color: '#30363d', line: { color: '#f7853444', width: 1 } },
    hovertemplate: '<b>%{y}</b><br>Allocated: %{x:.1f} CPUs<extra></extra>',
  };

  // Actual usage bar (bright foreground)
  const trActual = {
    type: 'bar', orientation: 'h', name: 'Actual CPUs used (median)',
    x: actualVals, y: names,
    marker: { color: '#f78534', line: { color: '#f7853488', width: 1 } },
    text: procs.map(p => ` ${(p.ratio*100).toFixed(1)}%`),
    textposition: 'outside',
    textfont: { size: 10, color: '#8b949e' },
    hovertemplate: procs.map(p =>
      `<b>${p.name}</b><br>Actual: ${p.medActual.toFixed(2)} CPUs<br>Allocated: ${p.medAlloc.toFixed(1)} CPUs<br>Utilisation: ${(p.ratio*100).toFixed(1)}%<br>n tasks: ${p.n}<extra></extra>`
    ),
  };

  const chartH = Math.max(360, procs.length * 26 + 80);

  plot(barsDiv, [trAlloc, trActual], {
    barmode: 'overlay',
    xaxis: { title:'CPUs', zeroline:false },
    yaxis: { automargin:true },
    legend: { orientation:'h', x:1, xanchor:'right', y:1.01, yanchor:'bottom' },  // above the plot: longest bars sit at the bottom
    hovermode: 'closest',
    margin: { t:36, r:80, b:55, l:20 },
    height: chartH,
  });

  // ── Box plots of actual CPU usage per process ──
  const allProcs = [...procs].reverse();

  const boxTraces = allProcs.map(p => ({
    type: 'box', name: p.name,
    x: p.actualVals,
    orientation: 'h',
    boxpoints: p.actualVals.length <= 30 ? 'all' : 'outliers',
    jitter: 0.4,
    marker: { size: 4, opacity: 0.6, color: '#f78534' },
    line: { color: '#f78534' },
    fillcolor: '#f7853433',
    hovertemplate: `<b>${p.name}</b><br>Actual CPUs: %{x:.2f}<extra></extra>`,
  }));

  plot(boxesDiv, boxTraces, {
    xaxis: { title:'Actual CPUs used (%cpu ÷ 100)', zeroline:false },
    yaxis: { automargin:true },
    showlegend: false,
    hovermode: 'closest',
    margin: { t:10, r:20, b:55, l:20 },
    height: Math.max(360, allProcs.length * 26 + 80),
  });
}

// ═══════════════════════════════════════════════
// CHART: MEMORY EFFICIENCY
// Compares median allocated memory vs median peak RSS per process.
// Sorted by utilisation ratio ascending (most over-provisioned at top).
// ═══════════════════════════════════════════════
function renderMemEff() {
  const barsDiv  = document.getElementById('chart-memeff-bars');
  const boxesDiv = document.getElementById('chart-memeff-boxes');
  const tasks = getTasks().filter(t => t.allocMem && t.peakRss);

  if (!tasks.length) {
    [barsDiv, boxesDiv].forEach(d => {
      Plotly.purge(d);
      d.innerHTML = '<div class="chart-empty">No tasks with both allocated memory and peak RSS for the selected filters</div>';
    });
    return;
  }

  const GB = 1073741824;

  // Group by process
  const byProc = {};
  tasks.forEach(t => {
    if (!byProc[t.procShort]) byProc[t.procShort] = { alloc: [], rss: [] };
    byProc[t.procShort].alloc.push(t.allocMem / GB);
    byProc[t.procShort].rss.push(t.peakRss / GB);
  });

  const med = arr => {
    const s = arr.slice().sort((a,b) => a-b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
  };

  // Build summary per process, sort by efficiency ratio ascending (worst first → top)
  const procs = Object.entries(byProc).map(([name, {alloc, rss}]) => ({
    name,
    medAlloc: med(alloc),
    medRss:   med(rss),
    ratio:    med(rss) / med(alloc),
    n:        alloc.length,
    rssVals:  rss,
  }))
  .filter(p => p.medAlloc > 0)
  .sort((a,b) => a.ratio - b.ratio)   // most wasteful first
  .slice(0, 25)
  .reverse();                          // Plotly horizontal: last = top

  const names     = procs.map(p => p.name);
  const allocVals = procs.map(p => p.medAlloc);
  const rssVals   = procs.map(p => p.medRss);
  const pctLabels = procs.map(p => (p.ratio * 100).toFixed(1));

  // Allocated bar (dim background)
  const trAlloc = {
    type: 'bar', orientation: 'h', name: 'Allocated (median)',
    x: allocVals, y: names,
    marker: { color: '#30363d', line: { color: '#58a6ff44', width: 1 } },
    hovertemplate: '<b>%{y}</b><br>Allocated: %{x:.2f} GB<extra></extra>',
  };

  // Peak RSS bar (bright foreground)
  const trRss = {
    type: 'bar', orientation: 'h', name: 'Peak RSS (median)',
    x: rssVals, y: names,
    marker: { color: '#3fb950', line: { color: '#3fb95088', width: 1 } },
    text: procs.map(p => ` ${(p.ratio*100).toFixed(1)}%`),
    textposition: 'outside',
    textfont: { size: 10, color: '#8b949e' },
    hovertemplate: procs.map(p =>
      `<b>${p.name}</b><br>Peak RSS: ${p.medRss.toFixed(2)} GB<br>Allocated: ${p.medAlloc.toFixed(2)} GB<br>Utilisation: ${(p.ratio*100).toFixed(1)}%<br>n tasks: ${p.n}<extra></extra>`
    ),
  };

  const chartH = Math.max(360, procs.length * 26 + 80);

  plot(barsDiv, [trAlloc, trRss], {
    barmode: 'overlay',
    xaxis: { title:'Memory (GB)', zeroline:false },
    yaxis: { automargin:true },
    legend: { orientation:'h', x:1, xanchor:'right', y:1.01, yanchor:'bottom' },  // above the plot: longest bars sit at the bottom
    hovermode: 'closest',
    margin: { t:36, r:80, b:55, l:20 },
    height: chartH,
  });

  // ── Box plots of raw peak RSS per process ──
  // Use same process order (most wasteful first, reversed so worst is at top)
  const allProcs = [...procs].reverse(); // worst at top for boxes too

  const boxTraces = allProcs.map(p => ({
    type: 'box', name: p.name,
    x: p.rssVals,
    orientation: 'h',
    boxpoints: p.rssVals.length <= 30 ? 'all' : 'outliers',
    jitter: 0.4,
    marker: { size: 4, opacity: 0.6, color: '#3fb950' },
    line: { color: '#3fb950' },
    fillcolor: '#3fb95033',
    hovertemplate: `<b>${p.name}</b><br>Peak RSS: %{x:.2f} GB<extra></extra>`,
  }));

  plot(boxesDiv, boxTraces, {
    xaxis: { title:'Peak RSS (GB)', zeroline:false },
    yaxis: { automargin:true },
    showlegend: false,
    hovermode: 'closest',
    margin: { t:10, r:20, b:55, l:20 },
    height: Math.max(360, allProcs.length * 26 + 80),
  });
}

