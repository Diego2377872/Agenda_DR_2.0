// Modelo de consulta compartido: misma semántica en servidor (PostgREST) y en memoria (demo)
import { monthRange, addDays, thisYear, tsToYMD } from '../core/dates.js';
import { norm } from '../core/utils.js';

// Devuelve el intervalo [from, to) en 'YYYY-MM-DD' o nulls.
// Semántica de SOLAPAMIENTO: una actividad de varios días aparece si toca el periodo.
export function dateWindow(q) {
  let from = null, to = null;
  if (q.month) [from, to] = monthRange(q.year || thisYear(), q.month);
  else if (q.year) { from = `${q.year}-01-01`; to = `${Number(q.year) + 1}-01-01`; }
  if (q.from && (!from || q.from > from)) from = q.from;
  if (q.to) { const t = addDays(q.to, 1); if (!to || t < to) to = t; }
  return { from, to };
}

export const cleanSearch = (s) => String(s || '').replace(/[,()"\\%*]/g, ' ').replace(/\s+/g, ' ').trim();

export function compileMatcher(q) {
  const { from, to } = dateWindow(q);
  const term = norm(cleanSearch(q.search));
  return (r) => {
    const s = tsToYMD(r.start_date), e = tsToYMD(r.end_date) || s;
    if (to && !(s < to)) return false;
    if (from && !(e >= from)) return false;
    if (q.permiso && r.permiso !== q.permiso) return false;
    if (q.viatico && r.viatico !== q.viatico) return false;
    if (q.hasImage && !r.image_url) return false;
    if (term && !norm(r.actividad).includes(term) && !norm(r.lugar).includes(term)) return false;
    return true;
  };
}

export function compareBy(sort, dir) {
  const k = dir === 'asc' ? 1 : -1;
  return (a, b) => {
    const x = a[sort] ?? '', y = b[sort] ?? '';
    const c = typeof x === 'string' ? x.localeCompare(y, 'es', { sensitivity: 'base' }) : x - y;
    return c * k || String(a.id).localeCompare(String(b.id));
  };
}
