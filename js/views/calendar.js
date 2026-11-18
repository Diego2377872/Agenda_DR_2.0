// Vista Calendario mensual: clic en día vacío = nueva actividad en esa fecha; clic en evento = editar
import { allRows } from '../services/data.js';
import { subscribe } from '../core/store.js';
import { esc } from '../core/utils.js';
import { MESES, DIAS_CORTO, todayYMD, tsToYMD, addDays, monthRange, weekday, pad } from '../core/dates.js';
import { permisoInfo } from '../components/actions.js';
import { openForm } from '../components/form.js';
import { openMenu } from '../components/ui.js';

let el, ym = todayYMD().slice(0, 7);

export async function mount(section) {
  el = section;
  subscribe((s, p) => { if (s.dataVersion !== p.dataVersion) render(); });
  el.addEventListener('click', onClick);
  document.addEventListener('keydown', (e) => {
    if (el.hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.getElementById('drawer-root').innerHTML) return;
    if (e.key === 'ArrowLeft') shift(-1); if (e.key === 'ArrowRight') shift(1);
  });
  await render();
}
function shift(n) { let [y, m] = ym.split('-').map(Number); m += n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } ym = `${y}-${pad(m)}`; render(); }

async function render() {
  const [y, m] = ym.split('-').map(Number);
  const [start, end] = monthRange(y, m);
  const gridStart = addDays(start, -weekday(start));
  const cells = []; for (let d = gridStart; d < end || weekday(d) !== 0; d = addDays(d, 1)) cells.push(d);
  let all = [];
  try { all = await allRows(); } catch (e) { el.innerHTML = `<div class="card err-cell">No se pudo cargar: ${esc(e.message)}</div>`; return; }
  const last = cells[cells.length - 1];
  const evs = all.filter((r) => { const s = tsToYMD(r.start_date), e = tsToYMD(r.end_date) || s; return s <= last && e >= gridStart; })
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  el._evs = evs;
  const today = todayYMD();
  const monthCount = evs.filter((r) => { const s = tsToYMD(r.start_date), e = tsToYMD(r.end_date) || s; return s < end && e >= start; }).length;
  el.innerHTML = `<div class="card cal-card">
    <div class="cal-head">
      <div class="row gap"><button class="icon-btn" data-nav="-1" aria-label="Mes anterior"><i class="fas fa-chevron-left"></i></button>
      <h2>${MESES[m - 1]} ${y}</h2><button class="icon-btn" data-nav="1" aria-label="Mes siguiente"><i class="fas fa-chevron-right"></i></button>
      <button class="btn ghost sm" data-nav="0">Hoy</button></div>
      <span class="muted">${monthCount} actividades · clic en un día para agregar</span>
    </div>
    <div class="cal-grid">${DIAS_CORTO.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
    ${cells.map((d) => {
      const dayEvs = evs.filter((r) => { const s = tsToYMD(r.start_date), e = tsToYMD(r.end_date) || s; return s <= d && d <= e; });
      return `<div class="cal-day ${d.slice(0, 7) !== ym ? 'out' : ''} ${d === today ? 'today' : ''} ${weekday(d) > 4 ? 'we' : ''}" data-day="${d}">
        <span class="dn">${Number(d.slice(8))}</span>
        ${dayEvs.slice(0, 3).map((r) => `<button class="ev ${permisoInfo(r.permiso).tone}" data-ev="${esc(r.id)}" title="${esc(r.actividad)} · ${esc(r.lugar)} · Permiso: ${esc(r.permiso)}">${r.viatico === 'Sí' ? '<i class="fas fa-wallet"></i>' : ''}${esc(r.actividad)}</button>`).join('')}
        ${dayEvs.length > 3 ? `<span class="more">+${dayEvs.length - 3} más</span>` : ''}</div>`;
    }).join('')}</div>
    <div class="legend"><span class="ev lg warn">Permiso sin entregar</span><span class="ev lg ok">Entregado</span><span class="ev lg muted">No es necesario</span><span class="muted"><i class="fas fa-wallet"></i> con viático · ← → cambiar mes</span></div>
  </div>`;
}

function onClick(e) {
  const nav = e.target.closest('[data-nav]');
  if (nav) { const n = Number(nav.dataset.nav); if (n === 0) { ym = todayYMD().slice(0, 7); render(); } else shift(n); return; }
  const ev = e.target.closest('[data-ev]');
  if (ev) return openForm({ mode: 'edit', row: el._evs.find((r) => r.id === ev.dataset.ev) });
  const day = e.target.closest('[data-day]');
  if (!day) return;
  const d = day.dataset.day;
  const dayEvs = el._evs.filter((r) => { const s = tsToYMD(r.start_date), e = tsToYMD(r.end_date) || s; return s <= d && d <= e; });
  // En pantallas pequeñas (o días con más de 3) se muestra la lista del día antes de crear
  if (dayEvs.length && (innerWidth < 760 || dayEvs.length > 3)) {
    return openMenu(day, [...dayEvs.map((r) => ({ label: `${r.actividad} · ${r.lugar}`, icon: 'fa-pen', onClick: () => openForm({ mode: 'edit', row: r }) })), '-',
      { label: 'Nueva actividad este día', icon: 'fa-plus', onClick: () => openForm({ mode: 'new', date: d }) }]);
  }
  openForm({ mode: 'new', date: d });
}
export const title = 'Calendario';
