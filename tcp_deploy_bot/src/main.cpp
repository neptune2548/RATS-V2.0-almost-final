#include <winsock2.h>
#include <windows.h>
#include <shellapi.h>
#include <process.h>
#include <zlib.h>

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <fstream>
#include <map>
#include <set>
#include <sstream>
#include <string>
#include <vector>

namespace {

const char kMagic[] = "ARCDEP01";
const UINT kTrayMessage = WM_USER + 41;
const UINT kQuitCommand = 4101;

volatile LONG g_running = 1;
SOCKET g_listener = INVALID_SOCKET;
SOCKET g_client = INVALID_SOCKET;
HANDLE g_server_thread = nullptr;
HANDLE g_single_instance = nullptr;
HWND g_window = nullptr;
std::string g_base_dir;
std::string g_log_path;

struct Settings {
    std::string listen_ip{"0.0.0.0"};
    unsigned short listen_port{5004};
    std::string token{};
    std::string machine_id{"AUTO"};
    std::string deploy_dir{"C:\\ARCRecipeBot"};
    std::set<std::string> allowed_files{"secs_proxy_bot.exe", "config.ini"};
    unsigned long max_file_bytes{25UL * 1024UL * 1024UL};
    bool register_startup{true};
};

Settings g_settings;
CRITICAL_SECTION g_log_lock;

std::string trim(const std::string& value) {
    const std::string whitespace = " \t\r\n";
    const std::string::size_type first = value.find_first_not_of(whitespace);
    if (first == std::string::npos) return "";
    return value.substr(first, value.find_last_not_of(whitespace) - first + 1);
}

std::string lower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return value;
}

void log_line(const std::string& level, const std::string& message) {
    SYSTEMTIME now{};
    GetLocalTime(&now);
    char stamp[32]{};
    std::sprintf(stamp, "%04u-%02u-%02u %02u:%02u:%02u",
                 now.wYear, now.wMonth, now.wDay, now.wHour, now.wMinute, now.wSecond);
    EnterCriticalSection(&g_log_lock);
    std::ofstream output(g_log_path.c_str(), std::ios::app);
    if (output) output << "[" << stamp << "] [" << level << "] " << message << "\n";
    LeaveCriticalSection(&g_log_lock);
}

std::map<std::string, std::string> read_ini(const std::string& path) {
    std::map<std::string, std::string> result;
    std::ifstream input(path.c_str());
    std::string line;
    while (std::getline(input, line)) {
        line = trim(line);
        if (line.empty() || line[0] == ';' || line[0] == '#' || line[0] == '[') continue;
        const std::string::size_type equals = line.find('=');
        if (equals == std::string::npos) continue;
        std::string value = trim(line.substr(equals + 1));
        const std::string::size_type comment = value.find(';');
        if (comment != std::string::npos) value = trim(value.substr(0, comment));
        result[lower(trim(line.substr(0, equals)))] = value;
    }
    return result;
}

unsigned long parse_ulong(const std::string& value, unsigned long fallback) {
    if (value.empty()) return fallback;
    char* end = nullptr;
    const unsigned long parsed = std::strtoul(value.c_str(), &end, 10);
    return (end != value.c_str() && *end == '\0') ? parsed : fallback;
}

bool parse_bool(const std::string& value, bool fallback) {
    if (value.empty()) return fallback;
    const std::string normalized = lower(trim(value));
    if (normalized == "1" || normalized == "true" || normalized == "yes" || normalized == "on") return true;
    if (normalized == "0" || normalized == "false" || normalized == "no" || normalized == "off") return false;
    return fallback;
}

void load_settings() {
    const std::map<std::string, std::string> ini = read_ini(g_base_dir + "\\config.ini");
    auto get = [&ini](const std::string& key, const std::string& fallback) {
        const auto found = ini.find(key);
        return found == ini.end() ? fallback : found->second;
    };
    g_settings.listen_ip = get("listen_ip", g_settings.listen_ip);
    g_settings.listen_port = static_cast<unsigned short>(parse_ulong(get("listen_port", "5004"), 5004));
    g_settings.token = get("deploy_token", g_settings.token);
    g_settings.machine_id = get("machine_id", g_settings.machine_id);
    g_settings.deploy_dir = get("deploy_dir", g_settings.deploy_dir);
    g_settings.max_file_bytes = parse_ulong(get("max_file_bytes", "26214400"), 25UL * 1024UL * 1024UL);
    g_settings.register_startup = parse_bool(get("register_startup", "true"), true);

    const std::string allowed = get("allowed_files", "secs_proxy_bot.exe,config.ini");
    g_settings.allowed_files.clear();
    std::stringstream items(allowed);
    std::string item;
    while (std::getline(items, item, ',')) {
        item = lower(trim(item));
        if (!item.empty()) g_settings.allowed_files.insert(item);
    }
}

bool ensure_directory(const std::string& path) {
    if (path.empty()) return false;
    const DWORD attributes = GetFileAttributesA(path.c_str());
    if (attributes != INVALID_FILE_ATTRIBUTES && (attributes & FILE_ATTRIBUTE_DIRECTORY)) return true;
    const std::string::size_type slash = path.find_last_of("\\/");
    if (slash != std::string::npos && slash > 2 && !ensure_directory(path.substr(0, slash))) return false;
    return CreateDirectoryA(path.c_str(), nullptr) != FALSE || GetLastError() == ERROR_ALREADY_EXISTS;
}

bool recv_all(SOCKET socket_handle, void* destination, int length) {
    char* cursor = static_cast<char*>(destination);
    while (length > 0 && InterlockedCompareExchange(&g_running, 1, 1)) {
        const int received = recv(socket_handle, cursor, length, 0);
        if (received <= 0) return false;
        cursor += received;
        length -= received;
    }
    return length == 0;
}

bool send_all(SOCKET socket_handle, const void* source, int length) {
    const char* cursor = static_cast<const char*>(source);
    while (length > 0) {
        const int sent = send(socket_handle, cursor, length, 0);
        if (sent <= 0) return false;
        cursor += sent;
        length -= sent;
    }
    return true;
}

bool recv_u16(SOCKET socket_handle, unsigned short& value) {
    unsigned short network_value = 0;
    if (!recv_all(socket_handle, &network_value, sizeof(network_value))) return false;
    value = ntohs(network_value);
    return true;
}

bool recv_u32(SOCKET socket_handle, unsigned long& value) {
    u_long network_value = 0;
    if (!recv_all(socket_handle, &network_value, sizeof(network_value))) return false;
    value = ntohl(network_value);
    return true;
}

bool send_result(SOCKET socket_handle, unsigned char status, const std::string& message) {
    const unsigned short message_length = static_cast<unsigned short>(std::min<size_t>(message.size(), 65535));
    const unsigned short network_length = htons(message_length);
    return send_all(socket_handle, &status, 1) &&
           send_all(socket_handle, &network_length, sizeof(network_length)) &&
           send_all(socket_handle, message.data(), message_length);
}

bool valid_filename(const std::string& filename) {
    if (filename.empty() || filename.size() > 128 || filename == "." || filename == "..") return false;
    if (filename.find("..") != std::string::npos) return false;
    if (filename.find_first_of("\\/:*?\"<>|") != std::string::npos) return false;
    return g_settings.allowed_files.find(lower(filename)) != g_settings.allowed_files.end();
}

void register_startup() {
    char executable[MAX_PATH]{};
    if (!GetModuleFileNameA(nullptr, executable, MAX_PATH)) return;
    HKEY key = nullptr;
    if (RegOpenKeyExA(HKEY_CURRENT_USER, "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                      0, KEY_SET_VALUE, &key) == ERROR_SUCCESS) {
        const std::string quoted_executable = "\"" + std::string(executable) + "\"";
        RegSetValueExA(key, "ARCDeploymentReceiver", 0, REG_SZ,
                       reinterpret_cast<const BYTE*>(quoted_executable.c_str()),
                       static_cast<DWORD>(quoted_executable.size() + 1));
        RegCloseKey(key);
    }
}

bool machine_id_matches(SOCKET client, const std::string& supplied_machine) {
    if (lower(g_settings.machine_id) != "auto") {
        return supplied_machine == g_settings.machine_id;
    }

    sockaddr_in local_address{};
    int local_length = sizeof(local_address);
    if (getsockname(client, reinterpret_cast<sockaddr*>(&local_address), &local_length) == SOCKET_ERROR) {
        return false;
    }
    const char* local_ip_text = inet_ntoa(local_address.sin_addr);
    if (!local_ip_text) return false;
    const std::string local_ip(local_ip_text);
    const std::string::size_type dot = local_ip.find_last_of('.');
    if (dot == std::string::npos) return false;
    const int last_octet = std::atoi(local_ip.substr(dot + 1).c_str());
    const std::string normalized_machine = lower(supplied_machine);
    if (normalized_machine.size() <= 3 || normalized_machine.substr(0, 3) != "wb#") return false;
    const std::string suffix = normalized_machine.substr(3);
    if (!std::all_of(suffix.begin(), suffix.end(), [](unsigned char c) { return std::isdigit(c) != 0; })) {
        return false;
    }
    return std::atoi(suffix.c_str()) == last_octet;
}

bool authenticate(SOCKET client) {
    char magic[sizeof(kMagic) - 1]{};
    unsigned short token_length = 0;
    unsigned short machine_length = 0;
    if (!recv_all(client, magic, sizeof(magic)) || std::memcmp(magic, kMagic, sizeof(magic)) != 0 ||
        !recv_u16(client, token_length) || token_length == 0 || token_length > 256) return false;
    std::vector<char> token(token_length);
    if (!recv_all(client, token.data(), token_length) || !recv_u16(client, machine_length) ||
        machine_length == 0 || machine_length > 64) return false;
    std::vector<char> machine(machine_length);
    if (!recv_all(client, machine.data(), machine_length)) return false;
    const std::string supplied_token(token.begin(), token.end());
    const std::string supplied_machine(machine.begin(), machine.end());
    return supplied_token == g_settings.token && machine_id_matches(client, supplied_machine);
}

void handle_client(SOCKET client) {
    int timeout_ms = 15000;
    setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout_ms), sizeof(timeout_ms));
    setsockopt(client, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout_ms), sizeof(timeout_ms));

    const bool authenticated = authenticate(client);
    const unsigned char auth_reply = authenticated ? 1 : 0;
    send_all(client, &auth_reply, 1);
    if (!authenticated) {
        log_line("WARN", "Rejected unauthenticated deployment connection.");
        return;
    }

    unsigned char opcode = 0;
    unsigned short filename_length = 0;
    unsigned long file_size = 0;
    unsigned long expected_crc = 0;
    if (!recv_all(client, &opcode, 1) || opcode != 'P' ||
        !recv_u16(client, filename_length) || filename_length == 0 || filename_length > 128 ||
        !recv_u32(client, file_size) || !recv_u32(client, expected_crc)) {
        send_result(client, 0, "Invalid deployment request header");
        return;
    }

    std::vector<char> filename_bytes(filename_length);
    if (!recv_all(client, filename_bytes.data(), filename_length)) return;
    const std::string filename(filename_bytes.begin(), filename_bytes.end());
    if (!valid_filename(filename)) {
        send_result(client, 0, "Filename is not allowed by config.ini");
        log_line("WARN", "Rejected filename: " + filename);
        return;
    }
    if (file_size == 0 || file_size > g_settings.max_file_bytes) {
        send_result(client, 0, "File is empty or exceeds max_file_bytes");
        return;
    }
    if (!ensure_directory(g_settings.deploy_dir)) {
        send_result(client, 0, "Cannot create deployment directory");
        return;
    }

    std::ostringstream suffix;
    suffix << ".upload." << GetCurrentProcessId() << "." << GetTickCount();
    const std::string target = g_settings.deploy_dir + "\\" + filename;
    const std::string temporary = target + suffix.str();
    HANDLE output = CreateFileA(temporary.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
                                FILE_ATTRIBUTE_NORMAL, nullptr);
    if (output == INVALID_HANDLE_VALUE) {
        send_result(client, 0, "Cannot open deployment destination");
        return;
    }

    unsigned long remaining = file_size;
    uLong calculated_crc = crc32(0L, Z_NULL, 0);
    std::vector<unsigned char> buffer(64 * 1024);
    bool write_ok = true;
    while (remaining > 0) {
        const int chunk = static_cast<int>(std::min<unsigned long>(remaining, static_cast<unsigned long>(buffer.size())));
        if (!recv_all(client, buffer.data(), chunk)) {
            write_ok = false;
            break;
        }
        DWORD written = 0;
        if (!WriteFile(output, buffer.data(), chunk, &written, nullptr) || written != static_cast<DWORD>(chunk)) {
            write_ok = false;
            break;
        }
        calculated_crc = crc32(calculated_crc, buffer.data(), static_cast<uInt>(chunk));
        remaining -= static_cast<unsigned long>(chunk);
    }
    FlushFileBuffers(output);
    CloseHandle(output);

    if (!write_ok || remaining != 0 || static_cast<unsigned long>(calculated_crc) != expected_crc) {
        DeleteFileA(temporary.c_str());
        send_result(client, 0, "Transfer incomplete or checksum mismatch");
        log_line("WARN", "Rejected incomplete upload for " + filename);
        return;
    }

    if (MoveFileExA(temporary.c_str(), target.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        send_result(client, 1, "Installed " + filename);
        log_line("INFO", "Installed " + filename + " (" + std::to_string(file_size) + " bytes).");
        return;
    }

    const std::string pending = target + ".pending";
    if (MoveFileExA(temporary.c_str(), pending.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        send_result(client, 2, "Target is in use; saved as " + filename + ".pending");
        log_line("WARN", "Target in use; staged " + filename + ".pending");
        return;
    }

    DeleteFileA(temporary.c_str());
    send_result(client, 0, "Cannot install or stage uploaded file");
}

unsigned __stdcall server_main(void*) {
    WSADATA winsock{};
    if (WSAStartup(MAKEWORD(2, 2), &winsock) != 0) {
        log_line("ERROR", "WSAStartup failed.");
        return 0;
    }

    g_listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (g_listener == INVALID_SOCKET) {
        log_line("ERROR", "Cannot create TCP listener.");
        WSACleanup();
        return 0;
    }
    BOOL reuse = TRUE;
    setsockopt(g_listener, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&reuse), sizeof(reuse));

    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(g_settings.listen_port);
    address.sin_addr.s_addr = g_settings.listen_ip == "0.0.0.0"
        ? htonl(INADDR_ANY)
        : inet_addr(g_settings.listen_ip.c_str());
    if (bind(g_listener, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR ||
        listen(g_listener, 4) == SOCKET_ERROR) {
        log_line("ERROR", "Cannot listen on TCP port " + std::to_string(g_settings.listen_port) + ".");
        closesocket(g_listener);
        g_listener = INVALID_SOCKET;
        WSACleanup();
        return 0;
    }

    log_line("INFO", "Deployment receiver listening on port " + std::to_string(g_settings.listen_port) +
             " for " + g_settings.machine_id + ".");
    while (InterlockedCompareExchange(&g_running, 1, 1)) {
        SOCKET client = accept(g_listener, nullptr, nullptr);
        if (client == INVALID_SOCKET) break;
        g_client = client;
        handle_client(client);
        if (g_client != INVALID_SOCKET) {
            shutdown(g_client, SD_BOTH);
            closesocket(g_client);
            g_client = INVALID_SOCKET;
        }
    }
    if (g_listener != INVALID_SOCKET) closesocket(g_listener);
    g_listener = INVALID_SOCKET;
    WSACleanup();
    return 0;
}

void add_tray_icon(HWND window) {
    NOTIFYICONDATAA icon{};
    icon.cbSize = sizeof(icon);
    icon.hWnd = window;
    icon.uID = 1;
    icon.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    icon.uCallbackMessage = kTrayMessage;
    icon.hIcon = LoadIcon(nullptr, IDI_APPLICATION);
    std::strncpy(icon.szTip, "ARC Deployment Receiver", sizeof(icon.szTip) - 1);
    Shell_NotifyIconA(NIM_ADD, &icon);
}

void remove_tray_icon(HWND window) {
    NOTIFYICONDATAA icon{};
    icon.cbSize = sizeof(icon);
    icon.hWnd = window;
    icon.uID = 1;
    Shell_NotifyIconA(NIM_DELETE, &icon);
}

LRESULT CALLBACK window_proc(HWND window, UINT message, WPARAM word, LPARAM detail) {
    if (message == kTrayMessage && detail == WM_RBUTTONUP) {
        POINT point{};
        GetCursorPos(&point);
        HMENU menu = CreatePopupMenu();
        AppendMenuA(menu, MF_STRING, kQuitCommand, "Quit ARC Deployment Receiver");
        SetForegroundWindow(window);
        TrackPopupMenu(menu, TPM_LEFTALIGN | TPM_BOTTOMALIGN, point.x, point.y, 0, window, nullptr);
        DestroyMenu(menu);
        return 0;
    }
    if (message == WM_COMMAND && LOWORD(word) == kQuitCommand) {
        DestroyWindow(window);
        return 0;
    }
    if (message == WM_DESTROY) {
        InterlockedExchange(&g_running, 0);
        if (g_listener != INVALID_SOCKET) {
            const SOCKET listener = g_listener;
            g_listener = INVALID_SOCKET;
            shutdown(listener, SD_BOTH);
            closesocket(listener);
        }
        if (g_client != INVALID_SOCKET) {
            const SOCKET client = g_client;
            g_client = INVALID_SOCKET;
            shutdown(client, SD_BOTH);
            closesocket(client);
        }
        remove_tray_icon(window);
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcA(window, message, word, detail);
}

}  // namespace

int WINAPI WinMain(HINSTANCE instance, HINSTANCE, LPSTR, int) {
    InitializeCriticalSection(&g_log_lock);
    g_single_instance = CreateMutexA(nullptr, FALSE, "Local\\ARCDeploymentReceiver");
    if (!g_single_instance || GetLastError() == ERROR_ALREADY_EXISTS) {
        if (g_single_instance) CloseHandle(g_single_instance);
        DeleteCriticalSection(&g_log_lock);
        return 0;
    }
    char executable[MAX_PATH]{};
    GetModuleFileNameA(nullptr, executable, MAX_PATH);
    g_base_dir = executable;
    const std::string::size_type slash = g_base_dir.find_last_of("\\/");
    if (slash != std::string::npos) g_base_dir.resize(slash);
    g_log_path = g_base_dir + "\\deployment_receiver.log";
    load_settings();
    if (g_settings.token.empty() || g_settings.token == "CHANGE_ME") {
        MessageBoxA(nullptr, "deploy_token is not configured in config.ini.",
                    "ARC Deployment Receiver", MB_OK | MB_ICONERROR);
        CloseHandle(g_single_instance);
        DeleteCriticalSection(&g_log_lock);
        return 1;
    }
    if (g_settings.register_startup) register_startup();

    WNDCLASSEXA window_class{};
    window_class.cbSize = sizeof(window_class);
    window_class.lpfnWndProc = window_proc;
    window_class.hInstance = instance;
    window_class.lpszClassName = "ARCDeploymentReceiverWindow";
    RegisterClassExA(&window_class);
    g_window = CreateWindowExA(WS_EX_TOOLWINDOW, window_class.lpszClassName,
                              "ARC Deployment Receiver", WS_OVERLAPPEDWINDOW,
                              CW_USEDEFAULT, CW_USEDEFAULT, 1, 1,
                              nullptr, nullptr, instance, nullptr);
    if (!g_window) {
        DeleteCriticalSection(&g_log_lock);
        return 1;
    }
    add_tray_icon(g_window);

    unsigned thread_id = 0;
    g_server_thread = reinterpret_cast<HANDLE>(_beginthreadex(nullptr, 0, server_main, nullptr, 0, &thread_id));
    if (!g_server_thread) {
        MessageBoxA(nullptr, "Cannot start the TCP deployment listener.", "ARC Deployment Receiver", MB_OK | MB_ICONERROR);
        DestroyWindow(g_window);
    }

    MSG message{};
    while (GetMessageA(&message, nullptr, 0, 0) > 0) {
        TranslateMessage(&message);
        DispatchMessageA(&message);
    }
    if (g_server_thread) {
        WaitForSingleObject(g_server_thread, INFINITE);
        CloseHandle(g_server_thread);
    }
    CloseHandle(g_single_instance);
    DeleteCriticalSection(&g_log_lock);
    return 0;
}
