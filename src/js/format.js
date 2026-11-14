// Display formatting and small stats helpers. Renderers work in ms/bytes and format only at the
// edge with fmtHours / fmtBytes.

function fmtBytes(b) {
  if (!b) return '—';
  if (b >= 1073741824) return (b/1073741824).toFixed(1)+' GB';
  if (b >= 1048576)    return (b/1048576).toFixed(0)+' MB';
  if (b >= 1024)       return (b/1024).toFixed(0)+' KB';
  return b+' B';
}

function fmtHours(ms) {
  if (!ms) return '—';
  const h = ms/3600000;
  if (h >= 24)  return (h/24).toFixed(1)+'d';
  if (h >= 1)   return h.toFixed(2)+'h';
  const mn = ms/60000;
  if (mn >= 1)  return mn.toFixed(1)+'m';
  return (ms/1000).toFixed(1)+'s';
}

function arrMedian(arr) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a,b) => a-b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
}
function arrQuantile(arr, q) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a,b) => a-b);
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (pos - lo) * (s[hi] - s[lo]);
}

