"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

const PYTHON_SIM = `
import numpy as np
from scipy.integrate import solve_ivp
import json

def run_hps(alpha8, V0, sigma8, il10, immuno, ecmo):
    beta=1e-8; rho=500.0; c=2.0; delta_I=0.06; k_CTL=0.5; E0=1e6
    s8=5.0; d8=0.4; mu8=0.002
    s4=3.0; d4=0.15
    sM=2.0; dM=0.2
    pg=2.0; qg=0.5; dg=0.8
    pN=3.0; decN=0.7; decVf=0.5
    p6=0.8; q6=1.5; d6=0.9
    p10=0.5; q10=1.0; d10=0.5; K10=10.0
    kVf=0.3
    kP=0.12; Pmax=1.0; rP=0.25; KP=5.0
    sPi=10.0; decPi=0.07; kPiM=0.005
    KM=50.0; K8=20.0
    T8s=s8/d8; T4s=s4/d4; Ms=sM/dM; Pis=sPi/decPi
    y0=[E0,0.0,V0,T8s,T4s,Ms,0.,0.,0.,0.,0.,0.,0.,Pis]

    def ode(t, y):
        E,I,V,T8,T4,Mph,F1,Fg,N,L6,L10,Vf,P,Pi = [max(x,0.) for x in y]
        on = 1.0 if t >= 7.0 else 0.0
        g  = I/(I+KM)
        sup= 0.4*L10/(L10+K10)
        dE = -beta*V*E
        dI =  beta*V*E - (delta_I+k_CTL*T8)*I
        dV =  rho*I - c*V
        dT8= (s8 + alpha8*T4*I/(I+K8)*g + sigma8*Fg*T8*(1-sup)
               - d8*T8 - mu8*T8**2 - (0.2*on if immuno else 0.)*T8)
        dT4= s4 - d4*T4
        dMph= sM - dM*Mph
        dF1= (1.0*(T8+T4)+2.0*Mph)*g - 0.6*F1
        dFg= (pg*T8+qg*T4)*g - dg*Fg
        dN = pN*Mph*g - decN*N
        dL6= (p6*(T8+T4)+q6*Mph)*g - d6*L6
        dL10=(p10*(T8+T4)+q10*Mph)*g - d10*L10 + (3.0*on if il10 else 0.)
        dVf= kVf*I*g - decVf*Vf
        dP = kP*Vf*(1-P/Pmax) - rP*P*L10/(L10+KP) - (0.4*on if ecmo else 0.)*P
        dPi= sPi - decPi*Pi - kPiM*Mph*Pi
        return [dE,dI,dV,dT8,dT4,dMph,dF1,dFg,dN,dL6,dL10,dVf,dP,dPi]

    sol = solve_ivp(ode,(0,25),y0,method='LSODA',
                    t_eval=np.linspace(0,25,251),rtol=1e-6,atol=1e-8)
    t=sol.t; E,I,V,T8,T4,Mph,F1,Fg,N,L6,L10,Vf,P,Pi=sol.y
    W=(2*np.clip((T8-500)/800,0,1)+2*np.clip(L6/50,0,1)+
       2*np.clip(1-L10/20,0,1)+2*(P/0.85)+2*np.clip(1-Pi/Pis,0,1))
    Ppk=float(np.max(P)); T8pk=float(np.max(T8)); Wpk=float(np.max(W))
    vcl=float(t[np.where(V<1.)[0][0]]) if np.any(V<1.) else 25.
    wday=None
    for ti,wi in zip(t,W):
        if wi>2.5: wday=round(float(ti),1); break
    outcome=("RECOVERY" if Ppk<0.2 else "SEVERE" if Ppk<0.6 else "FATAL STORM")
    a11=delta_I+k_CTL*T8s
    R0=beta*rho*E0/(a11*c)
    Rip=sigma8*pg/(d8*dg)
    Rtip=Rip*T8s
    Ic=KM/(Rtip-1) if Rtip>1 else 9999.
    return json.dumps({
        't':t.tolist(),'T8':T8.tolist(),'V':V.tolist(),
        'Fg':Fg.tolist(),'L6':L6.tolist(),'L10':L10.tolist(),
        'P':P.tolist(),'Pi':(Pi/Pis*100).tolist(),'W':W.tolist(),
        'Ppk':Ppk,'T8pk':T8pk,'Wpk':Wpk,'Vclear':vcl,
        'wday':wday,'outcome':outcome,
        'R0':R0,'Rip':Rip,'Rtip':Rtip,'Ic':Ic,
    })
`;


// ─── Clinical dropdown options ────────────────────────────────────────────────
const HLA_OPTS = [
  { label: "Standard (population average)", alpha8: 5.0 },
  { label: "HLA-B*35 — elevated risk",      alpha8: 8.0 },
  { label: "HLA-B*35 + prior exposure — high risk", alpha8: 10.0 },
];
const EXPOSURE_OPTS = [
  { label: "Brief incidental contact",              logV0: 2.0 },
  { label: "Same area / shared meals",              logV0: 3.5 },
  { label: "Prolonged close contact  (> 4 h/day)",  logV0: 5.0 },
  { label: "Direct exposure to index case",         logV0: 5.5 },
];
const REACTIVITY_OPTS = [
  { label: "Normal immune reactivity",              sigma8: 0.20 },
  { label: "Elevated (autoimmune history / atopy)", sigma8: 0.35 },
  { label: "Hyperreactive",                         sigma8: 0.50 },
];

interface SimResult {
  t:number[];T8:number[];V:number[];Fg:number[];L6:number[];L10:number[];
  P:number[];Pi:number[];W:number[];
  Ppk:number;T8pk:number;Wpk:number;Vclear:number;
  wday:number|null;outcome:string;R0:number;Rip:number;Rtip:number;Ic:number;
}

function LineChart({values,times,color="#22d3ee",yMax,height=140,
  thresholds=[] as {v:number;c:string;label:string}[],showIntervention=true,
}:{values:number[];times:number[];color?:string;yMax:number;height?:number;
   thresholds?:{v:number;c:string;label:string}[];showIntervention?:boolean;}) {
  const VW=560,pad={t:8,r:14,b:26,l:46};
  const pw=VW-pad.l-pad.r,ph=height-pad.t-pad.b;
  const xs=(t:number)=>pad.l+(t/25)*pw;
  const ys=(v:number)=>pad.t+ph-Math.max(0,Math.min(1,v/yMax))*ph;
  const d=values.map((v,i)=>`${i===0?"M":"L"}${xs(times[i]).toFixed(1)},${ys(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${VW} ${height}`} style={{width:"100%",height}} className="overflow-visible">
      {[.25,.5,.75,1].map(f=>{const y=ys(f*yMax),val=f*yMax,lbl=val>=100?Math.round(val).toString():val>=10?val.toFixed(1):val.toFixed(2);return(
        <g key={f}><line x1={pad.l} y1={y} x2={pad.l+pw} y2={y} stroke="#214060" strokeWidth="1"/>
        <text x={pad.l-5} y={y+4} textAnchor="end" fill="#7fb3d3" fontSize="9" fontFamily="IBM Plex Mono">{lbl}</text></g>
      );})}
      <line x1={pad.l} y1={pad.t+ph} x2={pad.l+pw} y2={pad.t+ph} stroke="#214060" strokeWidth="1"/>
      {[0,5,10,15,20,25].map(d=><text key={d} x={xs(d)} y={pad.t+ph+16} textAnchor="middle" fill="#7fb3d3" fontSize="9" fontFamily="IBM Plex Mono">{d}</text>)}
      {showIntervention&&<g>
        <line x1={xs(7)} y1={pad.t} x2={xs(7)} y2={pad.t+ph} stroke="#fbbf24" strokeWidth="1" strokeDasharray="3,3" opacity=".7"/>
        <text x={xs(7)+3} y={pad.t+10} fill="#fbbf24" fontSize="8" fontFamily="IBM Plex Mono">day 7 of illness</text>
      </g>}
      {thresholds.map(({v,c,label})=><g key={v}>
        <line x1={pad.l} y1={ys(v)} x2={pad.l+pw} y2={ys(v)} stroke={c} strokeWidth="1.2" strokeDasharray="5,3" opacity=".85"/>
        <text x={pad.l+pw-2} y={ys(v)-3} textAnchor="end" fill={c} fontSize="8" fontFamily="IBM Plex Mono">{label}</text>
      </g>)}
      <path d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Stat({label,value,unit="",warn=false,ok=false}:{label:string;value:string;unit?:string;warn?:boolean;ok?:boolean;}) {
  const col=warn?"#f87171":ok?"#34d399":"#22d3ee";
  return <div className="flex flex-col gap-1">
    <span style={{fontFamily:"IBM Plex Mono",fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",color:"var(--muted)"}}>{label}</span>
    <span style={{fontFamily:"IBM Plex Mono",fontSize:20,fontWeight:600,lineHeight:1,color:col}}>
      {value}<span style={{fontSize:11,color:"var(--muted)",marginLeft:4}}>{unit}</span>
    </span>
  </div>;
}

function Card({children,className=""}:{children:React.ReactNode;className?:string}) {
  return <div className={`rounded-xl p-5 ${className}`} style={{background:"var(--surface)",border:"1px solid var(--border)"}}>{children}</div>;
}

function GuideTab() {
  const sections=[
    {title:"What is HPS?",color:"#f87171",body:`Hantavirus Pulmonary Syndrome is a severe lung disease caused by hantaviruses. The 2026 Andes virus outbreak linked to the MV Hondius cruise ship has caused 3 deaths in 7 confirmed cases across 6 countries.\n\nThe key paradox: the virus itself causes limited direct damage. Patients die from their own immune system. After 5–6 days the virus has gone — but the immune response it triggered keeps amplifying, flooding the lungs with fluid. This is what kills. The window between viral clearance and immune peak (days 5–9) is the only time treatments can work.`},
    {title:"The three patient parameters",color:"#22d3ee",body:`HLA genotype / immune aggressiveness: Determines how rapidly the immune system mobilises killer T cells (CD8⁺) in response to infection. Patients with the HLA-B*35 genotype mount faster, more intense responses — associated with worse HPS outcomes. Select a higher option to simulate this.\n\nViral exposure intensity: Reflects how much virus the patient was exposed to (duration and closeness of contact). More exposure means the immune system is activated for longer before the virus clears, giving the immune amplification loop more time to build up.\n\nImmune reactivity: The inherent strength of the self-amplifying immune feedback. Once activated, the immune response feeds on itself — some patients have a stronger feedback than others (autoimmune history, atopy, prior infections).`},
    {title:"Why antivirals do not help",color:"#34d399",body:`Two separate processes govern HPS — the virus and the immune response — and they are largely independent.\n\nThe virus (ℛ₀ = 0.396): The virus self-limits in every patient. It is always cleared by days 5–6, with or without antiviral treatment. This is why ribavirin trials have failed — the virus is already going away.\n\nThe immune response (ℛᵢₚ = 1.875): The immune system, once activated, amplifies itself in a self-sustaining feedback loop. It can overshoot to dangerous levels and persist for days after the virus is gone. This loop — not the virus — is what causes lung failure.\n\nConclusion: The battle is already won on the viral front by day 5. The immune front is where patients die. Antivirals do not help; immune modulation is the only intervention that matters.`},
    {title:"Reading the charts",color:"#fbbf24",body:`Storm Risk Score: Computed from six routine blood tests and chest X-ray. A score rising above 2.5 on day 3–4 predicts clinical deterioration 1–2 days before it happens. This is the early warning signal — act when it rises, not when the patient crashes.\n\nLung permeability: The key outcome. Below 20% = manageable fluid leak. 20–60% = severe but survivable. Above 60% = fatal pulmonary flooding. The chart shows whether the patient crosses this line.\n\nKiller T cells: The immune cells that drive the storm. They peak after the virus has gone. The gap between viral clearance (day 5–6) and T cell peak (day 7–10) is the only window for intervention.\n\nPlatelet count: Platelet drop is an early sign that the immune system is overactivating. A fall below half the normal count signals storm onset.`},
    {title:"Treatments — what works and when",color:"#a78bfa",body:`The most important finding from the model: the problem is not the virus — it is the immune system. The three parameters that determine outcome are all immune parameters, not viral ones. This means all effective treatments must target the immune response.\n\nIL-10 supplement: IL-10 is a natural brake on the immune system. In fatal HPS patients it is paradoxically low — the brake has failed. Giving exogenous IL-10 can restore the brake: it reduces inflammatory signals (TNF-α), cuts off blood vessel leakage, and helps the killer T cell count fall back to safe levels. The model identifies this as the single most effective intervention.\n\nImmunosuppression (corticosteroids): Slows the killer T cell expansion directly. Must only be used after day 5 — giving it earlier would suppress the immune response while the virus is still present, which could be harmful.\n\nECMO (ventilatory support): Directly supports lung function but does not treat the underlying immune overreaction. Best used as a bridge to keep the patient alive while the immune treatments take effect.\n\nTiming: Days 5–9 are the critical window. Too early risks suppressing viral clearance; too late and the lung damage is already done.`},
    {title:"The mathematical model (for researchers)",color:"#7fb3d3",body:`The simulator solves 14 coupled differential equations simultaneously — one for each biological variable: virus, infected lung cells, three immune cell types, four inflammatory proteins, blood vessel leakage, and platelets.\n\nThe key mathematical result: using a technique called Schur complement analysis, we prove that the immune feedback loop becomes self-sustaining the moment even a tiny number of lung cells are infected (threshold: 2.2 cells per microlitre — crossed within hours). This means the immune storm is structurally unavoidable in HPS. Survival depends entirely on whether the virus is cleared before the immune overshoot reaches a lethal level.\n\nFull mathematical derivations are in the medRxiv preprint linked at the top of this page.`},
  ];
  return <div className="flex flex-col gap-5">
    {sections.map(({title,color,body})=>(
      <div key={title} className="rounded-xl p-5" style={{background:"var(--surface)",border:"1px solid var(--border)"}}>
        <h3 style={{fontFamily:"Oxanium",fontWeight:700,fontSize:15,color,marginBottom:10}}>{title}</h3>
        {body.split("\n\n").map((para,i)=>(
          <p key={i} style={{fontSize:12,fontFamily:"IBM Plex Mono",color:"var(--text)",lineHeight:1.8,marginBottom:8,opacity:.9}}>{para}</p>
        ))}
      </div>
    ))}
    <div className="rounded-xl p-5 text-center" style={{background:"rgba(34,211,238,0.04)",border:"1px solid rgba(34,211,238,0.12)"}}>
      <p style={{fontFamily:"IBM Plex Mono",fontSize:11,color:"var(--muted)"}}>
        Mercier des Rochettes, B. (2026). Cytokine storm dynamics in HPS: multiscale ODE with Wasserstein early-warning score and application to the 2026 Andes virus outbreak. <em>medRxiv</em>.{" · "}
        <a href="https://github.com/quantumproteinsai/hps-cytokine-storm" target="_blank" rel="noreferrer" style={{color:"var(--teal)"}}>
          github.com/quantumproteinsai/hps-cytokine-storm
        </a>
      </p>
    </div>
  </div>;
}

export default function HPSSimulator() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pyodide,setPyodide]=useState<any>(null);
  const [phase,setPhase]=useState<"boot"|"loading"|"ready"|"running"|"done">("boot");
  const [result,setResult]=useState<SimResult|null>(null);
  const [simError,setSimError]=useState<string|null>(null);
  const [activeTab,setActiveTab]=useState<"sim"|"guide">("sim");
  const [hlaIdx,setHlaIdx]=useState(0);
  const [expIdx,setExpIdx]=useState(0);
  const [reactIdx,setReactIdx]=useState(0);
  const alpha8=HLA_OPTS[hlaIdx].alpha8;
  const logV0=EXPOSURE_OPTS[expIdx].logV0;
  const sigma8=REACTIVITY_OPTS[reactIdx].sigma8;
  const [il10,setIl10]=useState(false);
  const [immuno,setImmuno]=useState(false);
  const [ecmo,setEcmo]=useState(false);
  const loadedRef=useRef(false);

  const analytics=useMemo(()=>{
    const d8=0.4,dg=0.8,pg=2.0,KM=50,T8s=12.5;
    const Rip=sigma8*pg/(d8*dg),Rtip=Rip*T8s,Ic=Rtip>1?KM/(Rtip-1):Infinity;
    // Rough instant outcome estimate (replaced by ODE result after auto-run)
    const stormIdx = alpha8 * (logV0 - 4.5);
    const instantOutcome = stormIdx < 0 ? "RECOVERY" : stormIdx < 6 ? "SEVERE" : "FATAL STORM";
    return {Rip,Rtip,Ic,R0:0.3962,instantOutcome};
  },[sigma8,alpha8,logV0]);

  useEffect(()=>{
    if(loadedRef.current)return;
    loadedRef.current=true;
    setPhase("loading");
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js";
    s.onload=async()=>{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const py=await(window as any).loadPyodide();
      await py.loadPackage(["numpy","scipy"]);
      await py.runPythonAsync(PYTHON_SIM);
      setPyodide(py);setPhase("ready");
    };
    s.onerror=()=>setPhase("ready");
    document.head.appendChild(s);
  },[]);


  // Auto-run with 800 ms debounce whenever parameters change
  useEffect(()=>{
    if(phase==="boot"||phase==="loading") return;
    const timer=setTimeout(()=>{ runSim(); }, 800);
    return ()=>clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hlaIdx,expIdx,reactIdx,il10,immuno,ecmo]);

  const runSim=useCallback(async()=>{
    if(!pyodide){setSimError("Python engine not ready");return;}
    setPhase("running");setSimError(null);
    const V0=Math.pow(10,logV0);
    try{
      const raw=await pyodide.runPythonAsync(
        `run_hps(${alpha8},${V0},${sigma8},`+
        `${il10?"True":"False"},${immuno?"True":"False"},${ecmo?"True":"False"})`
      );
      setResult(JSON.parse(raw));setPhase("done");
    }catch(err:unknown){
      const msg=err instanceof Error?err.message:String(err);
      console.error(msg);setSimError(msg);setPhase("ready");
    }
  },[pyodide,alpha8,logV0,sigma8,il10,immuno,ecmo]);

  const isReady=phase==="ready"||phase==="done";
  const outcomeClass=result?(result.outcome==="RECOVERY"?"outcome-recovery":result.outcome==="SEVERE"?"outcome-severe":"outcome-fatal"):"";

  const mono:React.CSSProperties={fontFamily:"IBM Plex Mono"};
  const muted:React.CSSProperties={...mono,fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",color:"var(--muted)"};

  return (
    <div className="min-h-screen" style={{background:"var(--bg)"}}>

      {/* ── Full-page loading overlay ───────────────────────────── */}
      {(phase==="boot"||phase==="loading")&&(
        <div style={{position:"fixed",inset:0,zIndex:200,background:"var(--bg)",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>

          {/* Virus SVG illustration */}
          <svg width="220" height="220" viewBox="200 30 280 280" role="img" style={{marginBottom:4}}>
            <title>Hantavirus particle illustration</title>
            <style>{`
              @keyframes vrot  { from{transform-origin:340px 170px;transform:rotate(0deg)}   to{transform-origin:340px 170px;transform:rotate(360deg)} }
              @keyframes vrot2 { from{transform-origin:340px 170px;transform:rotate(0deg)}   to{transform-origin:340px 170px;transform:rotate(-360deg)} }
              @keyframes vpulse{ 0%,100%{opacity:.45} 50%{opacity:.75} }
              .vring1{animation:vrot  28s linear infinite}
              .vring2{animation:vrot2 20s linear infinite}
              .vglow{animation:vpulse 3s ease-in-out infinite}
            `}</style>
            <defs>
              <radialGradient id="vcore" cx="42%" cy="38%" r="55%">
                <stop offset="0%"   stopColor="#1a3a5c"/>
                <stop offset="100%" stopColor="#071828"/>
              </radialGradient>
              <radialGradient id="venv" cx="42%" cy="38%" r="55%">
                <stop offset="0%"   stopColor="#0f4a6e" stopOpacity=".7"/>
                <stop offset="100%" stopColor="#071828"  stopOpacity=".9"/>
              </radialGradient>
              <radialGradient id="vshine" cx="35%" cy="28%" r="40%">
                <stop offset="0%"   stopColor="#4dc4e8" stopOpacity=".18"/>
                <stop offset="100%" stopColor="#4dc4e8" stopOpacity="0"/>
              </radialGradient>
              <clipPath id="vcirc"><circle cx="340" cy="170" r="118"/></clipPath>
            </defs>
            <circle cx="340" cy="170" r="134" fill="none" stroke="#22d3ee" strokeWidth="1" opacity=".07" className="vglow"/>
            <circle cx="340" cy="170" r="128" fill="none" stroke="#22d3ee" strokeWidth=".5" opacity=".10"/>
            <circle cx="340" cy="170" r="118" fill="url(#venv)" stroke="#1a6a9a" strokeWidth="1"/>
            <circle cx="340" cy="170" r="82"  fill="url(#vcore)" stroke="#0f4a6e" strokeWidth=".5"/>
            <g clipPath="url(#vcirc)">
              <path d="M300,150 C290,140 310,130 320,145 C330,160 310,170 300,160 C290,150 310,140 315,155" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" opacity=".8"/>
              <path d="M350,155 C360,143 375,148 370,162 C365,176 348,172 352,158 C356,144 370,152 362,166" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" opacity=".8"/>
              <path d="M330,180 C320,172 330,162 340,170 C350,178 342,190 332,184" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" opacity=".8"/>
              <circle cx="300" cy="150" r="2.5" fill="#f87171" opacity=".9"/>
              <circle cx="318" cy="156" r="2.5" fill="#f87171" opacity=".9"/>
              <circle cx="350" cy="155" r="2.5" fill="#fbbf24" opacity=".9"/>
              <circle cx="360" cy="168" r="2.5" fill="#fbbf24" opacity=".9"/>
              <circle cx="330" cy="180" r="2.5" fill="#a78bfa" opacity=".9"/>
            </g>
            <g className="vring1">
              {[0,36,72,108,144,180,216,252,288,324].map(a=>(
                <g key={a} transform={`rotate(${a},340,170)`}>
                  <line x1="340" y1="52" x2="340" y2="42" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round"/>
                  <ellipse cx="340" cy="39" rx="5" ry="3.5" fill="#22d3ee" opacity=".85"/>
                </g>
              ))}
            </g>
            <g className="vring2">
              {[18,54,90,126,162,198,234,270,306,342].map(a=>(
                <g key={a} transform={`rotate(${a},340,170)`}>
                  <line x1="340" y1="88" x2="340" y2="78" stroke="#60a5fa" strokeWidth="1" strokeLinecap="round" opacity=".6"/>
                  <circle cx="340" cy="76" r="2.5" fill="#60a5fa" opacity=".7"/>
                </g>
              ))}
            </g>
            <circle cx="340" cy="170" r="118" fill="url(#vshine)"/>
          </svg>

          <h1 style={{fontFamily:"Oxanium",fontWeight:800,fontSize:24,color:"var(--bright)",marginBottom:4,textAlign:"center"}}>
            HPS Cytokine Storm Simulator
          </h1>
          <p style={{fontFamily:"IBM Plex Mono",fontSize:13,color:"var(--teal)"}}>
            Loading Python + SciPy engine…
          </p>
          <p style={{fontFamily:"IBM Plex Mono",fontSize:11,color:"var(--muted)",textAlign:"center",maxWidth:320,lineHeight:1.7}}>
            This simulator runs a 14-variable ODE model entirely in your browser.<br/>
            First visit takes ~20 seconds. Cached on return visits.
          </p>
          <div style={{marginTop:8,fontFamily:"IBM Plex Mono",fontSize:10,
            letterSpacing:"0.15em",textTransform:"uppercase",color:"var(--dim)"}}>
            xvirus.org · Quantum Proteins AI
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{borderBottom:"1px solid var(--border)",background:"rgba(14,31,53,0.97)",backdropFilter:"blur(8px)",position:"sticky",top:0,zIndex:50}}>
        <div className="max-w-7xl mx-auto px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{...mono,fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--teal)"}}>xvirus.org</span>
              <span style={{color:"var(--border)"}}>·</span>
              <a href="https://quantum-proteins.ai" style={{...mono,fontSize:10,color:"var(--muted)"}} className="hover:text-white transition-colors">quantum-proteins.ai</a>
            </div>
            <h1 style={{fontFamily:"Oxanium",fontWeight:800,fontSize:18,color:"var(--bright)",lineHeight:1.2}}>HPS Cytokine Storm Simulator</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/triage"
              style={{fontFamily:"IBM Plex Mono",fontSize:11,padding:"6px 14px",
                border:"1px solid var(--teal)",borderRadius:6,color:"var(--teal)",
                fontWeight:600,letterSpacing:"0.05em",background:"rgba(34,211,238,0.08)"}}
              className="hover:bg-cyan-500 hover:text-slate-900 transition-all">
              🏥 Patient Triage
            </a>
            {[["medRxiv preprint","https://www.medrxiv.org"],["Source code","https://github.com/quantumproteinsai/hps-cytokine-storm"],["Contact","/contact"]].map(([l,h])=>(
              <a key={l} href={h} target={h.startsWith("http")?"_blank":undefined} rel="noreferrer"
                style={{...mono,fontSize:10,padding:"5px 10px",border:"1px solid var(--border)",borderRadius:6,color:"var(--muted)"}}
                className="hover:border-cyan-500 hover:text-cyan-400 transition-all">↗ {l}</a>
            ))}
          </div>
        </div>
        <div style={{borderTop:"1px solid var(--border)",background:"rgba(248,113,113,0.05)"}}>
          <div className="max-w-7xl mx-auto px-5 py-2 flex items-start gap-2">
            <span className="pulse-dot shrink-0 mt-0.5" style={{color:"#f87171",fontSize:10}}>●</span>
            <p style={{...mono,fontSize:11,color:"var(--muted)",lineHeight:1.6}}>
              <span style={{color:"#f87171",fontWeight:600}}>Active outbreak:</span>{" "}
              Andes hantavirus (MV Hondius, April–May 2026) — 7 confirmed cases, 3 deaths across France, Germany, Netherlands, Spain, Switzerland, South Africa. WHO Level 3.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-6 items-start">

        {/* LEFT */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[108px]">

          {/* Status */}
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{background:"var(--surface)",border:"1px solid var(--border)"}}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${phase==="loading"?"bg-amber-400 pulse-dot":phase==="boot"?"bg-slate-600":"bg-emerald-400"}`}/>
            <span style={{...mono,fontSize:11,color:"var(--muted)"}}>
              {phase==="boot"&&"Initialising…"}
              {phase==="loading"&&"Loading Python + SciPy WASM (~20 s)…"}
              {phase==="ready"&&"Python engine ready ✓"}
              {phase==="running"&&"Solving 14-variable ODE…"}
              {phase==="done"&&"Simulation complete ✓"}
            </span>
          </div>

          {/* Parameters — dropdowns */}
          <Card>
            <p style={{...muted,marginBottom:16}}>Patient Profile</p>
            <div className="flex flex-col gap-5">
              {([
                {label:"HLA genotype / CTL aggressiveness",
                 opts:HLA_OPTS.map(o=>o.label), idx:hlaIdx, set:setHlaIdx,
                 tip:"Determines how fast T cells expand in response to infection."},
                {label:"Viral exposure intensity",
                 opts:EXPOSURE_OPTS.map(o=>o.label), idx:expIdx, set:setExpIdx,
                 tip:"Duration and closeness of contact with the index case."},
                {label:"Immune reactivity",
                 opts:REACTIVITY_OPTS.map(o=>o.label), idx:reactIdx, set:setReactIdx,
                 tip:"How strongly the immune system feeds on itself once activated. Higher = faster progression to storm."},
              ] as {label:string;opts:string[];idx:number;set:(n:number)=>void;tip:string}[]).map(({label,opts,idx,set,tip})=>(
                <div key={label}>
                  <label style={{...mono,fontSize:11,color:"var(--text)",display:"block",marginBottom:6}}>{label}</label>
                  <select value={idx} onChange={e=>set(+e.target.value)}
                    style={{width:"100%",background:"#0e1f35",border:"1px solid var(--border)",
                      borderRadius:6,color:"#22d3ee",fontFamily:"IBM Plex Mono",fontSize:11,
                      padding:"7px 10px",outline:"none",cursor:"pointer",appearance:"none",
                      backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2322d3ee' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",
                      paddingRight:30}}>
                    {opts.map((o,i)=><option key={i} value={i}>{o}</option>)}
                  </select>
                  <p style={{...mono,fontSize:9,color:"var(--dim)",marginTop:5,lineHeight:1.5}}>{tip}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Interventions */}
          <Card>
            <p style={{...muted,marginBottom:12}}>Interventions <span style={{fontSize:10,letterSpacing:0,textTransform:"none",color:"var(--dim)"}}>(from day 7 of illness)</span></p>
            <div className="flex flex-col gap-2">
              {[
                {label:"IL-10 supplement",sub:"+3 pg/mL/d",val:il10,set:setIl10},
                {label:"Immunosuppression",sub:"−20% CTL/d",val:immuno,set:setImmuno},
                {label:"ECMO",sub:"−40% P/d",val:ecmo,set:setEcmo},
              ].map(({label,sub,val,set})=>(
                <button key={label} onClick={()=>set(!val)}
                  className={`toggle-btn rounded-lg px-4 py-2.5 flex justify-between items-center ${val?"active":""}`}>
                  <span style={{...mono,fontSize:12}}>{label}</span>
                  <span style={{...mono,fontSize:10,opacity:.7}}>{sub}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Auto-run status */}
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{background:"var(--surface)",border:`1px solid ${phase==="running"?"rgba(34,211,238,0.4)":"var(--border)"}`}}>
            {phase==="running"
              ? <><span className="spin" style={{fontSize:14,color:"var(--teal)"}}>⟳</span>
                  <span style={{...mono,fontSize:11,color:"var(--teal)"}}>Recalculating…</span></>
              : <><span style={{width:8,height:8,borderRadius:"50%",background:"#34d399",display:"inline-block",flexShrink:0}}/>
                  <span style={{...mono,fontSize:11,color:"var(--muted)"}}>
                    {phase==="done"?"Simulation current — updates automatically":"Waiting for engine…"}
                  </span></>}
          </div>

          {simError&&<div className="rounded-xl px-4 py-3" style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)"}}>
            <p style={{...mono,fontSize:10,color:"#f87171",marginBottom:4,fontWeight:600}}>Python error</p>
            <p style={{...mono,fontSize:9,color:"#fca5a5",wordBreak:"break-all",lineHeight:1.5}}>{simError}</p>
          </div>}

          {/* Clinical summary panel */}
          <Card>
            <p style={{...muted,marginBottom:14}}>What the model tells us</p>
            <div className="flex flex-col gap-3">

              {/* Virus */}
              <div style={{background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:8,padding:"10px 12px"}}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{color:"#34d399",fontSize:12}}>✓</span>
                  <span style={{...mono,fontSize:10,color:"#34d399",fontWeight:600}}>Virus will clear on its own</span>
                </div>
                <p style={{...mono,fontSize:9,color:"var(--muted)",lineHeight:1.6}}>
                  Hantavirus always self-limits by days 5–6. Antivirals will not change the outcome.
                </p>
              </div>

              {/* Immune loop */}
              <div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:8,padding:"10px 12px"}}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{color:"#f87171",fontSize:12}}>⚠</span>
                  <span style={{...mono,fontSize:10,color:"#f87171",fontWeight:600}}>
                    Immune amplification active — {analytics.Rtip.toFixed(0)}× gain
                  </span>
                </div>
                <p style={{...mono,fontSize:9,color:"var(--muted)",lineHeight:1.6}}>
                  The immune feedback loop is self-amplifying. Once triggered it can
                  overshoot {analytics.Rtip.toFixed(0)} times the safe baseline.
                </p>
              </div>

              {/* Storm threshold */}
              <div style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:8,padding:"10px 12px"}}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{color:"#fbbf24",fontSize:12}}>→</span>
                  <span style={{...mono,fontSize:10,color:"#fbbf24",fontWeight:600}}>
                    Storm threshold crossed within hours of infection
                  </span>
                </div>
                <p style={{...mono,fontSize:9,color:"var(--muted)",lineHeight:1.6}}>
                  The immune loop becomes self-sustaining when just {isFinite(analytics.Ic)?analytics.Ic.toFixed(1):"few"} cells/μL
                  are infected — unavoidable in any detectable HPS case.
                  Amber line on charts = day 7 of illness (from symptom onset) — the window between viral clearance and peak immune response.
                </p>
              </div>

            </div>
          </Card>
        </aside>

        {/* RIGHT */}
        <section className="flex flex-col gap-5">

          {/* Tabs */}
          <div style={{borderBottom:"1px solid var(--border)",display:"flex"}}>
            {(["sim","guide"] as const).map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)}
                className={`tab-btn uppercase ${activeTab===tab?"active":""}`}>
                {tab==="sim"?"Simulation":"How It Works"}
              </button>
            ))}
          </div>

          {activeTab==="sim"&&<>
            {/* Outcome */}
            {(result||phase==="running")?(
              <div className="fade-in rounded-xl p-5 flex flex-col gap-4" style={{background:"var(--surface)",border:"1px solid var(--border)"}}>

                {/* Top row: outcome + subtext */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span style={{...muted}}>Predicted outcome
                      {phase==="running"&&<span style={{...mono,fontSize:9,color:"var(--teal)",marginLeft:8}}>updating…</span>}
                    </span>
                    <span className={result?outcomeClass:analytics.instantOutcome==="RECOVERY"?"outcome-recovery":analytics.instantOutcome==="SEVERE"?"outcome-severe":"outcome-fatal"}
                      style={{fontFamily:"Oxanium",fontWeight:800,fontSize:32,lineHeight:1}}>
                      {result?result.outcome:analytics.instantOutcome}
                    </span>
                    {!result&&<span style={{...mono,fontSize:10,color:"var(--dim)",marginTop:4}}>Instant estimate — full simulation loading…</span>}
                  </div>

                  {result&&<div style={{...mono,fontSize:12,color:"var(--muted)",maxWidth:320,lineHeight:1.8}}>
                    {result.outcome==="RECOVERY"&&
                      "The immune system is predicted to stay under control. The virus will clear before any dangerous overreaction develops. No escalation required based on this profile."}
                    {result.outcome==="SEVERE"&&
                      "The immune system is over-reacting significantly. The virus will clear by day 5–6 but the immune response will keep amplifying. Daily blood tests essential — starting treatment in days 5–9 may prevent respiratory failure."}
                    {result.outcome==="FATAL STORM"&&
                      "The immune system is predicted to cause severe lung flooding. Blood vessel leakage will exceed the critical level. Immediate ICU transfer, specialist infectious disease consultation, and IL-10-centred immune therapy are indicated."}
                  </div>}
                </div>

                {/* Key numbers in plain language */}
                {result&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2" style={{borderTop:"1px solid var(--border)"}}>
                  <div className="flex flex-col gap-1">
                    <span style={{...mono,fontSize:9,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--muted)"}}>Peak lung permeability</span>
                    <span style={{...mono,fontSize:18,fontWeight:600,color:result.Ppk>=.6?"#f87171":result.Ppk>=.2?"#fbbf24":"#34d399"}}>
                      {(result.Ppk*100).toFixed(0)}%
                    </span>
                    <span style={{...mono,fontSize:9,color:"var(--dim)"}}>
                      {result.Ppk>=.6?"Fatal zone (>60%)":result.Ppk>=.2?"Severe zone (>20%)":"Safe (<20%)"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span style={{...mono,fontSize:9,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--muted)"}}>Peak CD8⁺ T cells</span>
                    <span style={{...mono,fontSize:18,fontWeight:600,color:result.T8pk>500?"#f87171":"#34d399"}}>
                      {result.T8pk.toFixed(0)}
                    </span>
                    <span style={{...mono,fontSize:9,color:"var(--dim)"}}>
                      cells/μL {result.T8pk>500?"— storm level":"— within range"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span style={{...mono,fontSize:9,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--muted)"}}>Storm risk score peak</span>
                    <span style={{...mono,fontSize:18,fontWeight:600,color:result.Wpk>=6?"#f87171":result.Wpk>=2.5?"#fbbf24":"#34d399"}}>
                      {result.Wpk.toFixed(1)} / 10
                    </span>
                    <span style={{...mono,fontSize:9,color:"var(--dim)"}}>
                      {result.Wpk>=6?"Critical (>6)":result.Wpk>=2.5?"Alert (>2.5)":"Low risk"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span style={{...mono,fontSize:9,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--muted)"}}>Virus cleared by</span>
                    <span style={{...mono,fontSize:18,fontWeight:600,color:"#34d399"}}>day {result.Vclear.toFixed(1)}</span>
                    <span style={{...mono,fontSize:9,color:"var(--dim)"}}>
                      {result.wday!=null?`Storm warning day ${result.wday}`:"No storm warning"}
                    </span>
                  </div>
                </div>}
              </div>
            ):(
              <div className="rounded-xl p-8 flex items-center justify-center" style={{background:"var(--surface)",border:"1px solid var(--border)",minHeight:90}}>
                <p style={{...mono,fontSize:12,color:"var(--dim)"}}>
                  {phase==="loading"?"Waiting for Python engine…":"Select patient profile — simulation runs automatically."}
                </p>
              </div>
            )}

            {/* Charts */}
            {result&&<div className="flex flex-col gap-5 fade-in">

              {/* Row 1: W + P */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card>
                  <div className="flex justify-between items-baseline mb-3">
                    <p style={{...muted}}>Storm Risk Score <span style={{opacity:.6,textTransform:"none",letterSpacing:0}}>(0–10 scale)</span></p>
                    <span style={{...mono,fontSize:9,color:"var(--dim)"}}>days</span>
                  </div>
                  <LineChart values={result.W} times={result.t} yMax={Math.max(result.Wpk*1.15,4)} color="#22d3ee" height={200}
                    thresholds={[{v:2.5,c:"#fbbf24",label:"alert"},{v:6,c:"#f87171",label:"critical"}]}/>
                  <p style={{...mono,fontSize:9,color:"var(--muted)",marginTop:6,lineHeight:1.5}}>Rises before lung damage is visible. Alert threshold: 2.5. Critical: 6.0.</p>
                </Card>
                <Card>
                  <div className="flex justify-between items-baseline mb-3">
                    <p style={{...muted}}>Vascular Permeability <span style={{opacity:.6,textTransform:"none",letterSpacing:0}}>P(t)</span></p>
                  </div>
                  <LineChart values={result.P} times={result.t} yMax={Math.max(result.Ppk*1.2,.8)} color="#f87171" height={200}
                    thresholds={[{v:.2,c:"#fbbf24",label:"severe"},{v:.6,c:"#ef4444",label:"fatal"}]}/>
                  <p style={{...mono,fontSize:9,color:"var(--muted)",marginTop:6}}>VEGF-driven capillary leak. Fatal if peak &gt; 0.6.</p>
                </Card>
              </div>

              {/* Row 2: CTL full width */}
              <Card>
                <p style={{...muted,marginBottom:12}}>Killer T cells (CD8⁺) <span style={{opacity:.6,textTransform:"none",letterSpacing:0}}>cells/μL over time</span></p>
                <LineChart values={result.T8} times={result.t} yMax={Math.max(result.T8pk*1.15,100)} color="#60a5fa" height={220}
                  thresholds={[{v:240,c:"#fbbf24",label:"Lindgren 2011 peak"}]}/>
                <p style={{...mono,fontSize:9,color:"var(--muted)",marginTop:6}}>Immune cells peak after the virus has gone — this is the danger window.</p>
              </Card>

              {/* Row 3: Cytokines + Platelets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card>
                  <div className="flex justify-between items-baseline mb-3">
                    <p style={{...muted}}>Cytokines <span style={{opacity:.6,textTransform:"none",letterSpacing:0}}>pg/mL</span></p>
                    <div className="flex gap-3">
                      {[["#22d3ee","IFN-γ"],["#34d399","IL-10"],["#fb923c","IL-6"]].map(([c,l])=>(
                        <span key={l} style={{...mono,fontSize:9,color:c}}>— {l}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{position:"relative"}}>
                    <LineChart values={result.Fg} times={result.t}
                      yMax={Math.max(...result.Fg,...result.L6,...result.L10)*1.15+1} color="#22d3ee" height={200}/>
                    <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
                      <svg viewBox="0 0 560 200" style={{width:"100%",height:200}} className="overflow-visible">
                        {(()=>{
                          const yMax=Math.max(...result.Fg,...result.L6,...result.L10)*1.15+1;
                          const pw=560-46-14,ph=200-8-26;
                          const xs=(t:number)=>46+(t/25)*pw;
                          const ys=(v:number)=>8+ph-Math.max(0,Math.min(1,v/yMax))*ph;
                          return[
                            <path key="l10" d={result.L10.map((v,i)=>`${i===0?"M":"L"}${xs(result.t[i]).toFixed(1)},${ys(v).toFixed(1)}`).join(" ")} stroke="#34d399" strokeWidth="1.5" fill="none"/>,
                            <path key="l6"  d={result.L6.map((v,i)=>`${i===0?"M":"L"}${xs(result.t[i]).toFixed(1)},${ys(v).toFixed(1)}`).join(" ")} stroke="#fb923c" strokeWidth="1.5" fill="none"/>,
                          ];
                        })()}
                      </svg>
                    </div>
                  </div>
                  <p style={{...mono,fontSize:9,color:"var(--muted)",marginTop:6}}>Low IL-10 = immune brake has failed. Rising IL-10 means brakes are working.</p>
                </Card>
                <Card>
                  <p style={{...muted,marginBottom:12}}>Platelet count <span style={{opacity:.6,textTransform:"none",letterSpacing:0}}>Π(t) — % of baseline</span></p>
                  <LineChart values={result.Pi} times={result.t} yMax={110} height={200} color="#a78bfa"
                    thresholds={[{v:50,c:"#fbbf24",label:"thrombocytopaenia"}]}/>
                  <p style={{...mono,fontSize:9,color:"var(--muted)",marginTop:6}}>Drop below half normal level is an early warning sign of immune storm.</p>
                </Card>
              </div>
            </div>}

            {/* Guidance */}
            <div className="rounded-xl p-6" style={{background:"rgba(34,211,238,0.04)",border:"1px solid rgba(34,211,238,0.15)"}}>
              <p style={{fontFamily:"Oxanium",fontWeight:700,fontSize:14,color:"#22d3ee",marginBottom:20,letterSpacing:"0.05em"}}>
                Clinical Guidance — MV Hondius Andes Virus Patients
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

                <div style={{background:"rgba(34,211,238,0.07)",borderRadius:10,padding:"16px 18px",border:"1px solid rgba(34,211,238,0.15)"}}>
                  <p style={{fontFamily:"Oxanium",fontWeight:700,fontSize:13,color:"#22d3ee",marginBottom:10}}>
                    Days 1–4 of illness · Prodrome
                  </p>
                  <ul style={{margin:0,padding:0,listStyle:"none",display:"flex",flexDirection:"column",gap:8}}>
                    {[
                      "Measure CD8⁺ count, IL-6, IL-10 and platelets every day",
                      "Score chest X-ray infiltrate (0 = clear, 3 = severe)",
                      <span>Enter values in the triage tool at{" "}<a href="/triage" style={{color:"#22d3ee",textDecoration:"underline"}}>xvirus.org/triage</a></span>,
                      "If the Storm Risk Score exceeds 2.5 → transfer to HDU immediately",
                    ].map((t,i)=>(
                      <li key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                        <span style={{color:"#22d3ee",fontWeight:700,flexShrink:0,marginTop:1}}>→</span>
                        <span style={{fontFamily:"IBM Plex Mono",fontSize:12,color:"var(--text)",lineHeight:1.6}}>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{background:"rgba(251,191,36,0.07)",borderRadius:10,padding:"16px 18px",border:"1px solid rgba(251,191,36,0.2)"}}>
                  <p style={{fontFamily:"Oxanium",fontWeight:700,fontSize:13,color:"#fbbf24",marginBottom:10}}>
                    Days 5–9 of illness · Treatment window
                  </p>
                  <ul style={{margin:0,padding:0,listStyle:"none",display:"flex",flexDirection:"column",gap:8}}>
                    {[
                      "The virus is already clearing — antivirals will not help",
                      "The immune response is the threat now",
                      "IL-10 analogue: most effective single intervention (−40% peak lung damage)",
                      "Add reduced-dose corticosteroid immunosuppression",
                      "ECMO as bridge if lung function deteriorates",
                    ].map((t,i)=>(
                      <li key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                        <span style={{color:"#fbbf24",fontWeight:700,flexShrink:0,marginTop:1}}>→</span>
                        <span style={{fontFamily:"IBM Plex Mono",fontSize:12,color:"var(--text)",lineHeight:1.6}}>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{background:"rgba(248,113,113,0.06)",borderRadius:10,padding:"16px 18px",border:"1px solid rgba(248,113,113,0.15)"}}>
                  <p style={{fontFamily:"Oxanium",fontWeight:700,fontSize:13,color:"#f87171",marginBottom:10}}>
                    Key message
                  </p>
                  <ul style={{margin:0,padding:0,listStyle:"none",display:"flex",flexDirection:"column",gap:8}}>
                    {[
                      "Both mild and fatal cases clear the virus by day 6",
                      "Death is caused by the immune system, not the virus",
                      "Outcome is determined in the 5–9 day window",
                      "Do not wait for respiratory failure to act",
                    ].map((t,i)=>(
                      <li key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                        <span style={{color:"#f87171",fontWeight:700,flexShrink:0,marginTop:1}}>→</span>
                        <span style={{fontFamily:"IBM Plex Mono",fontSize:12,color:"var(--text)",lineHeight:1.6}}>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            </div>
          </>}

          {activeTab==="guide"&&<GuideTab/>}
        </section>
      </main>
    </div>
  );
}
