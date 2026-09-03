#include "TrayApp.h"
#include "../util/Logger.h"
#include <shellapi.h>
#include <commctrl.h>
#include <sstream>

static std::wstring str_to_wstr(const std::string& s) {
    if (s.empty()) return {};
    int sz = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
    std::wstring result(sz - 1, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, result.data(), sz);
    return result;
}

LRESULT CALLBACK TrayApp::WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    TrayApp* app = reinterpret_cast<TrayApp*>(GetWindowLongPtr(hwnd, GWLP_USERDATA));
    if (msg == WM_TRAYICON) {
        if (lp == WM_RBUTTONUP) {
            POINT pt;
            GetCursorPos(&pt);
            HMENU menu = CreatePopupMenu();
            AppendMenu(menu, MF_STRING, TrayApp::ID_QUIT, L"Quit ARC Recipe Bot");
            SetForegroundWindow(hwnd);
            TrackPopupMenu(menu, TPM_BOTTOMALIGN | TPM_LEFTALIGN, pt.x, pt.y, 0, hwnd, nullptr);
            DestroyMenu(menu);
        }
        return 0;
    }
    if (msg == WM_COMMAND && LOWORD(wp) == TrayApp::ID_QUIT) {
        if (app) InterlockedExchange((volatile LONG*)&app->m_running, 0);
        PostQuitMessage(0);
        return 0;
    }
    if (msg == WM_DESTROY) {
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProc(hwnd, msg, wp, lp);
}

TrayApp::TrayApp() { m_hinstance = GetModuleHandle(nullptr); }
TrayApp::~TrayApp() {
    InterlockedExchange(&m_running, 0);
    if (m_hwnd) {
        remove_tray_icon();
        PostMessage(m_hwnd, WM_DESTROY, 0, 0);
    }
}

void TrayApp::run() {
    InterlockedExchange(&m_running, 1);
    msg_pump();
}

void TrayApp::msg_pump() {
    WNDCLASSEXW wc{};
    wc.cbSize        = sizeof(wc);
    wc.lpfnWndProc   = TrayApp::WndProc;
    wc.hInstance     = m_hinstance;
    wc.lpszClassName = L"ARCRecipeBotTray";
    RegisterClassExW(&wc);
    m_hwnd = CreateWindowExW(WS_EX_TOOLWINDOW, L"ARCRecipeBotTray", L"ARC Recipe Bot", WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, 1, 1, nullptr, nullptr, m_hinstance, nullptr);
    if (!m_hwnd) {
        LOG_ERROR("TrayApp: Failed to create message window.");
        return;
    }
    SetWindowLongPtr(m_hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(this));
    add_tray_icon();
    show_balloon("ARC Recipe Bot", "Recipe Bot is running. Waiting for the RATS host on port 5003...", NIIF_INFO);
    MSG msg;
    while (m_running && GetMessage(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    remove_tray_icon();
    LOG_INFO("TrayApp: Message pump exited.");
}

void TrayApp::add_tray_icon() {
    NOTIFYICONDATAW nid{};
    nid.cbSize = sizeof(nid);
    nid.hWnd = m_hwnd;
    nid.uID = IDI_TRAY;
    nid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    nid.uCallbackMessage = WM_TRAYICON;
    nid.hIcon = LoadIcon(nullptr, IDI_APPLICATION);
    wcsncpy(nid.szTip, L"ARC Recipe Bot", sizeof(nid.szTip)/sizeof(wchar_t) - 1);
    nid.szTip[sizeof(nid.szTip)/sizeof(wchar_t) - 1] = L'\0';
    Shell_NotifyIconW(NIM_ADD, &nid);
}

void TrayApp::remove_tray_icon() {
    NOTIFYICONDATAW nid{};
    nid.cbSize = sizeof(nid);
    nid.hWnd = m_hwnd;
    nid.uID = IDI_TRAY;
    Shell_NotifyIconW(NIM_DELETE, &nid);
}

TrayApp::Confirm TrayApp::show_recipe_dialog(const std::string& ppid, const std::string& file_path) {
    std::string body = "Recipe setup complete!\n\nPPID: " + ppid + "\nFile: " + file_path + "\n\nSend this recipe to the Factory Host?";
    std::wstring wbody = str_to_wstr(body);
    std::wstring wtitle = L"ARC Recipe Bot \u2014 Recipe Ready";
    int result = MessageBoxW(nullptr, wbody.c_str(), wtitle.c_str(), MB_YESNO | MB_ICONQUESTION | MB_TOPMOST | MB_SETFOREGROUND | MB_DEFAULT_DESKTOP_ONLY);
    if (result == IDYES) {
        LOG_INFO("TrayApp: User accepted upload for PPID='" + ppid + "'.");
        return Confirm::Accept;
    } else {
        LOG_INFO("TrayApp: User cancelled upload for PPID='" + ppid + "'.");
        return Confirm::Cancel;
    }
}

void TrayApp::show_transfer_complete_dialog(const std::string& ppid) {
    const std::string body = "Recipe transfer completed successfully.\n\nPPID: " + ppid +
        "\n\nThe recipe was saved on the host. Press OK to acknowledge.";
    const std::wstring wbody = str_to_wstr(body);
    const std::wstring wtitle = L"ARC Recipe Bot \u2014 Transfer Complete";
    MessageBoxW(nullptr, wbody.c_str(), wtitle.c_str(),
                MB_OK | MB_ICONINFORMATION | MB_TOPMOST | MB_SETFOREGROUND |
                MB_DEFAULT_DESKTOP_ONLY);
    LOG_INFO("TrayApp: Operator acknowledged completed transfer for PPID='" + ppid + "'.");
}

void TrayApp::show_balloon(const std::string& title, const std::string& msg, DWORD flags) {
    if (!m_hwnd) return;
    NOTIFYICONDATAW nid{};
    nid.cbSize = sizeof(nid);
    nid.hWnd = m_hwnd;
    nid.uID = IDI_TRAY;
    nid.uFlags = NIF_INFO;
    nid.dwInfoFlags = flags;
    nid.uTimeout = 5000;
    wcsncpy(nid.szInfoTitle, str_to_wstr(title).c_str(), sizeof(nid.szInfoTitle)/sizeof(wchar_t) - 1);
    nid.szInfoTitle[sizeof(nid.szInfoTitle)/sizeof(wchar_t) - 1] = L'\0';
    wcsncpy(nid.szInfo, str_to_wstr(msg).c_str(), sizeof(nid.szInfo)/sizeof(wchar_t) - 1);
    nid.szInfo[sizeof(nid.szInfo)/sizeof(wchar_t) - 1] = L'\0';
    Shell_NotifyIconW(NIM_MODIFY, &nid);
}

void TrayApp::register_startup(const std::string& app_name) {
    char exe_path[MAX_PATH]{};
    GetModuleFileNameA(nullptr, exe_path, MAX_PATH);
    HKEY key = nullptr;
    if (RegOpenKeyExA(HKEY_CURRENT_USER, "Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, KEY_SET_VALUE, &key) == ERROR_SUCCESS) {
        RegSetValueExA(key, app_name.c_str(), 0, REG_SZ, reinterpret_cast<const BYTE*>(exe_path), static_cast<DWORD>(strlen(exe_path) + 1));
        RegCloseKey(key);
        LOG_INFO("TrayApp: Registered startup entry '" + app_name + "' -> " + exe_path);
    } else {
        LOG_WARN("TrayApp: Failed to register startup entry.");
    }
}
