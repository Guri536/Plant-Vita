"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Droplet, Sun, Wind, Sprout, Bell, LogOut, Plus, Leaf } from "lucide-react";
import PlantDashboard from "./PlantDashboard";
import { apiGet } from "@/lib/api";

/* ─── Google Font import (add to your layout.js or globals.css instead if preferred) ─── */
const FontLink = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
);

/* ─── Design tokens ─────────────────────────────────────────────────────────── */
const css = `
  :root {
    --forest:   #1a2e1a;
    --canopy:   #2d4a2d;
    --leaf:     #4a7c59;
    --mint:     #7fb896;
    --cream:    #f5f0e8;
    --bark:     #8b6914;
    --gold:     #d4a853;
    --mist:     rgba(255,255,255,0.06);
  }
  body { font-family: 'DM Sans', sans-serif; }
  .display { font-family: 'Playfair Display', serif; }

  .plant-card {
    transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease;
  }
  .plant-card:hover {
    transform: translateY(-6px) scale(1.01);
    box-shadow: 0 20px 40px rgba(0,0,0,0.25);
  }
  .card-shimmer {
    background: linear-gradient(135deg, #1e3a1e 0%, #243d24 50%, #1a2e1a 100%);
  }
  .health-pill {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 20px;
  }
  .badge-good  { background: #14532d33; color: #4ade80; border: 1px solid #14532d88; }
  .badge-warn  { background: #78350f33; color: #fbbf24; border: 1px solid #78350f88; }
  .badge-bad   { background: #7f1d1d33; color: #f87171; border: 1px solid #7f1d1d88; }
  .badge-pend  { background: #1e3a5f33; color: #60a5fa; border: 1px solid #1e3a5f88; }

  .auth-input {
    width: 100%;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 10px 16px;
    color: #f5f0e8;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }
  .auth-input::placeholder { color: rgba(245,240,232,0.35); }
  .auth-input:focus { border-color: var(--mint); }

  .moisture-bar {
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.1);
    overflow: hidden;
  }
  .moisture-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.8s ease;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.5s ease forwards; }
  .fade-up-2 { animation: fadeUp 0.5s 0.1s ease both; }
  .fade-up-3 { animation: fadeUp 0.5s 0.2s ease both; }
`;

/* ─── Inner component (uses useSearchParams, must be wrapped in Suspense) ─── */
function HomeContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const plantIdFromUrl = searchParams.get("plant");

  const [plants, setPlants] = useState([]);
  const [plantsLoading, setPlantsLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  /* ── Active plant derived from URL ─────────────────────────────────────── */
  const activePlant = useMemo(
    () => (plantIdFromUrl ? plants.find((p) => String(p.id) === plantIdFromUrl) ?? null : null),
    [plantIdFromUrl, plants]
  );

  /* ── Load plants ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (session?.accessToken) loadPlants(session.accessToken);
    else setPlants([]);
  }, [session?.accessToken]);

  const loadPlants = async (token) => {
    setPlantsLoading(true);
    try {
      const data = await apiGet("/dashboard/plants", token);
      setPlants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load plants:", err);
      setPlants([]);
    } finally {
      setPlantsLoading(false);
    }
  };

  /* ── Navigate to plant (URL-based so browser history works) ─────────────── */
  const openPlant = (plant) => router.push(`/?plant=${plant.id}`);

  /* ── Auth handlers ──────────────────────────────────────────────────────── */
  const handleRegister = async () => {
    if (!email || !password) return alert("Email and password are required");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      alert("Account created! Please log in.");
      setAuthMode("login");
      setEmail(""); setPassword("");
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!email || !password) return alert("Email and password are required");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) { alert("Invalid email or password"); return; }
    setShowAuth(false); setEmail(""); setPassword("");
  };

  /* ── Show dashboard ─────────────────────────────────────────────────────── */
  if (activePlant) {
    return (
      <PlantDashboard
        plant={activePlant}
        token={session?.accessToken}
        onBack={() => router.back()}
      />
    );
  }

  /* ── Health badge ───────────────────────────────────────────────────────── */
  const healthBadge = (status, isCritical) => {
    if (isCritical) return { text: "Critical", cls: "badge-bad" };
    if (!status || status === "Pending Analysis") return { text: "Analysing", cls: "badge-pend" };
    const l = status.toLowerCase();
    if (l.includes("healthy")) return { text: "Healthy", cls: "badge-good" };
    if (l.includes("moderate")) return { text: "Moderate", cls: "badge-warn" };
    return { text: status, cls: "badge-warn" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--forest)", color: "var(--cream)" }}>
      <style>{css}</style>
      <FontLink />

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 40px",
        background: "rgba(26,46,26,0.95)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky", top: 0, zIndex: 50,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="Logo.svg" alt="" style={{height: 30}}/>
          <span className="display" style={{ fontSize: 20, color: "var(--cream)", letterSpacing: "-0.02em" }}>
            PlantVita
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {session ? (
            <>
              <span style={{ fontSize: 13, color: "var(--mint)", fontWeight: 500 }}>
                {session.user?.name}
              </span>
              {session && (
                <Link href="/add-plant" style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 8,
                  background: "var(--leaf)", color: "#fff",
                  fontSize: 13, fontWeight: 600, textDecoration: "none",
                  transition: "background 0.2s",
                }}>
                  <Plus size={14} /> Add Plant
                </Link>
              )}
              <button onClick={() => signOut()} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8,
                background: "var(--mist)", border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--cream)", fontSize: 13, cursor: "pointer",
              }}>
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <button onClick={() => { setAuthMode("login"); setShowAuth(true); }} style={{
              padding: "9px 22px", borderRadius: 8,
              background: "var(--leaf)", color: "#fff",
              fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
            }}>
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 40, padding: "72px 40px 56px",
        maxWidth: 1100, margin: "0 auto",
        alignItems: "center",
      }}>
        <div className="fade-up">
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.15em", color: "var(--mint)", textTransform: "uppercase", marginBottom: 16 }}>
            Smart Plant Monitor
          </p>
          <h1 className="display" style={{ fontSize: 52, lineHeight: 1.1, marginBottom: 20, color: "var(--cream)" }}>
            Know your plant.<br />
            <span style={{ color: "var(--mint)" }}>Grow with</span><br />
            confidence.
          </h1>
          <p style={{ fontSize: 16, color: "rgba(245,240,232,0.6)", lineHeight: 1.7, marginBottom: 32, maxWidth: 420 }}>
            Real-time soil moisture, temperature, humidity, and AI-powered health diagnostics for every plant in your care.
          </p>
          {!session && (
            <button onClick={() => { setAuthMode("login"); setShowAuth(true); }} style={{
              padding: "14px 32px", borderRadius: 10,
              background: "linear-gradient(135deg, var(--leaf), var(--mint))",
              color: "#fff", fontSize: 15, fontWeight: 600,
              border: "none", cursor: "pointer",
              boxShadow: "0 8px 24px rgba(74,124,89,0.4)",
            }}>
              Get Started →
            </button>
          )}
        </div>
        <div className="fade-up-2" style={{ position: "relative" }}>
          <div style={{
            position: "absolute", inset: -20,
            background: "radial-gradient(ellipse at center, rgba(74,124,89,0.15) 0%, transparent 70%)",
            borderRadius: "50%",
          }} />
          <img
            src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=600&q=80"
            alt="Plant"
            style={{
              width: "100%", maxWidth: 420, borderRadius: 24,
              objectFit: "cover", aspectRatio: "4/3",
              boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "block", margin: "0 auto",
            }}
          />
          {/* Floating stat pill */}
          <div style={{
            position: "absolute", bottom: 24, left: 0,
            background: "rgba(26,46,26,0.9)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14, padding: "12px 18px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontSize: 11, color: "var(--mint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Soil Moisture</div>
            <div className="display" style={{ fontSize: 28, color: "var(--cream)", lineHeight: 1.1 }}>68%</div>
            <div style={{ fontSize: 11, color: "rgba(245,240,232,0.5)" }}>Optimal range</div>
          </div>
        </div>
      </section>

      {/* ── DEMO STATS (logged out) ────────────────────────────────────────── */}
      {!session && (
        <section style={{ padding: "0 40px 72px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{
            background: "var(--canopy)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: "32px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h3 className="display" style={{ fontSize: 22, color: "var(--cream)" }}>Monstera Deliciosa</h3>
                <span className="health-pill badge-good" style={{ marginTop: 6, display: "inline-block" }}>✓ Healthy</span>
              </div>
              <span style={{ fontSize: 12, color: "rgba(245,240,232,0.3)", fontWeight: 500 }}>Demo Preview</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { icon: <Droplet size={18} color="#60a5fa" />, label: "Soil Moisture", val: "68%", sub: "Optimal" },
                { icon: <Sprout size={18} color="#4ade80" />, label: "Soil Texture", val: "Loamy", sub: "Ideal" },
                { icon: <Wind size={18} color="#2dd4bf" />, label: "Humidity", val: "55%", sub: "Normal" },
                { icon: <Sun size={18} color="#fbbf24" />, label: "Sun Exposure", val: "6 hrs", sub: "Partial Sun" },
              ].map(({ icon, label, val, sub }) => (
                <div key={label} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, padding: "20px 16px",
                  textAlign: "center",
                }}>
                  <div style={{ marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontSize: 11, color: "rgba(245,240,232,0.45)", marginBottom: 6, fontWeight: 500 }}>{label}</div>
                  <div className="display" style={{ fontSize: 24, color: "var(--cream)", lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 11, color: "var(--mint)", marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PLANT LIST (logged in) ─────────────────────────────────────────── */}
      {session && (
        <section style={{ padding: "0 40px 72px", maxWidth: 1100, margin: "0 auto" }} className="fade-up-3">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <h2 className="display" style={{ fontSize: 28, color: "var(--cream)" }}>Your Plants</h2>
            <span style={{ fontSize: 13, color: "rgba(245,240,232,0.4)" }}>
              {plants.length} plant{plants.length !== 1 ? "s" : ""}
            </span>
          </div>

          {plantsLoading && (
            <div style={{ display: "flex", gap: 16 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{
                  width: 280, height: 160, borderRadius: 18,
                  background: "var(--canopy)", opacity: 0.5,
                  animation: "fadeUp 1s ease infinite alternate",
                }} />
              ))}
            </div>
          )}

          {!plantsLoading && plants.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "var(--canopy)",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: 20,
            }}>
              <Leaf size={36} color="var(--leaf)" style={{ margin: "0 auto 16px" }} />
              <p style={{ color: "rgba(245,240,232,0.5)", marginBottom: 20 }}>No plants yet. Add your first one!</p>
              <Link href="/add-plant" style={{
                padding: "10px 24px", borderRadius: 8,
                background: "var(--leaf)", color: "#fff",
                fontSize: 14, fontWeight: 600, textDecoration: "none",
              }}>
                + Add a Plant
              </Link>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            {plants.map((plant, idx) => {
              const badge = healthBadge(plant.latest_health_status, plant.is_critical);
              const moisture = plant.latest_moisture_pct ?? null;
              return (
                <div
                  key={plant.id}
                  className="plant-card card-shimmer"
                  onClick={() => openPlant(plant)}
                  style={{
                    width: 280, borderRadius: 20, overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    animationDelay: `${idx * 0.07}s`,
                  }}
                >
                  {/* Plant image */}
                  <div style={{ position: "relative", height: 140, overflow: "hidden" }}>
                    <img
                      src={plant.latest_image_url || "/plant.jpg"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => { e.target.src = "/plant.jpg"; }}
                      alt={plant.name}
                    />
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(to bottom, transparent 40%, rgba(26,46,26,0.9) 100%)",
                    }} />
                    <span className={`health-pill ${badge.cls}`} style={{
                      position: "absolute", top: 10, right: 10,
                    }}>
                      {badge.text}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ padding: "16px 18px 18px" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--cream)", marginBottom: 2 }}>
                      {plant.name}
                    </h3>
                    {plant.species && (
                      <p style={{ fontSize: 12, color: "rgba(245,240,232,0.4)", fontStyle: "italic", marginBottom: 12 }}>
                        {plant.species}
                      </p>
                    )}
                    {moisture != null && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: "rgba(245,240,232,0.45)" }}>Moisture</span>
                          <span style={{ fontSize: 11, color: "var(--mint)", fontWeight: 600 }}>
                            {moisture.toFixed(0)}%
                          </span>
                        </div>
                        <div className="moisture-bar">
                          <div className="moisture-fill" style={{
                            width: `${moisture}%`,
                            background: moisture < 30 ? "#ef4444" : moisture < 60 ? "var(--mint)" : "#fbbf24",
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── AUTH MODAL ────────────────────────────────────────────────────── */}
      {showAuth && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }}>
          <div style={{
            background: "var(--canopy)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, width: "100%", maxWidth: 380,
            padding: 32, position: "relative",
            boxShadow: "0 32px 64px rgba(0,0,0,0.6)",
          }}>
            <button onClick={() => setShowAuth(false)} style={{
              position: "absolute", top: 16, right: 16,
              background: "none", border: "none",
              color: "rgba(245,240,232,0.4)", cursor: "pointer", fontSize: 18,
            }}>✕</button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <img src="Logo.svg" alt="" style={{height: 50}}/>
              <span className="display" style={{ fontSize: 18, color: "var(--cream)" }}>PlantVita</span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--cream)", marginBottom: 6 }}>
              {authMode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p style={{ fontSize: 13, color: "rgba(245,240,232,0.4)", marginBottom: 24 }}>
              {authMode === "login" ? "Sign in to view your plants" : "Start monitoring your plants today"}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <input
                className="auth-input" type="email" placeholder="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="auth-input" type="password" placeholder="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (authMode === "login" ? handleLogin() : handleRegister())}
              />
            </div>

            <button
              onClick={authMode === "login" ? handleLogin : handleRegister}
              disabled={loading}
              style={{
                width: "100%", padding: "12px",
                background: loading ? "var(--leaf)" : "linear-gradient(135deg, var(--leaf), var(--mint))",
                border: "none", borderRadius: 10, color: "#fff",
                fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1, marginBottom: 16,
              }}
            >
              {loading ? "Please wait…" : authMode === "login" ? "Sign In" : "Create Account"}
            </button>

            <p style={{ textAlign: "center", fontSize: 13, color: "rgba(245,240,232,0.4)", marginBottom: 16 }}>
              {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                style={{ background: "none", border: "none", color: "var(--mint)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                {authMode === "login" ? "Register" : "Login"}
              </button>
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: 11, color: "rgba(245,240,232,0.25)", textTransform: "uppercase", letterSpacing: "0.1em" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            </div>

            <button
              onClick={() => signIn("google")}
              style={{
                width: "100%", padding: "11px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, color: "var(--cream)",
                fontSize: 14, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" style={{ width: 18 }} alt="Google" />
              Continue with Google
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Export (Suspense required for useSearchParams) ───────────────────────── */
export default function PlantVitaHome() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}