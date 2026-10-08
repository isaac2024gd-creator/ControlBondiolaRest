import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Package, ChevronRight, ChevronDown, Check, X, AlertTriangle, Loader2,
  Camera, Plus, Trash2, User, Lock, Printer,
} from "lucide-react";

/* ---------- Botón "Atrás" (flotante y el del teléfono) ----------
   Cada pantalla interna o ventana abierta se anota aquí mientras está abierta;
   App.jsx usa la más reciente para regresar UN paso en lugar de salir de la app. */
function useAtras(activo, alRegresar) {
  const ref = useRef(alRegresar);
  ref.current = alRegresar;
  const on = !!activo;
  useEffect(() => {
    if (!on || typeof window === "undefined") return undefined;
    const pila = (window.__bndAtras = window.__bndAtras || []);
    const entrada = { regresar: () => { if (typeof ref.current === "function") ref.current(); } };
    pila.push(entrada);
    window.dispatchEvent(new Event("bnd-atras"));
    return () => {
      const i = pila.indexOf(entrada);
      if (i >= 0) pila.splice(i, 1);
      window.dispatchEvent(new Event("bnd-atras"));
    };
  }, [on]);
}

/* Mismo proyecto Supabase que PAR, DÍA y Reloj Checador — tabla propia de Limpieza */
const SUPABASE_URL = "https://ciwfhbpcpygubsvtmwze.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AF_54iVTwT25rhMrhWbFXQ_oW2z_NeF";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function kvGet(key, tabla = "kv_store_limpieza") {
  const { data, error } = await supabase.from(tabla).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

async function kvSet(key, value, tabla = "kv_store_limpieza") {
  const { error } = await supabase.from(tabla).upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  return true;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function storageSetRetry(key, value, tabla = "kv_store_limpieza", intentos = 3) {
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

/* ---------- Tokens: fondo pastel café, a juego con la tarjeta de Limpieza ---------- */
/* Igual que kvGet, pero además regresa cuándo se guardó por última vez (updated_at),
   para detectar si otro teléfono lo cambió mientras tanto. */
async function kvGetConVersion(key, tabla = "kv_store_limpieza") {
  const { data, error } = await supabase.from(tabla).select("value, updated_at").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? { value: data.value, updatedAt: data.updated_at } : { value: null, updatedAt: null };
}

/* Guarda solo si nadie más cambió el registro desde que se leyó; si sí, regresa
   { conflicto: true } (guardarMezclando entonces relee y reaplica). */
async function kvSetConVersion(key, value, expectedUpdatedAt, tabla = "kv_store_limpieza") {
  const fecha = new Date().toISOString();
  if (expectedUpdatedAt == null) {
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

/* ---------- Guardado "mezclando" (varios teléfonos a la vez) ----------
   En vez de mandar la lista completa que tenía ESTA pantalla (y chocar o pisar lo que
   guardó otro teléfono), se lee lo más reciente del servidor, se le aplican SOLO los
   cambios de esta persona (`aplicar(base)`) y se guarda con control de versión. Si otro
   teléfono guardó justo en medio, se vuelve a leer y a aplicar (hasta 5 intentos), así
   no se pierde el avance de nadie. `aplicar` debe regresar el valor nuevo completo, o
   `undefined` si no hay nada que cambiar. */
async function guardarMezclando(key, aplicar, tabla = "kv_store_limpieza", intentos = 5) {
  let ultimoError = null;
  for (let i = 0; i < intentos; i++) {
    try {
      const { value, updatedAt } = await kvGetConVersion(key, tabla);
      const nuevo = aplicar(value);
      if (nuevo === undefined) return { ok: true, value, updatedAt, sinCambios: true };
      const res = await kvSetConVersion(key, nuevo, updatedAt, tabla);
      if (res.ok) return { ok: true, value: nuevo, updatedAt: res.updatedAt };
      ultimoError = null; // fue choque con otro teléfono: se relee y se reaplica
    } catch (e) {
      ultimoError = e;
    }
    await sleep(150 + Math.random() * 350 * (i + 1));
  }
  return { ok: false, error: ultimoError || new Error("Muchos guardados al mismo tiempo, intenta de nuevo.") };
}

/* ---------- Fotos en Supabase Storage (fuera de la base de datos) ----------
   Antes cada foto se guardaba como texto dentro del catálogo, así que CADA guardado
   subía y bajaba todas las fotos (cientos de KB). Ahora la foto se sube una sola vez al
   almacenamiento de archivos y en el catálogo solo queda su dirección (unos 120
   caracteres). La imagen se ve igual: <img src> acepta ambas formas. */
const FOTOS_BUCKET = "fotos-inventario";

function esFotoEmbebida(f) {
  return typeof f === "string" && f.startsWith("data:");
}

function dataUrlABlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function subirFoto(dataUrl, carpeta) {
  const blob = dataUrlABlob(dataUrl);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/* Pasa al almacenamiento de archivos las fotos que todavía vengan "embebidas" en una
   lista guardada (datos viejos, o guardados desde una versión vieja de la app que siga
   abierta en algún teléfono). Corre en segundo plano, de a 4 fotos a la vez, y guarda
   mezclando: solo cambia la foto si sigue siendo la misma que se subió. Regresa una
   función para aplicar el mismo cambio a la pantalla, o null si no había nada. */
async function migrarFotosEmbebidas(lista, key, tabla, carpeta, campoFoto = "foto") {
  const pendientes = (lista || []).filter((i) => i && esFotoEmbebida(i[campoFoto]));
  if (!pendientes.length) return null;
  const cambios = {};
  for (let i = 0; i < pendientes.length; i += 4) {
    const lote = pendientes.slice(i, i + 4);
    await Promise.all(lote.map(async (it) => {
      try {
        cambios[it.id] = { antes: it[campoFoto], url: await subirFoto(it[campoFoto], carpeta) };
      } catch (e) { /* se reintenta la próxima vez que se abra la app */ }
    }));
  }
  if (!Object.keys(cambios).length) return null;
  const aplicar = (base) => {
    if (!Array.isArray(base)) return undefined;
    let algo = false;
    const nuevo = base.map((i) => {
      const c = i && cambios[i.id];
      if (c && i[campoFoto] === c.antes) { algo = true; return { ...i, [campoFoto]: c.url }; }
      return i;
    });
    return algo ? nuevo : undefined;
  };
  const res = await guardarMezclando(key, aplicar, tabla);
  return res.ok ? (prev) => aplicar(prev) || prev : null;
}

const C = {
  bg: "#F2E6D6",
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
  accent: "#8A5A2E",
  accentDark: "#5F3D1F",
};

/* Estilos de campos de formulario (se usaban en los modales pero no estaban definidos:
   abrir "Marcar hecho" o la clave de Gerente tronaba la pantalla). */
const fieldLabel = { display: "block", fontSize: 12, fontWeight: 600, color: C.inkSoft, marginBottom: 6 };
const fieldInput = { background: C.paper, border: `1px solid ${C.line}`, color: C.ink, outline: "none" };

const AREAS_DEFAULT = ["Cocina Caliente", "Cocina Fría", "Servicio PA", "Barra PB", "Almacén"];

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

function formatFecha(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  } catch (e) {
    return "";
  }
}

function pad2(n) { return String(n).padStart(2, "0"); }

function lunesDeLaSemana(d = new Date()) {
  const day = d.getDay();
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

function AreaPicker({ areas, sinArea, onElegir, onCancelar }) {
  return (
    <div className="px-5 pt-8">
      <div className="text-center mb-6">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>¿En qué área trabajas?</h2>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Elige tu área para revisar sus actividades de limpieza.</p>
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

function Toast({ text }) {
  if (!text) return null;
  return (
    <div
      className="fixed left-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-sm"
      style={{ bottom: "24px", transform: "translateX(-50%)", background: C.accentDark, color: "#fff", fontFamily: "'Inter', sans-serif" }}
    >
      {text}
    </div>
  );
}

/* ---------- Módulo principal ---------- */
export default function Limpieza({ autoGerente = false }) {
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ background: C.bg, fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <header className="px-5 pt-16 pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26 }}>Limpieza</h1>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Actividades semanales por área, con foto de comprobante</p>
      </header>

      <main className="flex-1 overflow-y-auto pb-10">
        <LimpiezaTab showToast={showToast} autoGerente={autoGerente} />
      </main>

      <Toast text={toast} />
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

/* Recibe `aplicar(base)` con SOLO el cambio de esta pantalla; se aplica sobre lo más
   reciente del servidor. Antes se mandaba la lista completa: dos teléfonos se pisaban, y
   si la carga inicial fallaba (lista vacía) se podía borrar todo el catálogo. */
async function guardarTareasLimpieza(aplicar) {
  return guardarMezclando("limpieza_tareas", (base) => aplicar(Array.isArray(base) ? base : []), "kv_store_limpieza");
}

async function cargarRegistrosLimpieza() {
  try {
    const val = await kvGet("limpieza_registros", "kv_store_limpieza");
    return val || [];
  } catch (e) {
    return [];
  }
}

async function guardarRegistrosLimpieza(aplicar) {
  // conserva las últimas ~14 semanas para no crecer indefinidamente
  const corte = new Date();
  corte.setDate(corte.getDate() - 100);
  const corteKey = `${corte.getFullYear()}-${pad2(corte.getMonth() + 1)}-${pad2(corte.getDate())}`;
  return guardarMezclando(
    "limpieza_registros",
    (base) => aplicar(Array.isArray(base) ? base : []).filter((r) => r.semana >= corteKey),
    "kv_store_limpieza"
  );
}

/* La clave de Gerente ya no se guarda ni se descarga en texto plano: vive
   hasheada en la tabla protegida app_pins (ver migración secure_app_pins) y
   solo se valida contra Supabase con las funciones pin_exists / verify_app_pin
   / set_app_pin, que nunca devuelven la clave real, solo true/false. */
async function gerentePinConfigurado() {
  try {
    const { data, error } = await supabase.rpc("pin_exists", { p_pin_name: "gerente" });
    if (error) throw error;
    return !!data;
  } catch (e) {
    return false;
  }
}

async function verificarGerentePin(pin) {
  const { data, error } = await supabase.rpc("verify_app_pin", { p_pin_name: "gerente", p_pin: pin });
  if (error) throw error;
  return !!data;
}

async function guardarGerentePin(pin) {
  const { data, error } = await supabase.rpc("set_app_pin", {
    p_pin_name: "gerente",
    p_new_pin: pin,
    p_old_pin: null,
  });
  if (error) throw error;
  return !!data;
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

/* ---------- Actividades de Cierre (llenado exclusivo del Gerente, reinicia cada día) ----------
   Igual que los PIN, esta información ya no vive en la tabla abierta: solo se puede leer o
   escribir mandando otra vez el PIN de Gerente ya verificado (ver migración
   protege_datos_sensibles). */

async function leerDatoProtegidoGerente(clave, pin) {
  const { data, error } = await supabase.rpc("leer_dato_protegido_gerente", { p_clave: clave, p_pin: pin });
  if (error) throw error;
  return data; // objeto/array (jsonb) ya parseado, o null si no existe / el PIN no es correcto
}

async function guardarDatoProtegidoGerente(clave, valor, pin) {
  const { data, error } = await supabase.rpc("guardar_dato_protegido_gerente", {
    p_clave: clave,
    p_valor: valor,
    p_pin: pin,
  });
  if (error) throw error;
  return !!data;
}

async function cargarTareasCierre(pin) {
  try {
    return (await leerDatoProtegidoGerente("cierre_tareas", pin)) || [];
  } catch (e) {
    return [];
  }
}

/* Lo protegido con PIN no tiene control de versión, pero al menos se relee justo antes
   de guardar y se aplica SOLO el cambio de esta pantalla (`aplicar(base)`), en vez de
   mandar la lista que se tenía en pantalla (que podía estar vieja o vacía). */
async function guardarTareasCierre(aplicar, pin) {
  try {
    const base = (await leerDatoProtegidoGerente("cierre_tareas", pin)) || [];
    const nuevo = aplicar(Array.isArray(base) ? base : []);
    const ok = await guardarDatoProtegidoGerente("cierre_tareas", nuevo, pin);
    return { ok, value: nuevo };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function cargarRegistrosCierre(pin) {
  try {
    return (await leerDatoProtegidoGerente("cierre_registros", pin)) || [];
  } catch (e) {
    return [];
  }
}

async function guardarRegistrosCierre(aplicar, pin) {
  // conserva los últimos 60 días
  const corte = new Date();
  corte.setDate(corte.getDate() - 60);
  const corteKey = `${corte.getFullYear()}-${pad2(corte.getMonth() + 1)}-${pad2(corte.getDate())}`;
  try {
    const base = (await leerDatoProtegidoGerente("cierre_registros", pin)) || [];
    const podados = aplicar(Array.isArray(base) ? base : []).filter((r) => r.fechaKey >= corteKey);
    const ok = await guardarDatoProtegidoGerente("cierre_registros", podados, pin);
    return { ok, value: podados };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function LimpiezaTab({ showToast, autoGerente = false }) {
  const [areaActual, setAreaActual] = useState(undefined);
  const [cambiandoArea, setCambiandoArea] = useState(false);
  const [tareas, setTareas] = useState(null);
  const [registros, setRegistros] = useState(null);
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [completando, setCompletando] = useState(null); // tarea en proceso de marcarse hecha
  const [showImprimir, setShowImprimir] = useState(false);
  const [modoGerente, setModoGerente] = useState(false);
  const [pinModal, setPinModal] = useState(null); // {mode:'setup'|'unlock', value, confirmValue, error, busy}
  const [gerenteConfigurado, setGerenteConfigurado] = useState(undefined); // undefined=cargando, true/false
  const [autoAbierto, setAutoAbierto] = useState(false);
  // El checklist de cierre vive protegido por este mismo PIN (ver GerenteView/CierreSeccion),
  // así que guardamos el PIN ya verificado en memoria mientras dure el Modo Gerente.
  const [gerentePinVerificado, setGerentePinVerificado] = useState("");

  useEffect(() => {
    (async () => setGerenteConfigurado(await gerentePinConfigurado()))();
  }, []);

  useEffect(() => {
    if (autoGerente && !autoAbierto && gerenteConfigurado !== undefined) {
      setAutoAbierto(true);
      abrirGerente();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGerente, gerenteConfigurado, autoAbierto]);

  function abrirGerente() {
    if (gerenteConfigurado === undefined) return;
    if (!gerenteConfigurado) setPinModal({ mode: "setup", value: "", confirmValue: "", error: "" });
    else setPinModal({ mode: "unlock", value: "", error: "" });
  }

  async function submitPinGerente() {
    if (!pinModal || pinModal.busy) return;
    const digits = pinModal.value.trim();

    if (pinModal.mode === "unlock") {
      setPinModal((m) => ({ ...m, busy: true, error: "" }));
      let ok = false;
      try {
        ok = await verificarGerentePin(digits);
      } catch (e) {
        setPinModal((m) => ({ ...m, busy: false, error: "No se pudo verificar la clave. Revisa tu conexión." }));
        return;
      }
      if (!ok) {
        setPinModal((m) => ({ ...m, busy: false, value: "", error: "Clave incorrecta." }));
        return;
      }
      setGerentePinVerificado(digits);
      setModoGerente(true);
      setPinModal(null);
      return;
    }

    if (digits.length < 4) return setPinModal((m) => ({ ...m, error: "Usa al menos 4 dígitos." }));
    if (digits !== pinModal.confirmValue.trim()) return setPinModal((m) => ({ ...m, error: "Las claves no coinciden." }));

    setPinModal((m) => ({ ...m, busy: true, error: "" }));
    let ok = false;
    try {
      ok = await guardarGerentePin(digits);
    } catch (e) {
      setPinModal((m) => ({ ...m, busy: false, error: "No se pudo guardar la clave. Revisa tu conexión." }));
      return;
    }
    if (!ok) {
      setPinModal((m) => ({ ...m, busy: false, error: "No se pudo guardar la clave, intenta de nuevo." }));
      return;
    }
    setGerenteConfigurado(true);
    setGerentePinVerificado(digits);
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
      // Fotos de comprobante viejas guardadas dentro de los registros: se pasan al
      // almacenamiento de archivos en segundo plano (una sola vez).
      migrarFotosEmbebidas(r, "limpieza_registros", "kv_store_limpieza", "limpieza")
        .then((aplicarEnPantalla) => { if (aplicarEnPantalla) setRegistros((prev) => (prev ? aplicarEnPantalla(prev) : prev)); })
        .catch(() => {});
    })();
  }, []);

  async function elegirArea(area) {
    setAreaActual(area);
    setCambiandoArea(false);
    try { localStorage.setItem("dia_area_actual", area); } catch (e) {}
  }

  // Atrás dentro de un área: regresa a la lista de áreas.
  useAtras(areaActual != null && !cambiandoArea && !modoGerente, () => setCambiandoArea(true));
  // Atrás en Modo Gerente (entrando desde Limpieza): sale a la vista normal.
  // Desde la tarjeta "Gerente" del menú no se registra, así Atrás regresa al menú principal.
  useAtras(modoGerente && !autoGerente, () => { setModoGerente(false); setGerentePinVerificado(""); });

  async function guardarNuevaTarea(tarea) {
    const nueva = { ...tarea, id: uid() };
    const aplicar = (base) => (base.some((t) => t.id === nueva.id) ? base : [...base, nueva]);
    setTareas((prev) => aplicar(prev || []));
    const res = await guardarTareasLimpieza(aplicar);
    if (!res.ok) {
      showToast("No se pudo guardar la tarea: " + (res.error?.message || "error"));
      setTareas((prev) => (prev || []).filter((t) => t.id !== nueva.id));
    } else {
      setTareas(res.value || []);
      showToast("Actividad agregada");
    }
  }

  async function eliminarTarea(id) {
    const aplicar = (base) => base.filter((t) => t.id !== id);
    setTareas((prev) => aplicar(prev || []));
    const res = await guardarTareasLimpieza(aplicar);
    if (!res.ok) showToast("No se pudo eliminar: " + (res.error?.message || "error"));
    else {
      setTareas(res.value || []);
      showToast("Actividad eliminada");
    }
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
    const aplicar = (base) => (base.some((r) => r.id === nuevoRegistro.id) ? base : [...base, nuevoRegistro]);
    setRegistros((prev) => aplicar(prev || []));
    setCompletando(null);
    const res = await guardarRegistrosLimpieza(aplicar);
    if (!res.ok) {
      showToast("No se pudo guardar: " + (res.error?.message || "error"));
      setRegistros((prev) => (prev || []).filter((r) => r.id !== nuevoRegistro.id));
    } else {
      setRegistros(res.value || []);
      showToast("Actividad registrada");
    }
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
        pin={gerentePinVerificado}
        onSalir={() => { setModoGerente(false); setGerentePinVerificado(""); }}
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
          {tareasDelArea.length > 0 && (
            <button onClick={() => setShowImprimir(true)} className="text-xs font-semibold flex items-center gap-1" style={{ color: C.accent }}>
              <Printer size={13} /> Ticket
            </button>
          )}
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

      {showImprimir && (
        <ImprimirTicketsModal
          tareas={tareas}
          registros={registros}
          areas={[areaActual]}
          semanaActual={semanaActual}
          onCerrar={() => setShowImprimir(false)}
        />
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
  useAtras(true, onCancel);
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
      if (dataUrl.length > 180000) {
        setError("La foto sigue muy pesada, intenta con otra.");
      } else {
        // Se sube al almacenamiento de archivos; en el registro solo queda la dirección.
        try {
          setFoto(await subirFoto(dataUrl, "limpieza"));
        } catch (errSubida) {
          setError("No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.");
        }
      }
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
  useAtras(true, onCerrar);
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
/* Nota: existía aquí un HistorialTab huérfano (copiado por error desde DiaInventario.jsx),
   nunca invocado en este archivo y roto por referenciar imports inexistentes.
   Se movió a DiaInventario.jsx, que es donde realmente se usa. */

/* ===================== Tickets semanales de limpieza por área =====================
   Ticket impreso (impresora térmica 58/80 mm) con TODAS las actividades de la semana de un
   área, para dejarlo pegado en esa área e ir palomeando a mano. Se arma una sola vez como
   lista de renglones y de ahí sale: la vista previa en pantalla, los comandos ESC/POS para
   Bluetooth/RawBT y la versión para imprimir desde el navegador.
   Usa la misma impresora guardada que Propinas (clave impresora_ble_nombre). */

function textoTicket(str) {
  // las impresoras baratas no traen acentos confiables: se quitan (á→a, ñ→n)
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function partirTexto(s, ancho) {
  const words = textoTicket(s).split(/\s+/).filter(Boolean);
  const out = [];
  let cur = "";
  for (const w0 of words) {
    let w = w0;
    while (w.length > ancho) { // palabra más larga que el renglón: se corta
      if (cur) { out.push(cur); cur = ""; }
      out.push(w.slice(0, ancho));
      w = w.slice(ancho);
    }
    if (!w) continue;
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= ancho) cur += " " + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}

function semanaTicket(lunesKey) {
  const [y, m, d] = lunesKey.split("-").map(Number);
  const lunes = new Date(y, m - 1, d);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  const f = (dt) => `${dt.getDate()} ${dt.toLocaleDateString("es-MX", { month: "short" }).replace(".", "")}`;
  return `lun ${f(lunes)} al dom ${f(domingo)}`;
}

/* Renglones del ticket: { t: texto, b: negrita, g: letra grande (doble alto), c: centrado } o { sep: true } */
function lineasTicketLimpieza({ area, tareasArea, registrosSemana, semanaKey, cols, conHechas }) {
  const L = [];
  const add = (t, o = {}) => L.push({ t: textoTicket(t), ...o });
  const sep = () => L.push({ sep: true });
  const wrapAdd = (t, o = {}) => partirTexto(t, cols).forEach((x) => add(x, o));

  wrapAdd("RESTAURANTE BONDIOLA", { c: true, b: true });
  add("LIMPIEZA SEMANAL", { c: true });
  sep();
  wrapAdd(String(area).toUpperCase(), { c: true, b: true, g: true });
  wrapAdd("Semana: " + semanaTicket(semanaKey), { c: true });
  sep();
  add(`${tareasArea.length} actividad${tareasArea.length === 1 ? "" : "es"} esta semana`, { b: true });

  tareasArea.forEach((t, i) => {
    const reg = conHechas ? registrosSemana.find((r) => r.tareaId === t.id) : null;
    const prefijo = `[${reg ? "X" : " "}] ${i + 1}. `;
    const sangria = " ".repeat(prefijo.length);
    add("");
    partirTexto(t.nombre, cols - prefijo.length).forEach((x, j) => add((j === 0 ? prefijo : sangria) + x, { b: true }));
    if (reg) {
      const cuando = reg.fecha ? new Date(reg.fecha).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }) : "";
      partirTexto(`Hecho ${cuando}${reg.quien ? " - " + reg.quien : ""}`, cols - sangria.length).forEach((x) => add(sangria + x));
    } else {
      const base = sangria + "Dia:" + "_".repeat(cols >= 48 ? 8 : 5) + " Quien:";
      add(base + "_".repeat(Math.max(4, cols - base.length)));
    }
  });

  sep();
  add("Al terminar cada actividad:", { b: true });
  wrapAdd("1) Palomea aqui la casilla");
  wrapAdd("2) Registrala en la app con foto");
  add("");
  add("");
  add("_".repeat(Math.min(cols, 26)), { c: true });
  add("Reviso (gerente)", { c: true });
  add("Impreso: " + new Date().toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }), { c: true });
  return L;
}

function escPosDeLineas(bloques, cols) {
  const bytes = [0x1b, 0x40]; // reiniciar impresora
  bloques.forEach((lineas) => {
    lineas.forEach((ln) => {
      if (ln.sep) {
        bytes.push(0x1b, 0x61, 0, 0x1b, 0x45, 0, 0x1d, 0x21, 0);
        for (const ch of "-".repeat(cols)) bytes.push(ch.charCodeAt(0));
        bytes.push(0x0a);
        return;
      }
      bytes.push(0x1b, 0x61, ln.c ? 1 : 0); // centrado
      bytes.push(0x1b, 0x45, ln.b ? 1 : 0, 0x1b, 0x47, ln.b ? 1 : 0); // negritas
      bytes.push(0x1d, 0x21, ln.g ? 0x01 : 0x00); // doble alto (mismo ancho)
      for (const ch of ln.t) bytes.push(ch.charCodeAt(0));
      bytes.push(0x0a);
    });
    bytes.push(0x1d, 0x21, 0, 0x1b, 0x45, 0, 0x1b, 0x61, 0);
    bytes.push(0x0a, 0x0a, 0x0a, 0x0a);
    bytes.push(0x1d, 0x56, 0x42, 0x00); // corte entre áreas (si la impresora no corta, se ignora)
  });
  return new Uint8Array(bytes);
}

function ticketPruebaLimpieza(cols, ancho) {
  return escPosDeLineas([[
    { t: "RESTAURANTE BONDIOLA", c: true, b: true },
    { sep: true },
    { t: "PRUEBA DE IMPRESORA", c: true, b: true },
    { t: `Papel ${ancho} mm (${cols} letras)`, c: true },
    { t: "1234567890".repeat(5).slice(0, cols) },
    { t: "Si la linea de numeros se ve", c: true },
    { t: "completa, todo esta bien.", c: true },
  ]], cols);
}

/* ---- Bluetooth (mismo método que el ticket de Propinas) ---- */
const SERVICIOS_IMPRESORA_BLE = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "0000ae00-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];
const CLAVE_IMPRESORA_BLE = "impresora_ble_nombre";
let impresoraBle = null; // { device, characteristic }

function conTiempoLimite(promesa, ms, etiqueta) {
  return Promise.race([
    promesa,
    new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(etiqueta), { name: "TimeoutError" })), ms)),
  ]);
}

function nombreImpresoraGuardada() {
  try { return localStorage.getItem(CLAVE_IMPRESORA_BLE) || ""; } catch (e) { return ""; }
}

async function buscarCaracteristicaEscritura(gatt) {
  const services = await gatt.getPrimaryServices();
  const orden = [...services].sort(
    (a, b) => (SERVICIOS_IMPRESORA_BLE.includes(a.uuid) ? 0 : 1) - (SERVICIOS_IMPRESORA_BLE.includes(b.uuid) ? 0 : 1)
  );
  for (const sv of orden) {
    let chars = [];
    try { chars = await sv.getCharacteristics(); } catch (e) { continue; }
    const c = chars.find((ch) => ch.properties.writeWithoutResponse) || chars.find((ch) => ch.properties.write);
    if (c) return c;
  }
  throw new Error("SIN_CARACTERISTICA");
}

async function abrirConexionImpresora(device) {
  const gatt = await conTiempoLimite(device.gatt.connect(), 8000, "CONEXION_TARDADA");
  const characteristic = await buscarCaracteristicaEscritura(gatt);
  if (!device.__escuchaDesconexionLimpieza) {
    device.__escuchaDesconexionLimpieza = true;
    device.addEventListener("gattserverdisconnected", () => {
      if (impresoraBle?.device === device) impresoraBle.characteristic = null;
    });
  }
  impresoraBle = { device, characteristic };
  try { localStorage.setItem(CLAVE_IMPRESORA_BLE, device.name || "impresora"); } catch (e) {}
  return impresoraBle;
}

async function conectarImpresoraBle(forzarNueva) {
  if (!forzarNueva && impresoraBle?.device?.gatt) {
    try {
      if (impresoraBle.device.gatt.connected && impresoraBle.characteristic) return impresoraBle;
      return await abrirConexionImpresora(impresoraBle.device);
    } catch (e) {
      impresoraBle = null;
    }
  }
  if (!forzarNueva && navigator.bluetooth.getDevices) {
    try {
      const guardada = nombreImpresoraGuardada();
      const conocidos = await navigator.bluetooth.getDevices();
      const candidata = conocidos.find((d) => guardada && d.name === guardada) || (conocidos.length === 1 ? conocidos[0] : null);
      if (candidata) return await abrirConexionImpresora(candidata);
    } catch (e) {}
  }
  const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICIOS_IMPRESORA_BLE });
  return await abrirConexionImpresora(device);
}

async function enviarBytesImpresora(characteristic, bytes) {
  const sinRespuesta = characteristic.properties.writeWithoutResponse;
  const TAM = 20; // BLE solo garantiza 20 bytes por envío
  for (let i = 0; i < bytes.length; i += TAM) {
    const trozo = bytes.slice(i, i + TAM);
    if (sinRespuesta && characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(trozo);
    else if (characteristic.writeValueWithResponse) await characteristic.writeValueWithResponse(trozo);
    else await characteristic.writeValue(trozo);
    await sleep(sinRespuesta ? 20 : 5);
  }
}

async function imprimirPorBluetooth(bytes, forzarNueva = false) {
  const { characteristic } = await conectarImpresoraBle(forzarNueva);
  try {
    await enviarBytesImpresora(characteristic, bytes);
  } catch (err) {
    if (err?.name !== "NetworkError" && err?.name !== "InvalidStateError") throw err;
    if (impresoraBle) impresoraBle.characteristic = null;
    const nueva = await conectarImpresoraBle(false);
    await enviarBytesImpresora(nueva.characteristic, bytes);
  }
}

function imprimirPorRawBT(bytes) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  window.location.href = `intent:base64,${btoa(bin)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function htmlDeLineas(lineas, cols) {
  return lineas.map((ln) => {
    if (ln.sep) return `<div>${"-".repeat(cols)}</div>`;
    const st = [
      ln.c ? "text-align:center" : "",
      ln.b ? "font-weight:700" : "",
      ln.g ? "font-size:1.6em;line-height:1.25" : "",
    ].filter(Boolean).join(";");
    return `<div style="${st}">${escapeHtml(ln.t) || "&nbsp;"}</div>`;
  }).join("");
}

function ImprimirTicketsModal({ tareas, registros, areas, semanaActual, onCerrar }) {
  useAtras(true, onCerrar);
  const [ancho, setAncho] = useState(() => {
    try { return localStorage.getItem("propinas_ticket_ancho") === "80" ? 80 : 58; } catch (e) { return 58; }
  });
  // Siempre la semana en curso, de lunes a domingo, sin importar qué día se imprima.
  const semana = semanaActual;
  const areasConTareas = useMemo(() => areas.filter((a) => tareas.some((t) => t.area === a)), [areas, tareas]);
  const [elegidas, setElegidas] = useState(() => new Set(areasConTareas));
  const [estado, setEstado] = useState(null); // { tipo: "info"|"ok"|"error", texto }
  const [ocupado, setOcupado] = useState(false);
  const cols = ancho === 80 ? 48 : 32;
  const esActual = true;
  const varias = areasConTareas.length > 1;

  const bloques = useMemo(() => areasConTareas
    .filter((a) => elegidas.has(a))
    .map((area) => ({
      area,
      lineas: lineasTicketLimpieza({
        area,
        tareasArea: tareas.filter((t) => t.area === area),
        registrosSemana: registros.filter((r) => r.semana === semana && r.area === area),
        semanaKey: semana,
        cols,
        conHechas: esActual,
      }),
    })), [areasConTareas, elegidas, tareas, registros, semana, cols, esActual]);

  function cambiarAncho(w) {
    setAncho(w);
    try { localStorage.setItem("propinas_ticket_ancho", String(w)); } catch (e) {}
  }

  function toggleArea(a) {
    setElegidas((prev) => {
      const n = new Set(prev);
      if (n.has(a)) n.delete(a); else n.add(a);
      return n;
    });
  }

  async function imprimirBT(forzarNueva = false, prueba = false) {
    if (ocupado) return;
    if (!prueba && bloques.length === 0) return setEstado({ tipo: "error", texto: "Elige al menos un área." });
    if (!navigator.bluetooth) {
      return setEstado({ tipo: "error", texto: "Este navegador no puede conectarse a impresoras Bluetooth. Usa Chrome en Android, o el botón RawBT." });
    }
    setOcupado(true);
    setEstado({
      tipo: "info",
      texto: forzarNueva || (!impresoraBle && !nombreImpresoraGuardada())
        ? "Elige tu impresora en la lista (suele llamarse MTP, PT-210, MP58, POS, Printer…)"
        : "Conectando e imprimiendo…",
    });
    try {
      const bytes = prueba ? ticketPruebaLimpieza(cols, ancho) : escPosDeLineas(bloques.map((b) => b.lineas), cols);
      await imprimirPorBluetooth(bytes, forzarNueva);
      setEstado({
        tipo: "ok",
        texto: prueba
          ? `Prueba enviada a ${impresoraBle?.device?.name || "la impresora"}.`
          : `${bloques.length} ticket${bloques.length === 1 ? "" : "s"} enviado${bloques.length === 1 ? "" : "s"} a ${impresoraBle?.device?.name || "la impresora"}.`,
      });
    } catch (err) {
      console.error("Impresión Bluetooth (Limpieza):", err);
      const n = err?.name || "";
      let texto = "No se pudo imprimir. Revisa que la impresora esté encendida y cerca, e intenta otra vez.";
      if (n === "NotFoundError") texto = "No se eligió ninguna impresora.";
      else if (err?.message === "SIN_CARACTERISTICA" || n === "NotSupportedError") texto = "Esta impresora no acepta conexión directa desde el navegador. Usa el botón RawBT.";
      else if (n === "TimeoutError") texto = "La impresora no respondió. Verifica que esté encendida, cerca y que no esté conectada a otro teléfono.";
      else if (n === "SecurityError") texto = "No se pudo abrir la lista de impresoras. Toca de nuevo; si sigue, revisa que Chrome tenga permiso de Bluetooth y Ubicación.";
      setEstado({ tipo: "error", texto });
    } finally {
      setOcupado(false);
    }
  }

  function imprimirRawBT() {
    if (bloques.length === 0) return setEstado({ tipo: "error", texto: "Elige al menos un área." });
    imprimirPorRawBT(escPosDeLineas(bloques.map((b) => b.lineas), cols));
  }

  function imprimirNavegador() {
    if (bloques.length === 0) return setEstado({ tipo: "error", texto: "Elige al menos un área." });
    const w = window.open("", "_blank");
    if (!w) return setEstado({ tipo: "error", texto: "El navegador bloqueó la ventana. Permite ventanas emergentes e intenta de nuevo." });
    const cuerpo = bloques.map((b) => `<section>${htmlDeLineas(b.lineas, cols)}</section>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Limpieza semanal</title>
      <style>
        @page { size: ${ancho}mm auto; margin: 0; }
        body { margin: 0; font-family: 'Courier New', monospace; font-size: ${ancho === 80 ? 12 : 11}px; color: #000; }
        section { width: ${ancho - 6}mm; padding: 3mm; white-space: pre; page-break-after: always; break-after: page; }
        section:last-child { page-break-after: auto; break-after: auto; }
      </style></head><body>${cuerpo}<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script></body></html>`);
    w.document.close();
  }

  const btnSec = { background: C.bg, border: `1px solid ${C.line}`, color: C.ink };

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(34,31,26,0.45)" }} onClick={onCerrar}>
      <div className="w-full rounded-t-3xl p-5" style={{ background: C.paper, maxWidth: 640, margin: "0 auto", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>
            {varias ? "Tickets de limpieza por área" : `Ticket de limpieza — ${areas[0]}`}
          </h2>
          <button onClick={onCerrar}><X size={20} style={{ color: C.inkSoft }} /></button>
        </div>
        <p style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 14 }}>
          Imprime la lista de la semana, déjala en el área y ve palomeando. Cada actividad se sigue registrando en la app con foto.
        </p>

        <div className="mb-3 px-3 py-2 rounded-xl" style={{ background: C.bg, border: `1px solid ${C.line}`, fontSize: 12.5 }}>
          Semana: <b>lunes a domingo, {formatSemana(semana)}</b>
        </div>

        <label style={fieldLabel}>Papel</label>
        <div className="flex gap-2 mb-3">
          {[58, 80].map((w) => (
            <button key={w} onClick={() => cambiarAncho(w)} className="flex-1 py-2 rounded-xl text-xs font-semibold"
              style={ancho === w ? { background: C.accent, color: "#fff", border: `1px solid ${C.accent}` } : btnSec}>
              {w} mm
            </button>
          ))}
        </div>

        {varias && (
          <>
            <div className="flex items-center justify-between">
              <label style={fieldLabel}>Áreas a imprimir ({elegidas.size}/{areasConTareas.length})</label>
              <button
                onClick={() => setElegidas(elegidas.size === areasConTareas.length ? new Set() : new Set(areasConTareas))}
                className="text-xs font-semibold mb-1.5" style={{ color: C.accent }}
              >
                {elegidas.size === areasConTareas.length ? "Quitar todas" : "Todas"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {areasConTareas.map((a) => {
                const on = elegidas.has(a);
                return (
                  <button key={a} onClick={() => toggleArea(a)} className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1"
                    style={on ? { background: C.accent, color: "#fff", border: `1px solid ${C.accent}` } : btnSec}>
                    {on && <Check size={12} />} {a} · {tareas.filter((t) => t.area === a).length}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {estado && (
          <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg" style={{
            background: estado.tipo === "error" ? C.criticalBg : estado.tipo === "ok" ? C.okBg : C.warnBg,
            color: estado.tipo === "error" ? C.critical : estado.tipo === "ok" ? C.ok : C.accentDark,
            fontSize: 12.5,
          }}>
            {estado.tipo === "info" ? <Loader2 size={14} className="animate-spin" style={{ marginTop: 2, flexShrink: 0 }} />
              : estado.tipo === "ok" ? <Check size={14} style={{ marginTop: 2, flexShrink: 0 }} />
              : <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />}
            <span>{estado.texto}</span>
          </div>
        )}

        <button onClick={() => imprimirBT(false)} disabled={ocupado}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mb-2"
          style={{ background: C.accent, color: "#fff", opacity: ocupado ? 0.6 : 1 }}>
          {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
          Imprimir Bluetooth{bloques.length > 1 ? ` (${bloques.length} tickets)` : ""}
        </button>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={imprimirRawBT} className="py-2.5 rounded-xl text-xs font-semibold" style={btnSec}>RawBT</button>
          <button onClick={imprimirNavegador} className="py-2.5 rounded-xl text-xs font-semibold" style={btnSec}>Otra impresora / PDF</button>
          <button onClick={() => imprimirBT(false, true)} disabled={ocupado} className="py-2.5 rounded-xl text-xs font-semibold" style={btnSec}>Imprimir prueba</button>
          <button onClick={() => imprimirBT(true)} disabled={ocupado} className="py-2.5 rounded-xl text-xs font-semibold" style={btnSec}>Cambiar impresora</button>
        </div>
        <p style={{ fontSize: 11, color: C.inkSoft, marginBottom: 14 }}>
          {nombreImpresoraGuardada() ? `Impresora guardada: ${nombreImpresoraGuardada()}. ` : ""}
          Usa la misma impresora que el ticket de Propinas. Si no aparece, usa RawBT.
        </p>

        <label style={fieldLabel}>Vista previa</label>
        {bloques.length === 0 ? (
          <p className="text-center py-6" style={{ color: C.inkSoft, fontSize: 13 }}>Elige al menos un área.</p>
        ) : (
          <div className="flex flex-col items-center gap-3 py-3 rounded-2xl" style={{ background: C.bg, overflowX: "auto" }}>
            {bloques.map((b) => (
              <div key={b.area} style={{
                background: "#fff", color: "#000", padding: "12px 10px", boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                fontFamily: "'IBM Plex Mono', 'Courier New', monospace", fontSize: ancho === 80 ? 9.5 : 11, whiteSpace: "pre",
              }}>
                <div style={{ width: `${cols}ch` }} dangerouslySetInnerHTML={{ __html: htmlDeLineas(b.lineas, cols) }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PinModalGerente({ pinModal, setPinModal, onSubmit, onCancel }) {
  useAtras(true, onCancel);
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
          disabled={pinModal.busy}
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
            disabled={pinModal.busy}
            className="w-full px-3 py-3 rounded-xl text-lg tracking-[0.3em] text-center outline-none mb-2"
            style={fieldInput}
          />
        )}
        {pinModal.error && (
          <p style={{ fontSize: 12.5, color: C.critical, marginBottom: 8 }}>{pinModal.error}</p>
        )}
        <button
          onClick={onSubmit}
          disabled={pinModal.busy}
          className="w-full py-3 rounded-xl font-semibold text-sm mt-2"
          style={{ background: C.accent, color: "#fff", opacity: pinModal.busy ? 0.6 : 1 }}
        >
          {pinModal.busy ? "Verificando…" : pinModal.mode === "unlock" ? "Entrar" : "Guardar clave y entrar"}
        </button>
      </div>
    </div>
  );
}

function GerenteView({ tareas, registros, semanaActual, onSalir, pin }) {
  const [seccion, setSeccion] = useState("limpieza"); // "limpieza" | "cierre"
  // Atrás desde "Cierre" regresa a la sección de Limpieza.
  useAtras(seccion !== "limpieza", () => setSeccion("limpieza"));
  const [showImprimir, setShowImprimir] = useState(false);
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
          {areasLimpieza.length > 0 && (
            <button
              onClick={() => setShowImprimir(true)}
              className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl text-sm font-semibold"
              style={{ background: C.paper, border: `1px solid ${C.accent}`, color: C.accent }}
            >
              <Printer size={16} /> Imprimir tickets semanales por área
            </button>
          )}
          {showImprimir && (
            <ImprimirTicketsModal
              tareas={tareas}
              registros={registros}
              areas={areasLimpieza}
              semanaActual={semanaActual}
              onCerrar={() => setShowImprimir(false)}
            />
          )}
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
        <CierreSeccion pin={pin} />
      )}
    </div>
  );
}

function CierreSeccion({ pin }) {
  const [tareas, setTareas] = useState(null);
  const [registros, setRegistros] = useState(null);
  const [showCatalogo, setShowCatalogo] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, r] = await Promise.all([cargarTareasCierre(pin), cargarRegistrosCierre(pin)]);
      setTareas(t);
      setRegistros(r);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function agregarTarea(tarea) {
    const nueva = { ...tarea, id: uid() };
    const aplicar = (base) => (base.some((t) => t.id === nueva.id) ? base : [...base, nueva]);
    setTareas((prev) => aplicar(prev || []));
    const res = await guardarTareasCierre(aplicar, pin);
    if (res.ok) setTareas(res.value);
    else console.error("No se pudo guardar la tarea de cierre:", res.error);
  }

  async function eliminarTarea(id) {
    const aplicar = (base) => base.filter((t) => t.id !== id);
    setTareas((prev) => aplicar(prev || []));
    const res = await guardarTareasCierre(aplicar, pin);
    if (res.ok) setTareas(res.value);
    else console.error("No se pudo eliminar la tarea de cierre:", res.error);
  }

  async function toggleHecha(tarea, yaHecha) {
    const hoy = hoyKey();
    const nuevoReg = { id: uid(), tareaId: tarea.id, area: tarea.area, fechaKey: hoy, fecha: new Date().toISOString() };
    const aplicar = yaHecha
      ? (base) => base.filter((r) => !(r.fechaKey === hoy && r.tareaId === tarea.id))
      : (base) => (base.some((r) => r.fechaKey === hoy && r.tareaId === tarea.id) ? base : [...base, nuevoReg]);
    setRegistros((prev) => aplicar(prev || []));
    const res = await guardarRegistrosCierre(aplicar, pin);
    if (res.ok) setRegistros(res.value);
    else console.error("No se pudo guardar el registro de cierre:", res.error);
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
  useAtras(true, onCerrar);
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
