import React, { useState, useEffect, useRef } from "react";
import { Clock, Package, Warehouse, Sparkles, ShieldCheck, ChevronRight, ArrowLeft, Home } from "lucide-react";
import RelojChecador from "./RelojChecador.jsx";
import DiaInventario from "./DiaInventario.jsx";
import Par from "./Par.jsx";
import Limpieza from "./Limpieza.jsx";

const C = {
  bg: "#F7F3EC",
  paper: "#FFFDF9",
  ink: "#221F1A",
  inkSoft: "#6B6558",
  line: "#DDD5C4",
  accent: "#1F5C4D",
};

const MODULOS = [
  {
    id: "checador",
    nombre: "Reloj Checador",
    subtitulo: "Entradas, salidas, propinas y bitácora del personal",
    icon: Clock,
    bg: "#201E1B",
    texto: "#F7F3EA",
    sub: "#8A8F86",
  },
  {
    id: "dia",
    nombre: "DÍA — Inventario diario",
    subtitulo: "Conteo diario de perecederos y pendientes",
    icon: Package,
    bg: "#1F5C4D",
    texto: "#FFFFFF",
    sub: "#CFE3DC",
  },
  {
    id: "limpieza",
    nombre: "Limpieza semanal",
    subtitulo: "Actividades por área, con foto de comprobante",
    icon: Sparkles,
    bg: "#8A5A2E",
    texto: "#FFFFFF",
    sub: "#E9D8C2",
  },
  {
    id: "par",
    nombre: "PAR — Inventario semanal",
    subtitulo: "Conteo semanal y lista de compras a proveedores",
    icon: Warehouse,
    bg: "#B23A2E",
    texto: "#FFFFFF",
    sub: "#F1D2CD",
  },
  {
    id: "gerente",
    nombre: "Gerente",
    subtitulo: "Checklist de cierre y pendientes de limpieza (con clave)",
    icon: ShieldCheck,
    bg: "#3A3632",
    texto: "#FFFFFF",
    sub: "#C7C1B8",
  },
];

export default function App() {
  const [modulo, setModulo] = useState(() => {
    try {
      return localStorage.getItem("control_bondiola_modulo") || null;
    } catch (e) {
      return null;
    }
  });

  function elegirModulo(id) {
    setModulo(id);
    try { localStorage.setItem("control_bondiola_modulo", id); } catch (e) {}
  }

  function volverAlInicio() {
    setModulo(null);
    try { localStorage.removeItem("control_bondiola_modulo"); } catch (e) {}
  }

  /* ---------- Atrás inteligente ----------
     Las pantallas internas y ventanas de cada módulo se anotan en window.__bndAtras
     (ver useAtras en cada archivo). El botón de la barra superior y el botón/gesto de "atrás" del
     teléfono cierran primero lo último que se abrió; si no hay nada, regresan al menú
     principal; y en el menú principal piden tocar atrás dos veces para salir. */
  const [hayAtras, setHayAtras] = useState(false);
  const [aviso, setAviso] = useState("");
  const avisoTimer = useRef(null);

  useEffect(() => {
    const actualizar = () => setHayAtras(((window.__bndAtras || []).length) > 0);
    actualizar();
    window.addEventListener("bnd-atras", actualizar);
    return () => window.removeEventListener("bnd-atras", actualizar);
  }, []);

  function mostrarAviso(texto) {
    setAviso(texto);
    clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(""), 2200);
  }

  // Regresa un paso. Devuelve false si ya estamos en el menú principal.
  function irAtras() {
    const pila = window.__bndAtras || [];
    if (pila.length > 0) {
      try { pila[pila.length - 1].regresar(); } catch (e) {}
      return true;
    }
    if (modulo) {
      volverAlInicio();
      return true;
    }
    return false;
  }
  const irAtrasRef = useRef(irAtras);
  irAtrasRef.current = irAtras;

  // Botón / gesto "atrás" del teléfono: se deja una "marca" en el historial del
  // navegador para atraparlo, en lugar de que el navegador se salga de la app.
  useEffect(() => {
    let intentoSalir = 0;
    const marcar = () => { try { window.history.pushState({ bnd: true }, ""); } catch (e) {} };
    try { if (!(window.history.state && window.history.state.bnd)) marcar(); } catch (e) {}

    function onPop() {
      if (irAtrasRef.current()) {
        marcar();
        return;
      }
      const ahora = Date.now();
      if (ahora - intentoSalir < 2500) {
        try { window.history.back(); } catch (e) {}
        return;
      }
      intentoSalir = ahora;
      marcar();
      mostrarAviso("Toca atrás otra vez para salir");
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const moduloActivo = MODULOS.find((m) => m.id === modulo);
  const avisoEl = aviso ? <AvisoFlotante texto={aviso} /> : null;

  if (modulo === "checador") {
    return (
      <ModuloShell modulo={moduloActivo} hayAtras={hayAtras} onAtras={irAtras} onMenu={volverAlInicio}>
        <RelojChecador />
      </ModuloShell>
    );
  }

  if (modulo === "dia") {
    return (
      <ModuloShell modulo={moduloActivo} hayAtras={hayAtras} onAtras={irAtras} onMenu={volverAlInicio}>
        <DiaInventario />
      </ModuloShell>
    );
  }

  if (modulo === "limpieza") {
    return (
      <ModuloShell modulo={moduloActivo} hayAtras={hayAtras} onAtras={irAtras} onMenu={volverAlInicio}>
        <Limpieza />
      </ModuloShell>
    );
  }

  if (modulo === "par") {
    return (
      <ModuloShell modulo={moduloActivo} hayAtras={hayAtras} onAtras={irAtras} onMenu={volverAlInicio}>
        <Par />
      </ModuloShell>
    );
  }

  if (modulo === "gerente") {
    return (
      <ModuloShell modulo={moduloActivo} hayAtras={hayAtras} onAtras={irAtras} onMenu={volverAlInicio}>
        <Limpieza autoGerente />
      </ModuloShell>
    );
  }

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: C.bg, fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');`}</style>
      {avisoEl}

      <div style={{ maxWidth: 420, width: "100%" }}>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 26,
            color: C.ink,
            marginBottom: 4,
            textAlign: "center",
          }}
        >
          Control Bondiola
        </h1>
        <p style={{ fontSize: 13, color: C.inkSoft, textAlign: "center", marginBottom: 28 }}>
          Elige qué quieres usar
        </p>

        <div className="flex flex-col gap-3">
          {MODULOS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => elegirModulo(m.id)}
                className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl text-left"
                style={{ background: m.bg, boxShadow: "0 3px 10px rgba(0,0,0,0.12)" }}
              >
                <div
                  className="flex-shrink-0 rounded-full flex items-center justify-center"
                  style={{ width: 44, height: 44, background: "#FFFFFF22" }}
                >
                  <Icon size={20} color={m.texto} />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontWeight: 700, fontSize: 15, color: m.texto }}>
                    {m.nombre}
                  </div>
                  <div style={{ fontSize: 12, color: m.sub, marginTop: 2 }}>
                    {m.subtitulo}
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: m.sub }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Envuelve cada módulo con una barra de color arriba (igual a su tarjeta del menú) que
   incluye el botón "Atrás". La barra ocupa su propio espacio (ya no flota encima), así que
   nunca tapa el contenido; se queda pegada arriba al hacer scroll. Las ventanas emergentes
   de cada módulo quedan por encima de la barra (traen su propio botón de cerrar) y el
   botón/gesto "atrás" del teléfono sigue funcionando igual. */
const ALTO_BARRA = 48;
function ModuloShell({ modulo, hayAtras, onAtras, onMenu, children }) {
  const Icon = modulo.icon;
  const btn = {
    background: "#FFFFFF1F",
    color: modulo.texto,
    border: "1px solid #FFFFFF33",
  };
  return (
    <div style={{ "--bnd-barra": `${ALTO_BARRA}px` }}>
      <div
        className="no-print w-full flex items-center gap-2 px-2"
        style={{ background: modulo.bg, height: ALTO_BARRA, position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
      >
        <button
          onClick={hayAtras ? onAtras : onMenu}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full text-[13px] font-bold flex-shrink-0"
          style={btn}
        >
          <ArrowLeft size={16} />
          {hayAtras ? "Atrás" : "Menú"}
        </button>
        <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5">
          <Icon size={14} color={modulo.texto} />
          <span className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: modulo.texto, letterSpacing: "0.02em" }}>
            {modulo.nombre}
          </span>
        </div>
        <button
          onClick={onMenu}
          aria-label="Menú principal"
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ ...btn, width: 34, height: 34, visibility: hayAtras ? "visible" : "hidden" }}
        >
          <Home size={16} />
        </button>
      </div>
      {children}
    </div>
  );
}

function AvisoFlotante({ texto }) {
  return (
    <div
      className="fixed left-1/2 z-[70] px-4 py-2.5 rounded-full text-sm font-semibold"
      style={{ bottom: 28, transform: "translateX(-50%)", background: "#221F1A", color: "#F7F3EA", boxShadow: "0 4px 14px rgba(0,0,0,0.35)", whiteSpace: "nowrap" }}
    >
      {texto}
    </div>
  );
}
