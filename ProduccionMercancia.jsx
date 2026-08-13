import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ChefHat, PackagePlus, Loader2, ClipboardList } from "lucide-react";

const SUPABASE_URL = "https://ciwfhbpcpygubsvtmwze.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AF_54iVTwT25rhMrhWbFXQ_oW2z_NeF";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function kvGet(key, tabla) {
  try {
    const { data, error } = await supabase.from(tabla).select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  } catch (e) {
    return null;
  }
}

const C = {
  bg: "#F7F3EC",
  paper: "#FFFDF9",
  ink: "#221F1A",
  inkSoft: "#6B6558",
  line: "#DDD5C4",
  produccion: "#8A5A2E",
  produccionBg: "#F1E4D3",
  mercancia: "#1F5C4D",
  mercanciaBg: "#DCE9E4",
};

function formatFechaHora(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

export default function ProduccionMercancia() {
  const [tab, setTab] = useState("produccion");
  const [produccion, setProduccion] = useState(null);
  const [mercancia, setMercancia] = useState(null);

  useEffect(() => {
    (async () => {
      const [p, m] = await Promise.all([
        kvGet("produccion_registros", "kv_store_reloj_checador"),
        kvGet("entradas_mercancia_v1", "kv_store"),
      ]);
      setProduccion(p || []);
      setMercancia(m || []);
    })();
  }, []);

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ background: C.bg, fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');`}</style>

      <header className="px-5 pt-16 pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24 }}>
          Ingresos del Día
        </h1>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>
          Lo que el personal registra al checar su salida
        </p>
      </header>

      <div className="flex gap-2 px-5 pt-4">
        <button
          onClick={() => setTab("produccion")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: tab === "produccion" ? C.produccion : C.paper, color: tab === "produccion" ? "#fff" : C.ink, border: `1px solid ${C.line}` }}
        >
          <ChefHat size={15} /> Producción
        </button>
        <button
          onClick={() => setTab("mercancia")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: tab === "mercancia" ? C.mercancia : C.paper, color: tab === "mercancia" ? "#fff" : C.ink, border: `1px solid ${C.line}` }}
        >
          <PackagePlus size={15} /> Mercancía
        </button>
      </div>

      <main className="flex-1 overflow-y-auto px-5 py-4 pb-10" style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
        {tab === "produccion" && (
          produccion === null ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" size={22} style={{ color: C.produccion }} /></div>
          ) : produccion.length === 0 ? (
            <EmptyState icon={ChefHat} texto="Nadie ha registrado actividades de producción todavía." />
          ) : (
            <div className="flex flex-col gap-2">
              {produccion.map((r) => (
                <div key={r.id} className="rounded-2xl p-4" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{r.employeeName}</span>
                    <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {formatFechaHora(r.hora)}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>{r.descripcion}</p>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "mercancia" && (
          mercancia === null ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" size={22} style={{ color: C.mercancia }} /></div>
          ) : mercancia.length === 0 ? (
            <EmptyState icon={PackagePlus} texto="No se ha registrado mercancía recibida todavía." />
          ) : (
            <div className="flex flex-col gap-2">
              {mercancia.map((r) => (
                <div key={r.id} className="rounded-2xl p-4" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{r.quien}</span>
                    <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {formatFechaHora(r.hora)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {r.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                        <span>{it.nombre}</span>
                        <span style={{ fontWeight: 700, color: C.mercancia }}>+{it.cantidad} {it.unidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}

function EmptyState({ icon: Icon, texto }) {
  return (
    <div className="text-center py-16">
      <Icon size={36} style={{ color: C.line, margin: "0 auto 12px" }} />
      <p style={{ fontSize: 14, color: C.inkSoft }}>{texto}</p>
    </div>
  );
}
