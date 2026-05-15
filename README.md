# HPS Cytokine Storm Simulator

[![Live](https://img.shields.io/badge/live-xvirus.org-22d3ee?style=flat-square)](https://xvirus.org)
[![Triage](https://img.shields.io/badge/triage-xvirus.org%2Ftriage-f87171?style=flat-square)](https://xvirus.org/triage)
[![medRxiv](https://img.shields.io/badge/preprint-medRxiv-b31b1b?style=flat-square)](https://www.medrxiv.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-34d399?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)

Real-time mathematical simulation of Hantavirus Pulmonary Syndrome (HPS)
immunopathology. Built in response to the **2026 Andes hantavirus outbreak**
(MV Hondius cruise ship — 7 confirmed cases, 3 deaths, 6 countries).

> **Mercier des Rochettes, B. (2026).** *Cytokine storm dynamics in hantavirus
> pulmonary syndrome: a multiscale ODE model with Wasserstein early-warning score
> and application to the 2026 Andes virus outbreak.* medRxiv preprint.

---

## Two interfaces

| | URL | Audience |
|---|---|---|
| Research simulator | [xvirus.org](https://xvirus.org) | Researchers, infectious disease specialists |
| Clinical triage | [xvirus.org/triage](https://xvirus.org/triage) | Clinicians at the bedside |

**Research simulator** — parameter sliders (α₈, V₀, σ₈), intervention toggles
(IL-10 / IS / ECMO), six simulation charts, reproduction numbers (ℛ₀, ℛᵢₚ, I*c),
"How It Works" explanatory tab.

**Clinical triage** — enter day of illness, CD8⁺ count, IL-6, IL-10, platelets,
chest X-ray score (all in standard clinical units). Output: HPS Storm Risk Score
(0–10) with traffic-light stratification, clinical recommendation, and 14-day
forward trajectory projection initialised from the patient's actual values.

---

## Key results

| Quantity | Value | Interpretation |
|---------|-------|---------------|
| ℛ₀ | 0.396 | Virus self-limits — HPS is not antiviral resistance |
| ℛᵢₚ | 1.875 | CTL–IFN-γ storm attractor exists |
| I*c | 2.23 cells/μL | Storm loop destabilises at negligible infection level |
| Spectral gap | → 0 at I*c | Schur complement proof of storm inevitability |
| IL-10 supplementation | −40% P_peak | Highest-impact single intervention |
| Combined therapy at day 7 | P_peak < 0.6 | Predicted to prevent fatal outcome |

---

## Architecture
