import json
import logging
import os
import re
import time
import sys
from pathlib import Path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]  # arc-system/client-rats -> project root
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.append(str(_PROJECT_ROOT))
from database import MACHINE_DB

logging.basicConfig(level=logging.INFO)

# ══════════════════════════════════════════════════════════════════════════════
# Recipe Name Parsing & Fuzzy Matching
# ══════════════════════════════════════════════════════════════════════════════

import difflib

# Recipe name format example: BD-M02-ST-1277_EX_NewCap
#   product_family = "BD"
#   package_code   = "M02"
#   series         = "ST"
#   model_number   = 1277
#   variant        = "EX"
#   suffix         = "NewCap"

_RECIPE_PATTERN = re.compile(
    r"^(?P<family>[A-Z]{2})"          # Product family (e.g. BD, AB)
    r"[-_](?P<package>[A-Z]\d+)"      # Package code  (e.g. M02, O04)
    r"[-_](?P<series>[A-Z]{2})"       # Series prefix (e.g. ST, UD)
    r"[-_](?P<model>\d+)"            # Model number  (e.g. 1277, 2298)
    r"(?:[-_](?P<variant>[A-Za-z]+))?" # Variant       (e.g. EX) — optional
    r"(?:[-_](?P<suffix>[A-Za-z]+))?"  # Suffix        (e.g. NewCap, UPH) — optional
    r"$",
    re.IGNORECASE,
)


def _strip_recipe_stem(filename: str) -> str:
    """Strip .PWB (and optional .WB.PWB) extension to get the clean recipe name."""
    name = filename.strip()
    if name.upper().endswith(".PWB"):
        name = name[:-4]
    if name.upper().endswith(".WB"):
        name = name[:-3]
    return name


def parse_recipe_name(name: str) -> dict | None:
    """Parse a structured recipe name into components. Returns None if unparseable."""
    clean = _strip_recipe_stem(name)
    m = _RECIPE_PATTERN.match(clean)
    if not m:
        return None
    return {
        "family":  m.group("family").upper(),
        "package": m.group("package").upper(),
        "series":  m.group("series").upper(),
        "model":   int(m.group("model")),
        "variant": (m.group("variant") or "").upper(),
        "suffix":  (m.group("suffix") or "").upper(),
    }


def find_closest_recipe(requested: str, directory: str, log=None) -> str | None:
    """
    Scan .PWB files in `directory` (root only, no subdirs) and return the
    recipe name most similar to `requested`, or None if nothing qualifies.

    Priority:
      1. Structured component matching (family, package, series, model proximity)
      2. Fallback to difflib string similarity ratio
    """
    req_clean = _strip_recipe_stem(requested)
    req_parts = parse_recipe_name(req_clean)

    candidates: list[str] = []
    if os.path.exists(directory) and os.path.isdir(directory):
        for entry in os.listdir(directory):
            full = os.path.join(directory, entry)
            if not os.path.isfile(full) or not entry.upper().endswith(".PWB"):
                continue
            stem = _strip_recipe_stem(entry)
            if stem.upper() == req_clean.upper():
                continue
            if stem not in candidates:
                candidates.append(stem)

    if not candidates:
        return None

    # Step 1: Structured matching
    if req_parts is not None:
        best_name = None
        best_score = -1.0

        for stem in candidates:
            cand_parts = parse_recipe_name(stem)
            if cand_parts is None or cand_parts["family"] != req_parts["family"]:
                continue

            score = 0.0
            if cand_parts["package"] == req_parts["package"]:
                score += 40.0
            if cand_parts["series"] == req_parts["series"]:
                score += 30.0
            if cand_parts["variant"] == req_parts["variant"]:
                score += 20.0
            if cand_parts["suffix"] == req_parts["suffix"]:
                score += 10.0

            model_dist = abs(cand_parts["model"] - req_parts["model"])
            score += 9.0 / (1.0 + model_dist)

            if score > best_score:
                best_score = score
                best_name = stem

        if best_name and best_score > 0:
            if log:
                log({
                    "EN": f"Fuzzy match: '{requested}' → closest available recipe is '{best_name}' (score: {best_score:.1f})",
                    "TH": f"ค้นหาสูตรใกล้เคียง: '{requested}' → สูตรที่ใกล้เคียงที่สุดคือ '{best_name}' (คะแนน: {best_score:.1f})"
                }, "INFO")
            return best_name

    # Step 2: Fallback string similarity ratio
    best_ratio_name = None
    best_ratio = 0.0
    for cand in candidates:
        ratio = difflib.SequenceMatcher(None, req_clean.upper(), cand.upper()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_ratio_name = cand

    if best_ratio_name and best_ratio >= 0.3:
        if log:
            log({
                "EN": f"String similarity match: '{requested}' → '{best_ratio_name}' (match: {best_ratio * 100:.0f}%)",
                "TH": f"เปรียบเทียบชื่อสูตร: '{requested}' → '{best_ratio_name}' (ตรงกัน: {best_ratio * 100:.0f}%)"
            }, "INFO")
        return best_ratio_name

    return None


# ══════════════════════════════════════════════════════════════════════════════
# Importable function: run_push
# ══════════════════════════════════════════════════════════════════════════════

def _send_command_and_wait(machine_id: str, cmd: dict, log, timeout: int = 45) -> dict:
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
            
    err_msg = {"EN": "Command timed out waiting for worker.", "TH": "คำสั่งหมดเวลารอจาก worker"}
    log(err_msg, "ALERT")
    return {"status": "error", "message": err_msg}


def _get_active_recipe_from_state(machine_id: str) -> str:
    safe_id = machine_id.replace("#", "")
    state_path = str(_PROJECT_ROOT / "arc-system" / "section-manager" / "state" / f"{safe_id}.json")
    
    if not os.path.exists(state_path):
        return ""
        
    try:
        with open(state_path, "r", encoding="utf-8") as f:
            state = json.load(f)
            
        values = state.get("values", {})
        active_recipe = values.get("ActiveRecipe", {}).get("raw", "")
        
        # Depending on how the array is wrapped
        if isinstance(active_recipe, list) and len(active_recipe) > 0:
            return str(active_recipe[0]).strip()
        return str(active_recipe).strip()
    except Exception:
        return ""


def run_push(machine_id: str, recipe_name: str, log_callback=None) -> dict:
    """
    Push a recipe binary file via the Section Manager worker, with automatic backup
    of the current recipe beforehand (by reading active recipe from state).
    """
    def log(message: str, level: str = "INFO"):
        if log_callback:
            log_callback(message, level)

    # ── 1. Validate machine & Locate File ────────────────────────────────────
    if machine_id not in MACHINE_DB:
        msg = {
            "EN": f"Machine ID '{machine_id}' not found in configuration database.",
            "TH": f"ไม่พบรหัสเครื่องจักร '{machine_id}' ในฐานข้อมูลระบบ"
        }
        log(msg, "ALERT")
        return {"status": "error", "message": msg["EN"], "ackc7": None}

    target = MACHINE_DB[machine_id]
    target_dir = str(_PROJECT_ROOT / "BondingProg")
    os.makedirs(target_dir, exist_ok=True)
    file_path = f"{target_dir}/{recipe_name}.PWB"

    # Also check .WB.PWB variant
    if not os.path.exists(file_path):
        wb_path = f"{target_dir}/{recipe_name}.WB.PWB"
        if os.path.exists(wb_path):
            file_path = wb_path

    if not os.path.exists(file_path):
        msg = {"EN": f"Recipe file '{recipe_name}.PWB' not found locally.", "TH": f"ไม่พบไฟล์สูตร '{recipe_name}.PWB' ในเครื่อง"}
        log(msg, "ALERT")
        return {"status": "error", "message": msg["EN"], "ackc7": None}

    log({
        "EN": f"Routing request through Section Manager to {target['name']}...",
        "TH": f"ส่งคำร้องขอผ่าน Section Manager ไปยัง {target['name']}..."
    }, "INFO")

    # ═════════════════════════════════════════════════════════════════════════
    # STEP 1: เช็คสูตรปัจจุบัน & Backup (ผ่าน Worker queue)
    # ═════════════════════════════════════════════════════════════════════════
    old_recipe_name = _get_active_recipe_from_state(machine_id)
    
    if old_recipe_name:
        log({
            "EN": f"Active recipe detected: '{old_recipe_name}'",
            "TH": f"ตรวจพบสูตรปัจจุบัน: '{old_recipe_name}'"
        }, "INFO")

        if old_recipe_name != recipe_name:
            old_path = f"{target_dir}/{old_recipe_name}.PWB"
            if not os.path.exists(old_path):
                log({
                    "EN": f"Initiating backup download for '{old_recipe_name}'...",
                    "TH": f"กำลังเริ่มดาวน์โหลดเพื่อสำรองข้อมูล '{old_recipe_name}'..."
                }, "INFO")
                
                bk_res = _send_command_and_wait(machine_id, {"action": "pull_recipe", "recipe": old_recipe_name}, log, timeout=45)
                if bk_res.get("status") == "ok":
                    log({
                        "EN": "Backup sequence completed successfully.",
                        "TH": "กระบวนการสำรองข้อมูลเสร็จสมบูรณ์"
                    }, "SUCCESS")
                else:
                    log({
                        "EN": f"Backup sequence encountered an error (continuing to push): {bk_res.get('message')}",
                        "TH": f"กระบวนการสำรองข้อมูลเกิดข้อผิดพลาด (ดำเนินการส่งต่อ): {bk_res.get('message')}"
                    }, "ALERT")
            else:
                log({
                    "EN": f"Backup file '{old_recipe_name}' already exists locally. Skipping download.",
                    "TH": f"มีไฟล์สำรอง '{old_recipe_name}' อยู่แล้วในระบบ ข้ามการดาวน์โหลด"
                }, "INFO")

    # ═════════════════════════════════════════════════════════════════════════
    # STEP 2: Push ไฟล์ (ผ่าน Worker queue)
    # ═════════════════════════════════════════════════════════════════════════
    log({
        "EN": f"Instructing worker to push recipe '{recipe_name}'...",
        "TH": f"สั่งการ worker ให้ส่งข้อมูลสูตร '{recipe_name}'..."
    }, "INFO")
    
    push_res = _send_command_and_wait(machine_id, {"action": "push_recipe", "recipe": recipe_name}, log, timeout=60)
    
    if push_res.get("status") == "ok":
        msg = {"EN": f"Push operation for {recipe_name} was successful.", "TH": f"ส่งสูตร {recipe_name} สำเร็จ"}
        log(msg, "SUCCESS")
        return {"status": "ok", "message": msg["EN"], "ackc7": 0}
    else:
        err = push_res.get("message", {"EN": "Unknown error during push.", "TH": "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ"})
        log(err, "ALERT")
        return {"status": "error", "message": err.get("EN", ""), "ackc7": 1}