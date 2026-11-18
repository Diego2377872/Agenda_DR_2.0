-- =====================================================================
-- Agenda DR v3 — Recomendaciones para Supabase (NO aplicadas automáticamente)
-- Ejecutar primero SOLO los diagnósticos (sección 1) en el SQL Editor y revisar.
-- =====================================================================

-- 1) DIAGNÓSTICO --------------------------------------------------------
-- ¿RLS activo en la tabla?
select relname, relrowsecurity as rls_activo
from pg_class where relname = 'actividades';

-- Políticas existentes
select policyname, cmd, roles, qual, with_check
from pg_policies where tablename = 'actividades';

-- Políticas del bucket de imágenes
select policyname, cmd, roles, qual
from pg_policies where schemaname = 'storage' and tablename = 'objects';

-- Valores históricos de "permiso" fuera del catálogo actual (hoy: 5 filas con 'Sí'/'No')
select permiso, count(*) from public.actividades group by 1 order by 2 desc;

-- 2) ÍNDICES (seguros, mejoran filtros/orden) ----------------------------
-- create index if not exists actividades_start_date_idx on public.actividades (start_date desc);
-- create index if not exists actividades_end_date_idx   on public.actividades (end_date);
-- create index if not exists actividades_permiso_idx    on public.actividades (permiso);

-- 3) SEGURIDAD (decidir con el usuario) ---------------------------------
-- La anon key está publicada en la web (es normal en Supabase), por lo que
-- cualquier persona que la copie puede leer/escribir si las políticas lo permiten.
-- Opción recomendada a futuro: login con Supabase Auth (magic link) y políticas
-- restringidas a usuarios autenticados. Requiere cambio coordinado en la app.
