from flask import Flask, request, jsonify
from datetime import datetime
import os

app = Flask(__name__)

# ── Pretty-print helpers ────────────────────────────────────────────────────

RESET  = "\033[0m"
GREEN  = "\033[92m"
CYAN   = "\033[96m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BOLD   = "\033[1m"

def bar(value, max_val=100, width=20):
    """Simple ASCII progress bar."""
    filled = int((value / max_val) * width)
    return f"[{'█' * filled}{'░' * (width - filled)}] {value:.1f}%"

def moisture_color(pct):
    if pct < 25:   return RED
    if pct < 50:   return YELLOW
    return GREEN

# ── Route ───────────────────────────────────────────────────────────────────

@app.route("/data", methods=["POST"])
def receive_data():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "no json"}), 400

    ts   = datetime.now().strftime("%H:%M:%S")
    temp = data.get("temp_c",           0)
    humi = data.get("humidity_pct",     0)
    lux  = data.get("light_lux",        0)
    ppm  = data.get("air_ppm",          0)
    aq   = data.get("air_quality_pct",  0)
    surf = data.get("soil_surface_pct", 0)
    root = data.get("soil_root_pct",    0)

    print(f"\n{BOLD}{CYAN}{'─'*52}{RESET}")
    print(f"{BOLD} Plant-Vita Device │  {ts}{RESET}")
    print(f"{CYAN}{'─'*52}{RESET}")
    print(f"  {YELLOW} Temperature  {RESET}: {temp:.1f} °C")
    print(f"  {YELLOW} Humidity     {RESET}: {humi:.1f} %")
    print(f"  {YELLOW} Light        {RESET}: {lux:.0f} lux")
    print(f"  {YELLOW} Air Quality  {RESET}: {ppm:.0f} ppm  ({aq}%)")
    print(f"  {moisture_color(surf)} Soil Surface {RESET}: {bar(surf)}")
    print(f"  {moisture_color(root)} Soil Root    {RESET}: {bar(root)}")
    print(f"{CYAN}{'─'*52}{RESET}")

    return jsonify({"status": "ok"}), 200


@app.route("/", methods=["GET"])
def index():
    return "Plant-Vita receiver is running.", 200

@app.route("/plants/<mac>/image/", methods=["POST"])
def receive_image(mac):
    ts = datetime.now().strftime("%H:%M:%S")
    
    if request.content_type != "image/jpeg":
        print(f"{RED}Wrong content type: {request.content_type}{RESET}")
        return jsonify({"error": "expected image/jpeg"}), 400

    img_bytes = request.data
    if not img_bytes:
        print(f"{RED}No image data received{RESET}")
        return jsonify({"error": "no image data"}), 400

    # Save to disk so you can verify it opened correctly
    os.makedirs("received_images", exist_ok=True)
    filename = f"received_images/{mac}_{ts.replace(':', '')}.jpg"
    with open(filename, "wb") as f:
        f.write(img_bytes)

    print(f"\n{BOLD}{CYAN}{'─'*52}{RESET}")
    print(f"{BOLD} Image Received │ {ts}{RESET}")
    print(f"{CYAN}{'─'*52}{RESET}")
    print(f"  {YELLOW} MAC          {RESET}: {mac}")
    print(f"  {YELLOW} Size         {RESET}: {len(img_bytes):,} bytes ({len(img_bytes)/1024:.1f} KB)")
    print(f"  {GREEN} Saved to     {RESET}: {filename}")
    print(f"{CYAN}{'─'*52}{RESET}")

    return jsonify({"status": "ok", "bytes_received": len(img_bytes)}), 200


# ── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    PORT = 8888
    print(f"\n{BOLD}{GREEN}Plant-Vita Receiver started on port {PORT}{RESET}")
    print(f"Waiting for ESP32 data at  http://0.0.0.0:{PORT}/data\n")
    app.run(host="0.0.0.0", port=PORT, debug=False)