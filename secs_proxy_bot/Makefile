MINGW32 = C:/msys64/mingw32/bin
CXX     = $(MINGW32)/g++.exe
WINDRES = $(MINGW32)/windres.exe
STRIP   = $(MINGW32)/strip.exe

# ── Target ───────────────────────────────────────────────────────────────────
TARGET  = secs_proxy_bot.exe

# ── Source files ─────────────────────────────────────────────────────────────
SRCS =  src/main.cpp \
        src/util/Config.cpp \
        src/util/Logger.cpp \
        src/net/FileChannel.cpp \
        src/watcher/FileWatcher.cpp \
        src/ui/TrayApp.cpp

OBJS = $(SRCS:.cpp=.o)

# ── Flags ────────────────────────────────────────────────────────────────────
# -m32              : 32-bit x86 output (runs on XP)
# -std=c++17        : C++17 standard
# -static           : link all libs statically (no DLL dependencies)
# -mwindows         : Windows subsystem (no console window)
# -DWINVER=0x0501   : Target Windows XP SP2 (0x0501)
# -D_WIN32_WINNT=0x0501
# -O2               : optimize
CXXFLAGS = -m32 -std=c++17 -O2 -Wall \
           -DWINVER=0x0501 -D_WIN32_WINNT=0x0501 -D_WIN32_IE=0x0600 \
           -DUNICODE -D_UNICODE \
            \
           -Isrc

LDFLAGS  = -m32 -static -static-libgcc -static-libstdc++ -mwindows \
           -lws2_32 -lshell32 -luser32 -ladvapi32 -lcomctl32 \
           -lkernel32 -lgdi32 -lz -Wl,-Map=output.map

# ── Build rules ───────────────────────────────────────────────────────────────
all: $(TARGET)
	@echo ""
	@echo Build complete: $(TARGET)
	@echo Ready to copy to Equipment PC.

$(TARGET): $(OBJS)
	$(CXX) -o $@ $^ $(LDFLAGS)
	$(STRIP) $@

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

# ── Clean ─────────────────────────────────────────────────────────────────────
clean:
	rm -f $(OBJS) $(TARGET)

.PHONY: all clean
