import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Package, ChevronRight, ChevronDown, Check, X, AlertTriangle, Loader2,
  Camera, Plus, Trash2, User, Lock,
} from "lucide-react";

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

function LimpiezaTab({ showToast, autoGerente = false }) {
  const [areaActual, setAreaActual] = useState(undefined);
  const [cambiandoArea, setCambiandoArea] = useState(false);
  const [tareas, setTareas] = useState(null);
  const [registros, setRegistros] = useState(null);
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [completando, setCompletando] = useState(null); // tarea en proceso de marcarse hecha
  const [modoGerente, setModoGerente] = useState(false);
  const [pinModal, setPinModal] = useState(null); // {mode:'setup'|'unlock', value, confirmValue, error}
  const [gerentePin, setGerentePin] = useState(undefined);
  const [autoAbierto, setAutoAbierto] = useState(false);

  useEffect(() => {
    (async () => setGerentePin(await cargarGerentePin()))();
  }, []);

  useEffect(() => {
    if (autoGerente && !autoAbierto && gerentePin !== undefined) {
      setAutoAbierto(true);
      abrirGerente();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGerente, gerentePin, autoAbierto]);

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
