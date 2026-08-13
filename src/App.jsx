import React, { useState, useEffect } from "react";
import { Clock, Package, Receipt, ChevronRight, ArrowLeft, Sparkles, Lock, ClipboardList } from "lucide-react";
import RelojChecador from "./RelojChecador.jsx";
import DiaInventario from "./DiaInventario.jsx";
import Par from "./Par.jsx";
import ProduccionMercancia from "./ProduccionMercancia.jsx";

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
    color: "#D6A24C",
    bg: "#201E1B",
  },
  {
    id: "dia",
    nombre: "DÍA — Inventario diario",
    subtitulo: "Conteo diario de perecederos y pendientes",
    color: "#1F5C4D",
    bg: "#F7F3EC",
  },
  {
    id: "limpieza",
    nombre: "Limpieza semanal",
    subtitulo: "Actividades por área, con foto de comprobante",
    color: "#8A5A2E",
    bg: "#F7F3EC",
  },
  {
    id: "par",
    nombre: "PAR — Inventario semanal",
    subtitulo: "Conteo semanal y lista de compras a proveedores",
    color: "#B23A2E",
    bg: "#F7F3EC",
  },
  {
    id: "gerente",
    nombre: "Gerente",
    subtitulo: "Checklist de cierre y pendientes de limpieza (con clave)",
    color: "#221F1A",
    bg: "#F7F3EC",
  },
  {
    id: "produccion",
    nombre: "Ingresos del Día",
    subtitulo: "Lo que el personal registró al checar su salida",
    color: "#2E5C8A",
    bg: "#F7F3EC",
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
      <div className="relative">
        <BotonVolver onClick={volverAlInicio} />
        <DiaInventario />
      </div>
    );
  }

  if (modulo === "limpieza") {
    return (
      <div className="relative">
        <BotonVolver onClick={volverAlInicio} />
        <DiaInventario initialTab="limpieza" />
      </div>
    );
  }

  if (modulo === "par") {
    return (
      <div className="relative">
        <BotonVolver onClick={volverAlInicio} />
        <Par />
      </div>
    );
  }

  if (modulo === "gerente") {
    return (
      <div className="relative">
        <BotonVolver onClick={volverAlInicio} />
        <DiaInventario initialTab="limpieza" autoGerente />
      </div>
    );
  }

  if (modulo === "produccion") {
    return (
      <div className="relative">
        <BotonVolver onClick={volverAlInicio} />
        <ProduccionMercancia />
      </div>
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
          {MODULOS.map((m) => (
            <button
              key={m.id}
              onClick={() => elegirModulo(m.id)}
              className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl text-left"
              style={{ background: m.bg, border: `1px solid ${C.line}` }}
            >
              <div
                className="flex-shrink-0 rounded-full flex items-center justify-center"
                style={{ width: 44, height: 44, background: m.color + "22" }}
              >
                {m.id === "checador" && <Clock size={20} style={{ color: m.color }} />}
                {m.id === "dia" && <Package size={20} style={{ color: m.color }} />}
                {m.id === "limpieza" && <Sparkles size={20} style={{ color: m.color }} />}
                {m.id === "par" && <Receipt size={20} style={{ color: m.color }} />}
                {m.id === "gerente" && <Lock size={20} style={{ color: m.color }} />}
                {m.id === "produccion" && <ClipboardList size={20} style={{ color: m.color }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontWeight: 700, fontSize: 15, color: m.id === "checador" ? "#F7F3EA" : C.ink }}>
                  {m.nombre}
                </div>
                <div style={{ fontSize: 12, color: m.id === "checador" ? "#8A8F86" : C.inkSoft, marginTop: 2 }}>
                  {m.subtitulo}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: m.id === "checador" ? "#8A8F86" : C.inkSoft }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BotonVolver({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-3 left-3 z-[60] flex items-center gap-2 pl-2.5 pr-4 py-2.5 rounded-full text-sm font-bold"
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
