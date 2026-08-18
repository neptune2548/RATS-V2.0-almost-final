import json
import logging
import os
import time
import sys
from pathlib import Path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.append(str(_PROJECT_ROOT))
from database import MACHINE_DB

logging.basicConfig(level=logging.INFO)

def _send_command_and_wait(machine_id: str, cmd: dict, timeout: int = 30) -> dict:
    safe_id = machine_id.replace("#", "")
    cmd_dir = str(_PROJECT_ROOT / "arc-system" / "section-manager" / "commands")
    os.makedirs(cmd_dir, exist_ok=True)
    
    cmd_path = os.path.join(cmd_dir, f"{safe_id}.json")
    res_path = os.path.join(cmd_dir, f"{safe_id}_result.json")
    
    if os.path.exists(res_path):
        try: os.remove(res_path)
        except OSError: pass
            
    with open(cmd_path, "w", encoding="utf-8") as f:
        json.dump(cmd, f, ensure_ascii=False)
        
    start_time = time.time()
    while (time.time() - start_time) < timeout:
        if os.path.exists(res_path):
            try:
                with open(res_path, "r", encoding="utf-8") as f:
                    result = json.load(f)
                os.remove(res_path)
                return result
            except (json.JSONDecodeError, OSError):
                pass
        time.sleep(0.5)
        
    if os.path.exists(cmd_path):
        try: os.remove(cmd_path)
        except OSError: pass
    return {"status": "error", "message": {"EN": "Command timed out waiting for worker.", "TH": "คำสั่งหมดเวลารอจาก worker"}}


def run_delete(machine_id: str, recipe_name: str, log_callback=None) -> dict:
    def log(message: str, level: str = "INFO"):
        if log_callback: log_callback(message, level)

    if machine_id not in MACHINE_DB:
        msg = {"EN": f"Machine ID '{machine_id}' not found.", "TH": f"ไม่พบรหัสเครื่องจักร '{machine_id}'"}
        log(msg, "ALERT")
        return {"status": "error", "message": msg["EN"]}

    target = MACHINE_DB[machine_id]
    log({"EN": f"Routing delete request to {target['name']}...", "TH": f"ส่งคำร้องขอลบไปยัง {target['name']}..."}, "INFO")

    res = _send_command_and_wait(machine_id, {"action": "delete_recipe", "recipe": recipe_name})
    
    if not res or res.get("status") != "ok":
        msg = res.get("message", {"EN": "Failed to delete recipe."})
        log(msg, "ALERT")
        return {"status": "error", "message": msg.get("EN", "")}
        
    return {"status": "ok", "message": res.get("message", {}).get("EN", "Deleted successfully.")}
