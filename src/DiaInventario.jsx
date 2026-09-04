import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Package, ClipboardList, ChefHat, Plus, Minus, Trash2, Search,
  ChevronDown, ChevronRight, Check, X, AlertTriangle, Loader2,
  Pencil, Save, Camera, TrendingUp, BarChart2, Lock,
} from "lucide-react";

/* Mismo proyecto Supabase que PAR y Reloj Checador — tabla propia para DÍA */
const SUPABASE_URL = "https://ciwfhbpcpygubsvtmwze.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AF_54iVTwT25rhMrhWbFXQ_oW2z_NeF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function kvGet(key, tabla = "kv_store_dia") {
  const { data, error } = await supabase.from(tabla).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

async function kvSet(key, value, tabla = "kv_store_dia") {
  const { error } = await supabase.from(tabla).upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  return true;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function storageSetRetry(key, value, tabla = "kv_store_dia", intentos = 3) {
  let ultimoError = null;
  for (let i = 0; i < intentos; i++) {
    try {
      const ok = await kvSet(key, value, tabla);
      if (ok) return { ok: true };
      ultimoError = new Error("respuesta vacía del servidor");
    } catch (e) {
      ultimoError = e;
    }
    if (i < intentos - 1) await sleep(500 * (i + 1));
  }
  return { ok: false, error: ultimoError };
}

/* Igual que kvGet, pero además regresa cuándo se guardó por última vez ese registro
   (updated_at), para poder detectar si otro dispositivo lo cambió mientras tanto. */
async function kvGetConVersion(key, tabla = "kv_store_dia") {
  const { data, error } = await supabase.from(tabla).select("value, updated_at").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? { value: data.value, updatedAt: data.updated_at } : { value: null, updatedAt: null };
}

/* Guarda solo si nadie más cambió este registro desde que lo leímos (evita que dos
   dispositivos guardando casi al mismo tiempo se pisen entre sí sin darse cuenta).
   Si `expectedUpdatedAt` ya no coincide con lo que hay en el servidor, no sobrescribe:
   regresa { conflicto: true } para que quien llamó decida qué hacer (avisar y traer lo
   más reciente, en vez de perder en silencio lo que guardó la otra persona). */
async function kvSetConVersion(key, value, expectedUpdatedAt, tabla = "kv_store_dia") {
  const fecha = new Date().toISOString();
  if (expectedUpdatedAt == null) {
    // Todavía no había nada guardado bajo esta clave (o no se pudo leer su versión):
    // se guarda directo, no hay con qué comparar.
    const { error } = await supabase.from(tabla).upsert({ key, value, updated_at: fecha });
    if (error) throw error;
    return { ok: true, updatedAt: fecha };
  }
  const { data, error } = await supabase
    .from(tabla)
    .update({ value, updated_at: fecha })
    .eq("key", key)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at");
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, conflicto: true };
  return { ok: true, updatedAt: fecha };
}

async function storageSetRetryConVersion(key, value, expectedUpdatedAt, tabla = "kv_store_dia", intentos = 3) {
  let ultimoError = null;
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await kvSetConVersion(key, value, expectedUpdatedAt, tabla);
      if (res.ok) return res;
      return res; // conflicto real (alguien más ya guardó): reintentar con la misma versión esperada no serviría
    } catch (e) {
      ultimoError = e;
    }
    if (i < intentos - 1) await sleep(500 * (i + 1));
  }
  return { ok: false, error: ultimoError };
}

/* Poda genérica para cualquier estado guardado como { [fecha "YYYY-MM-DD"]: {...} }
   (estado de áreas, cierre del día de Pendientes, etc.). Se guarda una fecha por objeto
   para que cada día "empiece limpio" solo (no hace falta borrar nada a mano); esta función
   solo evita que el objeto crezca sin límite, guardando como máximo los últimos 14 días. */
function podarPorFecha(estado) {
  const fechas = Object.keys(estado || {}).sort();
  if (fechas.length <= 14) return estado || {};
  const aQuitar = fechas.slice(0, fechas.length - 14);
  const nuevo = { ...estado };
  aQuitar.forEach((f) => delete nuevo[f]);
  return nuevo;
}

/* ---------- Tokens (mismos que PAR, para identidad consistente) ---------- */
const C = {
  bg: "#E8F0EB",
  paper: "#FFFDF9",
  ink: "#221F1A",
  inkSoft: "#6B6558",
  line: "#DDD5C4",
  ok: "#57795B",
  okBg: "#E7EEE4",
  warn: "#C98A2C",
  warnBg: "#F6EAD3",
  critical: "#B23A2E",
  criticalBg: "#F5E1DD",
  accent: "#1F5C4D",
  accentDark: "#153F35",
};

const UNIDADES = ["pza", "kg", "g", "lt", "ml", "caja", "paquete", "porción"];
const CATEGORIAS_DEFAULT = [];
const AREAS_DEFAULT = ["Cocina Caliente", "Cocina Fría", "Servicio PA", "Barra PB", "Almacén"];

const SEED_ITEMS = [
  { id: "d1", nombre: "Jitomate picado", categoria: "", unidad: "kg", nivelMinimo: 4, stockActual: 1.5, area: "Cocina Fría", foto: "" },
  { id: "d2", nombre: "Salsa verde", categoria: "", unidad: "lt", nivelMinimo: 3, stockActual: 1, area: "Cocina Caliente", foto: "" },
  { id: "d3", nombre: "Leche entera", categoria: "", unidad: "lt", nivelMinimo: 6, stockActual: 2, area: "Barra PB", foto: "" },
  { id: "d4", nombre: "Pan para hamburguesa", categoria: "", unidad: "pza", nivelMinimo: 20, stockActual: 6, area: "Cocina Caliente", foto: "" },
  { id: "d5", nombre: "Pechuga marinada", categoria: "", unidad: "kg", nivelMinimo: 5, stockActual: 2, area: "Cocina Caliente", foto: "" },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

/* Lee el catálogo de PAR (misma base de datos, tabla propia) para poder importar productos a DÍA */
async function cargarProductosPar() {
  try {
    const val = await kvGet("par_items_v2", "kv_store");
    return val || [];
  } catch (e) {
    return [];
  }
}


function compressImage(file, maxSize = 260, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen inválida"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
        else if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function roundQty(qty, unidad) {
  if (["pza", "caja", "paquete", "porción"].includes(unidad)) return Math.ceil(qty);
  return Math.round(qty * 10) / 10;
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function seCuentaHoy(item, diaIndex) {
  if (!item.diasConteo || item.diasConteo.length === 0) return true;
  return item.diasConteo.includes(diaIndex);
}

function nivelEfectivo(item, diaIndex) {
  if (item.nivelMinimoAlto != null && item.nivelMinimoAlto !== "" && item.diasNivelAlto?.includes(diaIndex)) {
    return Number(item.nivelMinimoAlto);
  }
  return item.nivelMinimo;
}

function statusOf(item) {
  if (item.stockActual <= 0) return "critical";
  if (item.stockActual < item.nivelMinimo * 0.5) return "critical";
  if (item.stockActual < item.nivelMinimo) return "warn";
  return "ok";
}

const STATUS_STYLE = {
  ok: { color: C.ok, bg: C.okBg, label: "Al mínimo" },
  warn: { color: C.warn, bg: C.warnBg, label: "Por debajo" },
  critical: { color: C.critical, bg: C.criticalBg, label: "Crítico" },
};

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatFecha(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  } catch (e) {
    return "";
  }
}

/* Día calendario LOCAL (según el reloj del dispositivo), como "YYYY-MM-DD".
   OJO: no usar `new Date().toISOString().split("T")[0]` para esto — esa forma da el día en
   UTC, que en México (UTC-6) ya cambia de fecha desde las 6pm hora local. Eso hacía que el
   conteo del día, el candado por área y la lista de "Mañana" parecieran reiniciarse solos
   a media tarde/noche, sin que en realidad hubiera terminado el día del restaurante. Esta
   función siempre usa el reloj local del dispositivo (año/mes/día tal como los da `Date`
   sin pasar por ISO/UTC), tanto para "ahora" como para convertir una fecha guardada. */
function hoyLocalStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function appendHistorial(items, fecha, diaObjetivo) {
  try {
    let hist = [];
    try {
      const val = await kvGet("dia_historial_v1");
      hist = val || [];
    } catch (e) {
      hist = [];
    }
    const diaKey = hoyLocalStr(new Date(fecha)); // YYYY-MM-DD, día calendario LOCAL
    const entrada = {
      fecha,
      items: items.map((i) => ({
        nombre: i.nombre, unidad: i.unidad, categoria: i.categoria,
        area: i.area, nivelMinimo: nivelEfectivo(i, diaObjetivo), stockActual: i.stockActual,
        parKey: i.parKey || null,
      })),
    };
    // Si ya se guardó algo hoy (otra área, u otro guardado del mismo día), se reemplaza
    // esa entrada con la foto completa más reciente en vez de agregar una nueva — evita
    // contar el mismo día dos veces en los promedios de consumo.
    const idxHoy = hist.findIndex((h) => h.fecha && hoyLocalStr(new Date(h.fecha)) === diaKey);
    if (idxHoy >= 0) hist[idxHoy] = entrada;
    else hist.push(entrada);
    if (hist.length > 45) hist = hist.slice(hist.length - 45);
    await storageSetRetry("dia_historial_v1", hist);
  } catch (e) {
    /* no bloquea el guardado del conteo si el historial falla */
  }
}

/* ---------- Small UI atoms ---------- */
function Toast({ text }) {
  if (!text) return null;
  return (
    <div
      className="fixed left-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-sm"
      style={{ bottom: "88px", transform: "translateX(-50%)", background: C.accentDark, color: "#fff", fontFamily: "'Inter', sans-serif" }}
    >
      {text}
    </div>
  );
}

function StatusDot({ status }) {
  const s = STATUS_STYLE[status];
  return <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />;
}

function ItemThumb({ foto, size = 40 }) {
  return (
    <div
      className="flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size, background: C.bg, border: `1px solid ${C.line}` }}
    >
      {foto ? (
        <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Package size={size * 0.45} style={{ color: C.line }} />
      )}
    </div>
  );
}

function CategoriaBadge({ categoria }) {
  if (!categoria) return null;
  return (
    <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 10, fontWeight: 600, background: C.bg, color: C.inkSoft, border: `1px solid ${C.line}` }}>
      {categoria}
    </span>
  );
}

function DaySelector({ selected, onChange, colorOn = C.accent }) {
  function toggle(i) {
    if (selected.includes(i)) onChange(selected.filter((d) => d !== i));
    else onChange([...selected, i].sort());
  }
  return (
    <div className="flex gap-1.5">
      {DIAS.map((d, i) => (
        <button
          key={i}
          type="button"
          onClick={() => toggle(i)}
          className="flex-1 py-2 rounded-lg text-xs font-semibold"
          style={{
            background: selected.includes(i) ? colorOn : C.bg,
            color: selected.includes(i) ? "#fff" : C.inkSoft,
            border: `1px solid ${selected.includes(i) ? colorOn : C.line}`,
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

/* ---------- App ---------- */
export default function DiaInventario() {
  const [items, setItems] = useState(null);
  const [itemsUpdatedAt, setItemsUpdatedAt] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("conteo");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // Qué áreas ya guardaron avance / terminaron su conteo hoy — independiente del
  // catálogo de productos, para no mezclar ese guardado con el de "items".
  const [estadoAreas, setEstadoAreas] = useState({});
  const [estadoAreasUpdatedAt, setEstadoAreasUpdatedAt] = useState(null);
  // Último valor contado de cada producto ANTES de hoy (para avisar si un conteo de
  // hoy se ve como error de captura, p.ej. tecleado con un cero de más).
  const [historialReciente, setHistorialReciente] = useState(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const { value, updatedAt } = await kvGetConVersion("dia_areas_estado_v1");
        setEstadoAreas(value || {});
        setEstadoAreasUpdatedAt(updatedAt);
      } catch (e) {
        setEstadoAreas({});
      }
    })();
    (async () => {
      try {
        const hist = await kvGet("dia_historial_v1");
        const hoy = hoyLocalStr();
        const map = {};
        (hist || []).forEach((registro) => {
          const diaKey = registro.fecha ? hoyLocalStr(new Date(registro.fecha)) : "";
          if (!diaKey || diaKey >= hoy) return; // solo días anteriores a hoy
          (registro.items || []).forEach((it) => {
            const key = `${it.nombre.trim().toLowerCase()}|${it.unidad}`;
            const prev = map[key];
            if (!prev || diaKey > prev.diaKey) map[key] = { diaKey, stockActual: it.stockActual };
          });
        });
        setHistorialReciente(map);
      } catch (e) {
        setHistorialReciente({});
      }
    })();
  }, []);

  async function persistEstadoAreas(nuevoEstado) {
    const podado = podarPorFecha(nuevoEstado);
    setEstadoAreas(podado);
    const res = await storageSetRetryConVersion("dia_areas_estado_v1", podado, estadoAreasUpdatedAt);
    if (res.ok) {
      setEstadoAreasUpdatedAt(res.updatedAt);
      return res;
    }
    if (res.conflicto) {
      try {
        const fresh = await kvGetConVersion("dia_areas_estado_v1");
        if (fresh.value) {
          setEstadoAreas(fresh.value);
          setEstadoAreasUpdatedAt(fresh.updatedAt);
        }
      } catch (e) { /* se reintentará en el próximo guardado */ }
      return res;
    }
    showToast("No se pudo guardar el estado del área: " + (res.error?.message || "intenta de nuevo"));
    return res;
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  async function load() {
    setLoadError("");
    let ultimoError = null;
    for (let i = 0; i < 3; i++) {
      try {
        const { value, updatedAt } = await kvGetConVersion("dia_items_v1");
        if (value) {
          setItems(value);
          setItemsUpdatedAt(updatedAt);
        } else {
          const fecha = new Date().toISOString();
          await kvSet("dia_items_v1", SEED_ITEMS);
          setItems(SEED_ITEMS);
          setItemsUpdatedAt(fecha);
        }
        return;
      } catch (e) {
        ultimoError = e;
        if (i < 2) await sleep(600 * (i + 1));
      }
    }
    // Tras varios intentos no se pudo traer el inventario real: NO se muestran productos
    // de ejemplo en su lugar, porque si alguien contara y guardara sobre esos datos de
    // ejemplo, se sobrescribiría el catálogo real en Supabase. Mejor pedir reintentar.
    setLoadError(ultimoError?.message || "No se pudo conectar con el servidor.");
  }

  async function persist(newItems) {
    setItems(newItems);
    const res = await storageSetRetryConVersion("dia_items_v1", newItems, itemsUpdatedAt);
    if (res.ok) {
      setItemsUpdatedAt(res.updatedAt);
      return res;
    }
    if (res.conflicto) {
      // Otro dispositivo guardó algo distinto justo mientras esta pantalla tenía datos
      // más viejos: en vez de sobrescribirlo en silencio, se avisa y se trae lo más
      // reciente. Lo que se intentaba guardar aquí NO quedó guardado.
      showToast("Alguien más acaba de guardar cambios aquí. Se actualizó la información — revisa e intenta de nuevo.");
      try {
        const fresh = await kvGetConVersion("dia_items_v1");
        if (fresh.value) {
          setItems(fresh.value);
          setItemsUpdatedAt(fresh.updatedAt);
        }
      } catch (e) { /* si tampoco se puede releer, se deja como está y se reintentará en el próximo guardado */ }
      return res;
    }
    showToast("No se pudo guardar tras varios intentos: " + (res.error?.message || "error desconocido"));
    return res;
  }

  if (loadError) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: C.bg }}>
        <AlertTriangle size={32} style={{ color: C.critical, marginBottom: 12 }} />
        <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>No se pudo cargar el inventario</p>
        <p style={{ fontSize: 13, color: C.inkSoft, marginBottom: 18 }}>
          Revisa tu conexión a internet e intenta de nuevo. No se muestra información de ejemplo para evitar guardarla por error sobre tu inventario real.
        </p>
        <button onClick={load} className="px-5 py-2.5 rounded-xl font-semibold text-sm" style={{ background: C.accent, color: "#fff" }}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="w-full h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <Loader2 className="animate-spin" size={28} style={{ color: C.accent }} />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ background: C.bg, fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <Header />

      <main className="flex-1 overflow-y-auto pb-24" style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
        {tab === "conteo" && (
          <ConteoTab
            items={items}
            onSave={persist}
            showToast={showToast}
            estadoAreas={estadoAreas}
            onSaveEstadoAreas={persistEstadoAreas}
            historialReciente={historialReciente}
          />
        )}
        {tab === "inventario" && <InventarioTab items={items} onSave={persist} showToast={showToast} />}
        {tab === "pendientes" && (
          <PendientesTab
            items={items}
            estadoAreas={estadoAreas}
            historialReciente={historialReciente}
            onSaveEstadoAreas={persistEstadoAreas}
          />
        )}
        {tab === "historial" && <HistorialTab items={items} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} items={items} />
      <Toast text={toast} />
    </div>
  );
}

function Header() {
  const today = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return (
    <header className="px-5 pt-6 pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-baseline justify-between">
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: "0.5px" }}>
          DÍA
        </h1>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkSoft, textTransform: "capitalize" }}>
          {today}
        </span>
      </div>
      <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Conteo diario de perecederos</p>
    </header>
  );
}

function BottomNav({ tab, setTab, items }) {
  const diaManana = (new Date().getDay() + 1) % 7;
  const pendientes = items.filter((i) => i.stockActual < nivelEfectivo(i, diaManana)).length;
  const NavBtn = ({ id, icon: Icon, label, badge }) => {
    const active = tab === id;
    return (
      <button onClick={() => setTab(id)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative" style={{ color: active ? C.accent : C.inkSoft }}>
        <div className="relative">
          <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
          {badge > 0 && (
            <span className="absolute -top-1.5 -right-2 flex items-center justify-center rounded-full" style={{ minWidth: 15, height: 15, fontSize: 9, background: C.critical, color: "#fff", padding: "0 3px", fontFamily: "'IBM Plex Mono', monospace" }}>
              {badge}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: active ? 600 : 500 }}>{label}</span>
      </button>
    );
  };
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex" style={{ background: C.paper, borderTop: `1px solid ${C.line}`, maxWidth: 640, margin: "0 auto" }}>
      <NavBtn id="conteo" icon={ClipboardList} label="Conteo" />
      <NavBtn id="inventario" icon={Package} label="Inventario" />
      <NavBtn id="pendientes" icon={ChefHat} label="Mañana" badge={pendientes} />
      <NavBtn id="historial" icon={TrendingUp} label="Historial" />
    </nav>
  );
}

/* ---------- CONTEO TAB ---------- */
function ConteoTab({ items, onSave, showToast, estadoAreas, onSaveEstadoAreas, historialReciente }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.stockActual])));
  const [query, setQuery] = useState("");
  const [areaActual, setAreaActual] = useState(undefined);
  const [cambiandoArea, setCambiandoArea] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [confirmFinalizar, setConfirmFinalizar] = useState(false);
  const [confirmReabrir, setConfirmReabrir] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);

  const hayCambios = items.some((i) => {
    const val = draft[i.id];
    return val !== undefined && val !== i.stockActual;
  });

  useEffect(() => {
    setDraft(Object.fromEntries(items.map((i) => [i.id, i.stockActual])));
  }, [items]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dia_area_actual");
      setAreaActual(saved || null);
    } catch (e) {
      setAreaActual(null);
    }
  }, []);

  async function elegirArea(area) {
    setAreaActual(area);
    setCambiandoArea(false);
    try { localStorage.setItem("dia_area_actual", area); } catch (e) {}
  }

  const areasDisponibles = useMemo(() => Array.from(new Set(items.map((i) => i.area).filter(Boolean))), [items]);
  const sinArea = items.some((i) => !i.area);

  const diaHoy = new Date().getDay();
  const diaManana = (diaHoy + 1) % 7;
  const hoyStr = hoyLocalStr();

  const itemsDelArea = useMemo(() => {
    if (areaActual === "__todas__") return items;
    if (areaActual === "__sinArea__") return items.filter((i) => !i.area);
    return items.filter((i) => i.area === areaActual);
  }, [items, areaActual]);

  const itemsDeHoy = useMemo(() => itemsDelArea.filter((i) => seCuentaHoy(i, diaHoy)), [itemsDelArea, diaHoy]);
  const noAplicanHoy = itemsDelArea.length - itemsDeHoy.length;

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return itemsDeHoy.filter((i) => !q || i.nombre.toLowerCase().includes(q));
  }, [itemsDeHoy, query]);

  const subareas = useMemo(() => {
    const set = new Set(filtrados.map((i) => i.subarea?.trim() || "Sin subárea"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [filtrados]);

  const grouped = useMemo(() => {
    const map = {};
    filtrados.forEach((i) => {
      const sub = i.subarea?.trim() || "Sin subárea";
      map[sub] = map[sub] || [];
      map[sub].push(i);
    });
    return map;
  }, [filtrados]);

  // Solo las áreas reales (no las vistas "todas las áreas" / "sin área", que son para
  // encargados que revisan varias a la vez) tienen guardado parcial/final y bloqueo.
  const esAreaReal = !!areaActual && areaActual !== "__todas__" && areaActual !== "__sinArea__";
  const estadoHoyArea = esAreaReal ? estadoAreas?.[hoyStr]?.[areaActual] : null;
  const finalizada = !!estadoHoyArea?.finalizado;

  function setVal(id, val) {
    if (finalizada) return;
    setDraft((d) => ({ ...d, [id]: Math.max(0, val) }));
    setGuardado(false);
  }

  async function guardar(finalizar) {
    setGuardando(true);
    const fecha = new Date().toISOString();
    const updated = items.map((i) => {
      const nuevoStock = draft[i.id] ?? i.stockActual;
      const cambio = nuevoStock !== i.stockActual;
      // Solo se marca "última actualización" en lo que de verdad se contó ahora —
      // antes se pisaba la fecha de TODOS los productos aunque no se hubieran tocado.
      return cambio ? { ...i, stockActual: nuevoStock, ultimaActualizacion: fecha } : i;
    });
    const res = await onSave(updated);
    if (!res?.ok) {
      // Antes se mostraba "Conteo de hoy guardado" sin esperar esta confirmación.
      // Ahora, si el guardado real falló, se avisa y NO se marca como guardado.
      setGuardando(false);
      // Si fue un conflicto con otro dispositivo, onSave ya mostró un aviso más claro —
      // no lo tapamos con este mensaje genérico.
      if (!res?.conflicto) showToast("No se pudo guardar el conteo: " + (res?.error?.message || "intenta de nuevo"));
      return;
    }
    await appendHistorial(updated, fecha, diaManana);

    // Si es un área real, además dejamos constancia de que avanzó / terminó su conteo hoy,
    // para el indicador de la pestaña de Pendientes.
    if (esAreaReal && onSaveEstadoAreas) {
      const nuevoEstado = {
        ...(estadoAreas || {}),
        [hoyStr]: {
          ...(estadoAreas?.[hoyStr] || {}),
          [areaActual]: {
            finalizado: !!finalizar,
            finalizadoEn: finalizar ? fecha : (estadoHoyArea?.finalizadoEn || null),
            actualizadoEn: fecha,
          },
        },
      };
      await onSaveEstadoAreas(nuevoEstado);
    }

    setGuardando(false);
    setGuardado(true);
    setConfirmFinalizar(false);
    showToast(finalizar ? "Conteo de hoy finalizado" : "Avance guardado");
  }

  async function reabrir() {
    if (!esAreaReal || !onSaveEstadoAreas) { setConfirmReabrir(false); return; }
    setReabriendo(true);
    const nuevoEstado = {
      ...(estadoAreas || {}),
      [hoyStr]: {
        ...(estadoAreas?.[hoyStr] || {}),
        [areaActual]: { ...(estadoHoyArea || {}), finalizado: false },
      },
    };
    await onSaveEstadoAreas(nuevoEstado);
    setReabriendo(false);
    setConfirmReabrir(false);
    setGuardado(false);
    showToast("Conteo reabierto para corregir");
  }

  if (areaActual === undefined) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" size={22} style={{ color: C.accent }} /></div>;
  }

  if (areaActual === null || cambiandoArea) {
    return (
      <AreaPicker
        areas={areasDisponibles}
        sinArea={sinArea}
        onElegir={elegirArea}
        onCancelar={areaActual && cambiandoArea ? () => setCambiandoArea(false) : null}
        estadoAreas={estadoAreas}
        hoyStr={hoyStr}
      />
    );
  }

  const nombreAreaActual = areaActual === "__todas__" ? "Todas las áreas" : areaActual === "__sinArea__" ? "Sin área asignada" : areaActual;

  return (
    <div className="px-5 pt-4">
      <button onClick={() => setCambiandoArea(true)} className="w-full flex items-center justify-between px-4 py-3 mb-3 rounded-xl" style={{ background: finalizada ? C.ok : C.accent, color: "#fff" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Contando: {nombreAreaActual}</span>
        <span style={{ fontSize: 12, textDecoration: "underline" }}>Cambiar área</span>
      </button>

      {finalizada && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 mb-3 rounded-xl" style={{ background: C.okBg, border: `1px solid ${C.ok}` }}>
          <div className="flex items-center gap-2 min-w-0">
            <Lock size={15} style={{ color: C.ok, flexShrink: 0 }} />
            <div className="min-w-0">
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ok }}>Conteo de hoy terminado</div>
              {estadoHoyArea?.finalizadoEn && (
                <div style={{ fontSize: 10.5, color: C.inkSoft }}>{formatFecha(estadoHoyArea.finalizadoEn)}</div>
              )}
            </div>
          </div>
          <button onClick={() => setConfirmReabrir(true)} className="px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: C.paper, border: `1px solid ${C.ok}`, color: C.ok, fontSize: 12, fontWeight: 600 }}>
            Corregir conteo
          </button>
        </div>
      )}

      <div className="relative mb-3">
        <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: C.inkSoft }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto..." className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}`, background: C.paper }} />
      </div>

      {noAplicanHoy > 0 && (
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 10 }}>
          {noAplicanHoy} producto{noAplicanHoy === 1 ? "" : "s"} no se cuenta{noAplicanHoy === 1 ? "" : "n"} hoy ({DIAS[diaHoy]}).
        </p>
      )}

      {subareas.filter((sub) => grouped[sub]?.length).map((sub) => (
        <div key={sub} className="mb-3 rounded-2xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between px-4 py-3">
            <span style={{ fontWeight: 600, fontSize: 14 }}>{sub}</span>
            <span style={{ fontSize: 12, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{grouped[sub].length}</span>
          </div>
          <div>
            {grouped[sub].map((item, idx) => {
              const val = draft[item.id] ?? 0;
              const minimoManana = nivelEfectivo(item, diaManana);
              const status = statusOf({ ...item, stockActual: val, nivelMinimo: minimoManana });
              const s = STATUS_STYLE[status];
              // Aviso de posible error de captura: comparamos con el último conteo registrado
              // ANTES de hoy. Si hoy se anotó de golpe 3 veces o más esa cantidad (con al menos
              // 2 unidades de diferencia), probablemente se tecleó de más — no bloquea, solo avisa.
              const prevInfo = historialReciente?.[`${item.nombre.trim().toLowerCase()}|${item.unidad}`];
              const esPosibleError = !!prevInfo && val >= prevInfo.stockActual * 3 && (val - prevInfo.stockActual) >= 2;
              return (
                <div key={item.id} className="px-4 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  <div className="flex items-center gap-3">
                    <ItemThumb foto={item.foto} size={44} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{item.nombre}</div>
                      <div className="flex items-center gap-1.5">
                        <CategoriaBadge categoria={item.categoria} />
                        <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {item.unidad}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setVal(item.id, roundStep(val, item.unidad, -1))} disabled={finalizada} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.line}`, opacity: finalizada ? 0.4 : 1 }}>
                        <Minus size={13} />
                      </button>
                      <input
                        type="number" inputMode="decimal" value={val}
                        onChange={(e) => setVal(item.id, parseFloat(e.target.value) || 0)}
                        disabled={finalizada}
                        className="text-center rounded-lg py-1"
                        style={{ width: 56, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 14, border: `1px solid ${C.line}`, background: s.bg, color: s.color, opacity: finalizada ? 0.6 : 1 }}
                      />
                      <button onClick={() => setVal(item.id, roundStep(val, item.unidad, 1))} disabled={finalizada} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.line}`, opacity: finalizada ? 0.4 : 1 }}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  {esPosibleError && (
                    <div className="flex items-center gap-1.5 mt-1.5" style={{ marginLeft: 56, fontSize: 10.5, color: C.warn }}>
                      <AlertTriangle size={11} /> Revisa esta cantidad: el conteo anterior fue {fmtNum(prevInfo.stockActual)} {item.unidad}.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {filtrados.length === 0 && (
        <p className="text-center py-10" style={{ color: C.inkSoft, fontSize: 14 }}>
          No hay productos diarios asignados a esta área. Ve a Inventario y agrégalos.
        </p>
      )}

      {esAreaReal && !finalizada && (hayCambios || guardando) && (
        <div className="fixed left-1/2 flex items-center gap-2" style={{ bottom: 76, transform: "translateX(-50%)" }}>
          <button
            onClick={() => guardar(false)}
            disabled={guardando}
            className="flex items-center gap-1.5 px-4 py-3 rounded-full shadow-lg"
            style={{ background: C.paper, border: `1px solid ${C.accent}`, color: C.accent, fontWeight: 600, fontSize: 13, opacity: guardando ? 0.85 : 1 }}
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Guardar avance
          </button>
          <button
            onClick={() => setConfirmFinalizar(true)}
            disabled={guardando}
            className="flex items-center gap-1.5 px-4 py-3 rounded-full shadow-lg"
            style={{ background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, opacity: guardando ? 0.85 : 1 }}
          >
            <Check size={15} /> Terminar conteo
          </button>
        </div>
      )}

      {!esAreaReal && (hayCambios || guardando) && (
        <button
          onClick={() => guardar(false)}
          disabled={guardando}
          className="fixed left-1/2 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg"
          style={{ bottom: 76, transform: "translateX(-50%)", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 14, opacity: guardando ? 0.85 : 1 }}
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {guardando ? "Guardando..." : "Guardar conteo de hoy"}
        </button>
      )}

      {guardado && !hayCambios && !guardando && !finalizada && (
        <div
          className="fixed left-1/2 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg"
          style={{ bottom: 76, transform: "translateX(-50%)", background: C.ok, color: "#fff", fontWeight: 600, fontSize: 14 }}
        >
          <Check size={16} /> Guardado
        </div>
      )}

      {confirmFinalizar && (
        <ConfirmAccion
          text="¿Terminar el conteo de esta área? Se guardará como completo y quedará bloqueada para editar. Si hace falta, después puedes usar «Corregir conteo» para volver a abrirla."
          confirmLabel="Terminar conteo"
          confirmColor={C.accent}
          onCancel={() => setConfirmFinalizar(false)}
          onConfirm={() => guardar(true)}
        />
      )}

      {confirmReabrir && (
        <ConfirmAccion
          text="¿Corregir el conteo de esta área? Se desbloqueará para que puedas editarla de nuevo."
          confirmLabel={reabriendo ? "Reabriendo..." : "Corregir conteo"}
          confirmColor={C.warn}
          onCancel={() => setConfirmReabrir(false)}
          onConfirm={reabrir}
        />
      )}
    </div>
  );
}

function roundStep(val, unidad, dir) {
  const step = ["pza", "caja", "paquete", "porción"].includes(unidad) ? 1 : 0.5;
  return Math.max(0, Math.round((val + dir * step) * 10) / 10);
}

function AreaPicker({ areas, sinArea, onElegir, onCancelar, estadoAreas, hoyStr }) {
  const hoy = hoyStr || hoyLocalStr();
  return (
    <div className="px-5 pt-8">
      <div className="text-center mb-6">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>¿En qué área trabajas?</h2>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Elige tu área para contar solo tus perecederos.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {areas.map((a) => {
          const estado = estadoAreas?.[hoy]?.[a];
          const terminada = !!estado?.finalizado;
          const enProgreso = !terminada && !!estado?.actualizadoEn;
          const colorEstado = terminada ? C.ok : enProgreso ? C.warn : C.critical;
          return (
            <button key={a} onClick={() => onElegir(a)} className="w-full py-4 rounded-2xl text-left px-5 flex items-center justify-between" style={{ background: C.paper, border: `1.5px solid ${colorEstado}` }}>
              <div className="min-w-0 flex items-center gap-2.5">
                <span className="rounded-full flex-shrink-0" style={{ width: 9, height: 9, background: colorEstado }} />
                <div className="min-w-0">
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{a}</span>
                  {terminada && (
                    <div className="flex items-center gap-1 mt-0.5" style={{ fontSize: 11, color: C.ok, fontWeight: 600 }}>
                      <Check size={12} /> Conteo terminado
                    </div>
                  )}
                  {enProgreso && (
                    <div style={{ fontSize: 11, color: C.warn, fontWeight: 600, marginTop: 2 }}>En progreso</div>
                  )}
                  {!terminada && !enProgreso && (
                    <div style={{ fontSize: 11, color: C.critical, fontWeight: 600, marginTop: 2 }}>Sin iniciar</div>
                  )}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: C.inkSoft, flexShrink: 0 }} />
            </button>
          );
        })}
        {sinArea && (
          <button onClick={() => onElegir("__sinArea__")} className="w-full py-4 rounded-2xl text-left px-5 flex items-center justify-between" style={{ background: C.paper, border: `1px dashed ${C.line}` }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: C.inkSoft }}>Sin área asignada</span>
            <ChevronRight size={18} style={{ color: C.inkSoft }} />
          </button>
        )}
        <button onClick={() => onElegir("__todas__")} className="w-full py-3.5 rounded-2xl text-center mt-1" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.inkSoft, fontSize: 13, fontWeight: 500 }}>
          Ver todas las áreas (encargados)
        </button>
        {onCancelar && <button onClick={onCancelar} className="w-full py-2 text-center" style={{ fontSize: 13, color: C.inkSoft }}>Cancelar</button>}
      </div>
    </div>
  );
}

/* ---------- INVENTARIO TAB ---------- */
function InventarioTab({ items, onSave, showToast }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = items.filter((i) => i.nombre.toLowerCase().includes(query.trim().toLowerCase()));

  async function upsert(item) {
    const esNuevo = !item.id;
    const nuevaLista = esNuevo
      ? [...items, { ...item, id: uid() }]
      : items.map((i) => (i.id === item.id ? { ...i, ...item } : i));
    // Antes se mostraba "Producto actualizado/agregado" de inmediato, sin esperar a que
    // Supabase confirmara. Ahora se espera esa confirmación antes de avisar y cerrar el
    // formulario, para no perder lo capturado si el guardado falla o hay un conflicto.
    const res = await onSave(nuevaLista);
    if (!res?.ok) {
      if (!res?.conflicto) showToast("No se pudo guardar el producto: " + (res?.error?.message || "intenta de nuevo"));
      return;
    }
    showToast(esNuevo ? "Producto agregado" : "Producto actualizado");
    setShowForm(false);
    setEditing(null);
  }

  async function remove(id) {
    const res = await onSave(items.filter((i) => i.id !== id));
    setConfirmDelete(null);
    if (!res?.ok) {
      if (!res?.conflicto) showToast("No se pudo eliminar el producto: " + (res?.error?.message || "intenta de nuevo"));
      return;
    }
    showToast("Producto eliminado");
  }

  return (
    <div className="px-5 pt-4">
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: C.inkSoft }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}`, background: C.paper }} />
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 px-4 rounded-xl text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {filtered.map((item) => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <ItemThumb foto={item.foto} size={44} />
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 14, fontWeight: 500 }}>{item.nombre}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                {item.categoria || "Sin categoría"} · Mín {fmtNum(item.nivelMinimo)} {item.unidad}{item.area ? ` · ${item.area}` : ""}{item.subarea ? ` · ${item.subarea}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span style={{ fontSize: 10, color: C.inkSoft }}>
                {item.diasConteo?.length ? `Se cuenta: ${item.diasConteo.map((d) => DIAS[d]).join(", ")}` : "Se cuenta: todos los días"}
              </span>
              {item.nivelMinimoAlto != null && item.nivelMinimoAlto !== "" && (
                <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 10, fontWeight: 600, background: C.warnBg, color: C.warn }}>
                  +{fmtNum(Number(item.nivelMinimoAlto))} {item.diasNivelAlto?.map((d) => DIAS[d]).join("/")}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => { setEditing(item); setShowForm(true); }} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: C.bg }}>
            <Pencil size={14} style={{ color: C.inkSoft }} />
          </button>
          <button onClick={() => setConfirmDelete(item.id)} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: C.criticalBg }}>
            <Trash2 size={14} style={{ color: C.critical }} />
          </button>
        </div>
      ))}

      {filtered.length === 0 && <p className="text-center py-10" style={{ color: C.inkSoft, fontSize: 14 }}>Sin resultados.</p>}

      {showForm && (
        <ItemForm
          initial={editing}
          categorias={Array.from(new Set([...CATEGORIAS_DEFAULT, ...items.map((i) => i.categoria)]))}
          areas={Array.from(new Set([...AREAS_DEFAULT, ...items.map((i) => i.area).filter(Boolean)]))}
          subareas={Array.from(new Set(items.map((i) => i.subarea?.trim()).filter(Boolean)))}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSubmit={upsert}
        />
      )}

      {confirmDelete && (
        <ConfirmSheet text="¿Eliminar este producto del conteo diario? Esta acción no se puede deshacer." onCancel={() => setConfirmDelete(null)} onConfirm={() => remove(confirmDelete)} />
      )}
    </div>
  );
}

function ItemForm({ initial, categorias, areas, subareas, onCancel, onSubmit }) {
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [categoria, setCategoria] = useState(initial?.categoria || categorias[0] || "");
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [unidad, setUnidad] = useState(initial?.unidad || "kg");
  const [nivelMinimo, setNivelMinimo] = useState(initial?.nivelMinimo ?? "");
  const [diasConteo, setDiasConteo] = useState(initial?.diasConteo || []);
  const [tieneNivelAlto, setTieneNivelAlto] = useState(!!(initial?.nivelMinimoAlto != null && initial?.nivelMinimoAlto !== ""));
  const [nivelMinimoAlto, setNivelMinimoAlto] = useState(initial?.nivelMinimoAlto ?? "");
  const [diasNivelAlto, setDiasNivelAlto] = useState(initial?.diasNivelAlto || []);
  const initialAreaValue = initial?.area?.trim() ? (areas.includes(initial.area.trim()) ? initial.area.trim() : "__nuevaArea__") : "__ningunaArea__";
  const [area, setArea] = useState(initialAreaValue);
  const [areaNueva, setAreaNueva] = useState(initialAreaValue === "__nuevaArea__" ? initial.area.trim() : "");
  const initialSubareaValue = initial?.subarea?.trim() ? (subareas.includes(initial.subarea.trim()) ? initial.subarea.trim() : "__nuevaSubarea__") : "__ningunaSubarea__";
  const [subarea, setSubarea] = useState(initialSubareaValue);
  const [subareaNueva, setSubareaNueva] = useState(initialSubareaValue === "__nuevaSubarea__" ? initial.subarea.trim() : "");
  const [foto, setFoto] = useState(initial?.foto || "");
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState("");
  const [showImportarPar, setShowImportarPar] = useState(false);
  const [parKey, setParKey] = useState(initial?.parKey || "");
  const [tieneReceta, setTieneReceta] = useState(!!(initial?.receta && initial.receta.length > 0));
  const [receta, setReceta] = useState(initial?.receta || []);
  const [showAgregarIngrediente, setShowAgregarIngrediente] = useState(false);

  function importarDesdeParItem(producto) {
    if (!initial) {
      setNombre(producto.nombre);
      setCategoria(producto.categoria || "");
      setUnidad(producto.unidad || "kg");
      setFoto(producto.foto || "");
      if (producto.subarea) {
        if (subareas.includes(producto.subarea.trim())) {
          setSubarea(producto.subarea.trim());
        } else {
          setSubarea("__nuevaSubarea__");
          setSubareaNueva(producto.subarea.trim());
        }
      }
    }
    setParKey(`${producto.nombre.trim().toLowerCase()}|${producto.unidad}`);
    setShowImportarPar(false);
  }

  function agregarIngrediente(producto) {
    const yaEsta = receta.some((r) => r.ingredienteParKey === `${producto.nombre.trim().toLowerCase()}|${producto.unidad}`);
    if (yaEsta) { setShowAgregarIngrediente(false); return; }
    setReceta((r) => [...r, {
      ingredienteParKey: `${producto.nombre.trim().toLowerCase()}|${producto.unidad}`,
      nombre: producto.nombre,
      unidad: producto.unidad,
      cantidadPorUnidad: "",
    }]);
    setShowAgregarIngrediente(false);
  }

  function actualizarCantidadIngrediente(idx, cantidad) {
    setReceta((r) => r.map((ing, i) => (i === idx ? { ...ing, cantidadPorUnidad: cantidad } : ing)));
  }

  function quitarIngrediente(idx) {
    setReceta((r) => r.filter((_, i) => i !== idx));
  }

  async function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    // Antes se intentaba leer y procesar cualquier archivo elegido sin revisar primero
    // qué es ni qué tan pesado es — esto rechaza de una vez lo que claramente no sirve,
    // antes de gastar tiempo (y memoria del celular) intentando procesarlo.
    if (!file.type || !file.type.startsWith("image/")) {
      setError("Ese archivo no es una foto. Elige una imagen (jpg, png, etc.).");
      e.target.value = "";
      return;
    }
    const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024; // 15 MB: de sobra para una foto de celular
    if (file.size > MAX_ORIGINAL_BYTES) {
      setError("Esa foto pesa demasiado (más de 15 MB). Intenta con otra.");
      e.target.value = "";
      return;
    }
    setSubiendoFoto(true);
    try {
      let dataUrl = await compressImage(file, 260, 0.6);
      if (dataUrl.length > 180000) dataUrl = await compressImage(file, 180, 0.45);
      if (dataUrl.length > 180000) setError("La foto sigue muy pesada, intenta con otra.");
      else setFoto(dataUrl);
    } catch (err) {
      setError("No se pudo procesar la foto, intenta con otra.");
    }
    setSubiendoFoto(false);
    e.target.value = "";
  }

  function submit() {
    const cat = categoria === "__nueva__" ? categoriaNueva.trim() : categoria;
    let ar = "";
    if (area === "__nuevaArea__") ar = areaNueva.trim();
    else if (area !== "__ningunaArea__") ar = area;
    let sub = "";
    if (subarea === "__nuevaSubarea__") sub = subareaNueva.trim();
    else if (subarea !== "__ningunaSubarea__") sub = subarea;

    if (!nombre.trim()) return setError("Ponle un nombre al producto.");
    if (!cat) return setError("Elige o escribe una categoría.");
    if (nivelMinimo === "" || isNaN(nivelMinimo) || Number(nivelMinimo) < 0) return setError("El mínimo debe ser un número válido.");
    if (area === "__nuevaArea__" && !ar) return setError("Escribe el nombre del área nueva.");
    if (subarea === "__nuevaSubarea__" && !sub) return setError("Escribe el nombre de la subárea nueva.");
    if (tieneNivelAlto && (nivelMinimoAlto === "" || isNaN(nivelMinimoAlto) || Number(nivelMinimoAlto) < 0)) return setError("El nivel alto debe ser un número válido.");
    if (tieneNivelAlto && diasNivelAlto.length === 0) return setError("Elige en qué días aplica el nivel alto.");
    if (tieneReceta && receta.length === 0) return setError("Agrega al menos un ingrediente, o desactiva \"Se elabora aquí\".");
    if (tieneReceta && receta.some((ing) => ing.cantidadPorUnidad === "" || isNaN(ing.cantidadPorUnidad) || Number(ing.cantidadPorUnidad) <= 0)) {
      return setError("Todos los ingredientes necesitan una cantidad válida.");
    }
    onSubmit({
      id: initial?.id, nombre: nombre.trim(), categoria: cat, unidad,
      nivelMinimo: Number(nivelMinimo), stockActual: initial?.stockActual ?? 0,
      area: ar, subarea: sub, foto,
      diasConteo,
      nivelMinimoAlto: tieneNivelAlto ? Number(nivelMinimoAlto) : "",
      diasNivelAlto: tieneNivelAlto ? diasNivelAlto : [],
      parKey,
      receta: tieneReceta ? receta.map((ing) => ({ ...ing, cantidadPorUnidad: Number(ing.cantidadPorUnidad) })) : [],
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end" style={{ background: "rgba(34,31,26,0.4)" }} onClick={onCancel}>
      <div className="w-full rounded-t-3xl p-5" style={{ background: C.paper, maxWidth: 640, margin: "0 auto", maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>{initial ? "Editar producto" : "Nuevo producto"}</h2>
          <button onClick={onCancel}><X size={20} style={{ color: C.inkSoft }} /></button>
        </div>

        <button
          onClick={() => setShowImportarPar(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 mb-2 rounded-xl text-sm font-semibold"
          style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.okBg }}
        >
          <Package size={15} /> {parKey ? "Cambiar vínculo con PAR" : "Importar / vincular con PAR"}
        </button>
        {parKey && (
          <p style={{ fontSize: 11, color: C.ok, marginBottom: 12 }}>
            ✓ Vinculado — su consumo diario se restará del inventario teórico de PAR.
          </p>
        )}

        <div className="flex items-center justify-between mb-2">
          <label style={{ ...fieldLabel, marginBottom: 0 }}>¿Se elabora aquí? (tiene receta)</label>
          <button
            type="button"
            onClick={() => setTieneReceta((v) => !v)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: tieneReceta ? C.accent : C.bg, color: tieneReceta ? "#fff" : C.inkSoft, border: `1px solid ${C.line}` }}
          >
            {tieneReceta ? "Sí" : "No"}
          </button>
        </div>
        {tieneReceta && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
            <p style={{ fontSize: 11, color: C.inkSoft, marginBottom: 10 }}>
              Ingredientes necesarios por cada 1 {unidad} de {nombre || "este producto"}. Si falta producir, se te van a mostrar los ingredientes que hay que sacar de PAR.
            </p>
            {receta.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {receta.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="flex-1 text-sm" style={{ color: C.ink }}>{ing.nombre}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={ing.cantidadPorUnidad}
                      onChange={(e) => actualizarCantidadIngrediente(idx, e.target.value)}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 rounded-lg text-sm text-center"
                      style={{ ...fieldInput, background: C.paper }}
                    />
                    <span style={{ fontSize: 11, color: C.inkSoft, width: 30 }}>{ing.unidad}</span>
                    <button onClick={() => quitarIngrediente(idx)}>
                      <X size={14} style={{ color: C.critical }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowAgregarIngrediente(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
              style={{ border: `1px dashed ${C.accent}`, color: C.accent }}
            >
              <Plus size={13} /> Agregar ingrediente de PAR
            </button>
          </div>
        )}

        <label style={fieldLabel}>Foto del producto</label>
        <div className="flex items-center gap-3 mb-4">
          <ItemThumb foto={foto} size={64} />
          <div className="flex-1 flex flex-col gap-2">
            <label className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ border: `1px solid ${C.line}`, background: C.bg }}>
              {subiendoFoto ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              {foto ? "Cambiar foto" : "Tomar / subir foto"}
              <input type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
            </label>
            {foto && <button onClick={() => setFoto("")} className="text-xs" style={{ color: C.critical }}>Quitar foto</button>}
          </div>
        </div>

        <label style={fieldLabel}>Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm" style={fieldInput} placeholder="Ej. Jitomate picado" />

        <label style={fieldLabel}>Categoría</label>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm" style={fieldInput}>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__nueva__">+ Nueva categoría...</option>
        </select>
        {categoria === "__nueva__" && (
          <input value={categoriaNueva} onChange={(e) => setCategoriaNueva(e.target.value)} placeholder="Nombre de la categoría" className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm" style={fieldInput} />
        )}

        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label style={fieldLabel}>Unidad</label>
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldInput}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label style={fieldLabel}>Mínimo para mañana</label>
            <input type="number" inputMode="decimal" value={nivelMinimo} onChange={(e) => setNivelMinimo(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldInput} placeholder="0" />
          </div>
        </div>

        <label style={fieldLabel}>¿Qué días se cuenta este producto?</label>
        <div className="mb-1">
          <DaySelector selected={diasConteo} onChange={setDiasConteo} />
        </div>
        <p style={{ fontSize: 11, color: C.inkSoft, marginBottom: 12 }}>
          {diasConteo.length === 0 ? "Sin marcar días = se cuenta todos los días." : `Se cuenta solo: ${diasConteo.map((d) => DIAS[d]).join(", ")}.`}
        </p>

        <div className="flex items-center justify-between mb-2">
          <label style={{ ...fieldLabel, marginBottom: 0 }}>¿Necesita más en algunos días?</label>
          <button
            type="button"
            onClick={() => setTieneNivelAlto((v) => !v)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: tieneNivelAlto ? C.accent : C.bg, color: tieneNivelAlto ? "#fff" : C.inkSoft, border: `1px solid ${C.line}` }}
          >
            {tieneNivelAlto ? "Sí" : "No"}
          </button>
        </div>
        {tieneNivelAlto && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
            <label style={fieldLabel}>Nivel mínimo alto</label>
            <input type="number" inputMode="decimal" value={nivelMinimoAlto} onChange={(e) => setNivelMinimoAlto(e.target.value)} className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm" style={{ ...fieldInput, background: C.paper }} placeholder="Ej. 10" />
            <label style={fieldLabel}>¿En qué días aplica?</label>
            <DaySelector selected={diasNivelAlto} onChange={setDiasNivelAlto} colorOn={C.warn} />
          </div>
        )}

        <label style={fieldLabel}>Área</label>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full mb-1 px-3 py-2.5 rounded-xl text-sm" style={fieldInput}>
          <option value="__ningunaArea__">Sin área asignada</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          <option value="__nuevaArea__">+ Nueva área...</option>
        </select>
        {area === "__nuevaArea__" && (
          <input value={areaNueva} onChange={(e) => setAreaNueva(e.target.value)} placeholder="Nombre del área" className="w-full mb-4 px-3 py-2.5 rounded-xl text-sm" style={fieldInput} />
        )}

        <label style={fieldLabel}>Subárea (ubicación dentro del área)</label>
        <select value={subarea} onChange={(e) => setSubarea(e.target.value)} className="w-full mb-1 px-3 py-2.5 rounded-xl text-sm" style={fieldInput}>
          <option value="__ningunaSubarea__">Sin subárea asignada</option>
          {subareas.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="__nuevaSubarea__">+ Nueva subárea...</option>
        </select>
        {subarea === "__nuevaSubarea__" && (
          <input value={subareaNueva} onChange={(e) => setSubareaNueva(e.target.value)} placeholder="Ej. Refrigerador 1, Anaquel..." className="w-full mb-1 px-3 py-2.5 rounded-xl text-sm" style={fieldInput} />
        )}
        <p style={{ fontSize: 11, color: C.inkSoft, marginBottom: 12 }}>
          {parKey
            ? "Se rellenó como referencia desde PAR — cámbiala si en la práctica se ubica distinto en DÍA."
            : "Dónde se encuentra el producto dentro del área, para organizar el conteo."}
        </p>

        {error && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: C.criticalBg, color: C.critical, fontSize: 13 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <button onClick={submit} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ background: C.accent, color: "#fff" }}>
          {initial ? "Guardar cambios" : "Agregar producto"}
        </button>
      </div>

      {showImportarPar && (
        <ImportarParModal onCerrar={() => setShowImportarPar(false)} onElegir={importarDesdeParItem} />
      )}
      {showAgregarIngrediente && (
        <ImportarParModal onCerrar={() => setShowAgregarIngrediente(false)} onElegir={agregarIngrediente} titulo="Agregar ingrediente" />
      )}
    </div>
  );
}

function ImportarParModal({ onCerrar, onElegir, titulo = "Importar desde PAR" }) {
  const [productos, setProductos] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => setProductos(await cargarProductosPar()))();
  }, []);

  const unicos = useMemo(() => {
    if (!productos) return [];
    const map = {};
    productos.forEach((p) => {
      const key = p.nombre.trim().toLowerCase();
      if (!map[key]) map[key] = p; // uno por nombre, sin duplicar por área
    });
    return Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [productos]);

  const filtrados = unicos.filter((p) => p.nombre.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(34,31,26,0.5)" }} onClick={onCerrar}>
      <div className="w-full rounded-t-3xl p-5" style={{ background: C.paper, maxWidth: 640, margin: "0 auto", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{titulo}</h2>
          <button onClick={onCerrar}><X size={20} style={{ color: C.inkSoft }} /></button>
        </div>
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 12 }}>
          Trae el nombre, categoría, unidad y foto. El mínimo, área y días de conteo los defines aquí, ya que son propios de DÍA.
        </p>

        <div className="relative mb-3">
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: C.inkSoft }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto de PAR..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ border: `1px solid ${C.line}`, background: C.bg }}
          />
        </div>

        {productos === null ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin" size={20} style={{ color: C.accent }} />
          </div>
        ) : filtrados.length === 0 ? (
          <p className="text-center py-8" style={{ color: C.inkSoft, fontSize: 13 }}>
            {unicos.length === 0 ? "No hay productos en PAR todavía." : "Sin resultados."}
          </p>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
            {filtrados.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => onElegir(p)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none" }}
              >
                <ItemThumb foto={p.foto} size={40} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {p.categoria || "Sin categoría"} · {p.unidad}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: C.inkSoft, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const fieldLabel = { fontSize: 12, color: C.inkSoft, fontWeight: 600, marginBottom: 4, display: "block" };
const fieldInput = { border: `1px solid ${C.line}`, background: C.bg, outline: "none" };

function ConfirmSheet({ text, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(34,31,26,0.45)" }} onClick={onCancel}>
      <div className="w-full rounded-2xl p-5" style={{ background: C.paper, maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: 14, marginBottom: 16 }}>{text}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.critical, color: "#fff" }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

/* Confirmación genérica reutilizable (a diferencia de ConfirmSheet, el texto y color del
   botón de confirmar son configurables — ConfirmSheet queda tal cual para no afectar el
   flujo de "eliminar producto" que ya usa). */
function ConfirmAccion({ text, confirmLabel, confirmColor, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(34,31,26,0.45)" }} onClick={onCancel}>
      <div className="w-full rounded-2xl p-5" style={{ background: C.paper, maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: 14, marginBottom: 16 }}>{text}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: confirmColor || C.accent, color: "#fff" }}>{confirmLabel || "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- PENDIENTES TAB (Producción + Pedido a Almacén) ---------- */
/* Indicador gráfico de qué áreas ya terminaron su conteo de hoy (chips de color) */
function ResumenAreasHoy({ areasDelDia, estadoHoy, areasTerminadas }) {
  if (areasDelDia.length === 0) return null;
  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-2.5">
        <span style={{ fontWeight: 700, fontSize: 13 }}>CONTEO DE HOY POR ÁREA</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: areasTerminadas === areasDelDia.length ? C.ok : C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
          {areasTerminadas}/{areasDelDia.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {areasDelDia.map((a) => {
          const estado = estadoHoy[a];
          const terminada = !!estado?.finalizado;
          const enProgreso = !terminada && !!estado?.actualizadoEn;
          const color = terminada ? C.ok : enProgreso ? C.warn : C.critical;
          const bg = terminada ? C.okBg : enProgreso ? C.warnBg : C.criticalBg;
          return (
            <span key={a} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ background: bg, color, fontSize: 11.5, fontWeight: 600 }}>
              {terminada ? <Check size={11} /> : enProgreso ? <Loader2 size={11} /> : <X size={11} />}
              {a}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* Aviso de posibles errores de captura en el conteo de hoy (comparado con el conteo previo) */
function ResumenDiscrepancias({ discrepancias }) {
  if (discrepancias.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} style={{ color: C.warn }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.warn, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Posibles errores de captura hoy
        </span>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: C.warnBg, border: `1px solid ${C.warn}` }}>
        {discrepancias.map((it, idx) => (
          <div key={it.id} className="flex items-center justify-between px-4 py-3" style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none" }}>
            <div className="min-w-0">
              <div style={{ fontSize: 14, fontWeight: 500 }}>{it.nombre}</div>
              <div style={{ fontSize: 10.5, color: C.inkSoft }}>{it.area || "Sin área"} · antes: {fmtNum(it.anterior)} {it.unidad}</div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: C.warn, flexShrink: 0 }}>
              {fmtNum(it.stockActual)} <span style={{ fontSize: 10, fontWeight: 500 }}>{it.unidad}</span>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 4 }}>
        Se compara contra el último conteo guardado antes de hoy. Si la cantidad es correcta, no necesitas hacer nada.
      </p>
    </div>
  );
}

/* Botón/estado de "cerrar el día" cuando no hay nada pendiente que marcar (Pendientes
   vacío) — mismo control que aparece al final de la lista cuando sí hay pendientes. */
function ResumenCierreDia({ diaCerrado, cierreHoy, cerrando, reabriendoDia, onCerrar, onReabrir }) {
  if (diaCerrado) {
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-3 mb-4 rounded-xl" style={{ background: C.okBg, border: `1px solid ${C.ok}` }}>
        <div className="flex items-center gap-2 min-w-0">
          <Lock size={15} style={{ color: C.ok, flexShrink: 0 }} />
          <div className="min-w-0">
            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ok }}>Día cerrado</div>
            {cierreHoy?.cerradoEn && (
              <div style={{ fontSize: 10.5, color: C.inkSoft }}>{formatFecha(cierreHoy.cerradoEn)}</div>
            )}
          </div>
        </div>
        <button onClick={onReabrir} className="px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: C.paper, border: `1px solid ${C.ok}`, color: C.ok, fontSize: 12, fontWeight: 600 }}>
          Reabrir día
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onCerrar}
      disabled={cerrando}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm mb-4"
      style={{ background: C.accent, color: "#fff", opacity: cerrando ? 0.85 : 1 }}
    >
      {cerrando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
      {cerrando ? "Cerrando..." : "Cerrar día"}
    </button>
  );
}

function PendientesTab({ items, estadoAreas, historialReciente, onSaveEstadoAreas }) {
  const [checked, setChecked] = useState({});
  const [cargandoChecked, setCargandoChecked] = useState(true);
  // Si el día de hoy ya se marcó como "cerrado" desde esta misma pestaña — evita que la
  // lista se vuelva a marcar sin querer y deja claro que ya se revisó por completo.
  const [cierreDia, setCierreDia] = useState({});
  const [cerrando, setCerrando] = useState(false);
  const [reabriendoDia, setReabriendoDia] = useState(false);
  const [confirmCerrar, setConfirmCerrar] = useState(false);
  const [confirmReabrirDia, setConfirmReabrirDia] = useState(false);
  // Reinicio manual del día: a diferencia de "Cerrar día" (que solo bloquea la lista),
  // esto borra el progreso de HOY (pendientes marcados, cierre, y conteo por área) para
  // empezar como si fuera un día nuevo, sin esperar a que cambie la fecha del calendario.
  const [reiniciando, setReiniciando] = useState(false);
  const [confirmReiniciar, setConfirmReiniciar] = useState(false);
  const diaManana = (new Date().getDay() + 1) % 7;
  const hoyStr = hoyLocalStr();

  // Qué áreas existen hoy y cuáles ya terminaron su conteo — para el indicador gráfico.
  const areasDelDia = useMemo(() => Array.from(new Set(items.map((i) => i.area).filter(Boolean))), [items]);
  const estadoHoy = estadoAreas?.[hoyStr] || {};
  const areasTerminadas = areasDelDia.filter((a) => estadoHoy[a]?.finalizado).length;

  const cierreHoy = cierreDia?.[hoyStr];
  const diaCerrado = !!cierreHoy;

  // Productos contados hoy cuyo valor se ve como posible error de captura frente al
  // último conteo registrado antes de hoy (mismo criterio que en la pestaña de Conteo).
  const discrepancias = useMemo(() => {
    if (!historialReciente) return [];
    return items
      .filter((it) => it.ultimaActualizacion && hoyLocalStr(new Date(it.ultimaActualizacion)) === hoyStr)
      .map((it) => {
        const prevInfo = historialReciente[`${it.nombre.trim().toLowerCase()}|${it.unidad}`];
        if (!prevInfo) return null;
        const esPosibleError = it.stockActual >= prevInfo.stockActual * 3 && (it.stockActual - prevInfo.stockActual) >= 2;
        return esPosibleError ? { ...it, anterior: prevInfo.stockActual } : null;
      })
      .filter(Boolean);
  }, [items, historialReciente, hoyStr]);

  // Cargar checkeos guardados al montar, pero limpiar si de verdad cambió el día (calendario
  // LOCAL, no UTC — antes usaba la fecha en UTC, que en México ya cambia desde las 6pm hora
  // local, así que la lista parecía "reiniciarse sola" a media tarde/noche aunque siguiera
  // siendo el mismo día del restaurante).
  useEffect(() => {
    (async () => {
      try {
        const lastDate = await kvGet("dia_pendientes_checked_lastDate");
        if (lastDate === hoyStr) {
          // Mismo día, cargar checkeos previos
          const saved = await kvGet("dia_pendientes_checked_v1");
          if (saved && typeof saved === "object") setChecked(saved);
        } else {
          // Día nuevo de verdad, resetear checkeos y guardar nueva fecha
          setChecked({});
          await kvSet("dia_pendientes_checked_lastDate", hoyStr);
        }
      } catch (e) {
        console.error("Error cargando pendientes guardados:", e);
      } finally {
        setCargandoChecked(false);
      }
    })();
  }, []);

  // Guardar cambios de checkeos a Supabase
  useEffect(() => {
    if (cargandoChecked || Object.keys(checked).length === 0) return;
    (async () => {
      try {
        await storageSetRetry("dia_pendientes_checked_v1", checked);
      } catch (e) {
        console.error("Error guardando pendientes:", e);
      }
    })();
  }, [checked, cargandoChecked]);

  // Cargar si el día de hoy ya se cerró
  useEffect(() => {
    (async () => {
      try {
        const val = await kvGet("dia_pendientes_cerrado_v1");
        setCierreDia(val || {});
      } catch (e) {
        setCierreDia({});
      }
    })();
  }, []);

  async function cerrarDia() {
    setCerrando(true);
    const nuevo = podarPorFecha({ ...(cierreDia || {}), [hoyStr]: { cerradoEn: new Date().toISOString() } });
    setCierreDia(nuevo);
    try {
      await storageSetRetry("dia_pendientes_cerrado_v1", nuevo);
    } catch (e) {
      console.error("Error cerrando el día:", e);
    }
    setCerrando(false);
    setConfirmCerrar(false);
  }

  async function reabrirDia() {
    setReabriendoDia(true);
    const nuevo = { ...(cierreDia || {}) };
    delete nuevo[hoyStr];
    setCierreDia(nuevo);
    try {
      await storageSetRetry("dia_pendientes_cerrado_v1", nuevo);
    } catch (e) {
      console.error("Error reabriendo el día:", e);
    }
    setReabriendoDia(false);
    setConfirmReabrirDia(false);
  }

  // Reinicia el día de hoy a mano: borra los pendientes marcados, quita el cierre si lo
  // había, y borra el conteo por área de hoy (vuelven a verse como "sin iniciar"). NO
  // borra el inventario ni las cantidades contadas — solo el progreso/estado del día.
  async function reiniciarDia() {
    setReiniciando(true);
    try {
      setChecked({});
      await storageSetRetry("dia_pendientes_checked_v1", {});

      const nuevoCierre = { ...(cierreDia || {}) };
      delete nuevoCierre[hoyStr];
      setCierreDia(nuevoCierre);
      await storageSetRetry("dia_pendientes_cerrado_v1", nuevoCierre);

      if (onSaveEstadoAreas) {
        const nuevoEstadoAreas = { ...(estadoAreas || {}) };
        delete nuevoEstadoAreas[hoyStr];
        await onSaveEstadoAreas(nuevoEstadoAreas);
      }
    } catch (e) {
      console.error("Error reiniciando el día:", e);
    }
    setReiniciando(false);
    setConfirmReiniciar(false);
  }

  const pendientes = useMemo(() => {
    return items
      .map((i) => ({ ...i, minimoManana: nivelEfectivo(i, diaManana) }))
      .filter((i) => i.stockActual < i.minimoManana)
      .map((i) => ({ ...i, faltante: roundQty(i.minimoManana - i.stockActual, i.unidad) }));
  }, [items, diaManana]);

  const porCategoria = useMemo(() => {
    const map = {};
    pendientes.forEach((i) => {
      const cat = i.categoria?.trim() || "Sin categoría";
      map[cat] = map[cat] || [];
      map[cat].push(i);
    });
    return map;
  }, [pendientes]);

  const ingredientesNecesarios = useMemo(() => {
    const map = {};
    pendientes.forEach((item) => {
      if (!item.receta || item.receta.length === 0) return;
      item.receta.forEach((ing) => {
        const necesario = item.faltante * ing.cantidadPorUnidad;
        const key = `${ing.nombre.trim().toLowerCase()}|${ing.unidad}`;
        if (!map[key]) map[key] = { nombre: ing.nombre, unidad: ing.unidad, cantidad: 0, usadoPor: [] };
        map[key].cantidad += necesario;
        map[key].usadoPor.push(item.nombre);
      });
    });
    return Object.values(map)
      .map((x) => ({ ...x, cantidad: roundQty(x.cantidad, x.unidad) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [pendientes]);

  function toggle(id) {
    if (diaCerrado) return;
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  const fechas = items.map((i) => i.ultimaActualizacion).filter(Boolean).sort();
  const fechaConteo = fechas.length ? fechas[fechas.length - 1] : null;

  if (pendientes.length === 0) {
    return (
      <div className="px-5 pt-4">
        <ResumenAreasHoy areasDelDia={areasDelDia} estadoHoy={estadoHoy} areasTerminadas={areasTerminadas} />
        <ResumenDiscrepancias discrepancias={discrepancias} />
        <ResumenCierreDia
          diaCerrado={diaCerrado}
          cierreHoy={cierreHoy}
          cerrando={cerrando}
          reabriendoDia={reabriendoDia}
          onCerrar={() => setConfirmCerrar(true)}
          onReabrir={() => setConfirmReabrirDia(true)}
        />
        <div className="pt-10 text-center">
          <Check size={40} style={{ color: C.ok, margin: "0 auto 12px" }} />
          <p style={{ fontWeight: 600, fontSize: 15 }}>Todo listo para mañana</p>
          <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Nada por debajo de su mínimo diario.</p>
        </div>
        <button
          onClick={() => setConfirmReiniciar(true)}
          disabled={reiniciando}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-xs mt-6 mb-2"
          style={{ background: "transparent", border: `1px solid ${C.critical}`, color: C.critical, opacity: reiniciando ? 0.7 : 1 }}
        >
          {reiniciando ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
          {reiniciando ? "Reiniciando..." : "Reiniciar día"}
        </button>
        {confirmCerrar && (
          <ConfirmAccion
            text="¿Cerrar el día? La lista de Mañana quedará marcada como revisada y no se podrá seguir marcando hasta que la reabras o empiece el día siguiente."
            confirmLabel="Cerrar día"
            confirmColor={C.accent}
            onCancel={() => setConfirmCerrar(false)}
            onConfirm={cerrarDia}
          />
        )}
        {confirmReabrirDia && (
          <ConfirmAccion
            text="¿Reabrir el día? Vas a poder volver a marcar la lista de Mañana."
            confirmLabel={reabriendoDia ? "Reabriendo..." : "Reabrir día"}
            confirmColor={C.warn}
            onCancel={() => setConfirmReabrirDia(false)}
            onConfirm={reabrirDia}
          />
        )}
        {confirmReiniciar && (
          <ConfirmAccion
            text='¿Reiniciar el día? Se borra el progreso de hoy (pendientes marcados, cierre del día y conteo por área — vuelven a verse como "sin iniciar"). El inventario y las cantidades contadas NO se borran. Esta acción no se puede deshacer.'
            confirmLabel={reiniciando ? "Reiniciando..." : "Sí, reiniciar día"}
            confirmColor={C.critical}
            onCancel={() => setConfirmReiniciar(false)}
            onConfirm={reiniciarDia}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-5 pt-4">
      <ResumenAreasHoy areasDelDia={areasDelDia} estadoHoy={estadoHoy} areasTerminadas={areasTerminadas} />
      <ResumenDiscrepancias discrepancias={discrepancias} />

      {diaCerrado && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 mb-4 rounded-xl" style={{ background: C.okBg, border: `1px solid ${C.ok}` }}>
          <div className="flex items-center gap-2 min-w-0">
            <Lock size={15} style={{ color: C.ok, flexShrink: 0 }} />
            <div className="min-w-0">
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ok }}>Día cerrado</div>
              {cierreHoy?.cerradoEn && (
                <div style={{ fontSize: 10.5, color: C.inkSoft }}>{formatFecha(cierreHoy.cerradoEn)}</div>
              )}
            </div>
          </div>
          <button onClick={() => setConfirmReabrirDia(true)} className="px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: C.paper, border: `1px solid ${C.ok}`, color: C.ok, fontSize: 12, fontWeight: 600 }}>
            Reabrir día
          </button>
        </div>
      )}

      <div className="rounded-2xl p-4 mb-4" style={{ background: C.paper, border: `1px dashed ${C.line}` }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>PENDIENTES PARA MAÑANA</div>
        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
          Basado en el conteo del {fechaConteo ? formatFecha(fechaConteo) : "día de hoy"}
        </div>
      </div>

      {ingredientesNecesarios.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ChefHat size={14} style={{ color: "#8A5A2E" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#8A5A2E", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Ingredientes para producir (sacar de PAR)
            </span>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: "#F1E4D3", border: "1px solid #D9C4A3" }}>
            {ingredientesNecesarios.map((ing, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-3" style={{ borderTop: idx > 0 ? "1px solid #D9C4A3" : "none" }}>
                <div className="min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{ing.nombre}</div>
                  <div style={{ fontSize: 10.5, color: "#8A5A2E" }}>
                    para: {[...new Set(ing.usadoPor)].join(", ")}
                  </div>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: "#8A5A2E", flexShrink: 0 }}>
                  {fmtNum(ing.cantidad)} <span style={{ fontSize: 10, fontWeight: 500 }}>{ing.unidad}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.entries(porCategoria).map(([cat, lista]) => (
        <div key={cat} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.03em" }}>{cat}</span>
            <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>({lista.length})</span>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
            {lista.map((item, idx) => {
              const isChecked = !!checked[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  disabled={diaCerrado}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none", opacity: isChecked ? 0.5 : diaCerrado ? 0.7 : 1 }}
                >
                  <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ border: `1.5px solid ${isChecked ? C.accent : C.line}`, background: isChecked ? C.accent : "transparent" }}>
                    {isChecked && <Check size={13} color="#fff" />}
                  </div>
                  <ItemThumb foto={item.foto} size={36} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 500, textDecoration: isChecked ? "line-through" : "none" }}>
                      {item.nombre}
                      {item.receta?.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded" style={{ fontSize: 9, fontWeight: 700, background: "#F1E4D3", color: "#8A5A2E" }}>
                          SE ELABORA
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{item.area}</div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: C.accent }}>
                    {fmtNum(item.faltante)} <span style={{ fontSize: 10, fontWeight: 500, color: C.inkSoft }}>{item.unidad}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!diaCerrado ? (
        <button
          onClick={() => setConfirmCerrar(true)}
          disabled={cerrando}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm mt-1"
          style={{ background: C.accent, color: "#fff", opacity: cerrando ? 0.85 : 1 }}
        >
          {cerrando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {cerrando ? "Cerrando..." : "Cerrar día"}
        </button>
      ) : (
        <p className="text-center" style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 4 }}>
          Día cerrado — no se reiniciará hasta mañana. Usa "Reabrir día" arriba si necesitas corregir algo.
        </p>
      )}

      {confirmCerrar && (
        <ConfirmAccion
          text="¿Cerrar el día? La lista de Mañana quedará marcada como revisada y no se podrá seguir marcando hasta que la reabras o empiece el día siguiente."
          confirmLabel="Cerrar día"
          confirmColor={C.accent}
          onCancel={() => setConfirmCerrar(false)}
          onConfirm={cerrarDia}
        />
      )}

      {confirmReabrirDia && (
        <ConfirmAccion
          text="¿Reabrir el día? Vas a poder volver a marcar la lista de Mañana."
          confirmLabel={reabriendoDia ? "Reabriendo..." : "Reabrir día"}
          confirmColor={C.warn}
          onCancel={() => setConfirmReabrirDia(false)}
          onConfirm={reabrirDia}
        />
      )}

      <button
        onClick={() => setConfirmReiniciar(true)}
        disabled={reiniciando}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-xs mt-3"
        style={{ background: "transparent", border: `1px solid ${C.critical}`, color: C.critical, opacity: reiniciando ? 0.7 : 1 }}
      >
        {reiniciando ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
        {reiniciando ? "Reiniciando..." : "Reiniciar día"}
      </button>
      {confirmReiniciar && (
        <ConfirmAccion
          text='¿Reiniciar el día? Se borra el progreso de hoy (pendientes marcados, cierre del día y conteo por área — vuelven a verse como "sin iniciar"). El inventario y las cantidades contadas NO se borran. Esta acción no se puede deshacer.'
          confirmLabel={reiniciando ? "Reiniciando..." : "Sí, reiniciar día"}
          confirmColor={C.critical}
          onCancel={() => setConfirmReiniciar(false)}
          onConfirm={reiniciarDia}
        />
      )}
    </div>
  );
}

function HistorialTab({ items }) {
  const [historial, setHistorial] = useState(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const val = await kvGet("dia_historial_v1");
        setHistorial(val || []);
      } catch (e) {
        setHistorial([]);
      }
    })();
  }, [items]);

  const productos = useMemo(() => {
    if (!historial) return [];
    const map = {};
    historial.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).forEach((registro) => {
      registro.items.forEach((c) => {
        const key = `${c.nombre.trim().toLowerCase()}|${c.unidad}`;
        if (!map[key]) map[key] = { id: key, nombre: c.nombre, unidad: c.unidad, categoria: c.categoria, registros: [] };
        const consumido = roundQty(Math.max(0, c.nivelMinimo - c.stockActual), c.unidad);
        map[key].registros.push({ fecha: registro.fecha, consumido });
      });
    });
    return Object.values(map)
      .map((p) => ({ ...p, promedio: p.registros.reduce((s, r) => s + r.consumido, 0) / p.registros.length }))
      .sort((a, b) => b.promedio - a.promedio);
  }, [historial]);

  const filtrados = productos.filter((p) => p.nombre.toLowerCase().includes(query.trim().toLowerCase()));

  if (historial === null) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" size={22} style={{ color: C.accent }} /></div>;
  }

  if (productos.length === 0) {
    return (
      <div className="px-5 pt-16 text-center">
        <BarChart2 size={36} style={{ color: C.line, margin: "0 auto 12px" }} />
        <p style={{ fontWeight: 600, fontSize: 15 }}>Aún no hay historial</p>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Cada conteo diario que guardes se va sumando aquí para armar el promedio.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4">
      <div className="relative mb-3">
        <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: C.inkSoft }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto..." className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}`, background: C.paper }} />
      </div>
      <p style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 12 }}>
        Promedio diario, calculado con {historial.length} {historial.length === 1 ? "día registrado" : "días registrados"}.
      </p>

      {filtrados.map((p) => {
        const isOpen = !!open[p.id];
        const registrosDesc = p.registros.slice().reverse();
        return (
          <div key={p.id} className="mb-3 rounded-2xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
            <button onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))} className="w-full flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0 text-left">
                <div style={{ fontSize: 14, fontWeight: 500 }}>{p.nombre}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{p.categoria || "Sin categoría"}</span>
                </div>
              </div>
              <div className="text-right">
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 17, color: C.accent }}>
                  {fmtNum(Math.round(p.promedio * 10) / 10)} <span style={{ fontSize: 10, fontWeight: 500, color: C.inkSoft }}>{p.unidad}</span>
                </div>
                <div style={{ fontSize: 9.5, color: C.inkSoft }}>prom. x día</div>
              </div>
              {isOpen ? <ChevronDown size={16} style={{ color: C.inkSoft }} /> : <ChevronRight size={16} style={{ color: C.inkSoft }} />}
            </button>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="px-4 py-2" style={{ fontSize: 10.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.03em" }}>Registro diario</div>
                {registrosDesc.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2" style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none", fontFamily: "'IBM Plex Mono', monospace" }}>
                    <span style={{ fontSize: 12, color: C.inkSoft }}>{formatFecha(r.fecha)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtNum(r.consumido)} {p.unidad}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
