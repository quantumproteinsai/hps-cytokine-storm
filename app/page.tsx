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
    kP=0.1; Pmax=1.0; rP=0.3; KP=5.0
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
    W=((T8-T8s)/T8s)**2+(L6/10.)**2+(L10/8.)**2+(N/15.)**2+(P/0.15)**2+((Pis-np.maximum(Pi,1.))/Pis)**2
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
        <text x={xs(7)+3} y={pad.t+10} fill="#fbbf24" fontSize="8" fontFamily="IBM Plex Mono">day 7</text>
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
    {title:"What is HPS?",color:"#f87171",body:`Hantavirus Pulmonary Syndrome (HPS) is a severe respiratory illness caused by hantaviruses. The 2026 Andes virus (ANDV) outbreak aboard MV Hondius has caused 3 deaths in 7 confirmed cases across 6 countries.\n\nHPS is paradoxical: the virus itself is non-cytopathic and self-limiting (ℛ₀ < 1). Patients die from their own immune response. Circulating CD8⁺ CTLs recognise infected endothelial cells and trigger a cytokine cascade — TNF-α, IFN-γ, IL-6 — causing massive capillary leak. Viral clearance happens by day 5–6 regardless of outcome. What happens after that determines survival.`},
    {title:"The three parameters",color:"#22d3ee",body:`α₈ — CTL recruitment rate: How aggressively the immune system mobilises CD8⁺ T cells. Partly determined by HLA genotype (HLA-B*35 associated with worse outcomes). Slide right to simulate an immunologically "hot" patient.\n\nV₀ — Initial viral load: Proportional to exposure duration and inoculum size. Higher V₀ = antigen gate stays open longer = more time for CTL amplification.\n\nσ₈ — IFN-γ / CTL coupling: Strength of the positive feedback loop. IFN-γ (produced by CTLs) promotes CTL survival. Higher σ₈ = more self-amplifying = faster progression to storm.`},
    {title:"The ℛ₀ / ℛᵢₚ dual structure",color:"#34d399",body:`Two independent reproduction numbers explain HPS completely:\n\nℛ₀ (viral): Always < 1 for hantavirus in humans. The virus self-limits by day 5–6 in every scenario. Antivirals have minimal effect.\n\nℛᵢₚ (immunopathological): The gain of the CTL–IFN-γ feedback loop. When ℛᵢₚ > 1 (always true in HPS), a self-sustaining storm attractor exists. CTL count can overshoot to dangerous levels before the antigen gate closes.\n\nThis explains why HPS kills after viral clearance: ℛ₀ < 1 kills the virus, but ℛᵢₚ > 1 means the immune response outlives it.`},
    {title:"Reading the charts",color:"#fbbf24",body:`Wasserstein score Ŵ(t): A distance metric from six routine ICU measurements (CD8⁺, IL-6, IL-10, IL-12, platelets, chest X-ray). A plateau or rise above 2.5 at day 3–4 predicts deterioration 1–2 days ahead.\n\nVascular permeability P(t): The outcome variable. Below 0.2 = manageable, 0.2–0.6 = severe, above 0.6 = fatal pulmonary oedema.\n\nCTL count T₈(t): Peaks after viral clearance. The gap between viral peak (day 5–6) and CTL peak (day 7–10) is the intervention window.\n\nPlatelet count Π(t): Thrombocytopaenia (< 50% baseline) is an early marker of immune activation.`},
    {title:"Interventions — the day-7 window",color:"#a78bfa",body:`All interventions apply at day 7 — the inflection point between viral clearance and peak CTL expansion.\n\nIL-10 supplement: Suppresses TNF-α, reduces VEGF, promotes CTL contraction. Most effective single intervention (predicted 40% reduction in peak permeability). IL-10 is paradoxically low in fatal HPS cases.\n\nImmunosuppression: Reduces CTL expansion by 20%/day. Must be applied after viral clearance (day 6+) to avoid impairing anti-viral response.\n\nECMO: Directly reduces permeability but does not modify underlying immunopathology. Best as bridge therapy while IL-10 takes effect.\n\nCombined: Predicted to reduce peak permeability below 0.6 fatal threshold in the severe scenario.`},
    {title:"Mathematical framework",color:"#7fb3d3",body:`14-variable antigen-gated ODE system. All cytokine production terms multiply by g(I) = I/(I + Kₘ), an antigen gate that activates immune responses proportionally to infected cell load and shuts off when infection clears.\n\nSchur complement of the CTL–IFN-γ Jacobian: exact stability criterion — the storm loop becomes locally unstable when I > I*c = Kₘ/(R̃ᵢₚ − 1) ≈ 2.2 cells/μL. This threshold is crossed within hours of first infection. Outcome depends entirely on whether viral clearance terminates antigen exposure before CTL expansion becomes fatal.\n\nFull derivations including hypocoercivity proofs, Villani HWI inequality analysis, and Wasserstein stratification are in the accompanying medRxiv preprint.`},
  ];
  return <div className="flex flex-col gap-5">
    {sections.map(({title,color,body})=>(
      <div key={title} className="rounded-xl p-5" style={{background:"var(--surface)",border:"1px solid var(--border)"}}>
        <h3 style={{fontFamily:"Syne",fontWeight:700,fontSize:15,color,marginBottom:10}}>{title}</h3>
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
  const [alpha8,setAlpha8]=useState(5.0);
  const [logV0,setLogV0]=useState(3.0);
  const [sigma8,setSigma8]=useState(0.3);
  const [il10,setIl10]=useState(false);
  const [immuno,setImmuno]=useState(false);
  const [ecmo,setEcmo]=useState(false);
  const loadedRef=useRef(false);

  const analytics=useMemo(()=>{
    const d8=0.4,dg=0.8,pg=2.0,KM=50,T8s=12.5;
    const Rip=sigma8*pg/(d8*dg),Rtip=Rip*T8s,Ic=Rtip>1?KM/(Rtip-1):Infinity;
    return {Rip,Rtip,Ic,R0:0.3962};
  },[sigma8]);

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

      {/* Header */}
      <header style={{borderBottom:"1px solid var(--border)",background:"rgba(14,31,53,0.97)",backdropFilter:"blur(8px)",position:"sticky",top:0,zIndex:50}}>
        <div className="max-w-7xl mx-auto px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{...mono,fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--teal)"}}>xvirus.org</span>
              <span style={{color:"var(--border)"}}>·</span>
              <a href="https://quantum-proteins.ai" style={{...mono,fontSize:10,color:"var(--muted)"}} className="hover:text-white transition-colors">quantum-proteins.ai</a>
            </div>
            <h1 style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"var(--bright)",lineHeight:1.2}}>HPS Cytokine Storm Simulator</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {[["medRxiv preprint","https://www.medrxiv.org"],["Source code","https://github.com/quantumproteinsai/hps-cytokine-storm"]].map(([l,h])=>(
              <a key={l} href={h} target="_blank" rel="noreferrer"
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

      <main className="sim-grid max-w-7xl mx-auto px-5 py-6">

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

          {/* Parameters */}
          <Card>
            <p style={{...muted,marginBottom:16}}>Patient Parameters</p>
            <div className="flex flex-col gap-5">
              {[
                {label:<>α<sub>8</sub> — CTL recruitment</>,val:alpha8,set:setAlpha8,min:3,max:10,step:.1,disp:alpha8.toFixed(1),lo:"3 · moderate",hi:"10 · severe (HLA-B*35)"},
                {label:<>V₀ — Initial viral load</>,val:logV0,set:setLogV0,min:2,max:5,step:.1,disp:<>10<sup>{logV0.toFixed(1)}</sup> <span style={{fontSize:10,color:"var(--muted)"}}>copies/mL</span></>,lo:"10² low",hi:"10⁵ high"},
                {label:<>σ<sub>8</sub> — IFN-γ / CTL coupling</>,val:sigma8,set:setSigma8,min:.1,max:.6,step:.01,disp:sigma8.toFixed(2),lo:"0.10 low",hi:"0.60 hyperactive"},
              ].map(({label,val,set,min,max,step,disp,lo,hi},i)=>(
                <div key={i}>
                  <div className="flex justify-between items-baseline mb-2">
                    <label style={{...mono,fontSize:11,color:"var(--text)"}}>{label}</label>
                    <span style={{...mono,fontSize:13,color:"#22d3ee",fontWeight:600}}>{disp}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={val} onChange={e=>set(+e.target.value)}/>
                  <div className="flex justify-between mt-1">
                    <span style={{...mono,fontSize:9,color:"var(--muted)"}}>{lo}</span>
                    <span style={{...mono,fontSize:9,color:"var(--muted)"}}>{hi}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Interventions */}
          <Card>
            <p style={{...muted,marginBottom:12}}>Interventions <span style={{fontSize:10,letterSpacing:0,textTransform:"none",color:"var(--dim)"}}>(applied day 7)</span></p>
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

          {/* RUN BUTTON */}
          <button onClick={runSim} disabled={!isReady} className="run-btn">
            {phase==="running"?<><span className="spin" style={{marginRight:8}}>⟳</span>Simulating…</>:"▶  Run Simulation"}
          </button>

          {simError&&<div className="rounded-xl px-4 py-3" style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)"}}>
            <p style={{...mono,fontSize:10,color:"#f87171",marginBottom:4,fontWeight:600}}>Python error</p>
            <p style={{...mono,fontSize:9,color:"#fca5a5",wordBreak:"break-all",lineHeight:1.5}}>{simError}</p>
          </div>}

          {/* Analytics */}
          <Card>
            <p style={{...muted,marginBottom:14}}>Analytical (live)</p>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="ℛ₀"   value={analytics.R0.toFixed(3)} ok/>
              <Stat label="ℛ_ip" value={analytics.Rip.toFixed(3)} warn={analytics.Rip>1}/>
              <Stat label="R̃_ip" value={analytics.Rtip.toFixed(2)}/>
              <Stat label="I*c"  value={isFinite(analytics.Ic)?analytics.Ic.toFixed(2):"∞"} unit="cells/μL" warn={isFinite(analytics.Ic)&&analytics.Ic<5}/>
            </div>
            <div className="mt-4 flex flex-col gap-1">
              {[
                {c:"#34d399",t:"ℛ₀ < 1 → virus self-limits (always in HPS)"},
                {c:"#f87171",t:"ℛ_ip > 1 → storm attractor exists"},
                {c:"var(--muted)",t:"I*c = storm loop instability threshold"},
                {c:"var(--muted)",t:"Amber line = day-7 intervention window"},
              ].map(({c,t})=><p key={t} style={{...mono,fontSize:9,color:c,lineHeight:1.6}}>{t}</p>)}
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
            {result?(
              <div className="fade-in rounded-xl p-5 flex flex-col sm:flex-row gap-5 justify-between" style={{background:"var(--surface)",border:"1px solid var(--border)"}}>
                <div className="flex flex-col gap-1">
                  <span style={{...muted}}>Predicted Outcome</span>
                  <span className={outcomeClass} style={{fontFamily:"Syne",fontWeight:800,fontSize:32,lineHeight:1}}>{result.outcome}</span>
                  <span style={{...mono,fontSize:11,color:"var(--muted)",marginTop:4}}>
                    P<sub>peak</sub> = {result.Ppk.toFixed(3)}{" "}
                    <span style={{color:result.Ppk>=.6?"#f87171":result.Ppk>=.2?"#fbbf24":"#34d399"}}>
                      ({result.Ppk>=.6?"≥ fatal 0.6":result.Ppk>=.2?"≥ severe 0.2":"below thresholds"})
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Stat label="T₈ peak"      value={result.T8pk.toFixed(0)} unit="cells/μL" warn={result.T8pk>500}/>
                  <Stat label="Viral clear"   value={result.Vclear.toFixed(1)} unit="d" ok/>
                  <Stat label="Ŵ peak"        value={result.Wpk.toFixed(2)} warn={result.Wpk>6}/>
                  <Stat label="Early warning" value={result.wday!=null?`day ${result.wday}`:"none"} ok={result.wday!=null}/>
                </div>
              </div>
            ):(
              <div className="rounded-xl p-8 flex items-center justify-center" style={{background:"var(--surface)",border:"1px solid var(--border)",minHeight:90}}>
                <p style={{...mono,fontSize:12,color:"var(--dim)"}}>
                  {phase==="loading"?"Waiting for Python engine…":"Set parameters and click ▶ Run Simulation."}
                </p>
              </div>
            )}

            {/* Charts */}
            {result&&<div className="grid grid-cols-1 md:grid-cols-2 gap-5 fade-in">
              <Card>
                <div className="flex justify-between items-baseline mb-3">
                  <p style={{...muted}}>Wasserstein Score <span style={{opacity:.6,textTransform:"none",letterSpacing:0}}>Ŵ(t)</span></p>
                  <span style={{...mono,fontSize:9,color:"var(--dim)"}}>days</span>
                </div>
                <LineChart values={result.W} times={result.t} yMax={Math.max(result.Wpk*1.15,4)} color="#22d3ee"
                  thresholds={[{v:2.5,c:"#fbbf24",label:"alert"},{v:6,c:"#f87171",label:"critical"}]}/>
                <p style={{...mono,fontSize:9,color:"var(--muted)",marginTop:6,lineHeight:1.5}}>Plateau 1–2 days before P crosses clinical threshold.</p>
              </Card>

              <Card>
                <div className="flex justify-between items-baseline mb-3">
                  <p style={{...muted}}>Vascular Permeability <span style={{opacity:.6,textTransform:"none",letterSpacing:0}}>P(t)</span></p>
                </div>
                <LineChart values={result.P} times={result.t} yMax={Math.max(result.Ppk*1.2,.8)} color="#f87171"
                  thresholds={[{v:.2,c:"#fbbf24",label:"severe"},{v:.6,c:"#ef4444",label:"fatal"}]}/>
                <p style={{...mono,fontSize:9,color:"var(--muted)",marginTop:6}}>VEGF-driven capillary leak. Fatal if peak &gt; 0.6.</p>
              </Card>

              <Card>
                <p style={{...muted,marginBottom:12}}>CD8⁺ CTL <span style={{opacity:.6,textTransform:"none",letterSpacing:0}}>T₈(t) · cells/μL</span></p>
                <LineChart values={result.T8} times={result.t} yMax={Math.max(result.T8pk*1.15,100)} color="#60a5fa"
                  thresholds={[{v:240,c:"#fbbf24",label:"Lindgren 2011 peak"}]}/>
                <p style={{...mono,fontSize:9,color:"var(--muted)",marginTop:6}}>CTL storm peak drives permeability via IFN-γ loop.</p>
              </Card>

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
                    yMax={Math.max(...result.Fg,...result.L6,...result.L10)*1.15+1} color="#22d3ee" height={140}/>
                  <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
                    <svg viewBox="0 0 560 140" style={{width:"100%",height:140}} className="overflow-visible">
                      {(()=>{
                        const yMax=Math.max(...result.Fg,...result.L6,...result.L10)*1.15+1;
                        const pw=560-46-14,ph=140-8-26;
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
                <p style={{...mono,fontSize:9,color:"var(--muted)",marginTop:6}}>Low IL-10 in severe HPS = failed regulatory brake.</p>
              </Card>

              <Card className="md:col-span-2">
                <p style={{...muted,marginBottom:12}}>Platelet count <span style={{opacity:.6,textTransform:"none",letterSpacing:0}}>Π(t) — % of baseline</span></p>
                <LineChart values={result.Pi} times={result.t} yMax={110} height={100} color="#a78bfa"
                  thresholds={[{v:50,c:"#fbbf24",label:"thrombocytopaenia"}]}/>
              </Card>
            </div>}

            {/* Guidance */}
            <div className="rounded-xl p-5" style={{background:"rgba(34,211,238,0.04)",border:"1px solid rgba(34,211,238,0.12)"}}>
              <p style={{...mono,fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",color:"#22d3ee",opacity:.7,marginBottom:12}}>
                Clinical guidance — MV Hondius ANDV patients
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {c:"#22d3ee",title:"Days 1–4 · Prodrome",body:"Monitor daily: CD8⁺, IL-6, IL-10, platelets, chest X-ray. Compute Ŵ(t). Escalate if Ŵ > 2.5."},
                  {c:"#fbbf24",title:"Days 5–9 · Intervention window",body:"IL-10 analogue + reduced-dose IS + ECMO bridge predicted to reduce Ppeak below 0.6 fatal threshold."},
                  {c:"var(--muted)",title:"Antivirals",body:"ℛ₀ < 1 → virus self-limits by day 5–6 in all scenarios. Resources should be redirected to immunomodulation."},
                ].map(({c,title,body})=>(
                  <div key={title}>
                    <p style={{...mono,fontSize:10,color:c,marginBottom:5,fontWeight:600}}>{title}</p>
                    <p style={{...mono,fontSize:10,color:"var(--muted)",lineHeight:1.7}}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {activeTab==="guide"&&<GuideTab/>}
        </section>
      </main>
    </div>
  );
}
