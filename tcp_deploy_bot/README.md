# ARC Deployment Receiver

This is a small Windows XP-compatible TCP receiver used to deliver the Recipe
Bot executable and its `config.ini` to an equipment PC without equipment-to-host
HTTP traffic.

## Network flow

```text
Dashboard browser -> RATS backend :8080
RATS backend       -> Deployment Receiver :5004
RATS backend       -> Machine SECS/GEM :5001
RATS backend       -> Recipe Bot :5003
```

The receiver accepts only an authenticated host connection, verifies the target
machine ID, accepts only filenames listed in `allowed_files`, rejects paths and
path traversal, enforces a size limit, validates CRC32, and writes atomically
inside `deploy_dir`. It never executes an uploaded file.

With `machine_id = AUTO`, one identical receiver package works across the fleet.
The receiver compares `WB#nn` sent by the host with the last octet of the local
adapter receiving the connection. A connection to `169.254.13.82`, for example,
accepts `WB#82` and rejects a different machine ID.

If an existing `secs_proxy_bot.exe` is running and Windows prevents replacement,
the new file is retained as `secs_proxy_bot.exe.pending`. Exit Recipe Bot and
replace the old EXE with that pending file.

## First installation

SECS/GEM recipe transfer cannot install or execute a Windows application. Copy
`arc_deployment_receiver.exe` and `config.ini` to the equipment PC once using
your validated bootstrap method, RDP, USB, an approved share, or an IT deployment
tool. Run the receiver once and allow inbound TCP 5004 from the RATS host. It
registers itself in the current user's Windows Startup entry.

After that first installation, use the deployment panel in the RATS dashboard
to send `secs_proxy_bot.exe` and `config.ini`.
