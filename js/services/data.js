// Fuente de datos única para toda la app + caché del listado completo (para inicio/calendario/sugerencias)
import { supabaseService } from './supabaseService.js';
import { createMockService } from './mockService.js';
import { CONFIG } from '../config.js';
import { bumpData, setState } from '../core/store.js';

const demo = new URLSearchParams(location.search).get('demo');
export const api = demo !== null ? createMockService(Number(demo) || 300) : supabaseService;
export const isDemo = api.mode === 'demo';

let cache = null, cacheAt = 0, inflight = null;
export async function allRows(force = false) {
  if (!force && cache && Date.now() - cacheAt < CONFIG.cacheTtlMs) return cache;
  if (inflight) return inflight;
  inflight = api.all().then((r) => { cache = r; cacheAt = Date.now(); return r; }).finally(() => { inflight = null; });
  return inflight;
}
export function invalidate() { cache = null; bumpData(); }

// ---- Despertador del lado del navegador ----
export async function wakeDb({ retries = 4 } = {}) {
  setState({ db: { status: 'checking', ms: null, msg: 'Despertando…' } });
  for (let i = 0; i <= retries; i++) {
    try {
      const ms = await api.ping();
      setState({ db: { status: ms > 2500 ? 'slow' : 'ok', ms, msg: '' } });
      return true;
    } catch (e) {
      const paused = [540, 503, 502, 504].includes(e.status);
      setState({ db: { status: 'checking', ms: null, msg: `Reintento ${i + 1}/${retries}…` } });
      if (i === retries) {
        setState({ db: { status: 'down', ms: null, msg: paused ? 'Proyecto pausado: restaurarlo en supabase.com' : (e.message || 'Sin conexión') } });
        return false;
      }
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}
