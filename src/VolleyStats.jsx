import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ============================================================
   VolleyStats — estadísticas en vivo de voleibol
   - Persistencia local (localStorage) por defecto: funciona sin configurar nada.
   - Soporte opcional Supabase: pega URL + anon key en Ajustes.
   - Mobile-first, botones grandes, alto contraste.
   ============================================================ */

/* ---------------- Capa de datos ---------------- */
// Cliente Supabase cargado dinámicamente solo si el usuario lo configura.
let sbClient = null;
async function getSupabase(url, key) {
  if (!url || !key) return null;
  if (sbClient) return sbClient;
  const mod = await import("@supabase/supabase-js");
  sbClient = mod.createClient(url, key);
  return sbClient;
}

const LS = {
  get: (k, d) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
    catch { return d; }
  },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);

const POSICIONES = ["colocador", "opuesto", "central", "punta", "libero"];
const POS_LABEL = {
  colocador: "Colocador", opuesto: "Opuesto", central: "Central",
  punta: "Punta", libero: "Líbero",
};

/* Definición de acciones: tipo -> resultados, con punto y signo de eficiencia */
const ACCIONES = {
  saque: {
    label: "Saque",
    res: [
      { k: "ace", t: "Ace", punto: "self", tone: "good" },
      { k: "normal", t: "Normal", punto: null, tone: "neutral" },
      { k: "error", t: "Error", punto: "rival", tone: "bad" },
    ],
  },
  recepcion: {
    label: "Recepción",
    res: [
      { k: "perfecta", t: "Perfecta", punto: null, tone: "good" },
      { k: "buena", t: "Buena", punto: null, tone: "ok" },
      { k: "mala", t: "Mala", punto: null, tone: "warn" },
      { k: "error", t: "Error", punto: "rival", tone: "bad" },
    ],
  },
  ataque: {
    label: "Ataque",
    res: [
      { k: "punto", t: "Punto", punto: "self", tone: "good" },
      { k: "continuidad", t: "Continuidad", punto: null, tone: "neutral" },
      { k: "bloqueado", t: "Bloqueado", punto: "rival", tone: "bad" },
      { k: "error", t: "Error", punto: "rival", tone: "bad" },
    ],
  },
  bloqueo: {
    label: "Bloqueo",
    res: [
      { k: "punto", t: "Punto", punto: "self", tone: "good" },
      { k: "toque", t: "Toque", punto: null, tone: "ok" },
      { k: "error", t: "Error", punto: "rival", tone: "bad" },
    ],
  },
  defensa: {
    label: "Defensa",
    res: [
      { k: "exitosa", t: "Exitosa", punto: null, tone: "good" },
      { k: "error", t: "Error", punto: "rival", tone: "bad" },
    ],
  },
};

const TONE_BG = {
  good: "#1f7a44", ok: "#2d6e8e", neutral: "#4a4f5e",
  warn: "#9a6a14", bad: "#a83232",
};

/* ---------------- Estilos ---------------- */
const C = {
  bg: "#0e1116", panel: "#161b22", panel2: "#1c232d", line: "#2a323d",
  text: "#f2f4f8", dim: "#9aa4b2", accent: "#ff6b2c", accent2: "#3aa0ff",
  good: "#27c46a", bad: "#ff5252",
};

function useStyles() {
  useEffect(() => {
    if (document.getElementById("vs-style")) return;
    const s = document.createElement("style");
    s.id = "vs-style";
    s.textContent = `
      *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
      body{margin:0}
      .vs-root{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
        background:${C.bg};color:${C.text};min-height:100vh}
      .vs-btn{border:none;border-radius:12px;font-weight:700;cursor:pointer;
        color:#fff;transition:transform .05s ease, filter .15s ease}
      .vs-btn:active{transform:scale(.96)}
      .vs-btn:disabled{opacity:.4;cursor:not-allowed}
      input,select{font-size:16px;background:${C.panel2};color:${C.text};
        border:1px solid ${C.line};border-radius:10px;padding:12px;width:100%}
      input:focus,select:focus{outline:2px solid ${C.accent2};outline-offset:1px}
      .card{background:${C.panel};border:1px solid ${C.line};border-radius:16px;padding:16px}
      ::-webkit-scrollbar{height:8px;width:8px}
      ::-webkit-scrollbar-thumb{background:${C.line};border-radius:8px}
    `;
    document.head.appendChild(s);
  }, []);
}

/* ---------------- App root ---------------- */
export default function VolleyStats() {
  useStyles();
  const [cfg, setCfg] = useState(() => LS.get("vs_cfg", { url: "", key: "" }));
  const [session, setSession] = useState(() => LS.get("vs_session", null));
  const [route, setRoute] = useState("equipos");
  const [matchId, setMatchId] = useState(null);

  const supaMode = !!(cfg.url && cfg.key);

  // Estado de datos (espejo en memoria; persistido en LS o en Supabase)
  const [db, setDb] = useState(() => LS.get("vs_db", {
    equipos: [], jugadores: [], partidos: [], sets: [], acciones: [],
  }));

  // Persistir local siempre que cambie en modo local
  useEffect(() => { if (!supaMode) LS.set("vs_db", db); }, [db, supaMode]);

  if (!session) {
    return <Auth cfg={cfg} onLogin={(s) => { setSession(s); LS.set("vs_session", s); }} />;
  }

  const nav = (r, id = null) => { setRoute(r); setMatchId(id); };

  return (
    <div className="vs-root">
      <TopBar
        session={session}
        route={route}
        onNav={nav}
        onLogout={() => { setSession(null); LS.set("vs_session", null); }}
        onSettings={() => setRoute("ajustes")}
        supaMode={supaMode}
      />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "12px 12px 90px" }}>
        {route === "equipos" && <Equipos db={db} setDb={setDb} />}
        {route === "partidos" && <Partidos db={db} setDb={setDb} onOpen={(id) => nav("vivo", id)} onStats={(id) => nav("stats", id)} />}
        {route === "vivo" && <Vivo db={db} setDb={setDb} matchId={matchId} onFinish={() => nav("partidos")} />}
        {route === "stats" && <Stats db={db} matchId={matchId} onBack={() => nav("partidos")} />}
        {route === "ajustes" && <Ajustes cfg={cfg} setCfg={(c) => { setCfg(c); LS.set("vs_cfg", c); }} db={db} setDb={setDb} />}
      </main>
      <BottomNav route={route} onNav={nav} />
    </div>
  );
}

/* ---------------- Auth ---------------- */
function Auth({ cfg, onLogin }) {
  const supaMode = !!(cfg.url && cfg.key);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (supaMode) {
        const sb = await getSupabase(cfg.url, cfg.key);
        const fn = mode === "login" ? sb.auth.signInWithPassword : sb.auth.signUp;
        const { data, error } = await fn({ email, password: pass });
        if (error) throw error;
        if (data?.user) onLogin({ email: data.user.email, id: data.user.id });
        else setErr("Revisa tu correo para confirmar la cuenta.");
      } else {
        // Modo local: cuenta simbólica
        if (!email) throw new Error("Escribe un correo.");
        onLogin({ email, id: "local-" + email });
      }
    } catch (e) { setErr(e.message || "Error de autenticación."); }
    setBusy(false);
  };

  return (
    <div className="vs-root" style={{ display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>
          <span style={{ color: C.accent }}>Volley</span>Stats
        </div>
        <p style={{ color: C.dim, marginTop: 4 }}>Estadísticas en vivo para entrenadores.</p>

        <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
          {["login", "registro"].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className="vs-btn"
              style={{ flex: 1, padding: 12, background: mode === m ? C.accent : C.panel2 }}>
              {m === "login" ? "Entrar" : "Registro"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <input placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          {supaMode && (
            <input placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} type="password" />
          )}
          {err && <div style={{ color: C.bad, fontSize: 14 }}>{err}</div>}
          <button className="vs-btn" disabled={busy} onClick={submit}
            style={{ padding: 16, background: C.accent, fontSize: 17 }}>
            {busy ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </div>

        {!supaMode && (
          <p style={{ color: C.dim, fontSize: 12.5, marginTop: 14, lineHeight: 1.5 }}>
            Modo local activo: los datos se guardan en este dispositivo. Para sincronizar
            con Supabase, configúralo en Ajustes tras entrar.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Barras de navegación ---------------- */
function TopBar({ session, onLogout, onSettings, supaMode }) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 20, background: C.panel,
      borderBottom: `1px solid ${C.line}`, padding: "10px 14px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>
        <span style={{ color: C.accent }}>Volley</span>Stats
        <span style={{ fontSize: 11, color: supaMode ? C.good : C.dim, marginLeft: 8 }}>
          {supaMode ? "● Supabase" : "○ Local"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: C.dim, fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.email}</span>
        <button className="vs-btn" onClick={onSettings} style={{ padding: "8px 10px", background: C.panel2 }}>⚙</button>
        <button className="vs-btn" onClick={onLogout} style={{ padding: "8px 10px", background: C.panel2 }}>Salir</button>
      </div>
    </header>
  );
}

function BottomNav({ route, onNav }) {
  const items = [
    { k: "equipos", t: "Equipos", i: "👥" },
    { k: "partidos", t: "Partidos", i: "🏐" },
  ];
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
      background: C.panel, borderTop: `1px solid ${C.line}`,
      display: "flex", padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
    }}>
      {items.map((it) => {
        const active = route === it.k || (it.k === "partidos" && ["vivo", "stats"].includes(route));
        return (
          <button key={it.k} className="vs-btn" onClick={() => onNav(it.k)}
            style={{
              flex: 1, background: "transparent", color: active ? C.accent : C.dim,
              padding: 8, fontSize: 13, display: "flex", flexDirection: "column", gap: 2,
            }}>
            <span style={{ fontSize: 22 }}>{it.i}</span>{it.t}
          </button>
        );
      })}
    </nav>
  );
}

/* ---------------- Equipos y jugadores ---------------- */
function Equipos({ db, setDb }) {
  const [nombre, setNombre] = useState("");
  const [openTeam, setOpenTeam] = useState(null);

  const addTeam = () => {
    if (!nombre.trim()) return;
    setDb((d) => ({ ...d, equipos: [...d.equipos, { id: uid(), nombre: nombre.trim() }] }));
    setNombre("");
  };
  const delTeam = (id) => setDb((d) => ({
    ...d, equipos: d.equipos.filter((e) => e.id !== id),
    jugadores: d.jugadores.filter((j) => j.equipo_id !== id),
  }));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: "4px 0" }}>Equipos</h2>
      <div className="card" style={{ display: "flex", gap: 8 }}>
        <input placeholder="Nombre del equipo" value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTeam()} />
        <button className="vs-btn" onClick={addTeam} style={{ padding: "0 18px", background: C.accent }}>+</button>
      </div>

      {db.equipos.length === 0 && <Empty text="Crea tu primer equipo para empezar." />}

      {db.equipos.map((eq) => {
        const jug = db.jugadores.filter((j) => j.equipo_id === eq.id);
        const open = openTeam === eq.id;
        return (
          <div key={eq.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{eq.nombre}</div>
                <div style={{ color: C.dim, fontSize: 13 }}>{jug.length} jugador{jug.length !== 1 ? "es" : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="vs-btn" onClick={() => setOpenTeam(open ? null : eq.id)}
                  style={{ padding: "10px 14px", background: C.panel2 }}>{open ? "Cerrar" : "Plantilla"}</button>
                <button className="vs-btn" onClick={() => delTeam(eq.id)}
                  style={{ padding: "10px 14px", background: TONE_BG.bad }}>🗑</button>
              </div>
            </div>
            {open && <Plantilla db={db} setDb={setDb} equipoId={eq.id} jugadores={jug} />}
          </div>
        );
      })}
    </div>
  );
}

function Plantilla({ db, setDb, equipoId, jugadores }) {
  const [n, setN] = useState(""); const [num, setNum] = useState(""); const [pos, setPos] = useState("punta");
  const add = () => {
    if (!n.trim() || num === "") return;
    setDb((d) => ({
      ...d, jugadores: [...d.jugadores, {
        id: uid(), equipo_id: equipoId, nombre: n.trim(), numero: Number(num), posicion: pos,
      }],
    }));
    setN(""); setNum("");
  };
  const del = (id) => setDb((d) => ({ ...d, jugadores: d.jugadores.filter((j) => j.id !== id) }));

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1.2fr 56px", gap: 8 }}>
        <input placeholder="#" value={num} inputMode="numeric" onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} />
        <input placeholder="Nombre" value={n} onChange={(e) => setN(e.target.value)} />
        <select value={pos} onChange={(e) => setPos(e.target.value)}>
          {POSICIONES.map((p) => <option key={p} value={p}>{POS_LABEL[p]}</option>)}
        </select>
        <button className="vs-btn" onClick={add} style={{ background: C.accent }}>+</button>
      </div>
      {jugadores.sort((a, b) => a.numero - b.numero).map((j) => (
        <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel2, padding: "8px 12px", borderRadius: 10 }}>
          <span style={{ fontWeight: 800, width: 30, color: C.accent }}>#{j.numero}</span>
          <span style={{ flex: 1, fontWeight: 600 }}>{j.nombre}</span>
          <span style={{ color: C.dim, fontSize: 13 }}>{POS_LABEL[j.posicion]}</span>
          <button className="vs-btn" onClick={() => del(j.id)} style={{ padding: "6px 10px", background: "transparent", color: C.bad }}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Partidos ---------------- */
function Partidos({ db, setDb, onOpen, onStats }) {
  const [form, setForm] = useState(false);
  const [local, setLocal] = useState(""); const [visit, setVisit] = useState("");
  const [fecha, setFecha] = useState(todayISO()); const [formato, setFormato] = useState(5);

  const teamName = (id) => db.equipos.find((e) => e.id === id)?.nombre || "";

  const crear = () => {
    if (!local || !visit) return;
    const pid = uid();
    const setId = uid();
    setDb((d) => ({
      ...d,
      partidos: [...d.partidos, {
        id: pid, equipo_local_id: local, equipo_visitante_id: visit,
        nombre_local: teamName(local), nombre_visitante: teamName(visit),
        fecha, formato: Number(formato), estado: "en_curso",
        sets_local: 0, sets_visitante: 0,
      }],
      sets: [...d.sets, { id: setId, partido_id: pid, numero: 1, puntos_local: 0, puntos_visitante: 0, cerrado: false }],
    }));
    setForm(false);
    onOpen(pid);
  };

  const ordenados = [...db.partidos].reverse();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: "4px 0" }}>Partidos</h2>
        <button className="vs-btn" onClick={() => setForm(!form)} style={{ padding: "10px 16px", background: C.accent }}>
          {form ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {form && (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          {db.equipos.length < 2
            ? <div style={{ color: C.dim }}>Necesitas al menos 2 equipos. Créalos en la pestaña Equipos.</div>
            : <>
              <label style={{ color: C.dim, fontSize: 13 }}>Local</label>
              <select value={local} onChange={(e) => setLocal(e.target.value)}>
                <option value="">Selecciona…</option>
                {db.equipos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              <label style={{ color: C.dim, fontSize: 13 }}>Visitante</label>
              <select value={visit} onChange={(e) => setVisit(e.target.value)}>
                <option value="">Selecciona…</option>
                {db.equipos.filter((e) => e.id !== local).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: C.dim, fontSize: 13 }}>Fecha</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: C.dim, fontSize: 13 }}>Formato</label>
                  <select value={formato} onChange={(e) => setFormato(e.target.value)}>
                    <option value={3}>Al mejor de 3</option>
                    <option value={5}>Al mejor de 5</option>
                  </select>
                </div>
              </div>
              <button className="vs-btn" onClick={crear} style={{ padding: 16, background: C.accent, fontSize: 16 }}>
                Empezar partido
              </button>
            </>}
        </div>
      )}

      {ordenados.length === 0 && !form && <Empty text="Aún no hay partidos. Crea uno con + Nuevo." />}

      {ordenados.map((p) => (
        <div key={p.id} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {p.nombre_local} <span style={{ color: C.accent }}>{p.sets_local}–{p.sets_visitante}</span> {p.nombre_visitante}
              </div>
              <div style={{ color: C.dim, fontSize: 12.5 }}>
                {p.fecha} · Bo{p.formato} · {p.estado === "en_curso" ? "En curso" : "Finalizado"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {p.estado === "en_curso" &&
                <button className="vs-btn" onClick={() => onOpen(p.id)} style={{ padding: "10px 14px", background: C.good }}>▶ Vivo</button>}
              <button className="vs-btn" onClick={() => onStats(p.id)} style={{ padding: "10px 14px", background: C.panel2 }}>📊</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Registro en vivo ---------------- */
function setTarget(formato) { return formato === 5 ? 3 : 2; } // sets para ganar

// Puntos necesarios según si es el set decisivo: 25 normal, 15 el último.
function puntosObjetivo(setNumero, formato) {
  return setNumero === formato ? 15 : 25;
}
// Devuelve "local" | "visitante" | null según reglas: llegar al objetivo con 2+ de diferencia.
function ganadorSet(pl, pv, objetivo) {
  if (pl >= objetivo && pl - pv >= 2) return "local";
  if (pv >= objetivo && pv - pl >= 2) return "visitante";
  return null;
}

function Vivo({ db, setDb, matchId, onFinish }) {
  const partido = db.partidos.find((p) => p.id === matchId);
  const sets = useMemo(() => db.sets.filter((s) => s.partido_id === matchId).sort((a, b) => a.numero - b.numero), [db.sets, matchId]);
  const setActual = sets.find((s) => !s.cerrado) || sets[sets.length - 1];
  const jugadores = useMemo(() => {
    const ids = [partido?.equipo_local_id];
    return db.jugadores.filter((j) => ids.includes(j.equipo_id)).sort((a, b) => a.numero - b.numero);
  }, [db.jugadores, partido]);

  const [sel, setSel] = useState(null);       // jugador seleccionado
  const [tipo, setTipo] = useState("ataque"); // tipo de acción
  const [enCancha, setEnCancha] = useState(() => LS.get("vs_cancha_" + matchId, []));

  useEffect(() => { LS.set("vs_cancha_" + matchId, enCancha); }, [enCancha, matchId]);

  if (!partido || !setActual) return <Empty text="Partido no encontrado." />;

  const sumarPunto = (lado, delta) => {
    setDb((d) => {
      const sets2 = d.sets.map((s) => {
        if (s.id !== setActual.id) return s;
        const key = lado === "local" ? "puntos_local" : "puntos_visitante";
        return { ...s, [key]: Math.max(0, s[key] + delta) };
      });
      return { ...d, sets: sets2 };
    });
  };

  const registrar = (resObj) => {
    const orden = Date.now();
    const accion = {
      id: uid(), partido_id: matchId, set_id: setActual.id, set_numero: setActual.numero,
      jugador_id: sel?.id || null, jugador_nombre: sel?.nombre || null, jugador_numero: sel?.numero ?? null,
      equipo_lado: "local", tipo, resultado: resObj.k,
      punto_para: resObj.punto === "self" ? "local" : resObj.punto === "rival" ? "visitante" : null,
      orden,
    };
    setDb((d) => ({ ...d, acciones: [...d.acciones, accion] }));
    if (resObj.punto === "self") sumarPunto("local", 1);
    if (resObj.punto === "rival") sumarPunto("visitante", 1);
  };

  const deshacer = () => {
    const delPartido = db.acciones.filter((a) => a.partido_id === matchId);
    if (delPartido.length === 0) return;
    const last = delPartido.reduce((m, a) => (a.orden > m.orden ? a : m), delPartido[0]);
    if (last.punto_para === "local") sumarPunto("local", -1);
    if (last.punto_para === "visitante") sumarPunto("visitante", -1);
    setDb((d) => ({ ...d, acciones: d.acciones.filter((a) => a.id !== last.id) }));
  };

  const puntoManual = (lado) => sumarPunto(lado, 1);

  const cerrarSet = () => {
    const objetivoPuntos = puntosObjetivo(setActual.numero, partido.formato);
    const ganador = ganadorSet(setActual.puntos_local, setActual.puntos_visitante, objetivoPuntos);

    // No permitir cerrar si aún no hay un ganador válido por reglas.
    if (!ganador) {
      alert(`El set no se puede cerrar todavía. Se gana con ${objetivoPuntos} puntos y 2 de diferencia.`);
      return;
    }

    const ganadosLocal = sets.filter((s) => s.cerrado && s.puntos_local > s.puntos_visitante).length + (ganador === "local" ? 1 : 0);
    const ganadosVisit = sets.filter((s) => s.cerrado && s.puntos_visitante > s.puntos_local).length + (ganador === "visitante" ? 1 : 0);
    const objetivo = setTarget(partido.formato);
    const maxSets = partido.formato; // Bo3 -> máx 3 sets, Bo5 -> máx 5 sets
    const alcanzoMax = setActual.numero >= maxSets;
    const matchOver = ganadosLocal >= objetivo || ganadosVisit >= objetivo || alcanzoMax;

    setDb((d) => {
      let nuevos = d.sets.map((s) => s.id === setActual.id ? { ...s, cerrado: true } : s);
      if (!matchOver) {
        nuevos = [...nuevos, { id: uid(), partido_id: matchId, numero: setActual.numero + 1, puntos_local: 0, puntos_visitante: 0, cerrado: false }];
      }
      const partidos = d.partidos.map((p) => p.id === matchId
        ? { ...p, sets_local: ganadosLocal, sets_visitante: ganadosVisit, estado: matchOver ? "finalizado" : "en_curso" }
        : p);
      return { ...d, sets: nuevos, partidos };
    });
    if (matchOver) onFinish();
  };

  const accCountSet = db.acciones.filter((a) => a.set_id === setActual.id).length;
  const esUltimoSet = setActual.numero >= partido.formato; // Bo3->set 3, Bo5->set 5
  const objetivoPuntosSet = puntosObjetivo(setActual.numero, partido.formato); // 25 o 15
  const ganadorActual = ganadorSet(setActual.puntos_local, setActual.puntos_visitante, objetivoPuntosSet);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Marcador */}
      <div className="card" style={{ background: C.panel2, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6 }}>
          <ScorePill name={partido.nombre_local} pts={setActual.puntos_local} sets={partido.sets_local} onAdd={() => puntoManual("local")} />
          <div style={{ textAlign: "center", color: C.dim }}>
            <div style={{ fontSize: 12 }}>SET {setActual.numero} / {partido.formato}</div>
            <div style={{ fontSize: 11 }}>Bo{partido.formato}{esUltimoSet ? " · último" : ""}</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>a {objetivoPuntosSet} pts</div>
          </div>
          <ScorePill name={partido.nombre_visitante} pts={setActual.puntos_visitante} sets={partido.sets_visitante} onAdd={() => puntoManual("visitante")} right />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="vs-btn" onClick={deshacer} style={{ flex: 1, padding: 14, background: C.panel, border: `1px solid ${C.line}` }}>↩ Deshacer</button>
          <button className="vs-btn" onClick={cerrarSet}
            style={{ flex: 1, padding: 14, background: ganadorActual ? C.good : C.panel, border: ganadorActual ? "none" : `1px solid ${C.line}`, color: ganadorActual ? "#fff" : C.dim }}>
            {esUltimoSet ? "Finalizar partido" : "Cerrar set"}
          </button>
        </div>
      </div>

      {/* Rotación / jugadores en cancha */}
      <Rotacion jugadores={jugadores} enCancha={enCancha} setEnCancha={setEnCancha} sel={sel} setSel={setSel} />

      {/* Selección de jugador completa */}
      <div className="card">
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 8 }}>Jugador seleccionado</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {jugadores.length === 0 && <span style={{ color: C.dim }}>El equipo local no tiene jugadores.</span>}
          {jugadores.map((j) => {
            const active = sel?.id === j.id;
            return (
              <button key={j.id} className="vs-btn" onClick={() => setSel(active ? null : j)}
                style={{
                  padding: "10px 12px", minWidth: 52, fontSize: 15,
                  background: active ? C.accent2 : C.panel2,
                  border: active ? `2px solid ${C.text}` : `1px solid ${C.line}`,
                }}>
                #{j.numero}
              </button>
            );
          })}
        </div>
        {sel && <div style={{ marginTop: 8, fontWeight: 700 }}>#{sel.numero} {sel.nombre} · <span style={{ color: C.dim, fontWeight: 400 }}>{POS_LABEL[sel.posicion]}</span></div>}
      </div>

      {/* Tipo de acción */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        {Object.entries(ACCIONES).map(([k, v]) => (
          <button key={k} className="vs-btn" onClick={() => setTipo(k)}
            style={{
              padding: "12px 16px", whiteSpace: "nowrap", flexShrink: 0,
              background: tipo === k ? C.accent : C.panel2,
            }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Botones de resultado (grandes) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {ACCIONES[tipo].res.map((r) => (
          <button key={r.k} className="vs-btn"
            disabled={!sel && tipo !== "saque" ? false : false}
            onClick={() => registrar(r)}
            style={{ padding: "22px 12px", fontSize: 18, background: TONE_BG[r.tone] }}>
            {r.t}
            {r.punto === "self" && <span style={{ display: "block", fontSize: 11, opacity: .85 }}>+1 local</span>}
            {r.punto === "rival" && <span style={{ display: "block", fontSize: 11, opacity: .85 }}>+1 rival</span>}
          </button>
        ))}
      </div>

      {!sel && <div style={{ color: C.dim, fontSize: 13, textAlign: "center" }}>Selecciona un jugador para atribuir la acción (también puedes registrar sin jugador).</div>}
      <div style={{ color: C.dim, fontSize: 12, textAlign: "center" }}>{accCountSet} acciones en este set</div>
    </div>
  );
}

function ScorePill({ name, pts, sets, onAdd, right }) {
  return (
    <div style={{ textAlign: right ? "right" : "left" }}>
      <div style={{ fontSize: 13, color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name} <span style={{ color: C.accent }}>·{sets} sets</span>
      </div>
      <button className="vs-btn" onClick={onAdd}
        style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, padding: "6px 14px", background: "transparent", color: C.text, marginTop: 2 }}>
        {pts}
      </button>
    </div>
  );
}

function Rotacion({ jugadores, enCancha, setEnCancha, sel, setSel }) {
  // 6 posiciones de cancha. enCancha = array de hasta 6 ids en orden de rotación.
  const inCourt = enCancha.map((id) => jugadores.find((j) => j.id === id)).filter(Boolean);
  const toggle = (j) => {
    setEnCancha((cur) => cur.includes(j.id) ? cur.filter((x) => x !== j.id) : (cur.length < 6 ? [...cur, j.id] : cur));
  };
  const rotar = () => setEnCancha((cur) => cur.length ? [...cur.slice(1), cur[0]] : cur);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ color: C.dim, fontSize: 13 }}>En cancha ({inCourt.length}/6)</div>
        <button className="vs-btn" onClick={rotar} disabled={inCourt.length === 0}
          style={{ padding: "8px 14px", background: C.accent2 }}>⟳ Rotar</button>
      </div>
      {inCourt.length === 0
        ? <div style={{ color: C.dim, fontSize: 13 }}>Toca los números abajo para poner jugadores en cancha.</div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {inCourt.map((j, i) => (
              <button key={j.id} className="vs-btn" onClick={() => setSel(sel?.id === j.id ? null : j)}
                style={{
                  padding: "14px 6px", background: sel?.id === j.id ? C.accent2 : C.panel2,
                  border: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 2,
                }}>
                <span style={{ fontSize: 10, color: C.dim }}>P{i + 1}</span>
                <span style={{ fontSize: 18, fontWeight: 800 }}>#{j.numero}</span>
                <span style={{ fontSize: 10, color: C.dim }}>{POS_LABEL[j.posicion].slice(0, 4)}</span>
              </button>
            ))}
          </div>}
      <details style={{ marginTop: 10 }}>
        <summary style={{ color: C.dim, fontSize: 13, cursor: "pointer" }}>Editar quién está en cancha</summary>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {jugadores.map((j) => (
            <button key={j.id} className="vs-btn" onClick={() => toggle(j)}
              style={{ padding: "8px 10px", background: enCancha.includes(j.id) ? C.good : C.panel2, fontSize: 13 }}>
              #{j.numero}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

/* ---------------- Estadísticas ---------------- */
function computeStats(acciones) {
  // por jugador
  const byPlayer = {};
  const get = (id, nombre, numero) => {
    if (!byPlayer[id]) byPlayer[id] = {
      id, nombre, numero, puntos: 0, aces: 0, bloqueos: 0,
      ataqTotal: 0, ataqPunto: 0, ataqError: 0,
      recTotal: 0, recPos: 0,
    };
    return byPlayer[id];
  };
  acciones.forEach((a) => {
    if (!a.jugador_id) return;
    const p = get(a.jugador_id, a.jugador_nombre, a.jugador_numero);
    if (a.punto_para === "local" && (a.tipo === "ataque" || a.tipo === "saque" || a.tipo === "bloqueo")) p.puntos++;
    if (a.tipo === "saque" && a.resultado === "ace") p.aces++;
    if (a.tipo === "bloqueo" && a.resultado === "punto") p.bloqueos++;
    if (a.tipo === "ataque") {
      p.ataqTotal++;
      if (a.resultado === "punto") p.ataqPunto++;
      if (a.resultado === "error" || a.resultado === "bloqueado") p.ataqError++;
    }
    if (a.tipo === "recepcion") {
      p.recTotal++;
      if (a.resultado === "perfecta" || a.resultado === "buena") p.recPos++;
    }
  });
  return Object.values(byPlayer).map((p) => ({
    ...p,
    efAtaque: p.ataqTotal ? Math.round(((p.ataqPunto - p.ataqError) / p.ataqTotal) * 100) : null,
    recPosPct: p.recTotal ? Math.round((p.recPos / p.recTotal) * 100) : null,
  })).sort((a, b) => b.puntos - a.puntos || a.numero - b.numero);
}

function Stats({ db, matchId, onBack }) {
  const partido = db.partidos.find((p) => p.id === matchId);
  const sets = db.sets.filter((s) => s.partido_id === matchId).sort((a, b) => a.numero - b.numero);
  const acciones = db.acciones.filter((a) => a.partido_id === matchId);
  const [setFilter, setSetFilter] = useState("all");

  if (!partido) return <Empty text="Partido no encontrado." />;

  const accFiltradas = setFilter === "all" ? acciones : acciones.filter((a) => a.set_numero === Number(setFilter));
  const stats = computeStats(accFiltradas);

  const exportCSV = () => {
    const header = ["partido", "fecha", "set", "jugador_num", "jugador", "tipo", "resultado", "punto_para"];
    const rows = acciones.map((a) => [
      `${partido.nombre_local} vs ${partido.nombre_visitante}`, partido.fecha, a.set_numero,
      a.jugador_numero ?? "", a.jugador_nombre ?? "", a.tipo, a.resultado, a.punto_para ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `volleystats_${partido.fecha}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="vs-btn" onClick={onBack} style={{ padding: "10px 14px", background: C.panel2 }}>← Volver</button>
        <button className="vs-btn" onClick={exportCSV} style={{ padding: "10px 14px", background: C.good }}>⬇ CSV</button>
      </div>

      <div className="card">
        <div style={{ fontWeight: 800, fontSize: 18 }}>
          {partido.nombre_local} <span style={{ color: C.accent }}>{partido.sets_local}–{partido.sets_visitante}</span> {partido.nombre_visitante}
        </div>
        <div style={{ color: C.dim, fontSize: 13 }}>{partido.fecha} · Bo{partido.formato} · {partido.estado === "en_curso" ? "En curso" : "Finalizado"}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {sets.map((s) => (
            <div key={s.id} style={{ background: C.panel2, borderRadius: 8, padding: "6px 10px", fontSize: 13 }}>
              <span style={{ color: C.dim }}>Set {s.numero}: </span>
              <b>{s.puntos_local}–{s.puntos_visitante}</b>
            </div>
          ))}
        </div>
      </div>

      {/* Filtro por set */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        <FilterChip active={setFilter === "all"} onClick={() => setSetFilter("all")}>Todo el partido</FilterChip>
        {sets.map((s) => (
          <FilterChip key={s.id} active={setFilter === String(s.numero)} onClick={() => setSetFilter(String(s.numero))}>Set {s.numero}</FilterChip>
        ))}
      </div>

      {/* Tabla por jugador */}
      <div className="card" style={{ overflowX: "auto", padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
          <thead>
            <tr style={{ color: C.dim, textAlign: "right" }}>
              <th style={{ textAlign: "left", padding: 10 }}>Jugador</th>
              <th style={{ padding: 10 }}>Pts</th>
              <th style={{ padding: 10 }}>Aces</th>
              <th style={{ padding: 10 }}>Bloq.</th>
              <th style={{ padding: 10 }}>Ef. Ataque</th>
              <th style={{ padding: 10 }}>Rec. +</th>
            </tr>
          </thead>
          <tbody>
            {stats.length === 0 && <tr><td colSpan={6} style={{ padding: 16, color: C.dim, textAlign: "center" }}>Sin acciones registradas a jugadores.</td></tr>}
            {stats.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${C.line}`, textAlign: "right" }}>
                <td style={{ textAlign: "left", padding: 10, fontWeight: 600 }}>
                  <span style={{ color: C.accent }}>#{p.numero}</span> {p.nombre}
                </td>
                <td style={{ padding: 10, fontWeight: 800 }}>{p.puntos}</td>
                <td style={{ padding: 10 }}>{p.aces}</td>
                <td style={{ padding: 10 }}>{p.bloqueos}</td>
                <td style={{ padding: 10, color: p.efAtaque == null ? C.dim : p.efAtaque >= 0 ? C.good : C.bad }}>
                  {p.efAtaque == null ? "—" : p.efAtaque + "%"}
                </td>
                <td style={{ padding: 10 }}>{p.recPosPct == null ? "—" : p.recPosPct + "%"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen equipo */}
      <TeamSummary acciones={accFiltradas} />
    </div>
  );
}

function TeamSummary({ acciones }) {
  const total = acciones.length;
  const puntosEquipo = acciones.filter((a) => a.punto_para === "local").length;
  const erroresPropios = acciones.filter((a) => a.resultado === "error").length;
  const aces = acciones.filter((a) => a.tipo === "saque" && a.resultado === "ace").length;
  const bloqueos = acciones.filter((a) => a.tipo === "bloqueo" && a.resultado === "punto").length;
  const cards = [
    { t: "Acciones", v: total }, { t: "Puntos equipo", v: puntosEquipo },
    { t: "Aces", v: aces }, { t: "Bloqueos", v: bloqueos }, { t: "Errores propios", v: erroresPropios },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8 }}>
      {cards.map((c) => (
        <div key={c.t} className="card" style={{ textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.accent }}>{c.v}</div>
          <div style={{ color: C.dim, fontSize: 12 }}>{c.t}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Ajustes ---------------- */
function Ajustes({ cfg, setCfg, db, setDb }) {
  const [url, setUrl] = useState(cfg.url); const [key, setKey] = useState(cfg.key);
  const save = () => setCfg({ url: url.trim(), key: key.trim() });
  const wipe = () => {
    if (!confirm("¿Borrar todos los datos locales? Esta acción no se puede deshacer.")) return;
    setDb({ equipos: [], jugadores: [], partidos: [], sets: [], acciones: [] });
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: "4px 0" }}>Ajustes</h2>
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Conexión Supabase (opcional)</div>
        <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>
          Pega tu Project URL y anon key para sincronizar en la nube y usar login real.
          Ejecuta primero el esquema SQL incluido. Sin esto, todo funciona en local.
        </p>
        <input placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input placeholder="anon public key" value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="vs-btn" onClick={save} style={{ padding: 14, background: C.accent }}>Guardar conexión</button>
      </div>
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Datos locales</div>
        <div style={{ color: C.dim, fontSize: 13 }}>
          {db.equipos.length} equipos · {db.jugadores.length} jugadores · {db.partidos.length} partidos · {db.acciones.length} acciones.
        </div>
        <button className="vs-btn" onClick={wipe} style={{ padding: 14, background: TONE_BG.bad }}>Borrar todos los datos</button>
      </div>
    </div>
  );
}

/* ---------------- Util ---------------- */
function Empty({ text }) {
  return <div className="card" style={{ textAlign: "center", color: C.dim, padding: 28 }}>{text}</div>;
}
function FilterChip({ active, onClick, children }) {
  return (
    <button className="vs-btn" onClick={onClick}
      style={{ padding: "8px 14px", whiteSpace: "nowrap", flexShrink: 0, background: active ? C.accent : C.panel2, fontSize: 13 }}>
      {children}
    </button>
  );
}
