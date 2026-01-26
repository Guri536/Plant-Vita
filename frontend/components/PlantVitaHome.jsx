"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplet, Sun, Wind, Sprout, Bell } from "lucide-react";

export default function PlantVitaHome() {
  const { data: session } = useSession();

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [showAddPlant, setShowAddPlant] = useState(false);

  // AUTH FORM STATE
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ================= REGISTER =================
  const handleRegister = async () => {
    if (!name || !email || !password) {
      alert("All fields required");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      alert(data.error || "Registration failed");
      return;
    }

    alert("Registration successful. Please login.");
    setAuthMode("login");
    setName("");
    setEmail("");
    setPassword("");
  };

  // ================= LOGIN =================
 const handleLogin = async () => {
  if (!email || !password) {
    alert("Email & password required");
    return;
  }

  setLoading(true);

  const res = await signIn("credentials", {
    email,
    password,
    redirect: false,
  });

  setLoading(false);

  if (res?.error) {
    alert("Invalid email or password");
    return;
  }

  setShowAuth(false);
  setEmail("");
  setPassword("");
};

  return (
    <div className="min-h-screen bg-green-50 text-gray-800">
      {/* ================= HEADER ================= */}
      <header className="flex items-center justify-between px-8 py-4 bg-white shadow-sm sticky top-0 z-10">
        <Image src="/Namelogo.svg" alt="PlantVita Logo" width={120} height={40} />

        <div className="flex items-center gap-4">
          <Bell className="w-5 h-5" />

          {session ? (
            <>
              <span className="text-sm font-medium">
                Hi, {session.user?.name}
              </span>
              <Button size="sm" variant="outline" onClick={() => signOut()}>
                Logout
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                setAuthMode("login");
                setShowAuth(true);
              }}
            >
              Login
            </Button>
          )}
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section className="grid md:grid-cols-2 gap-8 px-8 py-16 items-center">
        <div>
          <h2 className="text-4xl font-bold mb-4">
            Know Your Plant.
            <br />
            Grow with Confidence.
          </h2>

          <p className="text-gray-600 mb-6">
            Monitor soil moisture, texture, humidity and sunlight exposure.
          </p>

          <div className="flex gap-4">
            {session && (
              <Button className="bg-green-700 hover:bg-green-800">
                View Plant Health
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                if (!session) {
                  setAuthMode("login");
                  setShowAuth(true);
                } else {
                  setShowAddPlant(true);
                }
              }}
            >
              Add a Plant
            </Button>
          </div>
        </div>

        <img
          src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6"
          alt="Plant"
          className="rounded-2xl shadow-lg w-80 mx-auto"
        />
      </section>

      {/* ================= DEMO PLANT ================= */}
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

      {/* ================= AUTH MODAL ================= */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative">
            <h2 className="text-xl font-bold text-green-700 text-center mb-4">
              {authMode === "login" ? "Login" : "Create Account"}
            </h2>

            {authMode === "register" && (
              <input
                placeholder="Full Name"
                className="w-full border rounded-lg px-4 py-2 mb-3"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}

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
              {loading ? "Please wait..." : authMode === "login" ? "Login" : "Register"}
            </Button>

            <p className="text-sm text-center text-gray-500 mb-4">
              {authMode === "login" ? (
                <>
                  Don’t have an account?{" "}
                  <button
                    className="text-green-700 font-medium"
                    onClick={() => setAuthMode("register")}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    className="text-green-700 font-medium"
                    onClick={() => setAuthMode("login")}
                  >
                    Login
                  </button>
                </>
              )}
            </p>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <Button
              className="w-full flex items-center justify-center gap-3 border bg-white text-gray-700 hover:bg-gray-100"
              onClick={() => signIn("google")}
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                className="w-5 h-5"
              />
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

/* ================= HEALTH CARD ================= */
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
