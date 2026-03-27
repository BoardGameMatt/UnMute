import { useState } from "react";

const COLORS = {
  navy: "#1B3A5C",
  deepNavy: "#0F2440",
  steelBlue: "#4A6080",
  amber: "#F5A623",
  gold: "#FFCC33",
  warmWhite: "#FAF8F5",
  slate: "#6B7B8D",
  charcoal: "#2D3436",
  cloudGrey: "#E8ECEF",
  signalRed: "#E85D4A",
};

// Simulated participants
const participants = [
  { name: "Sarah K.", initials: "SK", color: "#E8D5C4" },
  { name: "Marcus J.", initials: "MJ", color: "#C4D5E8" },
  { name: "Priya R.", initials: "PR", color: "#D5E8C4" },
  { name: "David L.", initials: "DL", color: "#E8C4D5" },
  { name: "Anya T.", initials: "AT", color: "#D5C4E8" },
];

// ============================================
// SECTION 1: Typography & Color
// ============================================
function TypographySection() {
  return (
    <div style={{ padding: "48px 40px", background: COLORS.warmWhite }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: COLORS.amber,
            marginBottom: 8,
          }}
        >
          TYPOGRAPHY SYSTEM
        </p>
        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 42,
            fontWeight: 700,
            color: COLORS.deepNavy,
            lineHeight: 1.15,
            marginBottom: 16,
          }}
        >
          The type does the
          <br />
          heavy lifting.
        </h1>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 17,
            lineHeight: 1.7,
            color: COLORS.charcoal,
            maxWidth: 540,
            marginBottom: 32,
          }}
        >
          Outfit commands attention without shouting. DM Mono signals precision
          and protocol. Inter stays out of the way for everything else. The
          hierarchy is clear at a glance — exactly like a well-prepared
          workshop table.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
          }}
        >
          {[
            {
              label: "HEADLINES",
              font: "'Outfit', sans-serif",
              weight: 700,
              sample: "Build belonging",
              size: 28,
            },
            {
              label: "PROTOCOL LABELS",
              font: "'DM Mono', monospace",
              weight: 300,
              sample: "PROTOCOL 04",
              size: 14,
              tracking: "0.2em",
              upper: true,
            },
            {
              label: "BODY TEXT",
              font: "'Inter', sans-serif",
              weight: 400,
              sample: "Teams thrive when trust is habituated, not mandated.",
              size: 15,
            },
          ].map((t, i) => (
            <div
              key={i}
              style={{
                padding: 20,
                background: "white",
                borderRadius: 8,
                border: `1px solid ${COLORS.cloudGrey}`,
              }}
            >
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: COLORS.slate,
                  marginBottom: 12,
                }}
              >
                {t.label}
              </p>
              <p
                style={{
                  fontFamily: t.font,
                  fontSize: t.size,
                  fontWeight: t.weight,
                  color: COLORS.deepNavy,
                  letterSpacing: t.tracking || "normal",
                  textTransform: t.upper ? "uppercase" : "none",
                  lineHeight: 1.5,
                }}
              >
                {t.sample}
              </p>
            </div>
          ))}
        </div>

        {/* Color palette */}
        <div style={{ marginTop: 40 }}>
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: COLORS.slate,
              marginBottom: 16,
            }}
          >
            60 / 30 / 10 COLOR RATIO
          </p>
          <div style={{ display: "flex", gap: 3, borderRadius: 8, overflow: "hidden", height: 48 }}>
            <div style={{ flex: 6, background: COLORS.warmWhite, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: COLORS.slate }}>60% WARM WHITE</span>
            </div>
            <div style={{ flex: 3, background: COLORS.navy, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "white" }}>30% NAVY</span>
            </div>
            <div style={{ flex: 1, background: COLORS.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: COLORS.deepNavy }}>10%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SECTION 2: Card & Component Style
// ============================================
function ComponentSection() {
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ padding: "48px 40px", background: "white" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: COLORS.amber,
            marginBottom: 8,
          }}
        >
          COMPONENT STYLE
        </p>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: COLORS.deepNavy,
            marginBottom: 8,
          }}
        >
          Every element placed with care.
        </h2>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 15,
            color: COLORS.slate,
            marginBottom: 32,
          }}
        >
          Rounded but not bubbly. Soft shadows, not flat. Generous padding —
          like the breathing room between place settings.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Protocol card */}
          <div
            onMouseEnter={() => setHovered("card1")}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: 28,
              background: COLORS.warmWhite,
              borderRadius: 12,
              border: `1px solid ${COLORS.cloudGrey}`,
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: hovered === "card1" ? "translateY(-2px)" : "translateY(0)",
              boxShadow: hovered === "card1"
                ? "0 8px 24px rgba(15, 36, 64, 0.08)"
                : "0 1px 3px rgba(15, 36, 64, 0.04)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: COLORS.steelBlue,
                }}
              >
                PROTOCOL 03
              </p>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "rgba(245, 166, 35, 0.12)",
                  color: COLORS.amber,
                  letterSpacing: "0.1em",
                }}
              >
                TURN-BASED
              </span>
            </div>
            <h3
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 20,
                fontWeight: 600,
                color: COLORS.deepNavy,
                marginBottom: 8,
              }}
            >
              The Truth Is...
            </h3>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                color: COLORS.slate,
                lineHeight: 1.6,
              }}
            >
              Surface assumptions and build trust through structured vulnerability.
            </p>
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: `1px solid ${COLORS.cloudGrey}`,
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.slate }}>
                3–20 players
              </span>
              <span style={{ color: COLORS.cloudGrey }}>·</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.slate }}>
                ~15 min
              </span>
            </div>
          </div>

          {/* Session status card */}
          <div
            onMouseEnter={() => setHovered("card2")}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: 28,
              background: COLORS.warmWhite,
              borderRadius: 12,
              border: `1px solid ${COLORS.cloudGrey}`,
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: hovered === "card2" ? "translateY(-2px)" : "translateY(0)",
              boxShadow: hovered === "card2"
                ? "0 8px 24px rgba(15, 36, 64, 0.08)"
                : "0 1px 3px rgba(15, 36, 64, 0.04)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: COLORS.steelBlue,
                }}
              >
                ACTIVE SESSION
              </p>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "rgba(27, 58, 92, 0.08)",
                  color: COLORS.navy,
                  letterSpacing: "0.1em",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#4CAF50",
                    animation: "pulse 2s infinite",
                  }}
                />
                LIVE
              </span>
            </div>
            <h3
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 20,
                fontWeight: 600,
                color: COLORS.deepNavy,
                marginBottom: 8,
              }}
            >
              Draw It By Ear
            </h3>
            <div style={{ display: "flex", gap: -8, marginBottom: 12 }}>
              {participants.slice(0, 4).map((p, i) => (
                <div
                  key={i}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: p.color,
                    border: "2px solid white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontFamily: "'DM Mono', monospace",
                    color: COLORS.deepNavy,
                    fontWeight: 500,
                    marginLeft: i > 0 ? -8 : 0,
                    position: "relative",
                    zIndex: 4 - i,
                  }}
                >
                  {p.initials}
                </div>
              ))}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: COLORS.cloudGrey,
                  border: "2px solid white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontFamily: "'DM Mono', monospace",
                  color: COLORS.slate,
                  marginLeft: -8,
                }}
              >
                +1
              </div>
            </div>
            <div
              style={{
                marginTop: 4,
                paddingTop: 16,
                borderTop: `1px solid ${COLORS.cloudGrey}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: COLORS.slate }}>
                Round 2 of 5
              </span>
              <div style={{ width: 80, height: 4, borderRadius: 2, background: COLORS.cloudGrey }}>
                <div style={{ width: "40%", height: "100%", borderRadius: 2, background: COLORS.amber, transition: "width 0.6s ease" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SECTION 3: Animation Philosophy
// ============================================
function AnimationSection() {
  const [showReveal, setShowReveal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lobbyCount, setLobbyCount] = useState(3);

  return (
    <div style={{ padding: "48px 40px", background: COLORS.warmWhite }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: COLORS.amber,
            marginBottom: 8,
          }}
        >
          ANIMATION PHILOSOPHY
        </p>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: COLORS.deepNavy,
            marginBottom: 8,
          }}
        >
          Motion that communicates, never decorates.
        </h2>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 15,
            color: COLORS.slate,
            marginBottom: 32,
            maxWidth: 540,
          }}
        >
          Three types of animation, each with a purpose. Click each demo to see
          how it feels.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Demo 1: State transition */}
          <div
            style={{
              padding: 28,
              background: "white",
              borderRadius: 12,
              border: `1px solid ${COLORS.cloudGrey}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: COLORS.steelBlue, marginBottom: 4 }}>
                  ANIMATION TYPE 01
                </p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, color: COLORS.deepNavy }}>
                  The Reveal
                </p>
              </div>
              <button
                onClick={() => setShowReveal(!showReveal)}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: COLORS.navy,
                  color: "white",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {showReveal ? "RESET" : "REVEAL ANSWERS"}
              </button>
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.slate, marginBottom: 16 }}>
              When answers are revealed, they fade in and settle into place — not slam or bounce.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              {["Sarah's answer", "Marcus's answer", "Priya's answer"].map((answer, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    padding: 16,
                    borderRadius: 8,
                    background: showReveal ? "rgba(245, 166, 35, 0.06)" : COLORS.cloudGrey,
                    border: `1px solid ${showReveal ? "rgba(245, 166, 35, 0.2)" : COLORS.cloudGrey}`,
                    transition: `all 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${i * 150}ms`,
                    opacity: showReveal ? 1 : 0.5,
                    transform: showReveal ? "translateY(0)" : "translateY(4px)",
                  }}
                >
                  <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    color: showReveal ? COLORS.charcoal : "transparent",
                    transition: `color 0.4s ease ${i * 150 + 200}ms`,
                    userSelect: "none",
                  }}>
                    {showReveal ? answer : "••••••••"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Demo 2: Confirmation */}
          <div
            style={{
              padding: 28,
              background: "white",
              borderRadius: 12,
              border: `1px solid ${COLORS.cloudGrey}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: COLORS.steelBlue, marginBottom: 4 }}>
                  ANIMATION TYPE 02
                </p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, color: COLORS.deepNavy }}>
                  The Confirmation
                </p>
              </div>
              <button
                onClick={() => { setSubmitted(true); setTimeout(() => setSubmitted(false), 2000); }}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: submitted ? COLORS.amber : COLORS.navy,
                  color: submitted ? COLORS.deepNavy : "white",
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: submitted ? "scale(0.97)" : "scale(1)",
                }}
              >
                {submitted ? "✓ SUBMITTED" : "SUBMIT ANSWER"}
              </button>
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.slate }}>
              When you submit, the button quietly confirms — no confetti, no fanfare.
              A brief color shift and a checkmark. You know it worked.
            </p>
          </div>

          {/* Demo 3: Presence */}
          <div
            style={{
              padding: 28,
              background: "white",
              borderRadius: 12,
              border: `1px solid ${COLORS.cloudGrey}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: COLORS.steelBlue, marginBottom: 4 }}>
                  ANIMATION TYPE 03
                </p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, color: COLORS.deepNavy }}>
                  The Arrival
                </p>
              </div>
              <button
                onClick={() => { if (lobbyCount < 5) setLobbyCount(lobbyCount + 1); else setLobbyCount(3); }}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: COLORS.navy,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {lobbyCount < 5 ? "SOMEONE JOINS" : "RESET"}
              </button>
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.slate, marginBottom: 16 }}>
              When someone joins the lobby, their avatar gently fades in and slides into the row.
              No flash, no sound effect — just a quiet acknowledgment of presence.
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {participants.slice(0, lobbyCount).map((p, i) => (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    opacity: 1,
                    transform: "translateY(0)",
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    animation: i === lobbyCount - 1 ? "fadeSlideIn 0.4s ease" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: p.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      color: COLORS.deepNavy,
                      fontWeight: 500,
                    }}
                  >
                    {p.initials}
                  </div>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: COLORS.slate }}>
                    {p.name.split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SECTION 4: Mobile Session View
// ============================================
function MobileSection() {
  const [phase, setPhase] = useState("prompt");

  return (
    <div style={{ padding: "48px 40px", background: "white" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: COLORS.amber,
            marginBottom: 8,
          }}
        >
          MOBILE SESSION VIEW
        </p>
        <h2
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: COLORS.deepNavy,
            marginBottom: 8,
          }}
        >
          What it looks like in someone's hand.
        </h2>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 15,
            color: COLORS.slate,
            marginBottom: 32,
            maxWidth: 540,
          }}
        >
          Most participants will be on their phones. The UI needs to feel
          focused and simple — one thing to do at a time.
        </p>

        <div style={{ display: "flex", justifyContent: "center" }}>
          {/* Phone frame */}
          <div
            style={{
              width: 300,
              height: 540,
              borderRadius: 32,
              border: `3px solid ${COLORS.charcoal}`,
              background: COLORS.warmWhite,
              overflow: "hidden",
              position: "relative",
              boxShadow: "0 16px 48px rgba(15, 36, 64, 0.12)",
            }}
          >
            {/* Status bar */}
            <div
              style={{
                padding: "12px 20px 8px",
                background: COLORS.deepNavy,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: COLORS.steelBlue, letterSpacing: "0.15em" }}>
                THE TRUTH IS...
              </span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: COLORS.steelBlue, letterSpacing: "0.1em" }}>
                ROUND 2/5
              </span>
            </div>

            {/* Content area */}
            <div style={{ padding: 24, height: "calc(100% - 40px)", display: "flex", flexDirection: "column" }}>
              {phase === "prompt" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", transition: "all 0.4s ease" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: COLORS.steelBlue, marginBottom: 16 }}>
                    THIS ROUND'S PROMPT
                  </p>
                  <div
                    style={{
                      flex: 0,
                      padding: 20,
                      background: "white",
                      borderRadius: 12,
                      border: `1px solid ${COLORS.cloudGrey}`,
                      marginBottom: 24,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 20,
                        fontWeight: 600,
                        color: COLORS.deepNavy,
                        lineHeight: 1.4,
                      }}
                    >
                      "The truth is, the hardest part of my job is..."
                    </p>
                  </div>

                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: COLORS.steelBlue, marginBottom: 8 }}>
                    YOUR ANSWER
                  </p>
                  <div
                    style={{
                      flex: 1,
                      padding: 16,
                      background: "white",
                      borderRadius: 12,
                      border: `1px solid ${COLORS.cloudGrey}`,
                      marginBottom: 16,
                    }}
                  >
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.slate, fontStyle: "italic" }}>
                      Tap to type your response...
                    </p>
                  </div>

                  <button
                    onClick={() => setPhase("waiting")}
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 10,
                      border: "none",
                      background: COLORS.navy,
                      color: "white",
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Submit
                  </button>
                </div>
              )}

              {phase === "waiting" && (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 20,
                    animation: "fadeSlideIn 0.4s ease",
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "rgba(245, 166, 35, 0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 20 }}>✓</span>
                  </div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600, color: COLORS.deepNavy }}>
                    Answer submitted
                  </p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.slate, textAlign: "center" }}>
                    Waiting for others to finish...
                  </p>

                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {participants.slice(0, 5).map((p, i) => (
                      <div
                        key={i}
                        style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: i < 3 ? p.color : COLORS.cloudGrey,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "'DM Mono', monospace", fontSize: 9,
                          color: i < 3 ? COLORS.deepNavy : COLORS.slate,
                          opacity: i < 3 ? 1 : 0.5,
                          transition: `opacity 0.3s ease ${i * 100}ms`,
                        }}
                      >
                        {i < 3 ? "✓" : p.initials}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: COLORS.slate, letterSpacing: "0.1em" }}>
                    3 OF 5 SUBMITTED
                  </p>

                  <button
                    onClick={() => setPhase("prompt")}
                    style={{
                      marginTop: 16,
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: `1px solid ${COLORS.cloudGrey}`,
                      background: "transparent",
                      color: COLORS.slate,
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                  >
                    ← RESET DEMO
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SECTION 5: Button & CTA Style
// ============================================
function ButtonSection() {
  const [activeBtn, setActiveBtn] = useState(null);

  return (
    <div style={{ padding: "48px 40px", background: COLORS.warmWhite }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.amber, marginBottom: 8 }}>
          INTERACTION PATTERNS
        </p>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 700, color: COLORS.deepNavy, marginBottom: 8 }}>
          Buttons that mean something.
        </h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: COLORS.slate, marginBottom: 32, maxWidth: 540 }}>
          Amber is reserved for the primary action — the one thing you should do right now.
          Navy is for secondary. Ghost buttons for tertiary. The hierarchy is always clear.
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
          <button
            onMouseEnter={() => setActiveBtn("primary")}
            onMouseLeave={() => setActiveBtn(null)}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              border: "none",
              background: activeBtn === "primary" ? COLORS.gold : COLORS.amber,
              color: COLORS.deepNavy,
              fontFamily: "'Outfit', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              transform: activeBtn === "primary" ? "translateY(-1px)" : "none",
              boxShadow: activeBtn === "primary" ? "0 4px 12px rgba(245, 166, 35, 0.3)" : "none",
            }}
          >
            Start Session
          </button>

          <button
            onMouseEnter={() => setActiveBtn("secondary")}
            onMouseLeave={() => setActiveBtn(null)}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              border: "none",
              background: activeBtn === "secondary" ? "#1e4268" : COLORS.navy,
              color: "white",
              fontFamily: "'Outfit', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            View Results
          </button>

          <button
            onMouseEnter={() => setActiveBtn("ghost")}
            onMouseLeave={() => setActiveBtn(null)}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              border: `1px solid ${COLORS.cloudGrey}`,
              background: activeBtn === "ghost" ? COLORS.cloudGrey : "transparent",
              color: COLORS.charcoal,
              fontFamily: "'Outfit', sans-serif",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Skip Round
          </button>

          <button
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              border: `1px solid ${COLORS.cloudGrey}`,
              background: "transparent",
              color: COLORS.slate,
              fontFamily: "'Outfit', sans-serif",
              fontSize: 15,
              fontWeight: 500,
              cursor: "not-allowed",
              opacity: 0.4,
            }}
          >
            Disabled State
          </button>
        </div>

        {/* Join code display */}
        <div style={{ padding: 28, background: "white", borderRadius: 12, border: `1px solid ${COLORS.cloudGrey}` }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: COLORS.steelBlue, marginBottom: 12 }}>
            JOIN CODE — SHOW ON PROJECTOR
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
            {"XKTR42".split("").map((char, i) => (
              <div
                key={i}
                style={{
                  width: 52,
                  height: 64,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  background: COLORS.warmWhite,
                  border: `2px solid ${COLORS.cloudGrey}`,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 28,
                  fontWeight: 500,
                  color: COLORS.deepNavy,
                  letterSpacing: 0,
                }}
              >
                {char}
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: COLORS.slate, textAlign: "center" }}>
            Go to <span style={{ fontFamily: "'DM Mono', monospace", color: COLORS.navy }}>unmutelabs.com/join</span> and enter this code
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================
export default function UnmuteDesignReference() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: COLORS.charcoal }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Inter:wght@400;500;600&family=Outfit:wght@400;500;600;700&display=swap');
        
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: "32px 40px",
          background: COLORS.deepNavy,
          borderBottom: `2px solid ${COLORS.amber}`,
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: COLORS.amber,
              marginBottom: 4,
            }}
          >
            UNMUTE LABS
          </p>
          <h1
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color: "white",
              marginBottom: 4,
            }}
          >
            UI Direction Reference Board
          </h1>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: COLORS.steelBlue,
            }}
          >
            "A well-run workshop in a beautiful room." Interactive components
            using the brand palette and type system.
          </p>
        </div>
      </div>

      <TypographySection />
      <ComponentSection />
      <AnimationSection />
      <MobileSection />
      <ButtonSection />

      {/* Footer */}
      <div style={{ padding: "32px 40px", background: COLORS.deepNavy }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.15em", color: COLORS.steelBlue }}>
            REACT TO WHAT WORKS · FLAG WHAT DOESN'T · THIS INFORMS THE CURSOR DESIGN SYSTEM PROMPT
          </p>
        </div>
      </div>
    </div>
  );
}
