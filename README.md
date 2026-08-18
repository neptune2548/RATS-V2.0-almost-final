# RATS — Recipe Automated Transfer System
### ARC Command Center V2.0 — Almost Final

A centralized control system for managing and transferring wire bonding recipes across 15 Wire Bonder machines (WB76–WB90) via the SECS/GEM protocol. Supports real-time status monitoring, Pull (retrieve), and Push (deploy) operations with a role-based authorization system.

---

## What is this project?

RATS connects to Wire Bonder machines on the factory floor over SECS/GEM and lets authorized users:
- **Check** the current recipe loaded on each machine (shown immediately on connect)
- **Pull** the active recipe from a machine back to the server
- **Push** a new recipe from the server to a machine
- **Monitor** connection status and equipment state of all 15 machines in real-time

The system runs as a full-stack app: Python FastAPI backend handles the SECS/GEM communication, React frontend provides the UI dashboard.

---

## What is New in V2.0 — Almost Final (2026-08-18)

### Changes from V0.1 → V2.0

| Feature | V0.1 | V2.0 |
|---|---|---|
| Frontend | Single HTML + Vanilla JS file | React + Vite SPA |
| Authentication | None | Role-based (Operator / Technician / Admin) |
| Dashboard | RATS only | RATS system with real-time machine state |
| Machine connections | Direct from main.py | Section Manager supervises all 15 machines |
| Dark Mode | No | Yes (toggle in navbar) |
| Language | Thai/English mixed | TH / EN toggle button |
| Font loading | Google Fonts CDN | Fully local — no internet dependency at runtime |
| Portable | No (hardcoded `C:\...` paths) | Yes — runs from any folder/drive on any PC |
| Machine count | 12 (WB76–WB87) | 15 (WB76–WB90) |
| Active recipe display | Manual pull only | Shows immediately on machine connect |

### V2.0 Highlights
- **Immediate recipe on connect** — worker polls ActiveRecipe the instant a machine comes online, no waiting
- **Fully portable** — no hardcoded paths anywhere; all directories resolved from `__file__`
- **Single `database.py`** — root-level only; deleted duplicate in `client-rats/`, no more sync issues
- **Security** — no credentials exposed in UI, launcher, or README
- **15 machines** — added WB88, WB89, WB90 to the registry
- **Offline fonts** — Inter, JetBrains Mono, Chakra Petch served from `public/fonts/`
- **Runtime state files excluded** — section-manager state and command JSONs are `.gitignore`d

---

## Project Structure

```
RATS-V2.0-almost-final/
├── arc-system/
│   ├── client-rats/         RATS Backend — Python FastAPI (Port 8080)
│   │   ├── main.py          API server + SECS/GEM orchestration
│   │   ├── testpull.py      Pull recipe from machine
│   │   ├── testpush.py      Push recipe to machine
│   │   └── requirement.txt  Python dependencies (this service)
│   │
│   ├── client-shell/        React UI (Port 3000)
│   │   └── src/
│   │       ├── views/       RatsView
│   │       ├── context/     AuthContext, ThemeContext, LanguageContext
│   │       └── components/  Navbar, AuthModal
│   │
│   ├── section-manager/     SECS/GEM connection supervisor (15 machines)
│   │   ├── manager.py       Supervisor — spawns and restarts workers
│   │   └── worker.py        1 process per machine — polls SVIDs and handles commands
│   │
│   └── client-mems/         MEMS Backend (Port 8000) — kept, hidden in UI
│
├── database.py              ← Single source of truth for all machine IPs/ports
├── requirement.txt          Root Python dependencies
├── start_command_center.bat One-click launcher — starts all services
├── stop_command_center.bat  Graceful shutdown for all services
└── watch_log.bat            Tail a machine worker log in real-time
```

---

## How to Use

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+

### Install Dependencies

```bash
# Python (from project root)
pip install -r requirement.txt

# Node (first time only)
cd arc-system/client-shell
npm install
```

### Starting the System

**Option 1 — One-click (recommended):**
```
Double-click: start_command_center.bat
```

Starts all services in order:
1. RATS SECS/GEM Engine — Port 8080
2. MEMS Telemetry Engine — Port 8000
3. Section Manager — manages all 15 machine SECS/GEM connections
4. React UI dev server — Port 3000 (browser opens automatically)

**Option 2 — Manual:**
```bash
# Terminal 1
cd arc-system/client-rats
python main.py

# Terminal 2
cd arc-system/section-manager
python manager.py

# Terminal 3
cd arc-system/client-shell
npm run dev
```

### Login / Authorization

Open http://localhost:3000 — you will see the "Authorization Required" screen.

| Role | Description / Access |
|---|---|
| Guest | Auth prompt only |
| Operator | View machine status and active recipes |
| Technician | View + Pull / Push recipes |
| Administrator | Full control including system configurations |

Sessions auto-expire after 5 minutes of inactivity and persist across page refreshes.

### Stopping the System

```
Double-click: stop_command_center.bat
```
Or press Ctrl+C in the React dev server window.

### Watch Machine Logs (live)

```bash
watch_log.bat WB83
```

---

## Machine Registry

| Machine ID | Name | IP | Port |
|---|---|---|---|
| WB#76 | Wire Bonder #76 | 169.254.13.76 | 5001 |
| WB#77 | Wire Bonder #77 | 169.254.13.77 | 5001 |
| WB#78 | Wire Bonder #78 | 169.254.13.78 | 5001 |
| WB#79 | Wire Bonder #79 | 169.254.13.79 | 5001 |
| WB#80 | Wire Bonder #80 | 169.254.13.80 | 5001 |
| WB#81 | Wire Bonder #81 | 169.254.13.81 | 5001 |
| WB#82 | Wire Bonder #82 | 169.254.13.82 | 5001 |
| WB#83 | Wire Bonder #83 | 169.254.13.83 | 5001 |
| WB#84 | Wire Bonder #84 | 169.254.13.84 | 5001 |
| WB#85 | Wire Bonder #85 | 169.254.13.85 | 5001 |
| WB#86 | Wire Bonder #86 | 169.254.13.86 | 5001 |
| WB#87 | Wire Bonder #87 | 169.254.13.87 | 5001 |
| WB#88 | Wire Bonder #88 | 169.254.13.88 | 5001 |
| WB#89 | Wire Bonder #89 | 169.254.13.89 | 5001 |
| WB#90 | Wire Bonder #90 | 169.254.13.90 | 5001 |

> Edit `database.py` (root) to change IPs or add machines. This is the single source of truth read by all services.

---

Stars Microelectronics (Thailand) PCL — ARC Engineering Team
