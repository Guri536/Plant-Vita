"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import  Image from "next/image";
import {
  Droplet,
  Sun,
  Wind,
  Sprout,
  Bell,
} from "lucide-react";

export default function PlantVitaHome() {
  const { data: session } = useSession();
  const [showAddPlant, setShowAddPlant] = useState(false);

  return (
    <div className="min-h-screen bg-green-50 text-gray-800">
      {/* ================= HEADER ================= */}
      <header className="flex items-center justify-between px-8 py-4 bg-white shadow-sm sticky top-0 z-10">
        <a href="/" className="flex items-center gap-2">
  <Image
    src="/Namelogo.svg"
    alt="PlantVita Logo"
    width={100}
    height={100}
    priority
  />

  
</a>

        <nav className="hidden md:flex gap-6 text-sm font-medium">
          <a className="hover:text-green-700">Dashboard</a>
          <a className="hover:text-green-700">Plants</a>
          <a className="hover:text-green-700">Insights</a>
          <a className="hover:text-green-700">History</a>
          <a className="hover:text-green-700">Settings</a>
        </nav>

        {/* AUTH AREA */}
        <div className="flex items-center gap-4">
          <Bell className="w-5 h-5" />

          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                Hi, {session.user?.name}
              </span>
              <Button size="sm" variant="outline" onClick={() => signOut()}>
                Logout
              </Button>
            </div>
          ) : (
            <Button onClick={() => signIn("google")}>
              Sign in with Google
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
            Monitor soil moisture, texture, humidity and sunlight exposure in real time.
          </p>

          <div className="flex gap-4">
            {/* VIEW PLANT HEALTH → logged in only */}
            {session && (
              <Button className="bg-green-700 hover:bg-green-800">
                View Plant Health
              </Button>
            )}

            {/* ADD PLANT */}
            <Button
              variant="outline"
              onClick={() => {
                if (!session) {
                  signIn("google");
                } else {
                  setShowAddPlant(true);
                }
              }}
            >
              Add a Plant
            </Button>
          </div>
        </div>

        <div className="flex justify-center">
          <img
            src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6"
            alt="Plant"
            className="rounded-2xl shadow-lg w-80"
          />
        </div>
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

      {/* ================= ADD PLANT MODAL ================= */}
      {showAddPlant && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl relative">
            <h2 className="text-xl font-bold mb-4 text-green-700">
              🌱 Add a New Plant
            </h2>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Plant Name"
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              <select className="w-full border rounded-lg px-4 py-2">
                <option>Indoor</option>
                <option>Outdoor</option>
              </select>

              <Button className="w-full bg-green-700 hover:bg-green-800">
                Save Plant
              </Button>
            </div>

            <button
              onClick={() => setShowAddPlant(false)}
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ================= FOOTER ================= */}
      <footer className="bg-white border-t px-8 py-6 text-sm text-gray-500">
        <div className="flex justify-between flex-wrap gap-4">
          <p>© 2026 PlantVita. All rights reserved.</p>
          <div className="flex gap-4">
            <a>About</a>
            <a>Contact</a>
            <a>Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ================= REUSABLE CARD ================= */
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
