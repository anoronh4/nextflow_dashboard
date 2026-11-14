// ═══════════════════════════════════════════════
// CHART: QUEUE WAIT
// Shows (1) concurrent pending task count over time, stacked by sample
//        (2) box-plot of queue wait time per process
// ═══════════════════════════════════════════════
function renderQueueWait() {
  const tasks = getTasks();

  // Tasks need submit + start to compute queue wait
  const valid = tasks.filter(t => t.submit && t.start);

  // ── Concurrent pending chart ──
  const concDiv = document.getElementById('chart-queue-concurrent');
  if (!valid.length) {
    Plotly.purge(concDiv);
    concDiv.innerHTML = '<div class="chart-empty">No tasks with submit/start timing for the selected filters</div>';
  } else {
    // Pending = submitted but not started: +1 at submit, -1 at start.
    const { times, byS, samples } = stackedSteps(valid, t => t.submit, t => t.start, () => 1);

    const traces = samples.map(s => ({
      type: 'scatter', mode: 'lines', name: s,
      x: times, y: byS[s],
      stackgroup: 'pending',
      line: { width: 0, color: sampleColor(s) },
      fillcolor: sampleColor(s) + 'b0',
      hovertemplate: `<b>${s}</b><br>%{x|%b %d %H:%M:%S}<br>Pending: %{y}<extra></extra>`,
    }));

    plot(concDiv, traces, {
      xaxis: { tickformat:'%b %d\n%H:%M', title:'' },
      yaxis: { title:'Pending tasks', zeroline:false },
      hovermode: 'x unified',
      margin: { t:20, r:20, b:55, l:65 },
    });
  }

  // ── Queue wait by process (box plots) ──
  const procDiv = document.getElementById('chart-queue-process');
  if (!valid.length) {
    Plotly.purge(procDiv);
    procDiv.innerHTML = '<div class="chart-empty">No tasks with submit/start timing for the selected filters</div>';
    return;
  }

  // Group wait times (seconds) by short process name
  const byProc = {};
  valid.forEach(t => {
    const waitS = (t.start.getTime() - t.submit.getTime()) / 1000;
    if (waitS < 0) return; // guard against clock skew
    const p = t.procShort;
    if (!byProc[p]) byProc[p] = [];
    byProc[p].push(waitS);
  });

  // Sort by median wait descending, take top 25
  const medianOf = arr => {
    const s = arr.slice().sort((a,b) => a-b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
  };
  const procs = Object.keys(byProc)
    .sort((a,b) => medianOf(byProc[b]) - medianOf(byProc[a]))
    .slice(0, 25)
    .reverse(); // reverse so largest median ends up at top of horizontal chart

  // Use minutes if any wait exceeds 2 min, otherwise seconds
  const allWaits = procs.flatMap(p => byProc[p]);
  const maxWait = Math.max(...allWaits);
  const useMin = maxWait > 120;
  const scale = useMin ? 1/60 : 1;
  const unit  = useMin ? 'min' : 's';

  const boxTraces = procs.map(p => ({
    type: 'box',
    name: p,
    x: byProc[p].map(v => v * scale),
    orientation: 'h',
    boxpoints: byProc[p].length <= 30 ? 'all' : 'outliers',
    jitter: 0.4,
    marker: { size: 4, opacity: 0.6, color: '#58a6ff' },
    line: { color: '#58a6ff' },
    fillcolor: '#1f6feb44',
    hovertemplate: `<b>${p}</b><br>Wait: %{x:.1f} ${unit}<extra></extra>`,
  }));

  plot(procDiv, boxTraces, {
    xaxis: { title:`Queue wait (${unit})`, zeroline:false },
    yaxis: { automargin: true },
    showlegend: false,
    hovermode: 'closest',
    margin: { t:10, r:20, b:55, l:20 },
  });
}

