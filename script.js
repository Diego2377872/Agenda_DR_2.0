// === CONFIGURACIÓN SUPABASE ===
const SUPABASE_URL = 'https://zrusehtanthkuqsbzdpe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydXNlaHRhbnRoa3Vxc2J6ZHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NjIxNDAsImV4cCI6MjA3NzUzODE0MH0.S9JMQEavtjkd1xzZqNcMx3BPnAwoDeOO6OrPqhIl-fs';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === ELEMENTOS DEL DOM ===
const formulario = document.getElementById("formulario");
const tbody = document.getElementById("tbodyActividades");
const tablaContenedor = document.getElementById("lista");
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

// === UTILIDADES DE FECHAS ===
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
  }
  return date;
}

// === INICIALIZAR SELECT DE AÑOS ===
function initAnios(yearSelect) {
  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = '<option value="">Todos los años</option>';
  for (let year = currentYear - 5; year <= currentYear + 1; year++) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    if (year === currentYear) option.selected = true;
    yearSelect.appendChild(option);
  }
}
initAnios(filtroAnio);

// === FLATPICKR ===
let startPicker, endPicker;
document.addEventListener("DOMContentLoaded", function () {
  startPicker = flatpickr("#startDateInput", {
    dateFormat: "d/m/Y",
    locale: "es",
    allowInput: true,
    defaultDate: new Date(),
  });

  endPicker = flatpickr("#endDateInput", {
    dateFormat: "d/m/Y",
    locale: "es",
    allowInput: true,
    defaultDate: new Date(),
  });
});

// === FILTROS ===
[filtroAnio, filtroMes, filtroRangoDesde, filtroRangoHasta, filtroPermiso, filtroViatico].forEach(el => {
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

// === CARGA DE TABLA CON FILTROS Y PAGINACIÓN ===
async function cargarTabla() {
  showLoader();
  resetPaginacion();

  try {
    let query = supabaseClient.from('actividades').select('*', { count: 'exact', head: true })
      .order('start_date', { ascending: false });

    aplicarFiltros(query);
    const { count } = await query;
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
    let query = supabaseClient.from('actividades').select('*')
      .order('start_date', { ascending: false });

    aplicarFiltros(query);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;

    tbody.innerHTML = "";

    if (!data || data.length === 0) {
      tablaContenedor.style.display = "none";
      mensajeVacio.style.display = "block";
      paginacion.style.display = "none";
      hideLoader();
      return;
    }

    tablaContenedor.style.display = "block";
    mensajeVacio.style.display = "none";

    data.forEach((row, index) => {
      const tr = document.createElement("tr");
      tr.style.animationDelay = `${index * 0.08}s`;

      const imagenHtml = row.image_url
        ? `<img src="${row.image_url}" width="50" height="50" loading="lazy" style="border-radius:8px;cursor:pointer;" onclick="window.open('${row.image_url}','_blank')" alt="Evidencia">`
        : '<span style="color:#9ca3af;">Sin imagen</span>';

      tr.innerHTML = `
        <td data-label="Desde">${new Date(row.start_date).toLocaleDateString("es-ES")}</td>
        <td data-label="Hasta">${new Date(row.end_date).toLocaleDateString("es-ES")}</td>
        <td data-label="Actividad">${row.actividad}</td>
        <td data-label="Lugar">${row.lugar}</td>
        <td data-label="Permiso">${row.permiso}</td>
        <td data-label="Viático">${row.viatico}</td>
        <td data-label="Imagen">${imagenHtml}</td>
        <td class="acciones">
          <button class="btn-accion btn-editar" onclick="editarActividad('${row.id}')" aria-label="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn-accion btn-borrar" onclick="borrarActividad('${row.id}', '${row.image_url || ''}')" aria-label="Borrar"><i class="fas fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    const totalPages = Math.ceil(queryTotalCount / pageSize);
    infoPagina.textContent = `Página ${currentPage} de ${totalPages}`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages || data.length < pageSize;
    paginacion.style.display = totalPages > 1 ? "flex" : "none";

    btnPrev.onclick = () => { currentPage--; renderPage(); };
    btnNext.onclick = () => { currentPage++; renderPage(); };

  } catch (error) {
    alert("Error al cargar actividades: " + error.message);
  } finally {
    hideLoader();
  }
}

function aplicarFiltros(query) {
  const rangoDesde = filtroRangoDesde.value ? new Date(filtroRangoDesde.value) : null;
  const rangoHasta = filtroRangoHasta.value ? new Date(filtroRangoHasta.value) : null;
  if (rangoDesde) query = query.gte('start_date', rangoDesde.toISOString());
  if (rangoHasta) query = query.lte('start_date', new Date(rangoHasta.setHours(23, 59, 59, 999)).toISOString());

  const anio = filtroAnio.value;
  const mes = filtroMes.value;
  if (mes) {
    const year = anio || new Date().getFullYear();
    const start = new Date(year, mes - 1, 1);
    const end = new Date(year, mes, 0, 23, 59, 59, 999);
    query = query.gte('start_date', start.toISOString()).lte('start_date', end.toISOString());
  } else if (anio) {
    const start = new Date(anio, 0, 1);
    const end = new Date(anio, 11, 31, 23, 59, 59, 999);
    query = query.gte('start_date', start.toISOString()).lte('start_date', end.toISOString());
  }

  if (filtroPermiso.value) query = query.eq('permiso', filtroPermiso.value);
  if (filtroViatico.value) query = query.eq('viatico', filtroViatico.value);

  return query;
}

// === CARGAR TABLA AL INICIO ===
cargarTabla();

// === EDITAR ACTIVIDAD ===
async function editarActividad(id) {
  try {
    const { data, error } = await supabaseClient.from('actividades').select('*').eq('id', id).single();
    if (error || !data) throw error;

    startPicker.setDate(new Date(data.start_date));
    endPicker.setDate(new Date(data.end_date));
    document.getElementById("actividad").value = data.actividad;
    document.getElementById("lugar").value = data.lugar;
    document.getElementById("permiso").value = data.permiso;
    document.getElementById("viatico").value = data.viatico;

    editandoId = id;
    btnGuardar.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Actividad';
    btnCancelar.style.display = "inline-flex";
    formulario.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    alert("Error al cargar actividad para editar: " + err.message);
  }
}

// === BORRAR ACTIVIDAD (con imagen) ===
async function borrarActividad(id, imageUrl) {
  if (!confirm("¿Seguro que quieres eliminar esta actividad?")) return;

  try {
    // Borrar imagen si existe
    if (imageUrl) {
      const filePath = imageUrl.split('/').pop();
      await supabaseClient.storage.from('actividades-images').remove([`public/${filePath}`]);
    }

    const { error } = await supabaseClient.from('actividades').delete().eq('id', id);
    if (error) throw error;

    alert("Actividad eliminada correctamente");
    cargarTabla();
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
}

// === CANCELAR EDICIÓN ===
btnCancelar.addEventListener("click", () => {
  formulario.reset();
  editandoId = null;
  btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Actividad';
  btnCancelar.style.display = "none";
  startPicker.setDate(new Date());
  endPicker.setDate(new Date());
  imagenInput.value = '';
});

// === SUBIR IMAGEN (FUNCIÓN CORREGIDA Y ROBUSTA) ===
async function subirImagen(file) {
  if (!file) return null;

  if (file.size > 5 * 1024 * 1024) {
    alert("La imagen es demasiado grande. Máximo 5 MB.");
    return null;
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `public/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

  try {
    const { data, error } = await supabaseClient.storage
      .from('actividades-images')
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg'
      });

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
      .from('actividades-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Error detallado al subir imagen:", err);
    alert(`No se pudo subir la imagen: ${err.message}\n\nSi ves "403" o "unauthorized", revisa que el bucket tenga la política pública activada.`);
    return null;
  }
}

// === GUARDAR / ACTUALIZAR ACTIVIDAD ===
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
    alert("Completa todos los campos obligatorios");
    return;
  }

  const startDate = buildAndAdjustDateFromString(startStr);
  const endDate = buildAndAdjustDateFromString(endStr);
  if (!startDate || !endDate) return;
  if (startDate > endDate) {
    alert("La fecha de inicio no puede ser posterior a la fecha final");
    return;
  }

  showLoader();
  let imageUrl = null;
  if (file) {
    imageUrl = await subirImagen(file);
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

  try {
    let result;
    if (editandoId) {
      // Mantener imagen anterior si no se subió una nueva
      if (!file) {
        const { data: current } = await supabaseClient.from('actividades').select('image_url').eq('id', editandoId).single();
        datos.image_url = current.image_url;
      }
      result = await supabaseClient.from('actividades').update(datos).eq('id', editandoId);
      alert("¡Actividad actualizada!");
    } else {
      result = await supabaseClient.from('actividades').insert([datos]);
      alert("¡Actividad guardada!");
    }

    if (result.error) throw result.error;

    // Resetear formulario
    formulario.reset();
    editandoId = null;
    btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Actividad';
    btnCancelar.style.display = "none";
    startPicker.setDate(new Date());
    endPicker.setDate(new Date());
    imagenInput.value = '';

    cargarTabla();
  } catch (err) {
    alert("Error al guardar: " + err.message);
  } finally {
    hideLoader();
  }
});

// === EXPORTAR A EXCEL ===
btnExportar.addEventListener("click", async () => {
  showLoader();
  try {
    let query = supabaseClient.from('actividades').select('*').order('start_date', { ascending: false });
    query = aplicarFiltros(query);
    const { data, error } = await query;
    if (error) throw error;

    const exportData = data.map(row => ({
      "Desde": new Date(row.start_date).toLocaleDateString("es-ES"),
      "Hasta": new Date(row.end_date).toLocaleDateString("es-ES"),
      "Actividad": row.actividad,
      "Lugar": row.lugar,
      "Permiso": row.permiso,
      "Viático": row.viatico,
      "Imagen": row.image_url || "Sin imagen"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actividades");

    const nombre = filtroMes.value
      ? `agenda_${filtroMes.value.padStart(2, '0')}_${filtroAnio.value || new Date().getFullYear()}.xlsx`
      : `agenda_completa_${new Date().toISOString().slice(0,10)}.xlsx`;

    XLSX.writeFile(wb, nombre);
    alert("¡Exportado correctamente!");
  } catch (err) {
    alert("Error al exportar: " + err.message);
  } finally {
    hideLoader();
  }
});