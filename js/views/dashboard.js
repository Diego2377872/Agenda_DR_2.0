// Vista Inicio: indicadores, gráfico mensual, lugares frecuentes, pendientes con acción rápida
import { allRows } from '../services/data.js';
import { subscribe, setQuery, defaultQuery, getState } from '../core/store.js';
import { esc, countBy } from '../core/utils.js';
import { MESES_CORTO, MESES, todayYMD, thisYear, tsToYMD, diffDays, fmtNice, relLabel, addDays } from '../core/dates.js';
import { permisoInfo, viaticoInfo, badge, quickSet } from '../components/actions.js';
import { openForm } from '../components/form.js';

let el, year = thisYear();
const go = (patch) => { setQuery({ ...defaultQuery(), size: getState().query.size, year: '', ...patch }); location.hash = '#/agenda'; };

export async function mount(section) {
  el = section;
  subscribe((s, p) => { if (s.dataVersion !== p.dataVersion) render(); });
  el.addEventListener('click', onClick);
  el.addEventListener('change', (e) => { if (e.target.id === 'dYear') { year = Number(e.target.value); render(); } });
  await render();
}

function daysIn(r, y) {
  const s = tsToYMD(r.start_date), e = tsToYMD(r.end_date) || s;
  const a = s < `${y}-01-01` ? `${y}-01-01` : s, b = e > `${y}-12-31` ? `${y}-12-31` : e;
  return b >= a ? diffDays(a, b) + 1 : 0;
}

async function render() {
  if (!el.innerHTML) el.innerHTML = '<div class="skeleton-grid"><div></div><div></div><div></div><div></div></div>';
  let all;
  try { all = await allRows(); } catch (e) { el.innerHTML = `<div class="card err-cell"><i class="fas fa-plug-circle-xmark"></i> No se pudieron cargar los datos: ${esc(e.message)}</div>`; return; }
  const ys = [...new Set(all.map((r) => Number(tsToYMD(r.start_date).slice(0, 4))))].concat(thisYear()).filter(Boolean);
  const years = [...new Set(ys)].sort((a, b) => b - a);
  const inYear = all.filter((r) => daysIn(r, year) > 0);
  const today = todayYMD();
  const pend = all.filter((r) => r.permiso === 'Sín Entregar').sort((a, b) => a.start_date.localeCompare(b.start_date));
  const daySet = new Set();
  inYear.forEach((r) => { const s = tsToYMD(r.start_date), e = tsToYMD(r.end_date) || s; for (let d = s; d <= e && daySet.size < 4000; d = addDays(d, 1)) if (d.startsWith(String(year))) daySet.add(d); });
  const dias = daySet.size;
  const viat = inYear.filter((r) => r.viatico === 'Sí').length;
  const lugares = countBy(inYear, (r) => r.lugar.trim());
  const byMonth = Array(12).fill(0);
  inYear.forEach((r) => { const s = tsToYMD(r.start_date); if (s.startsWith(String(year))) byMonth[Number(s.slice(5, 7)) - 1]++; });
  const max = Math.max(1, ...byMonth);
  const upcoming = all.filter((r) => (tsToYMD(r.end_date) || tsToYMD(r.start_date)) >= today && tsToYMD(r.start_date) <= addDays(today, 30))
    .sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 6);
  const recent = all.filter((r) => tsToYMD(r.start_date) < today).slice(0, 6);
  const lastYMD = all.length ? tsToYMD(all[0].start_date) : '';
  const gap = lastYMD ? diffDays(lastYMD > today ? today : lastYMD, today) : null;
  const curM = year === thisYear() ? Number(today.slice(5, 7)) - 1 : -1;

  el.innerHTML = `
  <div class="hero">
    <div><h2>Hola, Diego 👋</h2><p class="muted">${fmtNice(today)} · ${gap === null ? 'Sin registros aún' : gap <= 1 ? 'Agenda al día' : `Último registro hace ${gap} días`}</p></div>
    <div class="hero-actions">
      <button class="btn primary" data-do="new-today"><i class="fas fa-plus"></i> Registrar hoy</button>
      ${recent[0] ? `<button class="btn ghost" data-do="repeat" title="${esc(recent[0].actividad)} · ${esc(recent[0].lugar)}"><i class="fas fa-rotate-right"></i> Repetir última</button>` : ''}
      <label class="muted yr">Año <select id="dYear">${years.map((y) => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
    </div>
  </div>
  <div class="kpis">
    <button class="kpi" data-go="year"><i class="fas fa-list-check"></i><div><b>${inYear.length}</b><span>Actividades ${year}</span></div></button>
    <button class="kpi" data-go="year"><i class="fas fa-calendar-check"></i><div><b>${dias}</b><span>Días con actividad</span></div></button>
    <button class="kpi warn" data-go="pend"><i class="fas fa-hourglass-half"></i><div><b>${pend.length}</b><span>Permisos sin entregar</span></div></button>
    <button class="kpi info" data-go="viat"><i class="fas fa-wallet"></i><div><b>${viat}</b><span>Con viático ${year}</span></div></button>
  </div>
  <div class="grid2">
    <div class="card"><h3><i class="fas fa-chart-column"></i> Actividades por mes · ${year}</h3>
      <div class="bars">${byMonth.map((n, i) => `<button class="bar ${i === curM ? 'cur' : ''}" data-month="${i + 1}" title="${MESES[i]}: ${n}"><span class="v">${n || ''}</span><span class="b" style="height:${(n / max) * 100}%"></span><span class="m">${MESES_CORTO[i]}</span></button>`).join('')}</div>
    </div>
    <div class="card"><h3><i class="fas fa-location-dot"></i> Lugares frecuentes · ${year}</h3>
      <div class="hbars">${lugares.slice(0, 7).map(([l, n]) => `<button class="hbar" data-lugar="${esc(l)}"><span class="l">${esc(l)}</span><span class="t"><span style="width:${(n / lugares[0][1]) * 100}%"></span></span><b>${n}</b></button>`).join('') || '<p class="muted">Sin datos</p>'}</div>
    </div>
  </div>
  <div class="grid2">
    <div class="card"><h3><i class="fas fa-hourglass-half"></i> Permisos sin entregar <span class="pill warn">${pend.length}</span></h3>
      ${pend.length ? `<ul class="list">${pend.slice(0, 8).map((r) => `<li><div><b>${esc(r.actividad)}</b><small>${fmtNice(tsToYMD(r.start_date))} · ${esc(r.lugar)}</small></div>
        <button class="btn sm ok" data-deliver="${esc(r.id)}"><i class="fas fa-check"></i> Entregado</button></li>`).join('')}</ul>
        ${pend.length > 8 ? `<button class="btn ghost w100" data-go="pend">Ver los ${pend.length}</button>` : ''}` : '<p class="muted ok-msg"><i class="fas fa-circle-check"></i> ¡Todo entregado!</p>'}
    </div>
    <div class="card"><h3><i class="fas fa-forward"></i> Próximos 30 días</h3>
      ${upcoming.length ? `<ul class="list">${upcoming.map(item).join('')}</ul>` : '<p class="muted">Nada programado. <button class="link" data-do="new-today">Agregar</button></p>'}
      <h3 class="mt"><i class="fas fa-clock-rotate-left"></i> Recientes</h3>
      <ul class="list">${recent.map(item).join('')}</ul>
    </div>
  </div>`;
  el._pend = pend; el._all = all; el._recent = recent;
}

function item(r) {
  const s = tsToYMD(r.start_date), rel = relLabel(s);
  return `<li data-edit="${esc(r.id)}" class="clickable"><div><b>${esc(r.actividad)}</b><small>${fmtNice(s)}${rel ? ` · ${rel}` : ''} · ${esc(r.lugar)}</small></div>
    <div class="badges">${badge(permisoInfo(r.permiso))}${r.viatico === 'Sí' ? badge(viaticoInfo('Sí')) : ''}</div></li>`;
}

function onClick(e) {
  const t = (s) => e.target.closest(s);
  let b;
  if ((b = t('[data-go]'))) {
    const g = b.dataset.go;
    if (g === 'pend') go({ permiso: 'Sín Entregar', preset: 'pend' });
    else if (g === 'viat') go({ year: String(year), viatico: 'Sí' });
    else go({ year: String(year) });
  } else if ((b = t('[data-month]'))) go({ year: String(year), month: b.dataset.month });
  else if ((b = t('[data-lugar]'))) { document.getElementById('globalSearch').value = b.dataset.lugar; go({ year: String(year), search: b.dataset.lugar }); }
  else if ((b = t('[data-deliver]'))) { const r = el._pend.find((x) => x.id === b.dataset.deliver); b.disabled = true; quickSet(r, 'permiso', 'Entregado'); }
  else if ((b = t('[data-edit]'))) openForm({ mode: 'edit', row: el._all.find((x) => x.id === b.dataset.edit) });
  else if ((b = t('[data-do]'))) {
    if (b.dataset.do === 'new-today') openForm();
    if (b.dataset.do === 'repeat') openForm({ mode: 'dup', row: el._recent[0] });
  }
}
export const title = 'Inicio';
