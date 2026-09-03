#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# build_xp.sh — Build secs_proxy_bot.exe for Windows XP x86 (32-bit, static)
# Run from MSYS2 bash:  bash build_xp.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"
CXX="/mingw32/bin/g++"
STRIP="/mingw32/bin/strip"
OUT="$PROJ_DIR/secs_proxy_bot.exe"

SRCS=(
  "$PROJ_DIR/src/main.cpp"
  "$PROJ_DIR/src/util/Config.cpp"
  "$PROJ_DIR/src/util/Logger.cpp"
  "$PROJ_DIR/src/net/FileChannel.cpp"
  "$PROJ_DIR/src/watcher/FileWatcher.cpp"
  "$PROJ_DIR/src/ui/TrayApp.cpp"
)

CXXFLAGS=(
  -m32 -std=c++17 -O2
  -DWINVER=0x0501 -D_WIN32_WINNT=0x0501
  -DUNICODE -D_UNICODE
  -I"$PROJ_DIR/src"
  -Wall -Wno-unused-parameter
)

LDFLAGS=(
  -m32 -static -mwindows
  -lws2_32 -lshell32 -luser32 -ladvapi32 -lcomctl32
  -lkernel32 -lgdi32 -lole32 -lz
)

echo "============================================================"
echo "  ARC Recipe Transfer Bot — XP x86 static build"
echo "  Compiler: $($CXX --version | head -1)"
echo "  Output:   $OUT"
echo "============================================================"
echo

echo "[1/2] Compiling..."
"$CXX" "${CXXFLAGS[@]}" "${SRCS[@]}" "${LDFLAGS[@]}" -o "$OUT"

echo "[2/2] Stripping debug symbols..."
"$STRIP" "$OUT"

SIZE=$(du -k "$OUT" | cut -f1)
echo
echo "============================================================"
echo "  BUILD SUCCESSFUL!"
echo "  File: $OUT"
echo "  Size: ${SIZE} KB (fully static, no DLLs needed)"
echo
echo "  Deploy to Equipment PC:"
echo "    1. Copy secs_proxy_bot.exe + config.ini via USB"
echo "    2. Edit config.ini: set machine_id and watch_dir"
echo "    3. Run secs_proxy_bot.exe (tray icon appears)"
echo "============================================================"
