// ═══════════════════════════════════════════════
// CHART 4: GANTT (scatter lines, y=sample, color=process)
// Each task is a thick horizontal line segment from start → complete.
// Using scatter (not bar) so Plotly handles datetime x-axis correctly —
// bar charts treat x as bar *width* (a duration), causing date math bugs.
// ═══════════════════════════════════════════════
function renderGantt() {
  const div  = document.getElementById('chart-gantt');
  const warn = document.getElementById('gantt-warn');
  const tasks = getTasks();
  const valid = tasks.filter(t => t.start && t.complete && t.complete > t.start);

  if (!valid.length) {
    Plotly.purge(div);
    warn.style.display = 'none';
    div.innerHTML = '<div class="chart-empty">No tasks with timing data for the selected filters</div>';
    return;
  }

  const MAX = 1200;
  let display = valid.slice().sort((a,b) => a.start - b.start);
  if (display.length > MAX) {
    warn.style.display = '';
    warn.textContent = `⚠ Showing first ${MAX} of ${display.length} tasks. Use the Sample filter above to focus on a specific sample.`;
    display = display.slice(0, MAX);
  } else {
    warn.style.display = 'none';
  }

  // One scatter trace per process (gives process-colored legend).
  // Each task = two points [start, complete] + null separator to break the line.
  // x uses actual Date objects → Plotly date axis renders them correctly.
  const procMap = {};
  const allProcs = [...new Set(display.map(t => t.procShort))].sort();

  display.forEach(t => {
    if (!procMap[t.procShort]) procMap[t.procShort] = { x: [], y: [], text: [] };
    const dur  = fmtHours(t.complete - t.start);
    const tip  = `<b>${t.procShort}</b><br>` +
                 `Sample: ${t.sampleId}<br>` +
                 `Status: ${t.status}<br>` +
                 `Start: ${t.start.toLocaleString()}<br>` +
                 `Duration: ${dur}<br>` +
                 `CPUs: ${t.cpus}`;
    // Three points per task: start, complete, null (breaks the line so segments are separate)
    procMap[t.procShort].x.push(t.start,      t.complete,  null);
    procMap[t.procShort].y.push(t.sampleId,   t.sampleId,  null);
    procMap[t.procShort].text.push(tip,        tip,         '');
  });

  const traces = allProcs.map(proc => {
    const d = procMap[proc];
    if (!d) return null;
    const color = processColor(proc);
    return {
      type: 'scatter',
      mode: 'lines',
      name: proc,
      x: d.x,
      y: d.y,
      text: d.text,
      hovertemplate: '%{text}<extra></extra>',
      line: { width: 12, color },
      opacity: 0.78,
      connectgaps: false,   // null values create breaks between segments
    };
  }).filter(Boolean);

  // Determine y-axis order: samples sorted, reference/shared tasks at bottom
  const uniqSamples = [...new Set(display.map(t => t.sampleId))]
    .sort((a,b) => {
      // push (reference) and single-word keys to bottom
      const aRef = a.startsWith('(') || !a.includes('-');
      const bRef = b.startsWith('(') || !b.includes('-');
      if (aRef && !bRef) return 1;
      if (!aRef && bRef) return -1;
      return a.localeCompare(b);
    });

  // Height scales with number of unique samples
  const h = Math.max(420, Math.min(1000, uniqSamples.length * 32 + 120));
  div.style.height = h + 'px';

  plot(div, traces, {
    xaxis: {
      type: 'date',
      tickformat: '%b %d\n%H:%M',
      title: '',
    },
    yaxis: {
      automargin: true,
      categoryorder: 'array',
      categoryarray: [...uniqSamples].reverse(), // first sample at top
    },
    legend: {
      font: { size: 9 }, orientation: 'v',
      title: { text: 'Process', font: { size: 10, color: '#8b949e' } },
    },
    margin: { t: 10, r: 10, b: 55, l: 190 },
    hovermode: 'closest',
  });
}

