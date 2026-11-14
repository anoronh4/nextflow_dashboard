// Colours. DISTINCT_PALETTE is validated (see the comment on it); colour follows the entity:
// samples by A→Z rank among loaded samples, processes by A→Z rank among checked processes.
// Uses: state (state.js), allProcCounts (filters.js), aliasToSample (anonymize.js).

// ═══════════════════════════════════════════════
// PALETTE
// ═══════════════════════════════════════════════
const PALETTE = [
  '#58a6ff','#3fb950','#f78166','#d2a8ff','#e3b341','#79c0ff','#56d364','#ffa198','#c9d1d9',
  '#1f6feb','#238636','#da3633','#8957e5','#9e6a03','#388bfd','#2ea043','#f85149','#6e40c9',
  '#b08800','#0d419d','#1a7f37','#b62324','#553098','#7d4e00','#388bfd','#4ac26b','#ff7b72',
  '#a371f7','#d4a72c','#0969da'
];
// Sample and process colors. Ordered by farthest-point selection in OKLab: any k-prefix is as
// spread out as possible, and every pair within the first 10 is ΔE ≥ 15 (clearly distinct to
// normal vision) with ≥ 3:1 contrast on the dark surface. Slots 11–16 are progressively closer.
// Every *consecutive* pair, including the 16→1 wrap, also clears CVD ΔE ≥ 8, so cycling it over
// a sorted list keeps touching bands in stacked charts distinct no matter how many there are.
const DISTINCT_PALETTE = [
  '#669bf1','#cc2a1b','#85c814','#25855b','#fe7fc0','#a23db8','#f99603','#4dc8ba','#a97e2c','#4761e4',
  '#b96989','#c171f6','#ff5e4a','#177ba8','#c19fe9','#7dab64',
];
// Color follows the process, ranked A→Z among the processes checked in the Processes filter —
// so narrowing the filter to a handful gives them the most distinct slots, and a process keeps
// its color across tabs and across status/sample/run filtering.
function processColor(name) {
  const names = [...allProcCounts().keys()].filter(n => !state.excludedProcs.has(n)).sort();
  const i = names.indexOf(name);
  return DISTINCT_PALETTE[(i < 0 ? 0 : i) % DISTINCT_PALETTE.length];
}

// Color follows the sample: its A→Z rank among all loaded samples. Stacked charts order samples
// A→Z too, so neighboring bands get consecutive (well-separated) palette slots.
let sampleRank = new Map();  // real sampleId → index; rebuilt in assignAliases()
function sampleColor(s) {
  s = aliasToSample.get(s) ?? s;  // anonymized labels share the real sample's color
  return DISTINCT_PALETTE[(sampleRank.get(s) ?? 0) % DISTINCT_PALETTE.length];
}

