// ═══════════════════════════════════════════════
// PLOT HELPERS — shared layout/config + large-text PNG export
// ═══════════════════════════════════════════════
const PLOT_FONT    = { color:'#c9d1d9', family:'system-ui,sans-serif', size:11 };
const AXIS_STYLE   = { gridcolor:'#21262d', tickcolor:'#30363d', linecolor:'#30363d' };
const LEGEND_STYLE = { bgcolor:'#161b22', bordercolor:'#30363d', borderwidth:1, font:{ size:10 } };

// Per-chart layout on top of the shared dark theme. font/xaxis/yaxis/legend are merged
// with the shared styles rather than replacing them, so charts only state what differs.
function plotLayout(l) {
  return {
    paper_bgcolor:'transparent', plot_bgcolor:'transparent',
    ...l,
    font:   { ...PLOT_FONT, ...l.font },
    xaxis:  { ...AXIS_STYLE, ...l.xaxis },
    yaxis:  { ...AXIS_STYLE, ...l.yaxis },
    legend: { ...LEGEND_STYLE, ...l.legend, font:{ ...LEGEND_STYLE.font, ...(l.legend || {}).font } },
  };
}

function plot(div, traces, layout) {
  Plotly.react(div, traces, plotLayout(layout), PLOT_CONFIG);
}

// Export: re-render an off-screen copy with larger text/marks so downloads stay legible
// on slides and in figures. The on-screen chart is never modified.
const EXPORT = { fontScale: 1.6, lineScale: 1.5, markerScale: 1.3, pixelRatio: 2 };
const EXPORT_BG = { dark: '#0d1117', light: '#ffffff' };
// Dark-theme UI colors → light equivalents (prefix match, so alpha suffixes like '#30363d44' survive).
// '#30363d' doubles as the dim "allocated" bar color, so it maps to a light grey to stay dim on white.
const LIGHT_REMAP = {
  '#c9d1d9':'#24292f', '#e6edf3':'#24292f', '#8b949e':'#57606a',
  '#30363d':'#d0d7de', '#21262d':'#eaeef2', '#161b22':'#ffffff', '#0d1117':'#ffffff',
};
const ICON_MOON = { width:24, height:24, path:'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' };
const ICON_SUN  = { width:24, height:24,
  path:'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z M11 1h2v4h-2z M11 19h2v4h-2z M1 11h4v2H1z M19 11h4v2h-4z' };

const PLOT_CONFIG = {
  responsive: true,
  toImageButtonOptions: { scale: EXPORT.pixelRatio },
  modeBarButtonsToAdd: [
    { name:'Download PNG — large text, dark',  icon:ICON_MOON, click: gd => exportPlot(gd, 'dark') },
    { name:'Download PNG — large text, light', icon:ICON_SUN,  click: gd => exportPlot(gd, 'light') },
  ],
};

function walkExport(o, fn) {
  if (Array.isArray(o)) { o.forEach((v, i) => { o[i] = walkExport(v, fn); }); return o; }
  if (o && typeof o === 'object' && !(o instanceof Date)) {
    for (const k of Object.keys(o)) o[k] = walkExport(o[k], fn);
    if (o.font || o.textfont) fn(o);
    return o;
  }
  return typeof o === 'string' ? fn(o) : o;
}

function exportPlot(gd, theme) {
  const full = gd._fullLayout;
  const data = structuredClone(gd.data);
  const layout = structuredClone(gd.layout);

  // Bigger text everywhere: global font (ticks, axis titles inherit it) + any explicit sizes.
  const scaleFont = f => { if (f && typeof f.size === 'number') f.size = Math.round(f.size * EXPORT.fontScale); };
  walkExport(layout, o => { if (typeof o === 'object') { scaleFont(o.font); scaleFont(o.textfont); } return o; });
  walkExport(data,   o => { if (typeof o === 'object') { scaleFont(o.font); scaleFont(o.textfont); } return o; });
  layout.font = { ...PLOT_FONT, ...layout.font };
  if (!layout.font.size || layout.font.size === PLOT_FONT.size) layout.font.size = Math.round(PLOT_FONT.size * EXPORT.fontScale);

  data.forEach(t => {
    if (t.line && typeof t.line.width === 'number')    t.line.width *= EXPORT.lineScale;
    if (t.marker && typeof t.marker.size === 'number') t.marker.size *= EXPORT.markerScale;
  });

  // Grow margins with the text and enlarge the canvas by the same amount so the plot area keeps its size.
  const m0 = full.margin, title = gd.closest('.chart-panel')?.querySelector('.chart-title')?.textContent.trim() || 'chart';
  const m = { l: m0.l * EXPORT.fontScale, r: m0.r * EXPORT.fontScale, b: m0.b * EXPORT.fontScale,
              t: m0.t * EXPORT.fontScale + 30 * EXPORT.fontScale };
  layout.margin = m;
  layout.title = { text: title, x: 0.01, xanchor: 'left', font: { size: Math.round(14 * EXPORT.fontScale) } };
  Object.keys(full).filter(k => /^[xy]axis\d*$/.test(k)).forEach(k => { layout[k] = { ...layout[k], automargin: true }; });
  layout.paper_bgcolor = layout.plot_bgcolor = EXPORT_BG[theme];
  const width  = Math.round(full.width  + (m.l + m.r) - (m0.l + m0.r));
  const height = Math.round(full.height + (m.t + m.b) - (m0.t + m0.b));
  layout.width = width; layout.height = height;

  if (theme === 'light') {
    const remap = v => {
      if (typeof v !== 'string' || v[0] !== '#') return v;
      const key = v.slice(0, 7).toLowerCase();
      return LIGHT_REMAP[key] ? LIGHT_REMAP[key] + v.slice(7) : v;
    };
    walkExport(layout, remap);
    walkExport(data, remap);
    layout.paper_bgcolor = layout.plot_bgcolor = EXPORT_BG.light;
  }

  const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + theme;
  return Plotly.toImage({ data, layout, config: { staticPlot: true } },
                        { format: 'png', width, height, scale: EXPORT.pixelRatio })
    .then(url => {
      const a = document.createElement('a');
      a.href = url; a.download = filename + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      return url;
    });
}

