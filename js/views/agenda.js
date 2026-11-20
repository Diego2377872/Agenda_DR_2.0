// Vista Actividades: tabla con filtros del lado del servidor, botonera de filtros rápidos, acciones masivas
import { getState, setQuery, subscribe, defaultQuery, setPrefs } from '../core/store.js';
import { api, allRows, invalidate } from '../services/data.js';
import { CONFIG } from '../config.js';
import { esc, safeUrl } from '../core/utils.js';
import { MESES, MESES_CORTO, todayYMD, thisYear, tsToYMD, fmt, fmtNice, diffDays, relLabel, weekRange, monthRange, addDays } from '../core/dates.js';
import { permisoInfo, viaticoInfo, badge, deleteRow, duplicateRow, permisoMenu, viaticoMenu, rowMenu, exportExcel, exportCsv } from '../components/actions.js';
import { openForm } from '../components/form.js';
import { toast, confirmDialog, openMenu, showImage } from '../components/ui.js';

const PRESETS = [
  { id: 'anio', label: 'Este año', icon: 'fa-calendar', q: () => ({ year: String(thisYear()) }) },
  { id: 'hoy', label: 'Hoy', icon: 'fa-sun', q: () => ({ year: '', from: todayYMD(), to: todayYMD() }) },
  { id: 'semana', label: 'Esta semana', icon: 'fa-calendar-week', q: () => { const [a, b] = weekRange(todayYMD()); return { year: '', from: a, to: addDays(b, -1) }; } },
  { id: 'mes', label: 'Este mes', icon: 'fa-calendar-days', q: () => ({ year: String(thisYear()), month: String(Number(todayYMD().slice(5, 7))) }) },
  { id: 'mesant', label: 'Mes anterior', icon: 'fa-backward', q: () => { const [y, m] = todayYMD().split('-').map(Number); const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y; return { year: String(py), month: String(pm) }; } },
  { id: 'pend', label: 'Permisos sin entregar', icon: 'fa-hourglass-half', tone: 'warn', q: () => ({ year: '', permiso: 'Sín Entregar' }) },
  { id: 'viat', label: 'Con viático', icon: 'fa-wallet', tone: 'info', q: () => ({ year: '', viatico: 'Sí' }) },
  { id: 'img', label: 'Con imagen', icon: 'fa-image', q: () => ({ year: '', hasImage: true }) },
  { id: 'todo', label: 'Todo el historial', icon: 'fa-infinity', q: () => ({ year: '' }) },
];
const COLS = [
  { key: 'start_date', label: 'Fecha', sortable: true },
  { key: 'actividad', label: 'Actividad', sortable: true },
  { key: 'lugar', label: 'Lugar', sortable: true },
  { key: 'permiso', label: 'Permiso', sortable: true },
  { key: 'viatico', label: 'Viático', sortable: true },
  { key: 'image_url', label: 'Img', sortable: false },
];

let el, rows = [], count = 0, reqId = 0, selected = new Set(), years = [];

export async function mount(section) {
  el = section;
  el.innerHTML = `
  <div class="card">
    <div class="chips presets" id="presets">${PRESETS.map((p) => `<button class="chip ${p.tone || ''}" data-preset="${p.id}"><i class="fas ${p.icon}"></i>${p.label}<span class="n" data-n="${p.id}"></span></button>`).join('')}</div>
    <button class="btn ghost w100 filters-toggle" id="fToggle"><i class="fas fa-sliders"></i> Filtros avanzados <span id="fCount"></span></button>
    <div class="filters" id="filtersBox">
      <label>Año<select id="qYear"></select></label>
      <label>Mes<select id="qMonth"><option value="">Todos</option>${MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></label>
      <label>Desde<input type="date" id="qFrom"></label>
      <label>Hasta<input type="date" id="qTo"></label>
      <label>Permiso<select id="qPermiso"><option value="">Todos</option>${CONFIG.permisos.map((p) => `<option value="${esc(p.value)}">${esc(p.label)}</option>`).join('')}</select></label>
      <label>Viático<select id="qViatico"><option value="">Todos</option>${CONFIG.viaticos.map((p) => `<option value="${esc(p.value)}">${esc(p.label)}</option>`).join('')}</select></label>
      <button class="btn ghost" id="qClear"><i class="fas fa-filter-circle-xmark"></i> Limpiar</button>
    </div>
    <div class="active-filters" id="activeFilters"></div>
  </div>

  <div class="card table-card">
    <div class="toolbar">
      <div class="tb-left"><strong id="tCount">—</strong><span class="muted" id="tTime"></span></div>
      <div class="tb-right">
        <div class="seg-mini" id="viewSwitch"><button data-view="cards" title="Tarjetas"><i class="fas fa-table-cells-large"></i><span>Tarjetas</span></button><button data-view="table" title="Tabla"><i class="fas fa-table-list"></i><span>Tabla</span></button></div>
        <label class="muted">Filas <select id="qSize">${CONFIG.pageSizes.map((n) => `<option>${n}</option>`).join('')}</select></label>
        <button class="btn ghost" id="btnExport"><i class="fas fa-file-export"></i> Exportar</button>
        <button class="btn primary" id="btnNew2"><i class="fas fa-plus"></i> Nueva</button>
      </div>
    </div>
    <div class="bulkbar" id="bulkbar" hidden>
      <span><b id="selN">0</b> seleccionadas</span>
      <button class="btn sm ghost" data-bulk="perm:Entregado"><i class="fas fa-circle-check"></i> Permiso entregado</button>
      <button class="btn sm ghost" data-bulk="perm:Sín Entregar"><i class="fas fa-hourglass-half"></i> Sin entregar</button>
      <button class="btn sm ghost" data-bulk="export"><i class="fas fa-file-excel"></i> Exportar</button>
      <button class="btn sm danger" data-bulk="delete"><i class="fas fa-trash"></i> Eliminar</button>
      <button class="btn sm ghost" data-bulk="clear"><i class="fas fa-xmark"></i></button>
    </div>
    <div class="cards-wrap" id="cardsWrap"><label class="selpage"><input type="checkbox" id="selAll2"> Seleccionar esta página</label><div id="cards"></div></div>
    <div class="dt-scroll"><table class="dt">
      <thead><tr><th class="cb"><input type="checkbox" id="selAll" aria-label="Seleccionar página"></th>
        ${COLS.map((c) => `<th ${c.sortable ? `data-sort="${c.key}" class="sortable"` : ''}>${c.label}<i class="fas sort-i"></i></th>`).join('')}
        <th class="act-col">Acciones</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
    <div class="empty" id="empty" hidden><i class="fas fa-calendar-xmark"></i><p>No hay actividades con estos filtros.</p><button class="btn ghost" id="emptyClear">Ver todo el historial</button></div>
    </div>
    <div class="pager" id="pager"></div>
  </div>`;

  // Años disponibles según los datos reales
  try {
    const all = await allRows();
    const ys = new Set(all.map((r) => Number(tsToYMD(r.start_date).slice(0, 4))));
    ys.add(thisYear()); ys.add(thisYear() + 1);
    years = [...ys].filter(Boolean).sort((a, b) => b - a);
  } catch { years = [thisYear() + 1, thisYear(), thisYear() - 1]; }
  el.querySelector('#qYear').innerHTML = `<option value="">Todos</option>${years.map((y) => `<option>${y}</option>`).join('')}`;

  bind();
  subscribe((s, p) => {
    if (s.query !== p.query) { syncControls(); load(); }
    else if (s.dataVersion !== p.dataVersion) { load(); updatePresetCounts(); }
  });
  syncControls(); load(); updatePresetCounts();
}

function bind() {
  const $ = (s) => el.querySelector(s);
  el.querySelector('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    const p = PRESETS.find((x) => x.id === b.dataset.preset);
    const base = defaultQuery();
    setQuery({ ...base, year: '', search: getState().query.search, size: getState().query.size, sort: getState().query.sort, dir: getState().query.dir, ...p.q(), preset: p.id });
  });
  const map = { qYear: 'year', qMonth: 'month', qFrom: 'from', qTo: 'to', qPermiso: 'permiso', qViatico: 'viatico' };
  Object.entries(map).forEach(([id, k]) => $('#' + id).addEventListener('change', (e) => setQuery({ [k]: e.target.value, preset: '' })));
  $('#qClear').addEventListener('click', clearAll);
  $('#fToggle').addEventListener('click', () => $('#filtersBox').classList.toggle('open'));
  $('#emptyClear').addEventListener('click', () => setQuery({ ...defaultQuery(), year: '', size: getState().query.size, preset: 'todo' }));
  $('#qSize').addEventListener('change', (e) => { setPrefs({ pageSize: Number(e.target.value) }); setQuery({ size: Number(e.target.value) }); });
  $('#btnNew2').addEventListener('click', () => openForm());
  $('#btnExport').addEventListener('click', (e) => openMenu(e.currentTarget, [
    { label: 'Excel (filtro actual)', icon: 'fa-file-excel', onClick: () => doExport('xlsx') },
    { label: 'CSV (filtro actual)', icon: 'fa-file-csv', onClick: () => doExport('csv') },
  ]));
  $('#activeFilters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    const k = b.dataset.rm; setQuery({ [k]: k === 'hasImage' ? false : '', preset: '' });
    if (k === 'search') document.getElementById('globalSearch').value = '';
  });
  el.querySelector('thead').addEventListener('click', (e) => {
    const th = e.target.closest('[data-sort]'); if (!th) return;
    const q = getState().query;
    const k = th.dataset.sort;
    const dir = q.sort === k ? (q.dir === 'desc' ? 'asc' : 'desc') : (k === 'start_date' ? 'desc' : 'asc');
    setQuery({ sort: k, dir }, false);
  });
  $('#selAll').addEventListener('change', (e) => { rows.forEach((r) => (e.target.checked ? selected.add(r.id) : selected.delete(r.id))); refreshSelection(); });
  $('#tbody').addEventListener('click', onRowClick);
  $('#cards').addEventListener('click', onRowClick);
  $('#selAll2').addEventListener('change', (e) => { rows.forEach((r) => (e.target.checked ? selected.add(r.id) : selected.delete(r.id))); refreshSelection(); });
  $('#viewSwitch').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { setPrefs({ listView: b.dataset.view }); applyView(); } });
  for (const box of [$('#tbody'), $('#cards')]) {
    box.addEventListener('dblclick', (e) => { if (e.target.closest('button,a,input,.badge')) return; const tr = e.target.closest('[data-id]'); if (tr) openForm({ mode: 'edit', row: rows.find((r) => r.id === tr.dataset.id) }); });
    box.addEventListener('contextmenu', (e) => { const tr = e.target.closest('[data-id]'); if (!tr) return; e.preventDefault(); rowMenu({ getBoundingClientRect: () => ({ left: e.clientX, bottom: e.clientY }) }, rows.find((r) => r.id === tr.dataset.id)); });
  }
  $('#bulkbar').addEventListener('click', onBulk);
  $('#pager').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b && !b.disabled) { setQuery({ page: Number(b.dataset.page) }, false); el.querySelector('.dt-scroll').scrollTop = 0; } });
}

function clearAll() {
  document.getElementById('globalSearch').value = '';
  setQuery({ ...defaultQuery(), size: getState().query.size, preset: 'anio' });
}

function syncControls() {
  const q = getState().query, $ = (s) => el.querySelector(s);
  $('#qYear').value = q.year; $('#qMonth').value = q.month; $('#qFrom').value = q.from; $('#qTo').value = q.to;
  $('#qPermiso').value = q.permiso; $('#qViatico').value = q.viatico; $('#qSize').value = String(q.size);
  el.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === (q.preset || (isDefault(q) ? 'anio' : ''))));
  el.querySelectorAll('th[data-sort]').forEach((th) => {
    const i = th.querySelector('.sort-i'); const on = th.dataset.sort === q.sort;
    th.classList.toggle('sorted', on); i.className = `fas sort-i ${on ? (q.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort'}`;
  });
  const chips = [];
  if (q.search) chips.push(['search', `Búsqueda: “${q.search}”`]);
  if (q.year) chips.push(['year', `Año ${q.year}`]);
  if (q.month) chips.push(['month', MESES[q.month - 1]]);
  if (q.from) chips.push(['from', `Desde ${fmt(q.from)}`]);
  if (q.to) chips.push(['to', `Hasta ${fmt(q.to)}`]);
  if (q.permiso) chips.push(['permiso', `Permiso: ${permisoInfo(q.permiso).label}`]);
  if (q.viatico) chips.push(['viatico', `Viático: ${q.viatico}`]);
  if (q.hasImage) chips.push(['hasImage', 'Con imagen']);
  $('#fCount').textContent = chips.length ? `(${chips.length})` : '';
  $('#activeFilters').innerHTML = chips.map(([k, t]) => `<span class="fchip">${esc(t)}<button data-rm="${k}" aria-label="Quitar filtro"><i class="fas fa-xmark"></i></button></span>`).join('');
}
const isDefault = (q) => q.year === String(thisYear()) && !q.month && !q.from && !q.to && !q.permiso && !q.viatico && !q.hasImage;

async function load() {
  const my = ++reqId; const q = getState().query; const t0 = performance.now();
  el.querySelector('.table-card').classList.add('loading');
  try {
    const res = await api.list(q);
    if (my !== reqId) return; // respuesta obsoleta
    rows = res.rows; count = res.count;
    const maxPage = Math.max(1, Math.ceil(count / q.size));
    if (q.page > maxPage) return setQuery({ page: maxPage }, false);
    render(q, Math.round(performance.now() - t0));
  } catch (e) {
    if (my !== reqId) return;
    el.querySelector('#cards').innerHTML = ''; el.querySelector('#tbody').innerHTML = `<tr><td colspan="8" class="err-cell"><i class="fas fa-plug-circle-xmark"></i> No se pudo cargar: ${esc(e.message)} <button class="btn sm ghost" id="retry">Reintentar</button></td></tr>`;
    el.querySelector('#retry')?.addEventListener('click', load);
  } finally { if (my === reqId) el.querySelector('.table-card').classList.remove('loading'); }
}

function rowHtml(r) {
  const s = tsToYMD(r.start_date), e = tsToYMD(r.end_date) || s;
  const n = diffDays(s, e) + 1; const rel = relLabel(s);
  const today = todayYMD(); const live = s <= today && today <= e;
  const img = safeUrl(r.image_url);
  return `<tr data-id="${esc(r.id)}" class="${selected.has(r.id) ? 'sel' : ''} ${live ? 'live' : ''}">
    <td class="cb"><input type="checkbox" data-cb ${selected.has(r.id) ? 'checked' : ''} aria-label="Seleccionar"></td>
    <td data-label="Fecha" class="date-cell"><div class="d1">${fmtNice(s)}</div>${n > 1 ? `<div class="d2">→ ${fmtNice(e)} <span class="pill">${n} días</span></div>` : ''}${rel ? `<span class="rel ${live ? 'now' : ''}">${rel}</span>` : ''}</td>
    <td data-label="Actividad" class="act-cell">${esc(r.actividad)}</td>
    <td data-label="Lugar"><span class="place"><i class="fas fa-location-dot"></i>${esc(r.lugar)}</span></td>
    <td data-label="Permiso">${badge(permisoInfo(r.permiso), 'data-q="permiso" role="button" tabindex="0" title="Clic para cambiar"')}</td>
    <td data-label="Viático">${badge(viaticoInfo(r.viatico), 'data-q="viatico" role="button" tabindex="0" title="Clic para cambiar"')}</td>
    <td data-label="Imagen">${img ? `<img class="thumb" src="${esc(img)}" loading="lazy" alt="Evidencia" data-img>` : '<span class="muted">—</span>'}</td>
    <td class="act-col"><div class="row-actions">
      <button class="icon-btn sm" data-a="edit" title="Editar"><i class="fas fa-pen"></i></button>
      <button class="icon-btn sm" data-a="dup" title="Duplicar para hoy"><i class="fas fa-clone"></i></button>
      <button class="icon-btn sm danger" data-a="del" title="Eliminar"><i class="fas fa-trash"></i></button>
      <button class="icon-btn sm" data-a="more" title="Más"><i class="fas fa-ellipsis-vertical"></i></button></div></td></tr>`;
}

function render(q, ms) {
  const $ = (s) => el.querySelector(s);
  $('#tCount').textContent = `${count.toLocaleString('es-PY')} actividad${count === 1 ? '' : 'es'}`;
  $('#tTime').textContent = ` · ${ms} ms`;
  $('#empty').hidden = rows.length > 0;
  $('#tbody').innerHTML = rows.map(rowHtml).join('');
  $('#cards').innerHTML = cardsHtml(rows, q);
  applyView();
  const pages = Math.max(1, Math.ceil(count / q.size)), p = q.page;
  const nums = [...new Set([1, p - 2, p - 1, p, p + 1, p + 2, pages])].filter((x) => x >= 1 && x <= pages).sort((a, b) => a - b);
  let html = `<button class="pg" data-page="${p - 1}" ${p <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
  let last = 0;
  for (const n of nums) { if (n - last > 1) html += '<span class="pgap">…</span>'; html += `<button class="pg ${n === p ? 'on' : ''}" data-page="${n}">${n}</button>`; last = n; }
  html += `<button class="pg" data-page="${p + 1}" ${p >= pages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
  const from = count ? (p - 1) * q.size + 1 : 0;
  $('#pager').innerHTML = `<span class="muted">${from}–${Math.min(p * q.size, count)} de ${count}</span><div class="pgs">${pages > 1 ? html : ''}</div>`;
  refreshSelection();
}

function refreshSelection() {
  el.querySelectorAll('[data-id]').forEach((tr) => { const on = selected.has(tr.dataset.id); tr.classList.toggle('sel', on); const cb = tr.querySelector('[data-cb]'); if (cb) cb.checked = on; });
  const all = el.querySelector('#selAll'); const all2 = el.querySelector('#selAll2'); const onPage = rows.filter((r) => selected.has(r.id)).length;
  for (const a of [all, all2]) { a.checked = rows.length > 0 && onPage === rows.length; a.indeterminate = onPage > 0 && onPage < rows.length; }
  el.querySelector('#bulkbar').hidden = selected.size === 0; el.querySelector('#selN').textContent = selected.size;
}

function onRowClick(e) {
  const tr = e.target.closest('[data-id]'); if (!tr) return;
  const row = rows.find((r) => r.id === tr.dataset.id); if (!row) return;
  if (e.target.matches('[data-cb]')) { e.target.checked ? selected.add(row.id) : selected.delete(row.id); return refreshSelection(); }
  if (e.target.closest('[data-img]')) return showImage(row.image_url);
  const q = e.target.closest('[data-q]');
  if (q) return q.dataset.q === 'permiso' ? permisoMenu(q, row) : viaticoMenu(q, row);
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'edit') openForm({ mode: 'edit', row });
  else if (a === 'dup') duplicateRow(row);
  else if (a === 'del') deleteRow(row).then((ok) => ok && selected.delete(row.id));
  else if (a === 'more') rowMenu(e.target.closest('[data-a]'), row);
}

async function onBulk(e) {
  const b = e.target.closest('[data-bulk]'); if (!b) return;
  const ids = [...selected]; const act = b.dataset.bulk;
  if (act === 'clear') { selected.clear(); return refreshSelection(); }
  if (act === 'export') {
    const all = await allRows(true); return exportExcel(all.filter((r) => selected.has(r.id)), `agenda_seleccion_${todayYMD()}.xlsx`);
  }
  if (act.startsWith('perm:')) {
    const v = act.slice(5);
    try { const n = await api.updateMany(ids, { permiso: v }); invalidate(); toast(`${n} actividades → Permiso: ${permisoInfo(v).label}`); }
    catch (err) { toast('Error: ' + err.message, 'err'); }
    return;
  }
  if (act === 'delete') {
    const ok = await confirmDialog({ title: `¿Eliminar ${ids.length} actividades?`, body: '<p class="muted">Esta acción no se puede deshacer. Se recomienda descargar un respaldo antes (menú Sistema).</p>', ok: `Eliminar ${ids.length}`, danger: true });
    if (!ok) return;
    const all = await allRows(true); let n = 0;
    for (const id of ids) {
      try { const r = all.find((x) => x.id === id); await api.remove(id); if (r?.image_url) api.removeImage(r.image_url).catch(() => {}); n++; } catch { /* continúa */ }
    }
    selected.clear(); invalidate(); toast(`${n} de ${ids.length} actividades eliminadas`, n === ids.length ? 'ok' : 'warn');
  }
}

async function doExport(kind) {
  try {
    const q = getState().query;
    const data = await api.all(q);
    if (!data.length) return toast('No hay datos para exportar', 'info');
    const name = q.month ? `agenda_${String(q.month).padStart(2, '0')}_${q.year || thisYear()}` : q.year ? `agenda_${q.year}` : `agenda_completa_${todayYMD()}`;
    kind === 'csv' ? exportCsv(data, name + '.csv') : await exportExcel(data, name + '.xlsx');
    toast(`Exportadas ${data.length} actividades`);
  } catch (e) { toast('Error al exportar: ' + e.message, 'err'); }
}

async function updatePresetCounts() {
  try {
    const all = await allRows();
    const pend = all.filter((r) => r.permiso === 'Sín Entregar').length;
    const set = (id, n) => { const x = el.querySelector(`[data-n="${id}"]`); if (x) x.textContent = n ? n : ''; };
    set('pend', pend); set('viat', all.filter((r) => r.viatico === 'Sí').length); set('img', all.filter((r) => r.image_url).length); set('todo', all.length);
  } catch { /* opcional */ }
}
export const title = 'Actividades';

// ---- Vista de tarjetas agrupadas por mes ----
function applyView() {
  const v = getState().prefs.listView || (innerWidth < 900 ? 'cards' : 'cards');
  el.querySelector('.table-card').dataset.view = v;
  el.querySelectorAll('#viewSwitch [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
}
function cardHtml(r) {
  const s = tsToYMD(r.start_date), e = tsToYMD(r.end_date) || s;
  const n = diffDays(s, e) + 1; const rel = relLabel(s);
  const today = todayYMD(); const live = s <= today && today <= e;
  const img = safeUrl(r.image_url);
  const wd = fmtNice(s).split(' ')[0];
  const pi = permisoInfo(r.permiso);
  return `<article class="acard tone-${pi.tone} ${selected.has(r.id) ? 'sel' : ''} ${live ? 'live' : ''}" data-id="${esc(r.id)}">
    <label class="ac-cb"><input type="checkbox" data-cb ${selected.has(r.id) ? 'checked' : ''} aria-label="Seleccionar"></label>
    <div class="ac-date"><b>${Number(s.slice(8))}</b><span>${MESES_CORTO[Number(s.slice(5, 7)) - 1]}</span><small>${wd}</small></div>
    <div class="ac-body">
      <h4>${esc(r.actividad)}</h4>
      <div class="ac-meta">
        <span class="place"><i class="fas fa-location-dot"></i>${esc(r.lugar)}</span>
        ${n > 1 ? `<span class="pill">${n} días · hasta ${fmtNice(e)}</span>` : ''}
        ${rel ? `<span class="rel ${live ? 'now' : ''}">${rel}</span>` : ''}
      </div>
      <div class="ac-tags">${badge(pi, 'data-q="permiso" role="button" tabindex="0" title="Clic para cambiar"')}${badge(viaticoInfo(r.viatico), 'data-q="viatico" role="button" tabindex="0" title="Clic para cambiar"')}</div>
    </div>
    ${img ? `<img class="ac-thumb thumb" src="${esc(img)}" loading="lazy" alt="Evidencia" data-img>` : ''}
    <div class="ac-actions">
      <button class="icon-btn sm" data-a="edit" title="Editar"><i class="fas fa-pen"></i></button>
      <button class="icon-btn sm" data-a="more" title="Más"><i class="fas fa-ellipsis-vertical"></i></button>
    </div></article>`;
}
function cardsHtml(list, q) {
  if (!list.length) return '';
  if (q.sort !== 'start_date') return `<div class="cgroup-list">${list.map(cardHtml).join('')}</div>`;
  const groups = []; let cur = null;
  for (const r of list) {
    const k = tsToYMD(r.start_date).slice(0, 7);
    if (!cur || cur.k !== k) groups.push((cur = { k, items: [] }));
    cur.items.push(r);
  }
  return groups.map((g) => {
    const [y, m] = g.k.split('-').map(Number);
    const pend = g.items.filter((r) => r.permiso === 'Sín Entregar').length;
    return `<section class="cgroup"><header class="cg-head"><h3>${MESES[m - 1]} <span>${y}</span></h3>
      <div class="cg-stats"><span>${g.items.length} en esta página</span>${pend ? `<span class="pill warn">${pend} sin entregar</span>` : ''}</div></header>
      <div class="cgroup-list">${g.items.map(cardHtml).join('')}</div></section>`;
  }).join('');
}
