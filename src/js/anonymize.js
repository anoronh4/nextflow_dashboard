// Anonymize IDs. Aliases (Sample 001…, Run N) are applied at the end of getTasks and in the
// labels. renderIdLabels also (re)builds the sample/run dropdowns and header run chips, since
// it is what decides real vs alias labels. Filters keep using real IDs.
// Uses: state (state.js), PALETTE and sampleRank, which it rebuilds (colors.js),
// isRealSample (filters.js), updateAll (app.js).

// ═══════════════════════════════════════════════
// ANONYMIZATION
// ═══════════════════════════════════════════════
// Aliases are assigned in first-seen order, so a sample keeps its alias when more runs are loaded.
// Filters keep using real IDs (dropdown values); only what getTasks returns and the
// dropdown/chip labels are aliased, so every chart, table and download follows the toggle.
const sampleAlias   = new Map();  // real sampleId → 'Sample 001'
const aliasToSample = new Map();  // 'Sample 001' → real sampleId (for sampleColor)

function assignAliases() {
  state.runs.forEach(r => r.tasks.forEach(t => {
    if (!isRealSample(t.sampleId) || sampleAlias.has(t.sampleId)) return;
    const a = `Sample ${String(sampleAlias.size + 1).padStart(3, '0')}`;
    sampleAlias.set(t.sampleId, a);
    aliasToSample.set(a, t.sampleId);
  }));
  sampleRank = new Map([...sampleAlias.keys()].sort().map((s, i) => [s, i]));
}

const sampleLabel = id  => state.anonymize ? (sampleAlias.get(id) ?? 'Sample ?') : id;
const runLabel    = run => state.anonymize ? `Run ${state.runs.indexOf(run) + 1}` : run.name;

// Sample/run dropdown option labels and header run chips (values stay real IDs).
function renderIdLabels() {
  const samples = [...sampleAlias.keys()].sort((a, b) => sampleLabel(a).localeCompare(sampleLabel(b)));
  const sf = document.getElementById('filter-sample');
  const curS = sf.value;
  sf.innerHTML = '<option value="">All samples</option>' +
    samples.map(s => `<option value="${s}"${s===curS?' selected':''}>${sampleLabel(s)}</option>`).join('');

  const rf = document.getElementById('filter-run');
  const curR = rf.value;
  rf.innerHTML = '<option value="">All runs</option>' +
    state.runs.map(r => `<option value="${r.id}"${String(r.id)===curR?' selected':''}>${runLabel(r)}</option>`).join('');

  document.getElementById('run-chips').innerHTML = state.runs.map((r,i) => {
    const c = PALETTE[i % PALETTE.length];
    return `<div class="run-chip" style="background:${c}1a;border-color:${c};color:${c}">
      <span class="chip-dot" style="background:${c}"></span>${runLabel(r)}
    </div>`;
  }).join('');
}

function toggleAnonymize() {
  state.anonymize = !state.anonymize;
  document.getElementById('btn-anon').classList.toggle('active', state.anonymize);
  renderIdLabels();
  updateAll();
}

