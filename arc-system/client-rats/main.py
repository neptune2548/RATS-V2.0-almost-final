from __future__ import annotations

import os
import gzip
import hashlib
import json
import re
import secrets
import shutil
import time
import uuid
import webbrowser
import threading
import asyncio
import ipaddress
import struct
import socket
import zlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import sys
from pathlib import Path
_CLIENT_RATS_DIR = Path(__file__).resolve().parent          # for testpull / testpush
_PROJECT_ROOT    = Path(__file__).resolve().parents[2]      # for database.py (single source of truth)
_PROCESS_STARTED_AT = time.time()
_SECTION_MANAGER_STATE = _PROJECT_ROOT / "arc-system" / "section-manager" / "state" / "_manager.json"
sys.path.insert(0, str(_PROJECT_ROOT))    # root first so database.py is unambiguous
sys.path.insert(0, str(_CLIENT_RATS_DIR)) # client-rats on top so local testpull/testpush win

from database import MACHINE_DB, SERIAL_TO_MACHINE
from testpull import run_pull
from testpush import run_push, find_closest_recipe, _strip_recipe_stem


def _env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: str) -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


ROLE_LEVELS = {
    "Guest": 0,
    "Operator": 1,
    "Technician": 2,
    "Administrator": 3,
    "Developer": 4,
}


def _role_credentials() -> dict[str, dict[str, str]]:
    return {
        "operator": {
            "role": "Operator",
            "password": os.getenv("RATS_OPERATOR_PASSWORD", ""),
        },
        "technician": {
            "role": "Technician",
            "password": os.getenv("RATS_TECHNICIAN_PASSWORD", ""),
        },
        "administrator": {
            "role": "Administrator",
            "password": os.getenv("RATS_ADMIN_PASSWORD", ""),
        },
        "admin": {
            "role": "Administrator",
            "password": os.getenv("RATS_ADMIN_PASSWORD", ""),
        },
        "developer": {
            "role": "Developer",
            "password": os.getenv("RATS_DEVELOPER_PASSWORD", ""),
        },
    }


SESSION_TIMEOUT_MINUTES = int(os.getenv("RATS_SESSION_TIMEOUT_MINUTES", "5"))
sessions: dict[str, dict[str, Any]] = {}
EMPLOYEE_AUDIT_PATH = Path(os.getenv("RATS_EMPLOYEE_AUDIT_PATH", str(_PROJECT_ROOT / "logs" / "employee_audit.json")))
employee_audit_sessions: list[dict[str, Any]] = []
employee_audit_lock = threading.Lock()


def _load_employee_audit() -> None:
    global employee_audit_sessions
    try:
        loaded = json.loads(EMPLOYEE_AUDIT_PATH.read_text(encoding="utf-8"))
        employee_audit_sessions = loaded if isinstance(loaded, list) else []
        changed = False
        restart_time = datetime.now().isoformat(timespec="seconds")
        for item in employee_audit_sessions:
            if not item.get("logout_at"):
                item["logout_at"] = restart_time
                item["logout_reason"] = "server_restart"
                changed = True
        if changed:
            _save_employee_audit()
    except (OSError, ValueError, json.JSONDecodeError):
        employee_audit_sessions = []


def _save_employee_audit() -> None:
    EMPLOYEE_AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = EMPLOYEE_AUDIT_PATH.with_name(f".{EMPLOYEE_AUDIT_PATH.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text(json.dumps(employee_audit_sessions, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temporary, EMPLOYEE_AUDIT_PATH)
    finally:
        temporary.unlink(missing_ok=True)


def _audit_login(employee_number: str, role: str, username: str) -> str:
    audit_id = uuid.uuid4().hex
    with employee_audit_lock:
        employee_audit_sessions.append({
            "id": audit_id,
            "employee_number": employee_number,
            "role": role,
            "username": username,
            "login_at": datetime.now().isoformat(timespec="seconds"),
            "logout_at": None,
            "logout_reason": None,
            "actions": [],
        })
        _save_employee_audit()
    return audit_id


def _audit_close(session: dict[str, Any], reason: str) -> None:
    audit_id = session.get("audit_id")
    if not audit_id:
        return
    with employee_audit_lock:
        for item in reversed(employee_audit_sessions):
            if item.get("id") == audit_id and not item.get("logout_at"):
                item["logout_at"] = datetime.now().isoformat(timespec="seconds")
                item["logout_reason"] = reason
                _save_employee_audit()
                break


def _audit_action(session: dict[str, Any], action: str, **details: Any) -> None:
    audit_id = session.get("audit_id")
    if not audit_id:
        return
    entry = {"timestamp": datetime.now().isoformat(timespec="seconds"), "action": action}
    entry.update({key: value for key, value in details.items() if value is not None})
    with employee_audit_lock:
        for item in reversed(employee_audit_sessions):
            if item.get("id") == audit_id:
                item.setdefault("actions", []).append(entry)
                _save_employee_audit()
                break


_load_employee_audit()


def _new_session(role: str, username: str, employee_number: str) -> dict[str, str]:
    token = secrets.token_urlsafe(32)
    audit_id = _audit_login(employee_number, role, username)
    sessions[token] = {
        "role": role,
        "username": username,
        "employee_number": employee_number,
        "audit_id": audit_id,
        "expires_at": datetime.utcnow() + timedelta(minutes=SESSION_TIMEOUT_MINUTES),
    }
    return {"token": token, "role": role, "username": username, "employee_number": employee_number}


def require_role(session_token: str | None, minimum_role: str) -> dict[str, Any]:
    if not session_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = sessions.get(session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    if session["expires_at"] < datetime.utcnow():
        sessions.pop(session_token, None)
        _audit_close(session, "session_timeout")
        raise HTTPException(status_code=401, detail="Session expired")

    if ROLE_LEVELS.get(session["role"], 0) < ROLE_LEVELS[minimum_role]:
        raise HTTPException(status_code=403, detail=f"{minimum_role} role required")

    session["expires_at"] = datetime.utcnow() + timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    return session


async def expire_inactive_sessions() -> None:
    """Close idle login records even when a browser stops making requests."""
    while True:
        await asyncio.sleep(30)
        now = datetime.utcnow()
        expired_tokens = [
            token for token, session in tuple(sessions.items())
            if session["expires_at"] < now
        ]
        for token in expired_tokens:
            session = sessions.pop(token, None)
            if session:
                _audit_close(session, "session_timeout")

app = FastAPI(title="Master Recipe Command Center")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_env_list("RATS_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"),
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
        "deploy_port": int(_info.get("deploy_port", 5004)),
        "production_section": _info.get("production_section", "UNASSIGNED"),
        "map_position": _info.get("map_position"),
        "status": "IDLE",
        "current_program": "None",
        "link_status": "OFFLINE",
        "bot_status": "OFFLINE",
        "machine_link_status": "OFFLINE",
    }

event_log: list[dict[str, str]] = [
    {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "level": "INFO",
        "message": "Command Center initialized. Waiting for barcode scan.",
    }
]

connections: set[WebSocket] = set()

RECIPE_DIR = _PROJECT_ROOT / "BondingProg"
PENDING_RECIPE_DIR = RECIPE_DIR / ".pending"
RECIPE_ARCHIVE_DIR = RECIPE_DIR / ".archive"
MAX_PROXY_UPLOAD_BYTES = int(os.getenv("RATS_PROXY_MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
PROXY_UPLOAD_TOKEN = os.getenv("RATS_PROXY_UPLOAD_TOKEN", "").strip()
MAX_DEPLOY_UPLOAD_BYTES = int(os.getenv("RATS_DEPLOY_MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
DEPLOY_RECEIVER_TOKEN = os.getenv("RATS_DEPLOY_TOKEN", "").strip()
DEPLOY_RECEIVER_PORT = int(os.getenv("RATS_DEPLOY_PORT", "5004"))
DEPLOY_ALLOWED_FILES = {"secs_proxy_bot.exe", "config.ini"}
pending_recipe_updates: dict[str, dict[str, Any]] = {}
bot_file_tasks: set[asyncio.Task] = set()


def _personalize_recipe_bot_config(data: bytes, machine_id: str) -> bytes:
    """Set the selected machine identity while preserving the uploaded INI."""
    try:
        text = data.decode("utf-8-sig")
        encoding = "utf-8"
    except UnicodeDecodeError:
        text = data.decode("cp1252")
        encoding = "cp1252"

    replacement = f"machine_id = {machine_id}"
    updated, count = re.subn(
        r"(?im)^\s*machine_id\s*=.*$",
        replacement,
        text,
        count=1,
    )
    if count == 0:
        separator = "" if not text or text.endswith(("\n", "\r")) else "\r\n"
        updated = f"{text}{separator}{replacement}\r\n"
    return updated.encode(encoding)


def _resolve_recipe_bot_machine_id(channel_machine_id: str, reported_machine_id: Any) -> tuple[str, str]:
    """Trust the host-selected machine IP while retaining the bot's report for diagnostics."""
    return channel_machine_id, str(reported_machine_id or "")


@app.post("/api/proxy/status")
async def receive_proxy_status(
    body: dict,
    x_proxy_token: str | None = Header(default=None),
    x_machine_id: str | None = Header(default=None),
) -> JSONResponse:
    """Accept retired proxy reports without allowing them to drive live state."""
    if not x_proxy_token or not secrets.compare_digest(x_proxy_token, PROXY_UPLOAD_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid Recipe Bot status token")
    if not x_machine_id or x_machine_id not in machines:
        raise HTTPException(status_code=422, detail="Unknown or missing machine ID")
    # The replacement Recipe Bot never calls HTTP. Bot state is owned only by
    # the authenticated port-5003 channel, and machine state only by the direct
    # Section Manager HSMS connection. Silently accepting an old report avoids
    # a retry storm while preventing stale 5002 data from showing false ONLINE.
    return JSONResponse({"status": "ignored_legacy", "changed": False}, status_code=202)


@app.post("/api/internal/connection-status")
async def receive_worker_connection_status(request: Request, body: dict) -> JSONResponse:
    """Receive an event-driven state change from a local Section Manager worker."""
    if request.client and request.client.host not in {"127.0.0.1", "::1"}:
        raise HTTPException(status_code=403, detail="Local worker endpoint")
    machine_id = str(body.get("machine_id", ""))
    if machine_id not in machines:
        raise HTTPException(status_code=422, detail="Unknown machine ID")
    changed = _apply_worker_state(machine_id, body)
    if changed:
        await broadcast_state()
    return JSONResponse({"status": "ok", "changed": changed})


@app.post("/api/internal/events")
async def receive_worker_event(request: Request, body: dict) -> JSONResponse:
    """Receive a human-readable event from a local Section Manager worker."""
    if request.client and request.client.host not in {"127.0.0.1", "::1"}:
        raise HTTPException(status_code=403, detail="Local worker endpoint")
    machine_id = str(body.get("machine_id", "")).strip()
    level = str(body.get("level", "INFO")).upper()
    if machine_id not in machines:
        raise HTTPException(status_code=422, detail="Unknown machine ID")
    if level not in {"INFO", "SUCCESS", "WARN", "ALERT", "ERROR"}:
        level = "INFO"
    message = body.get("message", "")
    if isinstance(message, dict):
        message = {key: str(value) for key, value in message.items() if key in {"EN", "TH"}}
    else:
        message = str(message)

    # Reconnect attempts are an implementation detail.  Old worker processes
    # may still emit these messages, so keep them out of the operator audit log.
    searchable = " ".join(message.values()) if isinstance(message, dict) else message
    reconnect_noise = (
        "connecting to ", "retrying in ", "reconnecting...",
        "กำลังเชื่อมต่อไปยัง", "กำลังเชื่อมต่อใหม่", "แล้วลองใหม่",
    )
    if any(fragment in searchable.lower() for fragment in reconnect_noise):
        return JSONResponse({"status": "ok", "suppressed": True})

    add_event(
        {"EN": f"[{machine_id}] {message.get('EN', '')}", "TH": f"[{machine_id}] {message.get('TH', '')}"}
        if isinstance(message, dict) else f"[{machine_id}] {message}",
        level,
        machine_id=machine_id,
    )
    await broadcast_state()
    return JSONResponse({"status": "ok"})


def _apply_worker_state(machine_id: str, state_data: dict) -> bool:
    """Apply one worker-written state payload; return whether dashboard data changed."""
    machine = machines[machine_id]
    changed = False
    connection_status = str(state_data.get("connection_status", "")).upper()
    if connection_status:
        machine_link = (
            "ONLINE" if connection_status == "ONLINE"
            else "OFFLINE" if connection_status in {"OFFLINE", "CONN. LOST"}
            else "CONNECTING"
        )
        if machine.get("link_status") != connection_status:
            machine["link_status"] = connection_status
            changed = True
        if machine.get("machine_link_status") != machine_link:
            machine["machine_link_status"] = machine_link
            changed = True

    active_recipe = state_data.get("values", {}).get("ActiveRecipe", {}).get("display")
    if active_recipe is not None and machine.get("current_program") != active_recipe:
        machine["current_program"] = active_recipe
        changed = True
    return changed


def _load_worker_states_once() -> None:
    """Seed dashboard state at startup; subsequent updates arrive as worker events."""
    state_dir = BASE_DIR.parent / "section-manager" / "state"
    for machine_id in machines:
        state_file = state_dir / f"{machine_id.replace('#', '')}.json"
        try:
            if state_file.is_file():
                _apply_worker_state(machine_id, json.loads(state_file.read_text(encoding="utf-8")))
        except (OSError, ValueError, json.JSONDecodeError):
            continue


# ── Helpers ──────────────────────────────────────────────────────────────────

def snapshot() -> dict[str, Any]:
    return {
        "machines": list(machines.values()),
        "events": event_log[-100:],
        "pending_recipe_updates": [
            {key: value for key, value in item.items() if key not in {"pending_path", "metadata_path", "existing_path"}}
            for item in sorted(pending_recipe_updates.values(), key=lambda entry: entry["received_at"])
        ],
    }


def _infer_event_machine_id(message: dict | str) -> str | None:
    text = " ".join(str(value) for value in message.values()) if isinstance(message, dict) else str(message)
    match = re.search(r"WB#(\d+)", text, flags=re.IGNORECASE)
    if not match:
        match = re.search(r"Wire Bonder\s*#(\d+)", text, flags=re.IGNORECASE)
    if not match:
        return None
    candidate = f"WB#{match.group(1)}"
    return candidate if candidate in machines else None


def add_event(message: dict | str, level: str = "INFO", machine_id: str | None = None) -> None:
    resolved_machine_id = machine_id or _infer_event_machine_id(message)
    item = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "level": level,
        "message": message,
        "machine_id": resolved_machine_id,
        "production_section": (
            machines[resolved_machine_id]["production_section"]
            if resolved_machine_id in machines else "SYSTEM"
        ),
    }
    event_log.append(item)
    del event_log[:-100]


def _safe_ppid(ppid: str) -> str:
    cleaned = ppid.strip().rstrip(".")
    if not cleaned or len(cleaned) > 120:
        raise HTTPException(status_code=422, detail="Invalid PPID in recipe file")
    if any(ch in cleaned for ch in '<>:"/\\|?*') or any(ord(ch) < 32 for ch in cleaned):
        raise HTTPException(status_code=422, detail="PPID contains invalid filename characters")
    return cleaned


def _decompressed_pwb(data: bytes) -> bytes:
    try:
        return gzip.decompress(data)
    except (gzip.BadGzipFile, EOFError, OSError):
        return data


def _extract_ppid_from_pwb(data: bytes) -> str:
    content = _decompressed_pwb(data)
    match = re.search(
        rb"Program Name\s*:?\s*([A-Za-z0-9_. -]{3,120})",
        content,
        flags=re.IGNORECASE,
    )
    if not match:
        raise HTTPException(status_code=422, detail="Program Name/PPID was not found inside the PWB file")
    ppid = match.group(1).decode("ascii", errors="strict").strip()
    return _safe_ppid(ppid)


def _recipe_sha256(path: Path) -> str:
    return hashlib.sha256(_decompressed_pwb(path.read_bytes())).hexdigest()


def _find_recipe_by_ppid(ppid: str) -> Path | None:
    if not RECIPE_DIR.is_dir():
        return None
    wanted = ppid.upper()
    for path in RECIPE_DIR.iterdir():
        if path.is_file() and path.name.upper().endswith(".PWB"):
            if _strip_recipe_stem(path.name).upper() == wanted:
                return path
    return None


def _atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_bytes(data)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink(missing_ok=True)


def _remove_pending_request(request_id: str) -> dict[str, Any]:
    item = pending_recipe_updates.pop(request_id, None)
    if not item:
        raise HTTPException(status_code=404, detail="Pending recipe request not found")
    return item


def _load_pending_recipe_updates() -> None:
    pending_recipe_updates.clear()
    if not PENDING_RECIPE_DIR.is_dir():
        return
    for metadata_path in PENDING_RECIPE_DIR.glob("*.json"):
        try:
            item = json.loads(metadata_path.read_text(encoding="utf-8"))
            pending_path = PENDING_RECIPE_DIR / f"{item['request_id']}.PWB"
            existing_path = Path(item["existing_path"])
            if pending_path.is_file() and existing_path.is_file():
                item["pending_path"] = str(pending_path)
                item["metadata_path"] = str(metadata_path)
                pending_recipe_updates[item["request_id"]] = item
        except (KeyError, OSError, ValueError, json.JSONDecodeError):
            continue


class _MemoryRecipeRequest:
    """Minimal Request-compatible wrapper for the private TCP file channel."""
    def __init__(self, data: bytes):
        self._data = data
        self.headers = {"content-length": str(len(data))}

    async def body(self) -> bytes:
        return self._data


async def _set_bot_channel_status(machine_id: str, status: str) -> None:
    machine = machines[machine_id]
    if machine.get("bot_status") == status:
        return
    machine["bot_status"] = status
    add_event({
        "EN": f"Recipe Bot channel for {machine_id} is {status}.",
        "TH": f"ช่องทาง Recipe Bot ของ {machine_id} มีสถานะ {status}",
    }, "SUCCESS" if status == "ONLINE" else "ALERT", machine_id=machine_id)
    await broadcast_state()


def _matching_local_ipv4(remote_host: str) -> str | None:
    """Choose this host's IPv4 address with the longest prefix match."""
    try:
        remote = ipaddress.IPv4Address(socket.gethostbyname(remote_host))
    except (OSError, ipaddress.AddressValueError):
        return None

    candidates: set[ipaddress.IPv4Address] = set()
    try:
        for family, _, _, _, address in socket.getaddrinfo(
            socket.gethostname(), None, socket.AF_INET, socket.SOCK_STREAM
        ):
            if family == socket.AF_INET:
                candidate = ipaddress.IPv4Address(address[0])
                if not candidate.is_loopback and not candidate.is_unspecified:
                    candidates.add(candidate)
    except OSError:
        return None
    if not candidates:
        return None

    def common_prefix(candidate: ipaddress.IPv4Address) -> int:
        difference = int(candidate) ^ int(remote)
        return 32 if difference == 0 else 32 - difference.bit_length()

    best = max(candidates, key=common_prefix)
    # Only force a source when both addresses genuinely share a LAN prefix.
    # Otherwise let Windows use its normal routing table.
    return str(best) if common_prefix(best) >= 24 else None


async def _send_deployment_file(machine_id: str, filename: str, data: bytes) -> dict[str, Any]:
    """Send one allowlisted file to the authenticated machine-side TCP receiver."""
    if not DEPLOY_RECEIVER_TOKEN:
        raise RuntimeError("RATS_DEPLOY_TOKEN is not configured on the RATS host")
    info = MACHINE_DB[machine_id]
    host = str(info["ip"])
    port = int(info.get("deploy_port", DEPLOY_RECEIVER_PORT))
    writer: asyncio.StreamWriter | None = None
    try:
        local_source = _matching_local_ipv4(host)
        connect_options = {"local_addr": (local_source, 0)} if local_source else {}
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port, **connect_options),
                timeout=5,
            )
        except OSError as exc:
            if not local_source or getattr(exc, "winerror", None) != 10049:
                raise
            reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=5)

        token = DEPLOY_RECEIVER_TOKEN.encode("utf-8")
        encoded_machine_id = machine_id.encode("utf-8")
        writer.write(
            b"ARCDEP01"
            + struct.pack("!H", len(token))
            + token
            + struct.pack("!H", len(encoded_machine_id))
            + encoded_machine_id
        )
        await writer.drain()
        if await asyncio.wait_for(reader.readexactly(1), timeout=5) != b"\x01":
            raise ConnectionError("Deployment receiver authentication or machine ID was rejected")

        encoded_filename = filename.encode("utf-8")
        checksum = zlib.crc32(data) & 0xFFFFFFFF
        writer.write(
            b"P"
            + struct.pack("!HII", len(encoded_filename), len(data), checksum)
            + encoded_filename
            + data
        )
        await writer.drain()

        result_code = (await asyncio.wait_for(reader.readexactly(1), timeout=30))[0]
        message_length = struct.unpack("!H", await asyncio.wait_for(reader.readexactly(2), timeout=5))[0]
        message = (await asyncio.wait_for(reader.readexactly(message_length), timeout=5)).decode(
            "utf-8", errors="replace"
        )
        if result_code not in {1, 2}:
            raise ConnectionError(message or "Deployment receiver rejected the file")
        return {
            "ok": True,
            "machine_id": machine_id,
            "filename": filename,
            "bytes": len(data),
            "status": "installed" if result_code == 1 else "staged_pending",
            "message": message,
            "port": port,
        }
    finally:
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass


async def bot_file_channel(machine_id: str, host: str, port: int) -> None:
    """Host-initiated full-duplex PWB channel; reconnects only after a disconnect."""
    while True:
        writer = None
        try:
            if not PROXY_UPLOAD_TOKEN:
                await _set_bot_channel_status(machine_id, "OFFLINE")
                await asyncio.sleep(30)
                continue
            # Re-evaluate the adapter for every attempt so DHCP/interface
            # changes cannot leave reconnects pinned to an obsolete address.
            local_source = _matching_local_ipv4(host)
            connect_options = {"local_addr": (local_source, 0)} if local_source else {}
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(host, port, **connect_options),
                    timeout=3,
                )
            except OSError as exc:
                # If Windows says the selected source no longer exists, retry
                # once through its routing table before entering normal backoff.
                if not local_source or getattr(exc, "winerror", None) != 10049:
                    raise
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(host, port),
                    timeout=3,
                )
            token = PROXY_UPLOAD_TOKEN.encode("utf-8")
            writer.write(b"ARCFBOT1" + struct.pack("!H", len(token)) + token)
            await writer.drain()
            if await asyncio.wait_for(reader.readexactly(1), timeout=3) != b"\x01":
                raise ConnectionError("Recipe Bot authentication rejected")

            socket_obj = writer.get_extra_info("socket")
            if socket_obj is not None:
                socket_obj.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
                raw_socket = getattr(socket_obj, "_sock", socket_obj)
                if hasattr(socket, "SIO_KEEPALIVE_VALS") and hasattr(raw_socket, "ioctl"):
                    raw_socket.ioctl(socket.SIO_KEEPALIVE_VALS, (1, 10000, 3000))
            await _set_bot_channel_status(machine_id, "ONLINE")

            while True:
                header_length = struct.unpack("!I", await reader.readexactly(4))[0]
                if header_length < 2 or header_length > 65536:
                    raise ConnectionError("Invalid Recipe Bot header length")
                header = json.loads((await reader.readexactly(header_length)).decode("utf-8"))
                frame_type = header.get("type")
                if frame_type not in {"recipe", "check"}:
                    raise ConnectionError("Unsupported Recipe Bot frame")
                # The host initiated this socket to the IP assigned to
                # ``machine_id``, so the selected channel is the authoritative
                # identity. Older fleet copies may still contain WB#82 in
                # config.ini; rejecting that header traps their durable outbox
                # in a reconnect loop even though the host reached the correct
                # equipment PC. New deployments still receive a personalized
                # machine_id, while old deployments remain compatible.
                effective_machine_id, claimed_machine_id = _resolve_recipe_bot_machine_id(
                    machine_id,
                    header.get("machine_id"),
                )
                if claimed_machine_id and claimed_machine_id != machine_id:
                    header["reported_machine_id"] = claimed_machine_id
                header["machine_id"] = effective_machine_id
                file_size = int(header.get("size", 0))
                if file_size <= 0 or file_size > MAX_PROXY_UPLOAD_BYTES:
                    raise ConnectionError("Invalid Recipe Bot file size")
                data = await reader.readexactly(file_size)

                try:
                    if frame_type == "check":
                        embedded_ppid = _extract_ppid_from_pwb(data)
                        claimed_ppid = str(header.get("ppid", ""))
                        if claimed_ppid and claimed_ppid.upper() != embedded_ppid.upper():
                            raise HTTPException(status_code=422, detail="Recipe Bot PPID does not match PWB Program Name")
                        existing = _find_recipe_by_ppid(embedded_ppid)
                        if existing is None:
                            check_status = "new"
                        elif secrets.compare_digest(
                            _recipe_sha256(existing),
                            hashlib.sha256(_decompressed_pwb(data)).hexdigest(),
                        ):
                            check_status = "identical"
                        else:
                            check_status = "different"
                        result = {"ok": True, "status": check_status, "ppid": embedded_ppid, "result_code": 200}
                        encoded = json.dumps(result, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
                        writer.write(struct.pack("!I", len(encoded)) + encoded)
                        await writer.drain()
                        continue
                    response = await receive_proxy_recipe(
                        _MemoryRecipeRequest(data),
                        PROXY_UPLOAD_TOKEN,
                        machine_id,
                        str(header.get("ppid", "")),
                        str(header.get("source_filename", "NPGM.PWB")),
                        None,
                        str(header.get("source_modified_ms", "")),
                    )
                    result = json.loads(response.body.decode("utf-8"))
                    result["ok"] = True
                    result["result_code"] = response.status_code
                except HTTPException as exc:
                    result = {"ok": False, "result_code": exc.status_code, "detail": str(exc.detail)}
                except Exception as exc:
                    result = {"ok": False, "result_code": 500, "detail": str(exc)}

                encoded = json.dumps(result, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
                writer.write(struct.pack("!I", len(encoded)) + encoded)
                await writer.drain()
        except asyncio.CancelledError:
            raise
        except Exception:
            await _set_bot_channel_status(machine_id, "OFFLINE")
        finally:
            if writer is not None:
                writer.close()
                try:
                    await writer.wait_closed()
                except Exception:
                    pass
        await asyncio.sleep(5)


@app.on_event("startup")
async def startup_event():
    RECIPE_DIR.mkdir(parents=True, exist_ok=True)
    PENDING_RECIPE_DIR.mkdir(parents=True, exist_ok=True)
    _load_pending_recipe_updates()
    _load_worker_states_once()
    cleanup_task = asyncio.create_task(expire_inactive_sessions())
    bot_file_tasks.add(cleanup_task)
    cleanup_task.add_done_callback(bot_file_tasks.discard)
    for machine_id, info in MACHINE_DB.items():
        file_port = info.get("bot_file_port")
        if file_port:
            task = asyncio.create_task(bot_file_channel(machine_id, info["ip"], int(file_port)))
            bot_file_tasks.add(task)
            task.add_done_callback(bot_file_tasks.discard)


async def broadcast_state() -> None:
    stale: list[WebSocket] = []
    payload = snapshot()

    for ws in tuple(connections):
        try:
            await ws.send_json(payload)
        except Exception:
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
        add_event(message, level, machine_id=target_machine_id)

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


@app.get("/api/health")
async def get_health(x_session_token: str | None = Header(default=None)) -> JSONResponse:
    """Return production health from real runtime files instead of static UI labels."""
    require_role(x_session_token, "Operator")

    manager_data: dict[str, Any] = {}
    manager_age_sec: float | None = None
    try:
        manager_data = json.loads(_SECTION_MANAGER_STATE.read_text(encoding="utf-8"))
        manager_age_sec = max(0.0, time.time() - _SECTION_MANAGER_STATE.stat().st_mtime)
    except (OSError, ValueError, json.JSONDecodeError):
        manager_data = {}

    workers = manager_data.get("workers", {}) if isinstance(manager_data, dict) else {}
    worker_total = len(MACHINE_DB)
    workers_alive = sum(1 for item in workers.values() if item.get("alive"))
    manager_online = manager_age_sec is not None and manager_age_sec <= 15

    recipe_files = 0
    archive_files = 0
    try:
        recipe_files = sum(1 for item in RECIPE_DIR.iterdir() if item.is_file() and item.suffix.upper() == ".PWB")
    except OSError:
        pass
    try:
        archive_files = sum(1 for item in RECIPE_ARCHIVE_DIR.iterdir() if item.is_file() and item.suffix.upper() == ".PWB")
    except OSError:
        pass

    default_credentials = []
    required_secrets = (
        "RATS_OPERATOR_PASSWORD",
        "RATS_TECHNICIAN_PASSWORD",
        "RATS_ADMIN_PASSWORD",
        "RATS_DEVELOPER_PASSWORD",
        "RATS_PROXY_UPLOAD_TOKEN",
        "RATS_DEPLOY_TOKEN",
    )
    for name in required_secrets:
        if not os.getenv(name, "").strip():
            default_credentials.append(name)

    disk = shutil.disk_usage(_PROJECT_ROOT)
    checks = {
        "backend": {"status": "ONLINE", "uptime_sec": int(time.time() - _PROCESS_STARTED_AT)},
        "section_manager": {
            "status": "ONLINE" if manager_online else "OFFLINE",
            "age_sec": round(manager_age_sec, 1) if manager_age_sec is not None else None,
        },
        "workers": {"status": "READY" if workers_alive == worker_total else "DEGRADED", "alive": workers_alive, "total": worker_total},
        "recipe_storage": {"status": "READY" if RECIPE_DIR.is_dir() else "ERROR", "recipes": recipe_files, "archives": archive_files},
        "audit_storage": {"status": "READY" if EMPLOYEE_AUDIT_PATH.parent.is_dir() else "ERROR", "sessions": len(employee_audit_sessions)},
        "disk": {"status": "READY" if disk.free >= 1024 ** 3 else "WARNING", "free_gb": round(disk.free / (1024 ** 3), 1)},
        "security": {"status": "WARNING" if default_credentials else "READY", "default_credentials": default_credentials},
    }
    overall = "READY"
    if any(item["status"] in {"OFFLINE", "ERROR"} for item in checks.values()):
        overall = "NOT_READY"
    elif any(item["status"] in {"DEGRADED", "WARNING"} for item in checks.values()):
        overall = "ATTENTION"

    return JSONResponse({
        "overall": overall,
        "checked_at": datetime.now().isoformat(timespec="seconds"),
        "checks": checks,
    })


@app.post("/api/auth/login")
async def login(body: dict | None = None) -> JSONResponse:
    employee_number = (body or {}).get("employee_number", "").strip().upper()
    username = (body or {}).get("username", "").strip().lower()
    password = (body or {}).get("password", "").strip()
    if not employee_number:
        return JSONResponse({"error": "Employee Number is required"}, status_code=400)
    if not re.fullmatch(r"[A-Z0-9-]{1,20}", employee_number):
        return JSONResponse({"error": "Employee Number must contain only letters, numbers, or hyphens"}, status_code=400)
    user = _role_credentials().get(username)

    if not user or not user["password"] or not secrets.compare_digest(password, user["password"]):
        return JSONResponse({"error": "Invalid username or password"}, status_code=401)

    return JSONResponse(_new_session(user["role"], username, employee_number))


@app.post("/api/auth/logout")
async def logout(x_session_token: str | None = Header(default=None)) -> JSONResponse:
    if x_session_token:
        session = sessions.pop(x_session_token, None)
        if session:
            _audit_close(session, "logout")
    return JSONResponse({"status": "ok"})


@app.get("/api/audit/employee-sessions")
async def employee_audit_log(
    limit: int = 200,
    x_session_token: str | None = Header(default=None),
) -> JSONResponse:
    require_role(x_session_token, "Administrator")
    safe_limit = max(1, min(limit, 1000))
    with employee_audit_lock:
        records = json.loads(json.dumps(employee_audit_sessions[-safe_limit:], ensure_ascii=False))
    records.reverse()
    return JSONResponse({"sessions": records})


@app.post("/api/machines/{machine_id}/deploy-file")
async def deploy_machine_file(
    machine_id: str,
    request: Request,
    x_deploy_filename: str | None = Header(default=None),
    x_session_token: str | None = Header(default=None),
) -> JSONResponse:
    """Send Recipe Bot files through the dedicated authenticated TCP receiver."""
    session = require_role(x_session_token, "Developer")
    if machine_id not in MACHINE_DB:
        raise HTTPException(status_code=404, detail="Unknown machine ID")

    supplied_filename = (x_deploy_filename or "").strip()
    filename = supplied_filename.lower()
    if (
        not supplied_filename
        or supplied_filename != Path(supplied_filename).name
        or "/" in supplied_filename
        or "\\" in supplied_filename
        or filename not in DEPLOY_ALLOWED_FILES
    ):
        raise HTTPException(
            status_code=422,
            detail="Only secs_proxy_bot.exe and config.ini can be deployed",
        )

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_DEPLOY_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Deployment file is too large")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length")
    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="Deployment file is empty")
    if len(data) > MAX_DEPLOY_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Deployment file is too large")
    if filename.endswith(".exe") and data[:2] != b"MZ":
        raise HTTPException(status_code=422, detail="The selected EXE does not have a valid Windows MZ header")
    if filename == "config.ini":
        data = _personalize_recipe_bot_config(data, machine_id)

    try:
        result = await _send_deployment_file(machine_id, filename, data)
    except Exception as exc:
        _audit_action(session, "DEPLOY_FILE", machine_id=machine_id, filename=filename, result="error", error=str(exc))
        add_event({
            "EN": f"Deployment to {machine_id} failed for {filename}: {exc}",
            "TH": f"ส่งไฟล์ {filename} ไปยัง {machine_id} ไม่สำเร็จ: {exc}",
        }, "ALERT")
        await broadcast_state()
        raise HTTPException(status_code=502, detail=str(exc))

    level = "WARN" if result["status"] == "staged_pending" else "SUCCESS"
    add_event({
        "EN": f"{session['username']} deployed {filename} to {machine_id}: {result['message']}",
        "TH": f"{session['username']} ส่งไฟล์ {filename} ไปยัง {machine_id}: {result['message']}",
    }, level)
    _audit_action(session, "DEPLOY_FILE", machine_id=machine_id, filename=filename, result=result["status"])
    await broadcast_state()
    return JSONResponse(result)


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
async def clear_logs(x_session_token: str | None = Header(default=None)) -> JSONResponse:
    """Save the current event log to a text file and clear the memory."""
    session = require_role(x_session_token, "Technician")
    import os
    logs_dir = BASE_DIR / "logs"
    os.makedirs(logs_dir, exist_ok=True)
    filename = logs_dir / f"event_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    with open(filename, "w", encoding="utf-8") as f:
        for event in event_log:
            f.write(f"[{event['timestamp']}] {event['level']} - {event['message']}\n")
    
    event_log.clear()
    _audit_action(session, "CLEAR_EVENT_LOG", archive_file=filename.name)
    add_event({"EN": f"Event log successfully archived to {filename.name} and purged from memory.", "TH": f"บันทึกเหตุการณ์ถูกจัดเก็บลง {filename.name} และล้างออกจากหน่วยความจำเรียบร้อยแล้ว"}, "INFO")
    await broadcast_state()
    return JSONResponse({"status": "ok", "events": event_log[-100:]})





@app.post("/api/machines/{machine_id}/pull")
async def pull_program(machine_id: str, body: dict | None = None, x_session_token: str | None = Header(default=None)) -> JSONResponse:
    """Pull all recipes, or one explicitly named recipe, from a machine via SECS/GEM."""
    session = require_role(x_session_token, "Operator")
    machine = machines.get(machine_id)
    if machine is None:
        return JSONResponse({"error": "Machine not found"}, status_code=404)

    selected_recipe = str((body or {}).get("recipe_name", "")).strip()
    pull_label = f"recipe '{selected_recipe}'" if selected_recipe else "all recipes"
    add_event({"EN": f"Initiating PULL for {pull_label} from {machine['name']}...", "TH": f"กำลังเริ่มดึง {('สูตร ' + selected_recipe) if selected_recipe else 'สูตรทั้งหมด'} จาก {machine['name']}..."}, "INFO")
    await broadcast_state()

    # Update machine status
    machine["status"] = "SYNCING"
    await broadcast_state()

    loop = asyncio.get_running_loop()
    log_callback = make_log_callback(loop)

    try:
        result = await asyncio.to_thread(
            run_pull,
            machine_id,
            log_callback,
            [selected_recipe] if selected_recipe else None,
        )
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
    _audit_action(
        session,
        "PULL_RECIPE",
        machine_id=machine_id,
        recipes=result.get("pulled", []) or ([selected_recipe] if selected_recipe else []),
        result=result.get("status", "error"),
    )
    await broadcast_state()

    return JSONResponse({"result": result, "machine": machine, "events": event_log[-100:]})


@app.post("/api/machines/{machine_id}/push")
async def push_program(machine_id: str, body: dict | None = None, x_session_token: str | None = Header(default=None)) -> JSONResponse:
    """Push a recipe program to a machine via SECS/GEM."""
    session = require_role(x_session_token, "Operator")
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
    _audit_action(
        session,
        "PUSH_RECIPE",
        machine_id=machine_id,
        recipe=program_name,
        result=result.get("status", "error"),
    )
    await broadcast_state()

    return JSONResponse({"result": result, "machine": machine, "events": event_log[-100:]})


@app.post("/api/machines/{machine_id}/delete")
async def delete_program(machine_id: str, body: dict | None = None, x_session_token: str | None = Header(default=None)) -> JSONResponse:
    """Delete a recipe program from a machine via SECS/GEM."""
    session = require_role(x_session_token, "Technician")
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
    _audit_action(
        session,
        "DELETE_RECIPE",
        machine_id=machine_id,
        recipe=program_name,
        result=result.get("status", "error"),
    )
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


@app.post("/api/proxy/recipes")
async def receive_proxy_recipe(
    request: Request,
    x_proxy_token: str | None = Header(default=None),
    x_machine_id: str | None = Header(default=None),
    x_ppid: str | None = Header(default=None),
    x_source_filename: str | None = Header(default=None),
    x_content_sha256: str | None = Header(default=None),
    x_source_modified_ms: str | None = Header(default=None),
) -> JSONResponse:
    """Ingest an operator-approved PWB from either supported transport."""
    if not x_proxy_token or not secrets.compare_digest(x_proxy_token, PROXY_UPLOAD_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid Recipe Bot upload token")
    if not x_machine_id or x_machine_id not in MACHINE_DB:
        raise HTTPException(status_code=422, detail="Unknown or missing machine ID")

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_PROXY_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Recipe file is too large")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length")

    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="Recipe file is empty")
    if len(data) > MAX_PROXY_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Recipe file is too large")

    ppid = _extract_ppid_from_pwb(data)
    if x_ppid and ppid.upper() != x_ppid.strip().upper():
        raise HTTPException(status_code=422, detail="Recipe Bot PPID does not match Program Name inside PWB")

    incoming_sha256 = hashlib.sha256(_decompressed_pwb(data)).hexdigest()
    if x_content_sha256 and not secrets.compare_digest(incoming_sha256, x_content_sha256.strip().lower()):
        raise HTTPException(status_code=422, detail="Recipe content hash mismatch")

    source_filename = Path(x_source_filename or "NPGM.PWB").name
    existing = _find_recipe_by_ppid(ppid)

    if existing is None:
        destination = RECIPE_DIR / f"{ppid}.PWB"
        _atomic_write(destination, data)
        add_event({
            "EN": f"New recipe '{ppid}' received from {x_machine_id} and saved to the host.",
            "TH": f"ได้รับสูตรใหม่ '{ppid}' จาก {x_machine_id} และบันทึกในโฮสต์แล้ว",
        }, "SUCCESS")
        await broadcast_state()
        return JSONResponse({
            "status": "saved_new",
            "ppid": ppid,
            "filename": destination.name,
            "sha256": incoming_sha256,
        }, status_code=201)

    existing_sha256 = _recipe_sha256(existing)
    if secrets.compare_digest(existing_sha256, incoming_sha256):
        add_event({
            "EN": f"Recipe '{ppid}' from {x_machine_id} is already synchronized; no host file changed.",
            "TH": f"สูตร '{ppid}' จาก {x_machine_id} ตรงกับข้อมูลในโฮสต์แล้ว ไม่มีการเปลี่ยนไฟล์",
        }, "INFO")
        await broadcast_state()
        return JSONResponse({
            "status": "identical",
            "ppid": ppid,
            "filename": existing.name,
            "sha256": incoming_sha256,
        })

    # Changed content for the same PPID replaces the host copy immediately.
    # Keep the previous host file in the archive for recovery.
    RECIPE_ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    archive_name = f"{ppid}.{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.PWB"
    archive_path = RECIPE_ARCHIVE_DIR / archive_name
    shutil.copy2(existing, archive_path)
    _atomic_write(existing, data)

    # Remove obsolete approval requests for this PPID from older server builds;
    # otherwise an old dashboard approval could overwrite the new host copy.
    for request_id, item in list(pending_recipe_updates.items()):
        if item["ppid"].upper() != ppid.upper():
            continue
        stale = _remove_pending_request(request_id)
        Path(stale["pending_path"]).unlink(missing_ok=True)
        Path(stale["metadata_path"]).unlink(missing_ok=True)

    add_event({
        "EN": f"Recipe '{ppid}' from {x_machine_id} changed and automatically replaced the host copy; previous version archived.",
        "TH": f"สูตร '{ppid}' จาก {x_machine_id} มีการเปลี่ยนแปลง ระบบแทนที่ไฟล์ในโฮสต์อัตโนมัติและเก็บเวอร์ชันเดิมไว้ในคลังแล้ว",
    }, "SUCCESS")
    await broadcast_state()
    return JSONResponse({
        "status": "updated_existing",
        "ppid": ppid,
        "filename": existing.name,
        "sha256": incoming_sha256,
        "archive": archive_path.name,
    })


@app.post("/api/recipes/pending/{request_id}/approve")
async def approve_pending_recipe(
    request_id: str,
    x_session_token: str | None = Header(default=None),
) -> JSONResponse:
    session = require_role(x_session_token, "Technician")
    item = _remove_pending_request(request_id)
    pending_path = Path(item["pending_path"])
    metadata_path = Path(item["metadata_path"])
    existing_path = Path(item["existing_path"])
    if not pending_path.is_file():
        raise HTTPException(status_code=410, detail="Pending recipe file is no longer available")

    RECIPE_ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    archive_name = f"{item['ppid']}.{datetime.now().strftime('%Y%m%d-%H%M%S')}.PWB"
    archive_path = RECIPE_ARCHIVE_DIR / archive_name
    if existing_path.is_file():
        shutil.copy2(existing_path, archive_path)
    os.replace(pending_path, existing_path)
    metadata_path.unlink(missing_ok=True)

    add_event({
        "EN": f"{session['username']} accepted recipe update '{item['ppid']}' from {item['machine_id']}; previous host copy archived.",
        "TH": f"{session['username']} อนุมัติการอัปเดตสูตร '{item['ppid']}' จาก {item['machine_id']} และเก็บไฟล์เดิมไว้ในคลัง",
    }, "SUCCESS")
    _audit_action(session, "APPROVE_RECIPE_UPDATE", machine_id=item["machine_id"], recipe=item["ppid"], result="approved")
    await broadcast_state()
    return JSONResponse({"status": "approved", "ppid": item["ppid"], "archive": archive_path.name})


@app.post("/api/recipes/pending/{request_id}/reject")
async def reject_pending_recipe(
    request_id: str,
    x_session_token: str | None = Header(default=None),
) -> JSONResponse:
    session = require_role(x_session_token, "Technician")
    item = _remove_pending_request(request_id)
    Path(item["pending_path"]).unlink(missing_ok=True)
    Path(item["metadata_path"]).unlink(missing_ok=True)
    add_event({
        "EN": f"{session['username']} rejected recipe update '{item['ppid']}' from {item['machine_id']}; host copy was preserved.",
        "TH": f"{session['username']} ปฏิเสธการอัปเดตสูตร '{item['ppid']}' จาก {item['machine_id']} และคงไฟล์ในโฮสต์ไว้",
    }, "ALERT")
    _audit_action(session, "REJECT_RECIPE_UPDATE", machine_id=item["machine_id"], recipe=item["ppid"], result="rejected")
    await broadcast_state()
    return JSONResponse({"status": "rejected", "ppid": item["ppid"]})


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
            # Block on client/network activity. Dashboard changes are pushed by
            # broadcast_state(); there is no periodic snapshot polling loop.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        connections.discard(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("RATS_HOST", "127.0.0.1"),
        port=int(os.getenv("RATS_PORT", "8080")),
        reload=_env_bool("RATS_RELOAD", False),
    )
