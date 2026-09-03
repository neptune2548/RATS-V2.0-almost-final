"""
worker.py — Section Manager Worker (Production)

1 process = 1 machine = 1 persistent SECS/GEM connection

Responsibilities (on a SINGLE connection):
  MEMS side : Poll SVIDs via S1F3 periodically, write results to state/{id}.json
  RATS side : Watch commands/{id}.json for commands (e.g. select_recipe), execute, write result

Connection status written to state file:
  "CONNECTING"  → initial / reconnecting
  "ONLINE"      → communicating successfully
  "OFFLINE"     → failed to connect within timeout
  "CONN. LOST"  → was online but connection dropped

Known machine limitations (ASM iHawk Xpress GOCU):
  - Does NOT support S1F23 (CEID Namelist) → no Event Reports (S6F11)
  - Must use SVID polling (S1F3) exclusively
  - RCMD for recipe selection = PP_SELECT (underscore, not hyphen)
  - CPNAME for PP_SELECT not yet confirmed (defaults to "PPID")
  - Only 1 HSMS session allowed per machine at a time
"""

import argparse
import gzip
import json
import logging
import os
import signal
import sys
import threading
import time

# Force stdout to be utf-8 (fixes CP874 mojibake when output is redirected to log files)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from pathlib import Path
# Derive project root dynamically — works on any machine regardless of install path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]  # arc-system/section-manager -> project root
sys.path.insert(0, str(_PROJECT_ROOT))

def _watch_parent():
    """Background thread that suicides if the manager's stdin pipe breaks."""
    try:
        sys.stdin.read()
    except Exception:
        pass
    finally:
        os._exit(0)

if os.getenv("ARC_WORKER_PARENT_WATCH") == "1":
    threading.Thread(target=_watch_parent, daemon=True).start()

from secsgem.hsms import HsmsSettings
from secsgem.gem import GemHostHandler
from secsgem.secs.functions import SecsS07F06, SecsS07F17, SecsS07F18

from database import MACHINE_DB

# Suppress secsgem's verbose internal logging
logging.basicConfig(level=logging.WARNING)

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

STATE_DIR    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "state")
COMMANDS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "commands")
HEARTBEAT_DIR = os.path.join(STATE_DIR, "heartbeats")

CONNECT_TIMEOUT_SEC       = 3       # seconds to wait for initial handshake
POLL_INTERVAL_SEC         = 10.0    # Check SVIDs; publish only when values change
HEARTBEAT_INTERVAL_SEC    = 10.0    # Internal worker health, not dashboard state
COMMAND_CHECK_INTERVAL    = 1.0     # check command queue every N seconds
RECONNECT_DELAY_SEC       = 5       # wait before reconnect attempt
MAX_CONSECUTIVE_FAILURES  = 10      # consecutive poll failures before reconnect

# SVID list — confirmed for ASM iHawk Xpress GOCU
# SVID 323 is the leading candidate for Andon/EquipmentState but not 100% verified
POLL_SVIDS = {
    323: "wHCM_EquipmentState",
    8:   "ProcessState",
    6:   "genGEM_CtrlState",
    13:  "AlarmID",
    14:  "AlarmSet",
    564: "ActiveRecipe",
}

# Confirmed RCMD name (with underscore, NOT hyphen)
CONFIRMED_RCMD = "PP_SELECT"

# ─────────────────────────────────────────────────────────────────────────────
# Console Title (Windows)
# ─────────────────────────────────────────────────────────────────────────────

def set_console_title(machine_id):
    """Set the terminal window title so each worker is clearly identifiable."""
    title = f"Section Manager - {machine_id}"
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleTitleW(title)
        except Exception:
            pass  # Non-critical — fall back to default title
    else:
        # ANSI escape for Unix terminals
        sys.stdout.write(f"\033]0;{title}\007")
        sys.stdout.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Bilingual Human-Readable Logging
# ─────────────────────────────────────────────────────────────────────────────

# Icons for log levels
LEVEL_ICONS = {
    "INFO":    "ℹ️ ",
    "SUCCESS": "✅",
    "ALERT":   "⚠️ ",
    "ERROR":   "❌",
}


def _safe_console_line(line):
    """A diagnostic message must never be able to terminate a worker."""
    try:
        print(line, flush=True)
    except (UnicodeEncodeError, UnicodeError):
        encoding = getattr(sys.stdout, "encoding", None) or "ascii"
        safe_line = str(line).encode(encoding, errors="replace").decode(encoding, errors="replace")
        try:
            print(safe_line, flush=True)
        except Exception:
            pass
    except (OSError, ValueError):
        # stdout may disappear while Windows is closing a launcher window.
        pass

def log(machine_id, message, level="INFO"):
    """
    Print a human-readable timestamped log line.

    message can be:
      - str              → printed as-is
      - {"EN":..,"TH":..} → prints both languages on one line
    """
    ts = time.strftime("%H:%M:%S")
    icon = LEVEL_ICONS.get(level, "  ")

    if isinstance(message, dict):
        en = message.get("EN", "")
        th = message.get("TH", "")
        _safe_console_line(f"[{ts}] {icon} [{machine_id}] {en}  |  {th}")
    else:
        _safe_console_line(f"[{ts}] {icon} [{machine_id}] {message}")

    try:
        import urllib.request, json
        req = urllib.request.Request("http://127.0.0.1:8080/api/internal/events", data=json.dumps({"machine_id": machine_id, "level": level, "message": message}).encode('utf-8'), headers={'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=1)
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Human-Readable SVID Value Translation
# ─────────────────────────────────────────────────────────────────────────────

EQUIPMENT_STATE_MAP = {
    0: {"EN": "Unknown",       "TH": "ไม่ทราบสถานะ"},
    1: {"EN": "Running",       "TH": "เครื่องกำลังทำงาน"},
    2: {"EN": "Idle",          "TH": "เครื่องว่าง"},
    3: {"EN": "Paused",        "TH": "เครื่องหยุดชั่วคราว"},
    4: {"EN": "Setup",         "TH": "เครื่องกำลังตั้งค่า"},
    5: {"EN": "Down / Alarm",  "TH": "เครื่องหยุดทำงาน / มีสัญญาณเตือน"},
}

CONTROL_STATE_MAP = {
    1: {"EN": "Off-Line / Not Ready",     "TH": "ออฟไลน์ / ยังไม่พร้อม"},
    2: {"EN": "Off-Line / Local",         "TH": "ออฟไลน์ / โหมดท้องถิ่น"},
    3: {"EN": "Off-Line / Remote",        "TH": "ออฟไลน์ / โหมดรีโมท"},
    4: {"EN": "On-Line / Local",          "TH": "ออนไลน์ / โหมดท้องถิ่น"},
    5: {"EN": "On-Line / Remote",         "TH": "ออนไลน์ / โหมดรีโมท"},
}

def translate_svid_value(svid, value):
    """Return a human-readable bilingual string for known SVID values."""
    if svid == 323:
        entry = EQUIPMENT_STATE_MAP.get(value)
        if entry:
            return f"{entry['EN']} / {entry['TH']}"
    elif svid == 6:
        entry = CONTROL_STATE_MAP.get(value)
        if entry:
            return f"{entry['EN']} / {entry['TH']}"
    return str(value)


# ─────────────────────────────────────────────────────────────────────────────
# File Paths
# ─────────────────────────────────────────────────────────────────────────────

def _safe_id(machine_id):
    """Remove '#' for safe filesystem names: WB#83 → WB83"""
    return machine_id.replace("#", "")


def state_path(machine_id):
    return os.path.join(STATE_DIR, f"{_safe_id(machine_id)}.json")


def command_path(machine_id):
    return os.path.join(COMMANDS_DIR, f"{_safe_id(machine_id)}.json")


def command_result_path(machine_id):
    return os.path.join(COMMANDS_DIR, f"{_safe_id(machine_id)}_result.json")


def heartbeat_path(machine_id):
    return os.path.join(HEARTBEAT_DIR, f"{_safe_id(machine_id)}.heartbeat")


def write_heartbeat(machine_id):
    """Update supervisor liveness without changing dashboard machine state."""
    try:
        os.makedirs(HEARTBEAT_DIR, exist_ok=True)
        path = heartbeat_path(machine_id)
        with open(path, "a", encoding="ascii"):
            os.utime(path, None)
    except OSError:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# State File I/O (atomic write to prevent dashboard reading half-written files)
# ─────────────────────────────────────────────────────────────────────────────

def write_state(machine_id, values, connection_status, machine_name=""):
    """
    Write machine state to JSON for MEMS dashboard consumption.
    connection_status: "CONNECTING" | "ONLINE" | "OFFLINE" | "CONN. LOST"
    """
    os.makedirs(STATE_DIR, exist_ok=True)

    # Translate SVID values to human-readable
    translated = {}
    for svid, val in values.items():
        svid_name = POLL_SVIDS.get(svid, str(svid))
        translated[svid_name] = {
            "raw": val,
            "display": translate_svid_value(svid, val),
        }

    payload = {
        "machine_id":        machine_id,
        "machine_name":      machine_name,
        "connection_status":  connection_status,
        "updated_at":        time.strftime("%Y-%m-%d %H:%M:%S"),
        "values":            translated,
    }

    tmp = state_path(machine_id) + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        os.replace(tmp, state_path(machine_id))
        try:
            import urllib.request
            event_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            request = urllib.request.Request(
                "http://127.0.0.1:8080/api/internal/connection-status",
                data=event_body,
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(request, timeout=1).close()
        except Exception:
            pass
    except OSError as e:
        log(machine_id, {"EN": f"Failed to write state file: {e}",
                         "TH": f"เขียนไฟล์สถานะล้มเหลว: {e}"}, "ALERT")


# ─────────────────────────────────────────────────────────────────────────────
# Command Queue I/O (RATS → Worker)
# ─────────────────────────────────────────────────────────────────────────────

def read_pending_command(machine_id):
    """Read a pending command file placed by RATS. Returns dict or None."""
    path = command_path(machine_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def clear_command(machine_id):
    """Remove the command file after processing."""
    path = command_path(machine_id)
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def write_command_result(machine_id, status, message):
    """Write command execution result for RATS to read."""
    os.makedirs(COMMANDS_DIR, exist_ok=True)
    result = {
        "machine_id":  machine_id,
        "status":      status,       # "ok" or "error"
        "message":     message,       # {"EN": ..., "TH": ...}
        "timestamp":   time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    try:
        with open(command_result_path(machine_id), "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
    except OSError:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# SECS/GEM Host Handler
# ─────────────────────────────────────────────────────────────────────────────

class WorkerHost(GemHostHandler):
    """Thin subclass to carry machine_id on the handler."""
    def __init__(self, settings, machine_id):
        super().__init__(settings)
        self.machine_id = machine_id


# ─────────────────────────────────────────────────────────────────────────────
# SVID Polling (MEMS side)
# ─────────────────────────────────────────────────────────────────────────────

def poll_once(host, machine_id, svid_list):
    """
    Send S1F3 (Status Variable Request) and parse S1F4 response.
    Returns dict {svid: value} on success, None on any failure.
    """
    try:
        s1f3 = host.stream_function(1, 3)(svid_list)
        response = host.send_and_waitfor_response(s1f3)

        if response is None:
            log(machine_id, {"EN": "No response received while checking status.",
                             "TH": "ไม่ได้รับการตอบกลับขณะตรวจสอบสถานะ"}, "ALERT")
            return None

        # Guard against wrong response type (e.g. host collision → S1F14/S9F9)
        if response.header.stream != 1 or response.header.function != 4:
            log(machine_id, {
                "EN": "Received unexpected response — another host may be connected. Skipping this cycle.",
                "TH": "ได้รับการตอบกลับผิดประเภท — อาจมี host อื่นเชื่อมต่ออยู่ ข้ามรอบนี้"
            }, "ALERT")
            return None

        data = host.settings.streams_functions.decode(response)
        values = data.get()

        if not values or len(values) != len(svid_list):
            log(machine_id, {
                "EN": "Received incomplete status data. Skipping this cycle.",
                "TH": "ได้รับข้อมูลสถานะไม่ครบ ข้ามรอบนี้"
            }, "ALERT")
            return None

        return dict(zip(svid_list, values))

    except Exception as e:
        log(machine_id, {"EN": f"Error while checking machine status: {e}",
                         "TH": f"เกิดข้อผิดพลาดขณะตรวจสอบสถานะ: {e}"}, "ALERT")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Command Handling (RATS side)
# ─────────────────────────────────────────────────────────────────────────────

def handle_command(host, machine_id, cmd):
    """Process a command from the RATS command queue."""
    action = cmd.get("action", "").strip()

    try:
        if action == "select_recipe":
            _handle_select_recipe(host, machine_id, cmd)
        elif action == "pull_recipe_list":
            _handle_pull_recipe_list(host, machine_id)
        elif action == "pull_recipe":
            _handle_pull_recipe(host, machine_id, cmd)
        elif action == "push_recipe":
            _handle_push_recipe(host, machine_id, cmd)
        elif action == "delete_recipe":
            _handle_delete_recipe(host, machine_id, cmd)
        else:
            msg = {"EN": f"Unknown command '{action}' received. Ignoring.",
                   "TH": f"ได้รับคำสั่ง '{action}' ที่ไม่รู้จัก ข้ามไป"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
    finally:
        clear_command(machine_id)

def _handle_delete_recipe(host, machine_id, cmd):
    recipe_name = cmd.get("recipe", "").strip()
    if not recipe_name:
        write_command_result(machine_id, "error", {"EN": "Missing recipe name", "TH": "ไม่ได้ระบุชื่อสูตร"})
        return
        
    log(machine_id, {"EN": f"Deleting recipe '{recipe_name}' from machine...", "TH": f"กำลังลบสูตร '{recipe_name}' ออกจากเครื่อง..."}, "INFO")
    
    try:
        s7f17 = SecsS07F17([recipe_name])
        response = host.send_and_waitfor_response(s7f17)
        if response is None or response.header.function != 18:
            msg = {"EN": "No valid S7F18 response received.", "TH": "ไม่ได้รับการตอบกลับ S7F18"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
            return
            
        s7f18 = SecsS07F18()
        s7f18.decode(response.data)
        raw_ackc7 = s7f18.get()
        
        if isinstance(raw_ackc7, (list, tuple)) and len(raw_ackc7) > 0:
            ackc7_val = int(raw_ackc7[0])
        elif isinstance(raw_ackc7, bytes) and len(raw_ackc7) > 0:
            ackc7_val = int(raw_ackc7[0])
        elif raw_ackc7 is not None:
            ackc7_val = int(raw_ackc7)
        else:
            ackc7_val = -1
            
        if ackc7_val == 0:
            msg = {"EN": f"Recipe '{recipe_name}' successfully deleted.", "TH": f"ลบสูตร '{recipe_name}' สำเร็จ"}
            log(machine_id, msg, "SUCCESS")
            write_command_result(machine_id, "ok", {"message": msg, "ackc7": ackc7_val})
        else:
            msg = {"EN": f"Equipment rejected deletion (ACKC7={ackc7_val}).", "TH": f"เครื่องจักรปฏิเสธการลบ (ACKC7={ackc7_val})"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", {"message": msg, "ackc7": ackc7_val})
            
    except Exception as e:
        msg = {"EN": f"Delete failed: {e}", "TH": f"ลบล้มเหลว: {e}"}
        log(machine_id, msg, "ERROR")
        write_command_result(machine_id, "error", msg)

    clear_command(machine_id)


def _handle_select_recipe(host, machine_id, cmd):
    """Execute PP_SELECT remote command (S2F41 → S2F42)."""
    ppid    = cmd.get("ppid", "")
    cpname  = cmd.get("cpname", "PPID")  # Default CPNAME, override via command file

    log(machine_id, {
        "EN": f"Selecting recipe '{ppid}' on the machine...",
        "TH": f"กำลังเลือกสูตร '{ppid}' บนเครื่องจักร..."
    }, "INFO")

    try:
        s2f41 = host.stream_function(2, 41)({
            "RCMD": CONFIRMED_RCMD,
            "PARAMS": [{"CPNAME": cpname, "CPVAL": ppid}],
        })
        response = host.send_and_waitfor_response(s2f41)

        if response is None:
            msg = {"EN": "The machine did not respond to the recipe selection command.",
                   "TH": "เครื่องจักรไม่ตอบกลับคำสั่งเลือกสูตร"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
            return

        data = host.settings.streams_functions.decode(response)
        result = data.get()

        # HCACK interpretation
        hcack = None
        if isinstance(result, dict):
            hcack = result.get("HCACK")
        elif isinstance(result, (list, tuple)) and len(result) > 0:
            hcack = result[0] if not isinstance(result[0], (list, dict)) else None

        if hcack == 0:
            msg = {"EN": f"Recipe '{ppid}' selected successfully.",
                   "TH": f"เลือกสูตร '{ppid}' สำเร็จแล้ว"}
            log(machine_id, msg, "SUCCESS")
            write_command_result(machine_id, "ok", msg)
        elif hcack == 1:
            msg = {"EN": f"The machine rejected the recipe command — unknown parameter name (CPNAME='{cpname}' may be incorrect).",
                   "TH": f"เครื่องจักรปฏิเสธคำสั่ง — ชื่อพารามิเตอร์ไม่ถูกต้อง (CPNAME='{cpname}' อาจไม่ถูก)"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
        elif hcack == 2:
            msg = {"EN": "The machine cannot execute the command at this time. Please check the machine state.",
                   "TH": "เครื่องจักรไม่สามารถดำเนินการคำสั่งได้ในขณะนี้ กรุณาตรวจสอบสถานะเครื่อง"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
        elif hcack == 3:
            msg = {"EN": f"The machine does not recognize the command '{CONFIRMED_RCMD}'.",
                   "TH": f"เครื่องจักรไม่รู้จักคำสั่ง '{CONFIRMED_RCMD}'"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
        elif hcack == 4:
            msg = {"EN": f"The machine rejected the recipe value '{ppid}'. The recipe name may not exist on the machine.",
                   "TH": f"เครื่องจักรปฏิเสธค่าสูตร '{ppid}' ชื่อสูตรอาจไม่มีอยู่ในเครื่อง"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
        else:
            msg = {"EN": f"Received unexpected response (HCACK={hcack}). Please check the machine.",
                   "TH": f"ได้รับการตอบกลับที่ไม่คาดคิด (HCACK={hcack}) กรุณาตรวจสอบเครื่องจักร"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)

    except Exception as e:
        msg = {"EN": f"Recipe selection failed due to a system error.",
               "TH": f"เลือกสูตรล้มเหลวเนื่องจากข้อผิดพลาดของระบบ"}
        log(machine_id, msg, "ERROR")
        write_command_result(machine_id, "error", msg)


def _handle_pull_recipe_list(host, machine_id):
    """Request recipe inventory from the machine (S7F19 → S7F20)."""
    log(machine_id, {
        "EN": "Requesting recipe list from the machine...",
        "TH": "กำลังขอรายการสูตรจากเครื่องจักร..."
    }, "INFO")

    try:
        from secsgem.secs.functions import SecsS07F20

        s7f19 = host.stream_function(7, 19)()
        response = host.send_and_waitfor_response(s7f19)

        if response is None or response.header.function != 20:
            msg = {"EN": "The machine did not return a recipe list.",
                   "TH": "เครื่องจักรไม่ส่งรายการสูตรกลับมา"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
            return

        s7f20 = SecsS07F20()
        s7f20.decode(response.data)
        recipe_list = s7f20.get()

        count = len(recipe_list) if recipe_list else 0
        msg = {"EN": f"Found {count} recipes on the machine.",
               "TH": f"พบสูตรทั้งหมด {count} รายการบนเครื่องจักร"}
        log(machine_id, msg, "SUCCESS")
        write_command_result(machine_id, "ok", {
            **msg,
            "recipes": recipe_list or []
        })

    except Exception as e:
        msg = {"EN": "Failed to retrieve recipe list from the machine.",
               "TH": "ล้มเหลวในการดึงรายการสูตรจากเครื่องจักร"}
        log(machine_id, msg, "ERROR")
        write_command_result(machine_id, "error", msg)


def _handle_pull_recipe(host, machine_id, cmd):
    """Request a specific recipe body via S7F5 and save it locally."""
    target_recipe = cmd.get("recipe")
    if not target_recipe:
        write_command_result(machine_id, "error", {"EN": "No recipe name provided.", "TH": "ไม่ได้ระบุชื่อสูตร"})
        return
        
    log(machine_id, {
        "EN": f"Downloading recipe payload: {target_recipe} ...",
        "TH": f"กำลังดาวน์โหลดข้อมูลสูตร: {target_recipe} ..."
    }, "INFO")
    
    try:
        s7f5 = host.stream_function(7, 5)(target_recipe)
        response_s7f5 = host.send_and_waitfor_response(s7f5)
        
        if response_s7f5 is not None and response_s7f5.header.function == 6:
            s7f6 = SecsS07F06()
            s7f6.decode(response_s7f5.data)
            s7f6_data = s7f6.get()
            
            if isinstance(s7f6_data, dict):
                ppbody = s7f6_data.get("PPBODY", s7f6_data)
            elif isinstance(s7f6_data, list) and len(s7f6_data) > 1:
                ppbody = s7f6_data[1]
            else:
                ppbody = s7f6_data
                
            if isinstance(ppbody, str):
                file_bytes = ppbody.encode("latin-1")
            elif isinstance(ppbody, bytes):
                file_bytes = ppbody
            elif isinstance(ppbody, list):
                try:
                    file_bytes = bytes(ppbody)
                except TypeError:
                    joined_str = "".join(str(x) for x in ppbody)
                    file_bytes = joined_str.encode("latin-1")
            else:
                file_bytes = str(ppbody).encode("latin-1")

            # A S7F6 reply alone is not proof that the equipment returned a
            # PWB.  Some iHawk firmware replies with a small metadata/None
            # placeholder.  Validate the actual (possibly gzip-compressed)
            # program payload before touching the Host repository.
            try:
                pwb_content = gzip.decompress(file_bytes)
            except (gzip.BadGzipFile, EOFError, OSError):
                pwb_content = file_bytes
            if len(file_bytes) < 1024 or b"Program Name" not in pwb_content:
                msg = {
                    "EN": f"Equipment did not return a valid PWB for '{target_recipe}' (S7F6: {len(response_s7f5.data)} bytes, payload: {len(file_bytes)} bytes, decoded as {type(ppbody).__name__}). Existing Host file was not changed.",
                    "TH": f"เครื่องจักรไม่ได้ส่งไฟล์ PWB ที่ถูกต้องสำหรับ '{target_recipe}' (S7F6: {len(response_s7f5.data)} ไบต์, payload: {len(file_bytes)} ไบต์, ถอดรหัสเป็น {type(ppbody).__name__}) ไฟล์เดิมบน Host ไม่ถูกแก้ไข",
                }
                log(machine_id, msg, "ALERT")
                write_command_result(machine_id, "error", msg)
                return
                
            save_directory = str(_PROJECT_ROOT / "BondingProg")
            os.makedirs(save_directory, exist_ok=True)
            output_filename = f"{save_directory}/{target_recipe}.PWB"
            
            with open(output_filename, "wb") as f:
                f.write(file_bytes)
                
            msg = {"EN": f"Download successful: {target_recipe}", "TH": f"ดาวน์โหลดสำเร็จ: {target_recipe}"}
            log(machine_id, msg, "SUCCESS")
            write_command_result(machine_id, "ok", msg)
        else:
            msg = {"EN": f"Download failed: {target_recipe} (Equipment rejected request).", "TH": f"ดาวน์โหลดล้มเหลว: {target_recipe} (เครื่องจักรปฏิเสธคำขอ)"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
            
    except Exception as e:
        msg = {"EN": f"Failed to pull recipe {target_recipe}: {e}", "TH": f"ดึงสูตร {target_recipe} ล้มเหลว: {e}"}
        log(machine_id, msg, "ERROR")
        write_command_result(machine_id, "error", msg)


def _temp_connect(target, machine_id, timeout=15):
    """Create a temporary fresh HSMS connection for push operations."""
    settings = HsmsSettings(
        address=target["ip"],
        port=target["port"],
        active=True,
        session_id=target["session_id"],
    )
    temp_host = WorkerHost(settings, machine_id)
    temp_host.enable()
    if not temp_host.waitfor_communicating(timeout=timeout):
        temp_host.disable()
        return None
    return temp_host


def _temp_disconnect(temp_host):
    """Gracefully close a temporary HSMS connection."""
    try:
        temp_host.disable()
    except Exception:
        pass


def _handle_push_recipe(host, machine_id, cmd):
    """
    Push a recipe using V0.1's proven two-session approach.

    Because ASM iHawk only allows 1 HSMS session and its firmware locks
    the PP transfer state on persistent polling connections, we must:
      1. Disconnect the main polling host
      2. Create fresh temp sessions for backup + push (exactly like V0.1)
      3. Return — the main worker loop auto-reconnects for polling

    Dashboard will show "CONN. LOST" for ~20s during push, then auto-recovers.
    """
    from secsgem.secs.variables import Binary
    from secsgem.secs.functions import (
        SecsS01F03, SecsS01F04,
        SecsS07F01, SecsS07F02,
        SecsS07F03, SecsS07F04,
        SecsS07F05, SecsS07F06,
    )

    recipe_name = cmd.get("recipe")
    if not recipe_name:
        write_command_result(machine_id, "error", {"EN": "No recipe name provided.", "TH": "ไม่ได้ระบุชื่อสูตร"})
        return

    file_path = str(_PROJECT_ROOT / "BondingProg" / f"{recipe_name}.PWB")
    if not os.path.exists(file_path):
        write_command_result(machine_id, "error", {"EN": f"Recipe file {recipe_name}.PWB not found locally.", "TH": f"ไม่พบไฟล์สูตร {recipe_name}.PWB ในเครื่อง"})
        return

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    target = MACHINE_DB[machine_id]
    save_dir = str(_PROJECT_ROOT / "BondingProg")

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 0: Kill the main polling connection to free the HSMS slot
    # ═══════════════════════════════════════════════════════════════════════
    log(machine_id, {
        "EN": "Temporarily disconnecting polling session to free HSMS slot for push...",
        "TH": "กำลังตัดการเชื่อมต่อ polling ชั่วคราวเพื่อเปิดช่องทาง HSMS สำหรับส่งสูตร..."
    }, "INFO")
    write_state(machine_id, {}, "PUSHING", MACHINE_DB[machine_id].get("name", machine_id))

    try:
        host.disable()
    except Exception:
        pass
    time.sleep(2.0)

    # ═══════════════════════════════════════════════════════════════════════
    # SESSION 1: Backup active recipe (S1F3 → S7F5) — exactly like V0.1
    # ═══════════════════════════════════════════════════════════════════════
    log(machine_id, {
        "EN": "[Session 1/2] Connecting for pre-push backup...",
        "TH": "[เซสชัน 1/2] กำลังเชื่อมต่อเพื่อสำรองข้อมูลก่อนส่งสูตร..."
    }, "INFO")

    temp_host = _temp_connect(target, machine_id)
    if temp_host is None:
        msg = {"EN": "Failed to connect for backup session.", "TH": "เชื่อมต่อเพื่อสำรองข้อมูลล้มเหลว"}
        log(machine_id, msg, "ALERT")
        # Don't return error yet — push might still work without backup
    else:
        log(machine_id, {"EN": "Backup session connected.", "TH": "เซสชันสำรองข้อมูลเชื่อมต่อสำเร็จ"}, "INFO")
        time.sleep(2.0)

        try:
            old_recipe_name = ""
            try:
                res_s1 = temp_host.send_and_waitfor_response(SecsS01F03([564]))
                if res_s1 and res_s1.header.function == 4:
                    s1f4 = SecsS01F04()
                    s1f4.decode(res_s1.data)
                    vals = s1f4.get()
                    if vals and vals[0]:
                        old_recipe_name = str(vals[0]).strip()
                        log(machine_id, {
                            "EN": f"Active recipe detected: '{old_recipe_name}'",
                            "TH": f"ตรวจพบสูตรปัจจุบัน: '{old_recipe_name}'"
                        }, "INFO")

                if old_recipe_name and old_recipe_name != recipe_name:
                    old_path = f"{save_dir}/{old_recipe_name}.PWB"
                    if not os.path.exists(old_path):
                        log(machine_id, {
                            "EN": f"Backing up '{old_recipe_name}' from machine...",
                            "TH": f"กำลังสำรองข้อมูล '{old_recipe_name}' จากเครื่อง..."
                        }, "INFO")
                        res_s7f5 = temp_host.send_and_waitfor_response(SecsS07F05(old_recipe_name))
                        if res_s7f5 and res_s7f5.header.function == 6:
                            s7f6 = SecsS07F06()
                            s7f6.decode(res_s7f5.data)
                            data = s7f6.get()
                            ppbody = data["PPBODY"] if isinstance(data, dict) else data[1]
                            if isinstance(ppbody, str):
                                backup_bytes = ppbody.encode("latin-1")
                            elif isinstance(ppbody, bytes):
                                backup_bytes = ppbody
                            elif isinstance(ppbody, list):
                                try:
                                    backup_bytes = bytes(ppbody)
                                except TypeError:
                                    backup_bytes = "".join(str(x) for x in ppbody).encode("latin-1")
                            else:
                                backup_bytes = str(ppbody).encode("latin-1")
                            with open(old_path, "wb") as f_out:
                                f_out.write(backup_bytes)
                            log(machine_id, {"EN": "Backup completed.", "TH": "สำรองข้อมูลเสร็จสมบูรณ์"}, "SUCCESS")
                    else:
                        log(machine_id, {
                            "EN": f"Backup '{old_recipe_name}' already exists. Skipping.",
                            "TH": f"มีไฟล์สำรอง '{old_recipe_name}' อยู่แล้ว ข้ามขั้นตอน"
                        }, "INFO")
            except Exception as e_bk:
                log(machine_id, {
                    "EN": f"Backup error (continuing to push): {e_bk}",
                    "TH": f"สำรองข้อมูลผิดพลาด (ดำเนินการส่งต่อ): {e_bk}"
                }, "ALERT")
        finally:
            _temp_disconnect(temp_host)
            log(machine_id, {
                "EN": "[Session 1/2] Backup session closed.",
                "TH": "[เซสชัน 1/2] ปิดเซสชันสำรองข้อมูลแล้ว"
            }, "INFO")

    # Let machine clear its internal state between sessions (critical for ASM)
    time.sleep(3.0)

    # ═══════════════════════════════════════════════════════════════════════
    # SESSION 2: Inquire (S7F1) → Push (S7F3) — exactly like V0.1
    # ═══════════════════════════════════════════════════════════════════════
    log(machine_id, {
        "EN": "[Session 2/2] Connecting for recipe push...",
        "TH": "[เซสชัน 2/2] กำลังเชื่อมต่อเพื่อส่งสูตร..."
    }, "INFO")

    temp_host = _temp_connect(target, machine_id)
    if temp_host is None:
        msg = {"EN": "Failed to connect for push session.", "TH": "เชื่อมต่อเพื่อส่งสูตรล้มเหลว"}
        log(machine_id, msg, "ALERT")
        write_command_result(machine_id, "error", msg)
        return

    log(machine_id, {"EN": "Push session connected.", "TH": "เซสชันส่งสูตรเชื่อมต่อสำเร็จ"}, "INFO")
    time.sleep(5.0)  # V0.1's proven stabilization delay

    try:
        file_len = len(file_bytes)
        log(machine_id, {
            "EN": f"Requesting authorization to transfer '{recipe_name}' ({file_len:,} bytes) via S7F1...",
            "TH": f"กำลังขออนุญาตส่งข้อมูล '{recipe_name}' ({file_len:,} ไบต์) ผ่านคำสั่ง S7F1..."
        }, "INFO")

        s7f1 = SecsS07F01({"PPID": recipe_name, "LENGTH": file_len})
        response_s7f1 = temp_host.send_and_waitfor_response(s7f1)

        if not (response_s7f1 and response_s7f1.header.function == 2):
            msg = {"EN": "No S7F2 response received (Timeout).", "TH": "ไม่ได้รับ S7F2 (หมดเวลา)"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
            return

        s7f2 = SecsS07F02()
        s7f2.decode(response_s7f1.data)
        ppgnt = s7f2.get()

        if ppgnt != 0:
            msg = {
                "EN": f"Transfer rejected (PPGNT={ppgnt}).",
                "TH": f"เครื่องปฏิเสธคำขอ (PPGNT={ppgnt})"
            }
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)
            return

        log(machine_id, {
            "EN": "Transfer authorized (PPGNT=0). Transmitting binary payload via S7F3...",
            "TH": "อนุญาตการส่งข้อมูล (PPGNT=0) กำลังส่งไบนารีผ่าน S7F3..."
        }, "SUCCESS")

        s7f3 = SecsS07F03([recipe_name, Binary(file_bytes)])
        response_s7f3 = temp_host.send_and_waitfor_response(s7f3)

        if response_s7f3 and response_s7f3.header.function == 4:
            s7f4 = SecsS07F04()
            s7f4.decode(response_s7f3.data)
            ackc7 = s7f4.get()
            if ackc7 == 0:
                msg = {
                    "EN": f"Recipe '{recipe_name}' pushed successfully (ACKC7=0).",
                    "TH": f"ส่งสูตร '{recipe_name}' สำเร็จ (ACKC7=0)"
                }
                log(machine_id, msg, "SUCCESS")
                write_command_result(machine_id, "ok", msg)
            else:
                msg = {
                    "EN": f"Equipment rejected payload (ACKC7={ackc7}).",
                    "TH": f"เครื่องปฏิเสธข้อมูล (ACKC7={ackc7})"
                }
                log(machine_id, msg, "ALERT")
                write_command_result(machine_id, "error", msg)
        else:
            msg = {"EN": "No S7F4 response (Timeout after S7F3).", "TH": "ไม่ได้รับ S7F4 (หมดเวลาหลัง S7F3)"}
            log(machine_id, msg, "ALERT")
            write_command_result(machine_id, "error", msg)

    except Exception as e:
        msg = {"EN": f"Push failed: {e}", "TH": f"ส่งสูตรล้มเหลว: {e}"}
        log(machine_id, msg, "ERROR")
        write_command_result(machine_id, "error", msg)

    finally:
        _temp_disconnect(temp_host)
        log(machine_id, {
            "EN": "[Session 2/2] Push session closed. Main polling will auto-reconnect.",
            "TH": "[เซสชัน 2/2] ปิดเซสชันส่งสูตรแล้ว ระบบ polling จะเชื่อมต่อใหม่อัตโนมัติ"
        }, "INFO")


# ─────────────────────────────────────────────────────────────────────────────
# Main Worker Loop
# ─────────────────────────────────────────────────────────────────────────────

def run_worker(machine_id):
    """Main entry: connect persistently, poll, handle commands, auto-reconnect."""

    if machine_id not in MACHINE_DB:
        log(machine_id, {"EN": f"Machine ID '{machine_id}' not found in the database.",
                         "TH": f"ไม่พบรหัสเครื่องจักร '{machine_id}' ในฐานข้อมูล"}, "ERROR")
        return

    target = MACHINE_DB[machine_id]
    machine_name = target.get("name", machine_id)
    svid_list = list(POLL_SVIDS.keys())
    offline_announced = False

    os.makedirs(STATE_DIR, exist_ok=True)
    os.makedirs(COMMANDS_DIR, exist_ok=True)
    os.makedirs(HEARTBEAT_DIR, exist_ok=True)

    # ── Graceful shutdown handler ────────────────────────────────────────
    shutdown_requested = False

    def request_shutdown(signum, frame):
        nonlocal shutdown_requested
        shutdown_requested = True

    signal.signal(signal.SIGINT, request_shutdown)
    if os.name == "nt":
        signal.signal(signal.SIGBREAK, request_shutdown)

    # ── Outer reconnect loop ────────────────────────────────────────────
    while not shutdown_requested:
        # Offline/reconnecting workers must also prove the process is alive.
        write_heartbeat(machine_id)
        host = None
        try:
            # Reconnect attempts run silently in the background.  The operator
            # only needs the stable OFFLINE/ONLINE state, not every retry.
            write_state(machine_id, {}, "OFFLINE", machine_name)

            settings = HsmsSettings(
                address=target["ip"],
                port=target["port"],
                active=True,
                session_id=target["session_id"],
            )
            host = WorkerHost(settings, machine_id)
            host.enable()

            # Wait for communication with the configured timeout
            if not host.waitfor_communicating(timeout=CONNECT_TIMEOUT_SEC):
                write_state(machine_id, {}, "OFFLINE", machine_name)
                if not offline_announced:
                    log(machine_id, {
                        "EN": f"{machine_name} is offline.",
                        "TH": f"{machine_name} ออฟไลน์"
                    }, "ALERT")
                    offline_announced = True
                host.disable()
                host = None
                time.sleep(RECONNECT_DELAY_SEC)
                continue

            # ── ONLINE state ──
            write_state(machine_id, {}, "ONLINE", machine_name)
            log(machine_id, {
                "EN": f"Connected to {machine_name} successfully.",
                "TH": f"เชื่อมต่อ {machine_name} สำเร็จแล้ว"
            }, "SUCCESS")
            offline_announced = False

            consecutive_failures = 0
            last_poll_time = -POLL_INTERVAL_SEC  # Fire first poll immediately on connect
            last_heartbeat_time = -HEARTBEAT_INTERVAL_SEC
            last_cmd_time  = 0
            last_values = None

            # ── Inner polling loop (stays here while connection is alive) ──
            while not shutdown_requested:
                now = time.time()

                # If connection dropped, break inner loop to reconnect
                if host.communication_state.current.name != "COMMUNICATING":
                    if not offline_announced:
                        log(machine_id, {
                            "EN": f"Connection to {machine_name} was lost. Machine is offline.",
                            "TH": f"การเชื่อมต่อ {machine_name} หลุด เครื่องจักรออฟไลน์"
                        }, "ALERT")
                        offline_announced = True
                    break

                # Keep supervisor health separate from dashboard machine state.
                if (now - last_heartbeat_time) >= HEARTBEAT_INTERVAL_SEC:
                    last_heartbeat_time = now
                    write_heartbeat(machine_id)

                # The equipment cannot publish state-change events, so check at a
                # controlled rate and only publish when an SVID value changes.
                if (now - last_poll_time) >= POLL_INTERVAL_SEC:
                    last_poll_time = now
                    values = poll_once(host, machine_id, svid_list)
                    if values is None:
                        consecutive_failures += 1
                        if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                            if not offline_announced:
                                log(machine_id, {
                                    "EN": f"Contact with {machine_name} was lost. Machine is offline.",
                                    "TH": f"การเชื่อมต่อ {machine_name} หลุด เครื่องจักรออฟไลน์"
                                }, "ALERT")
                                offline_announced = True
                            break
                    else:
                        consecutive_failures = 0
                        if last_values is None or values != last_values:
                            if last_values is not None:
                                changed = [POLL_SVIDS.get(svid, str(svid)) for svid in svid_list
                                           if values.get(svid) != last_values.get(svid)]
                                log(machine_id, {
                                    "EN": "Machine state changed: " + ", ".join(changed),
                                    "TH": "สถานะเครื่องเปลี่ยนแปลง: " + ", ".join(changed)
                                }, "INFO")
                            write_state(machine_id, values, "ONLINE", machine_name)
                            last_values = values

                # ── RATS: Check command queue ──
                if (now - last_cmd_time) >= COMMAND_CHECK_INTERVAL:
                    last_cmd_time = now
                    cmd = read_pending_command(machine_id)
                    if cmd is not None:
                        handle_command(host, machine_id, cmd)

                # Brief sleep to avoid CPU spin
                time.sleep(0.5)

        except Exception as e:
            log(machine_id, {
                "EN": f"Unexpected error in worker main loop: {e}",
                "TH": f"เกิดข้อผิดพลาดที่ไม่คาดคิดใน worker: {e}"
            }, "ERROR")

        finally:
            # ── Clean up connection ──
            if host is not None:
                try:
                    host.disable()
                except Exception:
                    pass

            # ── If not shutting down, mark CONN. LOST and retry ──
            if not shutdown_requested:
                current_state = ""
                try:
                    with open(state_path(machine_id), "r", encoding="utf-8") as fs:
                        current_state = json.load(fs).get("connection_status", "")
                except (json.JSONDecodeError, OSError):
                    pass
                if current_state != "OFFLINE":
                    write_state(machine_id, {}, "CONN. LOST", machine_name)
                time.sleep(RECONNECT_DELAY_SEC)

    # ── Final shutdown ───────────────────────────────────────────────────
    write_state(machine_id, {}, "OFFLINE", machine_name)
    log(machine_id, {
        "EN": f"Worker for {machine_name} shutting down.",
        "TH": f"Worker ของ {machine_name} กำลังปิดตัว"
    }, "INFO")


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Section Manager Worker — 1 process per machine")
    parser.add_argument("--machine", required=True, help="Machine ID (e.g. WB#83)")
    args = parser.parse_args()

    set_console_title(args.machine)

    print(f"{'='*60}")
    print(f"  Section Manager Worker — {args.machine}")
    print(f"  Machine: {MACHINE_DB.get(args.machine, {}).get('name', '?')}")
    print(f"  IP: {MACHINE_DB.get(args.machine, {}).get('ip', '?')}")
    print(f"  Port: {MACHINE_DB.get(args.machine, {}).get('port', '?')}")
    print(f"{'='*60}")
    print()

    run_worker(args.machine)
