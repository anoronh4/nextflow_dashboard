// ═══════════════════════════════════════════════
// FILE LOADING
// ═══════════════════════════════════════════════
function handleFiles(files) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const runId = Date.now() + Math.random();
      // Try to extract run timestamp from path like "2026-01-25_14-56-25/execution_trace.txt"
      let runName = file.webkitRelativePath
        ? file.webkitRelativePath.split('/').slice(-2,-1)[0]
        : file.name.replace('execution_trace','').replace('.txt','').replace(/^[\s._-]+|[\s._-]+$/g, '') || `Run ${state.runs.length+1}`;
      if (!runName) runName = `Run ${state.runs.length+1}`;

      const tasks = parseTrace(e.target.result, runName, runId);
      if (!tasks.length) { alert(`Could not parse ${file.name}.\nMake sure it is a Nextflow execution_trace.txt file.`); return; }

      state.runs.push({ id: runId, name: runName, tasks });
      onDataLoaded();
    };
    reader.readAsText(file);
  });
}

function onDataLoaded() {
  assignAliases();
  renderIdLabels();
  renderProcList();

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('dashboard').style.display = '';
  updateAll();
}

document.addEventListener('click', e => {
  if (!document.getElementById('proc-filter').contains(e.target))
    document.getElementById('proc-panel').style.display = 'none';
});

// ═══════════════════════════════════════════════
// ROUTING
// ═══════════════════════════════════════════════
function switchTab(btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.activeTab = btn.dataset.tab;
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  document.getElementById('pane-' + state.activeTab).style.display = '';
  renderActiveTab();
}

function updateAll() {
  renderMetrics();
  renderActiveTab();
}

function renderActiveTab() {
  if      (state.activeTab === 'concurrent') renderConcurrent();
  else if (state.activeTab === 'actualcpu')  renderActualCpu();
  else if (state.activeTab === 'memory')     renderMemory();
  else if (state.activeTab === 'allocmem')   renderAllocMem();
  else if (state.activeTab === 'gantt')      renderGantt();
  else if (state.activeTab === 'table')      renderTable();
  else if (state.activeTab === 'process')    renderProcess();
  else if (state.activeTab === 'cpueff')     renderCpuEff();
  else if (state.activeTab === 'memeff')     renderMemEff();
  else if (state.activeTab === 'typical')    renderTypicalSample();
  else if (state.activeTab === 'queue')      renderQueueWait();
}

// ═══════════════════════════════════════════════
// METRICS
// ═══════════════════════════════════════════════
function renderMetrics() {
  const tasks   = getTasks();
  const allTask = getTasks({ ignoreStatus:true });

  const done    = allTask.filter(t=>t.status==='COMPLETED').length;
  const failed  = allTask.filter(t=>t.status==='FAILED').length;
  const cached  = allTask.filter(t=>t.status==='CACHED').length;
  const cpuMs   = tasks.reduce((s,t) => s + (t.cpuMs||0), 0);
  const starts  = tasks.map(t=>t.start).filter(Boolean);
  const ends    = tasks.map(t=>t.complete).filter(Boolean);
  const wallMs  = (starts.length && ends.length)
    ? Math.max(...ends.map(d=>d.getTime())) - Math.min(...starts.map(d=>d.getTime())) : null;
  const peakCPU = computePeak(tasks);
  const samples = new Set(tasks.filter(t=>t.start).map(t=>t.sampleId)).size;

  document.getElementById('metric-grid').innerHTML = `
    <div class="metric-card accent-blue">
      <div class="metric-label">Total Jobs</div>
      <div class="metric-value">${tasks.length.toLocaleString()}</div>
      <div class="metric-sub">${done} done · ${failed} failed · ${cached} cached</div>
    </div>
    <div class="metric-card accent-green">
      <div class="metric-label">CPU-hours</div>
      <div class="metric-value">${cpuMs ? (cpuMs/3600000).toFixed(1) : '—'}</div>
      <div class="metric-sub">realtime × CPUs</div>
    </div>
    <div class="metric-card accent-purple">
      <div class="metric-label">Wall Time</div>
      <div class="metric-value">${wallMs ? fmtHours(wallMs) : '—'}</div>
      <div class="metric-sub">first start → last complete</div>
    </div>
    <div class="metric-card accent-yellow">
      <div class="metric-label">Peak CPUs</div>
      <div class="metric-value">${peakCPU}</div>
      <div class="metric-sub">max simultaneous CPUs</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Samples</div>
      <div class="metric-value">${samples}</div>
      <div class="metric-sub">unique sample IDs</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Runs Loaded</div>
      <div class="metric-value">${state.runs.length}</div>
      <div class="metric-sub">trace files</div>
    </div>`;
}

function computePeak(tasks) {
  return peakConcurrent(tasks.filter(t => t.start && t.complete), t => t.cpus);
}

// ═══════════════════════════════════════════════
// DRAG & DROP + FILE INPUT
// ═══════════════════════════════════════════════
const zone  = document.getElementById('upload-zone');
const finput = document.getElementById('file-input');

zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
zone.addEventListener('dragleave', ()  => zone.classList.remove('dragover'));
zone.addEventListener('drop', e => {
  e.preventDefault(); zone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
finput.addEventListener('change', e => { handleFiles(e.target.files); finput.value=''; });
