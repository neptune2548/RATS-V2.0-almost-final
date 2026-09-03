#pragma once
#include <windows.h>
#include <string>
#include <functional>

#ifndef NIIF_INFO
#define NIIF_NONE    0x00000000
#define NIIF_INFO    0x00000001
#define NIIF_WARNING 0x00000002
#define NIIF_ERROR   0x00000003
#endif

class TrayApp {
public:
    enum class Confirm { Accept, Cancel };
    using AcceptCallback = std::function<void(const std::string& ppid, const std::string& file_path)>;

    TrayApp();
    ~TrayApp();

    void run();
    Confirm show_recipe_dialog(const std::string& ppid, const std::string& file_path);
    void show_transfer_complete_dialog(const std::string& ppid);
    void show_balloon(const std::string& title, const std::string& msg, DWORD flags = NIIF_INFO);
    static void register_startup(const std::string& app_name);

private:
    HWND              m_hwnd{nullptr};
    HINSTANCE         m_hinstance{nullptr};
    volatile LONG     m_running{0};

    static constexpr UINT WM_TRAYICON = WM_USER + 1;
    static constexpr UINT IDI_TRAY    = 1001;
    static constexpr UINT ID_QUIT     = 2001;

    static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp);

    void msg_pump();
    void add_tray_icon();
    void remove_tray_icon();
};
