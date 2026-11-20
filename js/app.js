// Punto de entrada: enrutador por hash (vistas cargadas bajo demanda y montadas una sola vez), barra superior y atajos
import { getState, subscribe, setQuery, setPrefs } from './core/store.js';
import { wakeDb, isDemo } from './services/data.js';
import { openForm } from './components/form.js';
import { debounce } from './core/utils.js';

const VIEWS = {
  inicio: () => import('./views/dashboard.js'),
  agenda: () => import('./views/agenda.js'),
  calendario: () => import('./views/calendar.js'),
  sistema: () => import('./views/system.js'),
};
const mounted = new Map();
const $ = (s) => document.querySelector(s);

async function route() {
  const name = (location.hash.match(/^#\/(\w+)/) || [])[1];
  const view = VIEWS[name] ? name : 'inicio';
  document.querySelectorAll('section[data-view]').forEach((s) => (s.hidden = s.dataset.view !== view));
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === view));
  document.body.classList.remove('nav-open');
  const sec = document.querySelector(`section[data-view="${view}"]`);
  try {
    const mod = await VIEWS[view]();
    $('#pageTitle').textContent = mod.title;
    document.title = `${mod.title} · Agenda DR`;
    if (!mounted.has(view)) { mounted.set(view, true); await mod.mount(sec); }
  } catch (e) {
    console.error(e);
    sec.innerHTML = `<div class="card err-cell">Error al cargar la vista: ${e.message}</div>`;
  }
}

function paintPill() {
  const { db } = getState(); const p = $('#dbPill');
  p.className = `db-pill ${db.status}`;
  p.querySelector('.txt').textContent = isDemo ? 'Demo' : { ok: `En línea${db.ms ? ` · ${db.ms} ms` : ''}`, slow: `Lenta · ${db.ms} ms`, down: 'Dormida / sin conexión', checking: db.msg || 'Conectando…' }[db.status];
  p.title = db.msg || 'Estado de la base de datos (clic para despertar)';
}
function paintTheme() {
  const dark = getState().prefs.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#btnTheme i').className = `fas ${dark ? 'fa-sun' : 'fa-moon'}`;
}

function init() {
  if (isDemo) $('#demoBanner').hidden = false;
  window.addEventListener('hashchange', route);
  $('#btnNew').addEventListener('click', () => openForm());
  $('#fabNew').addEventListener('click', () => openForm());
  $('#btnTheme').addEventListener('click', () => setPrefs({ theme: getState().prefs.theme === 'dark' ? 'light' : 'dark' }));
  $('#btnMenu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#btnCollapse').addEventListener('click', () => {
    const c = document.documentElement.classList.toggle('sb-collapsed'); setPrefs({ sidebar: c ? 'collapsed' : 'open' });
  });
  $('#dbPill').addEventListener('click', () => wakeDb());
  const search = $('#globalSearch');
  const doSearch = debounce(() => {
    setQuery({ search: search.value.trim() });
    if (search.value.trim() && !location.hash.startsWith('#/agenda')) location.hash = '#/agenda';
  }, 300);
  search.addEventListener('input', doSearch);
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { search.value = ''; doSearch(); search.blur(); } });

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    const busy = $('#drawer-root').innerHTML || $('#modal-root').innerHTML;
    if (typing || busy || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); }
    else if (e.key.toLowerCase() === 'n') { e.preventDefault(); openForm(); }
  });
  document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('#sidebar,#btnMenu')) document.body.classList.remove('nav-open'); });

  subscribe((s, p) => { if (s.db !== p.db) paintPill(); if (s.prefs !== p.prefs) paintTheme(); });
  paintPill(); paintTheme();
  if (!location.hash) history.replaceState(null, '', '#/inicio');
  route();
  // Despertador del navegador: al abrir, al volver a la pestaña y cada 10 min mientras está visible
  wakeDb();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wakeDb({ retries: 2 }); });
  setInterval(() => { if (!document.hidden) wakeDb({ retries: 1 }); }, 10 * 60 * 1000);
}
init();

// ---- Integración nativa (APK Android con Capacitor) ----
const cap = window.Capacitor;
if (cap?.isNativePlatform?.()) {
  document.documentElement.classList.add('native');
  cap.Plugins.App?.addListener('backButton', () => {
    const open = ['#menu-root', '#modal-root', '#drawer-root'].some((s) => $(s).innerHTML);
    if (open) return document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    if (document.body.classList.contains('nav-open')) return document.body.classList.remove('nav-open');
    if (!location.hash.startsWith('#/inicio')) { location.hash = '#/inicio'; return; }
    cap.Plugins.App.exitApp();
  });
  cap.Plugins.App?.addListener('resume', () => wakeDb({ retries: 2 }));
}
