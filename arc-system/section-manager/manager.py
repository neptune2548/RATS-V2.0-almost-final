"""
manager.py — Section Manager: Supervisor that spawns/monitors/restarts workers

Architecture:
  manager.py (this file)
     │
     ├── subprocess: worker.py --machine WB#76  (own console window)
     ├── subprocess: worker.py --machine WB#77  (own console window)
     ├── ...
     └── subprocess: worker.py --machine WB#87  (own console window)

Responsibilities:
  - Spawn 1 worker process per machine with CREATE_NEW_CONSOLE (Windows)
  - Monitor worker health via process liveness + state file freshness
  - Auto-restart crashed/frozen workers with exponential backoff
  - Graceful shutdown of all workers on Ctrl+C
  - Write supervisor health info to state/_manager.json
"""

import json
import os
import signal
import subprocess
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from pathlib import Path
# Derive project root dynamically — works on any machine regardless of install path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]  # arc-system/section-manager -> project root
sys.path.insert(0, str(_PROJECT_ROOT))

from database import MACHINE_DB

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

WORKER_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worker.py")
STATE_DIR     = os.path.join(os.path.dirname(os.path.abspath(__file__)), "state")
COMMANDS_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "commands")
LOGS_DIR      = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
HEARTBEAT_DIR = os.path.join(STATE_DIR, "heartbeats")

HEALTHCHECK_INTERVAL_SEC  = 3       # Check worker health every N seconds
BASE_RESTART_DELAY_SEC    = 5       # Initial restart delay
MAX_RESTART_DELAY_SEC     = 60      # Cap for exponential backoff
STALE_STATE_TIMEOUT_SEC   = 90      # Consider worker frozen if no state update for this long
STARTUP_STAGGER_SEC       = 0.5     # Delay between launching workers to avoid thundering herd

# ─────────────────────────────────────────────────────────────────────────────
# Console Title
# ─────────────────────────────────────────────────────────────────────────────

def set_console_title(title):
    """Set the manager's own console window title."""
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleTitleW(title)
        except Exception:
            pass
    else:
        sys.stdout.write(f"\033]0;{title}\007")
        sys.stdout.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Bilingual Human-Readable Logging
# ─────────────────────────────────────────────────────────────────────────────

LEVEL_ICONS = {
    "INFO":    "ℹ️ ",
    "SUCCESS": "✅",
    "ALERT":   "⚠️ ",
    "ERROR":   "❌",
}

def log(message, level="INFO", machine_id=None):
    """
    Print a timestamped bilingual log line.
    message: str or {"EN": ..., "TH": ...}
    """
    ts = time.strftime("%H:%M:%S")
    icon = LEVEL_ICONS.get(level, "  ")
    tag = f"[{machine_id}]" if machine_id else "[manager]"

    if isinstance(message, dict):
        en = message.get("EN", "")
        th = message.get("TH", "")
        print(f"[{ts}] {icon} {tag} {en}  |  {th}")
    else:
        print(f"[{ts}] {icon} {tag} {message}")


# ─────────────────────────────────────────────────────────────────────────────
# Worker Supervisor
# ─────────────────────────────────────────────────────────────────────────────

class WorkerSupervisor:
    """Manages the lifecycle of one worker subprocess."""

    def __init__(self, machine_id):
        self.machine_id = machine_id
        self.process = None
        self.log_file = None
        self.restart_count = 0
        self.last_start_time = 0
        self.last_restart_delay = BASE_RESTART_DELAY_SEC
        self.restart_scheduled_at = 0

    def start(self):
        """Launch (or re-launch) the worker subprocess hidden, logging to file."""
        log({
            "EN": f"Starting worker process (attempt #{self.restart_count + 1})...",
            "TH": f"เริ่มต้น worker process (ครั้งที่ {self.restart_count + 1})..."
        }, "INFO", self.machine_id)

        os.makedirs(LOGS_DIR, exist_ok=True)
        safe_id = self.machine_id.replace("#", "")
        log_path = os.path.join(LOGS_DIR, f"{safe_id}.log")
        if self.log_file:
            try:
                self.log_file.close()
            except OSError:
                pass
            self.log_file = None

        creation_flags = 0
        if os.name == "nt":
            creation_flags = 0x08000000  # CREATE_NO_WINDOW

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["ARC_WORKER_PARENT_WATCH"] = "1"

        try:
            self.log_file = open(log_path, "a", encoding="utf-8")
            self.process = subprocess.Popen(
                [sys.executable, WORKER_SCRIPT, "--machine", self.machine_id],
                creationflags=creation_flags,
                stdout=self.log_file,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
                bufsize=1,
                universal_newlines=True,
                env=env
            )
        except (OSError, subprocess.SubprocessError) as exc:
            if self.log_file:
                try:
                    self.log_file.close()
                except OSError:
                    pass
                self.log_file = None
            self.process = None
            delay = self.get_restart_delay()
            self.restart_scheduled_at = time.time() + delay
            log({
                "EN": f"Could not start worker: {exc}. Recovery scheduled in {delay}s.",
                "TH": f"ไม่สามารถเริ่ม worker ได้: {exc} ระบบจะลองกู้คืนใน {delay} วินาที"
            }, "ERROR", self.machine_id)
            return False
        self.last_start_time = time.time()
        self.restart_scheduled_at = 0
        return True

    def is_alive(self):
        """Check if the subprocess PID is still running."""
        return self.process is not None and self.process.poll() is None

    def is_frozen(self):
        """
        Check the worker's private heartbeat rather than dashboard state.
        Quiet machines do not rewrite state files when nothing changed.
        """
        if not self.is_alive():
            return False

        heartbeat_file = os.path.join(
            HEARTBEAT_DIR,
            f"{self.machine_id.replace('#', '')}.heartbeat",
        )
        if not os.path.exists(heartbeat_file):
            # Worker just started — give it time
            if (time.time() - self.last_start_time) < STALE_STATE_TIMEOUT_SEC:
                return False
            return True

        try:
            return (time.time() - os.path.getmtime(heartbeat_file)) > STALE_STATE_TIMEOUT_SEC
        except OSError:
            return False

    def get_restart_delay(self):
        """Exponential backoff: 5s → 10s → 20s → 40s → 60s (capped)."""
        delay = self.last_restart_delay
        self.last_restart_delay = min(delay * 2, MAX_RESTART_DELAY_SEC)
        return delay

    def reset_backoff(self):
        """Reset backoff after a successful long run."""
        self.last_restart_delay = BASE_RESTART_DELAY_SEC

    def stop(self):
        """Gracefully terminate the worker subprocess."""
        if self.process and self.process.poll() is None:
            log({
                "EN": "Sending shutdown signal to worker...",
                "TH": "กำลังส่งสัญญาณปิดไปยัง worker..."
            }, "INFO", self.machine_id)

            # On Windows, send CTRL_BREAK_EVENT so the worker can catch SIGBREAK
            if os.name == "nt":
                try:
                    self.process.send_signal(signal.CTRL_BREAK_EVENT)
                except OSError:
                    self.process.terminate()
            else:
                self.process.terminate()

            try:
                self.process.wait(timeout=10)
                log({
                    "EN": "Worker stopped cleanly.",
                    "TH": "Worker หยุดทำงานเรียบร้อย"
                }, "SUCCESS", self.machine_id)
            except subprocess.TimeoutExpired:
                log({
                    "EN": "Worker did not stop in time — force killing.",
                    "TH": "Worker ไม่ยอมหยุด — บังคับปิด"
                }, "ALERT", self.machine_id)
                self.process.kill()
            
            if self.log_file:
                self.log_file.close()
                self.log_file = None


# ─────────────────────────────────────────────────────────────────────────────
# Manager State File
# ─────────────────────────────────────────────────────────────────────────────

def write_manager_state(supervisors, start_time):
    """Write supervisor health info to state/_manager.json for optional monitoring."""
    os.makedirs(STATE_DIR, exist_ok=True)

    workers_info = {}
    for machine_id, sup in supervisors.items():
        state_file = os.path.join(STATE_DIR, f"{machine_id.replace('#', '')}.json")
        conn_status = "UNKNOWN"
        try:
            if os.path.exists(state_file):
                with open(state_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                conn_status = data.get("connection_status", "UNKNOWN")
        except (json.JSONDecodeError, OSError):
            pass

        workers_info[machine_id] = {
            "pid":              sup.process.pid if sup.process else None,
            "alive":            sup.is_alive(),
            "restart_count":    sup.restart_count,
            "connection_status": conn_status,
        }

    payload = {
        "manager":      "Section Manager",
        "uptime_sec":   int(time.time() - start_time),
        "updated_at":   time.strftime("%Y-%m-%d %H:%M:%S"),
        "worker_count":  len(supervisors),
        "workers":       workers_info,
    }

    tmp = os.path.join(STATE_DIR, "_manager.json.tmp")
    out = os.path.join(STATE_DIR, "_manager.json")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        os.replace(tmp, out)
    except OSError:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    set_console_title("Section Manager — Supervisor")

    os.makedirs(STATE_DIR, exist_ok=True)
    os.makedirs(COMMANDS_DIR, exist_ok=True)

    machine_ids = list(MACHINE_DB.keys())

    print("=" * 60)
    print("  Section Manager — Supervisor")
    print(f"  Managing {len(machine_ids)} machines")
    print("=" * 60)
    for m in machine_ids:
        info = MACHINE_DB[m]
        print(f"   • {m}: {info['name']}  ({info['ip']}:{info['port']})")
    print("=" * 60)
    print()

    log({
        "EN": f"Starting workers for {len(machine_ids)} machines...",
        "TH": f"กำลังเริ่ม workers สำหรับ {len(machine_ids)} เครื่อง..."
    }, "INFO")

    # ── Spawn all workers ────────────────────────────────────────────────
    supervisors = {}
    for machine_id in machine_ids:
        sup = WorkerSupervisor(machine_id)
        sup.start()
        supervisors[machine_id] = sup
        time.sleep(STARTUP_STAGGER_SEC)

    log({
        "EN": f"All {len(machine_ids)} workers launched. Monitoring started.",
        "TH": f"เปิด workers ทั้ง {len(machine_ids)} ตัวแล้ว เริ่มติดตามสุขภาพ"
    }, "SUCCESS")

    # ── Shutdown handler ─────────────────────────────────────────────────
    running = True

    def handle_shutdown(signum, frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, handle_shutdown)

    # ── Health monitoring loop ───────────────────────────────────────────
    start_time = time.time()

    try:
        while running:
            for machine_id, sup in supervisors.items():
                # ── Case 1: Worker process died ──
                if not sup.is_alive():
                    now = time.time()
                    if not sup.restart_scheduled_at:
                        exit_code = sup.process.returncode if sup.process else "?"
                        sup.restart_count += 1

                        # If worker ran for >60s before dying, reset backoff (was healthy for a while)
                        if (now - sup.last_start_time) > 60:
                            sup.reset_backoff()

                        delay = sup.get_restart_delay()
                        sup.restart_scheduled_at = now + delay
                        log({
                            "EN": f"Worker stopped (exit code: {exit_code}). Recovery scheduled in {delay}s. (total restarts: {sup.restart_count})",
                            "TH": f"Worker หยุดทำงาน (exit code: {exit_code}) ระบบจะกู้คืนใน {delay} วินาที (restart ทั้งหมด: {sup.restart_count} ครั้ง)"
                        }, "ALERT", machine_id)
                    elif now >= sup.restart_scheduled_at and running:
                        sup.start()

                # ── Case 2: Worker alive but frozen (no state updates) ──
                elif sup.is_frozen():
                    log({
                        "EN": f"Worker appears frozen (no state update for {STALE_STATE_TIMEOUT_SEC}s). Restarting...",
                        "TH": f"Worker ดูเหมือนค้าง (ไม่อัพเดทสถานะ {STALE_STATE_TIMEOUT_SEC} วินาที) กำลัง restart..."
                    }, "ALERT", machine_id)
                    sup.stop()
                    sup.restart_count += 1
                    delay = sup.get_restart_delay()
                    sup.restart_scheduled_at = time.time() + delay

            # ── Write supervisor state ──
            write_manager_state(supervisors, start_time)

            time.sleep(HEALTHCHECK_INTERVAL_SEC)

    finally:
        print()
        log({
            "EN": "Shutting down Section Manager — stopping all workers...",
            "TH": "กำลังปิด Section Manager — หยุด workers ทั้งหมด..."
        }, "INFO")

        for machine_id, sup in supervisors.items():
            sup.stop()

        # Write final state
        write_manager_state(supervisors, start_time)

        log({
            "EN": "All workers stopped. Section Manager shut down.",
            "TH": "Workers ทั้งหมดหยุดแล้ว Section Manager ปิดตัว"
        }, "SUCCESS")


if __name__ == "__main__":
    main()
