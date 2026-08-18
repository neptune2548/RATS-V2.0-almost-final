from __future__ import annotations

import os
import time
import webbrowser
import threading
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import sys
from pathlib import Path
_CLIENT_RATS_DIR = Path(__file__).resolve().parent          # for testpull / testpush
_PROJECT_ROOT    = Path(__file__).resolve().parents[2]      # for database.py (single source of truth)
sys.path.insert(0, str(_PROJECT_ROOT))    # root first so database.py is unambiguous
sys.path.insert(0, str(_CLIENT_RATS_DIR)) # client-rats on top so local testpull/testpush win

from database import MACHINE_DB, SERIAL_TO_MACHINE
from testpull import run_pull
from testpush import run_push, find_closest_recipe, _strip_recipe_stem

app = FastAPI(title="Master Recipe Command Center")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
INDEX_HTML = BASE_DIR / "index.html"
STATIC_DIR = BASE_DIR / "static"

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/assets", StaticFiles(directory=BASE_DIR / "assets"), name="assets")

# ── Machine state derived from the real MACHINE_DB ───────────────────────────
# Each entry mirrors the frontend contract: id, name, status, current_program
# Plus real connection info: ip, port

machines: dict[str, dict[str, Any]] = {}
for _key, _info in MACHINE_DB.items():
    machines[_key] = {
        "id": _key,
        "name": _info["name"],
        "ip": _info["ip"],
        "port": _info["port"],
        "status": "IDLE",
        "current_program": "None",
        "link_status": "CONNECTING",
    }

event_log: list[dict[str, str]] = [
    {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "level": "INFO",
        "message": "Command Center initialized. Waiting for barcode scan.",
    }
]

connections: set[WebSocket] = set()


# ── Helpers ──────────────────────────────────────────────────────────────────

def snapshot() -> dict[str, Any]:
    return {
        "machines": list(machines.values()),
        "events": event_log[-100:],
    }


def add_event(message: dict | str, level: str = "INFO") -> None:
    event_log.append(
        {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "level": level,
            "message": message,
        }
    )
    del event_log[:-100]


import urllib.request
import json

MEMS_API_URL = "http://127.0.0.1:8000/api/mems/machines"
MEMS_STATES_URL = "http://127.0.0.1:8000/api/mems/states"

def fetch_mems_status_map() -> dict[str, str]:
    """Fetch live machine state telemetry from MEMS service on port 8000."""
    status_map = {}
    try:
        req = urllib.request.Request(MEMS_API_URL, headers={"User-Agent": "RATS-Sync/1.0"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            if resp.status == 200:
                items = json.loads(resp.read().decode("utf-8"))
                for m in items:
                    m_id = m.get("id")
                    m_name = m.get("name")
                    m_state = m.get("state")
                    if m_state:
                        if m_id: status_map[m_id] = m_state
                        if m_name: status_map[m_name] = m_state
                return status_map
    except Exception:
        pass

    try:
        req = urllib.request.Request(MEMS_STATES_URL, headers={"User-Agent": "RATS-Sync/1.0"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            if resp.status == 200:
                items = json.loads(resp.read().decode("utf-8"))
                for s in items:
                    m_id = s.get("machine_id")
                    m_state = s.get("state")
                    if m_id and m_state and m_id not in status_map:
                        status_map[m_id] = m_state
                return status_map
    except Exception:
        pass

    return status_map


async def poll_mems_machine_statuses():
    """Periodically sync machine status from MEMS and Section Manager state into RATS machine dict."""
    STATE_DIR = BASE_DIR.parent / "section-manager" / "state"
    
    while True:
        try:
            mems_map = await asyncio.to_thread(fetch_mems_status_map)
            has_updates = False
            
            for m_id, m_data in machines.items():
                # 1. Update from MEMS status map (if HTTP call succeeded)
                if mems_map and m_data.get("status") not in ("CHECKING", "SYNCING", "PUSHING"):
                    mems_state = mems_map.get(m_id) or mems_map.get(m_data["name"])
                    if mems_state and m_data["status"] != mems_state:
                        m_data["status"] = mems_state
                        has_updates = True
                
                # 2. Update from Section Manager state files
                safe_id = m_id.replace("#", "")
                state_file = STATE_DIR / f"{safe_id}.json"
                if state_file.exists():
                    try:
                        with open(state_file, "r", encoding="utf-8") as f:
                            state_data = json.load(f)
                            conn_status = state_data.get("connection_status")
                            if conn_status and m_data.get("link_status") != conn_status:
                                m_data["link_status"] = conn_status
                                has_updates = True
                    except Exception:
                        pass

            if has_updates:
                await broadcast_state()
        except Exception:
            pass
        await asyncio.sleep(1)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(poll_mems_machine_statuses())


async def broadcast_state() -> None:
    stale: list[WebSocket] = []
    payload = snapshot()

    for ws in connections:
        try:
            await ws.send_json(payload)
        except RuntimeError:
            stale.append(ws)

    for ws in stale:
        connections.discard(ws)


def make_log_callback(loop: asyncio.AbstractEventLoop, target_machine_id: str | None = None):
    """
    Create a log callback that is safe to call from a background thread.
    It updates machine link_status immediately when S1F2 response or errors occur,
    and schedules add_event + broadcast_state on the main event loop.
    """
    def callback(message: str | dict, level: str = "INFO"):
        add_event(message, level)

        if target_machine_id and target_machine_id in machines:
            msg_text = ""
            if isinstance(message, dict):
                msg_text = (message.get("EN", "") + " " + message.get("TH", "")).lower()
            else:
                msg_text = str(message).lower()

            if "s1f2 response received" in msg_text or "communication established" in msg_text:
                machines[target_machine_id]["link_status"] = "ONLINE"
            elif level == "ALERT" or "timeout" in msg_text or "no valid s1f2" in msg_text or "failed" in msg_text:
                machines[target_machine_id]["link_status"] = "OFFLINE"

        asyncio.run_coroutine_threadsafe(broadcast_state(), loop)
    return callback


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index() -> HTMLResponse:
    return HTMLResponse(INDEX_HTML.read_text(encoding="utf-8"))


@app.get("/api/status")
async def get_status() -> JSONResponse:
    return JSONResponse(snapshot())


@app.get("/api/lookup/{serial_number}")
async def lookup_machine(serial_number: str) -> JSONResponse:
    """Look up a machine by barcode serial number and auto-check connectivity."""
    
    machine_id = SERIAL_TO_MACHINE.get(serial_number)
    
    if machine_id is None or machine_id not in MACHINE_DB:
        add_event({"EN": f"Barcode scan failed: Unknown serial number '{serial_number}'.", "TH": f"การสแกนบาร์โค้ดล้มเหลว: ไม่พบซีเรียล '{serial_number}'"}, "ALERT")
        await broadcast_state()
        return JSONResponse({"error": "Serial number not found"}, status_code=404)
        
    target = MACHINE_DB[machine_id]
    machine_data = {
        "id": machine_id,
        "name": target["name"],
        "ip": target["ip"],
        "port": target["port"],
        "status": "IDLE",
        "current_program": "None",
        "link_status": "CONNECTING",
    }
    
    add_event({"EN": f"Barcode identified: {serial_number} assigned to {target['name']}.", "TH": f"ระบุบาร์โค้ด: {serial_number} เชื่อมโยงกับ {target['name']}"}, "SUCCESS")
    await broadcast_state()

    return JSONResponse({"machine": machine_data, "events": event_log[-100:]})

@app.post("/api/logs/clear")
async def clear_logs() -> JSONResponse:
    """Save the current event log to a text file and clear the memory."""
    import os
    logs_dir = BASE_DIR / "logs"
    os.makedirs(logs_dir, exist_ok=True)
    filename = logs_dir / f"event_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    with open(filename, "w", encoding="utf-8") as f:
        for event in event_log:
            f.write(f"[{event['timestamp']}] {event['level']} - {event['message']}\n")
    
    event_log.clear()
    add_event({"EN": f"Event log successfully archived to {filename.name} and purged from memory.", "TH": f"บันทึกเหตุการณ์ถูกจัดเก็บลง {filename.name} และล้างออกจากหน่วยความจำเรียบร้อยแล้ว"}, "INFO")
    await broadcast_state()
    return JSONResponse({"status": "ok", "events": event_log[-100:]})





@app.post("/api/machines/{machine_id}/pull")
async def pull_program(machine_id: str) -> JSONResponse:
    """Pull (sync) all new recipes from a machine via SECS/GEM."""
    machine = machines.get(machine_id)
    if machine is None:
        return JSONResponse({"error": "Machine not found"}, status_code=404)

    add_event({"EN": f"Initiating recipe synchronization (PULL) for {machine['name']}...", "TH": f"กำลังเริ่มซิงค์สูตร (PULL) สำหรับ {machine['name']}..."}, "INFO")
    await broadcast_state()

    # Update machine status
    machine["status"] = "SYNCING"
    await broadcast_state()

    loop = asyncio.get_running_loop()
    log_callback = make_log_callback(loop)

    try:
        result = await asyncio.to_thread(run_pull, machine_id, log_callback)
        if result.get("status") == "ok":
            machine["link_status"] = "ONLINE"
        else:
            machine["link_status"] = "OFFLINE"
    except Exception as e:
        result = {"status": "error", "message": str(e), "pulled": [], "skipped": []}
        machine["link_status"] = "OFFLINE"
        add_event({"EN": f"Synchronization sequence failed: {e}", "TH": f"กระบวนการซิงค์ล้มเหลว: {e}"}, "ALERT")
        await broadcast_state()

    # Reset machine status
    machine["status"] = "IDLE"
    await broadcast_state()

    return JSONResponse({"result": result, "machine": machine, "events": event_log[-100:]})


@app.post("/api/machines/{machine_id}/push")
async def push_program(machine_id: str, body: dict | None = None) -> JSONResponse:
    """Push a recipe program to a machine via SECS/GEM."""
    machine = machines.get(machine_id)
    if machine is None:
        return JSONResponse({"error": "Machine not found"}, status_code=404)

    # Program names come from the New Program barcode/text field.
    program_name = (body or {}).get("program_name", "").strip()
    if not program_name:
        return JSONResponse({"error": "program_name is required"}, status_code=400)

    add_event({"EN": f"Initiating recipe transfer (PUSH) for program '{program_name}' to {machine['name']}...", "TH": f"กำลังเริ่มส่งสูตร (PUSH) '{program_name}' ไปยัง {machine['name']}..."}, "INFO")
    await broadcast_state()

    # Update machine status
    machine["status"] = "PUSHING"
    await broadcast_state()

    loop = asyncio.get_running_loop()
    log_callback = make_log_callback(loop)

    try:
        result = await asyncio.to_thread(run_push, machine_id, program_name, log_callback)
        if result.get("status") == "ok":
            machine["current_program"] = program_name
            machine["link_status"] = "ONLINE"
        else:
            machine["link_status"] = "OFFLINE"
    except Exception as e:
        result = {"status": "error", "message": str(e), "ackc7": None}
        machine["link_status"] = "OFFLINE"
        add_event({"EN": f"Transfer sequence failed: {e}", "TH": f"กระบวนการส่งสูตรล้มเหลว: {e}"}, "ALERT")
        await broadcast_state()

    # Reset machine status
    machine["status"] = "IDLE"
    await broadcast_state()

    return JSONResponse({"result": result, "machine": machine, "events": event_log[-100:]})


@app.post("/api/machines/{machine_id}/delete")
async def delete_program(machine_id: str, body: dict | None = None) -> JSONResponse:
    """Delete a recipe program from a machine via SECS/GEM."""
    machine = machines.get(machine_id)
    if machine is None:
        return JSONResponse({"error": "Machine not found"}, status_code=404)

    program_name = (body or {}).get("program_name", "").strip()
    if not program_name:
        return JSONResponse({"error": "program_name is required"}, status_code=400)

    add_event({"EN": f"Initiating recipe deletion (DELETE) for program '{program_name}' on {machine['name']}...", "TH": f"กำลังเริ่มลบสูตร '{program_name}' จากเครื่อง {machine['name']}..."}, "INFO")
    await broadcast_state()

    machine["status"] = "DELETING"
    await broadcast_state()

    loop = asyncio.get_running_loop()
    log_callback = make_log_callback(loop)

    from testdelete import run_delete
    try:
        result = await asyncio.to_thread(run_delete, machine_id, program_name, log_callback)
        if result.get("status") == "ok":
            machine["link_status"] = "ONLINE"
            if machine.get("current_program") == program_name:
                machine["current_program"] = "None"
        else:
            machine["link_status"] = "OFFLINE"
    except Exception as e:
        result = {"status": "error", "message": str(e)}
        machine["link_status"] = "OFFLINE"
        add_event({"EN": f"Deletion sequence failed: {e}", "TH": f"กระบวนการลบล้มเหลว: {e}"}, "ALERT")
        await broadcast_state()

    machine["status"] = "IDLE"
    await broadcast_state()

    return JSONResponse({"result": result, "machine": machine, "events": event_log[-100:]})


@app.get("/api/machines/{machine_id}/recipes")
async def list_recipes(machine_id: str) -> JSONResponse:
    """List available .PWB recipe files from BondingProg root (excludes subdirs)."""
    machine_dir = _PROJECT_ROOT / "BondingProg"

    recipes: list[str] = []

    if machine_dir.is_dir():
        seen: set[str] = set()
        for f in sorted(machine_dir.iterdir(), key=lambda p: p.name):
            if not f.is_file():
                continue
            if not f.name.upper().endswith(".PWB"):
                continue
            clean = _strip_recipe_stem(f.name)
            if clean.upper() not in seen:
                seen.add(clean.upper())
                recipes.append(clean)

    return JSONResponse({"recipes": recipes})


@app.post("/api/recipes/suggest")
async def suggest_recipe(body: dict | None = None) -> JSONResponse:
    """Find the closest matching recipe when exact name is not found."""
    recipe_name = (body or {}).get("recipe_name", "").strip()
    if not recipe_name:
        return JSONResponse({"error": "recipe_name is required"}, status_code=400)

    target_dir = str(_PROJECT_ROOT / "BondingProg")

    # Check if exact file exists (with .PWB extension)
    exact_path = f"{target_dir}/{recipe_name}.PWB"
    if os.path.exists(exact_path):
        return JSONResponse({"exact_match": True, "recipe": recipe_name})

    # Also check .WB.PWB variant
    wb_path = f"{target_dir}/{recipe_name}.WB.PWB"
    if os.path.exists(wb_path):
        return JSONResponse({"exact_match": True, "recipe": recipe_name})

    # No exact match → find closest
    suggestion = find_closest_recipe(recipe_name, target_dir)
    if suggestion:
        return JSONResponse({"exact_match": False, "recipe": recipe_name, "suggestion": suggestion})
    else:
        return JSONResponse({"exact_match": False, "recipe": recipe_name, "suggestion": None})


@app.websocket("/ws")
async def websocket_status(websocket: WebSocket) -> None:
    await websocket.accept()
    connections.add(websocket)
    await websocket.send_json(snapshot())

    try:
        while True:
            await asyncio.sleep(15)
            await websocket.send_json(snapshot())
    except WebSocketDisconnect:
        connections.discard(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=True)

