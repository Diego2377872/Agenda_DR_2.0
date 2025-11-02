// === CONFIGURACIÓN SUPABASE ===
const SUPABASE_URL = 'https://zrusehtanthkuqsbzdpe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydXNlaHRhbnRoa3Vxc2J6ZHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NjIxNDAsImV4cCI6MjA3NzUzODE0MH0.S9JMQEavtjkd1xzZqNcMx3BPnAwoDeOO6OrPqhIl-fs';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === ELEMENTOS DEL DOM ===
const formulario = document.getElementById("formulario");
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

// Elementos de fecha e imagen
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
const imagenInput = document.getElementById("imagen");

// === LOADER ===
const loader = document.getElementById("loaderOverlay");
function showLoader() {
  loader.classList.add("active");
}
function hideLoader() {
  loader.classList.remove("active");
}

// === VARIABLES DE ESTADO ===
let editandoId = null;
let queryTotalCount = 0;
let currentPage = 1;
const pageSize = 15; // Ajustable según performance

// === FUNCIONES AUXILIARES ===
// Obtener días en mes (para ajuste de fechas)
function getDaysInMonth(year, month) {
  const isLeap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
  const days = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
}

// Construir y ajustar fecha desde string (DD/MM/YYYY)
function buildAndAdjustDateFromString(dateStr, isStart = true) {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split('/').map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12 || day < 1) {
    alert("Formato de fecha inválido. Usa DD/MM/YYYY con valores válidos.");
    return null;
  }
  let adjustedDay = day;
  const maxDays = getDaysInMonth(year, month);
  if (day > maxDays) {
    adjustedDay = maxDays;
    const monthName = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][month];
    alert(`¡Advertencia! ${monthName} no tiene ${day} días. Se ajustó al último día válido (${adjustedDay}).`);
  }
  return new Date(Date.UTC(year, month - 1, adjustedDay)); // Usar UTC para consistencia
}

// Poblar años para filtros
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

// Inicializar Flatpickr con mejoras para móviles
let startPicker, endPicker;
document.addEventListener("DOMContentLoaded", function() {
  startPicker = flatpickr("#startDateInput", {
    dateFormat: "d/m/Y",
    locale: "es",
    allowInput: true,
    defaultDate: new Date(),
    static: true, // Mejor para móviles
    onReady: function() {
      startDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
    }
  });

  endPicker = flatpickr("#endDateInput", {
    dateFormat: "d/m/Y",
    locale: "es",
    allowInput: true,
    defaultDate: new Date(),
    static: true,
    onReady: function() {
      endDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
    }
  });
});

// === FUNCIÓN REUTILIZABLE PARA CONSTRUIR QUERY CON FILTROS ===
function buildQuery(baseQuery) {
  let query = baseQuery;

  const rangoDesde = filtroRangoDesde.value ? new Date(filtroRangoDesde.value) : null;
  const rangoHasta = filtroRangoHasta.value ? new Date(filtroRangoHasta.value) : null;
  if (rangoDesde) query = query.gte('start_date', rangoDesde.toISOString());
  if (rangoHasta) query = query.lte('start_date', rangoHasta.toISOString());

  const anio = filtroAnio.value;
  const mes = filtroMes.value;
  if (mes) {
    const year = anio || new Date().getFullYear();
    const startMes = new Date(Date.UTC(year, mes - 1, 1));
    const endMes = new Date(Date.UTC(year, mes, 0));
    query = query.gte('start_date', startMes.toISOString()).lte('start_date', endMes.toISOString());
  } else if (anio) {
    const startAnio = new Date(Date.UTC(anio, 0, 1));
    const endAnio = new Date(Date.UTC(anio, 11, 31));
    query = query.gte('start_date', startAnio.toISOString()).lte('start_date', endAnio.toISOString());
  }

  if (filtroPermiso.value) query = query.eq('permiso', filtroPermiso.value);
  if (filtroViatico.value) query = query.eq('viatico', filtroViatico.value);

  return query;
}

// === EVENTOS DE FILTRO CON DEBOUNCE ===
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

const debouncedCargarTabla = debounce(cargarTabla, 300);

[filtroAnio, filtroMes, filtroRangoDesde, filtroRangoHasta, filtroPermiso, filtroViatico].forEach((el) => {
  el.addEventListener("change", debouncedCargarTabla);
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

// === PAGINACIÓN ===
function resetPaginacion() {
  currentPage = 1;
  paginacion.style.display = "none";
}

// === CARGAR TABLA ===
async function cargarTabla() {
  showLoader();
  resetPaginacion();

  try {
    let query = buildQuery(supabaseClient.from('actividades').select('*', { count: 'exact', head: true }).order('start_date', { ascending: false }));

    const { count, error: totalError } = await query;
    if (totalError) {
      console.error('Error en conteo total:', totalError);
      alert(`Error al aplicar filtros: ${totalError.message}. Revisa la consola.`);
      return;
    }
    queryTotalCount = count || 0;

    await renderPage();
  } catch (error) {
    console.error('Error en cargarTabla:', error);
    alert(`Error inesperado: ${error.message}. Verifica conexión o permisos.`);
  } finally {
    hideLoader();
  }
}

// === RENDERIZAR PÁGINA ===
async function renderPage() {
  showLoader();
  try {
    const offset = (currentPage - 1) * pageSize;
    let query = buildQuery(supabaseClient.from('actividades').select('*').order('start_date', { ascending: false }));

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) {
      console.error('Error en renderPage:', error);
      alert(`Error al cargar página: ${error.message}.`);
      return;
    }

    tbody.innerHTML = "";
    if (!data || data.length === 0) {
      mensajeVacio.style.display = "block";
      paginacion.style.display = "none";
      return;
    }
    mensajeVacio.style.display = "none";

    data.forEach((row, index) => {
      const rowElement = document.createElement("tr");
      rowElement.style.animationDelay = `${index * 0.1}s`;
      const imagenHtml = row.image_url ? `<img src="${row.image_url}" width="50" height="50" alt="Imagen relacionada con la actividad" style="border-radius: 8px; cursor: pointer;" onclick="window.open('${row.image_url}', '_blank')" />` : 'Sin imagen';
      rowElement.innerHTML = `
        <td data-label="Desde">${new Date(row.start_date).toLocaleDateString("es-ES")}</td>
        <td data-label="Hasta">${new Date(row.end_date).toLocaleDateString("es-ES")}</td>
        <td data-label="Actividad">${row.actividad}</td>
        <td data-label="Lugar">${row.lugar}</td>
        <td data-label="Permiso">${row.permiso}</td>
        <td data-label="Viático">${row.viatico}</td>
        <td data-label="Imagen">${imagenHtml}</td>
        <td class="acciones">
          <button class="btn-accion btn-editar" onclick="editarActividad('${row.id}')" aria-label="Editar actividad"><i class="fas fa-edit"></i></button>
          <button class="btn-accion btn-borrar" onclick="borrarActividad('${row.id}')" aria-label="Borrar actividad"><i class="fas fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(rowElement);
    });

    const totalPages = Math.ceil(queryTotalCount / pageSize);
    infoPagina.textContent = `Página ${currentPage} de ${totalPages}`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages || data.length < pageSize;
    paginacion.style.display = totalPages > 1 ? "flex" : "none";

    btnPrev.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderPage();
      }
    };
    btnNext.onclick = () => {
      if (data.length === pageSize) {
        currentPage++;
        renderPage();
      }
    };
  } catch (error) {
    console.error('Error en renderPage:', error);
    alert(`Error al renderizar: ${error.message}.`);
  } finally {
    hideLoader();
  }
}

// Cargar tabla inicial
cargarTabla();

// === EDITAR ACTIVIDAD ===
async function editarActividad(id) {
  try {
    const { data, error } = await supabaseClient.from('actividades').select('*').eq('id', id).single();
    if (error || !data) {
      alert("Error: Actividad no encontrada.");
      return;
    }

    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    startDateInput.value = flatpickr.formatDate(startDate, "d/m/Y");
    endDateInput.value = flatpickr.formatDate(endDate, "d/m/Y");
    document.getElementById("actividad").value = data.actividad;
    document.getElementById("lugar").value = data.lugar;
    document.getElementById("permiso").value = data.permiso;
    document.getElementById("viatico").value = data.viatico;
    imagenInput.value = ''; // Reset para nueva imagen opcional

    editandoId = id;
    btnGuardar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Actividad';
    btnCancelar.style.display = "inline-flex";
    formulario.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error('Error en editarActividad:', error);
    alert("Error al cargar datos: " + error.message);
  }
}

// === BORRAR ACTIVIDAD ===
async function borrarActividad(id) {
  if (!confirm("¿Estás seguro de eliminar esta actividad? (Incluyendo imagen si existe)")) return;

  try {
    const { data } = await supabaseClient.from('actividades').select('image_url').eq('id', id).single();
    if (data && data.image_url) {
      const filePath = data.image_url.split('actividades-images/')[1];
      const { error: deleteError } = await supabaseClient.storage.from('actividades-images').remove([filePath]);
      if (deleteError) console.warn('Error borrando imagen:', deleteError.message);
    }
    const { error } = await supabaseClient.from('actividades').delete().eq('id', id);
    if (error) throw error;
    alert("¡Actividad eliminada!");
    cargarTabla();
  } catch (error) {
    console.error('Error en borrarActividad:', error);
    alert("Error: " + error.message);
  }
}

// === CANCELAR EDICIÓN ===
btnCancelar.addEventListener("click", () => {
  formulario.reset();
  editandoId = null;
  btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Actividad';
  btnCancelar.style.display = "none";
  startDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
  endDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
  imagenInput.value = '';
});

// === SUBIR IMAGEN A STORAGE (con validación) ===
async function subirImagen(file) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) { // Máx 5MB
    alert("La imagen es demasiado grande. Máximo 5MB.");
    return null;
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    alert("Tipo de archivo no permitido. Usa JPG, PNG o GIF.");
    return null;
  }
  const fileExt = file.name.split('.').pop();
  const fileName = `public/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  const { data, error } = await supabaseClient.storage.from('actividades-images').upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { publicUrl } = supabaseClient.storage.from('actividades-images').getPublicUrl(fileName).data;
  return publicUrl;
}

// === GUARDAR O ACTUALIZAR ===
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
      console.error('Error subiendo imagen:', error);
      alert("Error al subir imagen: " + error.message + ". Continuando sin imagen.");
    }
  }

  const datos = {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
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
      if (result.error) throw result.error;
      alert("¡Actividad actualizada!");
    } else {
      result = await supabaseClient.from('actividades').insert([datos]);
      if (result.error) throw result.error;
      alert("¡Actividad guardada!");
    }

    formulario.reset();
    editandoId = null;
    btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Actividad';
    btnCancelar.style.display = "none";
    startDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
    endDateInput.value = flatpickr.formatDate(new Date(), "d/m/Y");
    imagenInput.value = '';
    cargarTabla();
  } catch (error) {
    console.error('Error en guardar/actualizar:', error);
    alert("Error al guardar: " + error.message);
  } finally {
    hideLoader();
  }
});

// === EXPORTAR A EXCEL ===
btnExportar.addEventListener("click", async () => {
  showLoader();
  try {
    let query = buildQuery(supabaseClient.from('actividades').select('*').order('start_date', { ascending: false }));

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
    console.error('Error en exportar:', error);
    alert("Error al exportar: " + error.message);
  } finally {
    hideLoader();
  }
});
