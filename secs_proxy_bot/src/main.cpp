#pragma comment(linker, "/SUBSYSTEM:WINDOWS")
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <string>
#include <memory>
#include <vector>

#include "util/Config.h"
#include "util/Logger.h"
#include "net/FileChannel.h"
#include "watcher/FileWatcher.h"
#include "ui/TrayApp.h"

#pragma comment(lib, "ws2_32.lib")

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    char executable_path[MAX_PATH]{};
    GetModuleFileNameA(nullptr, executable_path, MAX_PATH);
    const std::string full_path(executable_path);
    const std::string base_dir = full_path.substr(0, full_path.find_last_of("\\/"));
    const std::string config_path = base_dir + "\\config.ini";

    Config config;
    const bool config_loaded = config.load(config_path);
    Logger::instance().init(base_dir + "\\" + config.get("log_file", "recipe_bot.log"), LogLevel::INFO);
    LOG_INFO("=== ARC Recipe Transfer Bot starting ===");
    if (!config_loaded) LOG_WARN("config.ini not found; using safe defaults where possible.");

    WSADATA winsock{};
    if (WSAStartup(MAKEWORD(2, 2), &winsock) != 0) {
        MessageBoxA(nullptr, "Windows networking could not start.", "ARC Recipe Bot", MB_OK | MB_ICONERROR);
        return 1;
    }

    FileChannel::Config channel_config;
    channel_config.listen_ip = config.get("file_listen_ip", "0.0.0.0");
    channel_config.listen_port = config.get_int("file_listen_port", 5003);
    channel_config.machine_id = config.get("machine_id", "");
    channel_config.token = config.get("file_channel_token", "");
    channel_config.outbox_dir = base_dir + "\\recipe_outbox";
    const int configured_max_bytes = config.get_int("max_file_bytes", 20 * 1024 * 1024);
    if (configured_max_bytes > 0) {
        channel_config.max_file_bytes = static_cast<unsigned long>(configured_max_bytes);
    }
    if (channel_config.machine_id.empty()) {
        MessageBoxA(nullptr, "machine_id is not set in config.ini.\nExample: machine_id = WB#82",
                    "ARC Recipe Bot", MB_OK | MB_ICONERROR);
        WSACleanup();
        return 1;
    }
    if (channel_config.token.empty() || channel_config.token == "CHANGE_ME") {
        MessageBoxA(nullptr, "file_channel_token is not configured in config.ini.",
                    "ARC Recipe Bot", MB_OK | MB_ICONERROR);
        WSACleanup();
        return 1;
    }

    const std::string watch_dir = config.get("watch_dir", "C:\\SYSTEM\\BONDPROG");
    const std::string file_extension = config.get("file_ext", ".PWB");
    CreateDirectoryA(watch_dir.c_str(), nullptr);

    auto tray = std::make_shared<TrayApp>();
    TrayApp::register_startup("SecsProxyBot");
    auto channel = std::make_shared<FileChannel>(channel_config);
    auto show_transfer_result = [tray](const std::string& ppid, const FileChannelResult& result) {
        if (!result.ok) {
            LOG_ERROR("App: Recipe transfer rejected: " + result.message);
            tray->show_balloon("Transfer Failed", result.message, NIIF_ERROR);
        } else if (result.server_status == "pending_approval") {
            LOG_INFO("App: Recipe update is awaiting host approval: PPID='" + ppid + "'.");
            tray->show_balloon("Update Awaiting Approval", "Recipe '" + ppid + "' is waiting for host approval.", NIIF_WARNING);
        } else if (result.server_status == "identical") {
            LOG_INFO("App: Recipe is already synchronized: PPID='" + ppid + "'.");
            tray->show_balloon("Already Synchronized", "Recipe '" + ppid + "' is unchanged on the host.", NIIF_INFO);
        } else {
            LOG_INFO("App: Recipe transfer completed: PPID='" + ppid + "'.");
            tray->show_transfer_complete_dialog(ppid);
        }
    };
    if (!channel->start(show_transfer_result)) {
        MessageBoxA(nullptr, "Recipe Bot could not listen on file port 5003.\nCheck whether another program uses the port.",
                    "ARC Recipe Bot", MB_OK | MB_ICONERROR);
        WSACleanup();
        return 1;
    }

    auto on_recipe_change = [&](const std::string& path, const std::string& ppid,
                                const std::vector<char>& content,
                                unsigned long long source_modified_ms) -> bool {
        LOG_INFO("App: New or changed recipe: PPID='" + ppid + "' path=" + path);
        const size_t slash = path.find_last_of("\\/");
        const std::string source_name = slash == std::string::npos ? path : path.substr(slash + 1);
        if (channel->is_host_connected()) {
            const FileChannelResult check = channel->check_recipe(content, source_name, ppid, source_modified_ms);
            if (check.ok && check.server_status == "identical") {
                LOG_INFO("App: Host already has identical PPID='" + ppid + "'; feedback popup suppressed.");
                return true;
            }
        }
        if (tray->show_recipe_dialog(ppid, path) != TrayApp::Confirm::Accept) {
            LOG_INFO("App: Operator cancelled recipe transfer.");
            return true;
        }
        // queue_recipe commits this exact detected snapshot to disk before it
        // reports success. A later NPGM overwrite cannot change the queued PWB.
        const FileChannelResult result = channel->queue_recipe(content, source_name, ppid, source_modified_ms);
        if (!result.ok) {
            LOG_ERROR("App: Recipe could not be queued: " + result.message);
            tray->show_balloon("Transfer Failed", result.message, NIIF_ERROR);
            return false;
        }
        LOG_INFO("App: Recipe snapshot safely queued: PPID='" + ppid + "'.");
        if (!channel->is_host_connected()) {
            tray->show_balloon("Transfer Queued", "Recipe '" + ppid + "' will send when the RATS host reconnects.", NIIF_WARNING);
        }
        return true;
    };

    FileWatcher watcher(watch_dir, file_extension, on_recipe_change);
    watcher.start();
    LOG_INFO("App: Machine ID=" + channel_config.machine_id + " file channel=" + channel_config.listen_ip + ":" + std::to_string(channel_config.listen_port));
    LOG_INFO("App: Watching '" + watch_dir + "' for NPGM*.PWB changes.");
    tray->show_balloon("Recipe Bot Ready", "Waiting for RATS host on file port " + std::to_string(channel_config.listen_port) + ".", NIIF_INFO);

    tray->run();

    watcher.stop();
    channel->stop();
    WSACleanup();
    LOG_INFO("App: Shutdown complete.");
    return 0;
}
