// ═══════════════════════════════════════════════
// CHART 3: SAMPLE TABLE
// ═══════════════════════════════════════════════
let sortKey = 'cpuHours', sortDir = -1;

function sortBy(key) {
  if (sortKey === key) sortDir *= -1;
  else { sortKey = key; sortDir = -1; }
  // update arrow indicators
  document.querySelectorAll('.sort-arrow').forEach(el => el.classList.remove('active'));
  const arr = document.getElementById('arr-'+key);
  if (arr) { arr.classList.add('active'); arr.textContent = sortDir===1?'↑':'↓'; }
  renderTable();
}

function renderTable() {
  // ignore status+sample filters for table to show full picture
  const tasks = getTasks({ ignoreStatus:true, ignoreSample:true });

  // group by (runName, sampleId)
  const map = {};
  tasks.forEach(t => {
    const key = t.runId + '::' + t.sampleId;
    if (!map[key]) map[key] = {
      sample:t.sampleId, run:t.runName,
      jobs:0, completed:0, failed:0, cached:0,
      cpuMs:0, totalCpus:0, maxCpus:0, peakRss:0,
      starts:[], ends:[]
    };
    const r = map[key];
    r.jobs++;
    if (t.status==='COMPLETED') r.completed++;
    else if (t.status==='FAILED') r.failed++;
    else if (t.status==='CACHED') r.cached++;
    if (t.cpuMs) r.cpuMs += t.cpuMs;
    if (t.cpus)  r.totalCpus += t.cpus;
    if (t.cpus > r.maxCpus) r.maxCpus = t.cpus;
    if (t.peakRss && t.peakRss > r.peakRss) r.peakRss = t.peakRss;
    if (t.start)    r.starts.push(t.start.getTime());
    if (t.complete) r.ends.push(t.complete.getTime());
  });

  const rows = Object.values(map).map(r => ({
    ...r,
    cpuHours:  r.cpuMs / 3600000,
    wallHours: (r.starts.length && r.ends.length)
      ? (Math.max(...r.ends) - Math.min(...r.starts)) / 3600000 : 0,
  }));

  rows.sort((a,b) => {
    const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
    if (typeof va === 'string') return sortDir * va.localeCompare(vb);
    return sortDir * (va - vb);
  });

  document.getElementById('table-body').innerHTML = rows.map(r => {
    const c = sampleColor(r.sample);
    return `<tr>
      <td style="font-weight:600"><span class="color-dot" style="background:${c}"></span>${r.sample}</td>
      <td style="color:var(--muted)">${r.run}</td>
      <td>${r.jobs}</td>
      <td><span class="sbadge sbadge-ok">${r.completed}</span></td>
      <td>${r.failed>0?`<span class="sbadge sbadge-fail">${r.failed}</span>`:'<span style="color:var(--muted)">—</span>'}</td>
      <td><span class="sbadge sbadge-cache">${r.cached}</span></td>
      <td style="font-variant-numeric:tabular-nums">${r.cpuHours>0?r.cpuHours.toFixed(2):'—'}</td>
      <td style="font-variant-numeric:tabular-nums">${r.wallHours>0?r.wallHours.toFixed(2):'—'}</td>
      <td>${r.totalCpus}</td>
      <td>${r.maxCpus}</td>
      <td>${fmtBytes(r.peakRss)}</td>
    </tr>`;
  }).join('');
}

