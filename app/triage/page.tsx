"use client";
import { useState, useEffect, useMemo, useRef } from "react";

// ─── Triage Python simulation ─────────────────────────────────────────────────
const PYTHON_TRIAGE = `
import numpy as np
from scipy.integrate import solve_ivp
import json

def run_triage(day, cd8, il6, il10, plt_count, cxr_score):
    beta=1e-8; rho=500.0; c=2.0; delta_I=0.06; k_CTL=0.5; E0=1e6
    s8=5.0; d8=0.4; mu8=0.002; s4=3.0; d4=0.15; sM=2.0; dM=0.2
    pg=2.0; qg=0.5; dg=0.8; pN=3.0; decN=0.7; decVf=0.5
    p6=0.8; q6=1.5; d6=0.9; p10=0.5; q10=1.0; d10=0.5; K10=10.0
    kVf=0.3; kP=0.1; Pmax=1.0; rP=0.3; KP=5.0
    sPi=10.0; decPi=0.07; kPiM=0.005; KM=50.0; K8=20.0

    # Infer recruitment rate from CD8 count
    alpha8 = float(np.clip(3.0 + 7.0*(cd8-200.0)/800.0, 3.0, 10.0))
    sigma8 = 0.3

    # Map clinical values to initial ODE state
    g_init = float(np.clip(cxr_score/3.0 * 0.9, 0.0, 0.9))
    I_init = KM * g_init / (1.0 - g_init + 1e-6)
    V_init = float(max(10**(5.0 - day*0.8), 0.1))
    Fg_init = cd8 * 0.005 * g_init
    F1_init = il6 * 0.4
    N_init  = il6 * 0.2
    P_init  = cxr_score / 3.0 * 0.85
    Pi_init = plt_count * (143.0/150.0)

    y0 = [E0, I_init, V_init, float(cd8), 20.0, 10.0,
          F1_init, Fg_init, N_init, float(il6), float(il10), cxr_score*0.4, P_init, Pi_init]

    def ode(t, y):
        E,I,V,T8,T4,Mph,F1,Fg,N,L6,L10,Vf,P,Pi = [max(x,0.) for x in y]
        g = I/(I+KM); sup = 0.4*L10/(L10+K10)
        dE = -beta*V*E
        dI =  beta*V*E - (delta_I+k_CTL*T8)*I
        dV =  rho*I - c*V
        dT8= s8 + alpha8*T4*I/(I+K8)*g + sigma8*Fg*T8*(1-sup) - d8*T8 - mu8*T8**2
        dT4= s4 - d4*T4
        dMph= sM - dM*Mph
        dF1= (1.0*(T8+T4)+2.0*Mph)*g - 0.6*F1
        dFg= (pg*T8+qg*T4)*g - dg*Fg
        dN = pN*Mph*g - decN*N
        dL6= (p6*(T8+T4)+q6*Mph)*g - d6*L6
        dL10=(p10*(T8+T4)+q10*Mph)*g - d10*L10
        dVf= kVf*I*g - decVf*Vf
        dP = kP*Vf*(1-P/Pmax) - rP*P*L10/(L10+KP)
        dPi= sPi - decPi*Pi - kPiM*Mph*Pi
        return [dE,dI,dV,dT8,dT4,dMph,dF1,dFg,dN,dL6,dL10,dVf,dP,dPi]

    sol = solve_ivp(ode,(0,14),y0,method='LSODA',
                    t_eval=np.linspace(0,14,141),rtol=1e-6,atol=1e-8)
    t=sol.t; _E,_I,_V,T8,T4,Mph,F1,Fg,N,L6,L10,Vf,P,Pi=sol.y

    # Projected clinical W score (same formula as JS)
    W = (2*np.clip((T8-500)/800,0,1) +
         2*np.clip(L6/50,0,1) +
         2*np.clip(1-L10/20,0,1) +
         2*(P/0.85) +
         2*np.clip(1-Pi/143,0,1))

    Ppk = float(np.max(P))
    Wpk = float(np.max(W))
    peak_day = float(t[np.argmax(W)])
    outcome = ("LOW RISK" if Ppk<0.2 else "HIGH RISK" if Ppk<0.6 else "CRITICAL")

    return json.dumps({
        't': t.tolist(), 'T8': T8.tolist(), 'P': P.tolist(),
        'L6': L6.tolist(), 'L10': L10.tolist(),
        'Pi': (Pi/143*plt_count).tolist(),
        'W': W.tolist(),
        'Ppk': Ppk, 'Wpk': Wpk, 'peak_day': peak_day, 'outcome': outcome,
    })
`;

// ─── JS live W score (no Python needed) ──────────────────────────────────────
function computeW(cd8: number, il6: number, il10: number, plt: number, cxr: number) {
  const w1 = 2 * Math.min(Math.max((cd8 - 500) / 800, 0), 1);
  const w2 = 2 * Math.min(il6 / 50, 1);
  const w3 = 2 * Math.min(Math.max(1 - il10 / 20, 0), 1);
  const w4 = 2 * (cxr / 3);
  const w5 = 2 * Math.min(Math.max(1 - plt / 150, 0), 1);
  return w1 + w2 + w3 + w4 + w5;
}

function riskLevel(w: number) {
  if (w < 1.5) return { label: "LOW", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.25)", action: "Standard monitoring. Repeat assessment in 24 h." };
  if (w < 4.0) return { label: "MODERATE", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)", action: "Escalate to HDU. Daily cytokine panel. Intensify monitoring." };
  if (w < 7.0) return { label: "HIGH", color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.25)", action: "ICU transfer. Consider IL-10 supplementation. Hepatology + haematology consult." };
  return { label: "CRITICAL", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)", action: "Immediate ICU. IL-10 + immunosuppression + ECMO evaluation. Multidisciplinary emergency." };
}

// ─── Mini SVG chart ───────────────────────────────────────────────────────────
function MiniChart({ values, times, color, yMax, thresholds = [] as { v: number; c: string; label: string }[], height = 100 }: {
  values: number[]; times: number[]; color: string; yMax: number; height?: number;
  thresholds?: { v: number; c: string; label: string }[];
}) {
  const W = 500, pad = { t: 6, r: 10, b: 20, l: 38 };
  const pw = W - pad.l - pad.r, ph = height - pad.t - pad.b;
  const xs = (t: number) => pad.l + (t / 14) * pw;
  const ys = (v: number) => pad.t + ph - Math.max(0, Math.min(1, v / yMax)) * ph;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${xs(times[i]).toFixed(1)},${ys(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height }} className="overflow-visible">
      {[0.5, 1.0].map(f => (
        <g key={f}>
          <line x1={pad.l} y1={ys(f * yMax)} x2={pad.l + pw} y2={ys(f * yMax)} stroke="#214060" strokeWidth="1" />
          <text x={pad.l - 4} y={ys(f * yMax) + 4} textAnchor="end" fill="#7fb3d3" fontSize="8" fontFamily="IBM Plex Mono">
            {(f * yMax) >= 10 ? (f * yMax).toFixed(0) : (f * yMax).toFixed(1)}
          </text>
        </g>
      ))}
      <line x1={pad.l} y1={pad.t + ph} x2={pad.l + pw} y2={pad.t + ph} stroke="#214060" strokeWidth="1" />
      {[0, 3, 6, 9, 12].map(d => (
        <text key={d} x={xs(d)} y={pad.t + ph + 14} textAnchor="middle" fill="#7fb3d3" fontSize="8" fontFamily="IBM Plex Mono">
          {d === 0 ? "now" : `+${d}d`}
        </text>
      ))}
      {thresholds.map(({ v, c, label }) => (
        <g key={v}>
          <line x1={pad.l} y1={ys(v)} x2={pad.l + pw} y2={ys(v)} stroke={c} strokeWidth="1" strokeDasharray="4,3" opacity="0.8" />
          <text x={pad.l + pw - 2} y={ys(v) - 3} textAnchor="end" fill={c} fontSize="7" fontFamily="IBM Plex Mono">{label}</text>
        </g>
      ))}
      <path d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ─── Number input ─────────────────────────────────────────────────────────────
function ClinicalInput({ label, unit, ref_range, value, onChange, min, max, step = 1, placeholder }: {
  label: string; unit: string; ref_range: string; value: number; placeholder: string;
  onChange: (v: number) => void; min: number; max: number; step?: number;
}) {
  const mono = { fontFamily: "IBM Plex Mono" } as React.CSSProperties;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <label style={{ ...mono, fontSize: 11, color: "#deeaf6" }}>{label}</label>
        <span style={{ ...mono, fontSize: 9, color: "#7fb3d3" }}>ref: {ref_range}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number" min={min} max={max} step={step}
          value={value || ""}
          placeholder={placeholder}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            ...mono, fontSize: 14, fontWeight: 600,
            background: "#152b45", border: "1px solid #214060",
            borderRadius: 6, color: "#22d3ee",
            padding: "6px 10px", width: "100%", outline: "none",
          }}
        />
        <span style={{ ...mono, fontSize: 10, color: "#7fb3d3", whiteSpace: "nowrap" }}>{unit}</span>
      </div>
    </div>
  );
}

// ─── Projection result ────────────────────────────────────────────────────────
interface ProjectionResult {
  t: number[]; T8: number[]; P: number[]; L6: number[]; L10: number[]; Pi: number[]; W: number[];
  Ppk: number; Wpk: number; peak_day: number; outcome: string;
}

// ─── Main triage page ─────────────────────────────────────────────────────────
export default function TriagePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pyodide, setPyodide] = useState<any>(null);
  const [pyPhase, setPyPhase] = useState<"loading" | "ready">("loading");
  const [projecting, setProjecting] = useState(false);
  const [projection, setProjection] = useState<ProjectionResult | null>(null);
  const [projError, setProjError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Patient inputs
  const [day,   setDay]   = useState(4);
  const [cd8,   setCd8]   = useState(450);
  const [il6,   setIl6]   = useState(12);
  const [il10,  setIl10]  = useState(8);
  const [plt,   setPlt]   = useState(110);
  const [cxr,   setCxr]   = useState(1);

  // Load Pyodide
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js";
    s.onload = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const py = await (window as any).loadPyodide();
      await py.loadPackage(["numpy", "scipy"]);
      await py.runPythonAsync(PYTHON_TRIAGE);
      setPyodide(py);
      setPyPhase("ready");
    };
    document.head.appendChild(s);
  }, []);

  // Live W score
  const W = useMemo(() => computeW(cd8, il6, il10, plt, cxr), [cd8, il6, il10, plt, cxr]);
  const risk = riskLevel(W);
  const wPct = Math.min(W / 10, 1);

  const projectForward = async () => {
    if (!pyodide) return;
    setProjecting(true); setProjError(null); setProjection(null);
    try {
      const raw = await pyodide.runPythonAsync(
        `run_triage(${day}, ${cd8}, ${il6}, ${il10}, ${plt}, ${cxr})`
      );
      setProjection(JSON.parse(raw));
    } catch (err: unknown) {
      setProjError(err instanceof Error ? err.message : String(err));
    }
    setProjecting(false);
  };

  const mono: React.CSSProperties = { fontFamily: "IBM Plex Mono" };
  const muted: React.CSSProperties = { ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7fb3d3" };

  return (
    <div style={{ minHeight: "100vh", background: "#0e1f35", color: "#deeaf6" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={{ borderBottom: "1px solid #214060", background: "rgba(14,31,53,0.97)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <a href="/" style={{ ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#22d3ee", textDecoration: "none" }}>
                ← xvirus.org
              </a>
              <span style={{ color: "#214060" }}>·</span>
              <span style={{ ...mono, fontSize: 10, letterSpacing: "0.1em", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", padding: "1px 8px", borderRadius: 4, textTransform: "uppercase" }}>
                TRIAGE MODE
              </span>
            </div>
            <h1 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 16, color: "#f0f8ff", lineHeight: 1.2 }}>
              HPS Patient Risk Assessment — Andes Hantavirus 2026
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: pyPhase === "ready" ? "#34d399" : "#fbbf24", animation: pyPhase === "ready" ? "none" : "pulse-dot 1s infinite", display: "inline-block" }} />
            <span style={{ ...mono, fontSize: 10, color: "#7fb3d3" }}>
              {pyPhase === "ready" ? "Engine ready" : "Loading Python…"}
            </span>
          </div>
        </div>
        {/* Disclaimer */}
        <div style={{ borderTop: "1px solid #214060", background: "rgba(251,191,36,0.04)" }}>
          <p style={{ ...mono, fontSize: 10, color: "#7fb3d3", maxWidth: 1100, margin: "0 auto", padding: "5px 20px" }}>
            ⚠ Research tool — not validated for clinical decision-making. All outputs are model predictions. Consult infectious disease specialists.
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px", display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>

          {/* ── LEFT: Patient form ──────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Day of illness */}
            <div style={{ background: "#152b45", border: "1px solid #214060", borderRadius: 12, padding: 20 }}>
              <p style={{ ...muted, marginBottom: 16 }}>Patient Data</p>

              {/* Day slider */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ ...mono, fontSize: 11, color: "#deeaf6" }}>Day of illness</label>
                  <span style={{ ...mono, fontSize: 16, color: "#22d3ee", fontWeight: 700 }}>Day {day}</span>
                </div>
                <input type="range" min={1} max={14} step={1} value={day}
                  onChange={e => setDay(+e.target.value)} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  {["Prodrome (1-4)", "Cardiopulmonary (5-9)", "Late (10+)"].map((l, i) => (
                    <span key={i} style={{ ...mono, fontSize: 8, color: i === 0 ? (day <= 4 ? "#22d3ee" : "#2d5070") : i === 1 ? (day > 4 && day <= 9 ? "#fbbf24" : "#2d5070") : (day > 9 ? "#f87171" : "#2d5070") }}>
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Clinical inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <ClinicalInput label="CD8⁺ T cells" unit="cells/μL" ref_range="200–800" value={cd8}
                  onChange={setCd8} min={0} max={3000} placeholder="e.g. 450" />
                <ClinicalInput label="IL-6" unit="pg/mL" ref_range="< 6" value={il6}
                  onChange={setIl6} min={0} max={500} step={0.1} placeholder="e.g. 12" />
                <ClinicalInput label="IL-10" unit="pg/mL" ref_range="< 10" value={il10}
                  onChange={setIl10} min={0} max={200} step={0.1} placeholder="e.g. 8" />
                <ClinicalInput label="Platelets" unit="×10³/μL" ref_range="150–400" value={plt}
                  onChange={setPlt} min={0} max={500} placeholder="e.g. 110" />
              </div>

              {/* CXR score */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ ...mono, fontSize: 11, color: "#deeaf6" }}>Chest X-ray infiltrate</label>
                  <span style={{ ...mono, fontSize: 9, color: "#7fb3d3" }}>0–3 scale</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  {[
                    { v: 0, label: "None", sub: "Clear" },
                    { v: 1, label: "Mild", sub: "< 25%" },
                    { v: 2, label: "Moderate", sub: "25–50%" },
                    { v: 3, label: "Severe", sub: "> 50%" },
                  ].map(({ v, label, sub }) => (
                    <button key={v} onClick={() => setCxr(v)}
                      style={{
                        ...mono, fontSize: 10, padding: "8px 4px",
                        borderRadius: 6, border: `1px solid ${cxr === v ? "#22d3ee" : "#214060"}`,
                        background: cxr === v ? "rgba(34,211,238,0.12)" : "#0e1f35",
                        color: cxr === v ? "#22d3ee" : "#7fb3d3",
                        cursor: "pointer", textAlign: "center", transition: "all 0.15s",
                      }}>
                      <div style={{ fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: 8, opacity: 0.7, marginTop: 2 }}>{sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Clinical context */}
            <div style={{ background: "#152b45", border: "1px solid #214060", borderRadius: 12, padding: 16 }}>
              <p style={{ ...muted, marginBottom: 10 }}>Reference — HPS Lab Findings</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  ["CD8⁺ > 800", "Storm risk ↑"],
                  ["IL-6 > 30 pg/mL", "Significant inflammation"],
                  ["IL-10 < 5 pg/mL", "Regulatory failure"],
                  ["Platelets < 100k", "Thrombocytopaenia"],
                  ["CXR ≥ 2", "Significant infiltrate"],
                  ["Day 5–9", "Intervention window"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ ...mono, fontSize: 9, color: "#22d3ee" }}>{k}</span>
                    <span style={{ ...mono, fontSize: 9, color: "#7fb3d3" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Risk score + projection ─────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Live risk score */}
            <div style={{ background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 12, padding: 24 }}>
              <p style={{ ...muted, marginBottom: 12 }}>HPS Storm Risk Score — Live</p>

              {/* Score number */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 16 }}>
                <span style={{ fontFamily: "Syne", fontWeight: 900, fontSize: 72, lineHeight: 1, color: risk.color }}>
                  {W.toFixed(1)}
                </span>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...mono, fontSize: 11, color: "#7fb3d3" }}>/ 10</div>
                  <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 18, color: risk.color }}>{risk.label}</div>
                </div>
              </div>

              {/* Score bar */}
              <div style={{ position: "relative", height: 8, background: "#0e1f35", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                {/* Threshold markers */}
                {[[1.5, "#34d399"], [4.0, "#fbbf24"], [7.0, "#f87171"]].map(([t, c]) => (
                  <div key={String(t)} style={{ position: "absolute", left: `${(Number(t)/10)*100}%`, top: 0, bottom: 0, width: 1, background: String(c), opacity: 0.4 }} />
                ))}
                <div style={{ height: "100%", width: `${wPct * 100}%`, background: `linear-gradient(90deg, #34d399, ${risk.color})`, borderRadius: 4, transition: "width 0.3s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {[["1.5", "#34d399", "Low"], ["4.0", "#fbbf24", "Mod"], ["7.0", "#f87171", "High"], ["10", "#f87171", "Crit"]].map(([v, c, l]) => (
                  <span key={v} style={{ ...mono, fontSize: 8, color: String(c), opacity: 0.7 }}>{l}</span>
                ))}
              </div>

              {/* Score breakdown */}
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "CTL excess", val: Math.min(Math.max((cd8 - 500) / 800, 0), 1), max: 2 },
                  { label: "IL-6", val: Math.min(il6 / 50, 1), max: 2 },
                  { label: "IL-10 deficit", val: Math.min(Math.max(1 - il10 / 20, 0), 1), max: 2 },
                  { label: "Lung infiltrate", val: cxr / 3, max: 2 },
                  { label: "Thrombocytop.", val: Math.min(Math.max(1 - plt / 150, 0), 1), max: 2 },
                ].map(({ label, val }) => (
                  <div key={label} style={{ background: "rgba(14,31,53,0.5)", borderRadius: 6, padding: "6px 8px" }}>
                    <div style={{ ...mono, fontSize: 8, color: "#7fb3d3", marginBottom: 3 }}>{label}</div>
                    <div style={{ height: 4, background: "#0e1f35", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${val * 100}%`, background: val > 0.7 ? "#f87171" : val > 0.4 ? "#fbbf24" : "#34d399", borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ ...mono, fontSize: 9, color: val > 0.7 ? "#f87171" : val > 0.4 ? "#fbbf24" : "#34d399", marginTop: 3, fontWeight: 600 }}>
                      {(val * 2).toFixed(1)}/2
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clinical action */}
            <div style={{ background: "#152b45", border: `1px solid ${risk.border}`, borderRadius: 12, padding: 20 }}>
              <p style={{ ...muted, marginBottom: 10 }}>Recommended Action</p>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 24, lineHeight: 1, marginTop: 2 }}>
                  {W < 1.5 ? "🟢" : W < 4 ? "🟡" : W < 7 ? "🟠" : "🔴"}
                </span>
                <p style={{ ...mono, fontSize: 12, color: "#deeaf6", lineHeight: 1.7 }}>
                  {risk.action}
                </p>
              </div>

              {/* Day-specific guidance */}
              {day >= 5 && day <= 9 && (
                <div style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "10px 12px" }}>
                  <p style={{ ...mono, fontSize: 10, color: "#fbbf24", fontWeight: 600, marginBottom: 4 }}>
                    ⚡ Day {day} — Intervention window open
                  </p>
                  <p style={{ ...mono, fontSize: 10, color: "#7fb3d3", lineHeight: 1.6 }}>
                    Viral clearance expected by day 5–6. This is the optimal window for IL-10 supplementation to prevent CTL overshoot.
                  </p>
                </div>
              )}

              {il10 < 5 && (
                <div style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                  <p style={{ ...mono, fontSize: 10, color: "#f87171", fontWeight: 600, marginBottom: 4 }}>
                    ⚠ IL-10 critically low ({il10} pg/mL)
                  </p>
                  <p style={{ ...mono, fontSize: 10, color: "#7fb3d3", lineHeight: 1.6 }}>
                    IL-10 deficiency is the strongest predictor of fatal HPS. Exogenous IL-10 analogue is the model's highest-priority intervention.
                  </p>
                </div>
              )}
            </div>

            {/* Project forward button */}
            <button
              onClick={projectForward}
              disabled={!pyodide || projecting}
              style={{
                ...mono, fontWeight: 700, fontSize: 13,
                padding: "14px 20px", borderRadius: 10, border: "none",
                background: pyodide && !projecting
                  ? "linear-gradient(135deg, #22d3ee, #0891b2)"
                  : "#152b45",
                color: pyodide && !projecting ? "#0a1929" : "#2d5070",
                cursor: pyodide && !projecting ? "pointer" : "not-allowed",
                boxShadow: pyodide && !projecting ? "0 0 20px rgba(34,211,238,0.2)" : "none",
                transition: "all 0.15s",
                letterSpacing: "0.05em",
              }}>
              {projecting ? "⟳  Projecting 14-day trajectory…" : "▶  Project 14-Day Trajectory"}
            </button>

            {projError && (
              <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ ...mono, fontSize: 9, color: "#fca5a5", wordBreak: "break-all", lineHeight: 1.5 }}>{projError}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Projection results ──────────────────────────────────────── */}
        {projection && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.35s ease" }}>

            {/* Projected outcome banner */}
            <div style={{
              borderRadius: 12, padding: "20px 24px",
              background: projection.outcome === "CRITICAL" ? "rgba(248,113,113,0.07)" : projection.outcome === "HIGH RISK" ? "rgba(251,191,36,0.07)" : "rgba(52,211,153,0.07)",
              border: `1px solid ${projection.outcome === "CRITICAL" ? "rgba(248,113,113,0.25)" : projection.outcome === "HIGH RISK" ? "rgba(251,191,36,0.25)" : "rgba(52,211,153,0.25)"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
            }}>
              <div>
                <p style={{ ...muted, marginBottom: 6 }}>14-day projected outcome</p>
                <p style={{
                  fontFamily: "Syne", fontWeight: 800, fontSize: 28,
                  color: projection.outcome === "CRITICAL" ? "#f87171" : projection.outcome === "HIGH RISK" ? "#fbbf24" : "#34d399",
                }}>
                  {projection.outcome}
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "8px 24px" }}>
                {[
                  ["Peak permeability", projection.Ppk.toFixed(3), projection.Ppk >= 0.6 ? "#f87171" : projection.Ppk >= 0.2 ? "#fbbf24" : "#34d399"],
                  ["Peak W score", projection.Wpk.toFixed(1), projection.Wpk >= 6 ? "#f87171" : projection.Wpk >= 3 ? "#fbbf24" : "#34d399"],
                  ["Score peaks at", `day +${projection.peak_day.toFixed(0)}`, "#22d3ee"],
                ].map(([l, v, c]) => (
                  <div key={String(l)} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ ...mono, fontSize: 9, color: "#7fb3d3" }}>{l}</span>
                    <span style={{ ...mono, fontSize: 16, fontWeight: 700, color: String(c) }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {[
                {
                  label: "Storm Risk Score Ŵ(t) — projected",
                  values: projection.W, color: "#22d3ee",
                  yMax: Math.max(projection.Wpk * 1.2, 5),
                  thresholds: [{ v: 1.5, c: "#34d399", label: "low" }, { v: 4, c: "#fbbf24", label: "high" }, { v: 7, c: "#f87171", label: "critical" }],
                },
                {
                  label: "Vascular permeability P(t) — projected",
                  values: projection.P, color: "#f87171",
                  yMax: Math.max(projection.Ppk * 1.2, 0.7),
                  thresholds: [{ v: 0.2, c: "#fbbf24", label: "severe" }, { v: 0.6, c: "#ef4444", label: "fatal" }],
                },
                {
                  label: "CD8⁺ count T₈(t) — cells/μL",
                  values: projection.T8, color: "#60a5fa",
                  yMax: Math.max(...projection.T8) * 1.2,
                  thresholds: [{ v: 800, c: "#fbbf24", label: "storm threshold" }],
                },
                {
                  label: "Platelet count Π(t) — ×10³/μL",
                  values: projection.Pi, color: "#a78bfa",
                  yMax: Math.max(...projection.Pi) * 1.2,
                  thresholds: [{ v: 100, c: "#fbbf24", label: "thrombocytopaenia" }],
                },
              ].map(({ label, values, color, yMax, thresholds }) => (
                <div key={label} style={{ background: "#152b45", border: "1px solid #214060", borderRadius: 12, padding: 16 }}>
                  <p style={{ ...muted, marginBottom: 10, fontSize: 9 }}>{label}</p>
                  <MiniChart values={values} times={projection.t} color={color} yMax={yMax} thresholds={thresholds} />
                </div>
              ))}
            </div>

            {/* Model note */}
            <p style={{ ...mono, fontSize: 9, color: "#2d5070", textAlign: "center" }}>
              Trajectory initialised from patient values at day {day}. Parameters: α₈ = {Math.min(Math.max(3 + 7*(cd8-200)/800, 3), 10).toFixed(1)} (inferred from CD8⁺). Model: Mercier des Rochettes (2026) medRxiv.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
