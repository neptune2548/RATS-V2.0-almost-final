#pragma once
#include <windows.h>
#include <string>
#include <functional>
#include <map>
#include <deque>
#include <vector>
#include "../util/Win32Sync.h"

class FileWatcher {
public:
    // `content` is an immutable snapshot taken when the stable change was
    // detected, so a later NPGM slot overwrite cannot alter an accepted job.
    using Callback = std::function<bool(const std::string& path,
                                        const std::string& ppid,
                                        const std::vector<char>& content,
                                        unsigned long long source_modified_ms)>;

    FileWatcher(std::string watch_dir, std::string file_ext, Callback callback);
    ~FileWatcher();

    void start();
    void stop();

private:
    std::string  m_watch_dir;
    std::string  m_file_ext;
    Callback     m_callback;
    std::map<std::string, std::string> m_last_fingerprints;

    struct CallbackJob {
        std::string path;
        std::string ppid;
        std::string fingerprint_key;
        std::string fingerprint;
        std::vector<char> content;
        unsigned long long source_modified_ms{0};
    };
    std::deque<CallbackJob> m_callback_jobs;

    volatile LONG m_running{0};
    HANDLE        m_thread{nullptr};
    HANDLE        m_callback_thread{nullptr};
    HANDLE        m_dir_handle{INVALID_HANDLE_VALUE};
    HANDLE        m_stop_event{nullptr};
    HANDLE        m_callback_event{nullptr};
    CRITICAL_SECTION m_callback_cs;
    CRITICAL_SECTION m_fingerprint_cs;

    static DWORD WINAPI watch_thread_proc(LPVOID param);
    static DWORD WINAPI callback_thread_proc(LPVOID param);
    void watch_loop();
    void callback_loop();
    void enqueue_callback(CallbackJob job);

    std::string extract_ppid(const std::string& filename) const;
    std::string extract_ppid_from_file(const std::string& filepath, const std::string& fallback) const;
    static std::string content_fingerprint(const std::string& filepath);
    static bool read_snapshot(const std::string& filepath, std::vector<char>& content);
    static unsigned long long modification_time_ms(const std::string& filepath);

    static bool wait_file_stable(const std::string& full_path, int settle_ms = 600);
};
