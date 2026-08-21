import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Package, ClipboardList, ChefHat, Plus, Minus, Trash2, Search,
  ChevronDown, ChevronRight, Check, X, AlertTriangle, Loader2,
  Pencil, Save, Camera, TrendingUp, BarChart2,
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

async function appendHistorial(items, fecha, diaObjetivo) {
  try {
    let hist = [];
    try {
      const val = await kvGet("dia_historial_v1");
      hist = val || [];
    } catch (e) {
      hist = [];
    }
    hist.push({
      fecha,
      items: items.map((i) => ({
        nombre: i.nombre, unidad: i.unidad, categoria: i.categoria,
        area: i.area, nivelMinimo: nivelEfectivo(i, diaObjetivo), stockActual: i.stockActual,
        parKey: i.parKey || null,
      })),
    });
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
  const [tab, setTab] = useState("conteo");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => { load(); }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  async function load() {
    try {
      const val = await kvGet("dia_items_v1");
      if (val) {
        setItems(val);
      } else {
        setItems(SEED_ITEMS);
        await kvSet("dia_items_v1", SEED_ITEMS);
      }
    } catch (e) {
      setItems(SEED_ITEMS);
    }
  }

  async function persist(newItems) {
    setItems(newItems);
    const res = await storageSetRetry("dia_items_v1", newItems);
    if (!res.ok) {
      showToast("No se pudo guardar tras varios intentos: " + (res.error?.message || "error desconocido"));
    }
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
        {tab === "conteo" && <ConteoTab items={items} onSave={persist} showToast={showToast} />}
        {tab === "inventario" && <InventarioTab items={items} onSave={persist} showToast={showToast} />}
        {tab === "pendientes" && <PendientesTab items={items} />}
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
function ConteoTab({ items, onSave, showToast }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.stockActual])));
  const [query, setQuery] = useState("");
  const [areaActual, setAreaActual] = useState(undefined);
  const [cambiandoArea, setCambiandoArea] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

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

  function setVal(id, val) {
    setDraft((d) => ({ ...d, [id]: Math.max(0, val) }));
    setGuardado(false);
  }

  async function guardar() {
    setGuardando(true);
    const fecha = new Date().toISOString();
    const updated = items.map((i) => ({ ...i, stockActual: draft[i.id] ?? i.stockActual, ultimaActualizacion: fecha }));
    onSave(updated);
    await appendHistorial(updated, fecha, diaManana);
    setGuardando(false);
    setGuardado(true);
    showToast("Conteo de hoy guardado");
  }

  if (areaActual === undefined) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" size={22} style={{ color: C.accent }} /></div>;
  }

  if (areaActual === null || cambiandoArea) {
    return <AreaPicker areas={areasDisponibles} sinArea={sinArea} onElegir={elegirArea} onCancelar={areaActual && cambiandoArea ? () => setCambiandoArea(false) : null} />;
  }

  const nombreAreaActual = areaActual === "__todas__" ? "Todas las áreas" : areaActual === "__sinArea__" ? "Sin área asignada" : areaActual;

  return (
    <div className="px-5 pt-4">
      <button onClick={() => setCambiandoArea(true)} className="w-full flex items-center justify-between px-4 py-3 mb-3 rounded-xl" style={{ background: C.accent, color: "#fff" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Contando: {nombreAreaActual}</span>
        <span style={{ fontSize: 12, textDecoration: "underline" }}>Cambiar área</span>
      </button>

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
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
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
                    <button onClick={() => setVal(item.id, roundStep(val, item.unidad, -1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                      <Minus size={13} />
                    </button>
                    <input
                      type="number" inputMode="decimal" value={val}
                      onChange={(e) => setVal(item.id, parseFloat(e.target.value) || 0)}
                      className="text-center rounded-lg py-1"
                      style={{ width: 56, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 14, border: `1px solid ${C.line}`, background: s.bg, color: s.color }}
                    />
                    <button onClick={() => setVal(item.id, roundStep(val, item.unidad, 1))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                      <Plus size={13} />
                    </button>
                  </div>
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

      {(hayCambios || guardando) && (
        <button
          onClick={guardar}
          disabled={guardando}
          className="fixed left-1/2 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg"
          style={{ bottom: 76, transform: "translateX(-50%)", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 14, opacity: guardando ? 0.85 : 1 }}
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {guardando ? "Guardando..." : "Guardar conteo de hoy"}
        </button>
      )}
      {guardado && !hayCambios && (
        <div
          className="fixed left-1/2 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg"
          style={{ bottom: 76, transform: "translateX(-50%)", background: C.ok, color: "#fff", fontWeight: 600, fontSize: 14 }}
        >
          <Check size={16} /> Guardado
        </div>
      )}
    </div>
  );
}

function roundStep(val, unidad, dir) {
  const step = ["pza", "caja", "paquete", "porción"].includes(unidad) ? 1 : 0.5;
  return Math.max(0, Math.round((val + dir * step) * 10) / 10);
}

function AreaPicker({ areas, sinArea, onElegir, onCancelar }) {
  return (
    <div className="px-5 pt-8">
      <div className="text-center mb-6">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>¿En qué área trabajas?</h2>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Elige tu área para contar solo tus perecederos.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {areas.map((a) => (
          <button key={a} onClick={() => onElegir(a)} className="w-full py-4 rounded-2xl text-left px-5 flex items-center justify-between" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{a}</span>
            <ChevronRight size={18} style={{ color: C.inkSoft }} />
          </button>
        ))}
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

  function upsert(item) {
    if (item.id) {
      onSave(items.map((i) => (i.id === item.id ? { ...i, ...item } : i)));
      showToast("Producto actualizado");
    } else {
      onSave([...items, { ...item, id: uid() }]);
      showToast("Producto agregado");
    }
    setShowForm(false);
    setEditing(null);
  }

  function remove(id) {
    onSave(items.filter((i) => i.id !== id));
    setConfirmDelete(null);
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
    setSubiendoFoto(true);
    setError("");
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

/* ---------- PENDIENTES TAB (Producción + Pedido a Almacén) ---------- */
function PendientesTab({ items }) {
  const [checked, setChecked] = useState({});
  const diaManana = (new Date().getDay() + 1) % 7;

  // Cargar checkeos guardados al montar
  useEffect(() => {
    (async () => {
      try {
        const saved = await kvGet("dia_pendientes_checked_v1");
        if (saved && typeof saved === "object") setChecked(saved);
      } catch (e) {
        console.error("Error cargando pendientes guardados:", e);
      }
    })();
  }, []);

  // Guardar cambios de checkeos a Supabase
  useEffect(() => {
    if (Object.keys(checked).length === 0) return;
    (async () => {
      try {
        await storageSetRetry("dia_pendientes_checked_v1", checked);
      } catch (e) {
        console.error("Error guardando pendientes:", e);
      }
    })();
  }, [checked]);

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

  function toggle(id) { setChecked((c) => ({ ...c, [id]: !c[id] })); }

  const fechas = items.map((i) => i.ultimaActualizacion).filter(Boolean).sort();
  const fechaConteo = fechas.length ? fechas[fechas.length - 1] : null;

  if (pendientes.length === 0) {
    return (
      <div className="px-5 pt-16 text-center">
        <Check size={40} style={{ color: C.ok, margin: "0 auto 12px" }} />
        <p style={{ fontWeight: 600, fontSize: 15 }}>Todo listo para mañana</p>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Nada por debajo de su mínimo diario.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4">
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
                <button key={item.id} onClick={() => toggle(item.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left" style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none", opacity: isChecked ? 0.5 : 1 }}>
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
    </div>
  );
}

