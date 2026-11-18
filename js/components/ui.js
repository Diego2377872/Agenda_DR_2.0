// Componentes UI genéricos: toast, diálogo de confirmación, menú contextual, visor de imagen
import { esc, safeUrl } from '../core/utils.js';

export function toast(msg, type = 'ok', { action, onAction, ms = 4200 } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  const icon = { ok: 'fa-circle-check', err: 'fa-triangle-exclamation', info: 'fa-circle-info', warn: 'fa-hourglass-half' }[type] || 'fa-circle-info';
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icon}"></i><span>${esc(msg)}</span>${action ? `<button class="toast-act">${esc(action)}</button>` : ''}`;
  root.appendChild(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  el.querySelector('.toast-act')?.addEventListener('click', () => { close(); onAction?.(); });
  setTimeout(close, ms);
}

export function confirmDialog({ title, body = '', ok = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="overlay show"><div class="modal" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3><div class="modal-body">${body}</div>
      <div class="modal-actions"><button class="btn ghost" data-r="0">Cancelar</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div></div></div>`;
    const done = (v) => { root.innerHTML = ''; document.removeEventListener('keydown', key); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') done(false); if (e.key === 'Enter') done(true); };
    document.addEventListener('keydown', key);
    root.querySelector('.overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('overlay')) return done(false);
      const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === '1');
    });
    root.querySelector('[data-r="1"]').focus();
  });
}

export function showImage(url) {
  const u = safeUrl(url); if (!u) return;
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="overlay show img-viewer"><img src="${esc(u)}" alt="Evidencia" />
    <a class="btn ghost" href="${esc(u)}" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square"></i> Abrir original</a></div>`;
  root.firstElementChild.addEventListener('click', (e) => { if (!e.target.closest('a')) root.innerHTML = ''; });
}

// Menú flotante anclado a un elemento: items = [{label, icon, onClick, danger, active}]
export function openMenu(anchor, items) {
  const root = document.getElementById('menu-root');
  const r = anchor.getBoundingClientRect();
  root.innerHTML = `<div class="menu" role="menu">${items.map((it, i) => it === '-' ? '<hr>' :
    `<button data-i="${i}" class="${it.danger ? 'danger' : ''} ${it.active ? 'active' : ''}" role="menuitem"><i class="fas ${it.icon || 'fa-circle'}"></i>${esc(it.label)}</button>`).join('')}</div>`;
  const m = root.firstElementChild;
  const top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8);
  const left = Math.min(r.left, innerWidth - m.offsetWidth - 8);
  Object.assign(m.style, { top: `${Math.max(8, top)}px`, left: `${Math.max(8, left)}px` });
  const close = () => { root.innerHTML = ''; document.removeEventListener('mousedown', out, true); document.removeEventListener('keydown', esc_); };
  const out = (e) => { if (!m.contains(e.target)) close(); };
  const esc_ = (e) => { if (e.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('mousedown', out, true); document.addEventListener('keydown', esc_); });
  m.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; close(); items[b.dataset.i].onClick?.(); });
}
