// Global mutable app state. Filter DOM controls are the source of truth for sample/run
// selection (see getTasks in filters.js); this object holds everything else.

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const state = {
  runs: [],            // [{id, name, tasks}]
  activeStatuses: new Set(['COMPLETED','FAILED','CACHED']),
  anonymize:      false,       // show Sample 001 / Run 1 aliases instead of real IDs
  excludedProcs:  new Set(),   // procShort names unchecked in the Processes filter
  activeTab: 'concurrent',
  procSortOrder:   'median',  // 'median' | 'alpha'
  procColorOrder:  'median',  // 'median' | 'alpha'
  writtenMetric:   'write_bytes', // 'write_bytes' | 'wchar'
};

