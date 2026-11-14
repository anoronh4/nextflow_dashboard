// ═══════════════════════════════════════════════
// CHART 4: PROCESS DURATION BOX PLOTS
// ═══════════════════════════════════════════════
function setProcSort(order) {
  state.procSortOrder = order;
  document.getElementById('proc-sort-median').style.background = order === 'median' ? '#1f6feb' : '#21262d';
  document.getElementById('proc-sort-median').style.color      = order === 'median' ? '#fff'    : '#c9d1d9';
  document.getElementById('proc-sort-alpha').style.background  = order === 'alpha'  ? '#1f6feb' : '#21262d';
  document.getElementById('proc-sort-alpha').style.color       = order === 'alpha'  ? '#fff'    : '#c9d1d9';
  renderProcess();
}
function setProcColor(order) {
  state.procColorOrder = order;
  document.getElementById('proc-color-median').style.background = order === 'median' ? '#1f6feb' : '#21262d';
  document.getElementById('proc-color-median').style.color      = order === 'median' ? '#fff'    : '#c9d1d9';
  document.getElementById('proc-color-alpha').style.background  = order === 'alpha'  ? '#1f6feb' : '#21262d';
  document.getElementById('proc-color-alpha').style.color       = order === 'alpha'  ? '#fff'    : '#c9d1d9';
  renderProcess();
}
function renderProcess() {
  const div = document.getElementById('chart-process');
  const tasks = getTasks().filter(t => t.realtimeMs);

  if (!tasks.length) {
    Plotly.purge(div);
    div.innerHTML = '<div class="chart-empty">No tasks with timing data for the selected filters</div>';
    return;
  }

  const byProc = {};
  tasks.forEach(t => {
    if (!byProc[t.procShort]) byProc[t.procShort] = [];
    byProc[t.procShort].push(t.realtimeMs / 60000); // minutes
  });

  const entries = Object.entries(byProc)
    .map(([name, vals]) => {
      vals.sort((a,b)=>a-b);
      return { name, vals, med: vals[Math.floor(vals.length/2)] };
    });

  // Sort order
  const sorted = (state.procSortOrder === 'alpha'
    ? entries.slice().sort((a,b) => a.name.localeCompare(b.name))
    : entries.slice().sort((a,b) => b.med - a.med)
  ).slice(0, 25);

  // Color: by position in the median-sorted list, or the shared per-process color (A→Z, matches Job Timeline)
  const colorFor = name => state.procColorOrder === 'alpha'
    ? processColor(name)
    : DISTINCT_PALETTE[sorted.findIndex(e => e.name === name) % DISTINCT_PALETTE.length];

  const traces = sorted.map(({name, vals}) => {
    const col = colorFor(name);
    return {
      type: 'box', name,
      y: vals,
      boxpoints: vals.length <= 30 ? 'all' : 'outliers',
      jitter: 0.35, pointpos: 0,
      marker: { color: col, size: 4, opacity: 0.7 },
      line: { color: col },
      fillcolor: col + '40',
      hovertemplate: `<b>${name}</b><br>%{y:.2f} min<extra></extra>`,
    };
  });

  plot(div, traces, {
    font: { size:10 },
    xaxis: { tickangle:-40, automargin:true },
    yaxis: { title:'Duration (minutes)', zeroline:false },
    showlegend: false,
    margin: { t:20, r:20, b:140, l:70 },
  });
}

