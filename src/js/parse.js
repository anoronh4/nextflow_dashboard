// Trace parsing. parseTrace turns one execution_trace.txt into flat task objects, resolving
// columns by header name and normalising units at parse time: timestamps → Date,
// durations → ms, memory → bytes, missing values ('-') → null.

// ═══════════════════════════════════════════════
// PARSING
// ═══════════════════════════════════════════════
function parseTS(s) {
  if (!s || s === '-') return null;
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

function parseDurMs(s) {
  if (!s || s === '-') return null;
  let ms = 0;
  const d = s.match(/(\d+(?:\.\d+)?)d/);
  const h = s.match(/(\d+(?:\.\d+)?)h/);
  const m = s.match(/(\d+(?:\.\d+)?)m(?!s)/);
  const se = s.match(/(\d+(?:\.\d+)?)s/);
  const ms2 = s.match(/(\d+(?:\.\d+)?)ms/);
  if (d)  ms += parseFloat(d[1])  * 86400000;
  if (h)  ms += parseFloat(h[1])  * 3600000;
  if (m)  ms += parseFloat(m[1])  * 60000;
  if (se) ms += parseFloat(se[1]) * 1000;
  if (ms2) ms += parseFloat(ms2[1]);
  return ms > 0 ? ms : null;
}

function parseMemB(s) {
  if (!s || s === '-') return null;
  const m = s.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!m) return null;
  const u = {B:1,KB:1024,MB:1048576,GB:1073741824,TB:1099511627776};
  return parseFloat(m[1]) * (u[m[2].toUpperCase()]||1);
}

function shortProc(p) {
  const parts = p.split(':');
  return parts[parts.length-1];
}

function extractSample(tag) {
  if (!tag || tag === '-') return '(reference)';
  return tag.split('@')[0];
}

function parseTrace(text, runName, runId) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const hdrs = lines[0].split('\t').map(h => h.trim());
  const get = (cols, name) => { const i = hdrs.indexOf(name); return i >= 0 ? (cols[i]||'').trim() : ''; };

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const c = line.split('\t');
    const cpus = parseInt(get(c,'cpus')) || 1;
    const submit   = parseTS(get(c,'submit'));
    const start    = parseTS(get(c,'start'));
    const complete = parseTS(get(c,'complete'));
    const realtimeMs = parseDurMs(get(c,'realtime'));
    return {
      runId, runName,
      taskId:     get(c,'task_id'),
      process:    get(c,'process'),
      procShort:  shortProc(get(c,'process')),
      tag:        get(c,'tag'),
      sampleId:   extractSample(get(c,'tag')),
      status:     get(c,'status'),
      cpus,
      submit, start, complete,
      durationMs:  parseDurMs(get(c,'duration')),
      realtimeMs,
      peakRss:    parseMemB(get(c,'peak_rss')),
      allocMem:   parseMemB(get(c,'memory')),
      cpuPct:     parseFloat((get(c,'%cpu')||'0').replace('%','')) || 0,
      cpuMs:      (realtimeMs && cpus) ? realtimeMs * cpus : null,
      wbytes:     parseMemB(get(c,'write_bytes')) ?? (parseFloat(get(c,'write_bytes')) || null),
      wcharBytes: parseMemB(get(c,'wchar'))        ?? (parseFloat(get(c,'wchar'))        || null),
    };
  });
}

