// Vista Sistema: estado de la base, despertador, respaldo y versión anterior
import { allRows, wakeDb, isDemo } from '../services/data.js';
import { getState, subscribe } from '../core/store.js';
import { CONFIG } from '../config.js';
import { esc } from '../core/utils.js';
import { tsToYMD, fmt, todayYMD } from '../core/dates.js';
import { backupJson, exportExcel } from '../components/actions.js';
import { toast } from '../components/ui.js';

const REPO = 'https://github.com/Diego2377872/Agenda_DR_2.0';
let el;

export async function mount(section) {
  el = section;
  subscribe((s, p) => { if (s.db !== p.db) paintDb(); if (s.dataVersion !== p.dataVersion) render(); });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-do]'); if (!b) return;
    const d = b.dataset.do;
    if (d === 'wake') { const ok = await wakeDb(); toast(ok ? 'Base de datos activa' : 'La base no respondió', ok ? 'ok' : 'err'); }
    if (d === 'backup') backupJson().catch((x) => toast(x.message, 'err'));
    if (d === 'xlsx') { const rows = await allRows(true); await exportExcel(rows, `agenda_completa_${todayYMD()}.xlsx`); toast(`Exportadas ${rows.length} actividades`); }
  });
  await render();
}

async function lastPing() {
  for (const u of ['https://raw.githubusercontent.com/Diego2377872/Agenda_DR_2.0/main/keepalive/last_ping.json', 'keepalive/last_ping.json']) {
    try { const r = await fetch(`${u}?t=${Date.now()}`, { cache: 'no-store' }); if (r.ok) return await r.json(); } catch { /* siguiente */ }
  }
  return null;
}

function paintDb() {
  const box = el.querySelector('#dbBox'); if (!box) return;
  const db = getState().db;
  const txt = { ok: 'Activa', slow: 'Activa (lenta, posiblemente despertando)', down: 'Sin respuesta', checking: 'Verificando…' }[db.status];
  box.innerHTML = `<div class="status ${db.status}"><span class="dot"></span><b>${txt}</b>${db.ms ? `<span class="muted">${db.ms} ms</span>` : ''}</div>${db.msg ? `<p class="muted">${esc(db.msg)}</p>` : ''}`;
}

async function render() {
  const [rows, ping] = await Promise.all([allRows().catch(() => []), lastPing()]);
  const dates = rows.map((r) => tsToYMD(r.start_date)).sort();
  const legacy = rows.filter((r) => !CONFIG.permisos.some((p) => p.value === r.permiso)).length;
  el.innerHTML = `<div class="grid2">
    <div class="card"><h3><i class="fas fa-database"></i> Base de datos Supabase</h3>
      <div id="dbBox"></div>
      <button class="btn primary" data-do="wake"><i class="fas fa-bell"></i> Despertar / comprobar ahora</button>
      <h4 class="mt"><i class="fas fa-robot"></i> Despertador automático (GitHub Actions)</h4>
      ${ping ? `<p>Último ping automático: <b>${esc(new Date(ping.utc).toLocaleString('es-PY'))}</b> · HTTP ${esc(ping.http)} · ${esc(ping.ms)} ms</p>` : '<p class="muted">Aún no hay registro del despertador automático.</p>'}
      <p class="muted">Se ejecuta cada 2 días y además registra un commit, para que GitHub nunca desactive el workflow por inactividad (60 días) ni Supabase pause el proyecto (7 días).</p>
      <a class="btn ghost" href="${REPO}/actions/workflows/mantener_vivo.yml" target="_blank" rel="noopener"><i class="fab fa-github"></i> Ver ejecuciones</a>
    </div>
    <div class="card"><h3><i class="fas fa-shield-halved"></i> Respaldo de la información</h3>
      <ul class="stats">
        <li><span>Actividades registradas</span><b>${rows.length}</b></li>
        <li><span>Rango de fechas</span><b>${dates.length ? `${fmt(dates[0])} → ${fmt(dates[dates.length - 1])}` : '—'}</b></li>
        <li><span>Con imagen</span><b>${rows.filter((r) => r.image_url).length}</b></li>
        <li><span>Con viático</span><b>${rows.filter((r) => r.viatico === 'Sí').length}</b></li>
        <li><span>Permiso con valor histórico (Sí/No)</span><b>${legacy}</b></li>
      </ul>
      <div class="row gap wrap">
        <button class="btn primary" data-do="backup"><i class="fas fa-download"></i> Respaldo completo (JSON)</button>
        <button class="btn ghost" data-do="xlsx"><i class="fas fa-file-excel"></i> Todo a Excel</button>
      </div>
      <p class="muted mt">Recomendación: descargar un respaldo mensual.</p>
    </div>
  </div>
  <div class="card"><h3><i class="fas fa-circle-info"></i> Acerca de</h3>
    <p>Agenda DR v${CONFIG.version}${isDemo ? ' · <b>MODO DEMO</b>' : ''} · Tabla <code>${CONFIG.table}</code> · Bucket <code>${CONFIG.bucket}</code></p>
    <p class="muted">Atajos: <kbd>N</kbd> nueva actividad · <kbd>/</kbd> buscar · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> guardar · <kbd>Esc</kbd> cerrar · doble clic o clic derecho en una fila.</p>
    <p><a href="legacy/" target="_blank" rel="noopener">Abrir versión anterior (2.0)</a> · <a href="${REPO}" target="_blank" rel="noopener">Repositorio</a></p>
  </div>`;
  paintDb();
}
export const title = 'Sistema y respaldo';
