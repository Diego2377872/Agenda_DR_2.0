// Utilidades de fechas y formato.
// Las fechas se guardan como timestamptz a medianoche de Paraguay (UTC-3), p.ej. 2026-11-06T03:00:00+00:00.
// Se trabaja SIEMPRE con cadenas 'YYYY-MM-DD' para evitar corrimientos de zona horaria.
export const PY_OFFSET = '-03:00';
const MS3 = 3 * 3600e3;
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const pad = (n) => String(n).padStart(2, '0');
export const todayYMD = () => new Date(Date.now() - MS3).toISOString().slice(0, 10);
export const thisYear = () => Number(todayYMD().slice(0, 4));

export function tsToYMD(ts) {
  if (!ts) return '';
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return String(ts).slice(0, 10);
  return new Date(t - MS3).toISOString().slice(0, 10);
}
export const ymdToTs = (ymd) => `${ymd}T00:00:00${PY_OFFSET}`;

function parts(ymd) { const [y, m, d] = ymd.split('-').map(Number); return [y, m, d]; }
export function addDays(ymd, n) {
  const [y, m, d] = parts(ymd);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function diffDays(a, b) {
  const [y1, m1, d1] = parts(a); const [y2, m2, d2] = parts(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}
export function weekday(ymd) { const [y, m, d] = parts(ymd); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; } // 0 = lunes
export function fmt(ymd) { if (!ymd) return ''; const [y, m, d] = ymd.split('-'); return `${d}/${m}/${y}`; }
export function fmtNice(ymd) {
  if (!ymd) return '';
  const [y, m, d] = parts(ymd);
  return `${DIAS_CORTO[weekday(ymd)]} ${d} ${MESES_CORTO[m - 1]} ${y}`;
}
export function monthRange(y, m) {
  y = Number(y); m = Number(m);
  const start = `${y}-${pad(m)}-01`;
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return [start, end];
}
export function weekRange(ymd) { const s = addDays(ymd, -weekday(ymd)); return [s, addDays(s, 7)]; }
export function relLabel(ymd) {
  const d = diffDays(todayYMD(), ymd);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Ayer';
  if (d > 1 && d < 7) return `En ${d} días`;
  if (d < -1 && d > -7) return `Hace ${-d} días`;
  return '';
}
