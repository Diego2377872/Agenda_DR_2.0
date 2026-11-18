// Servicio real: Supabase (misma tabla, mismo bucket y mismas columnas que la versión anterior)
import { CONFIG } from '../config.js';
import { dateWindow, cleanSearch } from './query.js';
import { ymdToTs } from '../core/dates.js';

let sb = null;
async function client() {
  if (sb) return sb;
  const { createClient } = await import(CONFIG.supabaseJs);
  sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  return sb;
}
const T = CONFIG.table;

function applyQuery(qb, q) {
  const { from, to } = dateWindow(q);
  if (to) qb = qb.lt('start_date', ymdToTs(to));
  if (from) qb = qb.gte('end_date', ymdToTs(from));
  if (q.permiso) qb = qb.eq('permiso', q.permiso);
  if (q.viatico) qb = qb.eq('viatico', q.viatico);
  if (q.hasImage) qb = qb.not('image_url', 'is', null);
  const t = cleanSearch(q.search);
  if (t) qb = qb.or(`actividad.ilike."%${t}%",lugar.ilike."%${t}%"`);
  return qb;
}
const must = ({ data, error, count }) => { if (error) throw new Error(error.message || String(error)); return { data, count }; };

export const supabaseService = {
  mode: 'supabase',
  async list(q) {
    const c = await client();
    const off = (q.page - 1) * q.size;
    let qb = applyQuery(c.from(T).select('*', { count: 'exact' }), q)
      .order(q.sort, { ascending: q.dir === 'asc', nullsFirst: false }).order('id', { ascending: true })
      .range(off, off + q.size - 1);
    const { data, count } = must(await qb);
    return { rows: data || [], count: count || 0 };
  },
  async all(q = null) {
    const c = await client();
    const out = []; const step = 1000;
    for (let off = 0; ; off += step) {
      let qb = c.from(T).select('*');
      if (q) qb = applyQuery(qb, q);
      const { data } = must(await qb.order('start_date', { ascending: false }).order('id').range(off, off + step - 1));
      out.push(...(data || []));
      if (!data || data.length < step) break;
    }
    return out;
  },
  async get(id) { const c = await client(); return must(await c.from(T).select('*').eq('id', id).single()).data; },
  async insert(row) { const c = await client(); return must(await c.from(T).insert([row]).select().single()).data; },
  async update(id, patch) {
    const c = await client();
    const { data } = must(await c.from(T).update(patch).eq('id', id).select());
    if (!data || !data.length) throw new Error('La base no confirmó el cambio (¿permisos RLS?).');
    return data[0];
  },
  async updateMany(ids, patch) {
    const c = await client();
    const { data } = must(await c.from(T).update(patch).in('id', ids).select('id'));
    return (data || []).length;
  },
  async remove(id) {
    const c = await client();
    const { data } = must(await c.from(T).delete().eq('id', id).select('id'));
    if (!data || !data.length) throw new Error('La base no confirmó el borrado (¿permisos RLS?).');
  },
  async uploadImage(file) {
    const c = await client();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `public/${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${ext}`;
    must(await c.storage.from(CONFIG.bucket).upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' }));
    return c.storage.from(CONFIG.bucket).getPublicUrl(path).data.publicUrl;
  },
  async removeImage(url) {
    if (!url) return;
    const marker = `/object/public/${CONFIG.bucket}/`;
    const path = url.includes(marker) ? decodeURIComponent(url.split(marker)[1]) : `public/${url.split('/').pop()}`;
    const c = await client();
    await c.storage.from(CONFIG.bucket).remove([path]); // si falla no bloquea el borrado del registro
  },
  // "Despertador" desde el navegador: consulta mínima con medición de latencia
  async ping() {
    const t0 = performance.now();
    const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${T}?select=id&limit=1`, {
      headers: { apikey: CONFIG.supabaseKey, Authorization: `Bearer ${CONFIG.supabaseKey}` }, cache: 'no-store',
    });
    const ms = Math.round(performance.now() - t0);
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status, ms });
    return ms;
  },
};
