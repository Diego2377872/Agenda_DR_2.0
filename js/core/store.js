// Store pub/sub mínimo + preferencias persistentes
import { thisYear } from './dates.js';

const PREFS_KEY = 'agendaDR.prefs';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; } };

export const defaultQuery = () => ({
  search: '', year: String(thisYear()), month: '', from: '', to: '', permiso: '', viatico: '', hasImage: false,
  preset: '', sort: 'start_date', dir: 'desc', page: 1, size: 25,
});

let state = {
  query: { ...defaultQuery(), size: loadPrefs().pageSize || 25 },
  prefs: { theme: document.documentElement.dataset.theme, listView: 'cards', ...loadPrefs() },
  db: { status: 'checking', ms: null, msg: '' },
  dataVersion: 0, // se incrementa con cada escritura -> las vistas recargan
};
const subs = new Set();

export const getState = () => state;
export function setState(patch) {
  const prev = state; state = { ...state, ...patch };
  subs.forEach((fn) => fn(state, prev));
}
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function setQuery(patch, resetPage = true) {
  setState({ query: { ...state.query, ...patch, ...(resetPage ? { page: 1 } : {}) } });
}
export function setPrefs(patch) {
  const prefs = { ...state.prefs, ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  setState({ prefs });
}
export const bumpData = () => setState({ dataVersion: state.dataVersion + 1 });
