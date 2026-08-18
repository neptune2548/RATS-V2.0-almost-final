import json
import logging
import os
import time
import sys
from pathlib import Path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]  # arc-system/client-rats -> project root
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.append(str(_PROJECT_ROOT))
from database import MACHINE_DB

logging.basicConfig(level=logging.INFO)

# ══════════════════════════════════════════════════════════════════════════════
# Importable function: run_pull
# ══════════════════════════════════════════════════════════════════════════════

def _send_command_and_wait(machine_id: str, cmd: dict, timeout: int = 30) -> dict:
    safe_id = machine_id.replace("#", "")
    cmd_dir = str(_PROJECT_ROOT / "arc-system" / "section-manager" / "commands")
    os.makedirs(cmd_dir, exist_ok=True)
    
    cmd_path = os.path.join(cmd_dir, f"{safe_id}.json")
    res_path = os.path.join(cmd_dir, f"{safe_id}_result.json")
    
    # Clean up old results
    if os.path.exists(res_path):
        try:
            os.remove(res_path)
        except OSError:
            pass
            
    # Write command
    with open(cmd_path, "w", encoding="utf-8") as f:
        json.dump(cmd, f, ensure_ascii=False)
        
    # Poll for result
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
        
    # Timeout
    if os.path.exists(cmd_path):
        try:
            os.remove(cmd_path)
        except OSError:
            pass
    return {"status": "error", "message": {"EN": "Command timed out waiting for worker.", "TH": "คำสั่งหมดเวลารอจาก worker"}}


def run_pull(machine_id: str, log_callback=None) -> dict:
    """
    Pull (sync) all new recipes from a machine by sending commands to the active worker.
    """
    def log(message: str, level: str = "INFO"):
        if log_callback:
            log_callback(message, level)

    # ── 1. Validate machine ──────────────────────────────────────────────────
    if machine_id not in MACHINE_DB:
        msg = {
            "EN": f"Machine ID '{machine_id}' not found in configuration database.",
            "TH": f"ไม่พบรหัสเครื่องจักร '{machine_id}' ในฐานข้อมูลระบบ"
        }
        log(msg, "ALERT")
        return {"status": "error", "message": msg["EN"], "pulled": [], "skipped": []}

    target = MACHINE_DB[machine_id]
    log({
        "EN": f"Routing request through Section Manager to {target['name']}...",
        "TH": f"ส่งคำร้องขอผ่าน Section Manager ไปยัง {target['name']}..."
    }, "INFO")

    pulled = []
    skipped = []

    try:
        # ── 2. Request recipe list ──────────────────────────
        log({
            "EN": "Requesting recipe inventory from equipment...",
            "TH": "กำลังขอรายการสูตรจากเครื่องจักร..."
        }, "INFO")
        
        list_res = _send_command_and_wait(machine_id, {"action": "pull_recipe_list"})
        
        if not list_res or list_res.get("status") != "ok":
            msg = list_res.get("message", {"EN": "Failed to get recipe list."})
            log(msg, "ALERT")
            return {"status": "error", "message": msg.get("EN", ""), "pulled": [], "skipped": []}
            
        recipe_list = list_res.get("message", {}).get("recipes", [])
        if not recipe_list:
            log({"EN": "Machine returned an empty recipe list.", "TH": "เครื่องจักรส่งรายการสูตรว่างเปล่ามาให้"}, "ALERT")
            return {"status": "ok", "message": "No recipes found.", "pulled": [], "skipped": []}

        # ── 3. Compare with local ─────────────────────────────────────────────
        save_directory = str(_PROJECT_ROOT / "BondingProg")
        os.makedirs(save_directory, exist_ok=True)

        def _strip_to_clean_name(filename):
            """Strip .PWB and optional .WB extensions to get clean recipe name."""
            name = filename
            if name.upper().endswith(".PWB"):
                name = name[:-4]
            if name.upper().endswith(".WB"):
                name = name[:-3]
            return name

        local_files = {_strip_to_clean_name(f) for f in os.listdir(save_directory) if f.upper().endswith(".PWB")}

        # Strip .WB suffix from remote recipe names for comparison
        remote_clean_map = {}  # clean_name -> original_remote_name
        for r in recipe_list:
            clean = _strip_to_clean_name(r)
            remote_clean_map[clean] = r

        remote_clean_names = set(remote_clean_map.keys())
        new_clean_names = list(remote_clean_names - local_files)

        # Map back to original remote names for download
        new_recipes = [remote_clean_map[c] for c in new_clean_names]
        
        log({
            "EN": f"Found {len(remote_clean_names)} recipes on equipment. {len(new_recipes)} are new.",
            "TH": f"พบสูตร {len(remote_clean_names)} รายการบนเครื่องจักร เป็นสูตรใหม่ {len(new_recipes)} รายการ"
        }, "INFO")

        if not new_recipes:
            msg = {"EN": "Local repository is already synchronized. No new recipes to pull.", "TH": "คลังข้อมูลซิงค์ตรงกันแล้ว ไม่มีสูตรใหม่ให้ดึง"}
            log(msg, "SUCCESS")
            return {"status": "ok", "message": msg["EN"], "pulled": [], "skipped": []}

        # ── 4. Pull new files ─────────────────────────────────────────────────
        log({
            "EN": f"Detected {len(new_recipes)} new recipes. Initiating automated pull sequence...",
            "TH": f"ตรวจพบสูตรใหม่ {len(new_recipes)} รายการ เริ่มกระบวนการดาวน์โหลดสูตรอัตโนมัติ..."
        }, "INFO")

        success_count = 0
        fail_count = 0
        invalid_chars = ["(", ")", ":", "*", "?", '"', "<", ">", "|", "\\", "/", " "]

        for target_recipe in new_recipes:
            if any(char in target_recipe for char in invalid_chars) or len(target_recipe) > 30:
                log({"EN": f"Skipping recipe '{target_recipe}' due to invalid nomenclature.", "TH": f"ข้ามสูตร '{target_recipe}' เนื่องจากรูปแบบชื่อไม่ถูกต้อง"}, "ALERT")
                skipped.append(target_recipe)
                fail_count += 1
                continue

            pull_res = _send_command_and_wait(machine_id, {"action": "pull_recipe", "recipe": target_recipe}, timeout=45)
            
            if pull_res and pull_res.get("status") == "ok":
                pulled.append(target_recipe)
                success_count += 1
            else:
                fail_count += 1
                if pull_res and "message" in pull_res:
                    err_msg = pull_res.get("message")
                    if isinstance(err_msg, dict):
                        log(err_msg, "ALERT")
                    else:
                        log({"EN": f"Pull failed: {err_msg}", "TH": f"ซิงค์ล้มเหลว: {err_msg}"}, "ALERT")

        summary = {
            "EN": f"Sync Complete: {success_count} pulled, {fail_count} failed/skipped.",
            "TH": f"ซิงค์เสร็จสิ้น: โหลดสำเร็จ {success_count}, ข้าม/ล้มเหลว {fail_count}"
        }
        log(summary, "SUCCESS" if success_count > 0 else "ALERT")

        return {
            "status": "ok",
            "message": summary["EN"],
            "pulled": pulled,
            "skipped": skipped
        }

    except Exception as e:
        msg = {"EN": f"Pull operation encountered an unexpected error: {e}", "TH": f"เกิดข้อผิดพลาดที่ไม่คาดคิดระหว่างการซิงค์: {e}"}
        log(msg, "ERROR")
        return {"status": "error", "message": msg["EN"], "pulled": pulled, "skipped": skipped}