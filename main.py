from __future__ import annotations

import time
import webbrowser
import threading
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from database import MACHINE_DB, SERIAL_TO_MACHINE
from testlink import run_check
from testpull import run_pull
from testpush import run_push

app = FastAPI(title="Master Recipe Command Center")

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
    pending_recipes = []
    bonding_prog = BASE_DIR / "BondingProg"
    if bonding_prog.is_dir():
        for file in bonding_prog.glob("*.pending"):
            pending_recipes.append(file.name.replace(".PWB.pending", ""))
            
    return {
        "machines": list(machines.values()),
        "events": event_log[-100:],
        "pending_recipes": pending_recipes
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


def make_log_callback(loop: asyncio.AbstractEventLoop):
    """
    Create a log callback that is safe to call from a background thread.
    It schedules add_event + broadcast_state on the main event loop.
    """
    def callback(message: str, level: str = "INFO"):
        add_event(message, level)
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
    
    # 1. ใช้ SERIAL_MAPPING ที่ดึงมาจาก database.py แทน
    machine_id = SERIAL_TO_MACHINE.get(serial_number)
    
    # 2. เช็คว่าเจอใน Mapping ไหม และมีข้อมูลเครื่องใน MACHINE_DB จริงหรือเปล่า
    if machine_id is None or machine_id not in MACHINE_DB:
        add_event({"EN": f"Barcode scan failed: Unknown serial number '{serial_number}'.", "TH": f"การสแกนบาร์โค้ดล้มเหลว: ไม่พบซีเรียล '{serial_number}'"}, "ALERT")
        await broadcast_state()
        return JSONResponse({"error": "Serial number not found"}, status_code=404)
        
    # 3. ดึงข้อมูลจาก MACHINE_DB แล้วปั้นให้อยู่ใน Format ที่หน้าเว็บ (Frontend) ต้องการ
    target = MACHINE_DB[machine_id]
    machine_data = {
        "id": machine_id,
        "name": target["name"],
        "ip": target["ip"],
        "port": target["port"],
        "status": "IDLE",
        "current_program": "None",
        "link_status": "CHECKING",
    }
    
    add_event({"EN": f"Barcode identified: {serial_number} assigned to {target['name']}.", "TH": f"ระบุบาร์โค้ด: {serial_number} เชื่อมโยงกับ {target['name']}"}, "SUCCESS")
    add_event({"EN": f"Initiating automated connectivity check for {target['name']}...", "TH": f"กำลังเริ่มตรวจสอบการเชื่อมต่ออัตโนมัติสำหรับ {target['name']}..."}, "INFO")
    await broadcast_state()

    # 4. ส่ง response กลับก่อน แล้วเช็คการเชื่อมต่อใน background
    loop = asyncio.get_running_loop()
    log_callback = make_log_callback(loop)

    async def _auto_link_check():
        try:
            result = await asyncio.to_thread(run_check, machine_id, log_callback)
            if result.get("status") == "ok":
                machine_data["link_status"] = "ONLINE"
                add_event({"EN": f"Connectivity verified: {target['name']} is online.", "TH": f"ตรวจสอบการเชื่อมต่อสำเร็จ: {target['name']} ออนไลน์"}, "SUCCESS")
            else:
                machine_data["link_status"] = "OFFLINE"
                add_event({"EN": f"Connectivity check failed: {result.get('message', 'unknown')}", "TH": f"การตรวจสอบการเชื่อมต่อล้มเหลว: {result.get('message', 'unknown')}"}, "ALERT")
        except Exception as e:
            machine_data["link_status"] = "OFFLINE"
            add_event({"EN": f"System error during connectivity check: {e}", "TH": f"เกิดข้อผิดพลาดของระบบระหว่างตรวจสอบการเชื่อมต่อ: {e}"}, "ALERT")
        # Update the machines dict so WS broadcasts carry the link status
        if machine_id in machines:
            machines[machine_id]["link_status"] = machine_data["link_status"]
        await broadcast_state()

    asyncio.create_task(_auto_link_check())

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


@app.post("/api/machines/{machine_id}/check")
async def check_machine(machine_id: str) -> JSONResponse:
    """Check connectivity to a machine via SECS/GEM."""
    machine = machines.get(machine_id)
    if machine is None:
        return JSONResponse({"error": "Machine not found"}, status_code=404)

    add_event({"EN": f"Executing manual connectivity diagnostic for {machine['name']}...", "TH": f"กำลังดำเนินการตรวจสอบการเชื่อมต่อด้วยตนเองสำหรับ {machine['name']}..."}, "INFO")
    await broadcast_state()

    # Update machine status
    machine["status"] = "CHECKING"
    await broadcast_state()

    loop = asyncio.get_running_loop()
    log_callback = make_log_callback(loop)

    try:
        result = await asyncio.to_thread(run_check, machine_id, log_callback)
    except Exception as e:
        result = {"status": "error", "message": str(e), "recipe_count": 0}
        add_event({"EN": f"Diagnostic execution failed: {e}", "TH": f"การตรวจสอบล้มเหลว: {e}"}, "ALERT")
        await broadcast_state()

    # Reset machine status
    machine["status"] = "IDLE"
    await broadcast_state()

    return JSONResponse({"result": result, "machine": machine, "events": event_log[-100:]})


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
    except Exception as e:
        result = {"status": "error", "message": str(e), "pulled": [], "skipped": []}
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
    except Exception as e:
        result = {"status": "error", "message": str(e), "ackc7": None}
        add_event({"EN": f"Transfer sequence failed: {e}", "TH": f"กระบวนการส่งสูตรล้มเหลว: {e}"}, "ALERT")
        await broadcast_state()

    # Update current_program on success
    if result.get("status") == "ok":
        machine["current_program"] = program_name

    # Reset machine status
    machine["status"] = "IDLE"
    await broadcast_state()

    return JSONResponse({"result": result, "machine": machine, "events": event_log[-100:]})


@app.get("/api/machines/{machine_id}/recipes")
async def list_recipes(machine_id: str) -> JSONResponse:
    """List available .PWB recipe files for a given machine subfolder."""
    machine_id_safe = machine_id.replace("#", "_")
    machine_dir = Path("C:/tmp/BondingProg") / machine_id_safe

    recipes: list[str] = []

    if machine_dir.is_dir():
        recipes = sorted(
            f.stem
            for f in machine_dir.iterdir()
            if f.is_file() and f.suffix.upper() == ".PWB"
        )

    return JSONResponse({"recipes": recipes})

@app.post("/api/events")
async def receive_event(body: dict) -> JSONResponse:
    level = body.get("level", "INFO")
    message = body.get("message")
    if message:
        add_event(message, level)
        await broadcast_state()
        return JSONResponse({"status": "ok"})
    return JSONResponse({"error": "missing message"}, status_code=400)

@app.post("/api/recipes/approve")
async def approve_recipe(body: dict) -> JSONResponse:
    recipe_name = body.get("recipe_name")
    if not recipe_name:
        return JSONResponse({"error": "recipe_name required"}, status_code=400)
    
    bonding_prog = BASE_DIR / "BondingProg"
    pending_file = bonding_prog / f"{recipe_name}.PWB.pending"
    target_file = bonding_prog / f"{recipe_name}.PWB"
    
    if pending_file.exists():
        if target_file.exists():
            target_file.unlink()
        pending_file.rename(target_file)
        add_event({"EN": f"Recipe {recipe_name} update approved and saved.", "TH": f"อนุมัติอัปเดต Recipe {recipe_name} เรียบร้อย"}, "SUCCESS")
        await broadcast_state()
        return JSONResponse({"status": "ok"})
    return JSONResponse({"error": "Pending recipe not found"}, status_code=404)

@app.post("/api/recipes/reject")
async def reject_recipe(body: dict) -> JSONResponse:
    recipe_name = body.get("recipe_name")
    if not recipe_name:
        return JSONResponse({"error": "recipe_name required"}, status_code=400)
    
    bonding_prog = BASE_DIR / "BondingProg"
    pending_file = bonding_prog / f"{recipe_name}.PWB.pending"
    
    if pending_file.exists():
        pending_file.unlink()
        add_event({"EN": f"Recipe {recipe_name} update rejected.", "TH": f"ปฏิเสธการอัปเดต Recipe {recipe_name}"}, "ALERT")
        await broadcast_state()
        return JSONResponse({"status": "ok"})
    return JSONResponse({"error": "Pending recipe not found"}, status_code=404)


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
    
    # --- เริ่มส่วนที่เพิ่มเข้ามาใหม่ (สั่งเปิดเบราว์เซอร์อัตโนมัติ) ---
    def open_browser():
        # รอให้ uvicorn รันให้เสร็จก่อน 2 วินาที ค่อยเปิดหน้าเว็บ
        time.sleep(2) 
        webbrowser.open("http://127.0.0.1:8080")
        
    # แยก Thread ไปรันฟังก์ชันเปิดเบราว์เซอร์ จะได้ไม่บล็อกการสตาร์ทของ uvicorn
    threading.Thread(target=open_browser, daemon=True).start()
    # --- จบส่วนที่เพิ่มเข้ามาใหม่ ---

    # Command to run the server:
    # uvicorn main:app --reload
    # Or you can just run this script directly:
    # python main.py
    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=True)
    # Command to run the server:
    # uvicorn main:app --reload
    # Or you can just run this script directly:
    # python main.py
    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=True)

