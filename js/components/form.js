// Formulario lateral (drawer) con botonera inteligente: fechas rápidas, plantillas frecuentes, lugares frecuentes
import { CONFIG } from '../config.js';
import { api, allRows, invalidate } from '../services/data.js';
import { toast } from './ui.js';
import { esc, countBy, safeUrl } from '../core/utils.js';
import { todayYMD, addDays, tsToYMD, ymdToTs, fmtNice, diffDays } from '../core/dates.js';

let current = null; // { mode, row }
let ctl = null;    // AbortController de los listeners del drawer abierto

function segmented(name, options, value) {
  const opts = [...options];
  if (value && !opts.some((o) => o.value === value)) opts.push({ value, label: `${value} (histórico)`, icon: 'fa-clock-rotate-left' });
  return `<div class="seg" data-seg="${name}">${opts.map((o) =>
    `<button type="button" data-v="${esc(o.value)}" class="${o.value === value ? 'on' : ''}"><i class="fas ${o.icon}"></i>${esc(o.label)}</button>`).join('')}</div>`;
}

async function suggestions() {
  try {
    const rows = await allRows();
    const recent = rows.filter((r) => diffDays(tsToYMD(r.start_date), todayYMD()) <= 120);
    const base = recent.length >= 5 ? recent : rows;
    const tpl = countBy(base, (r) => JSON.stringify([r.actividad.trim(), r.lugar.trim(), r.permiso, r.viatico])).slice(0, 6).map(([k, n]) => [...JSON.parse(k), n]);
    const lugares = countBy(rows, (r) => r.lugar.trim()).map(([k]) => k);
    const acts = countBy(rows, (r) => r.actividad.trim()).map(([k]) => k);
    return { tpl, lugares, acts };
  } catch { return { tpl: [], lugares: [], acts: [] }; }
}

export async function openForm({ mode = 'new', row = null, date = null } = {}) {
  current = { mode, row };
  ctl?.abort(); ctl = new AbortController();
  const sig = { signal: ctl.signal };
  const root = document.getElementById('drawer-root');
  const isEdit = mode === 'edit';
  const start = isEdit ? tsToYMD(row.start_date) : (date || todayYMD());
  const end = isEdit ? tsToYMD(row.end_date) : start;
  const v = {
    actividad: row?.actividad || '', lugar: row?.lugar || '',
    permiso: row?.permiso || 'No es necesario', viatico: row?.viatico || 'No',
  };
  const multi = end && end !== start;
  const title = { new: 'Nueva actividad', edit: 'Editar actividad', dup: 'Duplicar actividad' }[mode];

  root.innerHTML = `<div class="overlay show" data-close></div>
  <aside class="drawer open" role="dialog" aria-modal="true" aria-label="${title}">
    <header class="drawer-head"><h2><i class="fas ${isEdit ? 'fa-pen' : 'fa-plus'}"></i> ${title}</h2>
      <button class="icon-btn" data-close aria-label="Cerrar"><i class="fas fa-xmark"></i></button></header>
    <form class="drawer-body" id="actForm" novalidate>
      <div class="smart" id="tplBox"><label class="lbl"><i class="fas fa-bolt"></i> Plantillas frecuentes</label><div class="chips" id="tplChips"><span class="muted">Cargando…</span></div></div>

      <div class="field">
        <label class="lbl" for="fStart"><i class="fas fa-calendar-day"></i> Fecha</label>
        <div class="row gap">
          <input type="date" id="fStart" value="${start}" required />
          <div class="chips tight">
            <button type="button" class="chip" data-day="-1">Ayer</button>
            <button type="button" class="chip" data-day="0">Hoy</button>
            <button type="button" class="chip" data-day="1">Mañana</button>
          </div>
        </div>
        <label class="switch"><input type="checkbox" id="fMulti" ${multi ? 'checked' : ''}/><span></span> Varios días</label>
        <div class="row gap" id="endRow" ${multi ? '' : 'hidden'}>
          <label class="lbl" for="fEnd">Hasta</label><input type="date" id="fEnd" value="${end}" />
          <div class="chips tight"><button type="button" class="chip" data-len="2">2 días</button><button type="button" class="chip" data-len="3">3 días</button><button type="button" class="chip" data-len="5">5 días</button></div>
        </div>
        <small class="hint" id="dateHint"></small>
      </div>

      <div class="field">
        <label class="lbl" for="fAct"><i class="fas fa-list-check"></i> Actividad</label>
        <textarea id="fAct" rows="3" maxlength="500" required placeholder="Describe la actividad…">${esc(v.actividad)}</textarea>
        <div class="chips" id="actChips"></div>
      </div>

      <div class="field">
        <label class="lbl" for="fLugar"><i class="fas fa-location-dot"></i> Lugar / Institución</label>
        <input id="fLugar" list="dlLugares" maxlength="200" required value="${esc(v.lugar)}" placeholder="Ej. CIHB" autocomplete="off" />
        <datalist id="dlLugares"></datalist>
        <div class="chips" id="lugarChips"></div>
      </div>

      <div class="field"><label class="lbl"><i class="fas fa-file-signature"></i> Permiso</label>${segmented('permiso', CONFIG.permisos, v.permiso)}</div>
      <div class="field"><label class="lbl"><i class="fas fa-wallet"></i> Viático</label>${segmented('viatico', CONFIG.viaticos, v.viatico)}</div>

      <div class="field">
        <label class="lbl"><i class="fas fa-image"></i> Imagen (opcional, máx ${CONFIG.maxImageMB} MB)</label>
        <label class="drop" id="drop"><input type="file" id="fImg" accept="image/jpeg,image/png,image/gif,image/webp" hidden />
          <i class="fas fa-cloud-arrow-up"></i><span>Arrastra o haz clic para elegir</span></label>
        <div id="imgPrev" class="img-prev">${isEdit && row.image_url ? `<img src="${esc(safeUrl(row.image_url))}" alt=""><button type="button" class="btn ghost sm" id="rmImg"><i class="fas fa-xmark"></i> Quitar imagen</button>` : ''}</div>
      </div>
    </form>
    <footer class="drawer-foot">
      <span class="muted kbd-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> guardar</span>
      ${isEdit ? '' : '<button class="btn ghost" id="saveNew" type="button"><i class="fas fa-layer-group"></i> Guardar y otra</button>'}
      <button class="btn primary" id="saveBtn" type="button"><i class="fas fa-floppy-disk"></i> ${isEdit ? 'Actualizar' : 'Guardar'}</button>
    </footer>
  </aside>`;

  const $ = (s) => root.querySelector(s);
  const form = { start: $('#fStart'), end: $('#fEnd'), multi: $('#fMulti'), act: $('#fAct'), lugar: $('#fLugar'), img: $('#fImg') };
  let removeImage = false, file = null;
  const segVal = (n) => root.querySelector(`[data-seg="${n}"] .on`)?.dataset.v || '';

  const updateHint = () => {
    const s = form.start.value, e = form.multi.checked ? form.end.value : s;
    const h = $('#dateHint');
    if (!s) return (h.textContent = '');
    if (e && e < s) { h.textContent = '⚠ La fecha final es anterior a la inicial'; h.className = 'hint bad'; return; }
    const n = e ? diffDays(s, e) + 1 : 1;
    h.className = 'hint'; h.textContent = `${fmtNice(s)}${n > 1 ? ` → ${fmtNice(e)} · ${n} días` : ''}`;
  };
  updateHint();

  const close = () => { root.innerHTML = ''; current = null; ctl?.abort(); };
  const onKey = (e) => {
    if (e.key === 'Escape' && !document.getElementById('modal-root').innerHTML) close();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(false); }
  };
  document.addEventListener('keydown', onKey, sig);
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return close();
    const seg = e.target.closest('.seg button');
    if (seg) { seg.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === seg)); return; }
    const day = e.target.closest('[data-day]');
    if (day) { form.start.value = addDays(todayYMD(), Number(day.dataset.day)); if (!form.multi.checked) form.end.value = form.start.value; updateHint(); return; }
    const len = e.target.closest('[data-len]');
    if (len) { form.end.value = addDays(form.start.value || todayYMD(), Number(len.dataset.len) - 1); updateHint(); return; }
    if (e.target.closest('#rmImg')) { removeImage = true; file = null; $('#imgPrev').innerHTML = '<span class="muted">La imagen se quitará al guardar.</span>'; }
  }, sig);
  form.multi.addEventListener('change', () => { $('#endRow').hidden = !form.multi.checked; if (form.multi.checked && (!form.end.value || form.end.value < form.start.value)) form.end.value = addDays(form.start.value, 1); updateHint(); });
  form.start.addEventListener('change', () => { if (!form.multi.checked || form.end.value < form.start.value) form.end.value = form.start.value; updateHint(); });
  form.end.addEventListener('change', updateHint);

  const setFile = (f) => {
    if (!f) return;
    if (!/^image\//.test(f.type)) return toast('El archivo debe ser una imagen', 'err');
    if (f.size > CONFIG.maxImageMB * 1024 * 1024) return toast(`La imagen supera ${CONFIG.maxImageMB} MB`, 'err');
    file = f; removeImage = false;
    $('#imgPrev').innerHTML = `<img src="${URL.createObjectURL(f)}" alt=""><span class="muted">${esc(f.name)} · ${(f.size / 1024).toFixed(0)} KB</span>`;
  };
  form.img.addEventListener('change', () => setFile(form.img.files[0]));
  const drop = $('#drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); setFile(e.dataTransfer.files[0]); });

  async function save(another) {
    const s = form.start.value, e = form.multi.checked ? form.end.value : s;
    const actividad = form.act.value.trim(), lugar = form.lugar.value.trim();
    const permiso = segVal('permiso'), viatico = segVal('viatico');
    const miss = [!s && 'fecha', !actividad && 'actividad', !lugar && 'lugar', !permiso && 'permiso', !viatico && 'viático'].filter(Boolean);
    if (miss.length) { toast('Falta completar: ' + miss.join(', '), 'err'); (s ? (actividad ? form.lugar : form.act) : form.start).focus(); return; }
    if (e < s) return toast('La fecha final no puede ser anterior a la inicial', 'err');
    const btns = root.querySelectorAll('.drawer-foot .btn'); btns.forEach((b) => (b.disabled = true));
    $('#saveBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';
    try {
      const data = { start_date: ymdToTs(s), end_date: ymdToTs(e), actividad, lugar, permiso, viatico };
      if (file) data.image_url = await api.uploadImage(file);
      else if (removeImage) data.image_url = null;
      // En edición sin imagen nueva NO se envía image_url -> se conserva la existente
      if (isEdit) await api.update(row.id, data); else await api.insert(data);
      invalidate();
      toast(isEdit ? 'Actividad actualizada' : 'Actividad guardada');
      if (another) {
        const next = addDays(s, 1);
        openForm({ mode: 'new', date: next });
      } else close();
    } catch (err) {
      toast('Error al guardar: ' + err.message, 'err', { ms: 8000 });
      btns.forEach((b) => (b.disabled = false));
      $('#saveBtn').innerHTML = `<i class="fas fa-floppy-disk"></i> ${isEdit ? 'Actualizar' : 'Guardar'}`;
    }
  }
  $('#saveBtn').addEventListener('click', () => save(false));
  $('#saveNew')?.addEventListener('click', () => save(true));
  root.querySelector('#actForm').addEventListener('submit', (e) => { e.preventDefault(); save(false); });
  if (matchMedia('(min-width: 760px) and (pointer: fine)').matches) form.act.focus(); // en el celular no abrir el teclado de golpe

  // Sugerencias inteligentes (asíncronas)
  const sug = await suggestions();
  if (!current || current.row !== row || current.mode !== mode) return; // el drawer cambió mientras cargaba
  const tplChips = $('#tplChips');
  if (tplChips) {
    tplChips.innerHTML = sug.tpl.length ? sug.tpl.map((t, i) =>
      `<button type="button" class="chip tpl" data-tpl="${i}" title="${esc(`${t[0]} · ${t[1]} · Permiso: ${t[2]} · Viático: ${t[3]}`)}"><b>${esc(t[0])}</b><small>${esc(t[1])} · ×${t[4]}</small></button>`).join('')
      : '<span class="muted">Aún no hay historial suficiente.</span>';
    tplChips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tpl]'); if (!b) return;
      const t = sug.tpl[b.dataset.tpl];
      form.act.value = t[0]; form.lugar.value = t[1];
      [['permiso', t[2]], ['viatico', t[3]]].forEach(([n, val]) => {
        const box = root.querySelector(`[data-seg="${n}"]`);
        const target = [...box.querySelectorAll('button')].find((x) => x.dataset.v === val);
        if (target) box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === target));
      });
      b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), 400);
    });
  }
  if (isEdit) $('#tplBox').hidden = true;
  $('#dlLugares').innerHTML = sug.lugares.map((l) => `<option value="${esc(l)}">`).join('');
  $('#lugarChips').innerHTML = sug.lugares.slice(0, 6).map((l) => `<button type="button" class="chip sm" data-lug="${esc(l)}">${esc(l)}</button>`).join('');
  $('#lugarChips').addEventListener('click', (e) => { const b = e.target.closest('[data-lug]'); if (b) form.lugar.value = b.dataset.lug; });
  $('#actChips').innerHTML = sug.acts.slice(0, 5).map((a) => `<button type="button" class="chip sm" data-act="${esc(a)}">${esc(a.length > 32 ? a.slice(0, 30) + '…' : a)}</button>`).join('');
  $('#actChips').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) form.act.value = b.dataset.act; });
}
