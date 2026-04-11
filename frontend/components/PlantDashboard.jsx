"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost } from "@/lib/api";

/**
 * PlantDashboard
 *
 * Props:
 *   plant  – PlantSummary object from /dashboard/plants
 *   token  – FastAPI access token (from session.accessToken)
 *   onBack – callback to return to the plant list
 */
export default function PlantDashboard({ plant, token, onBack }) {
  const [sensor, setSensor] = useState(null);   // latest SensorReadingRead
  const [diagnosis, setDiagnosis] = useState(null); // latest ImageRead
  const [cmdLoading, setCmdLoading] = useState(false);

  /* ── Fetch latest sensor reading ─────────────────────────────────────── */
  const loadSensor = useCallback(async () => {
    try {
      // Returns readings in chronological order; we take the last one
      const readings = await apiGet(
        `/plants/${plant.id}/sensors?limit=1`,
        token
      );
      if (Array.isArray(readings) && readings.length > 0) {
        setSensor(readings[readings.length - 1]);
      }
    } catch (err) {
      console.error("Failed to load sensor data:", err);
    }
  }, [plant.id, token]);

  /* ── Fetch latest diagnosis (image + AI health) ──────────────────────── */
  const loadDiagnosis = useCallback(async () => {
    try {
      const data = await apiGet(`/plants/${plant.id}/diagnosis/`, token);
      setDiagnosis(data);
    } catch {
      // 404 means no images yet – that's fine
      setDiagnosis(null);
    }
  }, [plant.id, token]);

  /* ── Poll every 5 s ──────────────────────────────────────────────────── */
  useEffect(() => {
    loadSensor();
    loadDiagnosis();
    const interval = setInterval(() => {
      loadSensor();
      loadDiagnosis();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadSensor, loadDiagnosis]);

  /* ── Trigger water pump command ──────────────────────────────────────── */
  const handleWater = async () => {
    setCmdLoading(true);
    try {
      await apiPost(
        `/plants/${plant.mac_address}/commands`,
        { command_type: "pump" },
        token
      );
      alert("💧 Pump command sent!");
    } catch (err) {
      alert(`Failed to send command: ${err.message}`);
    } finally {
      setCmdLoading(false);
    }
  };

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const getLevel = (v, type) => {
    if (v == null) return ["—", "neutral"];
    if (type === "moisture")
      return v < 30 ? ["Low 🔴", "bad"] : v < 60 ? ["OK 🟢", "good"] : ["High 🟡", "warn"];
    if (type === "temp")
      return v < 10 ? ["Low 🔴", "bad"] : v <= 35 ? ["OK 🟢", "good"] : ["High 🟡", "warn"];
    if (type === "aqi")
      return v > 200 ? ["High 🔴", "bad"] : v > 100 ? ["Mod 🟡", "warn"] : ["Low 🟢", "good"];
    return ["OK 🟢", "good"];
  };

  const fmt = (v, dec = 1) => (v != null ? v.toFixed(dec) : "—");

  /* ── Derive health badge ─────────────────────────────────────────────── */
  const healthText = diagnosis?.detected_health || plant.latest_health_status || "Pending";
  const isCritical = plant.is_critical || healthText.toLowerCase().includes("critical");
  const badge = isCritical
    ? { text: "🚨 Critical", cls: "badge-bad" }
    : healthText.toLowerCase().includes("healthy")
    ? { text: "✅ Healthy", cls: "badge-good" }
    : { text: `⚠️ ${healthText}`, cls: "badge-warn" };

  const pumpNeedsWater = sensor ? sensor.soil_root_pct < 30 : false;

  /* ── Table rows ──────────────────────────────────────────────────────── */
  const rows = sensor
    ? [
        ["Surface Moisture", sensor.soil_surface_pct, "%", "moisture"],
        ["Root Moisture", sensor.soil_root_pct, "%", "moisture"],
        ["Soil Temp", sensor.soil_temp_c, "°C", "temp"],
        ["Air Temp", sensor.temp_c, "°C", "temp"],
        ["Humidity", sensor.humidity_pct, "%"],
        ["Light", sensor.light_lux, " lux"],
        ["Air Quality", sensor.air_quality_pct, "%", "aqi"],
        ["PPM", sensor.air_ppm, ""],
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-200 p-6">

      {/* ── Back button ──────────────────────────────────────────────── */}
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border
          border-green-200 text-green-700 text-sm font-medium hover:bg-green-100 transition"
      >
        ← Back to Plants
      </button>

      {/* ── Top section ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto
        bg-white/80 backdrop-blur rounded-2xl p-6 shadow-lg">

        {/* LEFT */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-1">
            🌱 {plant.name}
            {plant.species && (
              <span className="text-base font-normal text-gray-500 ml-2">
                ({plant.species})
              </span>
            )}
          </h2>

          <div style={{
            padding: "6px 12px", borderRadius: 20, fontWeight: 600,
            display: "inline-block", marginTop: 4,
            background: badge.cls === "badge-good" ? "#dcfce7" : badge.cls === "badge-warn" ? "#fef3c7" : "#fee2e2",
            color: badge.cls === "badge-good" ? "#16a34a" : badge.cls === "badge-warn" ? "#d97706" : "#dc2626",
          }}>{badge.text}</div>

          {diagnosis?.detected_health && (
            <p className="text-xs text-gray-400 mt-1">
              Confidence:{" "}
              {diagnosis.health_confidence != null
                ? `${(diagnosis.health_confidence * 100).toFixed(0)}%`
                : "—"}
            </p>
          )}

          {/* Sensor rows */}
          {sensor ? (
            <div className="mt-4 space-y-2">
              {rows.map(([label, val, unit, type], i) => {
                const [lvlText, cls] = getLevel(val, type);
                return (
                  <div key={i} className="flex justify-between border-b py-2">
                    <span>{label}</span>
                    <span className={`font-medium ${cls === "bad" ? "text-red-600" : cls === "warn" ? "text-yellow-600" : "text-green-600"}`}>
                      {fmt(val)}{unit} · {lvlText}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-400">
              Waiting for sensor data…
            </p>
          )}

          {/* Pump status + manual trigger */}
          <div className={`mt-6 p-4 rounded-xl shadow flex items-center justify-between
            ${pumpNeedsWater ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
            <div>
              <div className="text-xs uppercase text-gray-500 font-bold">
                Water Status
              </div>
              <div className={`text-xl font-bold ${pumpNeedsWater ? "text-red-600" : "text-green-600"}`}>
                {sensor ? (pumpNeedsWater ? "Needs Water" : "Hydrated") : "—"}
              </div>
            </div>
            <button
              onClick={handleWater}
              disabled={cmdLoading}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm
                hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {cmdLoading ? "Sending…" : "💧 Water Now"}
            </button>
          </div>
        </div>

        {/* RIGHT – plant image */}
        <div className="flex-1 flex flex-col items-center gap-4">
          <img
            src={diagnosis?.image_url || plant.latest_image_url || "/plant.jpg"}
            className="max-w-xs rounded-xl shadow-md object-cover"
            onError={(e) => { e.target.src = "/plant.jpg"; }}
            alt={plant.name}
          />
          {diagnosis?.timestamp && (
            <p className="text-xs text-gray-400">
              Photo: {new Date(diagnosis.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* ── AI Diagnosis ─────────────────────────────────────────────── */}
      {diagnosis?.ai_diagnosis && (
        <div className="max-w-6xl mx-auto mt-6 bg-white/80 backdrop-blur
          rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-2">🤖 AI Diagnosis</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {diagnosis.ai_diagnosis}
          </p>
          {diagnosis.vision_error && (
            <p className="text-xs text-red-400 mt-2">
              Vision error: {diagnosis.vision_error}
            </p>
          )}
        </div>
      )}

      {/* ── Sensor grid ──────────────────────────────────────────────── */}
      {sensor && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 max-w-6xl mx-auto">
          {[
            ["Surface Moisture", sensor.soil_surface_pct, "%", "moisture"],
            ["Root Moisture", sensor.soil_root_pct, "%", "moisture"],
            ["Soil Temp", sensor.soil_temp_c, "°C", "temp"],
            ["Air Temp", sensor.temp_c, "°C", "temp"],
            ["Humidity", sensor.humidity_pct, "%"],
            ["Light", sensor.light_lux, " lux"],
            ["Air Quality", sensor.air_quality_pct, "%", "aqi"],
            ["PPM", sensor.air_ppm, ""],
          ].map(([label, val, unit, type], i) => {
            const [, cls] = getLevel(val, type);
            return (
              <div key={i} style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.9)", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}>
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className={`text-xl font-bold ${
                  cls === "bad" ? "text-red-600" :
                  cls === "warn" ? "text-yellow-600" :
                  "text-green-600"}`}>
                  {fmt(val)}{unit}
                </div>
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}