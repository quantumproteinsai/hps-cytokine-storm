import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "xvirus.org — HPS Cytokine Storm Simulator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: "linear-gradient(135deg, #0e1f35 0%, #142840 60%, #0a1929 100%)",
          display: "flex", flexDirection: "column",
          padding: "60px 70px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <div key={f} style={{
            position: "absolute",
            left: 0, right: 0,
            top: f * 630,
            height: 1,
            background: "rgba(34,211,238,0.06)",
          }} />
        ))}

        {/* Active outbreak badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 32,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#f87171",
          }} />
          <span style={{
            fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase",
            color: "#f87171", fontWeight: 600,
          }}>
            Active outbreak — Andes hantavirus 2026
          </span>
        </div>

        {/* Domain */}
        <div style={{
          fontSize: 14, letterSpacing: "0.25em", textTransform: "uppercase",
          color: "#22d3ee", marginBottom: 16, fontWeight: 600,
        }}>
          xvirus.org
        </div>

        {/* Title */}
        <div style={{
          fontSize: 54, fontWeight: 800, lineHeight: 1.1,
          color: "#f0f8ff", marginBottom: 24, maxWidth: 700,
        }}>
          HPS Cytokine Storm Simulator
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 20, color: "#7fb3d3", lineHeight: 1.5,
          maxWidth: 620, marginBottom: 48,
        }}>
          14-variable ODE model · Wasserstein storm risk score · Clinical triage tool
        </div>

        {/* Key numbers row */}
        <div style={{ display: "flex", gap: 40 }}>
          {[
            { label: "ℛ₀", value: "0.396", sub: "Virus self-limits", color: "#34d399" },
            { label: "ℛᵢₚ", value: "1.875", sub: "Storm attractor", color: "#f87171" },
            { label: "I*c", value: "2.23", sub: "cells/μL threshold", color: "#22d3ee" },
            { label: "IL-10", value: "−40%", sub: "Top intervention", color: "#a78bfa" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#7fb3d3", textTransform: "uppercase" }}>{label}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
              <span style={{ fontSize: 11, color: "#4a7a9b" }}>{sub}</span>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 4,
          background: "linear-gradient(90deg, #22d3ee, #0891b2, #1d4ed8)",
        }} />

        {/* Right side: simulated chart lines */}
        <div style={{
          position: "absolute", right: 70, top: 120, bottom: 80,
          width: 280, display: "flex", alignItems: "flex-end",
          opacity: 0.18,
        }}>
          <svg viewBox="0 0 280 300" width={280} height={300}>
            {/* Recovery curve */}
            <path d="M0,280 C20,270 40,200 80,120 C120,40 160,30 280,60"
              stroke="#34d399" strokeWidth="3" fill="none" />
            {/* Fatal curve */}
            <path d="M0,280 C20,260 50,180 90,80 C130,-20 200,0 280,0"
              stroke="#f87171" strokeWidth="3" fill="none" />
            {/* W score */}
            <path d="M0,280 C20,275 50,240 80,180 C110,120 160,90 280,100"
              stroke="#22d3ee" strokeWidth="2" fill="none" strokeDasharray="6,4" />
          </svg>
        </div>
      </div>
    ),
    { ...size }
  );
}
