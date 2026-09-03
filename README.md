# RATS — Recipe Automated Transfer System

## ARC Command Center V2.0 — Almost Final

RATS is an internal factory-floor command center for monitoring Wire Bonder connectivity and transferring `.PWB` recipe files. The current release is RATS-only and covers 17 machines across two production sections.

> Intended network: isolated Equipment LAN. Internet access is not required.

## Current capabilities

- Live SECS/GEM connection and active-recipe status for every registered machine.
- Production Section tabs for **WB Advanced** and **IC Wire Bond**.
- Floor-map overview with green Online and red Offline machine frames.
- Expandable machine details by selecting a machine or scanning its QR/barcode.
- Background reconnect without repeating retry messages in the operator event log.
- Pull, Push, Delete, Recipe Bot deployment, and recipe-update approval workflows.
- Thai/English UI, dark mode, employee audit, session timeout, and role-based access.
- Guest users can see the machine map and status but cannot run commands.
- Recipe Bot file channel and authenticated TCP deployment receiver for equipment-side PCs.
- Production-readiness health checks for the backend, manager, workers, storage, disk, and credential policy.

## Architecture

```text
Operator browser :3000
        |
        v
React/Vite UI <---- HTTP + WebSocket ----> FastAPI RATS backend :8080
                                              |
                                              v
                                  Section Manager + workers
                                      |       |       |
                                   SECS/GEM  Recipe   Deploy
                                     :5001   :5003    :5004
                                      |       |       |
                                      +--- Equipment PCs ---+
```

The UI and backend run on the internal RATS host. The Section Manager supervises one worker per machine. Machine configuration is split by production section and aggregated through `database.py`.

## Project structure

```text
RATS-V2.0-almost-final/
├── Advanced_Wirebond.py          WB Advanced machine data and map positions
├── IC_WireBond.py                IC Wire Bond machine data and map positions
├── database.py                   Combined machine registry used by all services
├── arc-system/
│   ├── client-rats/
│   │   ├── main.py               FastAPI backend, auth, recipes, audit, health
│   │   └── test_*.py             Backend integration/regression tests
│   ├── client-shell/             React/Vite operator UI
│   └── section-manager/
│       ├── manager.py            Worker supervisor and restart policy
│       └── worker.py             SECS/GEM and Recipe Bot machine worker
├── secs_proxy_bot/               Equipment-side recipe-transfer bot
├── tcp_deploy_bot/               Equipment-side deployment receiver
├── docs/manuals/                 Thai user/developer manuals and screenshots
├── production-checklist.md       Production deployment checklist
├── start_command_center.bat      Local/development launcher
├── start_production.bat          Production build and launcher
└── stop_command_center.bat       Graceful shutdown
```

## Machine registry

### WB Advanced

| Machine | Host IP | SECS/GEM | Recipe Bot | Deploy |
|---|---:|---:|---:|---:|
| WB#76 | 192.168.10.76 | 5001 | 5003 | 5004 |
| WB#77 | 192.168.10.77 | 5001 | 5003 | 5004 |
| WB#78 | 192.168.10.78 | 5001 | 5003 | 5004 |
| WB#79 | 192.168.10.79 | 5001 | 5003 | 5004 |
| WB#80 | 192.168.10.80 | 5001 | 5003 | 5004 |
| WB#81 | 192.168.10.81 | 5001 | 5003 | 5004 |
| WB#82 | 192.168.11.82 | 5001 | 5003 | 5004 |
| WB#83 | 192.168.11.83 | 5001 | 5003 | 5004 |
| WB#84 | 192.168.10.84 | 5001 | 5003 | 5004 |
| WB#85 | 192.168.10.85 | 5001 | 5003 | 5004 |
| WB#86 | 192.168.10.86 | 5001 | 5003 | 5004 |
| WB#87 | 192.168.10.87 | 5001 | 5003 | 5004 |
| WB#88 | 192.168.10.88 | 5001 | 5003 | 5004 |
| WB#89 | 192.168.10.89 | 5001 | 5003 | 5004 |
| WB#90 | 192.168.10.90 | 5001 | 5003 | 5004 |

### IC Wire Bond

| Machine | Host IP | SECS/GEM | Recipe Bot | Deploy |
|---|---:|---:|---:|---:|
| WB#70 | 192.168.11.70 | 5001 | 5003 | 5004 |
| WB#109 | 192.168.10.25 | 5001 | 5003 | 5004 |

Edit the appropriate section file rather than editing the combined registry:

- `Advanced_Wirebond.py` for WB#76–WB#90.
- `IC_WireBond.py` for WB#70 and WB#109.

## Roles

| Role | Access |
|---|---|
| Guest | View production tabs, map, and live machine status only |
| Operator | Guest access plus recipe Pull and Push |
| Technician | Operator access plus recipe Delete and update decisions |
| Administrator | Administrative access and production-readiness status |
| Developer | Full access including Recipe Bot file deployment |

Guest commands and scans are blocked in the UI and return an insufficient-access notification. Dangerous backend operations also require authenticated role checks.

## Requirements

- Windows host PC
- Python 3.11 or newer
- Node.js 18 or newer
- npm 9 or newer
- Network routes from the RATS host to the registered equipment IPs

Install dependencies from the repository root:

```bat
pip install -r requirement.txt
cd arc-system\client-shell
npm install
```

## Start the system

### New RATS server PC

On a new Windows server, open the repository and run:

```text
setup_new_rats_server.bat
```

Run it with a network connection the first time. The installer requests Administrator permission, installs missing Python 3.11, Node.js LTS, and Git through Winget, installs project dependencies, builds the UI, generates server-only secrets, and creates restricted inbound Firewall rules for ports 3000 and 8080. When prompted for the allowed source, enter the approved Equipment LAN subnet or IP range instead of using a broad Internet-facing rule.

Generated credentials are stored in `rats_secrets.local.bat`, which is excluded from Git. Back it up in the approved password store. Copy the matching Recipe Bot and deployment tokens into the relevant equipment-side configuration during deployment.

If the server was copied manually instead of installed with the setup script, `start_command_center.bat` automatically runs `configure_rats_secrets.bat` once and shows the generated Operator password in that launcher window.

When replacing or adding a RATS server for an existing equipment fleet, securely copy `rats_secrets.local.bat` from the established RATS server to the same repository folder on the replacement server before startup. This preserves the Operator, Technician, Administrator, and Developer passwords and keeps the Recipe Bot and deployment tokens aligned with the equipment PCs. Do not place this file in Git.

### Existing/development server

For local/development operation:

```text
Double-click start_command_center.bat
```

For an internal production-style run:

```text
Double-click start_production.bat
```

The launchers start:

1. FastAPI backend on TCP 8080.
2. Section Manager and machine workers.
3. React UI on TCP 3000.

Open `http://localhost:3000` locally, or `http://<RATS-host-IP>:3000` from an authorized workstation on the Equipment LAN.

Stop all components with `stop_command_center.bat`.

## Production configuration

Set unique production credentials and tokens before release. Do not keep the example/default values from development packages.

```bat
set RATS_HOST=0.0.0.0
set RATS_PORT=8080
set RATS_CORS_ORIGINS=http://<RATS-host-IP>:3000
set RATS_RELOAD=false
set RATS_OPERATOR_PASSWORD=<unique-password>
set RATS_TECHNICIAN_PASSWORD=<unique-password>
set RATS_ADMIN_PASSWORD=<unique-password>
set RATS_DEVELOPER_PASSWORD=<unique-password>
set RATS_PROXY_UPLOAD_TOKEN=<unique-recipe-bot-token>
set RATS_DEPLOY_TOKEN=<unique-deployment-token>
```

The frontend normally derives backend host information from the browser URL. See `arc-system/client-shell/.env.example` only when an explicit API/WebSocket address is required.

## Network and firewall

Required internal paths:

| Source | Destination | TCP port | Purpose |
|---|---|---:|---|
| Operator PCs | RATS host | 3000 | Web UI |
| Operator/equipment network | RATS host | 8080 | API, WebSocket, and internal recipe upload endpoint |
| RATS host | Equipment PCs | 5001 | SECS/GEM |
| RATS host | Equipment PCs | 5003 | Recipe Bot file channel |
| RATS host | Equipment PCs | 5004 | Deployment Receiver |

Keep every firewall rule restricted to the Equipment LAN and approved source IP ranges. The current internal HTTP service is plain HTTP because it is designed for the isolated equipment network; deploy HTTPS if company policy requires it.

## Verification

Frontend production build:

```bat
cd arc-system\client-shell
npm run build
```

Backend regression tests:

```bat
python -m unittest discover -s arc-system\client-rats -p "test_*.py"
```

Python syntax check for the core services:

```bat
python -m py_compile Advanced_Wirebond.py IC_WireBond.py database.py arc-system\client-rats\main.py arc-system\section-manager\manager.py arc-system\section-manager\worker.py
```

Before production release, follow `production-checklist.md`, replace all default credentials/tokens, verify backup/restore, and confirm the System Status page reports the required services as ready.

## Notes

- Reconnect attempts continue in the background without flooding the operator log.
- A successful ping does not prove SECS/GEM is connected; machine Host Communication must also be enabled.
- Recipe files (`*.PWB`) and runtime state/log files are intentionally excluded from Git.
- The floor map currently uses schematic positions stored in each production-section data file and can be adjusted to match the physical layout.

---

Stars Microelectronics (Thailand) PCL — ARC Engineering Team
