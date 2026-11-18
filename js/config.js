// Configuración central (la anon key es pública por diseño; la protección real es RLS en Supabase)
export const CONFIG = Object.freeze({
  version: '3.0.0',
  supabaseUrl: 'https://zrusehtanthkuqsbzdpe.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydXNlaHRhbnRoa3Vxc2J6ZHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NjIxNDAsImV4cCI6MjA3NzUzODE0MH0.S9JMQEavtjkd1xzZqNcMx3BPnAwoDeOO6OrPqhIl-fs',
  table: 'actividades',
  bucket: 'actividades-images',
  supabaseJs: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
  xlsxUrl: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  maxImageMB: 5,
  // Valores EXACTOS tal como están guardados en la base (no cambiar: compatibilidad con datos históricos)
  permisos: [
    { value: 'Sín Entregar', label: 'Sin entregar', tone: 'warn', icon: 'fa-hourglass-half' },
    { value: 'Entregado', label: 'Entregado', tone: 'ok', icon: 'fa-circle-check' },
    { value: 'No es necesario', label: 'No es necesario', tone: 'muted', icon: 'fa-minus' },
  ],
  viaticos: [
    { value: 'Sí', label: 'Sí', tone: 'info', icon: 'fa-wallet' },
    { value: 'No', label: 'No', tone: 'muted', icon: 'fa-ban' },
  ],
  pageSizes: [15, 25, 50, 100, 250],
  cacheTtlMs: 60_000,
});
