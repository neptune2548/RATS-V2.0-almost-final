MINGW32 = C:/msys64/mingw32/bin
CXX     = $(MINGW32)/g++.exe
STRIP   = $(MINGW32)/strip.exe

TARGET = arc_deployment_receiver.exe
SOURCE = src/main.cpp

CXXFLAGS = -m32 -std=c++17 -O2 -Wall \
           -DWINVER=0x0501 -D_WIN32_WINNT=0x0501 -D_WIN32_IE=0x0600 \
           -DUNICODE -D_UNICODE

LDFLAGS = -m32 -static -static-libgcc -static-libstdc++ -mwindows \
          -lws2_32 -lshell32 -luser32 -ladvapi32 -lkernel32 -lz

all: $(TARGET)

$(TARGET): $(SOURCE)
	$(CXX) $(CXXFLAGS) -o $@ $< $(LDFLAGS)
	$(STRIP) $@

clean:
	@if exist $(TARGET) del /q $(TARGET)

.PHONY: all clean
