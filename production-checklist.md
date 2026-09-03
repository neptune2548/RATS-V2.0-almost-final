# Production Server Checklist

This project is safest to deploy first as an internal factory-floor server on the same trusted network as the wire bonders.

## 1. Install Runtime

- Install Python 3.11 or newer.
- Install Node.js 18 or newer.
- From the project root, run:

```bat
pip install -r requirement.txt
cd arc-system\client-shell
npm install
npm run build
```

## 2. Choose The Server IP

Use the IP address that operator PCs will open in the browser.

Example:

```bat
set SERVER_IP=192.168.1.50
```

## 3. Configure RATS Backend

For a server reachable from other PCs:

```bat
set RATS_HOST=0.0.0.0
set RATS_PORT=8080
set RATS_RELOAD=false
set RATS_CORS_ORIGINS=http://%SERVER_IP%:3000
set RATS_DEPLOY_PORT=5004
set RATS_PROXY_UPLOAD_TOKEN=change-this-recipe-bot-token
set RATS_DEPLOY_TOKEN=change-this-deployment-token
set RATS_OPERATOR_PASSWORD=change-this-operator-password
set RATS_TECHNICIAN_PASSWORD=change-this-technician-password
set RATS_ADMIN_PASSWORD=change-this-admin-password
set RATS_DEVELOPER_PASSWORD=change-this-developer-password
cd arc-system\client-rats
python main.py
```

## 4. Build The Frontend

The frontend automatically uses the hostname or IP address opened in the
operator's browser, with API/WebSocket port 8080. No hard-coded host IP is
required, so moving from a temporary address to `192.168.11.xx` does not
require a frontend source change. Build it with:

```bat
cd arc-system\client-shell
npm run build
```

## 5. Start Services

Start these services:

- `arc-system\client-rats\main.py` on port 8080.
- `arc-system\section-manager\manager.py`.
- The installed Vite preview server for `arc-system\client-shell\dist`:

```bat
cd arc-system\client-shell
npm run preview -- --host 0.0.0.0 --port 3000 --strictPort
```

For the first internal pilot, the existing `start_command_center.bat` can still be used on the server PC.

## 6. Firewall

Allow inbound TCP:

- 3000 if using the Vite dev server.
- 8080 for RATS API and WebSocket.

Allow the RATS server to initiate connections to each equipment PC:

- 5001 for native machine SECS/GEM.
- 5003 for Recipe Bot recipe uploads.
- 5004 for the TCP Deployment Receiver.

The Deployment Receiver `deploy_token` in `tcp_deploy_bot\config.ini` must
match `RATS_DEPLOY_TOKEN` on the server. Restrict equipment-PC inbound port
5004 to the RATS server IP where firewall policy supports source filtering.

## 7. Security Must-Fix Before Wider Use

Backend login and role checks are enabled for the dangerous POST actions. Before wider production use:

- Replace every default role password and TCP token; the System Status page must show `Credential Policy: READY`.
- Run the frontend with an approved production web service instead of a Vite development server.
- Configure Backend, Section Manager, and the web service for automatic startup and recovery after reboot or process failure.
- Back up `BondingProg`, `BondingProg/.archive`, `logs/employee_audit.json`, `database.py`, and approved bot/config release files.
- Perform and record a restore test; a backup that has never been restored is not accepted as production evidence.
- Define log rotation, archive retention, time synchronization, UPS behavior, and escalation ownership.

## 8. Production Readiness Check

Login as Administrator or Developer and open **System Status**. Press **REFRESH** after startup or restart.

- `Backend API` must be `ONLINE`.
- `Section Manager` must be `ONLINE` with a recent heartbeat.
- `Machine Workers` must show the expected alive count.
- `Recipe Storage`, `Audit Storage`, and `Disk Space` must be `READY`.
- `Credential Policy` must not show remaining defaults.
- Do not release while `OVERALL` is `NOT_READY`; investigate each red item first.

The health page loads on entry and on manual Refresh only. It does not add a continuous polling loop.
