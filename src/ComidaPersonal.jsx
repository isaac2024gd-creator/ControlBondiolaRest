import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Coffee, UtensilsCrossed, Minus, Plus, Loader2, AlertTriangle, Check,
  ChevronDown, ChevronUp, Lock, Unlock, ListChecks, Snowflake, Users, RotateCcw,
} from "lucide-react";
import CICLO from "./comidaPersonalCiclo.js";

/* ===================== COMIDA DE PERSONAL =====================
   Qué toca desayunar y comer hoy (y mañana), con la receta multiplicada
   por las personas que comen. El menú vive en comidaPersonalCiclo.js.

   Cómo se sabe qué toca:
   - Comida y desayuno tienen ciclos separados (lista de ingredientes base).
   - El ciclo SOLO avanza cuando se marca "Hecho". Si un día no se marca,
     al día siguiente se queda el mismo platillo.
   - Al terminar la lista empieza otra vuelta y cambia la preparación
     (4 vueltas y regresa a la 1).
   El estado (días hechos, personas por día, ajustes) se guarda en Supabase,
   tabla kv_store, clave "comida_personal_v1", y lo ven todos los teléfonos.
   La pestaña Modificar usa la misma clave de Gerente que Limpieza. */

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

/* Mismo proyecto Supabase que PAR, DÍA, Limpieza y Reloj Checador */
const SUPABASE_URL = "https://ciwfhbpcpygubsvtmwze.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AF_54iVTwT25rhMrhWbFXQ_oW2z_NeF";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const CLAVE = "comida_personal_v1";
const TABLA = "kv_store";

async function leerEstado() {
  const { data, error } = await supabase.from(TABLA).select("value").eq("key", CLAVE).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}
/* Lee lo más nuevo del servidor, aplica el cambio y guarda (así dos teléfonos no se pisan). */
async function guardarCambio(aplicar) {
  let ultimoError = null;
  for (let i = 0; i < 3; i++) {
    try {
      const actual = normalizar(await leerEstado());
      const nuevo = aplicar(JSON.parse(JSON.stringify(actual)));
      const { error } = await supabase.from(TABLA).upsert({ key: CLAVE, value: nuevo, updated_at: new Date().toISOString() });
      if (error) throw error;
      return nuevo;
    } catch (e) {
      ultimoError = e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw ultimoError;
}

/* Clave de Gerente (la misma del módulo Gerente / Limpieza) */
async function gerentePinConfigurado() {
  try {
    const { data, error } = await supabase.rpc("pin_exists", { p_pin_name: "gerente" });
    if (error) throw error;
    return !!data;
  } catch (e) { return false; }
}
async function verificarGerentePin(pin) {
  const { data, error } = await supabase.rpc("verify_app_pin", { p_pin_name: "gerente", p_pin: pin });
  if (error) throw error;
  return !!data;
}

const ESTADO_INICIAL = {
  inicio: CICLO.inicio,                   // primer día del ciclo
  hechos: { desayuno: [], comida: [] },   // fechas "AAAA-MM-DD" marcadas como hechas
  ajuste: { desayuno: 0, comida: 0 },     // mover el ciclo a mano (+1 adelanta un lugar)
  personas: {},                           // { "2026-11-02": { desayuno: 8, comida: 10 } }
  personasDefault: { desayuno: 8, comida: 10 },
};
function normalizar(v) {
  const e = { ...ESTADO_INICIAL, ...(v || {}) };
  e.hechos = { desayuno: [], comida: [], ...(e.hechos || {}) };
  e.ajuste = { desayuno: 0, comida: 0, ...(e.ajuste || {}) };
  e.personasDefault = { ...ESTADO_INICIAL.personasDefault, ...(e.personasDefault || {}) };
  e.personas = e.personas || {};
  return e;
}

/* ---------- Fechas (hora local) ---------- */
function fechaStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function deStr(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function sumarDias(s, n) { const d = deStr(s); d.setDate(d.getDate() + n); return fechaStr(d); }
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fechaBonita(s) { const d = deStr(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; }

/* ---------- Ciclo ---------- */
function armarCiclo(lista) {
  return lista.map(([base, preps]) => ({
    base,
    preps: preps.map(([nombre, preparacion, ing, costo]) => ({
      nombre, preparacion, costo,
      ingredientes: ing.split("|").map((t) => {
        const [insumo, cant, unidad] = t.split(":");
        return { insumo, cantidad: parseFloat(cant), unidad };
      }),
    })),
  }));
}
const COMIDA = armarCiclo(CICLO.comida);
const DESAYUNO = armarCiclo(CICLO.desayuno);
const LISTAS = { desayuno: DESAYUNO, comida: COMIDA };

/* Qué toca en `fecha`: cuenta cuántos días se marcaron "Hecho" antes de esa fecha.
   Con `suponerHoyHecho`, para una fecha futura se cuenta hoy como hecho
   (sirve para saber qué preparar mañana). */
function queToca(est, tipo, fecha, hoy, suponerHoyHecho = false) {
  const lista = LISTAS[tipo];
  if (fecha < est.inicio) return { antesDeInicio: true };
  const hechos = est.hechos[tipo];
  let n = hechos.filter((f) => f >= est.inicio && f < fecha).length;
  if (suponerHoyHecho && hoy && fecha > hoy && hoy >= est.inicio && !hechos.includes(hoy)) n++;
  n += est.ajuste[tipo] || 0;
  const L = lista.length;
  const pos = ((n % L) + L) % L;
  const vueltas = lista[pos].preps.length;
  const vuelta = ((Math.floor(n / L) % vueltas) + vueltas) % vueltas;
  return { pos, vuelta, item: lista[pos], prep: lista[pos].preps[vuelta], total: L, hecho: hechos.includes(fecha) };
}

/* ---------- Cantidades ---------- */
function redondear(v) { return Math.round(v * 100) / 100; }
function formatoCantidad(cant, unidad) {
  if (unidad === "g" && cant >= 1000) return `${redondear(cant / 1000)} kg`;
  if (unidad === "ml" && cant >= 1000) return `${redondear(cant / 1000)} l`;
  if (unidad === "porción") return `${redondear(cant)} ${cant === 1 ? "porción" : "porciones"}`;
  if (unidad === "g" || unidad === "ml") return `${Math.round(cant)} ${unidad}`;
  return `${redondear(cant)} ${unidad}`;
}
const pesos = (v) => "$" + v.toFixed(2);

function personasDe(est, fecha, tipo) {
  return (est.personas[fecha] && est.personas[fecha][tipo]) ?? est.personasDefault[tipo];
}

/* Suma los insumos de desayuno + comida de una fecha. */
function insumosDelDia(est, fecha, hoy) {
  const total = {};
  ["desayuno", "comida"].forEach((tipo) => {
    const t = queToca(est, tipo, fecha, hoy, true);
    if (!t.prep) return;
    const p = personasDe(est, fecha, tipo);
    t.prep.ingredientes.forEach((g) => {
      const k = g.insumo + "|" + g.unidad;
      total[k] = total[k] || { ...g, cantidad: 0 };
      total[k].cantidad += g.cantidad * p;
    });
  });
  return Object.values(total).sort((a, b) => a.insumo.localeCompare(b.insumo, "es"));
}

const C = {
  bg: "#F7F3EC", paper: "#FFFDF9", ink: "#221F1A", inkSoft: "#6B6558", line: "#DDD5C4",
  accent: "#A8641C", accentSoft: "#F5E6D2", ok: "#1F5C4D", okSoft: "#DCEBE5", warn: "#B7791F", warnSoft: "#F8ECD6",
};

export default function ComidaPersonal() {
  const [est, setEst] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [vista, setVista] = useState("hoy"); // "hoy" | "manana" | "modificar"
  const [desbloqueado, setDesbloqueado] = useState(false);
  const hoy = fechaStr(new Date());

  useAtras(vista !== "hoy", () => setVista("hoy"));

  async function cargar() {
    try {
      setEst(normalizar(await leerEstado()));
      setError("");
    } catch (e) {
      setError("No se pudo leer el menú del servidor. Revisa el internet y vuelve a intentar.");
      setEst((x) => x || normalizar(null));
    }
  }
  useEffect(() => { cargar(); }, []);

  async function cambiar(aplicar) {
    setEst((x) => aplicar(JSON.parse(JSON.stringify(x)))); // se ve al instante
    setGuardando(true);
    try {
      setEst(await guardarCambio(aplicar));
      setError("");
    } catch (e) {
      setError("No se guardó el cambio. Revisa el internet; lo que ves puede no estar en los otros teléfonos.");
    } finally {
      setGuardando(false);
    }
  }

  if (!est) {
    return (
      <div className="flex items-center justify-center gap-2 py-20" style={{ color: C.inkSoft, background: C.bg, minHeight: "100%" }}>
        <Loader2 size={18} className="animate-spin" /> Cargando menú…
      </div>
    );
  }

  const fecha = vista === "manana" ? sumarDias(hoy, 1) : hoy;
  const ponerPersonas = (tipo, n) => cambiar((e) => {
    e.personas[fecha] = { ...(e.personas[fecha] || {}), [tipo]: Math.max(0, n || 0) };
    const corte = sumarDias(hoy, -60); // se guardan solo los últimos 60 días
    Object.keys(e.personas).forEach((k) => { if (k < corte) delete e.personas[k]; });
    return e;
  });
  const marcarHecho = (tipo, hecho) => cambiar((e) => {
    const l = e.hechos[tipo].filter((f) => f !== hoy);
    if (hecho) l.push(hoy);
    e.hechos[tipo] = l.filter((f) => f >= sumarDias(hoy, -400)).sort();
    return e;
  });

  const pestañas = [["hoy", "Hoy"], ["manana", "Mañana"], ["modificar", "Modificar"]];

  return (
    <div style={{ background: C.bg, minHeight: "100%", fontFamily: "'Inter', sans-serif", color: C.ink }} className="pb-16">
      <div className="mx-auto px-4 pt-4" style={{ maxWidth: 640 }}>
        <div className="flex gap-2 mb-1">
          {pestañas.map(([id, t]) => (
            <button key={id} onClick={() => setVista(id)}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
              style={vista === id ? { background: C.accent, color: "#fff" } : { background: C.paper, color: C.inkSoft, border: `1px solid ${C.line}` }}>
              {id === "modificar" ? (desbloqueado ? <Unlock size={14} /> : <Lock size={14} />) : null}
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mb-3 mt-2" style={{ minHeight: 18 }}>
          <div style={{ fontSize: 13, color: C.inkSoft }}>{vista !== "modificar" ? fechaBonita(fecha) : "Ajustes del ciclo"}</div>
          {guardando ? <div style={{ fontSize: 12, color: C.inkSoft }} className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Guardando…</div> : null}
        </div>

        {error ? (
          <div className="flex gap-2 items-start rounded-xl p-3 mb-3 text-sm" style={{ background: C.warnSoft, color: C.warn }}>
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button onClick={cargar} className="font-bold underline">Reintentar</button>
          </div>
        ) : null}

        {vista === "modificar" ? (
          desbloqueado
            ? <Modificar est={est} cambiar={cambiar} hoy={hoy} onBloquear={() => setDesbloqueado(false)} />
            : <PedirClave onOk={() => setDesbloqueado(true)} />
        ) : (
          <>
            {vista === "manana" ? (
              <p className="mb-3 rounded-xl px-3 py-2" style={{ fontSize: 12.5, background: C.paper, border: `1px solid ${C.line}`, color: C.inkSoft }}>
                Esto es lo que toca si hoy se marca como hecho. Si hoy no se marca, mañana se repite el platillo de hoy.
              </p>
            ) : null}
            {["desayuno", "comida"].map((tipo) => (
              <TarjetaComida key={tipo + fecha} tipo={tipo} est={est} hoy={hoy} fecha={fecha}
                toca={queToca(est, tipo, fecha, hoy, vista === "manana")}
                personas={personasDe(est, fecha, tipo)} onPersonas={(n) => ponerPersonas(tipo, n)}
                esHoy={vista === "hoy"} onHecho={(h) => marcarHecho(tipo, h)} />
            ))}
            {vista === "manana" ? <ListaInsumos filas={insumosDelDia(est, fecha, hoy)} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

function TarjetaComida({ tipo, toca, est, hoy, fecha, personas, onPersonas, esHoy, onHecho }) {
  const [verPrep, setVerPrep] = useState(true);
  const Icon = tipo === "desayuno" ? Coffee : UtensilsCrossed;
  const titulo = tipo === "desayuno" ? "Desayuno" : "Comida";
  const tope = CICLO.topes[tipo];
  const caja = { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 16 };

  const cabecera = (
    <div className="flex items-center gap-2 mb-3">
      <div className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, background: C.accentSoft }}>
        <Icon size={16} color={C.accent} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent }}>{titulo}</div>
      {toca.item ? (
        <div className="ml-auto text-right" style={{ fontSize: 11.5, color: C.inkSoft }}>
          {toca.item.base} · {toca.pos + 1} de {toca.total} · vuelta {toca.vuelta + 1}
        </div>
      ) : null}
    </div>
  );

  if (toca.antesDeInicio) {
    return (
      <div className="p-4 mb-3" style={caja}>
        {cabecera}
        <div style={{ fontSize: 14, color: C.inkSoft }}>El ciclo empieza el {fechaBonita(est.inicio)}.</div>
      </div>
    );
  }

  const { prep } = toca;
  const ayer = sumarDias(hoy, -1);
  const seQuedo = esHoy && ayer >= est.inicio && !est.hechos[tipo].includes(ayer);

  return (
    <div className="p-4 mb-3" style={{ ...caja, borderColor: toca.hecho && esHoy ? C.ok : C.line }}>
      {cabecera}

      {/* Personas: lo primero de la receta */}
      <div className="flex items-center gap-3 rounded-xl px-3 py-2 mb-3" style={{ background: C.bg }}>
        <Users size={16} color={C.inkSoft} />
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>¿Cuántos comen?</span>
        <div className="flex items-center rounded-full ml-auto" style={{ border: `1px solid ${C.line}`, background: C.paper }}>
          <button onClick={() => onPersonas(personas - 1)} aria-label="Una persona menos" className="w-10 h-10 flex items-center justify-center"><Minus size={16} /></button>
          <input type="number" inputMode="numeric" min="0" value={personas}
            onChange={(e) => onPersonas(parseInt(e.target.value || "0", 10))}
            aria-label={`Personas para ${titulo.toLowerCase()}`}
            className="w-12 text-center font-bold bg-transparent" style={{ fontSize: 18 }} />
          <button onClick={() => onPersonas(personas + 1)} aria-label="Una persona más" className="w-10 h-10 flex items-center justify-center"><Plus size={16} /></button>
        </div>
      </div>

      {seQuedo ? (
        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: C.warn }}>
          <RotateCcw size={13} /> Ayer no se marcó como hecho: se quedó el mismo platillo.
        </div>
      ) : null}

      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 21, lineHeight: 1.2 }}>{prep.nombre}</div>
      <div className="mt-1" style={{ fontSize: 12.5, color: C.inkSoft }}>
        {pesos(prep.costo)} por persona{prep.costo > tope ? <b style={{ color: C.warn }}> (arriba del tope ${tope})</b> : null}
        {" · "}<b style={{ color: C.ink }}>Total {pesos(prep.costo * personas)}</b>
      </div>

      {/* Ingredientes multiplicados */}
      <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        <div className="flex px-3 py-2" style={{ background: C.bg, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkSoft }}>
          <span className="flex-1">Ingrediente</span><span className="w-20 text-right">x persona</span><span className="w-24 text-right">x {personas}</span>
        </div>
        {prep.ingredientes.map((g) => {
          const total = g.cantidad * personas;
          const fraccion = (g.unidad === "pza" || g.unidad === "porción") && total % 1 !== 0;
          return (
            <div key={g.insumo} className="flex px-3 py-2 items-baseline" style={{ borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
              <span className="flex-1 min-w-0">
                {g.insumo}
                {CICLO.produccion.includes(g.insumo) ? <span style={{ fontSize: 10.5, color: C.ok, fontWeight: 700, marginLeft: 6 }}>DE DÍA</span> : null}
              </span>
              <span className="w-20 text-right" style={{ color: C.inkSoft, fontVariantNumeric: "tabular-nums" }}>{formatoCantidad(g.cantidad, g.unidad)}</span>
              <span className="w-24 text-right font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatoCantidad(total, g.unidad)}
                {fraccion ? <div style={{ fontSize: 10.5, color: C.inkSoft, fontWeight: 500 }}>usar {Math.ceil(total)}</div> : null}
              </span>
            </div>
          );
        })}
      </div>

      <button onClick={() => setVerPrep((v) => !v)} className="mt-3 flex items-center gap-1 text-sm font-bold" style={{ color: C.accent }}>
        Preparación {verPrep ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {verPrep ? <p className="mt-1" style={{ fontSize: 14, lineHeight: 1.5 }}>{prep.preparacion}</p> : null}

      {prep.ingredientes.map((g) => CICLO.avisos[g.insumo] ? (
        <div key={"av" + g.insumo} className="flex items-center gap-2 mt-2 text-sm rounded-lg px-3 py-2" style={{ background: C.accentSoft, color: C.accent }}>
          <Snowflake size={14} /> {g.insumo}: {CICLO.avisos[g.insumo]}
        </div>
      ) : null)}

      {/* Marcar como hecho (solo hoy) */}
      {esHoy ? (
        toca.hecho ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: C.okSoft, color: C.ok }}>
            <Check size={18} />
            <span className="flex-1 text-sm font-bold">Hecho. Mañana sigue: {queToca(est, tipo, sumarDias(fecha, 1), hoy).prep.nombre}</span>
            <button onClick={() => onHecho(false)} className="text-xs font-semibold underline">Deshacer</button>
          </div>
        ) : (
          <button onClick={() => onHecho(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
            style={{ background: C.ok, color: "#fff" }}>
            <Check size={17} /> Marcar {titulo.toLowerCase()} como hecho
          </button>
        )
      ) : null}
    </div>
  );
}

function ListaInsumos({ filas, compacta }) {
  if (!filas.length) return null;
  return (
    <div className={compacta ? "" : "p-4 mb-3"} style={compacta ? {} : { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 16 }}>
      {!compacta ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <ListChecks size={16} color={C.accent} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Insumos para mañana</div>
          </div>
          <p style={{ fontSize: 12.5, color: C.inkSoft }} className="mb-2">Desayuno y comida juntos. Lo marcado "DE DÍA" se pide como producción.</p>
        </>
      ) : null}
      {filas.map((g) => (
        <div key={g.insumo + g.unidad} className="flex py-1.5 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
          <span className="flex-1">
            {g.insumo}
            {CICLO.produccion.includes(g.insumo) ? <span style={{ fontSize: 10.5, color: C.ok, fontWeight: 700, marginLeft: 6 }}>DE DÍA</span> : null}
          </span>
          <b style={{ fontVariantNumeric: "tabular-nums" }}>{formatoCantidad(g.cantidad, g.unidad)}</b>
        </div>
      ))}
    </div>
  );
}

function PedirClave({ onOk }) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [revisando, setRevisando] = useState(false);
  async function entrar(e) {
    e.preventDefault();
    if (!pin) return;
    setRevisando(true); setMsg("");
    try {
      if (!(await gerentePinConfigurado())) { setMsg("Todavía no hay clave de Gerente. Créala primero en el módulo Gerente."); return; }
      if (await verificarGerentePin(pin)) onOk();
      else setMsg("Clave incorrecta.");
    } catch (err) {
      setMsg("No se pudo revisar la clave. Revisa el internet.");
    } finally {
      setRevisando(false);
    }
  }
  return (
    <form onSubmit={entrar} className="p-5 rounded-2xl text-center" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
      <Lock size={26} color={C.accent} style={{ margin: "0 auto 8px" }} />
      <div style={{ fontWeight: 700, fontSize: 16 }}>Clave de Gerente</div>
      <p style={{ fontSize: 13, color: C.inkSoft }} className="mt-1 mb-4">Para cambiar el ciclo del menú de personal.</p>
      <input id="cp-pin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)}
        aria-label="Clave de Gerente" className="w-40 text-center rounded-xl px-3 py-2.5 text-lg font-bold tracking-widest"
        style={{ border: `1px solid ${C.line}`, background: C.bg }} />
      {msg ? <p className="mt-3 text-sm" style={{ color: C.warn }}>{msg}</p> : null}
      <button type="submit" disabled={revisando} className="mt-4 w-40 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mx-auto"
        style={{ background: C.accent, color: "#fff", opacity: revisando ? 0.8 : 1 }}>
        {revisando ? <Loader2 size={15} className="animate-spin" /> : <Unlock size={15} />} Entrar
      </button>
    </form>
  );
}

function Modificar({ est, cambiar, hoy, onBloquear }) {
  const [inicio, setInicio] = useState(est.inicio);
  const fila = "flex items-center justify-between gap-3 py-3";
  const btn = { border: `1px solid ${C.line}`, background: C.paper };
  const ultimos = Array.from({ length: 10 }, (_, i) => sumarDias(hoy, -i)).filter((f) => f >= est.inicio);

  return (
    <div className="px-4 py-2 rounded-xl text-sm" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
      <div className={fila}>
        <label htmlFor="cp-inicio" className="font-semibold">Primer día del ciclo</label>
        <input id="cp-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
          onBlur={() => inicio && inicio !== est.inicio && cambiar((e) => { e.inicio = inicio; return e; })}
          className="rounded-lg px-2 py-1" style={btn} />
      </div>

      {["desayuno", "comida"].map((tipo) => {
        const t = queToca(est, tipo, hoy, hoy);
        return (
          <div key={tipo} className="py-3" style={{ borderTop: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">Mover {tipo}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>Hoy toca: {t.prep ? t.prep.nombre : "—"}</div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => cambiar((e) => { e.ajuste[tipo] -= 1; return e; })} className="px-3 py-1.5 rounded-lg font-bold" style={btn}>← Atrás</button>
                <button onClick={() => cambiar((e) => { e.ajuste[tipo] += 1; return e; })} className="px-3 py-1.5 rounded-lg font-bold" style={btn}>Adelante →</button>
              </div>
            </div>
          </div>
        );
      })}

      {["desayuno", "comida"].map((tipo) => (
        <div key={"pd" + tipo} className={fila} style={{ borderTop: `1px solid ${C.line}` }}>
          <label htmlFor={"cp-pd-" + tipo} className="font-semibold">Personas normales en {tipo}</label>
          <input id={"cp-pd-" + tipo} type="number" min="0" value={est.personasDefault[tipo]}
            onChange={(ev) => { const n = parseInt(ev.target.value || "0", 10); cambiar((e) => { e.personasDefault[tipo] = n; return e; }); }}
            className="w-16 text-center rounded-lg px-2 py-1" style={btn} />
        </div>
      ))}

      {/* Corregir días hechos */}
      <div className="py-3" style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="font-semibold mb-1">Días marcados como hechos</div>
        <div style={{ fontSize: 12, color: C.inkSoft }} className="mb-2">Toca para corregir si alguien marcó mal un día.</div>
        {ultimos.length === 0 ? <div style={{ fontSize: 12.5, color: C.inkSoft }}>El ciclo todavía no empieza.</div> : null}
        {ultimos.map((f) => (
          <div key={f} className="flex items-center gap-2 py-1">
            <span className="flex-1" style={{ fontSize: 13 }}>{fechaBonita(f)}</span>
            {["desayuno", "comida"].map((tipo) => {
              const on = est.hechos[tipo].includes(f);
              return (
                <button key={tipo} onClick={() => cambiar((e) => {
                  const l = e.hechos[tipo].filter((x) => x !== f);
                  if (!on) l.push(f);
                  e.hechos[tipo] = l.sort();
                  return e;
                })}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                  style={on ? { background: C.okSoft, color: C.ok } : { ...btn, color: C.inkSoft }}>
                  {on ? <Check size={12} /> : null}{tipo === "desayuno" ? "Desayuno" : "Comida"}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="py-3 flex items-center justify-between gap-3" style={{ borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft }}>
        <span>Menú versión {CICLO.version}: {COMIDA.length} comidas y {DESAYUNO.length} desayunos, 4 vueltas.</span>
        <button onClick={onBloquear} className="flex items-center gap-1 font-semibold flex-shrink-0" style={{ color: C.accent }}><Lock size={13} /> Bloquear</button>
      </div>
    </div>
  );
}

/* ---------- Para el módulo DÍA (pestaña Mañana) ----------
   Muestra qué toca mañana de desayuno y comida y los insumos sumados,
   para que quien cierra el día tenga todo listo. Solo lectura. */
export function ComidaPersonalManana() {
  const [est, setEst] = useState(null);
  const [falla, setFalla] = useState(false);
  const [abierto, setAbierto] = useState(true);
  useEffect(() => {
    leerEstado().then((v) => setEst(normalizar(v))).catch(() => setFalla(true));
  }, []);
  const hoy = fechaStr(new Date());
  const manana = sumarDias(hoy, 1);

  const caja = { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14 };
  if (falla) return <div className="p-3 mt-4 text-sm" style={{ ...caja, color: C.inkSoft }}>No se pudo cargar la comida de personal de mañana.</div>;
  if (!est) return <div className="p-3 mt-4 text-sm flex items-center gap-2" style={{ ...caja, color: C.inkSoft }}><Loader2 size={14} className="animate-spin" /> Comida de personal…</div>;

  const platos = ["desayuno", "comida"].map((tipo) => ({ tipo, t: queToca(est, tipo, manana, hoy, true), p: personasDe(est, manana, tipo) }));
  if (platos.every((x) => x.t.antesDeInicio)) return null;

  return (
    <div className="p-4 mt-4" style={caja}>
      <button onClick={() => setAbierto((v) => !v)} className="w-full flex items-center gap-2 text-left">
        <UtensilsCrossed size={16} color={C.accent} />
        <span className="flex-1" style={{ fontWeight: 700, fontSize: 15 }}>Comida de personal · mañana</span>
        {abierto ? <ChevronUp size={16} color={C.inkSoft} /> : <ChevronDown size={16} color={C.inkSoft} />}
      </button>
      {abierto ? (
        <>
          {platos.map(({ tipo, t, p }) => t.prep ? (
            <div key={tipo} className="mt-2 flex items-baseline gap-2 text-sm">
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.accent, width: 74 }}>{tipo}</span>
              <span className="flex-1 font-semibold">{t.prep.nombre}</span>
              <span style={{ color: C.inkSoft }}>{p} pers.</span>
            </div>
          ) : null)}
          <p className="mt-2 mb-1" style={{ fontSize: 12, color: C.inkSoft }}>Si hoy no se marcó como hecho en Comida de personal, se repite lo de hoy. Las personas se cambian allá.</p>
          <ListaInsumos filas={insumosDelDia(est, manana, hoy)} compacta />
        </>
      ) : null}
    </div>
  );
}
