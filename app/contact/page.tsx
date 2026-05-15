"use client";

const mono: React.CSSProperties = { fontFamily: "IBM Plex Mono" };

export default function ContactPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0e1f35", color: "#deeaf6" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #214060", background: "rgba(14,31,53,0.97)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
              <a href="/" style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#22d3ee", textDecoration: "none" }}>
                ← Back to Simulator
              </a>
              <span style={{ color: "#214060" }}>·</span>
              <a href="/triage" style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7fb3d3", textDecoration: "none" }}>
                Patient Triage
              </a>
            </div>
            <h1 style={{ fontFamily: "Oxanium", fontWeight: 800, fontSize: 18, color: "#f0f8ff", lineHeight: 1.2 }}>
              Contact
            </h1>
          </div>
          <span style={{ ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#22d3ee" }}>
            xvirus.org
          </span>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Author card */}
        <div style={{ background: "#152b45", border: "1px solid #214060", borderRadius: 16, padding: "32px 36px", display: "flex", flexDirection: "column", gap: 20 }}>

          <div>
            <h2 style={{ fontFamily: "Oxanium", fontWeight: 700, fontSize: 22, color: "#f0f8ff", marginBottom: 4 }}>
              Bertrand Mercier des Rochettes
            </h2>
            <p style={{ ...mono, fontSize: 12, color: "#7fb3d3" }}>
              Quantum Proteins AI · Cergy-Pontoise, France
            </p>
          </div>

          <p style={{ ...mono, fontSize: 13, color: "#deeaf6", lineHeight: 1.8 }}>
            I am an independent researcher in mathematical physics and molecular medicine.
            This simulator and the accompanying medRxiv preprint were developed in response
            to the 2026 Andes hantavirus outbreak.
          </p>

          {/* Contact links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                icon: "✉",
                label: "Email",
                value: "contact@quantum-proteins.ai",
                href: "mailto:contact@quantum-proteins.ai",
                color: "#22d3ee",
              },
              {
                icon: "⟁",
                label: "ORCID",
                value: "0000-0002-1145-1881",
                href: "https://orcid.org/0000-0002-1145-1881",
                color: "#34d399",
              },
              {
                icon: "⌥",
                label: "GitHub",
                value: "quantumproteinsai/hps-cytokine-storm",
                href: "https://github.com/quantumproteinsai/hps-cytokine-storm",
                color: "#a78bfa",
              },
              {
                icon: "◈",
                label: "Research",
                value: "quantum-proteins.ai",
                href: "https://quantum-proteins.ai",
                color: "#7fb3d3",
              },
            ].map(({ icon, label, value, href, color }) => (
              <a key={label} href={href}
                target={href.startsWith("mailto") ? undefined : "_blank"}
                rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                  background: "#0e1f35", border: "1px solid #214060", borderRadius: 10,
                  textDecoration: "none", transition: "border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#214060")}>
                <span style={{ fontSize: 16, color, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ ...mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#4a7a9b" }}>{label}</span>
                  <span style={{ ...mono, fontSize: 12, color }}>{value}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* What I welcome */}
        <div style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.12)", borderRadius: 16, padding: "28px 32px" }}>
          <h3 style={{ fontFamily: "Oxanium", fontWeight: 700, fontSize: 15, color: "#22d3ee", marginBottom: 16 }}>
            I welcome messages about
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Clinical questions about specific HPS patient scenarios",
              "Model validation data — cohort measurements to calibrate against",
              "Discrepancies between model predictions and clinical observations",
              "Collaboration proposals from infectious disease teams",
              "Technical questions about the ODE system or the simulator code",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#22d3ee", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
                <span style={{ ...mono, fontSize: 12, color: "#deeaf6", lineHeight: 1.6 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.12)", borderRadius: 16, padding: "20px 28px" }}>
          <h3 style={{ fontFamily: "Oxanium", fontWeight: 700, fontSize: 13, color: "#f87171", marginBottom: 10 }}>
            Medical disclaimer
          </h3>
          <p style={{ ...mono, fontSize: 11, color: "#7fb3d3", lineHeight: 1.8 }}>
            This tool is a research prototype and is not validated for clinical decision-making.
            All outputs are mathematical model predictions based on calibrated but uncertain parameters.
            For medical emergencies or patient management decisions, contact your hospital infectious
            disease team or national public health authority.
          </p>
        </div>

        {/* Citation */}
        <div style={{ background: "#152b45", border: "1px solid #214060", borderRadius: 12, padding: "20px 24px" }}>
          <p style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4a7a9b", marginBottom: 10 }}>
            Cite this work
          </p>
          <p style={{ ...mono, fontSize: 11, color: "#7fb3d3", lineHeight: 1.8 }}>
            Mercier des Rochettes, B. (2026). Cytokine storm dynamics in hantavirus pulmonary
            syndrome: a multiscale ODE model with Wasserstein early-warning score and application
            to the 2026 Andes virus outbreak. <em style={{ color: "#deeaf6" }}>medRxiv</em>.
            {" · "}
            <a href="https://github.com/quantumproteinsai/hps-cytokine-storm"
              target="_blank" rel="noreferrer"
              style={{ color: "#22d3ee", textDecoration: "none" }}>
              github.com/quantumproteinsai/hps-cytokine-storm
            </a>
          </p>
        </div>

      </main>
    </div>
  );
}
