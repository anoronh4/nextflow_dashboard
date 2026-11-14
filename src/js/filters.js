// Filters. getTasks() is the single entry point for task data: it applies isRealSample, the
// Processes filter (always), status/sample/run filters (unless ignored) and anonymization.
// Uses: state (state.js), sampleLabel/runLabel (anonymize.js), updateAll (app.js).

// ═══════════════════════════════════════════════
// FILTERS
// ═══════════════════════════════════════════════
function toggleStatus(btn) {
  const s = btn.dataset.status;
  if (state.activeStatuses.has(s)) {
    state.activeStatuses.delete(s);
    btn.classList.remove('active','active-green','active-red');
  } else {
    state.activeStatuses.add(s);
    if (s==='COMPLETED') btn.classList.add('active-green');
    else if (s==='FAILED') btn.classList.add('active-red');
    else btn.classList.add('active');
  }
  updateAll();
}

// Reference/shared tasks that are not real biological samples.
// Excluded from all charts and the sample filter dropdown.
function isRealSample(sampleId) {
  if (!sampleId) return false;
  const s = sampleId.toLowerCase();
  if (s === '(reference)')                   return false;
  if (s === 'genome.fa')                     return false;
  if (s === 'grch38')                        return false;
  if (s.startsWith('blocklist_breakpoints')) return false;
  // catch any other bare filename-style tags (no dash, contains a dot)
  if (!s.includes('-') && s.includes('.'))   return false;
  return true;
}

// Process filter: tracks *excluded* names so processes from newly loaded runs start checked.
// Applied unconditionally in getTasks, so it affects every chart, table and metric.
function allProcCounts() {
  const counts = new Map();
  state.runs.forEach(r => r.tasks.forEach(t => {
    if (isRealSample(t.sampleId)) counts.set(t.procShort, (counts.get(t.procShort) || 0) + 1);
  }));
  return counts;
}

function renderProcList() {
  const counts = allProcCounts();
  const names = [...counts.keys()].sort();
  const q = document.getElementById('proc-search').value.trim().toLowerCase();
  const esc = s => s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  document.getElementById('proc-list').innerHTML = names
    .filter(n => !q || n.toLowerCase().includes(q))
    .map(n => `<label><input type="checkbox" data-proc="${esc(n)}"${state.excludedProcs.has(n) ? '' : ' checked'}
      onchange="toggleProc(this)"> ${esc(n)}<span class="proc-count">${counts.get(n)}</span></label>`)
    .join('') || '<div style="color:var(--muted);padding:4px">No matching processes</div>';

  const nOff = names.filter(n => state.excludedProcs.has(n)).length;
  document.getElementById('proc-filter-btn').textContent =
    (nOff === 0 ? 'All processes' : `${names.length - nOff} of ${names.length} processes`) + ' ▾';
  document.getElementById('proc-filter-btn').style.borderColor = nOff ? 'var(--accent)' : '';
}

function toggleProc(cb) {
  if (cb.checked) state.excludedProcs.delete(cb.dataset.proc);
  else state.excludedProcs.add(cb.dataset.proc);
  renderProcList();
  updateAll();
}

// Applies to the processes currently visible in the list (respects the search box).
function setAllProcs(on) {
  document.querySelectorAll('#proc-list input[type=checkbox]').forEach(cb => {
    if (on) state.excludedProcs.delete(cb.dataset.proc);
    else state.excludedProcs.add(cb.dataset.proc);
  });
  renderProcList();
  updateAll();
}

function toggleProcPanel(e) {
  e.stopPropagation();
  const p = document.getElementById('proc-panel');
  p.style.display = p.style.display === 'none' ? '' : 'none';
  if (p.style.display === '') document.getElementById('proc-search').focus();
}

function getTasks({ ignoreStatus=false, ignoreSample=false, ignoreRun=false }={}) {
  let tasks = state.runs.flatMap(r => r.tasks).filter(t => isRealSample(t.sampleId));
  if (state.excludedProcs.size) tasks = tasks.filter(t => !state.excludedProcs.has(t.procShort));
  if (!ignoreStatus) tasks = tasks.filter(t => state.activeStatuses.has(t.status));
  if (!ignoreSample) {
    const s = document.getElementById('filter-sample').value;
    if (s) tasks = tasks.filter(t => t.sampleId === s);
  }
  if (!ignoreRun) {
    const r = document.getElementById('filter-run').value;
    if (r) tasks = tasks.filter(t => String(t.runId) === r);
  }
  if (state.anonymize) {
    // tag is replaced wholesale: the part after '@' can carry other IDs
    const runNames = new Map(state.runs.map(r => [r.id, runLabel(r)]));
    tasks = tasks.map(t => {
      const a = sampleLabel(t.sampleId);
      return { ...t, sampleId: a, tag: a, runName: runNames.get(t.runId) };
    });
  }
  return tasks;
}

