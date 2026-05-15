import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HPS Patient Triage Tool — xvirus.org";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TriageOGImage() {
  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630,
        background: "linear-gradient(135deg, #0e1f35 0%, #142840 100%)",
        display: "flex", flexDirection: "column",
        padding: "60px 70px",
        fontFamily: "sans-serif",
        position: "relative",
      }}>
        {/* Triage badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 28,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171" }} />
          <div style={{
            fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase",
            color: "#f87171", fontWeight: 700,
            background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)",
            padding: "3px 12px", borderRadius: 4,
          }}>
            Triage Mode
          </div>
          <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#22d3ee" }}>
            xvirus.org
          </span>
        </div>

        {/* Title */}
        <div style={{ fontSize: 50, fontWeight: 800, color: "#f0f8ff", lineHeight: 1.15, marginBottom: 20, maxWidth: 680 }}>
          HPS Patient Risk Assessment
        </div>

        <div style={{ fontSize: 18, color: "#7fb3d3", marginBottom: 50, maxWidth: 600, lineHeight: 1.5 }}>
          Enter routine lab values → Storm Risk Score (0–10) → 14-day trajectory projection
        </div>

        {/* Input labels */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "CD8⁺ T cells", unit: "cells/μL", color: "#60a5fa" },
            { label: "IL-6", unit: "pg/mL", color: "#22d3ee" },
            { label: "IL-10", unit: "pg/mL", color: "#34d399" },
            { label: "Platelets", unit: "×10³/μL", color: "#a78bfa" },
            { label: "Chest X-ray", unit: "0–3", color: "#fbbf24" },
          ].map(({ label, unit, color }) => (
            <div key={label} style={{
              display: "flex", flexDirection: "column", gap: 4,
              background: "rgba(255,255,255,0.04)", border: "1px solid #214060",
              borderRadius: 8, padding: "10px 16px",
            }}>
              <span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#7fb3d3", textTransform: "uppercase" }}>{label}</span>
              <span style={{ fontSize: 22, fontWeight: 700, color }}> </span>
              <span style={{ fontSize: 10, color: "#2d5070" }}>{unit}</span>
            </div>
          ))}

          {/* Arrow */}
          <div style={{ display: "flex", alignItems: "center", fontSize: 28, color: "#22d3ee", padding: "0 8px" }}>→</div>

          {/* Risk score display */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 12, padding: "12px 24px", gap: 4,
          }}>
            <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "#f87171", textTransform: "uppercase" }}>Risk Score</span>
            <span style={{ fontSize: 36, fontWeight: 900, color: "#f87171", lineHeight: 1 }}>7.4</span>
            <span style={{ fontSize: 12, color: "#f87171", fontWeight: 700 }}>CRITICAL</span>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 4,
          background: "linear-gradient(90deg, #f87171, #fbbf24, #22d3ee)",
        }} />
      </div>
    ),
    { ...size }
  );
}
