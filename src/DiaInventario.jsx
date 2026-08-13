import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Package, ClipboardList, ChefHat, Plus, Minus, Trash2, Search,
  ChevronDown, ChevronRight, Check, X, AlertTriangle, Loader2,
  Pencil, Save, Camera, TrendingUp, BarChart2, Sparkles, User,
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
  bg: "#F7F3EC",
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

/* Semana de limpieza: reinicia cada lunes. Devuelve la fecha (YYYY-MM-DD) del lunes vigente. */
function pad2(n) { return String(n).padStart(2, "0"); }

function lunesDeLaSemana(d = new Date()) {
  const day = d.getDay(); // 0=Dom, 1=Lun, ... 6=Sáb
  const diff = day === 0 ? -6 : 1 - day;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + diff);
  lunes.setHours(0, 0, 0, 0);
  return `${lunes.getFullYear()}-${pad2(lunes.getMonth() + 1)}-${pad2(lunes.getDate())}`;
}

function formatSemana(lunesKey) {
  try {
    const [y, m, d] = lunesKey.split("-").map(Number);
    const lunes = new Date(y, m - 1, d);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    const fmt = (dt) => dt.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    return `${fmt(lunes)} – ${fmt(domingo)}`;
  } catch (e) {
    return lunesKey;
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
        {tab === "limpieza" && <LimpiezaTab showToast={showToast} />}
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
      <NavBtn id="limpieza" icon={Sparkles} label="Limpieza" />
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
  const [dirty, setDirty] = useState(false);
  const [areaActual, setAreaActual] = useState(undefined);
  const [cambiandoArea, setCambiandoArea] = useState(false);

  useEffect(() => {
    setDraft(Object.fromEntries(items.map((i) => [i.id, i.stockActual])));
    setDirty(false);
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

  function setVal(id, val) {
    setDraft((d) => ({ ...d, [id]: Math.max(0, val) }));
    setDirty(true);
  }

  async function guardar() {
    const fecha = new Date().toISOString();
    const updated = items.map((i) => ({ ...i, stockActual: draft[i.id] ?? i.stockActual, ultimaActualizacion: fecha }));
    onSave(updated);
    await appendHistorial(updated, fecha, diaManana);
    setDirty(false);
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

      <div className="rounded-2xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
        {filtrados.map((item, idx) => {
          const val = draft[item.id] ?? 0;
          const minimoManana = nivelEfectivo(item, diaManana);
          const esNivelAlto = minimoManana !== item.nivelMinimo;
          const status = statusOf({ ...item, stockActual: val, nivelMinimo: minimoManana });
          const s = STATUS_STYLE[status];
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none" }}>
              <StatusDot status={status} />
              <ItemThumb foto={item.foto} size={40} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14, fontWeight: 500 }}>{item.nombre}</div>
                <div className="flex items-center gap-1.5">
                  <CategoriaBadge categoria={item.categoria} />
                  <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                    mín: {fmtNum(minimoManana)} {item.unidad}{esNivelAlto ? " ↑" : ""}
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

      {filtrados.length === 0 && (
        <p className="text-center py-10" style={{ color: C.inkSoft, fontSize: 14 }}>
          No hay productos diarios asignados a esta área. Ve a Inventario y agrégalos.
        </p>
      )}

      {dirty && (
        <button onClick={guardar} className="fixed left-1/2 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg" style={{ bottom: 76, transform: "translateX(-50%)", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 14 }}>
          <Save size={16} /> Guardar conteo de hoy
        </button>
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
                {item.categoria || "Sin categoría"} · Mín {fmtNum(item.nivelMinimo)} {item.unidad}{item.area ? ` · ${item.area}` : ""}
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

function ItemForm({ initial, categorias, areas, onCancel, onSubmit }) {
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
  const [foto, setFoto] = useState(initial?.foto || "");
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState("");
  const [showImportarPar, setShowImportarPar] = useState(false);
  const [parKey, setParKey] = useState(initial?.parKey || "");

  function importarDesdeParItem(producto) {
    if (!initial) {
      setNombre(producto.nombre);
      setCategoria(producto.categoria || "");
      setUnidad(producto.unidad || "kg");
      setFoto(producto.foto || "");
    }
    setParKey(`${producto.nombre.trim().toLowerCase()}|${producto.unidad}`);
    setShowImportarPar(false);
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

    if (!nombre.trim()) return setError("Ponle un nombre al producto.");
    if (!cat) return setError("Elige o escribe una categoría.");
    if (nivelMinimo === "" || isNaN(nivelMinimo) || Number(nivelMinimo) < 0) return setError("El mínimo debe ser un número válido.");
    if (area === "__nuevaArea__" && !ar) return setError("Escribe el nombre del área nueva.");
    if (tieneNivelAlto && (nivelMinimoAlto === "" || isNaN(nivelMinimoAlto) || Number(nivelMinimoAlto) < 0)) return setError("El nivel alto debe ser un número válido.");
    if (tieneNivelAlto && diasNivelAlto.length === 0) return setError("Elige en qué días aplica el nivel alto.");
    onSubmit({
      id: initial?.id, nombre: nombre.trim(), categoria: cat, unidad,
      nivelMinimo: Number(nivelMinimo), stockActual: initial?.stockActual ?? 0,
      area: ar, foto,
      diasConteo,
      nivelMinimoAlto: tieneNivelAlto ? Number(nivelMinimoAlto) : "",
      diasNivelAlto: tieneNivelAlto ? diasNivelAlto : [],
      parKey,
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
    </div>
  );
}

function ImportarParModal({ onCerrar, onElegir }) {
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
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>Importar desde PAR</h2>
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
                    <div style={{ fontSize: 14, fontWeight: 500, textDecoration: isChecked ? "line-through" : "none" }}>{item.nombre}</div>
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

/* ---------- LIMPIEZA TAB ---------- */

async function cargarTareasLimpieza() {
  try {
    const val = await kvGet("limpieza_tareas", "kv_store_limpieza");
    return val || [];
  } catch (e) {
    return [];
  }
}

async function guardarTareasLimpieza(tareas) {
  return storageSetRetry("limpieza_tareas", tareas, "kv_store_limpieza");
}

async function cargarRegistrosLimpieza() {
  try {
    const val = await kvGet("limpieza_registros", "kv_store_limpieza");
    return val || [];
  } catch (e) {
    return [];
  }
}

async function guardarRegistrosLimpieza(registros) {
  // conserva las últimas ~14 semanas para no crecer indefinidamente
  const corte = new Date();
  corte.setDate(corte.getDate() - 100);
  const corteKey = `${corte.getFullYear()}-${pad2(corte.getMonth() + 1)}-${pad2(corte.getDate())}`;
  const podados = registros.filter((r) => r.semana >= corteKey);
  return storageSetRetry("limpieza_registros", podados, "kv_store_limpieza");
}

async function cargarGerentePin() {
  try {
    return await kvGet("limpieza_gerente_pin", "kv_store_limpieza");
  } catch (e) {
    return null;
  }
}

async function guardarGerentePin(pin) {
  return storageSetRetry("limpieza_gerente_pin", pin, "kv_store_limpieza");
}

function lunesAnterior(lunesKey) {
  const [y, m, d] = lunesKey.split("-").map(Number);
  const lunes = new Date(y, m - 1, d);
  lunes.setDate(lunes.getDate() - 7);
  return `${lunes.getFullYear()}-${pad2(lunes.getMonth() + 1)}-${pad2(lunes.getDate())}`;
}

function hoyKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ---------- Actividades de Cierre (llenado exclusivo del Gerente, reinicia cada día) ---------- */

async function cargarTareasCierre() {
  try {
    return (await kvGet("cierre_tareas", "kv_store_limpieza")) || [];
  } catch (e) {
    return [];
  }
}

async function guardarTareasCierre(tareas) {
  return storageSetRetry("cierre_tareas", tareas, "kv_store_limpieza");
}

async function cargarRegistrosCierre() {
  try {
    return (await kvGet("cierre_registros", "kv_store_limpieza")) || [];
  } catch (e) {
    return [];
  }
}

async function guardarRegistrosCierre(registros) {
  // conserva los últimos 60 días
  const corte = new Date();
  corte.setDate(corte.getDate() - 60);
  const corteKey = `${corte.getFullYear()}-${pad2(corte.getMonth() + 1)}-${pad2(corte.getDate())}`;
  const podados = registros.filter((r) => r.fechaKey >= corteKey);
  return storageSetRetry("cierre_registros", podados, "kv_store_limpieza");
}

function LimpiezaTab({ showToast }) {
  const [areaActual, setAreaActual] = useState(undefined);
  const [cambiandoArea, setCambiandoArea] = useState(false);
  const [tareas, setTareas] = useState(null);
  const [registros, setRegistros] = useState(null);
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [completando, setCompletando] = useState(null); // tarea en proceso de marcarse hecha
  const [modoGerente, setModoGerente] = useState(false);
  const [pinModal, setPinModal] = useState(null); // {mode:'setup'|'unlock', value, confirmValue, error}
  const [gerentePin, setGerentePin] = useState(undefined);

  useEffect(() => {
    (async () => setGerentePin(await cargarGerentePin()))();
  }, []);

  function abrirGerente() {
    if (gerentePin === undefined) return;
    if (!gerentePin) setPinModal({ mode: "setup", value: "", confirmValue: "", error: "" });
    else setPinModal({ mode: "unlock", value: "", error: "" });
  }

  function submitPinGerente() {
    if (!pinModal) return;
    const digits = pinModal.value.trim();
    if (pinModal.mode === "unlock") {
      if (digits !== gerentePin) {
        setPinModal((m) => ({ ...m, value: "", error: "Clave incorrecta." }));
        return;
      }
      setModoGerente(true);
      setPinModal(null);
      return;
    }
    if (digits.length < 4) return setPinModal((m) => ({ ...m, error: "Usa al menos 4 dígitos." }));
    if (digits !== pinModal.confirmValue.trim()) return setPinModal((m) => ({ ...m, error: "Las claves no coinciden." }));
    setGerentePin(digits);
    guardarGerentePin(digits);
    setModoGerente(true);
    setPinModal(null);
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dia_area_actual");
      setAreaActual(saved || null);
    } catch (e) {
      setAreaActual(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [t, r] = await Promise.all([cargarTareasLimpieza(), cargarRegistrosLimpieza()]);
      setTareas(t);
      setRegistros(r);
    })();
  }, []);

  async function elegirArea(area) {
    setAreaActual(area);
    setCambiandoArea(false);
    try { localStorage.setItem("dia_area_actual", area); } catch (e) {}
  }

  async function guardarNuevaTarea(tarea) {
    const nuevas = [...tareas, { ...tarea, id: uid() }];
    setTareas(nuevas);
    const res = await guardarTareasLimpieza(nuevas);
    if (!res.ok) showToast("No se pudo guardar la tarea: " + (res.error?.message || "error"));
    else showToast("Actividad agregada");
  }

  async function eliminarTarea(id) {
    const nuevas = tareas.filter((t) => t.id !== id);
    setTareas(nuevas);
    await guardarTareasLimpieza(nuevas);
    showToast("Actividad eliminada");
  }

  async function marcarHecha(tarea, foto, quien) {
    const semana = lunesDeLaSemana();
    const nuevoRegistro = {
      id: uid(),
      tareaId: tarea.id,
      nombreTarea: tarea.nombre,
      area: tarea.area,
      semana,
      fecha: new Date().toISOString(),
      quien: quien || "",
      foto,
    };
    const nuevos = [...registros, nuevoRegistro];
    setRegistros(nuevos);
    setCompletando(null);
    const res = await guardarRegistrosLimpieza(nuevos);
    if (!res.ok) showToast("No se pudo guardar: " + (res.error?.message || "error"));
    else showToast("Actividad registrada");
  }

  const areasDisponibles = useMemo(() => {
    const set = new Set([...AREAS_DEFAULT, ...(tareas || []).map((t) => t.area).filter(Boolean)]);
    return Array.from(set);
  }, [tareas]);

  if (areaActual === undefined || tareas === null || registros === null) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin" size={22} style={{ color: C.accent }} /></div>;
  }

  if (areaActual === null || cambiandoArea) {
    return (
      <AreaPicker
        areas={areasDisponibles}
        sinArea={false}
        onElegir={elegirArea}
        onCancelar={areaActual && cambiandoArea ? () => setCambiandoArea(false) : null}
      />
    );
  }

  const semanaActual = lunesDeLaSemana();

  if (modoGerente) {
    return (
      <GerenteView
        tareas={tareas}
        registros={registros}
        semanaActual={semanaActual}
        onSalir={() => setModoGerente(false)}
      />
    );
  }

  const tareasDelArea = tareas.filter((t) => t.area === areaActual);
  const hechosEstaSemana = new Set(
    registros.filter((r) => r.semana === semanaActual && r.area === areaActual).map((r) => r.tareaId)
  );
  const pendientes = tareasDelArea.filter((t) => !hechosEstaSemana.has(t.id));
  const completadas = tareasDelArea
    .filter((t) => hechosEstaSemana.has(t.id))
    .map((t) => ({ ...t, registro: registros.find((r) => r.semana === semanaActual && r.area === areaActual && r.tareaId === t.id) }));

  return (
    <div className="px-5 pt-4">
      <button
        onClick={() => setCambiandoArea(true)}
        className="w-full flex items-center justify-between px-4 py-3 mb-3 rounded-xl"
        style={{ background: C.accent, color: "#fff" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Limpieza: {areaActual}</span>
        <span style={{ fontSize: 12, textDecoration: "underline" }}>Cambiar área</span>
      </button>

      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 12, color: C.inkSoft }}>Semana del {formatSemana(semanaActual)}</span>
        <div className="flex items-center gap-3">
          <button onClick={abrirGerente} className="text-xs font-semibold" style={{ color: C.inkSoft }}>
            Modo Gerente
          </button>
          <button onClick={() => setShowCatalogo(true)} className="text-xs font-semibold" style={{ color: C.accent }}>
            Editar actividades
          </button>
        </div>
      </div>

      {pinModal && <PinModalGerente pinModal={pinModal} setPinModal={setPinModal} onSubmit={submitPinGerente} onCancel={() => setPinModal(null)} />}

      {tareasDelArea.length === 0 ? (
        <p className="text-center py-10" style={{ color: C.inkSoft, fontSize: 14 }}>
          No hay actividades de limpieza registradas para {areaActual} todavía.{" "}
          <button onClick={() => setShowCatalogo(true)} style={{ color: C.accent, textDecoration: "underline" }}>
            Agrega la primera
          </button>
        </p>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.critical, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Pendientes esta semana ({pendientes.length})
          </div>
          {pendientes.length === 0 ? (
            <div className="rounded-2xl p-4 mb-4 flex items-center gap-2" style={{ background: C.okBg, border: `1px solid ${C.line}` }}>
              <Check size={16} style={{ color: C.ok }} />
              <span style={{ fontSize: 13, color: C.ok, fontWeight: 600 }}>Ya se hicieron todas esta semana.</span>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
              {pendientes.map((t, idx) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none" }}>
                  <span className="flex-1 min-w-0" style={{ fontSize: 14, fontWeight: 500 }}>{t.nombre}</span>
                  <button
                    onClick={() => setCompletando(t)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                    style={{ background: C.accent, color: "#fff" }}
                  >
                    <Camera size={13} /> Marcar hecho
                  </button>
                </div>
              ))}
            </div>
          )}

          {completadas.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ok, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Completadas esta semana ({completadas.length})
              </div>
              <div className="rounded-2xl overflow-hidden mb-4" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
                {completadas.map((t, idx) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none" }}>
                    <ItemThumb foto={t.registro?.foto} size={40} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 500, textDecoration: "line-through", color: C.inkSoft }}>{t.nombre}</div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>
                        {formatFecha(t.registro?.fecha)}{t.registro?.quien ? ` · ${t.registro.quien}` : ""}
                      </div>
                    </div>
                    <Check size={16} style={{ color: C.ok, flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {completando && (
        <CompletarTareaModal tarea={completando} onCancel={() => setCompletando(null)} onConfirm={marcarHecha} />
      )}

      {showCatalogo && (
        <CatalogoLimpiezaModal
          tareas={tareasDelArea}
          areaActual={areaActual}
          onCerrar={() => setShowCatalogo(false)}
          onAgregar={guardarNuevaTarea}
          onEliminar={eliminarTarea}
        />
      )}
    </div>
  );
}

function CompletarTareaModal({ tarea, onCancel, onConfirm }) {
  const [foto, setFoto] = useState("");
  const [quien, setQuien] = useState(() => {
    try { return localStorage.getItem("limpieza_ultimo_nombre") || ""; } catch (e) { return ""; }
  });
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setError("");
    try {
      let dataUrl = await compressImage(file, 260, 0.6);
      if (dataUrl.length > 180000) dataUrl = await compressImage(file, 180, 0.45);
      setFoto(dataUrl);
    } catch (err) {
      setError("No se pudo procesar la foto, intenta con otra.");
    }
    setSubiendo(false);
    e.target.value = "";
  }

  function confirmar() {
    if (!foto) return setError("Toma una foto de la actividad ya realizada para poder registrarla.");
    try { localStorage.setItem("limpieza_ultimo_nombre", quien.trim()); } catch (e) {}
    onConfirm(tarea, foto, quien.trim());
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end" style={{ background: "rgba(34,31,26,0.4)" }} onClick={onCancel}>
      <div className="w-full rounded-t-3xl p-5" style={{ background: C.paper, maxWidth: 640, margin: "0 auto", maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{tarea.nombre}</h2>
          <button onClick={onCancel}><X size={20} style={{ color: C.inkSoft }} /></button>
        </div>

        <label style={fieldLabel}>Foto de la actividad ya realizada</label>
        <div className="flex items-center gap-3 mb-4">
          <ItemThumb foto={foto} size={72} />
          <label
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
            style={{ border: `1px solid ${C.line}`, background: C.bg }}
          >
            {subiendo ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
            {foto ? "Cambiar foto" : "Tomar foto"}
            <input type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
          </label>
        </div>

        <label style={fieldLabel}>¿Quién la hizo? (opcional)</label>
        <div className="relative mb-4">
          <User size={15} style={{ position: "absolute", left: 10, top: 12, color: C.inkSoft }} />
          <input
            value={quien}
            onChange={(e) => setQuien(e.target.value)}
            placeholder="Nombre"
            className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm"
            style={fieldInput}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: C.criticalBg, color: C.critical, fontSize: 13 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <button onClick={confirmar} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2" style={{ background: C.accent, color: "#fff" }}>
          <Check size={16} /> Registrar como hecha
        </button>
      </div>
    </div>
  );
}

function CatalogoLimpiezaModal({ tareas, areaActual, onCerrar, onAgregar, onEliminar }) {
  const [nombre, setNombre] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState("");

  function agregar() {
    if (!nombre.trim()) return setError("Escribe el nombre de la actividad.");
    onAgregar({ nombre: nombre.trim(), area: areaActual });
    setNombre("");
    setError("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(34,31,26,0.45)" }} onClick={onCerrar}>
      <div className="w-full rounded-t-3xl p-5" style={{ background: C.paper, maxWidth: 640, margin: "0 auto", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>Actividades — {areaActual}</h2>
          <button onClick={onCerrar}><X size={20} style={{ color: C.inkSoft }} /></button>
        </div>
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 14 }}>
          Estas se repiten cada semana (se reinician los lunes). Solo se muestran las de {areaActual}.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Limpiar refrigerador"
            className="flex-1 px-3 py-2.5 rounded-xl text-sm"
            style={fieldInput}
          />
          <button onClick={agregar} className="px-4 rounded-xl text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
            <Plus size={16} />
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: C.criticalBg, color: C.critical, fontSize: 13 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {tareas.length === 0 ? (
          <p className="text-center py-6" style={{ color: C.inkSoft, fontSize: 13 }}>Sin actividades todavía.</p>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
            {tareas.map((t, idx) => (
              <div key={t.id} className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none" }}>
                <span className="flex-1 min-w-0" style={{ fontSize: 13.5 }}>{t.nombre}</span>
                {confirmDelete === t.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { onEliminar(t.id); setConfirmDelete(null); }} className="p-1.5 rounded-full" style={{ background: C.critical }}>
                      <Check size={12} color="#fff" />
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-full" style={{ background: C.bg }}>
                      <X size={12} style={{ color: C.inkSoft }} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(t.id)} className="p-1.5">
                    <Trash2 size={14} style={{ color: C.inkSoft }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
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

function PinModalGerente({ pinModal, setPinModal, onSubmit, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(34,31,26,0.45)" }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: C.paper }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>
            {pinModal.mode === "unlock" ? "Clave de gerente" : "Configura la clave de gerente"}
          </span>
          <button onClick={onCancel}><X size={18} style={{ color: C.inkSoft }} /></button>
        </div>
        {pinModal.mode === "setup" && (
          <p style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 12 }}>
            Esta clave se va a pedir cada vez que alguien quiera entrar al Modo Gerente.
          </p>
        )}
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pinModal.value}
          onChange={(e) => setPinModal((m) => ({ ...m, value: e.target.value.replace(/\D/g, ""), error: "" }))}
          onKeyDown={(e) => e.key === "Enter" && pinModal.mode === "unlock" && onSubmit()}
          placeholder={pinModal.mode === "unlock" ? "Clave" : "Nueva clave (mín. 4 dígitos)"}
          className="w-full px-3 py-3 rounded-xl text-lg tracking-[0.3em] text-center outline-none mb-2"
          style={fieldInput}
        />
        {pinModal.mode === "setup" && (
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinModal.confirmValue}
            onChange={(e) => setPinModal((m) => ({ ...m, confirmValue: e.target.value.replace(/\D/g, ""), error: "" }))}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="Confirmar clave"
            className="w-full px-3 py-3 rounded-xl text-lg tracking-[0.3em] text-center outline-none mb-2"
            style={fieldInput}
          />
        )}
        {pinModal.error && (
          <p style={{ fontSize: 12.5, color: C.critical, marginBottom: 8 }}>{pinModal.error}</p>
        )}
        <button onClick={onSubmit} className="w-full py-3 rounded-xl font-semibold text-sm mt-2" style={{ background: C.accent, color: "#fff" }}>
          {pinModal.mode === "unlock" ? "Entrar" : "Guardar clave y entrar"}
        </button>
      </div>
    </div>
  );
}

function GerenteView({ tareas, registros, semanaActual, onSalir }) {
  const [seccion, setSeccion] = useState("limpieza"); // "limpieza" | "cierre"
  const semanaPasada = lunesAnterior(semanaActual);

  const areasLimpieza = useMemo(() => Array.from(new Set(tareas.map((t) => t.area).filter(Boolean))), [tareas]);

  const resumenPorArea = useMemo(() => {
    return areasLimpieza.map((area) => {
      const tareasArea = tareas.filter((t) => t.area === area);
      const hechasSemanaPasada = new Set(
        registros.filter((r) => r.semana === semanaPasada && r.area === area).map((r) => r.tareaId)
      );
      const faltaron = tareasArea.filter((t) => !hechasSemanaPasada.has(t.id));
      return { area, total: tareasArea.length, faltaron };
    }).filter((r) => r.total > 0);
  }, [areasLimpieza, tareas, registros, semanaPasada]);

  const totalFaltantes = resumenPorArea.reduce((s, r) => s + r.faltaron.length, 0);

  return (
    <div className="px-5 pt-4 pb-10">
      <button
        onClick={onSalir}
        className="w-full flex items-center justify-between px-4 py-3 mb-4 rounded-xl"
        style={{ background: C.ink, color: "#fff" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Modo Gerente</span>
        <span style={{ fontSize: 12, textDecoration: "underline" }}>Salir</span>
      </button>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSeccion("limpieza")}
          className="flex-1 py-2 rounded-xl text-sm font-semibold"
          style={{ background: seccion === "limpieza" ? C.accent : C.bg, color: seccion === "limpieza" ? "#fff" : C.ink, border: `1px solid ${C.line}` }}
        >
          Limpieza (semanal)
        </button>
        <button
          onClick={() => setSeccion("cierre")}
          className="flex-1 py-2 rounded-xl text-sm font-semibold"
          style={{ background: seccion === "cierre" ? C.accent : C.bg, color: seccion === "cierre" ? "#fff" : C.ink, border: `1px solid ${C.line}` }}
        >
          Cierre (diario)
        </button>
      </div>

      {seccion === "limpieza" ? (
        <>
          <div className="mb-4">
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>
              Semana pasada: {formatSemana(semanaPasada)}
            </div>
            <p style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>
              Actividades de limpieza que no se marcaron como hechas.
            </p>
          </div>

          {resumenPorArea.length === 0 ? (
            <p className="text-center py-10" style={{ color: C.inkSoft, fontSize: 14 }}>
              Todavía no hay actividades registradas en ninguna área.
            </p>
          ) : totalFaltantes === 0 ? (
            <div className="rounded-2xl p-4 flex items-center gap-2" style={{ background: C.okBg, border: `1px solid ${C.line}` }}>
              <Check size={16} style={{ color: C.ok }} />
              <span style={{ fontSize: 13, color: C.ok, fontWeight: 600 }}>Se completó todo en todas las áreas la semana pasada.</span>
            </div>
          ) : (
            resumenPorArea.map(({ area, faltaron, total }) => (
              <div key={area} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 13, fontWeight: 700, color: faltaron.length > 0 ? C.critical : C.ok, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    {area}
                  </span>
                  <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {total - faltaron.length}/{total} completadas
                  </span>
                </div>
                {faltaron.length === 0 ? (
                  <div className="rounded-xl px-4 py-2.5" style={{ background: C.okBg }}>
                    <span style={{ fontSize: 12.5, color: C.ok }}>Todo completado ✓</span>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
                    {faltaron.map((t, idx) => (
                      <div key={t.id} className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none" }}>
                        <AlertTriangle size={14} style={{ color: C.critical, flexShrink: 0 }} />
                        <span style={{ fontSize: 13.5 }}>{t.nombre}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </>
      ) : (
        <CierreSeccion />
      )}
    </div>
  );
}

function CierreSeccion() {
  const [tareas, setTareas] = useState(null);
  const [registros, setRegistros] = useState(null);
  const [showCatalogo, setShowCatalogo] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, r] = await Promise.all([cargarTareasCierre(), cargarRegistrosCierre()]);
      setTareas(t);
      setRegistros(r);
    })();
  }, []);

  async function agregarTarea(tarea) {
    const nuevas = [...tareas, { ...tarea, id: uid() }];
    setTareas(nuevas);
    await guardarTareasCierre(nuevas);
  }

  async function eliminarTarea(id) {
    const nuevas = tareas.filter((t) => t.id !== id);
    setTareas(nuevas);
    await guardarTareasCierre(nuevas);
  }

  async function toggleHecha(tarea, yaHecha) {
    const hoy = hoyKey();
    let nuevos;
    if (yaHecha) {
      nuevos = registros.filter((r) => !(r.fechaKey === hoy && r.tareaId === tarea.id));
    } else {
      nuevos = [...registros, { id: uid(), tareaId: tarea.id, area: tarea.area, fechaKey: hoy, fecha: new Date().toISOString() }];
    }
    setRegistros(nuevos);
    await guardarRegistrosCierre(nuevos);
  }

  if (tareas === null || registros === null) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" size={22} style={{ color: C.accent }} /></div>;
  }

  const hoy = hoyKey();
  const hechasHoy = new Set(registros.filter((r) => r.fechaKey === hoy).map((r) => r.tareaId));
  const areas = Array.from(new Set(tareas.map((t) => t.area).filter(Boolean)));
  const totalHoy = tareas.length;
  const completadasHoy = tareas.filter((t) => hechasHoy.has(t.id)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>Cierre de hoy</div>
          <p style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>{completadasHoy}/{totalHoy} verificadas</p>
        </div>
        <button onClick={() => setShowCatalogo(true)} className="text-xs font-semibold" style={{ color: C.accent }}>
          Editar actividades
        </button>
      </div>

      {tareas.length === 0 ? (
        <p className="text-center py-10" style={{ color: C.inkSoft, fontSize: 14 }}>
          No hay actividades de cierre registradas todavía.{" "}
          <button onClick={() => setShowCatalogo(true)} style={{ color: C.accent, textDecoration: "underline" }}>
            Agrega la primera
          </button>
        </p>
      ) : (
        areas.map((area) => {
          const tareasArea = tareas.filter((t) => t.area === area);
          return (
            <div key={area} className="mb-4">
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {area}
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
                {tareasArea.map((t, idx) => {
                  const hecha = hechasHoy.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleHecha(t, hecha)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none", opacity: hecha ? 0.6 : 1 }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ border: `1.5px solid ${hecha ? C.accent : C.line}`, background: hecha ? C.accent : "transparent" }}
                      >
                        {hecha && <Check size={13} color="#fff" />}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, textDecoration: hecha ? "line-through" : "none" }}>{t.nombre}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {showCatalogo && (
        <CatalogoCierreModal
          tareas={tareas}
          onCerrar={() => setShowCatalogo(false)}
          onAgregar={agregarTarea}
          onEliminar={eliminarTarea}
        />
      )}
    </div>
  );
}

function CatalogoCierreModal({ tareas, onCerrar, onAgregar, onEliminar }) {
  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState(AREAS_DEFAULT[0]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState("");

  function agregar() {
    if (!nombre.trim()) return setError("Escribe el nombre de la actividad.");
    onAgregar({ nombre: nombre.trim(), area });
    setNombre("");
    setError("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(34,31,26,0.45)" }} onClick={onCerrar}>
      <div className="w-full rounded-t-3xl p-5" style={{ background: C.paper, maxWidth: 640, margin: "0 auto", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>Actividades de cierre</h2>
          <button onClick={onCerrar}><X size={20} style={{ color: C.inkSoft }} /></button>
        </div>
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 14 }}>
          Se reinician todos los días. Solo el Gerente puede marcarlas como hechas.
        </p>

        <div className="flex gap-2 mb-2">
          <select value={area} onChange={(e) => setArea(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm" style={fieldInput}>
            {AREAS_DEFAULT.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Apagar freidoras"
            className="flex-1 px-3 py-2.5 rounded-xl text-sm"
            style={fieldInput}
          />
          <button onClick={agregar} className="px-4 rounded-xl text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
            <Plus size={16} />
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: C.criticalBg, color: C.critical, fontSize: 13 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {tareas.length === 0 ? (
          <p className="text-center py-6" style={{ color: C.inkSoft, fontSize: 13 }}>Sin actividades todavía.</p>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
            {tareas.map((t, idx) => (
              <div key={t.id} className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none" }}>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13.5 }}>{t.nombre}</div>
                  <div style={{ fontSize: 10.5, color: C.inkSoft }}>{t.area}</div>
                </div>
                {confirmDelete === t.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { onEliminar(t.id); setConfirmDelete(null); }} className="p-1.5 rounded-full" style={{ background: C.critical }}>
                      <Check size={12} color="#fff" />
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-full" style={{ background: C.bg }}>
                      <X size={12} style={{ color: C.inkSoft }} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(t.id)} className="p-1.5">
                    <Trash2 size={14} style={{ color: C.inkSoft }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
