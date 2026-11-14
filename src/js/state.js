// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const state = {
  runs: [],            // [{id, name, tasks}]
  activeStatuses: new Set(['COMPLETED','FAILED','CACHED']),
  anonymize:      false,       // show Sample 001 / Run 1 aliases instead of real IDs
  excludedProcs:  new Set(),   // procShort names unchecked in the Processes filter
  activeTab: 'concurrent',
  sortKey: 'cpuHours',
  sortDir: -1,
  procSortOrder:   'median',  // 'median' | 'alpha'
  procColorOrder:  'median',  // 'median' | 'alpha'
  writtenMetric:   'write_bytes', // 'write_bytes' | 'wchar'
};

