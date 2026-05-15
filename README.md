# HPS Cytokine Storm Simulator

[![Live](https://img.shields.io/badge/live-xvirus.org-22d3ee?style=flat-square)](https://xvirus.org)
[![Triage](https://img.shields.io/badge/triage-xvirus.org%2Ftriage-f87171?style=flat-square)](https://xvirus.org/triage)
[![medRxiv](https://img.shields.io/badge/preprint-medRxiv-b31b1b?style=flat-square)](https://www.medrxiv.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-34d399?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)

Real-time mathematical simulation of Hantavirus Pulmonary Syndrome (HPS) immunopathology, with a clinician-facing triage tool. Built in response to the **2026 Andes hantavirus outbreak** (MV Hondius cruise ship — 7 confirmed cases, 3 deaths, 6 countries).

> **Mercier des Rochettes, B. (2026).** *Cytokine storm dynamics in hantavirus pulmonary syndrome: a multiscale ODE model with Wasserstein early-warning score and application to the 2026 Andes virus outbreak.* medRxiv preprint.

---

## Two interfaces

| | URL | Audience |
|---|---|---|
| Research simulator | [xvirus.org](https://xvirus.org) | Researchers, infectious disease specialists |
| Clinical triage | [xvirus.org/triage](https://xvirus.org/triage) | Clinicians at the bedside |

**Research simulator** — parameter sliders (α₈, V₀, σ₈), intervention toggles (IL-10 / IS / ECMO at day 7), six simulation charts, analytical reproduction numbers (ℛ₀, ℛᵢₚ, I*c), and a "How It Works" explanatory tab.

**Clinical triage** — enter day of illness, CD8⁺ count, IL-6, IL-10, platelets, and chest X-ray score in standard clinical units. Output: HPS Storm Risk Score (0–10) with traffic-light stratification, actionable clinical recommendation, and 14-day forward trajectory projection initialised from the patient's actual values.

---

## Key results

| Quantity | Value | Interpretation |
|---------|-------|----------------|
| ℛ₀ | 0.396 | Virus self-limits — HPS outcome is not determined by viral load |
| ℛᵢₚ | 1.875 | CTL–IFN-γ storm attractor exists |
| I*c | 2.23 cells/μL | Storm loop destabilises at negligible infection level |
| Spectral gap | → 0 at I*c | Schur complement proof of storm inevitability |
| IL-10 supplementation | −40% P_peak | Highest-impact single intervention |
| Combined therapy at day 7 | P_peak < 0.6 | Predicted to prevent fatal outcome |

---

## Architecture

```
app/
├── page.tsx                # Research simulator (Pyodide + 14-variable ODE)
├── triage/
│   ├── page.tsx            # Clinical triage tool (live JS score + Pyodide projection)
│   └── layout.tsx          # SEO: MedicalWebPage JSON-LD schema
├── layout.tsx              # Global metadata, JSON-LD, Google Fonts
├── globals.css             # Dark scientific theme, sliders, traffic lights
├── opengraph-image.tsx     # Dynamic OG image (edge runtime, 1200×630)
├── sitemap.ts              # Generates /sitemap.xml
└── robots.ts               # Generates /robots.txt
```

Python runs via [Pyodide](https://pyodide.org) v0.27.0 (NumPy + SciPy) compiled to WebAssembly — **no backend server required**. The ODE is solved with `scipy.integrate.solve_ivp` using the LSODA method. First browser load takes ~20 s; subsequent loads are cached.

---

## Quick start

```bash
git clone https://github.com/quantumproteinsai/hps-cytokine-storm.git
cd hps-cytokine-storm
npm install
npm run dev        # → http://localhost:3000
```

Production deployment on a VPS:

```bash
npm run build
pm2 start npm --name xvirus -- start -- --port 3000
```

See [`DEPLOY.md`](DEPLOY.md) for full Nginx reverse proxy and Certbot HTTPS configuration.

---

## The ODE model

14 coupled differential equations across three biological layers:

| Layer | Variables |
|-------|-----------|
| Viral | E — uninfected pulmonary endothelium · I — infected endothelium · V — virions |
| Immune | T₈ — CD8⁺ CTL · T₄ — CD4⁺ helper T · Mφ — macrophages |
| Cytokines | TNF-α (F₁) · IFN-γ (Fγ) · IL-12 (N) · IL-6 (L₆) · IL-10 (L₁₀) · VEGF (Vf) |
| Vascular | P — permeability index · Π — platelets |

The key innovation is the **antigen gate** g(I) = I / (I + K_M): all cytokine production terms are multiplied by g(I), ensuring immune activation is proportional to infected cell load and terminates on viral clearance. This makes the disease-free equilibrium well-posed and biologically grounded.

### The storm mechanism

The CTL–IFN-γ positive feedback loop drives cytokine storm:

- IFN-γ promotes CTL survival and expansion: `σ₈ · Fγ · T₈`
- CTLs produce IFN-γ proportional to antigen: `pγ · T₈ · g(I)`

The Schur complement of the storm-block Jacobian J_storm(I) provides an exact stability criterion: the loop becomes locally unstable when **I > I*c = K_M / (R̃ᵢₚ − 1) = 2.23 cells/μL** — a threshold crossed within hours of any detectable infection. Outcome is determined entirely by whether viral clearance (ℛ₀ < 1) terminates antigen exposure before the CTL expansion reaches a lethal level.

### Dual reproduction numbers

| Number | Formula | Role |
|--------|---------|------|
| ℛ₀ = 0.396 | βρE* / (a₁₁c) | Viral invasion — always < 1 in HPS; virus self-limits |
| ℛᵢₚ = 1.875 | σ₈pγ / (d₈dγ) | Immunopathological loop gain — > 1 means storm attractor exists |

These two numbers are **independent**: ℛ₀ < 1 kills the virus by day 5–6 in every scenario, while ℛᵢₚ > 1 means the immune response outlives it. This is the mathematical explanation for why HPS kills after viral clearance.

---

## Storm Risk Score

Computed in real time from six routine ICU measurements — no simulation required:

```
Ŵ = 2 · clip((CD8 − 500) / 800,  0, 1)   # CTL excess above normal
  + 2 · clip(IL-6 / 50,           0, 1)   # IL-6 elevation
  + 2 · clip(1 − IL-10 / 20,      0, 1)   # IL-10 deficit (inverted — low is bad)
  + 2 · (CXR / 3)                          # Chest X-ray infiltrate score
  + 2 · clip(1 − platelets / 150, 0, 1)   # Thrombocytopaenia
```

| Score | Risk level | Recommended action |
|-------|-----------|-------------------|
| < 1.5 | **Low** | Standard monitoring. Repeat assessment in 24 h. |
| 1.5–4 | **Moderate** | Escalate to HDU. Daily cytokine panel. |
| 4–7 | **High** | ICU transfer. Consider IL-10 supplementation. |
| > 7 | **Critical** | Immediate full intervention: IL-10 + IS + ECMO. |

The score updates live in the browser as values are entered. A plateau or rise above 2.5 on day 3–4 predicts clinical deterioration 1–2 days ahead.

---

## Therapeutic implications

Interventions are applied at **day 7** — the predicted inflection point between viral clearance and peak CTL expansion.

| Intervention | Mechanism | Predicted P_peak reduction |
|-------------|-----------|--------------------------|
| IL-10 supplement (+3 pg/mL/d) | Suppresses TNF-α, reduces VEGF, promotes CTL contraction | −40% |
| Immunosuppression (−20% CTL/d) | Slows CTL expansion after viral clearance | −35% |
| ECMO (−40% P/d) | Direct permeability reduction; bridge therapy | −25% |
| Combined (reduced doses) | All three simultaneously | P_peak < 0.6 fatal threshold |

**Why antivirals do not help:** ℛ₀ < 1 means the virus self-limits by day 5–6 in every scenario. The outcome is determined by the immunopathological axis, not viral replication.

---

## Citation

```bibtex
@article{mercierdesrochettes2026hps,
  author  = {Mercier des Rochettes, Bertrand},
  title   = {Cytokine storm dynamics in hantavirus pulmonary syndrome:
             a multiscale {ODE} model with {W}asserstein early-warning score
             and application to the 2026 {A}ndes virus outbreak},
  journal = {medRxiv},
  year    = {2026},
  note    = {Preprint},
  url     = {https://www.medrxiv.org}
}
```

---

## Author

**Bertrand Mercier des Rochettes**  
Quantum Proteins AI, Cergy-Pontoise, France  
[quantum-proteins.ai](https://quantum-proteins.ai)

---

## Licence

MIT — open for research use, adaptation, and clinical translation.

**Disclaimer:** Research tool only. Not validated for clinical decision-making. All outputs are model predictions based on calibrated but uncertain parameters. Consult infectious disease specialists for patient management decisions.
