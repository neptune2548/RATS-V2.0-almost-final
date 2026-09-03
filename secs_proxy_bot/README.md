# ARC Recipe Bot

Machine-side recipe file transfer for the RATS Command Center.

This executable is intentionally **not** an HSMS proxy. The RATS Python
Section Manager connects straight to each machine's native SECS/GEM listener
on port `5001`. The bot only watches machine-created PWB files and exposes an
authenticated full-duplex TCP file channel on port `5003`.

## WB#82 network flow

```text
RATS host 169.254.13.32  --->  WB#82 native HSMS 169.254.13.82:5001
RATS host 169.254.13.32  --->  ARC Recipe Bot    169.254.13.82:5003
ARC Recipe Bot           ===>  PWB bytes return over the same 5003 session
```

Port `5002` is not used. The bot does not make HTTP requests to host port
`8080`; this avoids the equipment-PC-to-host HTTP path that was blocked.

## Recipe flow

1. `ReadDirectoryChangesW` waits for added or changed `NPGM0.PWB` through
   `NPGMn.PWB` files in `C:\SYSTEM\BONDPROG`.
2. The bot waits for the file to become stable and extracts `Program Name`
   from the PWB as the real PPID.
3. It asks the host whether that PPID/content is already synchronized. An
   identical host-pushed file is silently ignored, preventing feedback popups.
4. For a new or changed local recipe, the equipment operator sees a popup.
5. On acceptance, the original PWB bytes are sent through the authenticated
   port-5003 session.
6. A new PPID is saved immediately. Changed content for an existing PPID
   automatically archives the old host copy and replaces it without waiting
   for dashboard approval.
7. After the host confirms receipt, a completion popup remains visible until
   the operator presses OK. Pressing OK closes only the popup; Recipe Bot keeps
   running.

Detection snapshots the raw PWB before dispatching popup/network work off the
directory-watcher thread. Once accepted, the snapshot is atomically committed
to `recipe_outbox` beside the executable. Transport failures keep the job for
automatic FIFO retry after reconnect or reboot; it is deleted only after the
host confirms receipt. Deploy the bot in a directory writable by its normal
Windows user.

The directory watcher is event-driven. TCP keepalive detects connection loss;
the host reconnects silently while offline and broadcasts only real state
transitions.

## Deploy WB#82

Use [ARC_Recipe_Bot_WB82.zip](ARC_Recipe_Bot_WB82.zip), or copy these files to
the same directory on the equipment PC:

- `secs_proxy_bot.exe` (filename retained for a drop-in replacement)
- `config.ini`

Exit the retired proxy bot, copy the replacement files, then run
`secs_proxy_bot.exe`. Its startup registration overwrites the old
`SecsProxyBot` startup entry with the new executable path.

Expected configuration:

```ini
[file_channel]
file_listen_ip = 0.0.0.0
file_listen_port = 5003
file_channel_token = CHANGE_ME
machine_id = WB#82
max_file_bytes = 20971520

[watcher]
watch_dir = C:\SYSTEM\BONDPROG
file_ext = .PWB
```

## Build

The checked-in executable is a statically linked 32-bit Windows build suitable
for the equipment PC.

From PowerShell with MSYS2 MinGW32 installed:

```powershell
$savedCompilerPath = $env:Path
$env:Path = 'C:\msys64\mingw32\bin;' + $savedCompilerPath
& 'C:\msys64\mingw32\bin\mingw32-make.exe' -C secs_proxy_bot
$env:Path = $savedCompilerPath
```

Source code now contains only the file channel, PWB watcher, tray UI, and
support utilities. The retired TCP proxy, HSMS encoder, bridge, and HTTP
uploader are not part of this project.
