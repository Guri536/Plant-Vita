"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";

export default function AddPlantPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state — matches PlantCreate schema
  const [form, setForm] = useState({
    name: "",
    species: "",
    mac_address: "",           // required by backend – the ESP32's MAC address
    moisture_threshold_min: 20,
    moisture_threshold_max: 80,
    soil_type: "loamy",
    indoor: true,
    light_condition: "",
    notes: "",
    watering_mode: "manual",
    pump_duration: 5,
    capture_rate: 30,
    notifications_enabled: true,
    alerts_enabled: true,
  });

  const set = (field) => (e) => {
    const val =
      e.target.type === "checkbox"
        ? e.target.checked
        : e.target.type === "number"
        ? Number(e.target.value)
        : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async () => {
    setError("");

    if (!form.name.trim()) return setError("Plant name is required.");
    if (!form.mac_address.trim()) return setError("Device MAC address is required.");
    if (!session?.accessToken) return setError("You must be logged in.");

    setLoading(true);
    try {
      await apiPost("/plants/", form, session.accessToken);
      alert("🌱 Plant added successfully!");
      router.push("/");
    } catch (err) {
      setError(err.message || "Failed to add plant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 px-6 py-10">

      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8 flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border
            border-green-200 text-green-700 text-sm font-medium hover:bg-green-100 transition"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-3xl font-bold text-green-700">➕ Add a New Plant</h1>
          <p className="text-gray-600 mt-2">
            Register your PlantVita device and give your plant a name.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card className="max-w-3xl mx-auto rounded-2xl shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-6">

            {/* Plant Name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Plant Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Monstera Deliciosa"
                value={form.name}
                onChange={set("name")}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {/* Species */}
            <div>
              <label className="block text-sm font-medium mb-1">Species (optional)</label>
              <input
                type="text"
                placeholder="e.g. Monstera deliciosa"
                value={form.species}
                onChange={set("species")}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {/* MAC Address – the key link between ESP32 device and backend */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Device MAC Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. AA:BB:CC:DD:EE:FF"
                value={form.mac_address}
                onChange={set("mac_address")}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                Found on your PlantVita device label or in its serial output.
              </p>
            </div>

            {/* Indoor / Outdoor */}
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <select
                value={form.indoor ? "indoor" : "outdoor"}
                onChange={(e) => setForm((p) => ({ ...p, indoor: e.target.value === "indoor" }))}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </div>

            {/* Soil Type */}
            <div>
              <label className="block text-sm font-medium mb-1">Soil Type</label>
              <select
                value={form.soil_type}
                onChange={set("soil_type")}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="loamy">Loamy</option>
                <option value="sandy">Sandy</option>
                <option value="clay">Clay</option>
                <option value="silty">Silty</option>
              </select>
            </div>

            {/* Moisture thresholds */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Min Moisture %
                </label>
                <input
                  type="number"
                  min={0} max={100}
                  value={form.moisture_threshold_min}
                  onChange={set("moisture_threshold_min")}
                  className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Moisture %
                </label>
                <input
                  type="number"
                  min={0} max={100}
                  value={form.moisture_threshold_max}
                  onChange={set("moisture_threshold_max")}
                  className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            {/* Watering mode */}
            <div>
              <label className="block text-sm font-medium mb-1">Watering Mode</label>
              <select
                value={form.watering_mode}
                onChange={set("watering_mode")}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="manual">Manual</option>
                <option value="auto">Automatic</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <textarea
                rows={3}
                placeholder="Any special care instructions…"
                value={form.notes}
                onChange={set("notes")}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 font-medium">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                className="bg-green-700 hover:bg-green-800"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Saving…" : "Save Plant"}
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}