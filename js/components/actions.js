// Acciones de negocio reutilizadas por todas las vistas (borrar, duplicar, cambio rápido, exportar)
import { api, invalidate, allRows } from '../services/data.js';
import { toast, confirmDialog, openMenu } from './ui.js';
import { openForm } from './form.js';
import { CONFIG } from '../config.js';
import { tsToYMD, fmt, todayYMD } from '../core/dates.js';
import { esc, cellSafe, download, loadScript } from '../core/utils.js';

export const permisoInfo = (v) => CONFIG.permisos.find((p) => p.value === v) || { value: v, label: v || '—', tone: 'legacy', icon: 'fa-question' };
export const viaticoInfo = (v) => CONFIG.viaticos.find((p) => p.value === v) || { value: v, label: v || '—', tone: 'legacy', icon: 'fa-question' };
export const badge = (info, attrs = '') => `<span class="badge ${info.tone}" ${attrs}><i class="fas ${info.icon}"></i>${esc(info.label)}</span>`;

export async function deleteRow(row) {
  const ok = await confirmDialog({
    title: '¿Eliminar esta actividad?', danger: true, ok: 'Eliminar',
    body: `<p><b>${esc(row.actividad)}</b><br>${esc(row.lugar)} · ${fmt(tsToYMD(row.start_date))}</p><p class="muted">Esta acción no se puede deshacer${row.image_url ? ' (también se borra la imagen)' : ''}.</p>`,
  });
  if (!ok) return false;
  try {
    await api.remove(row.id);
    if (row.image_url) api.removeImage(row.image_url).catch(() => {});
    invalidate(); toast('Actividad eliminada');
    return true;
  } catch (e) { toast('Error al eliminar: ' + e.message, 'err', { ms: 7000 }); return false; }
}

export function duplicateRow(row) { openForm({ mode: 'dup', row }); }

// Cambio rápido de un campo con opción de deshacer
export async function quickSet(row, field, value) {
  if (row[field] === value) return;
  const prev = row[field];
  try {
    await api.update(row.id, { [field]: value });
    invalidate();
    toast(`${field === 'permiso' ? 'Permiso' : 'Viático'}: ${value}`, 'ok', {
      action: 'Deshacer', onAction: async () => { await api.update(row.id, { [field]: prev }); invalidate(); toast('Cambio revertido', 'info'); },
    });
  } catch (e) { toast('No se pudo actualizar: ' + e.message, 'err'); }
}

export function permisoMenu(anchor, row) {
  openMenu(anchor, CONFIG.permisos.map((p) => ({ label: p.label, icon: p.icon, active: row.permiso === p.value, onClick: () => quickSet(row, 'permiso', p.value) })));
}
export function viaticoMenu(anchor, row) {
  openMenu(anchor, CONFIG.viaticos.map((p) => ({ label: `Viático: ${p.label}`, icon: p.icon, active: row.viatico === p.value, onClick: () => quickSet(row, 'viatico', p.value) })));
}
export function rowMenu(anchor, row) {
  openMenu(anchor, [
    { label: 'Editar', icon: 'fa-pen', onClick: () => openForm({ mode: 'edit', row }) },
    { label: 'Duplicar para hoy', icon: 'fa-clone', onClick: () => duplicateRow(row) },
    '-',
    ...CONFIG.permisos.map((p) => ({ label: `Permiso: ${p.label}`, icon: p.icon, active: row.permiso === p.value, onClick: () => quickSet(row, 'permiso', p.value) })),
    '-',
    { label: 'Eliminar', icon: 'fa-trash', danger: true, onClick: () => deleteRow(row) },
  ]);
}

// ---- Exportación ----
const toExport = (rows) => rows.map((r) => ({
  Desde: fmt(tsToYMD(r.start_date)), Hasta: fmt(tsToYMD(r.end_date)), Actividad: cellSafe(r.actividad), Lugar: cellSafe(r.lugar),
  Permiso: r.permiso, 'Viático': r.viatico, Imagen: r.image_url || 'Sin imagen',
}));
export async function exportExcel(rows, name) {
  await loadScript(CONFIG.xlsxUrl);
  const ws = window.XLSX.utils.json_to_sheet(toExport(rows));
  ws['!cols'] = [{ wch: 11 }, { wch: 11 }, { wch: 50 }, { wch: 24 }, { wch: 16 }, { wch: 8 }, { wch: 40 }];
  const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Actividades');
  const b64 = window.XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  return download(name, b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { base64: true });
}
export function exportCsv(rows, name) {
  const data = toExport(rows); const cols = Object.keys(data[0] || { Desde: '' });
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return download(name, '\ufeff' + [cols.map(q).join(';'), ...data.map((r) => cols.map((c) => q(r[c])).join(';'))].join('\r\n'), 'text/csv;charset=utf-8');
}
export async function backupJson() {
  const rows = await allRows(true);
  const where = await download(`agenda_DR_respaldo_${todayYMD()}.json`, JSON.stringify({ exportado: new Date().toISOString(), tabla: CONFIG.table, total: rows.length, filas: rows }, null, 1), 'application/json');
  toast(`Respaldo guardado (${rows.length} actividades): ${where}`);
}
