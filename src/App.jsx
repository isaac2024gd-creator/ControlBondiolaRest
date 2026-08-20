import React, { useState, useEffect } from "react";
import { Clock, Package, Warehouse, Sparkles, ShieldCheck, ChevronRight, ArrowLeft } from "lucide-react";
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

  const moduloActivo = MODULOS.find((m) => m.id === modulo);

  if (modulo === "checador") {
    return (
      <div className="relative">
        <BotonVolver onClick={volverAlInicio} />
        <RelojChecador />
      </div>
    );
  }

  if (modulo === "dia") {
    return (
      <ModuloShell modulo={moduloActivo} onVolver={volverAlInicio}>
        <DiaInventario />
      </ModuloShell>
    );
  }

  if (modulo === "limpieza") {
    return (
      <ModuloShell modulo={moduloActivo} onVolver={volverAlInicio}>
        <Limpieza />
      </ModuloShell>
    );
  }

  if (modulo === "par") {
    return (
      <ModuloShell modulo={moduloActivo} onVolver={volverAlInicio}>
        <Par />
      </ModuloShell>
    );
  }

  if (modulo === "gerente") {
    return (
      <ModuloShell modulo={moduloActivo} onVolver={volverAlInicio}>
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

/* Envuelve cada módulo (menos Checador, que ya tiene identidad propia) con una franja
   de color arriba que coincide con la tarjeta del menú, para saber siempre dónde estás. */
function ModuloShell({ modulo, onVolver, children }) {
  const Icon = modulo.icon;
  return (
    <div className="relative">
      <div
        className="w-full flex items-center gap-2 pl-16 pr-4"
        style={{ background: modulo.bg, height: 44, position: "sticky", top: 0, zIndex: 55 }}
      >
        <Icon size={15} color={modulo.texto} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: modulo.texto, letterSpacing: "0.02em" }}>
          {modulo.nombre}
        </span>
      </div>
      <BotonVolver onClick={onVolver} />
      {children}
    </div>
  );
}

function BotonVolver({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-1.5 left-3 z-[60] flex items-center gap-2 pl-2.5 pr-4 py-2 rounded-full text-sm font-bold"
      style={{
        background: "#221F1A",
        color: "#F7F3EA",
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        border: "1px solid #FFFFFF22",
      }}
    >
      <ArrowLeft size={16} />
      Menú principal
    </button>
  );
}
