# HPS Cytokine Storm Simulator

**Live at [xvirus.org](https://xvirus.org)**

Real-time mathematical simulation of Hantavirus Pulmonary Syndrome (HPS) immunopathology, with a clinician-facing triage tool at [xvirus.org/triage](https://xvirus.org/triage).

Built in response to the **2026 Andes hantavirus outbreak** (MV Hondius cruise ship, April–May 2026, 7 confirmed cases, 3 deaths across 6 countries).

---

## What this is

A Next.js 16 web application that runs a **14-variable antigen-gated ODE model** of HPS cytokine storm entirely in the browser, using [Pyodide](https://pyodide.org) (Python/WebAssembly). No backend server required.

The mathematical framework is described in:

> Mercier des Rochettes, B. (2026). *Cytokine storm dynamics in hantavirus pulmonary syndrome: a multiscale ODE model with Wasserstein early-warning score and application to the 2026 Andes virus outbreak.* medRxiv preprint.

---

## Two interfaces

### `xvirus.org` — Research simulator
For researchers and infectious disease specialists. Three clinical dropdowns (HLA genotype, viral exposure intensity, immune reactivity) map to the underlying parameters (α₈, V₀, σ₈). Simulation runs automatically on each selection — no Run button. Six simulation charts, clinical summary panel, interventions (IL-10 / IS / ECMO from day 7 of illness). Includes a "How It Works" tab in plain clinical language.

### `xvirus.org/triage` — Clinical triage tool
For clinicians at the bedside. Inputs: day of illness, CD8⁺ count, IL-6, IL-10, platelets, chest X-ray score — all in standard clinical units. Outputs: live HPS Storm Risk Score (0–10) with traffic-light stratification, actionable clinical recommendation, and 14-day forward projection initialised from the patient's actual values.

---

## Key results

| Quantity | Value | Meaning |
|---------|-------|---------|
| ℛ₀ | 0.396 | Virus self-limits — HPS is not antiviral resistance |
| ℛᵢₚ | 1.875 | CTL–IFN-γ storm attractor exists |
| I*c | 2.23 cells/μL | Storm loop destabilises at negligible infection level |
| λ* collapse | → 0 at I*c | Spectral gap proof of cytokine storm inevitability |
| IL-10 sensitivity | μ* = 0.82 | Highest-impact parameter in sensitivity analysis |
| Day 7 of illness | Intervention window | Prodrome-to-cardiopulmonary transition |

---

## Architecture

```
app/
├── page.tsx          # Research simulator (Pyodide + 14-variable ODE)
├── triage/
│   └── page.tsx      # Clinical triage tool (live JS score + Pyodide projection)
├── layout.tsx        # Metadata, Google Fonts
└── globals.css       # Dark scientific theme, slider styles, traffic lights
```

Python runs via [Pyodide](https://pyodide.org) (v0.27.0) with NumPy and SciPy loaded from CDN. The ODE is solved with `scipy.integrate.solve_ivp` using the LSODA method. First load takes ~20 seconds (browser caches thereafter).

---

## Installation

```bash
git clone https://github.com/quantumproteinsai/hps-cytokine-storm.git
cd hps-cytokine-storm
npm install
npm run dev
```

For production deployment on a VPS (see `DEPLOY.md`):

```bash
npm run build
pm2 start npm --name xvirus -- start -- --port 3000
```

---

## The ODE model

The 14-variable system tracks:

| Layer | Variables |
|-------|-----------|
| Viral | Uninfected endothelium (E), infected endothelium (I), virions (V) |
| Immune | CD8⁺ CTL (T₈), CD4⁺ helper T (T₄), macrophages (Mφ) |
| Cytokines | TNF-α (F₁), IFN-γ (Fγ), IL-12 (N), IL-6 (L₆), IL-10 (L₁₀), VEGF (Vf) |
| Vascular | Permeability index (P), platelets (Π) |

All cytokine production terms are multiplied by the antigen gate g(I) = I/(I + KM), ensuring the immune response activates proportionally to infected cell load and terminates on viral clearance.

The two mechanistically central equations are:

```
dT₈/dt = s₈ + α₈·(T₄·I)/(I+K₈)·g(I) + σ₈·Fγ·T₈·(1 − 0.4·L₁₀/(L₁₀+K₁₀)) − d₈·T₈ − μ₈·T₈²
dFγ/dt = (pγ·T₈ + qγ·T₄)·g(I) − dγ·Fγ
```

The IL-10 term `(1 − 0.4·L₁₀/(L₁₀+K₁₀))` in the T₈ equation is the immune brake: low IL-10 (as seen in fatal HPS) removes this suppression and allows unchecked CTL amplification.

The Schur complement of the storm-block Jacobian proves this feedback loop becomes locally unstable when I > I*c = KM/(R̃ᵢₚ − 1) = 2.23 cells/μL — a threshold crossed within hours of any detectable infection.

**Current model limitation:** vascular permeability P(t) is driven only by VEGF from infected cells (Vf ← kVf·I·g). A CTL-mediated VEGF pathway (representing direct immune killing of infected endothelium) is needed to reproduce the observed delayed permeability peak at days 7–10 and to validate the intervention timing. This extension is in preparation for the companion paper.

---

## Storm Risk Score

Two related scores are used:

**Mathematical score Ŵ(t)** — used in the theoretical proofs (HWI inequality, spectral gap bound). Computed from DFE reference values; unbounded.

**Clinical score Ŵ_clin(t) ∈ [0,10]** — bedside approximation computed from six routine ICU measurements:

```
Ŵ = 2·clip((CD8−500)/800, 0,1)   # CTL excess
  + 2·clip(IL6/50, 0,1)            # IL-6 elevation
  + 2·clip(1−IL10/20, 0,1)         # IL-10 deficit (inverted)
  + 2·(CXR/3)                       # radiologic infiltrate
  + 2·clip(1−plt/150, 0,1)         # thrombocytopaenia
```

Thresholds: < 1.5 (low) · 1.5–4 (moderate) · 4–7 (high) · > 7 (critical)

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

## Licence

MIT — open for research use, adaptation, and clinical translation.

**Disclaimer:** Research tool only. Not validated for clinical decision-making. All outputs are model predictions based on calibrated but uncertain parameters. Consult infectious disease specialists for patient management.
