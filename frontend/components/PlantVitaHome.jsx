"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplet, Sun, Wind, Sprout, Bell } from "lucide-react";
import Link from "next/link";
import PlantDashboard from "./PlantDashboard";
import { apiGet, apiPost } from "@/lib/api";

export default function PlantVitaHome() {
  const { data: session } = useSession();

  const [activePlant, setActivePlant] = useState(null); // { id, name, … }
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  const [plants, setPlants] = useState([]);
  const [plantsLoading, setPlantsLoading] = useState(false);

  // AUTH FORM STATE
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  /* ── Load plants whenever the user logs in ─────────────────────────────── */
  useEffect(() => {
    if (session?.accessToken) {
      loadPlants(session.accessToken);
    } else {
      setPlants([]);
    }
  }, [session?.accessToken]);

  const loadPlants = async (token) => {
    setPlantsLoading(true);
    try {
      // GET /dashboard/plants returns PlantSummary[]
      const data = await apiGet("/dashboard/plants", token);
      setPlants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load plants:", err);
      setPlants([]);
    } finally {
      setPlantsLoading(false);
    }
  };

  /* ── Register ──────────────────────────────────────────────────────────── */
  const handleRegister = async () => {
    if (!email || !password) {
      alert("Email and password are required");
      return;
    }
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
      setEmail("");
      setPassword("");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Login ─────────────────────────────────────────────────────────────── */
  const handleLogin = async () => {
    if (!email || !password) {
      alert("Email and password are required");
      return;
    }
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      alert("Invalid email or password");
      return;
    }
    setShowAuth(false);
    setEmail("");
    setPassword("");
  };

  /* ── Show dashboard for a specific plant ───────────────────────────────── */
  if (activePlant) {
    return (
      <PlantDashboard
        plant={activePlant}
        token={session?.accessToken}
        onBack={() => setActivePlant(null)}
      />
    );
  }

  /* ── Health badge colour ────────────────────────────────────────────────── */
  const healthBadge = (status, isCritical) => {
    if (isCritical) return { text: "🚨 Critical", cls: "badge-bad" };
    if (!status || status === "Pending Analysis")
      return { text: "⏳ Analysing", cls: "badge-warn" };
    const lower = status.toLowerCase();
    if (lower.includes("healthy") || lower === "healthy")
      return { text: "✅ Healthy", cls: "badge-good" };
    if (lower.includes("moderate"))
      return { text: "⚠️ Moderate", cls: "badge-warn" };
    return { text: `⚠️ ${status}`, cls: "badge-warn" };
  };

  return (
    <div className="min-h-screen bg-green-50 text-gray-800">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 bg-white shadow-sm sticky top-0 z-10">
        <Image src="/Namelogo.svg" alt="PlantVita Logo" width={120} height={40} />
        <div className="flex items-center gap-4">
          <Bell className="w-5 h-5" />
          {session ? (
            <>
              <span className="text-sm font-medium">Hi, {session.user?.name}</span>
              <Button size="sm" variant="outline" onClick={() => signOut()}>
                Logout
              </Button>
            </>
          ) : (
            <Button onClick={() => { setAuthMode("login"); setShowAuth(true); }}>
              Login
            </Button>
          )}
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-8 px-8 py-16 items-center">
        <div>
          <h2 className="text-4xl font-bold mb-4">
            Know Your Plant<br />Grow with Confidence.
          </h2>
          <p className="text-gray-600 mb-6">
            Monitor soil moisture, texture, humidity and sunlight exposure.
          </p>
          <div className="flex gap-4">
            {session && (
              <Link href="/add-plant">
                <Button className="bg-green-700 hover:bg-green-800">
                  ➕ Add a Plant
                </Button>
              </Link>
            )}
            {!session && (
              <Button variant="outline" onClick={() => { setAuthMode("login"); setShowAuth(true); }}>
                Login to get started
              </Button>
            )}
          </div>
        </div>
        <img
          src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6"
          alt="Plant"
          className="rounded-2xl shadow-lg w-80 mx-auto"
        />
      </section>

      {/* ── DEMO CARD (logged-out) ───────────────────────────────────────── */}
      {!session && (
        <section className="px-8 pb-16">
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold">Monstera Deliciosa</h3>
              <p className="text-green-600 font-medium mb-6">
                🟢 Healthy <span className="text-xs text-gray-400">(Demo)</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <HealthCard icon={<Droplet className="text-blue-500" />} title="Soil Moisture" value="68%" status="Optimal" />
                <HealthCard icon={<Sprout className="text-green-600" />} title="Soil Texture" value="Loamy" status="Ideal" />
                <HealthCard icon={<Wind className="text-teal-500" />} title="Humidity" value="55%" status="Normal" />
                <HealthCard icon={<Sun className="text-yellow-500" />} title="Sun Exposure" value="6 hrs/day" status="Partial Sun" />
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── REGISTERED PLANTS (logged-in) ───────────────────────────────── */}
      {session && (
        <section className="px-8 pb-16">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Your Plants
          </h2>

          {plantsLoading && (
            <p className="text-gray-500 text-sm">Loading plants…</p>
          )}

          {!plantsLoading && plants.length === 0 && (
            <p className="text-gray-500 text-sm">
              No plants yet.{" "}
              <Link href="/add-plant" className="text-green-700 underline">
                Add your first plant
              </Link>
              .
            </p>
          )}

          <div className="flex flex-wrap gap-4">
            {plants.map((plant) => {
              const badge = healthBadge(plant.latest_health_status, plant.is_critical);
              return (
                <Card
                  key={plant.id}
                  onClick={() => setActivePlant(plant)}
                  className="w-72 rounded-2xl border border-green-300
                    bg-gradient-to-br from-green-50 to-green-100
                    shadow-md hover:shadow-xl hover:-translate-y-1
                    transition-all duration-300 cursor-pointer"
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Plant image */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={plant.latest_image_url || "/plant.jpg"}
                        className="w-14 h-14 rounded-xl object-cover shadow-sm"
                        onError={(e) => { e.target.src = "/plant.jpg"; }}
                      />
                    </div>
                    {/* Info */}
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">
                        {plant.name} {plant.species ? `(${plant.species})` : ""}
                      </h3>
                      {plant.latest_moisture_pct != null && (
                        <p className="text-xs text-gray-500">
                          💧 Moisture: {plant.latest_moisture_pct.toFixed(1)}%
                        </p>
                      )}
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full shadow-sm
                        ${badge.cls === "badge-good" ? "bg-green-600 text-white" :
                          badge.cls === "badge-warn" ? "bg-yellow-400 text-gray-800" :
                          "bg-red-600 text-white"}`}>
                        {badge.text}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ── AUTH MODAL ──────────────────────────────────────────────────── */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative">
            <h2 className="text-xl font-bold text-green-700 text-center mb-4">
              {authMode === "login" ? "Login" : "Create Account"}
            </h2>

            <input
              type="email"
              placeholder="Email"
              className="w-full border rounded-lg px-4 py-2 mb-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full border rounded-lg px-4 py-2 mb-4"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              className="w-full bg-green-700 hover:bg-green-800 mb-3"
              onClick={authMode === "login" ? handleLogin : handleRegister}
              disabled={loading}
            >
              {loading ? "Please wait…" : authMode === "login" ? "Login" : "Register"}
            </Button>

            <p className="text-sm text-center text-gray-500 mb-3">
              {authMode === "login" ? (
                <>Don't have an account?{" "}
                  <button className="text-green-700 font-medium" onClick={() => setAuthMode("register")}>
                    Register
                  </button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button className="text-green-700 font-medium" onClick={() => setAuthMode("login")}>
                    Login
                  </button>
                </>
              )}
            </p>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <Button
              className="w-full flex items-center justify-center gap-3 border bg-white text-gray-700 hover:bg-gray-100"
              onClick={() => signIn("google")}
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" />
              Continue with Google
            </Button>

            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── HealthCard (demo section) ─────────────────────────────────────────────── */
function HealthCard({ icon, title, value, status }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 text-center">
        <div className="mx-auto mb-2">{icon}</div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-green-600 text-sm">{status}</p>
      </CardContent>
    </Card>
  );
}