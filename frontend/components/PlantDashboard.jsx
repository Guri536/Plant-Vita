"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Droplet, Thermometer, Wind, Sun, Zap, Gauge as GaugeIcon, Activity, Camera } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --forest: #1a2e1a; --canopy: #2d4a2d; --leaf: #4a7c59;
    --mint: #7fb896; --cream: #f5f0e8;
    --mist: rgba(255,255,255,0.06);
  }
  .dash { font-family: 'DM Sans', sans-serif; min-height: 100vh; background: var(--forest); color: var(--cream); }
  .display { font-family: 'Playfair Display', serif; }

  .sensor-card {
    background: var(--canopy);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 20px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .sensor-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }

  .gauge-ring {
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
  }
  .gauge-track { fill: none; stroke: rgba(255,255,255,0.06); }
  .gauge-fill  { fill: none; stroke-linecap: round; transition: stroke-dashoffset 1s ease; }

  .water-btn {
    padding: 12px 24px;
    border-radius: 10px;
    background: linear-gradient(135deg, #1d4ed8, #3b82f6);
    color: #fff; border: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s;
    display: flex; align-items: center; gap: 8px;
  }
  .water-btn:hover:not(:disabled) { opacity: 0.9; transform: scale(1.03); }
  .water-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .back-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--cream); font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 500; cursor: pointer;
    transition: background 0.2s;
    text-decoration: none;
  }
  .back-btn:hover { background: rgba(255,255,255,0.1); }

  .health-pill {
    font-size: 12px; font-weight: 600;
    letter-spacing: 0.05em; text-transform: uppercase;
    padding: 4px 12px; border-radius: 20px; display: inline-block;
  }
  .badge-good { background: #14532d33; color: #4ade80; border: 1px solid #14532d88; }
  .badge-warn { background: #78350f33; color: #fbbf24; border: 1px solid #78350f88; }
  .badge-bad  { background: #7f1d1d33; color: #f87171; border: 1px solid #7f1d1d88; }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .pulsing { animation: pulse 2s ease infinite; }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .fade-up { animation: fadeUp 0.4s ease forwards; }
`;

/* ── Gauge component ──────────────────────────────────────────────────────── */
function Gauge({ value, max = 100, color = "#7fb896", size = 72 }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = value != null ? Math.min(Math.max(value / max, 0), 1) : 0;
  const offset = circ * (1 - pct);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle className="gauge-track gauge-ring" cx="32" cy="32" r={r} strokeWidth="5" />
      <circle
        className="gauge-fill gauge-ring" cx="32" cy="32" r={r} strokeWidth="5"
        stroke={color}
        strokeDasharray={circ}
        strokeDashoffset={value != null ? offset : circ}
      />
      <text x="32" y="36" textAnchor="middle"
        style={{ fontSize: 13, fontWeight: 700, fill: "#f5f0e8", fontFamily: "'DM Sans', sans-serif" }}>
        {value != null ? `${Math.round(value)}` : "—"}
      </text>
    </svg>
  );
}

/* ── Sensor card ──────────────────────────────────────────────────────────── */
function SensorCard({ label, value, unit, icon, color, gaugeMax, type }) {
  const getStatus = () => {
    if (value == null) return null;
    if (type === "moisture") return value < 30 ? "Low" : value < 60 ? "Good" : "High";
    if (type === "temp")     return value < 10 ? "Low" : value <= 35 ? "Good" : "High";
    if (type === "aqi")      return value > 200 ? "Poor" : value > 100 ? "Moderate" : "Good";
    return "Good";
  };
  const status = getStatus();
  const statusColor = status === "Good" ? "#4ade80" : status === "Low" || status === "Poor" ? "#f87171" : "#fbbf24";

  return (
    <div className="sensor-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(245,240,232,0.4)", fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {label}
          </div>
          <div className="display" style={{ fontSize: 28, color: "#f5f0e8", lineHeight: 1 }}>
            {value != null ? value.toFixed(1) : "—"}
            <span style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 400, color: "rgba(245,240,232,0.4)", marginLeft: 3 }}>{unit}</span>
          </div>
          {status && (
            <div style={{ marginTop: 6, fontSize: 12, color: statusColor, fontWeight: 500 }}>
              ● {status}
            </div>
          )}
        </div>
        <Gauge value={value} max={gaugeMax || 100} color={color} />
      </div>
    </div>
  );
}

/* ── Main dashboard ───────────────────────────────────────────────────────── */
export default function PlantDashboard({ plant, token, onBack }) {
  const [sensor, setSensor] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [cmdLoading, setCmdLoading] = useState(false);

  const loadSensor = useCallback(async () => {
    try {
      const readings = await apiGet(`/plants/${plant.id}/sensors?limit=1`, token);
      if (Array.isArray(readings) && readings.length > 0)
        setSensor(readings[readings.length - 1]);
    } catch (err) { console.error("Sensor load failed:", err); }
  }, [plant.id, token]);

  const loadDiagnosis = useCallback(async () => {
    try {
      setDiagnosis(await apiGet(`/plants/${plant.id}/diagnosis/`, token));
    } catch { setDiagnosis(null); }
  }, [plant.id, token]);

  useEffect(() => {
    loadSensor(); loadDiagnosis();
    const iv = setInterval(() => { loadSensor(); loadDiagnosis(); }, 5000);
    return () => clearInterval(iv);
  }, [loadSensor, loadDiagnosis]);

  const handleWater = async () => {
    setCmdLoading(true);
    try {
      await apiPost(`/plants/${plant.mac_address}/commands`, { command_type: "pump" }, token);
      alert("💧 Pump command sent!");
    } catch (err) { alert(`Failed: ${err.message}`); }
    finally { setCmdLoading(false); }
  };

  /* ── Health badge ─────────────────────────────────────────────────────── */
  const healthText = diagnosis?.detected_health || plant.latest_health_status || "Pending";
  const isCritical = plant.is_critical || healthText.toLowerCase().includes("critical");
  const badge = isCritical ? { text: "Critical", cls: "badge-bad" }
    : healthText.toLowerCase().includes("healthy") ? { text: "Healthy", cls: "badge-good" }
    : healthText === "Pending" ? { text: "Pending", cls: "badge-warn" }
    : { text: healthText, cls: "badge-warn" };

  const pumpNeedsWater = sensor ? sensor.soil_root_pct < 30 : false;
  const imageUrl = diagnosis?.image_url || plant.latest_image_url || "/plant.jpg";

  return (
    <div className="dash">
      <style>{css}</style>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(26,46,26,0.95)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Plants
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={`health-pill ${badge.cls}`}>{badge.text}</span>
          {diagnosis?.health_confidence != null && (
            <span style={{ fontSize: 12, color: "rgba(245,240,232,0.35)" }}>
              {(diagnosis.health_confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 32px 60px" }}>

        {/* ── Hero row ─────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 28, marginBottom: 28 }} className="fade-up">

          {/* LEFT — info + water control */}
          <div style={{
            background: "var(--canopy)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: 28,
          }}>
            <h2 className="display" style={{ fontSize: 34, marginBottom: 4 }}>
              🌱 {plant.name}
            </h2>
            {plant.species && (
              <p style={{ fontSize: 14, color: "rgba(245,240,232,0.4)", fontStyle: "italic", marginBottom: 24 }}>
                {plant.species}
              </p>
            )}

            {/* Water status */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: pumpNeedsWater ? "rgba(239,68,68,0.08)" : "rgba(74,124,89,0.1)",
              border: `1px solid ${pumpNeedsWater ? "rgba(239,68,68,0.2)" : "rgba(74,124,89,0.2)"}`,
              borderRadius: 14, padding: "18px 22px", marginBottom: 24,
            }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(245,240,232,0.4)", marginBottom: 4 }}>Water Status</div>
                <div className="display" style={{ fontSize: 26, color: pumpNeedsWater ? "#f87171" : "#4ade80" }}>
                  {sensor ? (pumpNeedsWater ? "Needs Water" : "Hydrated") : "—"}
                </div>
              </div>
              <button className="water-btn" onClick={handleWater} disabled={cmdLoading}>
                <Droplet size={15} />
                {cmdLoading ? "Sending…" : "Water Now"}
              </button>
            </div>

            {/* Sensor summary rows */}
            {sensor ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  ["Surface Moisture", sensor.soil_surface_pct, "%"],
                  ["Root Moisture",    sensor.soil_root_pct, "%"],
                  ["Soil Temp",        sensor.soil_temp_c, "°C"],
                  ["Air Temp",         sensor.temp_c, "°C"],
                  ["Humidity",         sensor.humidity_pct, "%"],
                  ["Light",            sensor.light_lux, " lux"],
                  ["Air Quality",      sensor.air_quality_pct, "%"],
                  ["PPM",              sensor.air_ppm, ""],
                ].map(([label, val, unit]) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <span style={{ fontSize: 13, color: "rgba(245,240,232,0.55)" }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--cream)" }}>
                      {val != null ? val.toFixed(1) : "—"}{unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Activity size={28} color="rgba(245,240,232,0.2)" style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: 13, color: "rgba(245,240,232,0.3)" }} className="pulsing">
                  Waiting for sensor data…
                </p>
              </div>
            )}
          </div>

          {/* RIGHT — plant image */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              borderRadius: 20, overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "var(--canopy)", flex: 1,
              position: "relative",
            }}>
              <img
                src={imageUrl}
                style={{ width: "100%", height: 280, objectFit: "cover", display: "block" }}
                onError={(e) => { e.target.src = "/plant.jpg"; }}
                alt={plant.name}
              />
              <div style={{
                position: "absolute", bottom: 0, insetInline: 0,
                background: "linear-gradient(to top, rgba(26,46,26,0.9), transparent)",
                padding: "20px 16px 14px",
              }}>
                {diagnosis?.timestamp && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(245,240,232,0.5)", fontSize: 11 }}>
                    <Camera size={12} />
                    {new Date(diagnosis.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Mac address chip */}
            <div style={{
              background: "var(--canopy)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "12px 16px",
            }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(245,240,232,0.3)", marginBottom: 4 }}>Device MAC</div>
              <div style={{ fontSize: 13, fontFamily: "monospace", color: "var(--mint)" }}>{plant.mac_address || "—"}</div>
            </div>
          </div>
        </div>

        {/* ── Sensor Grid ──────────────────────────────────────────────── */}
        {sensor && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
            <SensorCard label="Surface Moisture" value={sensor.soil_surface_pct} unit="%" icon={Droplet}   color="#60a5fa" type="moisture" />
            <SensorCard label="Root Moisture"    value={sensor.soil_root_pct}     unit="%" icon={Droplet}   color="#3b82f6" type="moisture" />
            <SensorCard label="Soil Temp"        value={sensor.soil_temp_c}        unit="°C" icon={Thermometer} color="#fb923c" gaugeMax={50} type="temp" />
            <SensorCard label="Air Temp"         value={sensor.temp_c}             unit="°C" icon={Thermometer} color="#f97316" gaugeMax={50} type="temp" />
            <SensorCard label="Humidity"         value={sensor.humidity_pct}       unit="%" icon={Wind}     color="#2dd4bf" />
            <SensorCard label="Light"            value={sensor.light_lux}          unit=" lux" icon={Sun}   color="#fbbf24" gaugeMax={2000} />
            <SensorCard label="Air Quality"      value={sensor.air_quality_pct}    unit="%" icon={GaugeIcon}   color="#a78bfa" type="aqi" />
            <SensorCard label="PPM"              value={sensor.air_ppm}            unit="" icon={Zap}      color="#34d399" gaugeMax={500} />
          </div>
        )}

        {/* ── AI Diagnosis ─────────────────────────────────────────────── */}
        {diagnosis?.ai_diagnosis && (
          <div style={{
            background: "var(--canopy)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: 28,
          }}>
            <h3 className="display" style={{ fontSize: 22, marginBottom: 16 }}>🤖 AI Diagnosis</h3>
            <p style={{ fontSize: 14, color: "rgba(245,240,232,0.75)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {diagnosis.ai_diagnosis}
            </p>
            {diagnosis.vision_error && (
              <p style={{ fontSize: 12, color: "#f87171", marginTop: 12 }}>
                Vision error: {diagnosis.vision_error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}