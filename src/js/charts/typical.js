// ═══════════════════════════════════════════════
// CHART 7: TYPICAL SAMPLE
// Computes per-sample stats on the fly and shows medians + distribution.
// Groups by (runId, sampleId) so each run/sample combo is one data point.
// ═══════════════════════════════════════════════

function computeSampleStats() {
  // Ignore status + sample filters so all samples appear; respect run filter.
  const tasks = getTasks({ ignoreStatus: true, ignoreSample: true });

  // Group by (runId, sampleId)
  const map = {};
  tasks.forEach(t => {
    const key = t.runId + '::' + t.sampleId;
    if (!map[key]) map[key] = { sample: t.sampleId, run: t.runName, tasks: [] };
    map[key].tasks.push(t);
  });

  return Object.values(map).map(({ sample, run, tasks: ts }) => {
    // CPU-hours: sum of realtime × cpus
    const cpuH = ts.reduce((s, t) => s + (t.cpuMs ? t.cpuMs / 3600000 : 0), 0);

    // Walltime: span from first start to last complete
    const starts    = ts.map(t => t.start).filter(Boolean);
    const completes = ts.map(t => t.complete).filter(Boolean);
    const wallH = (starts.length && completes.length)
      ? (Math.max(...completes.map(d => d.getTime())) - Math.min(...starts.map(d => d.getTime()))) / 3600000
      : null;

    // Peak concurrent CPUs and allocated memory within this sample
    const peakCpu = peakConcurrent(ts.filter(t => t.start && t.complete), t => t.cpus);

    // Peak RSS (max across tasks)
    const peakRssGB = Math.max(...ts.map(t => t.peakRss || 0)) / 1073741824;

    const peakAllocMem = peakConcurrent(ts.filter(t => t.start && t.complete && t.allocMem), t => t.allocMem);
    const peakAllocMemGB = peakAllocMem > 0 ? peakAllocMem / 1073741824 : null;

    // Total written bytes (both metrics)
    const writtenGB  = ts.reduce((s, t) => s + (t.wbytes     || 0), 0) / 1073741824;
    const wcharGB    = ts.reduce((s, t) => s + (t.wcharBytes || 0), 0) / 1073741824;

    const totalAllocCpus = ts.reduce((s, t) => s + (t.cpus || 0), 0);

    return { sample, run, cpuH, wallH, totalAllocCpus, peakCpu,
             peakRssGB: peakRssGB > 0 ? peakRssGB : null,
             peakAllocMemGB,
             writtenGB:  writtenGB > 0 ? writtenGB : null,
             wcharGB:    wcharGB   > 0 ? wcharGB   : null,
             nTasks: ts.length };
  });
}

let typicalSortKey = 'cpuH', typicalSortDir = -1;
let _cachedTypicalStats = null;

function sortTypical(key) {
  if (typicalSortKey === key) typicalSortDir *= -1;
  else { typicalSortKey = key; typicalSortDir = -1; }
  document.querySelectorAll('[id^="tarr-"]').forEach(el => { el.classList.remove('active'); el.textContent = '↕'; });
  const arr = document.getElementById('tarr-' + key);
  if (arr) { arr.classList.add('active'); arr.textContent = typicalSortDir === 1 ? '↑' : '↓'; }
  if (_cachedTypicalStats) renderTypicalTable(_cachedTypicalStats);
}

function downloadTypicalTSV() {
  const stats = _cachedTypicalStats;
  if (!stats || !stats.length) return;

  const headers = [
    'sample', 'run', 'cpu_hours', 'wall_hours',
    'total_alloc_cpus', 'peak_conc_cpus', 'peak_conc_ram_alloc_gb', 'peak_rss_task_gb',
    'written_gb_write_bytes', 'written_gb_wchar', 'n_tasks'
  ];
  const fmt = v => v == null ? '' : (typeof v === 'number' ? v.toFixed(4) : v);
  const rows = stats.map(r => [
    r.sample, r.run,
    fmt(r.cpuH), fmt(r.wallH),
    r.totalAllocCpus, r.peakCpu, fmt(r.peakAllocMemGB), fmt(r.peakRssGB),
    fmt(r.writtenGB), fmt(r.wcharGB), r.nTasks
  ].join('\t'));

  const tsv = [headers.join('\t'), ...rows].join('\n');
  const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'typical_sample_stats.tsv';
  a.click();
  URL.revokeObjectURL(url);
}

function renderTypicalTable(stats) {
  const sorted = stats.slice().sort((a,b) => {
    const va = a[typicalSortKey] ?? -Infinity;
    const vb = b[typicalSortKey] ?? -Infinity;
    if (typeof va === 'string') return typicalSortDir * va.localeCompare(vb);
    return typicalSortDir * (va - vb);
  });
  document.getElementById('typical-table-body').innerHTML = sorted.map(r => {
    const c = sampleColor(r.sample);
    return `<tr>
      <td style="font-weight:600"><span class="color-dot" style="background:${c}"></span>${r.sample}</td>
      <td style="color:var(--muted)">${r.run}</td>
      <td style="font-variant-numeric:tabular-nums">${r.cpuH.toFixed(2)}</td>
      <td style="font-variant-numeric:tabular-nums">${r.wallH != null ? r.wallH.toFixed(2) : '—'}</td>
      <td>${r.totalAllocCpus}</td>
      <td>${r.peakCpu}</td>
      <td>${r.peakAllocMemGB != null ? r.peakAllocMemGB.toFixed(1) + ' GB' : '—'}</td>
      <td>${r.peakRssGB != null ? r.peakRssGB.toFixed(1) + ' GB' : '—'}</td>
      <td style="font-variant-numeric:tabular-nums">${(state.writtenMetric === 'wchar' ? r.wcharGB : r.writtenGB) != null ? (state.writtenMetric === 'wchar' ? r.wcharGB : r.writtenGB).toFixed(1) : '—'}</td>
      <td>${r.nTasks}</td>
    </tr>`;
  }).join('');
}

function setWrittenMetric(metric) {
  state.writtenMetric = metric;
  document.getElementById('wb-btn-write_bytes').style.background = metric === 'write_bytes' ? '#1f6feb' : '#21262d';
  document.getElementById('wb-btn-write_bytes').style.color      = metric === 'write_bytes' ? '#fff'    : '#c9d1d9';
  document.getElementById('wb-btn-wchar').style.background       = metric === 'wchar'       ? '#1f6feb' : '#21262d';
  document.getElementById('wb-btn-wchar').style.color            = metric === 'wchar'       ? '#fff'    : '#c9d1d9';
  const hints = {
    'write_bytes': 'actual bytes flushed to disk',
    'wchar':       'all bytes passed to write() — includes pipes & temp files',
  };
  document.getElementById('wb-hint').textContent = '(' + hints[metric] + ')';
  renderTypicalSample();
}
function renderTypicalSample() {
  const stats = computeSampleStats();
  _cachedTypicalStats = stats;

  if (!stats.length) {
    document.getElementById('typical-cards').innerHTML =
      '<div style="color:var(--muted);font-size:0.85rem;padding:1rem;">No data loaded yet.</div>';
    return;
  }

  // ── Medians ──
  const cpuVals  = stats.map(s => s.cpuH).filter(v => v > 0);
  const wallVals = stats.map(s => s.wallH).filter(v => v != null);
  const tcVals   = stats.map(s => s.totalAllocCpus).filter(v => v > 0);
  const cpkVals  = stats.map(s => s.peakCpu).filter(v => v > 0);
  const memVals  = stats.map(s => s.peakRssGB).filter(v => v != null);
  const paVals   = stats.map(s => s.peakAllocMemGB).filter(v => v != null);
  const wbVals   = stats.map(s => state.writtenMetric === 'wchar' ? s.wcharGB : s.writtenGB).filter(v => v != null);

  const mCpu   = arrMedian(cpuVals);
  const mWall  = arrMedian(wallVals);
  const mTc    = arrMedian(tcVals);
  const mCpk   = arrMedian(cpkVals);
  const mMem   = arrMedian(memVals);
  const mPa    = arrMedian(paVals);
  const mWb    = arrMedian(wbVals);

  const q1Cpu  = arrQuantile(cpuVals,  0.25), q3Cpu  = arrQuantile(cpuVals,  0.75);
  const q1Wall = arrQuantile(wallVals, 0.25), q3Wall = arrQuantile(wallVals, 0.75);
  const q1Tc   = arrQuantile(tcVals,   0.25), q3Tc   = arrQuantile(tcVals,   0.75);
  const q1Cpk  = arrQuantile(cpkVals,  0.25), q3Cpk  = arrQuantile(cpkVals,  0.75);
  const q1Mem  = arrQuantile(memVals,  0.25), q3Mem  = arrQuantile(memVals,  0.75);
  const q1Pa   = arrQuantile(paVals,   0.25), q3Pa   = arrQuantile(paVals,   0.75);
  const q1Wb   = arrQuantile(wbVals,   0.25), q3Wb   = arrQuantile(wbVals,   0.75);

  const n = stats.length;
  const fmt1 = v => v != null ? v.toFixed(1) : '—';
  const fmt0 = v => v != null ? Math.round(v).toString() : '—';

  document.getElementById('typical-cards').innerHTML = `
    <div class="metric-card accent-green">
      <div class="metric-label">CPU-hours (median)</div>
      <div class="metric-value">${fmt1(mCpu)}</div>
      <div class="metric-sub">Q1 ${fmt1(q1Cpu)} · Q3 ${fmt1(q3Cpu)}</div>
    </div>
    <div class="metric-card accent-purple">
      <div class="metric-label">Walltime (median)</div>
      <div class="metric-value">${fmt1(mWall)} h</div>
      <div class="metric-sub">Q1 ${fmt1(q1Wall)} · Q3 ${fmt1(q3Wall)} h</div>
    </div>
    <div class="metric-card" style="border-color:#30363d">
      <div class="metric-label">Total CPUs allocated (median)</div>
      <div class="metric-value">${fmt0(mTc)}</div>
      <div class="metric-sub">Q1 ${fmt1(q1Tc)} · Q3 ${fmt1(q3Tc)}</div>
    </div>
    <div class="metric-card accent-yellow">
      <div class="metric-label">Peak Conc. CPUs (alloc, median)</div>
      <div class="metric-value">${fmt0(mCpk)}</div>
      <div class="metric-sub">Q1 ${fmt1(q1Cpk)} · Q3 ${fmt1(q3Cpk)}</div>
    </div>
    <div class="metric-card accent-blue">
      <div class="metric-label">Peak Conc. RAM (alloc, median)</div>
      <div class="metric-value">${paVals.length ? fmt1(mPa) + ' GB' : '—'}</div>
      <div class="metric-sub">${paVals.length ? 'Q1 ' + fmt1(q1Pa) + ' · Q3 ' + fmt1(q3Pa) + ' GB' : 'no allocation data'}</div>
    </div>
    <div class="metric-card" style="border-color:#30363d">
      <div class="metric-label">Peak RSS / task (median)</div>
      <div class="metric-value">${fmt1(mMem)} GB</div>
      <div class="metric-sub">Q1 ${fmt1(q1Mem)} · Q3 ${fmt1(q3Mem)} GB</div>
    </div>
    <div class="metric-card accent-red">
      <div class="metric-label">Written (median)</div>
      <div class="metric-value">${fmt1(mWb)} GB</div>
      <div class="metric-sub">Q1 ${fmt1(q1Wb)} · Q3 ${fmt1(q3Wb)} GB</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Samples</div>
      <div class="metric-value">${n}</div>
      <div class="metric-sub">sample × run combinations</div>
    </div>`;

  // ── Scatter: CPU-hours vs Written GB ──
  const scatterDiv = document.getElementById('chart-typical-scatter');

  const scatterTrace = {
    type: 'scatter', mode: 'markers',
    x: stats.map(s => s.cpuH),
    y: stats.map(s => (state.writtenMetric === 'wchar' ? s.wcharGB : s.writtenGB) ?? 0),
    text: stats.map(s =>
      `<b>${s.sample}</b><br>Run: ${s.run}<br>CPU-hrs: ${s.cpuH.toFixed(2)}<br>` +
      `Written (${state.writtenMetric === 'wchar' ? 'wchar' : 'write_bytes'}): ${(state.writtenMetric === 'wchar' ? s.wcharGB : s.writtenGB) != null ? (state.writtenMetric === 'wchar' ? s.wcharGB : s.writtenGB).toFixed(1) + ' GB' : '—'}<br>` +
      `Peak Conc. RAM (alloc): ${s.peakAllocMemGB != null ? s.peakAllocMemGB.toFixed(1) + ' GB' : '—'}<br>` +
      `Peak RSS / task: ${s.peakRssGB != null ? s.peakRssGB.toFixed(1) + ' GB' : '—'}<br>` +
      `Wall: ${s.wallH != null ? s.wallH.toFixed(2) + ' h' : '—'}<br>` +
      `Peak Conc. CPUs (alloc): ${s.peakCpu}`
    ),
    hovertemplate: '%{text}<extra></extra>',
    marker: {
      color: stats.map(s => sampleColor(s.sample)),
      size:  stats.map(s => s.peakRssGB != null ? Math.max(8, Math.min(30, s.peakRssGB * 0.6)) : 8),
      opacity: 0.85,
      line: { width: 1, color: '#30363d' },
    },
  };

  // median reference lines
  const xRange = [0, Math.max(...cpuVals) * 1.1];
  const yRange = [0, Math.max(...wbVals)  * 1.1];

  const medX = { type:'scatter', mode:'lines', name:'median CPU-hrs',
    x:[mCpu,mCpu], y:yRange,
    line:{color:'#58a6ff', width:1.5, dash:'dash'}, hoverinfo:'skip', showlegend:false };
  const medY = { type:'scatter', mode:'lines', name:'median written',
    x:xRange, y:[mWb,mWb],
    line:{color:'#3fb950', width:1.5, dash:'dash'}, hoverinfo:'skip', showlegend:false };

  plot(scatterDiv, [scatterTrace, medX, medY], {
    xaxis: { title:'CPU-hours', zeroline:false },
    yaxis: { title:'Written (GB)', zeroline:false },
    showlegend: false,
    hovermode: 'closest',
    margin: { t:10, r:20, b:55, l:70 },
    annotations: [
      { x:mCpu, y:yRange[1], xanchor:'left', yanchor:'top', text:`  median ${fmt1(mCpu)} h`,
        showarrow:false, font:{color:'#58a6ff', size:10} },
      { x:xRange[1], y:mWb, xanchor:'right', yanchor:'bottom', text:`median ${fmt1(mWb)} GB  `,
        showarrow:false, font:{color:'#3fb950', size:10} },
    ],
  });

  // ── Table ──
  renderTypicalTable(stats);
}

