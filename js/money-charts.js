const n = (value) => Math.max(0, Number(value || 0));
const fmt = (value) => `MVR ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;

export function moneyFlowModel({ income = 0, paid = 0, stillToPay = 0, safeToSave = 0 } = {}) {
  return [
    { label: 'Income', value: n(income), tone: 'income' },
    { label: 'Paid', value: n(paid), tone: 'paid' },
    { label: 'Still to pay', value: n(stillToPay), tone: 'pending' },
    { label: 'Safe to save', value: n(safeToSave), tone: 'saving' },
  ];
}

export function trendModel(points = []) {
  const clean = points.map((p) => ({ label: String(p.label ?? ''), value: Number(p.value || 0) })).filter((p) => Number.isFinite(p.value));
  if (!clean.length) return { empty: true, points: [], min: 0, max: 0 };
  const values = clean.map((p) => p.value);
  return { empty: false, points: clean, min: Math.min(...values), max: Math.max(...values) };
}

function barTone(tone) {
  return { income: '#34b891', paid: '#4f8df7', pending: '#f59b42', saving: '#64c78d' }[tone] || '#4f8df7';
}

export function renderMoneyFlowChart(summary) {
  const model = moneyFlowModel(summary);
  const max = Math.max(1, ...model.map((x) => x.value));
  const chartTop = 24;
  const chartBottom = 174;
  const height = chartBottom - chartTop;
  const bars = model.map((x, i) => {
    const h = (x.value / max) * height;
    const xPos = 42 + i * 136;
    const y = chartBottom - h;
    return `<g><rect x="${xPos}" y="${y}" width="78" height="${h}" rx="10" fill="${barTone(x.tone)}"></rect><text x="${xPos + 39}" y="${Math.max(16, y - 8)}" text-anchor="middle" class="chart-value">${fmt(x.value)}</text><text x="${xPos + 39}" y="205" text-anchor="middle" class="chart-label">${x.label}</text></g>`;
  }).join('');
  return `<svg class="money-chart" viewBox="0 0 590 220" role="img" aria-label="Monthly money flow"><line x1="24" y1="174" x2="566" y2="174" stroke="currentColor" opacity=".12"/>${bars}</svg>`;
}

export function renderCompositionDonut({ paid = 0, stillToPay = 0, safeToSave = 0 } = {}) {
  const segments = [
    { label: 'Paid', value: n(paid), color: '#4f8df7' },
    { label: 'Still to pay', value: n(stillToPay), color: '#f59b42' },
    { label: 'Safe to save', value: n(safeToSave), color: '#64c78d' },
  ];
  const total = segments.reduce((sum, x) => sum + x.value, 0);
  if (!total) return `<div class="chart-empty">Your September chart will appear after you enter income and payments.</div>`;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const circles = segments.map((x) => {
    const len = (x.value / total) * circumference;
    const markup = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${x.color}" stroke-width="20" stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"></circle>`;
    offset += len;
    return markup;
  }).join('');
  const legend = segments.map((x) => `<div class="donut-legend-row"><span class="legend-dot" style="background:${x.color}"></span><span>${x.label}</span><strong>${fmt(x.value)}</strong></div>`).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 160 160" class="donut-chart">${circles}<circle cx="80" cy="80" r="39" fill="var(--surface)"/><text x="80" y="76" text-anchor="middle" class="donut-total">${Math.round(total).toLocaleString('en-US')}</text><text x="80" y="95" text-anchor="middle" class="donut-caption">planned flow</text></svg><div class="donut-legend">${legend}</div></div>`;
}

export function renderTrendLine(points = [], { label = 'Trend', currency = true } = {}) {
  const model = trendModel(points);
  if (model.empty) return `<div class="chart-empty">No history yet. September 2026 will be the first point.</div>`;
  const width = 620, height = 220, left = 42, right = 18, top = 22, bottom = 38;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const range = Math.max(1, model.max - model.min);
  const coords = model.points.map((p, i) => {
    const x = left + (model.points.length === 1 ? innerW / 2 : (i / (model.points.length - 1)) * innerW);
    const y = top + ((model.max - p.value) / range) * innerH;
    return { ...p, x, y };
  });
  const path = coords.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const dots = coords.map((p) => `<g><circle cx="${p.x}" cy="${p.y}" r="5" fill="#34b891"></circle><text x="${p.x}" y="205" text-anchor="middle" class="chart-label">${p.label}</text><title>${p.label}: ${currency ? fmt(p.value) : p.value}</title></g>`).join('');
  return `<svg class="money-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><line x1="${left}" y1="${top + innerH}" x2="${left + innerW}" y2="${top + innerH}" stroke="currentColor" opacity=".12"/><path d="${path}" fill="none" stroke="#34b891" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
}
