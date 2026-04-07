"use client";

import { useEffect, useState } from "react";

export default function PlantDashboard() {

  const [data, setData] = useState(null);

  /* ================= HELPERS ================= */

  const getStatusClass = (v, type) => {
    if (type === "moisture") return v < 30 ? "bad" : v < 50 ? "warn" : "good";
    if (type === "aqi") return v > 200 ? "bad" : v > 100 ? "warn" : "good";
    return "good";
  };

  const getLevel = (v, type) => {
    if (type === "moisture") return v < 30 ? ["Low", "bad"] : v < 60 ? ["OK", "good"] : ["High", "warn"];
    if (type === "temp") return v < 10 ? ["Low", "bad"] : v <= 35 ? ["OK", "good"] : ["High", "warn"];
    if (type === "aqi") return v > 200 ? ["High", "bad"] : v > 100 ? ["OK", "warn"] : ["Low", "good"];
    return ["OK", "good"];
  };

  /* ================= FETCH ================= */

  const loadData = async () => {
    try {
      const res = await fetch(`/sensor_data.json?t=${Date.now()}`);
      const json = await res.json();
      setData(json[0]);
    } catch (e) {
      console.log("Waiting for data...", e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <div className="p-10">Loading...</div>;

  /* ================= DERIVED ================= */

  const pumpNeedsWater = data["Root_Moisture_%"] < 30;

  const score =
    (data["Root_Moisture_%"] >= 30 ? 1 : 0) +
    (data["Air_Quality_Index"] <= 150 ? 1 : 0);

  const badge =
    score === 2
      ? { text: "✅ Healthy", cls: "badge-good" }
      : score === 1
      ? { text: "⚠️ Moderate", cls: "badge-warn" }
      : { text: "🚨 Critical", cls: "badge-bad" };

  const rows = [
    ["Surface Moisture", data["Surface_Moisture_%"], "moisture"],
    ["Root Moisture", data["Root_Moisture_%"], "moisture"],
    ["Soil Temp", data["Soil_Temp_C"], "temp"],
    ["Air Temp", data["Temperature_C"], "temp"],
    ["Air Quality", data["Air_Quality_Index"], "aqi"]
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-200 p-6">

      {/* ================= TOP SECTION ================= */}
      <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto bg-white/80 backdrop-blur rounded-2xl p-6 shadow-lg">

        {/* LEFT */}
        <div className="flex-1">

          <h2 className="text-2xl font-bold mb-2">
            🌱 {data["Plant_Name"]}
          </h2>

          <div className={`health-badge ${badge.cls}`}>
            {badge.text}
          </div>

          {/* Predictions */}
          <div className="mt-4 space-y-2">
            {rows.map((r, i) => {
              const [lvl, cls] = getLevel(r[1], r[2]);
              return (
                <div key={i} className="flex justify-between border-b py-2">
                  <div>{r[0]}</div>
                  <div className={`px-2 rounded ${cls}`}>{lvl}</div>
                </div>
              );
            })}
          </div>

          {/* Pump */}
          <div className={`mt-6 p-4 rounded-xl shadow ${pumpNeedsWater ? "bad" : "good"}`}>
            <div className="text-xs uppercase text-gray-500 font-bold">
              Water Pump Status
            </div>
            <div className="text-2xl font-bold">
              {pumpNeedsWater ? "Needs Water" : "Hydrated"}
            </div>
          </div>

        </div>

        {/* RIGHT IMAGE */}
        <div className="flex-1 flex justify-center">
          <img
            src={data["Plant_Image"] || "/plant.jpg"}
            className="max-w-xs rounded-xl shadow-md"
          />
        </div>

      </div>

      {/* ================= GRID ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-6xl mx-auto">

        {[
          ["Surface Moisture", data["Surface_Moisture_%"], "%", "moisture"],
          ["Root Moisture", data["Root_Moisture_%"], "%", "moisture"],
          ["Soil Temp", data["Soil_Temp_C"], "°C"],
          ["Air Temp", data["Temperature_C"], "°C"],
          ["Humidity", data["Humidity_%"], "%"],
          ["Light", data["Light_Lux"], "lux"],
          ["AQI", data["Air_Quality_Index"], "", "aqi"],
          ["PPM", data["PPM"], ""]
        ].map((item, i) => (
          <div key={i} className="card">
            <div>{item[0]}</div>
            <div className={getStatusClass(item[1], item[3])}>
              {item[1].toFixed(2)} {item[2]}
            </div>
          </div>
        ))}

      </div>

      {/* ================= STYLES ================= */}
      <style jsx>{`
        .card {
          padding: 18px;
          border-radius: 14px;
          background: rgba(255,255,255,0.9);
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .good { color: #16a34a; }
        .warn { color: #d97706; }
        .bad { color: #dc2626; }

        .health-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-weight: 600;
          display: inline-block;
        }
        .badge-good { background: #dcfce7; color: #16a34a; }
        .badge-warn { background: #fef3c7; color: #d97706; }
        .badge-bad { background: #fee2e2; color: #dc2626; }
      `}</style>

    </div>
  );
}