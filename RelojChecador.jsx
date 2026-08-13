import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Camera,
  Check,
  X,
  Plus,
  Trash2,
  LogIn,
  LogOut,
  Clock,
  UserRound,
  RotateCcw,
  Users,
  Loader2,
  RefreshCw,
  ScrollText,
  Lock,
  LockOpen,
  CalendarClock,
  FileSignature,
  UploadCloud,
  Coins,
  ChefHat,
  PackagePlus,
} from "lucide-react";

/* ============================================================
   CONFIGURACIÓN DE SUPABASE — PEGA AQUÍ TUS DATOS
   Los obtienes en tu proyecto de Supabase: Settings → API
   ============================================================ */
const SUPABASE_URL = "https://ciwfhbpcpygubsvtmwze.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AF_54iVTwT25rhMrhWbFXQ_oW2z_NeF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Reemplazan a window.storage: usan la tabla kv_store_reloj_checador de Supabase
   (proyecto compartido con PAR, pero con tabla propia para no mezclar datos). */
async function kvGet(key, tabla = "kv_store_reloj_checador") {
  const { data, error } = await supabase.from(tabla).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

async function kvSet(key, value, tabla = "kv_store_reloj_checador") {
  const { error } = await supabase
    .from(tabla)
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  return true;
}

// ---------- helpers ----------

function pad(n) {
  return String(n).padStart(2, "0");
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(key, todayKey) {
  if (key === todayKey) return "Hoy";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === localDateKey(yesterday)) return "Ayer";
  const label = date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthKeyOf(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}

function compressImage(file, maxWidth = 480, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- horario semanal + tolerancia de puntualidad ----------

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function defaultSchedule() {
  const sched = {};
  for (let i = 0; i < 7; i++) sched[i] = { enabled: false, start: "09:00", end: "17:00" };
  return sched;
}

// Devuelve el horario que estaba VIGENTE en una fecha dada, no el actual —
// así los resúmenes de meses pasados no se recalculan con cambios recientes.
// emp.scheduleHistory: [{ effectiveFrom: "YYYY-MM-DD", schedule }, ...] ordenado ascendente.
function getScheduleForDate(emp, dateKey) {
  const history = emp.scheduleHistory;
  if (!history || history.length === 0) return emp.schedule || null; // compatibilidad con datos antiguos
  let applicable = history[0].schedule;
  for (const version of history) {
    if (version.effectiveFrom <= dateKey) applicable = version.schedule;
    else break;
  }
  return applicable;
}

// minutos de diferencia entre la hora checada y la hora programada (positivo = tarde)
function minutesLate(scheduledStart, punchIso) {
  const punch = new Date(punchIso);
  const [h, m] = scheduledStart.split(":").map(Number);
  const scheduled = new Date(punch);
  scheduled.setHours(h, m, 0, 0);
  return Math.round((punch - scheduled) / 60000);
}

// Si no hay salida registrada y ya pasaron 1.5 horas del fin de turno programado,
// se asume que la persona salió puntual (a la hora programada). Devuelve el ISO de esa
// salida "asumida", o null si todavía estamos dentro de la ventana de tolerancia (no se asume nada aún).
const TOLERANCIA_SALIDA_MIN = 90; // 1.5 horas

function salidaAsumidaIso(dateKey, scheduledEnd) {
  if (!scheduledEnd) return null;
  const [y, mo, d] = dateKey.split("-").map(Number);
  const [h, m] = scheduledEnd.split(":").map(Number);
  const programada = new Date(y, mo - 1, d, h, m, 0, 0);
  const limite = new Date(programada.getTime() + TOLERANCIA_SALIDA_MIN * 60000);
  if (new Date() >= limite) return programada.toISOString();
  return null;
}

// Áreas compartidas con DÍA/Limpieza — al registrar entrada se pregunta cuál se cubre hoy,
// y se guarda en localStorage (mismo dispositivo) para que DÍA/Limpieza ya no la vuelvan a pedir.
const AREAS_DIA = ["Cocina Caliente", "Cocina Fría", "Servicio PA", "Barra PB", "Almacén"];

function guardarAreaCompartida(area) {
  try { localStorage.setItem("dia_area_actual", area); } catch (e) {}
}

// clasifica la puntualidad según la tolerancia: 10 min para bono, 15 min para propinas
function punctualityTier(mins) {
  if (mins === null || mins === undefined) return null;
  if (mins <= 10) return "bono";
  if (mins <= 15) return "propina";
  return "ninguno";
}

function punctualityMeta(tier, paprika, brass, sage) {
  switch (tier) {
    case "bono":
      return { color: sage, label: "A tiempo — aplica bono y propina" };
    case "propina":
      return { color: brass, label: "Dentro de tolerancia — aplica solo propina" };
    case "ninguno":
      return { color: paprika, label: "Fuera de tolerancia — sin bono ni propina" };
    default:
      return { color: null, label: "" };
  }
}

function scheduleSummary(schedule) {
  if (!schedule) return "Sin horario configurado";
  const enabledDays = Object.keys(schedule)
    .map(Number)
    .filter((d) => schedule[d]?.enabled)
    .sort((a, b) => a - b);
  if (enabledDays.length === 0) return "Sin horario configurado";
  const dayLabels = enabledDays.map((d) => DAY_SHORT[d]).join(" ");
  const times = enabledDays.map((d) => `${schedule[d].start}–${schedule[d].end}`);
  const uniform = times.every((t) => t === times[0]);
  return uniform ? `${dayLabels} · ${times[0]}` : `${dayLabels} · horarios variados`;
}

// número de semana dentro del mes (1-based, semanas de domingo a sábado)
function weekOfMonth(dateObj) {
  const firstDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
  return Math.ceil((dateObj.getDate() + firstDay.getDay()) / 7);
}

function hoursBetween(entradaIso, salidaIso) {
  const diffMs = new Date(salidaIso) - new Date(entradaIso);
  if (diffMs <= 0) return null;
  return Math.round((diffMs / 3600000) * 10) / 10; // 1 decimal
}

// cruza el horario VIGENTE en cada fecha (no siempre el actual) contra los registros reales del mes
function buildEmployeeMonthReport(emp, monthKeyStr, recordsByDate) {
  const [year, month] = monthKeyStr.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dateKey = `${year}-${pad(month)}-${pad(d)}`;
    const weekday = dateObj.getDay();
    const daySchedule = getScheduleForDate(emp, dateKey)?.[weekday];
    const scheduled = !!daySchedule?.enabled;
    const dayRecords = (recordsByDate[dateKey] || []).filter((r) => r.employeeId === emp.id);
    const entrada = dayRecords.find((r) => r.type === "entrada");
    const salida = [...dayRecords].reverse().find((r) => r.type === "salida");

    if (!scheduled && !entrada && !salida) continue; // día sin relevancia para este empleado

    // si no hay salida real y ya se cumplió la tolerancia de 1.5h, se asume que salió a tiempo
    const salidaAsumida = !salida && scheduled && daySchedule?.end ? salidaAsumidaIso(dateKey, daySchedule.end) : null;
    const salidaEfectivaIso = salida ? salida.time : salidaAsumida;
    const hoursWorked = entrada && salidaEfectivaIso ? hoursBetween(entrada.time, salidaEfectivaIso) : null;

    rows.push({
      dateKey,
      dayNum: d,
      dayLabel: DAY_SHORT[weekday],
      weekNum: weekOfMonth(dateObj),
      scheduled,
      scheduledStart: daySchedule?.start || null,
      scheduledEnd: daySchedule?.end || null,
      entradaTime: entrada ? formatTime(entrada.time) : null,
      salidaTime: salida ? formatTime(salida.time) : salidaAsumida ? `${formatTime(salidaAsumida)} (auto)` : null,
      punctuality: entrada?.punctuality || null,
      minutesLate: entrada?.minutesLate ?? null,
      falta: scheduled && !entrada,
      retardo: !!entrada && (entrada.minutesLate ?? 0) > 0,
      hoursWorked,
    });
  }

  const weekNums = [...new Set(rows.map((r) => r.weekNum))].sort((a, b) => a - b);
  const weeks = weekNums.map((wn) => {
    const weekRows = rows.filter((r) => r.weekNum === wn);
    const firstDay = weekRows[0]?.dayNum;
    const lastDay = weekRows[weekRows.length - 1]?.dayNum;
    return {
      weekNum: wn,
      label: firstDay === lastDay ? `Semana ${wn} (día ${firstDay})` : `Semana ${wn} (días ${firstDay}–${lastDay})`,
      diasTrabajados: weekRows.filter((r) => r.entradaTime).length,
      horas: Math.round(weekRows.reduce((s, r) => s + (r.hoursWorked || 0), 0) * 10) / 10,
      retardos: weekRows.filter((r) => r.retardo).length,
      faltas: weekRows.filter((r) => r.falta).length,
    };
  });

  return {
    rows,
    weeks,
    diasProgramados: rows.filter((r) => r.scheduled).length,
    diasTrabajados: rows.filter((r) => r.entradaTime).length,
    diasBono: rows.filter((r) => r.punctuality === "bono").length,
    diasPropina: rows.filter((r) => r.punctuality === "bono" || r.punctuality === "propina").length,
    diasSinTolerancia: rows.filter((r) => r.punctuality === "ninguno").length,
    diasFalta: rows.filter((r) => r.falta).length,
    diasRetardo: rows.filter((r) => r.retardo).length,
    horasTotalMes: Math.round(rows.reduce((s, r) => s + (r.hoursWorked || 0), 0) * 10) / 10,
  };
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// arma un documento HTML autocontenido (sin dependencias externas) con el resumen del mes,
// listo para descargar, abrir en cualquier navegador e imprimir/guardar como PDF
function buildMonthSummaryHtml(monthKeyStr, employees, recordsByDate) {
  const reportsToShow = employees
    .map((emp) => ({ emp, report: buildEmployeeMonthReport(emp, monthKeyStr, recordsByDate) }))
    .filter(({ report }) => report.rows.length > 0);

  const resultLabel = (r) =>
    r.punctuality === "bono"
      ? "Bono + propina"
      : r.punctuality === "propina"
      ? "Solo propina"
      : r.punctuality === "ninguno"
      ? "Sin bono/propina"
      : r.falta
      ? "Falta"
      : "—";

  const pagesHtml = reportsToShow
    .map(
      ({ emp, report }) => `
    <section class="report-page">
      <h1>Resumen mensual de asistencia</h1>
      <p class="subtitle">Restaurante Bondiola · ${escapeHtml(monthLabel(monthKeyStr))}</p>
      <div class="meta">
        <div><strong>Empleado:</strong> ${escapeHtml(emp.name)}</div>
        <div><strong>Puesto:</strong> ${escapeHtml(emp.puesto)}</div>
        <div><strong>Horario asignado:</strong> ${escapeHtml(scheduleSummary(getScheduleForDate(emp, `${monthKeyStr}-01`)))}</div>
      </div>
      <table>
        <thead><tr><th>Fecha</th><th>Programado</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Min. tarde</th><th>Resultado</th></tr></thead>
        <tbody>
          ${report.rows
            .map(
              (r) => `<tr>
            <td>${escapeHtml(r.dayLabel)} ${r.dayNum}</td>
            <td>${r.scheduled ? `${r.scheduledStart}–${r.scheduledEnd}` : "—"}</td>
            <td>${r.entradaTime || (r.falta ? "FALTA" : "—")}</td>
            <td>${r.salidaTime || "—"}</td>
            <td>${r.hoursWorked !== null ? r.hoursWorked : "—"}</td>
            <td>${r.minutesLate !== null ? r.minutesLate : "—"}</td>
            <td>${resultLabel(r)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <h2>Desglose semanal</h2>
      <table>
        <thead><tr><th>Semana</th><th>Días trabajados</th><th>Horas</th><th>Retardos</th><th>Faltas</th></tr></thead>
        <tbody>
          ${report.weeks
            .map(
              (w) =>
                `<tr><td>${escapeHtml(w.label)}</td><td>${w.diasTrabajados}</td><td>${w.horas}</td><td>${w.retardos}</td><td>${w.faltas}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div class="totals">
        <span>Días programados: <strong>${report.diasProgramados}</strong></span>
        <span>Días trabajados: <strong>${report.diasTrabajados}</strong></span>
        <span>Horas trabajadas: <strong>${report.horasTotalMes}</strong></span>
        <span>Retardos: <strong>${report.diasRetardo}</strong></span>
        <span>Faltas: <strong>${report.diasFalta}</strong></span>
        <span>Con bono: <strong>${report.diasBono}</strong></span>
        <span>Con propina: <strong>${report.diasPropina}</strong></span>
      </div>
      <p class="agreement">Al firmar este documento, el empleado y el encargado en turno confirman estar de
      acuerdo con el horario asignado y los días efectivamente cumplidos durante el mes indicado.</p>
      <div class="signatures">
        <div><div class="line">Firma del Encargado en turno</div><div class="sublabel">Nombre y fecha</div></div>
        <div><div class="line">Firma del Empleado</div><div class="sublabel">Nombre y fecha</div></div>
      </div>
    </section>`
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Resumen mensual — ${escapeHtml(monthLabel(monthKeyStr))}</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #211F1B; margin: 0; }
  .report-page { max-width: 720px; margin: 0 auto; padding: 2rem; page-break-after: always; }
  h1 { font-size: 1.15rem; font-weight: 900; text-transform: uppercase; margin: 0; }
  .subtitle { font-size: 0.82rem; color: #21201b99; margin: 2px 0 0; }
  .meta { margin-top: 1rem; font-size: 0.85rem; line-height: 1.6; }
  table { width: 100%; margin-top: 1rem; font-size: 0.72rem; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 6px; }
  thead tr { border-bottom: 1px solid #21201b55; }
  tbody tr { border-bottom: 1px solid #21201b15; }
  h2 { font-size: 0.78rem; text-transform: uppercase; margin-top: 1.2rem; }
  .totals { margin-top: 1rem; font-size: 0.8rem; display: flex; gap: 1.25rem; flex-wrap: wrap; }
  .agreement { margin-top: 2rem; font-size: 0.78rem; line-height: 1.5; color: #211f1bcc; }
  .signatures { margin-top: 3rem; display: flex; justify-content: space-between; gap: 2rem; }
  .signatures > div { flex: 1; text-align: center; }
  .line { border-top: 1px solid #211F1B; padding-top: 4px; font-size: 0.78rem; }
  .sublabel { font-size: 0.65rem; color: #21201b77; margin-top: 2px; }
  @media print { .report-page { page-break-after: always; } }
</style>
</head>
<body>
${pagesHtml || `<p style="padding:2rem;">No hay días programados ni registros para ${escapeHtml(monthLabel(monthKeyStr))}.</p>`}
</body>
</html>`;
}

const POLL_MS = 45000;

// ---------- storage helpers backed by Supabase (kv_store table) ----------
// Ya no existe distinción "compartido/local": Supabase es la única fuente de
// verdad para todos los dispositivos, siempre.

async function storageGet(key) {
  try {
    const v = await kvGet(key);
    return v === null || v === undefined ? null : { value: v };
  } catch (err) {
    console.error(`Error leyendo "${key}" de Supabase:`, err);
    return null;
  }
}

async function storageSet(key, value) {
  // deja que el error se propague: la cola de sincronización (scheduleSync)
  // lo reintenta sola en segundo plano si falla.
  return kvSet(key, value);
}

// ---------- fotos guardadas localmente en este dispositivo (IndexedDB) ----------
// Este equipo es fijo, así que las fotos NO se suben a Supabase — se quedan aquí,
// solo se sincroniza el dato liviano (nombre, hora, tipo) en la nube.

const PHOTO_DB_NAME = "reloj_checador_fotos";
const PHOTO_STORE_NAME = "photos";

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PHOTO_STORE_NAME)) {
        req.result.createObjectStore(PHOTO_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePhotoLocal(id, dataUrl) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE_NAME, "readwrite");
    tx.objectStore(PHOTO_STORE_NAME).put(dataUrl, id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getPhotoLocal(id) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE_NAME, "readonly");
    const req = tx.objectStore(PHOTO_STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deletePhotoLocal(id) {
  try {
    const db = await openPhotoDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE_NAME, "readwrite");
      tx.objectStore(PHOTO_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // limpieza de mejor esfuerzo; si falla no es grave
  }
}

// ---------- main component ----------

export default function RelojChecador() {
  const [tab, setTab] = useState("checador");

  const [employees, setEmployees] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]); // quién cubre cada área hoy
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPuesto, setNewPuesto] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  // week log: { [dateKey]: record[] }
  const [recordsByDate, setRecordsByDate] = useState({});
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ---------- caché en memoria de fotos leídas desde IndexedDB ----------
  const [photoCache, setPhotoCache] = useState({}); // recordId -> dataUrl | null
  const loadingPhotoIdsRef = useRef(new Set());

  useEffect(() => {
    const idsNeeded = Object.values(recordsByDate)
      .flat()
      .filter((r) => r.hasPhoto)
      .map((r) => r.id);

    idsNeeded.forEach((id) => {
      if (loadingPhotoIdsRef.current.has(id)) return;
      loadingPhotoIdsRef.current.add(id);
      getPhotoLocal(id)
        .then((dataUrl) => {
          setPhotoCache((prev) => (id in prev ? prev : { ...prev, [id]: dataUrl || null }));
        })
        .catch(() => {
          setPhotoCache((prev) => (id in prev ? prev : { ...prev, [id]: null }));
        });
    });
  }, [recordsByDate]);

  const [punchModal, setPunchModal] = useState(null); // {type, photo}
  const [areaModal, setAreaModal] = useState(null); // {employeeName} — se muestra tras confirmar una entrada
  const [salidaForkModal, setSalidaForkModal] = useState(null); // {employeeId, employeeName} — se muestra tras confirmar una salida
  const [produccionModal, setProduccionModal] = useState(null); // {employeeId, employeeName}
  const [mercanciaModal, setMercanciaModal] = useState(null); // {employeeId, employeeName}
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  // ---------- background sync queue (optimistic UI, never blocks, never reverts) ----------
  const pendingValuesRef = useRef({}); // key -> latest JSON string awaiting sync
  const syncingRef = useRef({}); // key -> in-flight flag
  const [pendingKeys, setPendingKeys] = useState({}); // key -> true, drives the small status dot

  const attemptSync = useCallback(
    async (key) => {
      if (syncingRef.current[key]) return;
      const valueAtStart = pendingValuesRef.current[key];
      if (valueAtStart === undefined) return;
      syncingRef.current[key] = true;
      try {
        await storageSet(key, valueAtStart);
        if (pendingValuesRef.current[key] === valueAtStart) {
          delete pendingValuesRef.current[key];
          setPendingKeys((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      } catch (err) {
        console.error(`Sincronización pendiente de "${key}":`, err);
        // se queda en la cola; el intervalo de abajo lo reintenta solo
      } finally {
        syncingRef.current[key] = false;
      }
    },
    [storageSet]
  );

  const scheduleSync = useCallback(
    (key, value) => {
      pendingValuesRef.current[key] = value;
      setPendingKeys((prev) => ({ ...prev, [key]: true }));
      attemptSync(key);
    },
    [attemptSync]
  );

  useEffect(() => {
    const id = setInterval(() => {
      Object.keys(pendingValuesRef.current).forEach((key) => attemptSync(key));
    }, 6000);
    return () => clearInterval(id);
  }, [attemptSync]);

  const today = localDateKey();

  // ---------- mes seleccionado en la Bitácora ----------
  const [selectedMonth, setSelectedMonth] = useState(monthKeyOf());
  const monthDateKeys = Object.keys(recordsByDate)
    .filter((d) => d.startsWith(selectedMonth))
    .sort()
    .reverse();

  // ---------- propinas ----------
  const [propinasFecha, setPropinasFecha] = useState(localDateKey());
  const [propinasMonto, setPropinasMonto] = useState("");
  const [propinasQuien, setPropinasQuien] = useState("");
  const [propinasHistorial, setPropinasHistorial] = useState([]);
  const [loadingPropinas, setLoadingPropinas] = useState(true);

  const loadPropinasHistorial = useCallback(async () => {
    setLoadingPropinas(true);
    try {
      const r = await storageGet("propinas_historial");
      setPropinasHistorial(r ? JSON.parse(r.value) : []);
    } catch {
      setPropinasHistorial([]);
    }
    setLoadingPropinas(false);
  }, []);

  useEffect(() => {
    loadPropinasHistorial();
  }, [loadPropinasHistorial]);

  function calcularRepartoPropinas(fecha, monto) {
    const dayRecords = recordsByDate[fecha] || [];
    const entradasPorEmpleado = {};
    dayRecords
      .filter((r) => r.type === "entrada")
      .forEach((r) => {
        entradasPorEmpleado[r.employeeId] = r; // si hay más de una, se queda con la última
      });

    const todos = Object.values(entradasPorEmpleado).map((r) => {
      const califica = r.punctuality === "bono" || r.punctuality === "propina";
      return {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        punctuality: r.punctuality,
        minutesLate: r.minutesLate,
        califica,
        motivo: califica
          ? null
          : r.punctuality === "ninguno"
          ? "Llegó fuera de tolerancia (+15 min)"
          : "Sin horario configurado ese día",
      };
    });

    const calificanIds = todos.filter((t) => t.califica);
    // matemática en centavos enteros: siempre redondea hacia abajo, sin sorpresas de decimales
    const montoCentavos = Math.round((Number(monto) || 0) * 100);
    const porPersonaCentavos = calificanIds.length > 0 ? Math.floor(montoCentavos / calificanIds.length) : 0;
    const sobranteCentavos = calificanIds.length > 0 ? montoCentavos - porPersonaCentavos * calificanIds.length : montoCentavos;
    const porPersona = porPersonaCentavos / 100;

    return {
      lista: todos
        .map((t) => ({ ...t, monto: t.califica ? porPersona : 0 }))
        .sort((a, b) => (b.califica === a.califica ? a.employeeName.localeCompare(b.employeeName) : b.califica ? 1 : -1)),
      sobrante: sobranteCentavos / 100,
    };
  }

  async function guardarReparto(fecha, monto, reparto, quien) {
    const nuevo = {
      id: uid("propina"),
      fecha,
      monto: Number(monto) || 0,
      reparto,
      quien: quien || "",
      creadoEn: new Date().toISOString(),
    };
    const sinEsaFecha = propinasHistorial.filter((p) => p.fecha !== fecha);
    const actualizado = [nuevo, ...sinEsaFecha].slice(0, 60); // conserva los últimos 60 repartos
    setPropinasHistorial(actualizado);
    scheduleSync("propinas_historial", JSON.stringify(actualizado));
    setToast({ color: sage, text: `Propinas de ${formatDateLabel(fecha, today)} guardadas.` });
  }

  // ---------- resumen mensual imprimible ----------
  const [printView, setPrintView] = useState(null); // { month: "YYYY-MM" } | null
  const [confirmPurgeMonth, setConfirmPurgeMonth] = useState(false);
  const [showDriveHelp, setShowDriveHelp] = useState(false);

  useEffect(() => {
    setConfirmPurgeMonth(false);
    setShowDriveHelp(false);
  }, [printView]);

  // Descarga el resumen ya formateado (documento HTML con tablas y líneas de firma),
  // listo para abrir en cualquier navegador e imprimir o guardar como PDF.
  function downloadMonthSummary(monthKeyStr) {
    const html = buildMonthSummaryHtml(monthKeyStr, employees, recordsByDate);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumen-${monthKeyStr}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast({ color: sage, text: "Resumen descargado — ábrelo en tu navegador para verlo o imprimirlo." });
  }

  // Descarga un respaldo JSON del mes (registros + personal) para subirlo a Drive a mano.
  // Nota: la subida automática a Drive requiere configurar credenciales de la API de Google
  // (pendiente); mientras tanto este botón genera el archivo para subirlo manualmente.
  function downloadMonthBackup(monthKeyStr) {
    const monthRecords = {};
    Object.keys(recordsByDate)
      .filter((d) => d.startsWith(monthKeyStr))
      .forEach((d) => {
        monthRecords[d] = recordsByDate[d];
      });
    const payload = {
      month: monthKeyStr,
      generatedAt: new Date().toISOString(),
      employees: employees.map((e) => ({ id: e.id, name: e.name, puesto: e.puesto, schedule: getScheduleForDate(e, `${monthKeyStr}-01`) })),
      records: monthRecords,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reloj-checador-${monthKeyStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast({ color: sage, text: "Respaldo descargado — súbelo a Drive y luego puedes borrar el mes." });
  }

  function purgeMonth(monthKeyStr) {
    const kept = {};
    Object.keys(recordsByDate).forEach((d) => {
      if (!d.startsWith(monthKeyStr)) kept[d] = recordsByDate[d];
    });
    cleanupOrphanedPhotos(recordsByDate, kept);
    setRecordsByDate(kept);
    scheduleSync("records", JSON.stringify(kept));
    setConfirmPurgeMonth(false);
    setToast({ color: sage, text: `Datos de ${monthLabel(monthKeyStr)} borrados de este dispositivo.` });
  }

  // ---------- access pin (protects Bitácora and adding personal) ----------
  const [pin, setPin] = useState(undefined); // undefined = cargando, null = sin configurar, string = clave
  const [unlockedSession, setUnlockedSession] = useState(false);
  const [pinModal, setPinModal] = useState(null); // {mode:'setup'|'unlock'|'change', target, value, confirmValue, error}

  useEffect(() => {
    (async () => {
      try {
        const r = await storageGet("access_pin");
        setPin(r ? r.value : null);
      } catch {
        setPin(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestUnlock(target) {
    if (unlockedSession) {
      if (target !== "agregar") setTab(target);
      return;
    }
    if (!pin) {
      setPinModal({ mode: "setup", target, value: "", confirmValue: "", error: "" });
    } else {
      setPinModal({ mode: "unlock", target, value: "", error: "" });
    }
  }

  function openChangePin() {
    setPinModal({ mode: "change", target: null, value: "", confirmValue: "", error: "" });
  }

  function lockNow() {
    setUnlockedSession(false);
    if (tab === "bitacora") setTab("checador");
  }

  function submitPin() {
    if (!pinModal) return;
    const digits = pinModal.value.trim();

    if (pinModal.mode === "unlock") {
      if (digits !== pin) {
        setPinModal((m) => ({ ...m, value: "", error: "Clave incorrecta." }));
        return;
      }
      setUnlockedSession(true);
      const target = pinModal.target;
      setPinModal(null);
      if (target && target !== "agregar") setTab(target);
      return;
    }

    // setup / change
    if (digits.length < 4) {
      setPinModal((m) => ({ ...m, error: "Usa al menos 4 dígitos." }));
      return;
    }
    if (digits !== pinModal.confirmValue.trim()) {
      setPinModal((m) => ({ ...m, error: "Las claves no coinciden." }));
      return;
    }
    setPin(digits);
    scheduleSync("access_pin", digits);
    setUnlockedSession(true);
    const target = pinModal.target;
    setPinModal(null);
    if (target && target !== "agregar") setTab(target);
  }

  // ---------- load employees ----------

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const r = await storageGet("employees");
      setEmployees(r ? JSON.parse(r.value) : []);
    } catch {
      setEmployees([]);
    }
    setLoadingEmployees(false);
  }, []);

  const loadAsignaciones = useCallback(async () => {
    try {
      const r = await storageGet("asignaciones_area_hoy");
      const todas = r ? JSON.parse(r.value) : [];
      // conserva solo los últimos 14 días
      const corte = new Date();
      corte.setDate(corte.getDate() - 14);
      const corteKey = localDateKey(corte);
      setAsignaciones(todas.filter((a) => a.fecha >= corteKey));
    } catch {
      setAsignaciones([]);
    }
  }, []);

  // ---------- load week (single 'records' key holding { date: record[] }) ----------

  function pruneOldDates(allRecords, keepMonths = 4) {
    // conserva los últimos `keepMonths` meses completos, para que siempre haya
    // datos disponibles al generar el resumen del mes recién cerrado.
    const dates = Object.keys(allRecords).sort().reverse(); // más reciente primero
    const monthsSeen = new Set();
    const kept = {};
    for (const d of dates) {
      monthsSeen.add(d.slice(0, 7));
      if (monthsSeen.size > keepMonths) break;
      kept[d] = allRecords[d];
    }
    return kept;
  }

  // borra en segundo plano las fotos locales de registros que ya se podaron
  function cleanupOrphanedPhotos(prevRecordsByDate, nextRecordsByDate) {
    const nextIds = new Set(
      Object.values(nextRecordsByDate)
        .flat()
        .map((r) => r.id)
    );
    Object.values(prevRecordsByDate)
      .flat()
      .forEach((r) => {
        if (r.hasPhoto && !nextIds.has(r.id)) {
          deletePhotoLocal(r.id);
          setPhotoCache((prev) => {
            if (!(r.id in prev)) return prev;
            const next = { ...prev };
            delete next[r.id];
            return next;
          });
        }
      });
  }

  const loadRecords = useCallback(async (showSpinner) => {
    if (showSpinner) setLoadingWeek(true);
    try {
      const r = await storageGet("records");
      const all = r ? JSON.parse(r.value) : {};
      setRecordsByDate(all);
    } catch {
      // keep whatever we already have rather than wiping it on a transient failure
    }
    setLastUpdated(new Date());
    if (showSpinner) setLoadingWeek(false);
  }, []);

  useEffect(() => {
    loadEmployees();
    loadRecords(true);
    loadAsignaciones();
  }, [loadEmployees, loadRecords, loadAsignaciones]);

  // poll for near real-time updates (status chips on Checador depend on this too)
  useEffect(() => {
    const id = setInterval(() => loadRecords(false), POLL_MS);
    return () => clearInterval(id);
  }, [loadRecords]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- employee crud ----------

  function saveEmployeesList(list) {
    setEmployees(list);
    scheduleSync("employees", JSON.stringify(list));
  }

  function addEmployee() {
    const name = newName.trim();
    if (!name) return;
    const initialSchedule = defaultSchedule();
    const emp = {
      id: uid("emp"),
      name,
      puesto: newPuesto.trim() || "Sin puesto",
      active: true,
      schedule: initialSchedule, // espejo del horario vigente, por conveniencia
      scheduleHistory: [{ effectiveFrom: localDateKey(), schedule: initialSchedule }],
    };
    saveEmployeesList([...employees, emp]);
    setNewName("");
    setNewPuesto("");
  }

  function toggleActive(id) {
    saveEmployeesList(employees.map((e) => (e.id === id ? { ...e, active: !e.active } : e)));
  }

  function deleteEmployee(id) {
    saveEmployeesList(employees.filter((e) => e.id !== id));
    if (selectedEmployeeId === id) setSelectedEmployeeId(null);
    setConfirmDeleteId(null);
  }

  // ---------- editor de horario semanal ----------
  const [scheduleModal, setScheduleModal] = useState(null); // { employeeId, draft }

  function openScheduleModal(employeeId) {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    setScheduleModal({ employeeId, draft: getScheduleForDate(emp, localDateKey()) || defaultSchedule() });
  }

  function updateScheduleDay(dayIdx, patch) {
    setScheduleModal((m) => ({
      ...m,
      draft: { ...m.draft, [dayIdx]: { ...m.draft[dayIdx], ...patch } },
    }));
  }

  function saveSchedule() {
    if (!scheduleModal) return;
    const todayKey = localDateKey();
    saveEmployeesList(
      employees.map((e) => {
        if (e.id !== scheduleModal.employeeId) return e;
        const history = e.scheduleHistory ? [...e.scheduleHistory] : [];
        const idx = history.findIndex((v) => v.effectiveFrom === todayKey);
        if (idx >= 0) history[idx] = { effectiveFrom: todayKey, schedule: scheduleModal.draft };
        else history.push({ effectiveFrom: todayKey, schedule: scheduleModal.draft });
        history.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0));
        // "schedule" queda como espejo del horario vigente para accesos rápidos/compatibilidad
        return { ...e, scheduleHistory: history, schedule: scheduleModal.draft };
      })
    );
    setScheduleModal(null);
  }

  // ---------- status (based on today only) ----------

  function statusFor(employeeId) {
    const own = (recordsByDate[today] || []).filter((r) => r.employeeId === employeeId);
    if (own.length === 0) return "fuera";
    const last = own[own.length - 1];
    if (last.type === "salida") return "fuera";
    // último registro es entrada sin salida — revisamos si ya se cumplió la tolerancia
    const emp = employees.find((e) => e.id === employeeId);
    const daySchedule = emp ? getScheduleForDate(emp, today)?.[new Date().getDay()] : null;
    if (daySchedule?.enabled && salidaAsumidaIso(today, daySchedule.end)) return "fuera";
    return "dentro";
  }

  // ---------- punching ----------

  function openPunch(type) {
    setPunchModal({ type, photo: null });
  }

  function triggerCamera() {
    // ya no se usa para abrir el selector (ver <label htmlFor="reloj-photo-input">),
    // se deja solo por si se necesita disparar el input de forma programática en el futuro
    fileInputRef.current?.click();
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPunchModal((prev) => (prev ? { ...prev, photo: dataUrl } : prev));
    } catch {
      setToast({ color: paprika, text: "No se pudo procesar la foto." });
    }
  }

  function confirmPunch() {
    if (!punchModal || !selectedEmployeeId) return;
    if (punchModal.type === "entrada" && !punchModal.photo) return;

    const emp = employees.find((e) => e.id === selectedEmployeeId);
    if (!emp) return;

    const now = new Date();
    const nowIso = now.toISOString();

    let punctuality = null;
    let minsLate = null;
    if (punchModal.type === "entrada") {
      const daySchedule = getScheduleForDate(emp, today)?.[now.getDay()];
      if (daySchedule?.enabled && daySchedule.start) {
        minsLate = minutesLate(daySchedule.start, nowIso);
        punctuality = punctualityTier(minsLate);
      }
    }

    const record = {
      id: uid("rec"),
      employeeId: emp.id,
      employeeName: emp.name,
      type: punchModal.type,
      time: nowIso,
      hasPhoto: !!punchModal.photo,
      punctuality, // 'bono' | 'propina' | 'ninguno' | null (sin horario configurado ese día)
      minutesLate: minsLate,
    };

    // la foto se queda en este dispositivo (IndexedDB); a Supabase solo va el dato liviano
    if (punchModal.photo) {
      savePhotoLocal(record.id, punchModal.photo)
        .then(() => setPhotoCache((prev) => ({ ...prev, [record.id]: punchModal.photo })))
        .catch((err) => {
          console.error("No se pudo guardar la foto localmente:", err);
          setToast({ color: paprika, text: "El registro se guardó, pero la foto no se pudo guardar en este dispositivo." });
        });
    }

    const updatedAll = pruneOldDates({
      ...recordsByDate,
      [today]: [...(recordsByDate[today] || []), record],
    });

    cleanupOrphanedPhotos(recordsByDate, updatedAll);

    setRecordsByDate(updatedAll);
    setLastUpdated(new Date());
    scheduleSync("records", JSON.stringify(updatedAll));

    const meta = punctualityMeta(punctuality, paprika, brass, sage);
    let toastText = `${punchModal.type === "entrada" ? "Entrada" : "Salida"} registrada — ${emp.name}`;
    if (punchModal.type === "entrada" && punctuality) {
      const minsLabel =
        minsLate <= 0 ? "a tiempo" : `${minsLate} min tarde`;
      toastText += ` (${minsLabel} · ${meta.label.split("—")[1]?.trim() || meta.label})`;
    }
    setToast({ color: punctuality ? meta.color : sage, text: toastText });
    setPunchModal(null);
    if (punchModal.type === "entrada") {
      setAreaModal({ employeeId: emp.id, employeeName: emp.name });
    } else {
      setSalidaForkModal({ employeeId: emp.id, employeeName: emp.name });
    }
  }

  function registrarAsignacionArea(area) {
    if (!areaModal) return;
    const hoyKeyLocal = today;
    // reemplaza cualquier asignación previa de este mismo empleado hoy (si cambió de área)
    const sinAnterior = asignaciones.filter((a) => !(a.employeeId === areaModal.employeeId && a.fecha === hoyKeyLocal));
    const nueva = {
      id: uid("asig"),
      employeeId: areaModal.employeeId,
      employeeName: areaModal.employeeName,
      area,
      fecha: hoyKeyLocal,
      hora: new Date().toISOString(),
    };
    const actualizadas = [...sinAnterior, nueva];
    setAsignaciones(actualizadas);
    scheduleSync("asignaciones_area_hoy", JSON.stringify(actualizadas));

    guardarAreaCompartida(area);
    setToast({ color: sage, text: `Área de hoy: ${area}` });
    setAreaModal(null);
    setSelectedEmployeeId(null);
  }

  async function guardarProduccion(descripcion) {
    if (!produccionModal) return;
    const nuevo = {
      id: uid("prod"),
      employeeId: produccionModal.employeeId,
      employeeName: produccionModal.employeeName,
      fecha: today,
      hora: new Date().toISOString(),
      descripcion,
    };
    try {
      const val = await kvGet("produccion_registros");
      let lista = val || [];
      lista = [nuevo, ...lista].slice(0, 300); // conserva los últimos 300 registros
      await kvSet("produccion_registros", lista);
      setToast({ color: sage, text: "Actividades de producción guardadas." });
    } catch (e) {
      setToast({ color: paprika, text: "No se pudo guardar. Intenta de nuevo." });
    }
    setProduccionModal(null);
    setSalidaForkModal(null);
    setSelectedEmployeeId(null);
  }

  async function guardarMercancia(itemsRecibidos, quien) {
    // itemsRecibidos: [{ parItemId, nombre, unidad, cantidad }]
    try {
      const parItemsRaw = (await kvGet("par_items_v2", "kv_store")) || [];
      const actualizados = parItemsRaw.map((pi) => {
        const recibido = itemsRecibidos.find((r) => r.parItemId === pi.id);
        if (!recibido) return pi;
        return { ...pi, stockActual: Math.round((pi.stockActual + recibido.cantidad) * 10) / 10 };
      });
      await kvSet("par_items_v2", actualizados, "kv_store");

      // registro liviano para trazabilidad (queda en el espacio de datos de PAR)
      const registroVal = (await kvGet("entradas_mercancia_v1", "kv_store")) || [];
      const nuevo = {
        id: uid("merc"),
        fecha: today,
        hora: new Date().toISOString(),
        quien,
        items: itemsRecibidos.map((r) => ({ nombre: r.nombre, unidad: r.unidad, cantidad: r.cantidad })),
      };
      const registroActualizado = [nuevo, ...registroVal].slice(0, 200);
      await kvSet("entradas_mercancia_v1", registroActualizado, "kv_store");

      setToast({ color: sage, text: "Mercancía registrada — se sumó al inventario de PAR." });
    } catch (e) {
      setToast({ color: paprika, text: "No se pudo registrar la mercancía. Intenta de nuevo." });
    }
    setMercanciaModal(null);
    setSalidaForkModal(null);
    setSelectedEmployeeId(null);
  }

  const activeEmployees = employees.filter((e) => e.active);
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) || null;
  const selectedStatus = selectedEmployee ? statusFor(selectedEmployee.id) : null;

  const monthTotal = monthDateKeys.reduce((sum, d) => sum + (recordsByDate[d]?.length || 0), 0);
  const secsAgo = lastUpdated ? Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000)) : null;

  // ---------- style tokens ----------
  const paprika = "#C1442D";
  const sage = "#5C7A5E";
  const ink = "#211F1B";
  const paper = "#F7F3EA";
  const charcoal = "#201E1B";
  const brass = "#D6A24C";
  const steel = "#8A8F86";

  // ---------- vista imprimible del resumen mensual (reemplaza toda la UI mientras esté activa) ----------
  if (printView) {
    const reportsToShow = employees
      .map((emp) => ({ emp, report: buildEmployeeMonthReport(emp, printView.month, recordsByDate) }))
      .filter(({ report }) => report.rows.length > 0);

    return (
      <div style={{ background: "#fff", minHeight: "100vh", color: ink, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .report-page { page-break-after: always; }
          }
        `}</style>

        <div
          className="no-print flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${ink}22`, position: "sticky", top: 0, background: "#fff" }}
        >
          <button
            onClick={() => setPrintView(null)}
            className="text-sm font-bold flex items-center gap-1"
            style={{ color: ink }}
          >
            ← Volver
          </button>
          <div className="text-xs font-bold uppercase" style={{ color: ink + "88" }}>
            {monthLabel(printView.month)}
          </div>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-sm font-bold text-xs uppercase"
            style={{ background: brass, color: ink }}
          >
            Imprimir / Guardar PDF
          </button>
        </div>

        <div
          className="no-print flex flex-col gap-2 px-4 py-3"
          style={{ borderBottom: `1px solid ${ink}11`, background: ink + "06" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => downloadMonthSummary(printView.month)}
              className="text-[11px] font-bold uppercase px-3 py-1.5 rounded-sm"
              style={{ background: brass, color: ink }}
            >
              Descargar resumen
            </button>
            <button
              onClick={() => downloadMonthBackup(printView.month)}
              className="text-[11px] font-bold uppercase px-3 py-1.5 rounded-sm"
              style={{ border: `1px solid ${ink}33`, color: ink }}
            >
              Descargar respaldo (JSON)
            </button>
            <button
              onClick={() => setShowDriveHelp((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase px-3 py-1.5 rounded-sm"
              style={{ border: `1px solid ${ink}33`, color: ink }}
            >
              <UploadCloud size={13} /> Subir a Drive
            </button>
          </div>

          {showDriveHelp && (
            <div className="text-[10px] rounded-sm px-3 py-2" style={{ background: brass + "22", color: ink }}>
              Esta app ya tiene acceso a internet, pero la subida automática a Drive todavía no está
              conectada — requiere configurar credenciales de la API de Google (un paso aparte, con su
              propia cuenta de Google Cloud). Mientras tanto: descarga el resumen arriba y arrástralo tú
              mismo a Drive, o súbelo aquí en el chat con Claude y pídeme que te lo suba. Si quieres, en
              otra sesión podemos configurar la conexión directa a Drive.
            </div>
          )}

          <div>
            {printView.month >= monthKeyOf() ? (
              <span className="text-[10px]" style={{ color: ink + "66" }}>
                El mes en curso no se puede borrar todavía.
              </span>
            ) : confirmPurgeMonth ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: paprika }}>
                  ¿Ya subiste el respaldo a Drive? Esto borra {monthLabel(printView.month)} de este dispositivo.
                </span>
                <button
                  onClick={() => purgeMonth(printView.month)}
                  className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm"
                  style={{ background: paprika, color: "#fff" }}
                >
                  Sí, borrar
                </button>
                <button
                  onClick={() => setConfirmPurgeMonth(false)}
                  className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm"
                  style={{ border: `1px solid ${ink}33`, color: ink }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmPurgeMonth(true)}
                className="text-[11px] font-bold uppercase px-3 py-1.5 rounded-sm"
                style={{ border: `1px solid ${paprika}55`, color: paprika }}
              >
                Borrar datos de este mes
              </button>
            )}
          </div>
        </div>

        {reportsToShow.length === 0 ? (
          <p className="p-6 text-sm">No hay días programados ni registros para {monthLabel(printView.month)}.</p>
        ) : (
          reportsToShow.map(({ emp, report }) => (
            <div key={emp.id} className="report-page" style={{ padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
              <h1 style={{ fontSize: "1.15rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.01em" }}>
                Resumen mensual de asistencia
              </h1>
              <p style={{ fontSize: "0.82rem", color: ink + "99", marginTop: "2px" }}>
                Restaurante Bondiola · {monthLabel(printView.month)}
              </p>

              <div style={{ marginTop: "1rem", fontSize: "0.85rem", lineHeight: 1.6 }}>
                <div>
                  <strong>Empleado:</strong> {emp.name}
                </div>
                <div>
                  <strong>Puesto:</strong> {emp.puesto}
                </div>
                <div>
                  <strong>Horario asignado:</strong> {scheduleSummary(getScheduleForDate(emp, today))}
                </div>
              </div>

              <table style={{ width: "100%", marginTop: "1rem", fontSize: "0.7rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${ink}55`, textAlign: "left" }}>
                    <th style={{ padding: "4px 6px 4px 0" }}>Fecha</th>
                    <th style={{ padding: "4px 6px" }}>Programado</th>
                    <th style={{ padding: "4px 6px" }}>Entrada</th>
                    <th style={{ padding: "4px 6px" }}>Salida</th>
                    <th style={{ padding: "4px 6px" }}>Horas</th>
                    <th style={{ padding: "4px 6px" }}>Min. tarde</th>
                    <th style={{ padding: "4px 0" }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.dateKey} style={{ borderBottom: `1px solid ${ink}15` }}>
                      <td style={{ padding: "3px 6px 3px 0" }}>
                        {r.dayLabel} {r.dayNum}
                      </td>
                      <td style={{ padding: "3px 6px" }}>
                        {r.scheduled ? `${r.scheduledStart}–${r.scheduledEnd}` : "—"}
                      </td>
                      <td style={{ padding: "3px 6px" }}>{r.entradaTime || (r.falta ? "FALTA" : "—")}</td>
                      <td style={{ padding: "3px 6px" }}>{r.salidaTime || "—"}</td>
                      <td style={{ padding: "3px 6px" }}>{r.hoursWorked !== null ? r.hoursWorked : "—"}</td>
                      <td style={{ padding: "3px 6px" }}>{r.minutesLate !== null ? r.minutesLate : "—"}</td>
                      <td style={{ padding: "3px 0" }}>
                        {r.punctuality === "bono" && "Bono + propina"}
                        {r.punctuality === "propina" && "Solo propina"}
                        {r.punctuality === "ninguno" && "Sin bono/propina"}
                        {r.falta && "Falta"}
                        {!r.punctuality && !r.falta && "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p style={{ marginTop: "1.2rem", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase" }}>
                Desglose semanal
              </p>
              <table style={{ width: "100%", marginTop: "0.4rem", fontSize: "0.72rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${ink}55`, textAlign: "left" }}>
                    <th style={{ padding: "4px 6px 4px 0" }}>Semana</th>
                    <th style={{ padding: "4px 6px" }}>Días trabajados</th>
                    <th style={{ padding: "4px 6px" }}>Horas</th>
                    <th style={{ padding: "4px 6px" }}>Retardos</th>
                    <th style={{ padding: "4px 0" }}>Faltas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.weeks.map((w) => (
                    <tr key={w.weekNum} style={{ borderBottom: `1px solid ${ink}15` }}>
                      <td style={{ padding: "3px 6px 3px 0" }}>{w.label}</td>
                      <td style={{ padding: "3px 6px" }}>{w.diasTrabajados}</td>
                      <td style={{ padding: "3px 6px" }}>{w.horas}</td>
                      <td style={{ padding: "3px 6px" }}>{w.retardos}</td>
                      <td style={{ padding: "3px 0" }}>{w.faltas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: "1rem", fontSize: "0.8rem", display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                <span>
                  Días programados: <strong>{report.diasProgramados}</strong>
                </span>
                <span>
                  Días trabajados (mes): <strong>{report.diasTrabajados}</strong>
                </span>
                <span>
                  Horas trabajadas (mes): <strong>{report.horasTotalMes}</strong>
                </span>
                <span>
                  Retardos: <strong>{report.diasRetardo}</strong>
                </span>
                <span>
                  Faltas: <strong>{report.diasFalta}</strong>
                </span>
                <span>
                  Con bono: <strong>{report.diasBono}</strong>
                </span>
                <span>
                  Con propina: <strong>{report.diasPropina}</strong>
                </span>
              </div>

              <p style={{ marginTop: "2rem", fontSize: "0.78rem", lineHeight: 1.5, color: ink + "cc" }}>
                Al firmar este documento, el empleado y el encargado en turno confirman estar de acuerdo con
                el horario asignado y los días efectivamente cumplidos durante el mes indicado.
              </p>

              <div style={{ marginTop: "3rem", display: "flex", justifyContent: "space-between", gap: "2rem" }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ borderTop: `1px solid ${ink}`, paddingTop: "4px", fontSize: "0.78rem" }}>
                    Firma del Encargado en turno
                  </div>
                  <div style={{ fontSize: "0.65rem", color: ink + "77", marginTop: "2px" }}>Nombre y fecha</div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ borderTop: `1px solid ${ink}`, paddingTop: "4px", fontSize: "0.78rem" }}>
                    Firma del Empleado
                  </div>
                  <div style={{ fontSize: "0.65rem", color: ink + "77", marginTop: "2px" }}>Nombre y fecha</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: charcoal, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}
    >
      <input
        id="reloj-photo-input"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      {/* header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: `2px dashed ${steel}55` }}>
        <div className="flex items-center gap-2">
          <Clock size={22} color={brass} strokeWidth={2.4} />
          <h1
            className="uppercase font-black tracking-tight"
            style={{ color: paper, fontSize: "1.5rem", letterSpacing: "-0.01em" }}
          >
            Reloj Checador
          </h1>
        </div>
        <p className="text-xs mt-1" style={{ color: steel, letterSpacing: "0.04em" }}>
          Control de entradas y salidas del personal
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className="inline-block rounded-full flex-shrink-0"
            style={{
              width: 6,
              height: 6,
              background: Object.keys(pendingKeys).length > 0 ? brass : sage,
              animation: Object.keys(pendingKeys).length > 0 ? "pulse 1.4s infinite" : "none",
            }}
          />
          <span className="text-[10px]" style={{ color: steel }}>
            {Object.keys(pendingKeys).length > 0 ? "Sincronizando cambios…" : "Todo sincronizado"}
          </span>
        </div>

        <div className="flex gap-2 mt-4">
          {[
            { id: "checador", label: "Checador", icon: Clock },
            { id: "bitacora", label: "Bitácora", icon: unlockedSession ? ScrollText : Lock },
            { id: "propinas", label: "Propinas", icon: Coins },
            { id: "personal", label: "Personal", icon: Users },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const protegida = t.id === "bitacora";
            return (
              <button
                key={t.id}
                onClick={() => (protegida ? requestUnlock(t.id) : setTab(t.id))}
                className="flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-bold uppercase transition-colors"
                style={{
                  background: active ? brass : "transparent",
                  color: active ? ink : steel,
                  border: `1px solid ${active ? brass : steel + "55"}`,
                  letterSpacing: "0.05em",
                }}
              >
                <Icon size={14} strokeWidth={2.5} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- CHECADOR TAB ---------------- */}
      {tab === "checador" && (
        <div className="flex-1 px-5 py-5 flex flex-col gap-5">
          {loadingEmployees ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: steel }}>
              <Loader2 size={16} className="animate-spin" /> Cargando personal…
            </div>
          ) : activeEmployees.length === 0 ? (
            <div className="rounded-sm p-4 text-sm" style={{ background: paper, color: ink }}>
              Aún no hay personal activo. Ve a la pestaña <span className="font-bold">Personal</span> para
              agregar empleados.
            </div>
          ) : (
            <>
              <AreasDeHoyPanel asignaciones={asignaciones} today={today} paper={paper} ink={ink} steel={steel} brass={brass} />
              <div>
                <div
                  className="text-[10px] font-bold uppercase mb-2"
                  style={{ color: steel, letterSpacing: "0.1em" }}
                >
                  Selecciona tu nombre
                </div>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))" }}
                >
                  {activeEmployees.map((emp) => {
                    const st = statusFor(emp.id);
                    const sel = emp.id === selectedEmployeeId;
                    return (
                      <button
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className="w-full flex flex-col items-start gap-1 px-3 py-2 rounded-sm"
                        style={{
                          background: sel ? paper : "transparent",
                          border: `1px solid ${sel ? paper : steel + "55"}`,
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block rounded-full"
                            style={{ width: 7, height: 7, background: st === "dentro" ? sage : steel }}
                          />
                          <span className="text-xs font-bold" style={{ color: sel ? ink : paper }}>
                            {emp.name}
                          </span>
                        </div>
                        <span className="text-[10px]" style={{ color: sel ? ink + "99" : steel }}>
                          {emp.puesto} · {st === "dentro" ? "Dentro" : "Fuera"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedEmployee && (
                <div className="rounded-sm p-4" style={{ background: paper, border: `1px solid ${ink}22` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-black text-lg" style={{ color: ink }}>
                        {selectedEmployee.name}
                      </div>
                      <div className="text-xs" style={{ color: ink + "88" }}>
                        {selectedEmployee.puesto}
                      </div>
                    </div>
                    <div
                      className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm"
                      style={{
                        background: selectedStatus === "dentro" ? sage + "22" : steel + "22",
                        color: selectedStatus === "dentro" ? sage : steel,
                      }}
                    >
                      {selectedStatus === "dentro" ? "Dentro" : "Fuera"}
                    </div>
                  </div>

                  <button
                    onClick={() => openPunch(selectedStatus === "dentro" ? "salida" : "entrada")}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-sm font-black text-base uppercase"
                    style={{
                      background: selectedStatus === "dentro" ? sage : paprika,
                      color: paper,
                    }}
                  >
                    {selectedStatus === "dentro" ? <LogOut size={19} /> : <LogIn size={19} />}
                    {selectedStatus === "dentro" ? "Registrar Salida" : "Registrar Entrada"}
                  </button>
                  <p className="text-[10px] mt-2 text-center" style={{ color: ink + "77" }}>
                    {selectedStatus === "dentro"
                      ? "La foto es opcional para la salida."
                      : "La entrada requiere una foto con el uniforme puesto."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------------- BITACORA TAB ---------------- */}
      {tab === "bitacora" && (
        <div className="flex-1 px-5 py-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => setSelectedMonth((m) => shiftMonthKey(m, -1))}
              className="p-1 text-lg leading-none"
              style={{ color: steel }}
            >
              ‹
            </button>
            <div className="text-sm font-black uppercase text-center" style={{ color: paper }}>
              {monthLabel(selectedMonth)}
            </div>
            <button
              onClick={() => setSelectedMonth((m) => shiftMonthKey(m, 1))}
              disabled={selectedMonth >= monthKeyOf()}
              className="p-1 text-lg leading-none disabled:opacity-20"
              style={{ color: steel }}
            >
              ›
            </button>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-full"
                style={{ width: 6, height: 6, background: sage, animation: "pulse 2s infinite" }}
              />
              <div className="text-[10px] font-bold uppercase" style={{ color: steel, letterSpacing: "0.1em" }}>
                {monthTotal} registros
              </div>
            </div>
            <button
              onClick={() => loadRecords(false)}
              className="flex items-center gap-1 text-[10px]"
              style={{ color: steel }}
            >
              <RefreshCw size={11} />
              {secsAgo !== null ? `hace ${secsAgo}s` : ""}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              onClick={lockNow}
              className="flex items-center gap-1 text-[10px] font-bold uppercase"
              style={{ color: steel }}
            >
              <Lock size={11} /> Bloquear
            </button>
            <button
              onClick={() => setPrintView({ month: selectedMonth })}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-sm"
              style={{ background: brass, color: ink }}
            >
              <FileSignature size={12} /> Generar resumen del mes
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-[9px]" style={{ color: steel }}>
            <span className="flex items-center gap-1">
              <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: sage }} />
              ≤10 min: bono + propina
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: brass }} />
              11–15 min: solo propina
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: paprika }} />
              +15 min: sin bono ni propina
            </span>
          </div>

          {loadingWeek ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: steel }}>
              <Loader2 size={16} className="animate-spin" /> Cargando bitácora…
            </div>
          ) : monthTotal === 0 ? (
            <div className="text-sm py-6 text-center" style={{ color: steel }}>
              Sin registros en {monthLabel(selectedMonth)}.
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
              {monthDateKeys.map((date) => {
                const dayRecords = [...(recordsByDate[date] || [])].reverse();
                if (dayRecords.length === 0) return null;
                return (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-1.5 sticky top-0" style={{ background: charcoal }}>
                      <div
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm"
                        style={{
                          background: date === today ? brass : steel + "33",
                          color: date === today ? ink : paper,
                        }}
                      >
                        {formatDateLabel(date, today)}
                      </div>
                      <div className="text-[10px]" style={{ color: steel }}>
                        {dayRecords.length} {dayRecords.length === 1 ? "registro" : "registros"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {dayRecords.map((r) => {
                        const photoUrl = r.hasPhoto ? photoCache[r.id] : null;
                        const meta =
                          r.type === "entrada" ? punctualityMeta(r.punctuality, paprika, brass, sage) : null;
                        return (
                          <div
                            key={r.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-sm"
                            style={{
                              background: paper,
                              borderTop: `2px dashed ${ink}22`,
                              borderLeft: meta?.color ? `4px solid ${meta.color}` : "4px solid transparent",
                            }}
                          >
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={r.employeeName}
                                className="rounded-full object-cover flex-shrink-0"
                                style={{
                                  width: 34,
                                  height: 34,
                                  border: `2px solid ${r.type === "entrada" ? paprika : sage}`,
                                }}
                              />
                            ) : (
                              <div
                                className="rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ width: 34, height: 34, background: ink + "11" }}
                              >
                                <UserRound size={16} color={ink} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold truncate" style={{ color: ink }}>
                                {r.employeeName}
                              </div>
                              <div
                                className="text-[10px] font-mono uppercase"
                                style={{ color: r.type === "entrada" ? paprika : sage }}
                              >
                                {r.type} · {formatTime(r.time)}
                              </div>
                            </div>
                            {meta?.color && (
                              <span
                                className="flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-1 rounded-sm text-right"
                                style={{ background: meta.color + "22", color: meta.color }}
                                title={meta.label}
                              >
                                {r.minutesLate <= 0 ? "A tiempo" : `+${r.minutesLate} min`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------- PROPINAS TAB ---------------- */}
      {tab === "propinas" && (
        <div className="flex-1 px-5 py-5 flex flex-col gap-4 overflow-y-auto">
          <div className="text-sm font-black uppercase" style={{ color: paper }}>
            Propinas
          </div>

          <div className="rounded-sm p-4" style={{ background: paper }}>
            <label className="text-[10px] font-bold uppercase mb-1 block" style={{ color: ink + "88" }}>
              Tu nombre (quién hace esta operación)
            </label>
            <input
              value={propinasQuien}
              onChange={(e) => setPropinasQuien(e.target.value)}
              placeholder="Nombre"
              className="w-full mb-3 px-3 py-2.5 rounded-sm text-sm outline-none"
              style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
            />
            <label className="text-[10px] font-bold uppercase mb-1 block" style={{ color: ink + "88" }}>
              Fecha
            </label>
            <input
              type="date"
              value={propinasFecha}
              onChange={(e) => setPropinasFecha(e.target.value)}
              className="w-full mb-3 px-3 py-2.5 rounded-sm text-sm outline-none"
              style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
            />
            <label className="text-[10px] font-bold uppercase mb-1 block" style={{ color: ink + "88" }}>
              Monto total de propinas
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={propinasMonto}
              onChange={(e) => setPropinasMonto(e.target.value)}
              placeholder="$0.00"
              className="w-full px-3 py-2.5 rounded-sm text-lg font-bold outline-none"
              style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
            />
            <p className="text-[10px] mt-2" style={{ color: ink + "77" }}>
              Se reparte en partes iguales solo entre quienes llegaron dentro de la tolerancia (≤15 min tarde) ese día.
            </p>
          </div>

          {(() => {
            const { lista: reparto, sobrante } = calcularRepartoPropinas(propinasFecha, propinasMonto);
            const calificaron = reparto.filter((r) => r.califica).length;
            return (
              <>
                {reparto.length === 0 ? (
                  <div className="text-sm py-4 text-center" style={{ color: steel }}>
                    Nadie registró entrada ese día.
                  </div>
                ) : (
                  <div className="rounded-sm overflow-hidden" style={{ background: paper }}>
                    {reparto.map((r, idx) => (
                      <div
                        key={r.employeeId}
                        className="flex items-center justify-between px-3 py-2.5"
                        style={{ borderTop: idx > 0 ? `1px solid ${ink}15` : "none" }}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate" style={{ color: ink }}>
                            {r.employeeName}
                          </div>
                          <div className="text-[10px]" style={{ color: r.califica ? sage : ink + "66" }}>
                            {r.califica
                              ? r.minutesLate <= 0
                                ? "Llegó a tiempo"
                                : `${r.minutesLate} min tarde`
                              : r.motivo}
                          </div>
                        </div>
                        <div
                          className="text-sm font-black flex-shrink-0"
                          style={{ color: r.califica ? sage : ink + "44" }}
                        >
                          {r.califica ? `$${r.monto.toFixed(2)}` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {reparto.length > 0 && sobrante > 0 && (
                  <p className="text-[10px]" style={{ color: ink + "77" }}>
                    Sobrante sin repartir (redondeo hacia abajo): ${sobrante.toFixed(2)}
                  </p>
                )}

                {reparto.length > 0 && (
                  <button
                    onClick={() => guardarReparto(propinasFecha, propinasMonto, reparto, propinasQuien)}
                    disabled={!propinasMonto || Number(propinasMonto) <= 0 || !propinasQuien.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-sm font-bold text-sm uppercase disabled:opacity-40"
                    style={{ background: brass, color: ink }}
                  >
                    <Coins size={16} /> Guardar reparto ({calificaron} {calificaron === 1 ? "persona" : "personas"})
                  </button>
                )}
                {reparto.length > 0 && !propinasQuien.trim() && (
                  <p className="text-[10px] text-center" style={{ color: paprika }}>
                    Escribe tu nombre arriba para poder guardar.
                  </p>
                )}
              </>
            );
          })()}

          <div className="pt-2" style={{ borderTop: `2px dashed ${steel}33` }}>
            <div className="flex items-center justify-between mb-2 mt-3">
              <div className="text-[10px] font-bold uppercase" style={{ color: steel, letterSpacing: "0.08em" }}>
                Bitácora de propinas
              </div>
              {unlockedSession && (
                <button onClick={lockNow} className="flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: steel }}>
                  <Lock size={11} /> Bloquear
                </button>
              )}
            </div>

            {!unlockedSession ? (
              <button
                onClick={() => requestUnlock("propinas")}
                className="w-full rounded-sm p-4 flex items-center gap-3 text-left"
                style={{ background: paper }}
              >
                <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, background: brass + "33" }}>
                  <Lock size={16} color={ink} />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: ink }}>
                    Solo el Gerente puede ver la bitácora
                  </div>
                  <div className="text-[11px]" style={{ color: ink + "88" }}>
                    Toca para ingresar la clave
                  </div>
                </div>
              </button>
            ) : loadingPropinas ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: steel }}>
                <Loader2 size={16} className="animate-spin" /> Cargando…
              </div>
            ) : propinasHistorial.length === 0 ? (
              <div className="text-sm py-2" style={{ color: steel }}>
                Sin repartos guardados todavía.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {propinasHistorial.slice(0, 10).map((p) => (
                  <div key={p.id} className="rounded-sm px-3 py-2.5" style={{ background: paper }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: ink }}>
                        {formatDateLabel(p.fecha, today)}
                      </span>
                      <span className="text-xs font-black" style={{ color: ink }}>
                        ${p.monto.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: ink + "77" }}>
                      {p.reparto.filter((r) => r.califica).length} de {p.reparto.length} calificaron
                      {p.quien ? ` · registrado por ${p.quien}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- PERSONAL TAB ---------------- */}
      {tab === "personal" && (
        <div className="flex-1 px-5 py-5 flex flex-col gap-5">
          {unlockedSession ? (
            <div className="rounded-sm p-4" style={{ background: paper }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold uppercase" style={{ color: ink, letterSpacing: "0.06em" }}>
                  Agregar empleado
                </div>
                <button
                  onClick={lockNow}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase"
                  style={{ color: ink + "77" }}
                >
                  <Lock size={11} /> Bloquear
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre completo"
                  className="px-3 py-2 rounded-sm text-sm outline-none"
                  style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
                />
                <input
                  value={newPuesto}
                  onChange={(e) => setNewPuesto(e.target.value)}
                  placeholder="Puesto (ej. Cocina, Barra, Servicio)"
                  className="px-3 py-2 rounded-sm text-sm outline-none"
                  style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
                />
                <button
                  onClick={addEmployee}
                  disabled={!newName.trim()}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-sm font-bold text-sm uppercase disabled:opacity-40"
                  style={{ background: brass, color: ink }}
                >
                  <Plus size={16} /> Agregar
                </button>
                <button
                  onClick={openChangePin}
                  className="text-[10px] font-bold uppercase text-center mt-1"
                  style={{ color: ink + "66" }}
                >
                  Cambiar clave de acceso
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => requestUnlock("agregar")}
              className="rounded-sm p-4 flex items-center gap-3 text-left w-full"
              style={{ background: paper }}
            >
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{ width: 34, height: 34, background: brass + "33" }}
              >
                <Lock size={16} color={ink} />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: ink }}>
                  Agregar personal está protegido
                </div>
                <div className="text-[11px]" style={{ color: ink + "88" }}>
                  Toca para ingresar la clave de acceso
                </div>
              </div>
            </button>
          )}

          <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
            {loadingEmployees ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: steel }}>
                <Loader2 size={16} className="animate-spin" /> Cargando…
              </div>
            ) : employees.length === 0 ? (
              <div className="text-sm py-6 text-center" style={{ color: steel }}>
                No hay empleados registrados todavía.
              </div>
            ) : (
              employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-sm"
                  style={{ background: paper }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: ink }}>
                      {emp.name}
                    </div>
                    <div className="text-[11px]" style={{ color: ink + "88" }}>
                      {emp.puesto}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: ink + "66" }}>
                      {scheduleSummary(getScheduleForDate(emp, today))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {unlockedSession && (
                      <button
                        onClick={() => openScheduleModal(emp.id)}
                        className="p-1.5 rounded-sm"
                        style={{ color: ink + "77", border: `1px solid ${ink}22` }}
                        title="Editar horario"
                      >
                        <CalendarClock size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => toggleActive(emp.id)}
                      className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm"
                      style={{
                        background: emp.active ? sage + "22" : steel + "22",
                        color: emp.active ? sage : steel,
                      }}
                    >
                      {emp.active ? "Activo" : "Inactivo"}
                    </button>
                    {confirmDeleteId === emp.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteEmployee(emp.id)}
                          className="p-1.5 rounded-sm"
                          style={{ background: paprika, color: paper }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1.5 rounded-sm"
                          style={{ background: steel + "33", color: ink }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(emp.id)}
                        className="p-1.5 rounded-sm"
                        style={{ color: ink + "55" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------- PUNCH MODAL ---------------- */}
      {punchModal && selectedEmployee && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4"
          style={{ background: "#00000099" }}
        >
          <div className="w-full max-w-sm rounded-sm p-5" style={{ background: paper }}>
            <div className="flex items-center justify-between mb-4">
              <div
                className="text-xs font-bold uppercase"
                style={{ color: punchModal.type === "entrada" ? paprika : sage, letterSpacing: "0.06em" }}
              >
                Registrar {punchModal.type}
              </div>
              <div className="flex items-center gap-2">
                {punchModal.type === "entrada" && (
                  <span className="text-[10px] font-bold" style={{ color: ink + "55" }}>Paso 1 de 2</span>
                )}
                <button onClick={() => setPunchModal(null)}>
                  <X size={18} color={ink} />
                </button>
              </div>
            </div>

            <div className="text-sm font-bold mb-1" style={{ color: ink }}>
              {selectedEmployee.name}
            </div>
            <div className="text-xs mb-4" style={{ color: ink + "88" }}>
              {formatTime(new Date().toISOString())} · Hoy
            </div>

            {punchModal.type === "entrada" && !punchModal.photo && (
              <div className="mb-4">
                <p className="text-xs mb-3" style={{ color: ink + "aa" }}>
                  Toma una foto con tu uniforme puesto para registrar la entrada.
                </p>
                <label
                  htmlFor="reloj-photo-input"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-sm font-bold text-sm uppercase cursor-pointer"
                  style={{ background: paprika, color: paper }}
                >
                  <Camera size={16} /> Tomar / subir foto
                </label>
              </div>
            )}

            {punchModal.photo && (
              <div className="mb-4">
                <img
                  src={punchModal.photo}
                  alt="Foto de uniforme"
                  className="w-full rounded-sm object-cover mb-2"
                  style={{ maxHeight: 220 }}
                />
                <label
                  htmlFor="reloj-photo-input"
                  className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  style={{ color: ink + "88" }}
                >
                  <RotateCcw size={13} /> Repetir foto
                </label>
              </div>
            )}

            {punchModal.type === "salida" && !punchModal.photo && (
              <label
                htmlFor="reloj-photo-input"
                className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 rounded-sm font-bold text-xs uppercase cursor-pointer"
                style={{ border: `1px solid ${ink}33`, color: ink }}
              >
                <Camera size={14} /> Agregar foto (opcional)
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPunchModal(null)}
                className="py-2.5 rounded-sm font-bold text-sm uppercase"
                style={{ border: `1px solid ${ink}33`, color: ink }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmPunch}
                disabled={punchModal.type === "entrada" && !punchModal.photo}
                className="flex items-center justify-center gap-2 py-2.5 rounded-sm font-bold text-sm uppercase disabled:opacity-40"
                style={{ background: punchModal.type === "entrada" ? paprika : sage, color: paper }}
              >
                <Check size={15} />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- AREA DEL DÍA MODAL ---------------- */}
      {areaModal && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4"
          style={{ background: "#00000099" }}
        >
          <div className="w-full max-w-sm rounded-sm p-5" style={{ background: paper }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase" style={{ color: sage, letterSpacing: "0.06em" }}>
                <Check size={13} /> Entrada registrada
              </div>
              <span className="text-[10px] font-bold" style={{ color: ink + "55" }}>Paso 2 de 2</span>
            </div>
            <div className="text-lg font-black mb-1" style={{ color: ink }}>
              {areaModal.employeeName}
            </div>
            <p className="text-sm mb-4" style={{ color: ink + "aa" }}>
              ¿Qué área vas a cubrir hoy? Con esto ya te va a salir directo en DÍA y Limpieza.
            </p>
            <div className="flex flex-col gap-2 mb-3">
              {AREAS_DIA.map((a) => (
                <button
                  key={a}
                  onClick={() => registrarAsignacionArea(a)}
                  className="w-full py-3 rounded-sm text-left px-4 font-bold text-sm"
                  style={{ border: `1px solid ${ink}22`, color: ink }}
                >
                  {a}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setAreaModal(null); setSelectedEmployeeId(null); }}
              className="w-full py-2 text-center text-xs font-bold uppercase"
              style={{ color: ink + "66" }}
            >
              Omitir por ahora
            </button>
          </div>
        </div>
      )}

      {/* ---------------- FORK DE SALIDA ---------------- */}
      {salidaForkModal && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4" style={{ background: "#00000099" }}>
          <div className="w-full max-w-sm rounded-sm p-5" style={{ background: paper }}>
            <div className="mb-1 text-xs font-bold uppercase" style={{ color: sage, letterSpacing: "0.06em" }}>
              Salida registrada
            </div>
            <div className="text-lg font-black mb-1" style={{ color: ink }}>
              {salidaForkModal.employeeName}
            </div>
            <p className="text-sm mb-4" style={{ color: ink + "aa" }}>
              ¿Quieres registrar algo antes de irte? Es opcional.
            </p>
            <div className="flex flex-col gap-2.5 mb-3">
              <button
                onClick={() => setProduccionModal({ employeeId: salidaForkModal.employeeId, employeeName: salidaForkModal.employeeName })}
                className="w-full py-3.5 rounded-sm text-left px-4 flex items-center gap-3"
                style={{ background: brass + "18", border: `1px solid ${brass}55` }}
              >
                <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: brass + "33" }}>
                  <ChefHat size={18} color={ink} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm" style={{ color: ink }}>Lo que produje hoy</div>
                  <div className="text-[11px]" style={{ color: ink + "77" }}>Un renglón: qué preparaste o porcionaste</div>
                </div>
                <ChevronRight size={16} color={ink} />
              </button>
              <button
                onClick={() => setMercanciaModal({ employeeId: salidaForkModal.employeeId, employeeName: salidaForkModal.employeeName })}
                className="w-full py-3.5 rounded-sm text-left px-4 flex items-center gap-3"
                style={{ background: sage + "18", border: `1px solid ${sage}55` }}
              >
                <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: sage + "33" }}>
                  <PackagePlus size={18} color={ink} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm" style={{ color: ink }}>Mercancía que llegó</div>
                  <div className="text-[11px]" style={{ color: ink + "77" }}>Se suma directo al inventario de PAR</div>
                </div>
                <ChevronRight size={16} color={ink} />
              </button>
            </div>
            <button
              onClick={() => { setSalidaForkModal(null); setSelectedEmployeeId(null); }}
              className="w-full py-2.5 text-center text-xs font-bold uppercase"
              style={{ color: ink + "66" }}
            >
              Nada, ya me voy
            </button>
          </div>
        </div>
      )}

      {/* ---------------- ACTIVIDADES DE PRODUCCIÓN ---------------- */}
      {produccionModal && (
        <ProduccionModal
          modal={produccionModal}
          onCancel={() => { setProduccionModal(null); setSalidaForkModal(null); setSelectedEmployeeId(null); }}
          onGuardar={guardarProduccion}
          paper={paper} ink={ink} brass={brass} sage={sage}
        />
      )}

      {/* ---------------- MERCANCÍA RECIBIDA ---------------- */}
      {mercanciaModal && (
        <MercanciaModal
          modal={mercanciaModal}
          onCancel={() => { setMercanciaModal(null); setSalidaForkModal(null); setSelectedEmployeeId(null); }}
          onGuardar={guardarMercancia}
          paper={paper} ink={ink} brass={brass} sage={sage} paprika={paprika}
        />
      )}

      {/* ---------------- PIN MODAL ---------------- */}
      {pinModal && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4"
          style={{ background: "#00000099" }}
        >
          <div className="w-full max-w-sm rounded-sm p-5" style={{ background: paper }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock size={16} color={brass} />
                <div className="text-xs font-bold uppercase" style={{ color: ink, letterSpacing: "0.06em" }}>
                  {pinModal.mode === "unlock" && "Ingresa la clave"}
                  {pinModal.mode === "setup" && "Configura una clave"}
                  {pinModal.mode === "change" && "Nueva clave de acceso"}
                </div>
              </div>
              <button onClick={() => setPinModal(null)}>
                <X size={18} color={ink} />
              </button>
            </div>

            {pinModal.mode === "setup" && (
              <p className="text-xs mb-3" style={{ color: ink + "aa" }}>
                Esta clave se pedirá para ver la bitácora y para agregar personal nuevo.
              </p>
            )}

            {pinModal.mode === "unlock" ? (
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinModal.value}
                onChange={(e) =>
                  setPinModal((m) => ({ ...m, value: e.target.value.replace(/\D/g, ""), error: "" }))
                }
                onKeyDown={(e) => e.key === "Enter" && submitPin()}
                placeholder="Clave"
                className="w-full px-3 py-3 rounded-sm text-lg tracking-[0.3em] text-center outline-none mb-2"
                style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
              />
            ) : (
              <div className="flex flex-col gap-2 mb-2">
                <input
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinModal.value}
                  onChange={(e) =>
                    setPinModal((m) => ({ ...m, value: e.target.value.replace(/\D/g, ""), error: "" }))
                  }
                  placeholder="Nueva clave (mín. 4 dígitos)"
                  className="w-full px-3 py-3 rounded-sm text-lg tracking-[0.3em] text-center outline-none"
                  style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinModal.confirmValue}
                  onChange={(e) =>
                    setPinModal((m) => ({ ...m, confirmValue: e.target.value.replace(/\D/g, ""), error: "" }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && submitPin()}
                  placeholder="Confirmar clave"
                  className="w-full px-3 py-3 rounded-sm text-lg tracking-[0.3em] text-center outline-none"
                  style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
                />
              </div>
            )}

            {pinModal.error && (
              <p className="text-xs mb-2" style={{ color: paprika }}>
                {pinModal.error}
              </p>
            )}

            <button
              onClick={submitPin}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm font-bold text-sm uppercase mt-2"
              style={{ background: brass, color: ink }}
            >
              <LockOpen size={15} />
              {pinModal.mode === "unlock" ? "Desbloquear" : "Guardar clave"}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- SCHEDULE MODAL ---------------- */}
      {scheduleModal && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4"
          style={{ background: "#00000099" }}
        >
          <div className="w-full max-w-sm rounded-sm p-5" style={{ background: paper, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <CalendarClock size={16} color={brass} />
                <div className="text-xs font-bold uppercase" style={{ color: ink, letterSpacing: "0.06em" }}>
                  Horario semanal
                </div>
              </div>
              <button onClick={() => setScheduleModal(null)}>
                <X size={18} color={ink} />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: ink + "88" }}>
              {employees.find((e) => e.id === scheduleModal.employeeId)?.name}
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {DAY_NAMES.map((name, idx) => {
                const day = scheduleModal.draft[idx] || { enabled: false, start: "09:00", end: "17:00" };
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      onClick={() => updateScheduleDay(idx, { enabled: !day.enabled })}
                      className="flex items-center gap-2 flex-shrink-0"
                      style={{ width: "5.5rem" }}
                    >
                      <span
                        className="inline-block rounded-full flex-shrink-0"
                        style={{
                          width: 14,
                          height: 14,
                          border: `2px solid ${day.enabled ? sage : steel}`,
                          background: day.enabled ? sage : "transparent",
                        }}
                      />
                      <span
                        className="text-xs font-bold"
                        style={{ color: day.enabled ? ink : ink + "66" }}
                      >
                        {name.slice(0, 3)}
                      </span>
                    </button>
                    {day.enabled ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="time"
                          value={day.start}
                          onChange={(e) => updateScheduleDay(idx, { start: e.target.value })}
                          className="flex-1 px-2 py-1.5 rounded-sm text-xs outline-none"
                          style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
                        />
                        <span className="text-[10px]" style={{ color: ink + "66" }}>
                          a
                        </span>
                        <input
                          type="time"
                          value={day.end}
                          onChange={(e) => updateScheduleDay(idx, { end: e.target.value })}
                          className="flex-1 px-2 py-1.5 rounded-sm text-xs outline-none"
                          style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
                        />
                      </div>
                    ) : (
                      <span className="text-[11px] flex-1" style={{ color: ink + "55" }}>
                        Descanso
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] mb-1.5" style={{ color: ink + "77" }}>
              La hora de "entrada" de cada día es la referencia para la tolerancia de bono (10 min) y
              propina (15 min).
            </p>
            <p className="text-[10px] mb-3" style={{ color: brass }}>
              Este cambio aplica a partir de hoy — los resúmenes de meses ya pasados conservan el
              horario que estaba vigente en su momento.
            </p>

            <button
              onClick={saveSchedule}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm font-bold text-sm uppercase"
              style={{ background: brass, color: ink }}
            >
              <Check size={15} /> Guardar horario
            </button>
          </div>
        </div>
      )}

      {/* ---------------- TOAST ---------------- */}
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-sm text-sm font-bold z-50 shadow-lg text-center"
          style={{ background: toast.color || sage, color: paper, maxWidth: "90%" }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function AreasDeHoyPanel({ asignaciones, today, paper, ink, steel, brass }) {
  const hoy = asignaciones.filter((a) => a.fecha === today);
  if (hoy.length === 0) return null;

  const porArea = {};
  hoy.forEach((a) => {
    porArea[a.area] = porArea[a.area] || [];
    porArea[a.area].push(a.employeeName);
  });

  return (
    <div className="rounded-sm p-3" style={{ background: paper }}>
      <div className="text-[10px] font-bold uppercase mb-2" style={{ color: ink + "88", letterSpacing: "0.08em" }}>
        Áreas de hoy
      </div>
      <div className="flex flex-col gap-1.5">
        {Object.entries(porArea).map(([area, nombres]) => (
          <div key={area} className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold" style={{ color: ink }}>
              {area}
            </span>
            <span
              className="text-right"
              style={{ color: nombres.length > 1 ? brass : ink + "88", fontWeight: nombres.length > 1 ? 700 : 500 }}
            >
              {nombres.join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProduccionModal({ modal, onCancel, onGuardar, paper, ink, brass, sage }) {
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (!descripcion.trim()) return;
    setGuardando(true);
    await onGuardar(descripcion.trim());
    setGuardando(false);
  }

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4" style={{ background: "#00000099" }}>
      <div className="w-full max-w-sm rounded-sm p-5" style={{ background: paper }}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-bold uppercase" style={{ color: sage, letterSpacing: "0.06em" }}>
            Actividades de producción
          </div>
          <button onClick={onCancel}><X size={18} color={ink} /></button>
        </div>
        <div className="text-base font-black mb-3" style={{ color: ink }}>
          {modal.employeeName}
        </div>
        <textarea
          autoFocus
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej. Preparé 3L de salsa verde, porcioné 5kg de pollo..."
          rows={4}
          className="w-full px-3 py-2.5 rounded-sm text-sm outline-none mb-3"
          style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
        />
        <button
          onClick={confirmar}
          disabled={!descripcion.trim() || guardando}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-sm font-bold text-sm uppercase disabled:opacity-40"
          style={{ background: brass, color: ink }}
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Guardar y terminar
        </button>
      </div>
    </div>
  );
}


function MercanciaModal({ modal, onCancel, onGuardar, paper, ink, brass, sage, paprika }) {
  const [productos, setProductos] = useState(null);
  const [query, setQuery] = useState("");
  const [carrito, setCarrito] = useState([]); // [{parItemId, nombre, unidad, cantidad}]
  const [editando, setEditando] = useState(null); // producto elegido, esperando cantidad
  const [cantidadTemp, setCantidadTemp] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const val = await kvGet("par_items_v2", "kv_store");
        setProductos(val || []);
      } catch (e) {
        setProductos([]);
      }
    })();
  }, []);

  const yaEnCarrito = new Set(carrito.map((c) => c.parItemId));
  const filtrados = (productos || [])
    .filter((p) => !yaEnCarrito.has(p.id))
    .filter((p) => query.trim() && p.nombre.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);

  function elegirProducto(p) {
    setEditando(p);
    setCantidadTemp("");
  }

  function confirmarCantidad() {
    const cant = Number(cantidadTemp);
    if (!editando || !cant || cant <= 0) return;
    setCarrito((c) => [...c, { parItemId: editando.id, nombre: editando.nombre, unidad: editando.unidad, cantidad: cant }]);
    setEditando(null);
    setCantidadTemp("");
    setQuery("");
  }

  function quitarDelCarrito(id) {
    setCarrito((c) => c.filter((x) => x.parItemId !== id));
  }

  async function confirmar() {
    if (carrito.length === 0) return;
    setGuardando(true);
    await onGuardar(carrito, modal.employeeName);
    setGuardando(false);
  }

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4" style={{ background: "#00000099" }}>
      <div className="w-full max-w-sm rounded-sm p-5" style={{ background: paper, maxHeight: "88vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-bold uppercase" style={{ color: sage, letterSpacing: "0.06em" }}>
            Mercancía que entró hoy
          </div>
          <button onClick={onCancel}><X size={18} color={ink} /></button>
        </div>
        <div className="text-base font-black mb-4" style={{ color: ink }}>
          {modal.employeeName}
        </div>

        {/* Paso 1: buscar y elegir un producto */}
        {!editando && (
          <>
            <label className="text-[10px] font-bold uppercase mb-1 block" style={{ color: ink + "88" }}>
              Busca el producto que llegó
            </label>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej. Leche, jitomate, aceite..."
              className="w-full px-3 py-3 rounded-sm text-base outline-none mb-2"
              style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
            />
            {productos === null ? (
              <div className="flex items-center gap-2 text-sm py-3" style={{ color: ink + "88" }}>
                <Loader2 size={16} className="animate-spin" /> Cargando catálogo…
              </div>
            ) : query.trim() && filtrados.length === 0 ? (
              <p className="text-sm py-3 text-center" style={{ color: ink + "66" }}>Sin resultados.</p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-2">
                {filtrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => elegirProducto(p)}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-sm text-left"
                    style={{ background: "#fff", border: `1px solid ${ink}15` }}
                  >
                    <span className="text-sm font-bold" style={{ color: ink }}>{p.nombre}</span>
                    <span className="text-xs" style={{ color: ink + "77" }}>{p.unidad}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Paso 2: capturar cantidad del producto elegido */}
        {editando && (
          <div className="rounded-sm p-4 mb-3" style={{ background: brass + "22", border: `1px solid ${brass}` }}>
            <div className="text-sm font-black mb-2" style={{ color: ink }}>{editando.nombre}</div>
            <label className="text-[10px] font-bold uppercase mb-1 block" style={{ color: ink + "88" }}>
              ¿Cuántos {editando.unidad} llegaron?
            </label>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                value={cantidadTemp}
                onChange={(e) => setCantidadTemp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmarCantidad()}
                placeholder="0"
                className="flex-1 px-3 py-3 rounded-sm text-2xl font-black text-center outline-none"
                style={{ border: `1px solid ${ink}33`, background: "#fff", color: ink }}
              />
              <span className="text-sm font-bold flex-shrink-0" style={{ color: ink + "88" }}>{editando.unidad}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setEditando(null)}
                className="flex-1 py-2.5 rounded-sm font-bold text-xs uppercase"
                style={{ border: `1px solid ${ink}33`, color: ink }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCantidad}
                disabled={!cantidadTemp || Number(cantidadTemp) <= 0}
                className="flex-1 py-2.5 rounded-sm font-bold text-xs uppercase disabled:opacity-40"
                style={{ background: brass, color: ink }}
              >
                Agregar a la lista
              </button>
            </div>
          </div>
        )}

        {/* Lista de lo ya agregado */}
        {carrito.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase mb-1.5" style={{ color: ink + "77", letterSpacing: "0.06em" }}>
              Ya agregaste ({carrito.length})
            </div>
            <div className="flex flex-col gap-1.5">
              {carrito.map((c) => (
                <div key={c.parItemId} className="flex items-center justify-between px-3 py-2.5 rounded-sm" style={{ background: sage + "18" }}>
                  <span className="text-sm font-bold" style={{ color: ink }}>{c.nombre}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black" style={{ color: sage }}>{c.cantidad} {c.unidad}</span>
                    <button onClick={() => quitarDelCarrito(c.parItemId)}>
                      <X size={15} color={paprika} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={confirmar}
          disabled={carrito.length === 0 || guardando || !!editando}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-sm font-bold text-sm uppercase disabled:opacity-40"
          style={{ background: sage, color: "#fff" }}
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {carrito.length === 0 ? "Agrega al menos un producto" : `Registrar ${carrito.length} producto${carrito.length === 1 ? "" : "s"} en PAR`}
        </button>
      </div>
    </div>
  );
}
