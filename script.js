// === CONFIGURACIÓN SUPABASE ===
const SUPABASE_URL = 'https://zrusehtanthkuqsbzdpe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydXNlaHRhbnRoa3Vxc2J6ZHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NjIxNDAsImV4cCI6MjA3NzUzODE0MH0.S9JMQEavtjkd1xzZqNcMx3BPnAwoDeOO6OrPqhIl-fs';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === ELEMENTOS DEL DOM ===
const formulario = document.getElementById("formulario");
const tablaContenedor = document.getElementById("lista"); // <--- AÑADIDO: Referencia al contenedor principal de la tabla
const tbody = document.getElementById("tbodyActividades");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const mensajeVacio = document.getElementById("mensajeVacio");
const filtroAnio = document.getElementById("filtroAnio");
const filtroMes = document.getElementById("filtroMes");
const filtroRangoDesde = document.getElementById("filtroRangoDesde");
const filtroRangoHasta = document.getElementById("filtroRangoHasta");
const filtroPermiso = document.getElementById("filtroPermiso");
const filtroViatico = document.getElementById("filtroViatico");
const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
const btnExportar = document.getElementById("btnExportar");
const paginacion = document.getElementById("paginacion");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const infoPagina = document.getElementById("infoPagina");

const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
const imagenInput = document.getElementById("imagen");

// === LOADER ===
const loader = document.getElementById("loaderOverlay");
function showLoader() { loader.classList.add("active"); }
function hideLoader() { loader.classList.remove("active"); }

// === VARIABLES DE ESTADO ===
let editandoId = null;
let queryTotalCount = 0;
let currentPage = 1;
const pageSize = 15;

// === FECHAS ===
function getDaysInMonth(year, month) {
  const isLeap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
  const days = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
}

function buildAndAdjustDateFromString(dateStr, isStart = true) {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split('/').map(Number);
  if (!day || !month || !year) {
    alert("Formato de fecha inválido. Usa DD/MM/YYYY.");
    return null;
  }
  const date = new Date(year, month - 1, day);
  const maxDays = getDaysInMonth(year, month);
  if (day > maxDays) {
    const adjustedDay = maxDays;
    date.setDate(adjustedDay);
    const monthName = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][month];
    alert(`Advertencia! ${monthName} no tiene ${day} días. Se ajustó al último día válido (${adjustedDay}).`);
    return date;
  }
  return date;
}

function initAnios(yearSelect) {
  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = '<option value="">Todos los años</option>';
  for (let year = currentYear - 1; year <= currentYear + 1; year++) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }
}
initAnios(filtroAnio);

let startPicker, endPicker;
document.addEventListener("DOMContentLoaded", function() {
  startPicker = flatpickr("#startDateInput", {
    dateFormat: "d/m/Y",
    locale: "es",
    allowInput: true,
    defaultDate: new Date(),
    onReady: function() {
      startDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
    }
  });

  endPicker = flatpickr("#endDateInput", {
    dateFormat: "d/m/Y",
    locale: "es",
    allowInput: true,
    defaultDate: new Date(),
    onReady: function() {
      endDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
    }
  });
});

[filtroAnio, filtroMes, filtroRangoDesde, filtroRangoHasta, filtroPermiso, filtroViatico].forEach((el) => {
  el.addEventListener("change", cargarTabla);
});

btnLimpiarFiltros.addEventListener("click", () => {
  filtroAnio.value = "";
  filtroMes.value = "";
  filtroRangoDesde.value = "";
  filtroRangoHasta.value = "";
  filtroPermiso.value = "";
  filtroViatico.value = "";
  cargarTabla();
});

function resetPaginacion() {
  currentPage = 1;
  paginacion.style.display = "none";
}

async function cargarTabla() {
  showLoader();
  resetPaginacion();

  try {
    let query = supabaseClient.from('actividades').select('*', { count: 'exact', head: true }).order('start_date', { ascending: false });

    const rangoDesde = filtroRangoDesde.value ? new Date(filtroRangoDesde.value) : null;
    const rangoHasta = filtroRangoHasta.value ? new Date(filtroRangoHasta.value) : null;
    if (rangoDesde) query = query.gte('start_date', rangoDesde.toISOString());
    if (rangoHasta) query = query.lte('start_date', rangoHasta.toISOString());

    const anio = filtroAnio.value;
    const mes = filtroMes.value;
    if (mes) {
      const year = anio || new Date().getFullYear();
      const startMes = new Date(year, mes - 1, 1);
      const endMes = new Date(year, mes, 0);
      query = query.gte('start_date', startMes.toISOString()).lte('start_date', endMes.toISOString());
    } else if (anio) {
      const startAnio = new Date(anio, 0, 1);
      const endAnio = new Date(anio, 11, 31);
      query = query.gte('start_date', startAnio.toISOString()).lte('start_date', endAnio.toISOString());
    }

    if (filtroPermiso.value) query = query.eq('permiso', filtroPermiso.value);
    if (filtroViatico.value) query = query.eq('viatico', filtroViatico.value);

    const { count, error: totalError } = await query;
    if (totalError) throw totalError;
    queryTotalCount = count || 0;

    await renderPage();
  } catch (error) {
    alert(`Error al cargar filtros: ${error.message}`);
  } finally {
    hideLoader();
  }
}

async function renderPage() {
  showLoader();
  try {
    const offset = (currentPage - 1) * pageSize;
    let query = supabaseClient.from('actividades').select('*').order('start_date', { ascending: false });

    const rangoDesde = filtroRangoDesde.value ? new Date(filtroRangoDesde.value) : null;
    const rangoHasta = filtroRangoHasta.value ? new Date(filtroRangoHasta.value) : null;
    if (rangoDesde) query = query.gte('start_date', rangoDesde.toISOString());
    if (rangoHasta) query = query.lte('start_date', rangoHasta.toISOString());

    const anio = filtroAnio.value;
    const mes = filtroMes.value;
    if (mes) {
      const year = anio || new Date().getFullYear();
      const startMes = new Date(year, mes - 1, 1);
      const endMes = new Date(year, mes, 0);
      query = query.gte('start_date', startMes.toISOString()).lte('start_date', endMes.toISOString());
    } else if (anio) {
      const startAnio = new Date(anio, 0, 1);
      const endAnio = new Date(anio, 11, 31);
      query = query.gte('start_date', startAnio.toISOString()).lte('start_date', endAnio.toISOString());
    }

    if (filtroPermiso.value) query = query.eq('permiso', filtroPermiso.value);
    if (filtroViatico.value) query = query.eq('viatico', filtroViatico.value);

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;

    tbody.innerHTML = "";
    if (!data || data.length === 0) {
      tablaContenedor.style.display = "none"; // <--- CAMBIO CLAVE: Oculta el contenedor completo
      mensajeVacio.style.display = "block";
      paginacion.style.display = "none";
      hideLoader();
      return;
    }
    
    tablaContenedor.style.display = "block"; // <--- CAMBIO CLAVE: Muestra el contenedor completo
    mensajeVacio.style.display = "none";

    data.forEach((row, index) => {
      const rowElement = document.createElement("tr");
      rowElement.style.animationDelay = `${index * 0.1}s`;
      const imagenHtml = row.image_url ? 
        `<img src="${row.image_url}" width="50" height="50" loading="lazy" style="border-radius: 8px; cursor: pointer;" onclick="window.open('${row.image_url}', '_blank')" alt="Imagen de actividad" />` : 
        'Sin imagen';

      rowElement.innerHTML = `
        <td data-label="Desde">${new Date(row.start_date).toLocaleDateString("es-ES")}</td>
        <td data-label="Hasta">${new Date(row.end_date).toLocaleDateString("es-ES")}</td>
        <td data-label="Actividad">${row.actividad}</td>
        <td data-label="Lugar">${row.lugar}</td>
        <td data-label="Permiso">${row.permiso}</td>
        <td data-label="Viático">${row.viatico}</td>
        <td data-label="Imagen">${imagenHtml}</td>
        <td class="acciones" data-label="Acciones">
          <button class="btn-accion btn-editar" onclick="editarActividad('${row.id}')" aria-label="Editar actividad"><i class="fas fa-edit"></i></button>
          <button class="btn-accion btn-borrar" onclick="borrarActividad('${row.id}')" aria-label="Borrar actividad"><i class="fas fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(rowElement);
    });

    // Lazy load de imágenes
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
      img.loading = "lazy";
    });

    const totalPages = Math.ceil(queryTotalCount / pageSize);
    infoPagina.textContent = `Página ${currentPage} de ${totalPages}`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages || data.length < pageSize;
    paginacion.style.display = totalPages > 1 ? "flex" : "none";

    btnPrev.onclick = () => { if (currentPage > 1) { currentPage--; renderPage(); } };
    btnNext.onclick = () => { if (data.length === pageSize) { currentPage++; renderPage(); } };
    
    // Se elimina la línea 'document.querySelector('.tabla-container').style.height = 'auto';' 
    // ya que se maneja con el display y el CSS móvil.

  } catch (error) {
    alert("Error al cargar datos: " + error.message);
  } finally {
    hideLoader();
  }
}

cargarTabla();

// === EDITAR, BORRAR, GUARDAR, EXPORTAR (igual que antes) ===

async function editarActividad(id) {
  try {
    const { data, error } = await supabaseClient.from('actividades').select('*').eq('id', id).single();
    if (error || !data) { alert("Error: Actividad no encontrada."); return; }

    startDateInput.value = flatpickr.formatDate(new Date(data.start_date), "d/m/Y");
    endDateInput.value = flatpickr.formatDate(new Date(data.end_date), "d/m/Y");
    document.getElementById("actividad").value = data.actividad;
    document.getElementById("lugar").value = data.lugar;
    document.getElementById("permiso").value = data.permiso;
    document.getElementById("viatico").value = data.viatico;
    imagenInput.value = '';

    editandoId = id;
    btnGuardar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Actividad';
    btnCancelar.style.display = "inline-flex";
    formulario.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    alert("Error al cargar datos: " + error.message);
  }
}

async function borrarActividad(id) {
  if (confirm("¿Estás seguro de eliminar esta actividad? (Incluyendo imagen si existe)")) {
    try {
      const { data } = await supabaseClient.from('actividades').select('image_url').eq('id', id).single();
      if (data && data.image_url) {
        const filePath = data.image_url.split('actividades-images/')[1];
        const { error: deleteError } = await supabaseClient.storage.from('actividades-images').remove([filePath]);
        if (deleteError) console.warn('Error borrando imagen:', deleteError);
      }
      const { error } = await supabaseClient.from('actividades').delete().eq('id', id);
      if (error) throw error;
      alert("¡Actividad eliminada!");
      cargarTabla();
    } catch (error) {
      alert("Error: " + error.message);
    }
  }
}

btnCancelar.addEventListener("click", () => {
  formulario.reset();
  editandoId = null;
  btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Actividad';
  btnCancelar.style.display = "none";
  startDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
  endDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
  imagenInput.value = '';
});

async function subirImagen(file) {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `public/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  const { data, error } = await supabaseClient.storage
    .from('actividades-images')
    .upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabaseClient.storage.from('actividades-images').getPublicUrl(fileName);
  return publicUrl;
}

formulario.addEventListener("submit", async (e) => {
  e.preventDefault();

  const startStr = startDateInput.value;
  const endStr = endDateInput.value;
  const actividad = document.getElementById("actividad").value.trim();
  const lugar = document.getElementById("lugar").value.trim();
  const permiso = document.getElementById("permiso").value;
  const viatico = document.getElementById("viatico").value;
  const file = imagenInput.files[0];

  if (!startStr || !endStr || !actividad || !lugar || !permiso || !viatico) {
    alert("Por favor, completa todos los campos requeridos.");
    return;
  }

  const startDate = buildAndAdjustDateFromString(startStr, true);
  const endDate = buildAndAdjustDateFromString(endStr, false);

  if (!startDate || !endDate) return;
  if (startDate > endDate) {
    alert("¡Error! La fecha de inicio debe ser anterior o igual a la fecha final.");
    return;
  }

  let imageUrl = null;
  if (file) {
    try {
      imageUrl = await subirImagen(file);
    } catch (error) {
      alert("Error al subir imagen: " + error.message + ". Continuando sin imagen.");
    }
  }

  const datos = {
    start_date: startDate,
    end_date: endDate,
    actividad,
    lugar,
    permiso,
    viatico,
    ...(imageUrl && { image_url: imageUrl })
  };

  showLoader();
  try {
    let result;
    if (editandoId) {
      if (!file) {
        const { data: current } = await supabaseClient.from('actividades').select('image_url').eq('id', editandoId).single();
        if (current && current.image_url) datos.image_url = current.image_url;
      }
      result = await supabaseClient.from('actividades').update(datos).eq('id', editandoId);
      alert("¡Actividad actualizada!");
    } else {
      result = await supabaseClient.from('actividades').insert([datos]);
      alert("¡Actividad guardada!");
    }
    if (result.error) throw result.error;

    formulario.reset();
    editandoId = null;
    btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Actividad';
    btnCancelar.style.display = "none";
    startDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
    endDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
    imagenInput.value = '';
    cargarTabla();
  } catch (error) {
    alert("Error al guardar: " + error.message);
  } finally {
    hideLoader();
  }
});

btnExportar.addEventListener("click", async () => {
  showLoader();
  try {
    let query = supabaseClient.from('actividades').select('*').order('start_date', { ascending: false });
    const rangoDesde = filtroRangoDesde.value ? new Date(filtroRangoDesde.value) : null;
    const rangoHasta = filtroRangoHasta.value ? new Date(filtroRangoHasta.value) : null;
    if (rangoDesde) query = query.gte('start_date', rangoDesde.toISOString());
    if (rangoHasta) query = query.lte('start_date', rangoHasta.toISOString());

    const anio = filtroAnio.value;
    const mes = filtroMes.value;
    if (mes) {
      const year = anio || new Date().getFullYear();
      const startMes = new Date(year, mes - 1, 1);
      const endMes = new Date(year, mes, 0);
      query = query.gte('start_date', startMes.toISOString()).lte('start_date', endMes.toISOString());
    } else if (anio) {
      const startAnio = new Date(anio, 0, 1);
      const endAnio = new Date(anio, 11, 31);
      query = query.gte('start_date', startAnio.toISOString()).lte('start_date', endAnio.toISOString());
    }

    if (filtroPermiso.value) query = query.eq('permiso', filtroPermiso.value);
    if (filtroViatico.value) query = query.eq('viatico', filtroViatico.value);

    const { data, error } = await query;
    if (error) throw error;

    const exportData = data.map(row => ({
      Desde: new Date(row.start_date).toLocaleDateString("es-ES"),
      Hasta: new Date(row.end_date).toLocaleDateString("es-ES"),
      Actividad: row.actividad,
      Lugar: row.lugar,
      Permiso: row.permiso,
      Viático: row.viatico,
      Imagen: row.image_url || 'Sin imagen'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actividades");
    const nombreArchivo = filtroMes.value ? `agenda_${filtroMes.value}_${filtroAnio.value || "actual"}.xlsx` : "agenda_completa.xlsx";
    XLSX.writeFile(wb, nombreArchivo);
    alert("¡Exportado exitosamente!");
  } catch (error) {
    alert("Error al exportar: " + error.message);
  } finally {
    hideLoader();
  }
});
