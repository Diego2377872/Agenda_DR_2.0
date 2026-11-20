// Utilidades de seguridad y formato genérico
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function safeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  try { const x = new URL(u, location.href); return ['http:', 'https:', 'blob:'].includes(x.protocol) ? x.href : ''; } catch { return ''; }
}
export function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function countBy(rows, fn) { const m = new Map(); for (const r of rows) { const k = fn(r); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); }
export function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}
// Neutraliza inyección de fórmulas en CSV/Excel
export const cellSafe = (v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v);
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
// Guarda un archivo. En la APK: lo escribe en Documentos (o caché) y abre el menú Compartir de Android.
// content: texto, o base64 si opts.base64 = true. Devuelve una descripción de dónde quedó.
export async function download(name, content, type = 'application/octet-stream', opts = {}) {
  if (isNative()) {
    const { Filesystem, Share } = window.Capacitor.Plugins;
    const data = opts.base64 ? content : utf8ToB64(String(content));
    let res, where;
    try { res = await Filesystem.writeFile({ path: `AgendaDR/${name}`, data, directory: 'DOCUMENTS', recursive: true }); where = `Documentos/AgendaDR/${name}`; }
    catch { res = await Filesystem.writeFile({ path: name, data, directory: 'CACHE' }); where = name; }
    try { await Share.share({ title: name, url: res.uri, dialogTitle: 'Guardar o compartir' }); } catch { /* el usuario cerró el menú */ }
    return where;
  }
  const blob = opts.base64 ? new Blob([Uint8Array.from(atob(content), (c) => c.charCodeAt(0))], { type }) : (content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  return name;
}
