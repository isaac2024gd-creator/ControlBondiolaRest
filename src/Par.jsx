/* PAR — Control de inventario y compras (v2 — versión Supabase, integrada en Control Bondiola) */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Package, ClipboardList, Receipt, Plus, Minus, Trash2, Search,
  ChevronDown, ChevronRight, Check, X, AlertTriangle, Loader2,
  Pencil, RotateCcw, Save, Camera, TrendingUp, BarChart2,
  Download, Upload, Copy, ClipboardCopy
} from "lucide-react";

/* Mismo proyecto Supabase que Checador/DÍA/Limpieza — tabla propia de PAR */
const SUPABASE_URL = "https://ciwfhbpcpygubsvtmwze.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AF_54iVTwT25rhMrhWbFXQ_oW2z_NeF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function kvGet(key, tabla = "kv_store") {
  const { data, error } = await supabase.from(tabla).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

async function kvSet(key, value, tabla = "kv_store") {
  const { error } = await supabase.from(tabla).upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  return true;
}

/* Lee el historial diario de DÍA (misma base de datos, tabla propia) para calcular
   cuánto se ha consumido de cada producto vinculado desde el último conteo real de PAR. */
async function cargarHistorialDia() {
  try {
    return (await kvGet("dia_historial_v1", "kv_store_dia")) || [];
  } catch (e) {
    return [];
  }
}

function parKeyDe(item) {
  return `${item.nombre.trim().toLowerCase()}|${item.unidad}`;
}

/* Suma el consumo diario registrado en DÍA para un producto, desde una fecha (exclusiva) hasta hoy. */
function consumoDesde(historialDia, key, desdeIso) {
  let total = 0;
  historialDia.forEach((registro) => {
    if (desdeIso && registro.fecha <= desdeIso) return;
    registro.items.forEach((i) => {
      if (i.parKey === key) {
        total += Math.max(0, (i.nivelMinimo || 0) - (i.stockActual || 0));
      }
    });
  });
  return total;
}

/* ---------- Tokens ---------- */
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

const UNIDADES = ["pza", "kg", "g", "lt", "ml", "caja", "paquete", "botella"];
const CATEGORIAS_DEFAULT = [
  "Producción", "Abarrotes", "Bebidas e Insumos de Café", "Insumos de Servicio",
  "Proteína, Quesos y Lácteos", "Pan y Tortillas", "Insumos de Limpieza", "Desechables",
];
const AREAS_DEFAULT = ["Cocina Caliente", "Cocina Fría", "Servicio PA", "Barra PB", "Almacén"];

const SEED_ITEMS = [
  { id: "s1", nombre: "Leche entera", categoria: "Proteína, Quesos y Lácteos", unidad: "lt", parLevel: 12, stockActual: 5, proveedor: "", area: "Cocina Fría" },
  { id: "s1b", nombre: "Leche entera", categoria: "Proteína, Quesos y Lácteos", unidad: "lt", parLevel: 8, stockActual: 3, proveedor: "", area: "Barra PB" },
  { id: "s2", nombre: "Café en grano", categoria: "Bebidas e Insumos de Café", unidad: "kg", parLevel: 5, stockActual: 2, proveedor: "", area: "Barra PB" },
  { id: "s3", nombre: "Refresco de cola", categoria: "Bebidas e Insumos de Café", unidad: "caja", parLevel: 3, stockActual: 3, proveedor: "", area: "Barra PB" },
  { id: "s4", nombre: "Servilletas", categoria: "Insumos de Servicio", unidad: "paquete", parLevel: 10, stockActual: 4, proveedor: "", area: "Servicio PA" },
  { id: "s5", nombre: "Pan para hamburguesa", categoria: "Pan y Tortillas", unidad: "paquete", parLevel: 8, stockActual: 1, proveedor: "", area: "Cocina Caliente" },
  { id: "s6", nombre: "Jitomate", categoria: "Producción", unidad: "kg", parLevel: 6, stockActual: 3.5, proveedor: "", area: "Cocina Fría" },
  { id: "s7", nombre: "Pechuga de pollo", categoria: "Proteína, Quesos y Lácteos", unidad: "kg", parLevel: 10, stockActual: 6, proveedor: "", area: "Cocina Caliente" },
  { id: "s8", nombre: "Jabón para trastes", categoria: "Insumos de Limpieza", unidad: "botella", parLevel: 4, stockActual: 4, proveedor: "", area: "Almacén" },
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function storageSetRetry(key, value, intentos = 3) {
  let ultimoError = null;
  for (let i = 0; i < intentos; i++) {
    try {
      const ok = await kvSet(key, value);
      if (ok) return { ok: true };
      ultimoError = new Error("respuesta vacía del servidor");
    } catch (e) {
      ultimoError = e;
    }
    if (i < intentos - 1) await sleep(500 * (i + 1));
  }
  return { ok: false, error: ultimoError };
}

function uid() { return Math.random().toString(36).slice(2, 10); }

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
  if (["pza", "caja", "paquete", "botella"].includes(unidad)) return Math.ceil(qty);
  return Math.round(qty * 10) / 10;
}

function statusOf(item) {
  if (item.stockActual <= 0) return "critical";
  if (item.stockActual < item.parLevel * 0.5) return "critical";
  if (item.stockActual < item.parLevel) return "warn";
  return "ok";
}

function consolidateItems(items) {
  const map = {};
  items.forEach((i) => {
    const key = `${i.nombre.trim().toLowerCase()}|${i.unidad}|${(i.proveedor || "").trim().toLowerCase()}`;
    if (!map[key]) {
      map[key] = {
        id: key,
        nombre: i.nombre,
        unidad: i.unidad,
        categoria: i.categoria,
        proveedor: i.proveedor,
        parLevel: 0,
        stockActual: 0,
        areas: [],
      };
    }
    map[key].parLevel += i.parLevel;
    map[key].stockActual += i.stockActual;
    if (i.area) map[key].areas.push(i.area);
  });
  return Object.values(map);
}

async function appendHistorial(items, fecha) {
  try {
    let hist = [];
    try {
      const val = await kvGet("historial_conteos_v2");
      hist = val || [];
    } catch (e) {
      hist = [];
    }
    hist.push({
      fecha,
      items: items.map((i) => ({
        nombre: i.nombre, unidad: i.unidad, categoria: i.categoria,
        proveedor: i.proveedor, area: i.area, parLevel: i.parLevel, stockActual: i.stockActual,
      })),
    });
    if (hist.length > 30) hist = hist.slice(hist.length - 30);
    await storageSetRetry("historial_conteos_v2", hist);
  } catch (e) {
    /* no bloquea el guardado del conteo si el historial falla */
  }
}

const STATUS_STYLE = {
  ok: { color: C.ok, bg: C.okBg, label: "Al par" },
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

/* ---------- Small UI atoms ---------- */
function Toast({ text }) {
  if (!text) return null;
  return (
    <div
      className="fixed left-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-sm"
      style={{
        bottom: "88px", transform: "translateX(-50%)",
        background: C.accentDark, color: "#fff",
        fontFamily: "'Inter', sans-serif",
      }}
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

/* ---------- App ---------- */
export default function Par() {
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState("conteo");
  const [toast, setToast] = useState("");
  const [showRespaldo, setShowRespaldo] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => { load(); }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  async function load() {
    try {
      const val = await kvGet("par_items_v2");
      if (val) {
        setItems(val);
      } else {
        setItems(SEED_ITEMS);
        await kvSet("par_items_v2", SEED_ITEMS);
      }
    } catch (e) {
      setItems(SEED_ITEMS);
    }
  }

  async function persist(newItems) {
    setItems(newItems);
    const res = await storageSetRetry("par_items_v2", newItems);
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

      <Header onRespaldo={() => setShowRespaldo(true)} />

      <main className="flex-1 overflow-y-auto pb-24" style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
        {tab === "conteo" && <ConteoTab items={items} onSave={persist} showToast={showToast} />}
        {tab === "inventario" && <InventarioTab items={items} onSave={persist} showToast={showToast} />}
        {tab === "lista" && <ListaTab items={items} onSave={persist} showToast={showToast} />}
        {tab === "consumo" && <ConsumoTab items={items} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} items={items} />
      <Toast text={toast} />
      {showRespaldo && (
        <RespaldoModal
          items={items}
          onCerrar={() => setShowRespaldo(false)}
          onImportar={(nuevos) => { persist(nuevos); showToast("Datos cargados en este dispositivo"); setShowRespaldo(false); }}
        />
      )}
    </div>
  );
}

function Header({ onRespaldo }) {
  const today = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return (
    <header className="px-5 pt-6 pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-baseline justify-between">
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: "0.5px" }}>
          PAR
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={onRespaldo} className="flex items-center gap-1" style={{ color: C.inkSoft }}>
            <ClipboardCopy size={16} />
          </button>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.inkSoft, textTransform: "capitalize" }}>
            {today}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Control de inventario y compras</p>
    </header>
  );
}

function RespaldoModal({ items, onCerrar, onImportar }) {
  const [modo, setModo] = useState("exportar");
  const [texto, setTexto] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState("");
  const [pruebaExterna, setPruebaExterna] = useState(null); // null | "probando" | "ok" | "fallo"

  async function probarConexionExterna() {
    setPruebaExterna("probando");
    try {
      const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
      if (res.ok) {
        await res.json();
        setPruebaExterna("ok");
      } else {
        setPruebaExterna("fallo");
      }
    } catch (e) {
      setPruebaExterna("fallo");
    }
  }

  const datosActuales = JSON.stringify(items, null, 0);

  function copiar() {
    try {
      navigator.clipboard.writeText(datosActuales);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      setError("No se pudo copiar automáticamente, selecciona el texto y cópialo manualmente.");
    }
  }

  function descargar() {
    try {
      const blob = new Blob([datosActuales], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `par-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("No se pudo descargar el archivo en este dispositivo.");
    }
  }

  function descargarCSV() {
    try {
      const headers = ["nombre", "categoria", "area", "unidad", "parLevel", "stockActual", "proveedor"];
      const filas = items.map((i) =>
        headers.map((h) => `"${String(i[h] ?? "").replace(/"/g, '""')}"`).join(",")
      );
      const csv = [headers.join(","), ...filas].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `par-inventario-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("No se pudo generar el CSV en este dispositivo.");
    }
  }

  function cargar() {
    try {
      const parsed = JSON.parse(texto.trim());
      if (!Array.isArray(parsed)) throw new Error("El texto no es una lista de productos válida.");
      onImportar(parsed);
    } catch (e) {
      setError("El texto pegado no es válido. Revisa que sea exactamente lo que copiaste del otro dispositivo.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(34,31,26,0.45)" }} onClick={onCerrar}>
      <div
        className="w-full rounded-t-3xl p-5"
        style={{ background: C.paper, maxWidth: 640, margin: "0 auto", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>Respaldo manual</h2>
          <button onClick={onCerrar}><X size={20} style={{ color: C.inkSoft }} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 14 }}>
          Úsalo si el guardado automático está fallando: copia los datos de un teléfono y pégalos en el otro para que ambos vean lo mismo.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setModo("exportar")}
            className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{ background: modo === "exportar" ? C.accent : C.bg, color: modo === "exportar" ? "#fff" : C.ink, border: `1px solid ${C.line}` }}
          >
            Exportar
          </button>
          <button
            onClick={() => setModo("importar")}
            className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{ background: modo === "importar" ? C.accent : C.bg, color: modo === "importar" ? "#fff" : C.ink, border: `1px solid ${C.line}` }}
          >
            Importar
          </button>
        </div>

        {modo === "exportar" ? (
          <>
            <div className="flex gap-2 mb-3">
              <button onClick={copiar} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
                <Copy size={15} /> {copiado ? "¡Copiado!" : "Copiar datos"}
              </button>
              <button onClick={descargar} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold" style={{ border: `1px solid ${C.line}` }}>
                <Download size={15} /> JSON
              </button>
              <button onClick={descargarCSV} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold" style={{ border: `1px solid ${C.line}` }}>
                <Download size={15} /> CSV
              </button>
            </div>
            <textarea
              readOnly
              value={datosActuales}
              onFocus={(e) => e.target.select()}
              className="w-full p-3 rounded-xl text-xs"
              style={{ height: 140, border: `1px solid ${C.line}`, background: C.bg, fontFamily: "'IBM Plex Mono', monospace", color: C.inkSoft }}
            />
            <p style={{ fontSize: 11, color: C.inkSoft, marginTop: 8 }}>
              Copia esto y mándalo por WhatsApp (o lo que uses) al otro teléfono, para que ahí lo peguen en "Importar".
            </p>

            <div className="mt-4 pt-4" style={{ borderTop: `1px dashed ${C.line}` }}>
              <p style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 8 }}>
                Antes de conectar a un servicio externo (Supabase, etc.), esto revisa si este artefacto puede hablar con servidores externos:
              </p>
              <button
                onClick={probarConexionExterna}
                disabled={pruebaExterna === "probando"}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ border: `1px solid ${C.line}` }}
              >
                {pruebaExterna === "probando" && <Loader2 size={14} className="animate-spin" />}
                Probar conexión externa
              </button>
              {pruebaExterna === "ok" && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: C.okBg, color: C.ok, fontSize: 12.5 }}>
                  <Check size={14} /> Sí se pudo conectar. Un servicio externo (Supabase, etc.) es viable.
                </div>
              )}
              {pruebaExterna === "fallo" && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: C.criticalBg, color: C.critical, fontSize: 12.5 }}>
                  <AlertTriangle size={14} /> Bloqueado. Este artefacto no puede llamar servidores externos — Supabase tampoco funcionaría desde aquí.
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pega aquí el texto que copiaste del otro dispositivo..."
              className="w-full p-3 rounded-xl text-xs mb-3"
              style={{ height: 140, border: `1px solid ${C.line}`, background: C.bg, fontFamily: "'IBM Plex Mono', monospace" }}
            />
            {error && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: C.criticalBg, color: C.critical, fontSize: 12.5 }}>
                <AlertTriangle size={14} /> {error}
              </div>
            )}
            <button onClick={cargar} disabled={!texto.trim()} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: texto.trim() ? 1 : 0.5 }}>
              Cargar estos datos en este dispositivo
            </button>
            <p style={{ fontSize: 11, color: C.critical, marginTop: 8 }}>
              Esto reemplaza todo el inventario visible en este teléfono. Si el guardado automático se arregla después, esta importación no se sube sola — vuelve a intentarlo desde Inventario.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab, items }) {
  const faltantes = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      const key = `${i.nombre.trim().toLowerCase()}|${i.unidad}|${(i.proveedor || "").trim().toLowerCase()}`;
      map[key] = map[key] || { par: 0, stock: 0 };
      map[key].par += i.parLevel;
      map[key].stock += i.stockActual;
    });
    return Object.values(map).filter((v) => v.stock < v.par).length;
  }, [items]);
  const NavBtn = ({ id, icon: Icon, label, badge }) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative"
        style={{ color: active ? C.accent : C.inkSoft }}
      >
        <div className="relative">
          <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
          {badge > 0 && (
            <span
              className="absolute -top-1.5 -right-2 flex items-center justify-center rounded-full"
              style={{ minWidth: 16, height: 16, fontSize: 10, background: C.critical, color: "#fff", padding: "0 3px", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {badge}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{label}</span>
      </button>
    );
  };
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex"
      style={{ background: C.paper, borderTop: `1px solid ${C.line}`, maxWidth: 640, margin: "0 auto" }}
    >
      <NavBtn id="conteo" icon={ClipboardList} label="Conteo" />
      <NavBtn id="inventario" icon={Package} label="Inventario" />
      <NavBtn id="lista" icon={Receipt} label="Lista" badge={faltantes} />
      <NavBtn id="consumo" icon={TrendingUp} label="Consumo" />
    </nav>
  );
}

/* ---------- CONTEO TAB ---------- */
function ConteoTab({ items, onSave, showToast }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.stockActual])));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({});
  const [areaActual, setAreaActual] = useState(undefined); // undefined = cargando, null = sin elegir
  const [cambiandoArea, setCambiandoArea] = useState(false);
  const [historialDia, setHistorialDia] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const hayCambios = items.some((i) => {
    const val = draft[i.id];
    return val !== undefined && val !== i.stockActual;
  });

  useEffect(() => {
    (async () => setHistorialDia(await cargarHistorialDia()))();
  }, []);

  function teoricoDe(item) {
    if (!historialDia) return null;
    const key = parKeyDe(item);
    const consumo = consumoDesde(historialDia, key, item.ultimaActualizacion);
    const hayDatos = historialDia.some((r) => r.items.some((i) => i.parKey === key));
    if (!hayDatos) return null;
    return Math.round((item.stockActual - consumo) * 10) / 10;
  }

  useEffect(() => {
    setDraft(Object.fromEntries(items.map((i) => [i.id, i.stockActual])));
  }, [items]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("par_area_actual");
      setAreaActual(saved || null);
    } catch (e) {
      setAreaActual(null);
    }
  }, []);

  async function elegirArea(area) {
    setAreaActual(area);
    setCambiandoArea(false);
    try { localStorage.setItem("par_area_actual", area); } catch (e) {}
  }

  const areasDisponibles = useMemo(() => {
    const set = new Set(items.map((i) => i.area).filter(Boolean));
    return Array.from(set);
  }, [items]);

  const sinArea = items.some((i) => !i.area);

  const itemsDelArea = useMemo(() => {
    if (areaActual === "__todas__") return items;
    if (areaActual === "__sinArea__") return items.filter((i) => !i.area);
    return items.filter((i) => i.area === areaActual);
  }, [items, areaActual]);

  const subareas = useMemo(() => {
    const set = new Set(itemsDelArea.map((i) => i.subarea?.trim() || "Sin subárea"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [itemsDelArea]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = {};
    itemsDelArea.forEach((i) => {
      if (q && !i.nombre.toLowerCase().includes(q)) return;
      const sub = i.subarea?.trim() || "Sin subárea";
      map[sub] = map[sub] || [];
      map[sub].push(i);
    });
    return map;
  }, [itemsDelArea, query]);

  function setVal(id, val) {
    const num = Math.max(0, val);
    setDraft((d) => ({ ...d, [id]: num }));
    setGuardado(false);
  }

  async function guardar() {
    setGuardando(true);
    const fecha = new Date().toISOString();
    const updated = items.map((i) => ({
      ...i,
      stockActual: draft[i.id] ?? i.stockActual,
      ultimaActualizacion: fecha,
    }));
    onSave(updated);
    await appendHistorial(updated, fecha);
    setGuardando(false);
    setGuardado(true);
    showToast("Conteo guardado");
  }

  if (areaActual === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin" size={22} style={{ color: C.accent }} />
      </div>
    );
  }

  if (areaActual === null || cambiandoArea) {
    return (
      <AreaPicker
        areas={areasDisponibles}
        sinArea={sinArea}
        onElegir={elegirArea}
        onCancelar={areaActual && cambiandoArea ? () => setCambiandoArea(false) : null}
      />
    );
  }

  const nombreAreaActual =
    areaActual === "__todas__" ? "Todas las áreas" : areaActual === "__sinArea__" ? "Sin área asignada" : areaActual;

  const fechasArea = itemsDelArea.map((i) => i.ultimaActualizacion).filter(Boolean).sort();
  const ultimoConteoArea = fechasArea.length ? fechasArea[fechasArea.length - 1] : null;

  return (
    <div className="px-5 pt-4">
      <button
        onClick={() => setCambiandoArea(true)}
        className="w-full flex items-center justify-between px-4 py-3 mb-3 rounded-xl"
        style={{ background: C.accent, color: "#fff" }}
      >
        <div className="text-left">
          <div style={{ fontSize: 13, fontWeight: 600 }}>Contando: {nombreAreaActual}</div>
          {ultimoConteoArea && (
            <div style={{ fontSize: 11, opacity: 0.85 }}>Último conteo: {formatFecha(ultimoConteoArea)}</div>
          )}
        </div>
        <span style={{ fontSize: 12, textDecoration: "underline" }}>Cambiar área</span>
      </button>

      <div className="relative mb-3">
        <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: C.inkSoft }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ border: `1px solid ${C.line}`, background: C.paper }}
        />
      </div>

      <p style={{ fontSize: 11, color: C.inkSoft, marginBottom: 10 }}>
        Agrupado por dónde se encuentra cada producto en {nombreAreaActual}.
      </p>

      {subareas.filter((sub) => grouped[sub]?.length).map((sub) => (
        <div key={sub} className="mb-3 rounded-2xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <button
            onClick={() => setOpen((o) => ({ ...o, [sub]: o[sub] === undefined ? false : !o[sub] }))}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>{sub}</span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{grouped[sub].length}</span>
              {(open[sub] === undefined ? true : open[sub]) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          </button>
          {(open[sub] === undefined ? true : open[sub]) && (
            <div>
              {grouped[sub].map((item) => {
                const val = draft[item.id] ?? 0;
                const status = statusOf({ ...item, stockActual: val });
                const s = STATUS_STYLE[status];
                const teorico = teoricoDe(item);
                const diferencia = teorico !== null ? Math.round((val - teorico) * 10) / 10 : null;
                return (
                  <div key={item.id} className="flex flex-col gap-1.5 px-4 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  <div className="flex items-center gap-3">
                    <ItemThumb foto={item.foto} size={44} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{item.nombre}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 10, background: C.bg, color: C.inkSoft, border: `1px solid ${C.line}` }}>
                          {item.categoria}
                        </span>
                        <span style={{ fontSize: 11.5, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {item.unidad}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setVal(item.id, roundStep(val, item.unidad, -1))}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: C.bg, border: `1px solid ${C.line}` }}
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={val}
                        onChange={(e) => setVal(item.id, parseFloat(e.target.value) || 0)}
                        className="text-center rounded-lg py-1"
                        style={{
                          width: 56, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 14,
                          border: `1px solid ${C.line}`, background: s.bg, color: s.color,
                        }}
                      />
                      <button
                        onClick={() => setVal(item.id, roundStep(val, item.unidad, 1))}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: C.bg, border: `1px solid ${C.line}` }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  {teorico !== null && (
                    <div className="flex items-center gap-1.5 pl-[52px]" style={{ fontSize: 11 }}>
                      <span style={{ color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                        Teórico (según DÍA): {fmtNum(teorico)} {item.unidad}
                      </span>
                      {Math.abs(diferencia) >= 0.5 && (
                        <span
                          className="px-1.5 py-0.5 rounded font-semibold"
                          style={{
                            background: diferencia < 0 ? C.criticalBg : C.warnBg,
                            color: diferencia < 0 ? C.critical : C.warn,
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {diferencia > 0 ? "+" : ""}{fmtNum(diferencia)} vs. contado
                        </span>
                      )}
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {itemsDelArea.length === 0 && (
        <p className="text-center py-10" style={{ color: C.inkSoft, fontSize: 14 }}>
          No hay productos asignados a esta área todavía. Ve a Inventario y asígnales un área.
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
          {guardando ? "Guardando..." : "Guardar conteo"}
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

function AreaPicker({ areas, sinArea, onElegir, onCancelar }) {
  return (
    <div className="px-5 pt-8">
      <div className="text-center mb-6">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>¿En qué área trabajas?</h2>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Elige tu área para ver solo lo que te toca contar.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {areas.map((a) => (
          <button
            key={a}
            onClick={() => onElegir(a)}
            className="w-full py-4 rounded-2xl text-left px-5 flex items-center justify-between"
            style={{ background: C.paper, border: `1px solid ${C.line}` }}
          >
            <span style={{ fontWeight: 600, fontSize: 15 }}>{a}</span>
            <ChevronRight size={18} style={{ color: C.inkSoft }} />
          </button>
        ))}

        {sinArea && (
          <button
            onClick={() => onElegir("__sinArea__")}
            className="w-full py-4 rounded-2xl text-left px-5 flex items-center justify-between"
            style={{ background: C.paper, border: `1px dashed ${C.line}` }}
          >
            <span style={{ fontWeight: 600, fontSize: 15, color: C.inkSoft }}>Sin área asignada</span>
            <ChevronRight size={18} style={{ color: C.inkSoft }} />
          </button>
        )}

        <button
          onClick={() => onElegir("__todas__")}
          className="w-full py-3.5 rounded-2xl text-center mt-1"
          style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.inkSoft, fontSize: 13, fontWeight: 500 }}
        >
          Ver todas las áreas (encargados)
        </button>

        {onCancelar && (
          <button onClick={onCancelar} className="w-full py-2 text-center" style={{ fontSize: 13, color: C.inkSoft }}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function roundStep(val, unidad, dir) {
  const step = ["pza", "caja", "paquete", "botella"].includes(unidad) ? 1 : 0.5;
  const next = val + dir * step;
  return Math.max(0, Math.round(next * 10) / 10);
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
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ border: `1px solid ${C.line}`, background: C.paper }}
          />
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 rounded-xl text-sm font-semibold"
          style={{ background: C.accent, color: "#fff" }}
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {filtered.map((item) => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <ItemThumb foto={item.foto} size={44} />
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 14, fontWeight: 500 }}>{item.nombre}</div>
            <div style={{ fontSize: 11.5, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
              {item.categoria} · Par {fmtNum(item.parLevel)} {item.unidad}{item.area ? ` · ${item.area}` : ""}{item.subarea ? ` · ${item.subarea}` : ""}{item.proveedor ? ` · ${item.proveedor}` : ""}
            </div>
            {item.ultimaActualizacion && (
              <div style={{ fontSize: 10.5, color: C.inkSoft, opacity: 0.75, marginTop: 1 }}>
                Contado: {formatFecha(item.ultimaActualizacion)}
              </div>
            )}
          </div>
          <button onClick={() => { setEditing(item); setShowForm(true); }} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: C.bg }}>
            <Pencil size={14} style={{ color: C.inkSoft }} />
          </button>
          <button onClick={() => setConfirmDelete(item.id)} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: C.criticalBg }}>
            <Trash2 size={14} style={{ color: C.critical }} />
          </button>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-center py-10" style={{ color: C.inkSoft, fontSize: 14 }}>Sin resultados.</p>
      )}

      {showForm && (
        <ItemForm
          initial={editing}
          categorias={Array.from(new Set([...CATEGORIAS_DEFAULT, ...items.map((i) => i.categoria)]))}
          proveedores={Array.from(new Set(items.map((i) => i.proveedor?.trim()).filter(Boolean)))}
          areas={Array.from(new Set([...AREAS_DEFAULT, ...items.map((i) => i.area).filter(Boolean)]))}
          subareas={Array.from(new Set(items.map((i) => i.subarea?.trim()).filter(Boolean)))}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSubmit={upsert}
        />
      )}

      {confirmDelete && (
        <ConfirmSheet
          text="¿Eliminar este producto del inventario? Esta acción no se puede deshacer."
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete)}
        />
      )}
    </div>
  );
}

function ItemForm({ initial, categorias, proveedores, areas, subareas, onCancel, onSubmit }) {
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [categoria, setCategoria] = useState(initial?.categoria || categorias[0] || "");
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [unidad, setUnidad] = useState(initial?.unidad || "pza");
  const [parLevel, setParLevel] = useState(initial?.parLevel ?? "");
  const initialAreaValue = initial?.area?.trim()
    ? (areas.includes(initial.area.trim()) ? initial.area.trim() : "__nuevaArea__")
    : "__ningunaArea__";
  const [area, setArea] = useState(initialAreaValue);
  const [areaNueva, setAreaNueva] = useState(initialAreaValue === "__nuevaArea__" ? initial.area.trim() : "");
  const initialProvValue = initial?.proveedor?.trim()
    ? (proveedores.includes(initial.proveedor.trim()) ? initial.proveedor.trim() : "__nuevo__")
    : "__ninguno__";
  const [proveedor, setProveedor] = useState(initialProvValue);
  const [proveedorNuevo, setProveedorNuevo] = useState(initialProvValue === "__nuevo__" ? initial.proveedor.trim() : "");
  const initialSubareaValue = initial?.subarea?.trim()
    ? (subareas.includes(initial.subarea.trim()) ? initial.subarea.trim() : "__nuevaSubarea__")
    : "__ningunaSubarea__";
  const [subarea, setSubarea] = useState(initialSubareaValue);
  const [subareaNueva, setSubareaNueva] = useState(initialSubareaValue === "__nuevaSubarea__" ? initial.subarea.trim() : "");
  const [foto, setFoto] = useState(initial?.foto || "");
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState("");

  async function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoFoto(true);
    setError("");
    try {
      let dataUrl = await compressImage(file, 260, 0.6);
      if (dataUrl.length > 180000) dataUrl = await compressImage(file, 180, 0.45);
      if (dataUrl.length > 180000) {
        setError("La foto sigue muy pesada, intenta con otra o toma una de menor resolución.");
      } else {
        setFoto(dataUrl);
      }
    } catch (err) {
      setError("No se pudo procesar la foto, intenta con otra.");
    }
    setSubiendoFoto(false);
    e.target.value = "";
  }

  function submit() {
    const cat = categoria === "__nueva__" ? categoriaNueva.trim() : categoria;
    let prov = "";
    if (proveedor === "__nuevo__") prov = proveedorNuevo.trim();
    else if (proveedor !== "__ninguno__") prov = proveedor;
    let ar = "";
    if (area === "__nuevaArea__") ar = areaNueva.trim();
    else if (area !== "__ningunaArea__") ar = area;
    let sub = "";
    if (subarea === "__nuevaSubarea__") sub = subareaNueva.trim();
    else if (subarea !== "__ningunaSubarea__") sub = subarea;

    if (!nombre.trim()) return setError("Ponle un nombre al producto.");
    if (!cat) return setError("Elige o escribe una categoría.");
    if (parLevel === "" || isNaN(parLevel) || Number(parLevel) < 0) return setError("El par debe ser un número válido.");
    if (proveedor === "__nuevo__" && !prov) return setError("Escribe el nombre del proveedor nuevo.");
    if (area === "__nuevaArea__" && !ar) return setError("Escribe el nombre del área nueva.");
    if (subarea === "__nuevaSubarea__" && !sub) return setError("Escribe el nombre de la subárea nueva.");
    onSubmit({
      id: initial?.id,
      nombre: nombre.trim(),
      categoria: cat,
      unidad,
      parLevel: Number(parLevel),
      stockActual: initial?.stockActual ?? 0,
      proveedor: prov,
      area: ar,
      subarea: sub,
      foto,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end" style={{ background: "rgba(34,31,26,0.4)" }} onClick={onCancel}>
      <div
        className="w-full rounded-t-3xl p-5"
        style={{ background: C.paper, maxWidth: 640, margin: "0 auto", maxHeight: "88vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>
            {initial ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button onClick={onCancel}><X size={20} style={{ color: C.inkSoft }} /></button>
        </div>

        <label style={fieldLabel}>Foto del producto</label>
        <div className="flex items-center gap-3 mb-4">
          <ItemThumb foto={foto} size={64} />
          <div className="flex-1 flex flex-col gap-2">
            <label
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
              style={{ border: `1px solid ${C.line}`, background: C.bg }}
            >
              {subiendoFoto ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              {foto ? "Cambiar foto" : "Tomar / subir foto"}
              <input type="file" accept="image/*" capture="environment" onChange={handleFoto} className="hidden" />
            </label>
            {foto && (
              <button onClick={() => setFoto("")} className="text-xs" style={{ color: C.critical }}>
                Quitar foto
              </button>
            )}
          </div>
        </div>

        <label style={fieldLabel}>Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm" style={fieldInput} placeholder="Ej. Crema para café" />

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
            <label style={fieldLabel}>Par (debería haber)</label>
            <input type="number" inputMode="decimal" value={parLevel} onChange={(e) => setParLevel(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" style={fieldInput} placeholder="0" />
          </div>
        </div>

        <label style={fieldLabel}>Área</label>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full mb-1 px-3 py-2.5 rounded-xl text-sm" style={fieldInput}>
          <option value="__ningunaArea__">Sin área asignada</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          <option value="__nuevaArea__">+ Nueva área...</option>
        </select>
        {area === "__nuevaArea__" && (
          <input value={areaNueva} onChange={(e) => setAreaNueva(e.target.value)} placeholder="Nombre del área" className="w-full mb-1 px-3 py-2.5 rounded-xl text-sm" style={fieldInput} />
        )}
        <p style={{ fontSize: 11, color: C.inkSoft, marginBottom: 12 }}>
          Si el mismo producto se cuenta en varias áreas (ej. Barra y Cocina), regístralo una vez por área. En la lista de compras se suman automáticamente en una sola línea.
        </p>

        <label style={fieldLabel}>Subárea (ubicación dentro del área)</label>
        <select value={subarea} onChange={(e) => setSubarea(e.target.value)} className="w-full mb-1 px-3 py-2.5 rounded-xl text-sm" style={fieldInput}>
          <option value="__ningunaSubarea__">Sin subárea asignada</option>
          {subareas.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="__nuevaSubarea__">+ Nueva subárea...</option>
        </select>
        {subarea === "__nuevaSubarea__" && (
          <input value={subareaNueva} onChange={(e) => setSubareaNueva(e.target.value)} placeholder="Ej. Refrigerador 1, Anaquel superior..." className="w-full mb-1 px-3 py-2.5 rounded-xl text-sm" style={fieldInput} />
        )}
        <p style={{ fontSize: 11, color: C.inkSoft, marginBottom: 12 }}>
          Indica dónde se encuentra el producto dentro del área (ej. refrigerador, anaquel, barra).
        </p>

        <label style={fieldLabel}>Proveedor</label>
        <select value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm" style={fieldInput}>
          <option value="__ninguno__">Sin proveedor asignado</option>
          {proveedores.map((p) => <option key={p} value={p}>{p}</option>)}
          <option value="__nuevo__">+ Nuevo proveedor...</option>
        </select>
        {proveedor === "__nuevo__" && (
          <input value={proveedorNuevo} onChange={(e) => setProveedorNuevo(e.target.value)} placeholder="Nombre del proveedor" className="w-full mb-4 px-3 py-2.5 rounded-xl text-sm" style={fieldInput} />
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

/* ---------- LISTA DE COMPRAS TAB ---------- */
function itemKeyOf(i) {
  return `${i.nombre.trim().toLowerCase()}|${i.unidad}|${(i.proveedor || "").trim().toLowerCase()}`;
}

function ListaTab({ items, onSave, showToast }) {
  const consolidados = useMemo(() => consolidateItems(items), [items]);

  const necesarios = useMemo(() => {
    return consolidados
      .filter((i) => i.stockActual < i.parLevel)
      .map((i) => ({ ...i, faltante: roundQty(i.parLevel - i.stockActual, i.unidad) }))
      .sort((a, b) => statusRank(statusOf(a)) - statusRank(statusOf(b)));
  }, [consolidados]);

  const fechasConteo = items.map((i) => i.ultimaActualizacion).filter(Boolean).sort();
  const fechaConteo = fechasConteo.length ? fechasConteo[fechasConteo.length - 1] : null;
  const storageKey = `par_lista_checked_${fechaConteo || "sin_fecha"}`;

  const [checked, setChecked] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [comprando, setComprando] = useState(null); // item consolidado en proceso de registrar compra

  // si cambia el conteo (nueva semana), la lista de tachados también cambia de "cajón"
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setChecked(saved ? JSON.parse(saved) : {});
    } catch (e) {
      setChecked({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function guardarChecked(nuevo) {
    setChecked(nuevo);
    try { localStorage.setItem(storageKey, JSON.stringify(nuevo)); } catch (e) {}
  }

  function destacharSinComprar(id) {
    guardarChecked({ ...checked, [id]: false });
  }

  function registrarCompra(itemConsolidado, cantidadComprada) {
    const k = itemConsolidado.id;
    const matches = items.filter((i) => itemKeyOf(i) === k);
    const totalFaltante = matches.reduce((s, i) => s + Math.max(0, i.parLevel - i.stockActual), 0);
    const actualizados = items.map((i) => {
      if (itemKeyOf(i) !== k) return i;
      const faltanteItem = Math.max(0, i.parLevel - i.stockActual);
      const proporcion = totalFaltante > 0 ? faltanteItem / totalFaltante : 1 / matches.length;
      const agregar = Math.round(cantidadComprada * proporcion * 10) / 10;
      return { ...i, stockActual: Math.round((i.stockActual + agregar) * 10) / 10 };
    });
    onSave(actualizados);
    guardarChecked({ ...checked, [itemConsolidado.id]: true });
    setComprando(null);
    showToast(`${itemConsolidado.nombre}: se sumaron ${fmtNum(cantidadComprada)} ${itemConsolidado.unidad} al inventario.`);
  }

  const porProveedor = useMemo(() => {
    const map = {};
    necesarios.forEach((i) => {
      const key = i.proveedor?.trim() || "Sin proveedor asignado";
      map[key] = map[key] || [];
      map[key].push(i);
    });
    return map;
  }, [necesarios]);

  const comprados = necesarios.filter((i) => checked[i.id]).length;

  if (necesarios.length === 0) {
    return (
      <div className="px-5 pt-16 text-center">
        <Check size={40} style={{ color: C.ok, margin: "0 auto 12px" }} />
        <p style={{ fontWeight: 600, fontSize: 15 }}>Todo está al par</p>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>No hay productos por debajo de su nivel mínimo.</p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4">
      <div
        className="rounded-2xl p-4 mb-4"
        style={{
          background: C.paper,
          border: `1px dashed ${C.line}`,
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span style={{ fontWeight: 600, fontSize: 13 }}>LISTA DE COMPRAS</span>
          <span style={{ fontSize: 11, color: C.inkSoft }}>{fechaConteo ? formatFecha(fechaConteo) : new Date().toLocaleDateString("es-MX")}</span>
        </div>
        <div style={{ fontSize: 11, color: C.inkSoft }}>{comprados}/{necesarios.length} comprados</div>
      </div>

      {Object.entries(porProveedor).map(([prov, list]) => (
        <div key={prov} className="mb-4">
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {prov}
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
            {list.map((item, idx) => {
              const status = statusOf(item);
              const s = STATUS_STYLE[status];
              const isChecked = !!checked[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => (isChecked ? destacharSinComprar(item.id) : setComprando(item))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{ borderTop: idx > 0 ? `1px solid ${C.line}` : "none", opacity: isChecked ? 0.5 : 1 }}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ border: `1.5px solid ${isChecked ? C.accent : C.line}`, background: isChecked ? C.accent : "transparent" }}
                  >
                    {isChecked && <Check size={13} color="#fff" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 500, textDecoration: isChecked ? "line-through" : "none" }}>{item.nombre}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 10, background: s.bg, color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {s.label}
                      </span>
                      <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                        hay {fmtNum(item.stockActual)} / par {fmtNum(item.parLevel)}
                      </span>
                      {item.areas.length > 1 && (
                        <span style={{ fontSize: 10, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                          ({item.areas.join(" + ")})
                        </span>
                      )}
                    </div>
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

      {comprando && (
        <ComprarModal item={comprando} onCancelar={() => setComprando(null)} onConfirmar={registrarCompra} />
      )}
    </div>
  );
}

function ComprarModal({ item, onCancelar, onConfirmar }) {
  const [cantidad, setCantidad] = useState(String(item.faltante));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(34,31,26,0.5)" }} onClick={onCancelar}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: C.paper }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{item.nombre}</span>
          <button onClick={onCancelar}><X size={20} style={{ color: C.inkSoft }} /></button>
        </div>
        <p style={{ fontSize: 12, color: C.inkSoft, marginBottom: 14 }}>
          Se necesitaba {fmtNum(item.faltante)} {item.unidad} (comprado o producido). Ajusta según lo que realmente entró — se suma directo a tu inventario.
        </p>
        <label style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, marginBottom: 4, display: "block" }}>
          ¿Cuánto conseguiste o produjiste?
        </label>
        <div className="flex items-center gap-2 mb-4">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && Number(cantidad) > 0 && onConfirmar(item, Number(cantidad))}
            className="flex-1 px-3 py-3 rounded-xl text-2xl font-black text-center outline-none"
            style={{ border: `1px solid ${C.line}`, background: C.bg, color: C.ink }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, flexShrink: 0 }}>{item.unidad}</span>
        </div>
        <button
          onClick={() => onConfirmar(item, Number(cantidad))}
          disabled={!cantidad || Number(cantidad) <= 0}
          className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
          style={{ background: C.accent, color: "#fff" }}
        >
          Registrar entrada al inventario
        </button>
      </div>
    </div>
  );
}

function statusRank(s) { return s === "critical" ? 0 : s === "warn" ? 1 : 2; }

/* ---------- CONSUMO TAB ---------- */
function ConsumoTab({ items }) {
  const [historial, setHistorial] = useState(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const val = await kvGet("historial_conteos_v2");
        setHistorial(val || []);
      } catch (e) {
        setHistorial([]);
      }
    })();
  }, [items]);

  const productos = useMemo(() => {
    if (!historial) return [];
    const map = {};
    historial
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .forEach((registro) => {
        const consolidados = consolidateItems(registro.items);
        consolidados.forEach((c) => {
          if (!map[c.id]) {
            map[c.id] = { id: c.id, nombre: c.nombre, unidad: c.unidad, categoria: c.categoria, proveedor: c.proveedor, registros: [] };
          }
          const consumido = roundQty(Math.max(0, c.parLevel - c.stockActual), c.unidad);
          map[c.id].registros.push({ fecha: registro.fecha, consumido });
        });
      });
    return Object.values(map)
      .map((p) => ({
        ...p,
        promedio: p.registros.reduce((s, r) => s + r.consumido, 0) / p.registros.length,
      }))
      .sort((a, b) => b.promedio - a.promedio);
  }, [historial]);

  const filtrados = productos.filter((p) => p.nombre.toLowerCase().includes(query.trim().toLowerCase()));

  if (historial === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin" size={22} style={{ color: C.accent }} />
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="px-5 pt-16 text-center">
        <BarChart2 size={36} style={{ color: C.line, margin: "0 auto 12px" }} />
        <p style={{ fontWeight: 600, fontSize: 15 }}>Aún no hay historial</p>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>
          Cada vez que guardes un conteo semanal en la pestaña Conteo, aquí se irá armando el promedio de consumo por producto.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4">
      <div className="relative mb-3">
        <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: C.inkSoft }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ border: `1px solid ${C.line}`, background: C.paper }}
        />
      </div>
      <p style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 12 }}>
        Promedio real actual, calculado con {historial.length} {historial.length === 1 ? "semana registrada" : "semanas registradas"}.
      </p>

      {filtrados.map((p) => {
        const isOpen = !!open[p.id];
        const registrosDesc = p.registros.slice().reverse();
        return (
          <div key={p.id} className="mb-3 rounded-2xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
            <button onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))} className="w-full flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0 text-left">
                <div style={{ fontSize: 14, fontWeight: 500 }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{p.categoria}</div>
              </div>
              <div className="text-right">
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 17, color: C.accent }}>
                  {fmtNum(Math.round(p.promedio * 10) / 10)} <span style={{ fontSize: 10, fontWeight: 500, color: C.inkSoft }}>{p.unidad}</span>
                </div>
                <div style={{ fontSize: 9.5, color: C.inkSoft }}>prom. x semana</div>
              </div>
              {isOpen ? <ChevronDown size={16} style={{ color: C.inkSoft }} /> : <ChevronRight size={16} style={{ color: C.inkSoft }} />}
            </button>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="px-4 py-2" style={{ fontSize: 10.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Registro semanal
                </div>
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
