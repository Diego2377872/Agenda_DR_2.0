# Agenda DR 3.0 — Diego Rodríguez

Agenda personal de actividades (GitHub Pages + Supabase). **Misma base de datos, misma tabla (`actividades`) y mismo bucket (`actividades-images`) que la versión 2.0: no se migró ni se modificó ningún dato.**

🌐 App: https://diego2377872.github.io/Agenda_DR_2.0/  
🗂 Versión anterior intacta: https://diego2377872.github.io/Agenda_DR_2.0/legacy/

## Novedades
- **Inicio**: indicadores (actividades del año, días con actividad, permisos sin entregar, viáticos), gráfico mensual y lugares frecuentes clicables, lista de permisos pendientes con botón "Entregado", próximos 30 días y recientes.
- **Actividades**: botonera de filtros rápidos (Hoy, Semana, Mes, Mes anterior, Permisos sin entregar, Con viático, Con imagen, Todo), búsqueda global, orden por columna, paginación del lado del servidor (15–250 filas), selección múltiple con acciones masivas, menú contextual (clic derecho), cambio rápido de permiso/viático con **Deshacer**, duplicar para hoy, exportar Excel/CSV.
- **Formulario inteligente**: plantillas frecuentes (un clic rellena todo), botones Ayer/Hoy/Mañana, "Varios días" con atajos 2/3/5 días, autocompletado de lugares, "Guardar y otra", arrastrar imagen, conserva la imagen al editar.
- **Calendario** mensual con colores por estado del permiso.
- **Sistema y respaldo**: estado de la base, botón "Despertar", último ping automático, respaldo completo en JSON y Excel.
- Tema claro/oscuro, diseño responsive (móvil con botón flotante), atajos: `N` nueva, `/` buscar, `Ctrl+Enter` guardar, `Esc` cerrar.
- Corregido: el filtro de permiso "No entregado" nunca coincidía con el valor guardado `Sín Entregar`.

## Despertador de Supabase
`.github/workflows/mantener_vivo.yml`
- Ping cada 2 días a la API REST con reintentos y verificación del código HTTP (falla visible si no es 2xx).
- Registra un commit (`keepalive/last_ping.json`) para que GitHub no desactive el workflow por 60 días sin actividad (causa por la que el despertador anterior dejó de funcionar en mayo 2026).
- Reinicia el contador de inactividad vía API.
- La app también hace ping al abrirse, al volver a la pestaña y cada 10 min.

## Arquitectura (sin compilación)
```
index.html            shell
css/app.css           diseño (variables, tema oscuro, responsive)
js/app.js             router por hash + barra superior + atajos
js/config.js          configuración (URL, key pública, catálogos)
js/core/              store (pub/sub), fechas (UTC-3 como texto), utilidades/seguridad
js/services/          supabaseService · mockService (?demo=N) · query (filtros) · data (caché, despertador)
js/components/        ui (toast, diálogo, menú), form (drawer), actions (acciones de negocio, exportar)
js/views/             dashboard · agenda · calendar · system
legacy/               versión 2.0 original
docs/                 SQL de diagnóstico/recomendaciones (no aplicado)
```
Modo demo para pruebas sin tocar datos reales: `?demo=300`.

Rollback: `git checkout v1-legacy` (tag de la versión original).
