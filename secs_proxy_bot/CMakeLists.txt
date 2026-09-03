cmake_minimum_required(VERSION 3.18)
project(ARCRecipeBot VERSION 2.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── Sources ──────────────────────────────────────────────────────────────────
set(SOURCES
    src/main.cpp
    src/util/Config.cpp
    src/util/Logger.cpp
    src/net/FileChannel.cpp
    src/watcher/FileWatcher.cpp
    src/ui/TrayApp.cpp
)

# ── Executable ───────────────────────────────────────────────────────────────
add_executable(secs_proxy_bot WIN32 ${SOURCES})

# ── Include dirs ─────────────────────────────────────────────────────────────
target_include_directories(secs_proxy_bot PRIVATE src)

# ── Windows libraries ────────────────────────────────────────────────────────
target_link_libraries(secs_proxy_bot PRIVATE
    ws2_32      # Winsock2
    shell32     # Shell_NotifyIcon
    user32      # MessageBox, Win32 UI
    advapi32    # RegOpenKeyEx (startup registration)
    comctl32    # Common controls
    z           # gzip recipe fingerprints
)

# ── Compiler warnings ────────────────────────────────────────────────────────
if(MSVC)
    target_compile_options(secs_proxy_bot PRIVATE /W3 /WX-)
    # Enable Unicode
    target_compile_definitions(secs_proxy_bot PRIVATE UNICODE _UNICODE)
else()
    target_compile_options(secs_proxy_bot PRIVATE -Wall -Wextra -Wpedantic)
    target_compile_definitions(secs_proxy_bot PRIVATE UNICODE _UNICODE)
endif()

# ── Output ───────────────────────────────────────────────────────────────────
set_target_properties(secs_proxy_bot PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_SOURCE_DIR}"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_SOURCE_DIR}"
)

message(STATUS "")
message(STATUS "  ARC Recipe Bot build configured.")
message(STATUS "  Output: ${CMAKE_SOURCE_DIR}/secs_proxy_bot.exe")
message(STATUS "")
