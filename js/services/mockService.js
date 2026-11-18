// Servicio DEMO en memoria (?demo=N). Misma interfaz que supabaseService. Nunca toca la base real.
import { compileMatcher, compareBy } from './query.js';
import { addDays, todayYMD, ymdToTs } from '../core/dates.js';

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ACTS = ['Oficina R.E', 'Reunión técnica', 'Gira de campo', 'Taller de capacitación', 'Particular en casa', 'Informe mensual', 'Visita a productores', 'Seminario'];
const LUGS = ['CIHB', 'Casa', 'MAG', 'Ybyraty', 'Asunción', 'FCA_UNA', 'San Lorenzo', 'Caacupé', 'Villarrica'];
const PERM = ['No es necesario', 'No es necesario', 'Sín Entregar', 'Entregado'];

export function createMockService(n = 300) {
  const rnd = mulberry32(42);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  let rows = Array.from({ length: n }, (_, i) => {
    const s = addDays(todayYMD(), -Math.floor(rnd() * 420) + 30);
    const e = rnd() < 0.12 ? addDays(s, 1 + Math.floor(rnd() * 3)) : s;
    return {
      id: `demo-${i + 1}`, start_date: ymdToTs(s), end_date: ymdToTs(e), actividad: pick(ACTS), lugar: pick(LUGS),
      permiso: pick(PERM), viatico: rnd() < 0.1 ? 'Sí' : 'No', image_url: null, created_at: new Date().toISOString(),
    };
  });
  const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  return {
    mode: 'demo',
    async list(q) {
      const f = rows.filter(compileMatcher(q)).sort(compareBy(q.sort, q.dir));
      const off = (q.page - 1) * q.size;
      return delay({ rows: clone(f.slice(off, off + q.size)), count: f.length });
    },
    async all(q = null) { const f = q ? rows.filter(compileMatcher(q)) : rows; return delay(clone([...f].sort(compareBy('start_date', 'desc')))); },
    async get(id) { return delay(clone(rows.find((r) => r.id === id))); },
    async insert(row) { const r = { id: `demo-${Date.now()}`, created_at: new Date().toISOString(), image_url: null, ...row }; rows.push(r); return delay(clone(r)); },
    async update(id, patch) { const r = rows.find((x) => x.id === id); Object.assign(r, patch); return delay(clone(r)); },
    async updateMany(ids, patch) { let n = 0; rows.forEach((r) => { if (ids.includes(r.id)) { Object.assign(r, patch); n++; } }); return delay(n); },
    async remove(id) { rows = rows.filter((r) => r.id !== id); return delay(); },
    async uploadImage(file) { return delay(URL.createObjectURL(file)); },
    async removeImage() { return delay(); },
    async ping() { return delay(5); },
  };
}
