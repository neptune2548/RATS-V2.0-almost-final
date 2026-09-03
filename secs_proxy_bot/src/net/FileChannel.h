#pragma once

#include <winsock2.h>
#include <windows.h>
#include <string>
#include <deque>
#include <functional>
#include <vector>
#include "../util/Win32Sync.h"

struct FileChannelResult {
    bool ok{false};
    bool retryable{false};
    std::string server_status;
    std::string message;
};

class FileChannel {
public:
    struct Config {
        std::string listen_ip{"0.0.0.0"};
        int listen_port{5003};
        std::string machine_id;
        std::string token;
        std::string outbox_dir;
        unsigned long max_file_bytes{20UL * 1024UL * 1024UL};
    };

    using CompletionCallback = std::function<void(const std::string& ppid,
                                                  const FileChannelResult& result)>;

    explicit FileChannel(Config config);
    ~FileChannel();

    bool start(CompletionCallback completion_callback = {});
    void stop();
    bool is_host_connected() const;
    // Atomically preserves the accepted bytes in the durable outbox. The
    // sender thread retries transport failures after the host reconnects.
    FileChannelResult queue_recipe(const std::vector<char>& body,
                                   const std::string& source_filename,
                                   const std::string& ppid,
                                   unsigned long long source_modified_ms);
    FileChannelResult check_recipe(const std::vector<char>& body,
                                   const std::string& source_filename,
                                   const std::string& ppid,
                                   unsigned long long source_modified_ms);

private:
    Config m_config;
    volatile LONG m_running{0};
    SOCKET m_server_socket{INVALID_SOCKET};
    SOCKET m_auth_socket{INVALID_SOCKET};
    SOCKET m_host_socket{INVALID_SOCKET};
    HANDLE m_accept_thread{nullptr};
    HANDLE m_sender_thread{nullptr};
    HANDLE m_connected_event{nullptr};
    HANDLE m_stop_event{nullptr};
    HANDLE m_sender_wake_event{nullptr};
    mutable CRITICAL_SECTION m_socket_cs;
    mutable CRITICAL_SECTION m_exchange_cs;
    mutable CRITICAL_SECTION m_queue_cs;
    volatile LONG m_job_sequence{0};

    struct OutboxJob {
        std::string path;
        std::string source_filename;
        std::string ppid;
        unsigned long long source_modified_ms{0};
    };
    std::deque<OutboxJob> m_jobs;
    CompletionCallback m_completion_callback;

    static DWORD WINAPI accept_thread_proc(LPVOID parameter);
    static DWORD WINAPI sender_thread_proc(LPVOID parameter);
    void accept_loop();
    void sender_loop();
    bool authenticate(SOCKET socket_handle) const;
    bool replace_host_socket(SOCKET socket_handle);
    void close_host_socket_locked();
    void close_auth_socket_locked();

    bool load_outbox();
    bool read_job(const std::string& path, OutboxJob& job, std::vector<char>& body) const;
    FileChannelResult write_job(const std::vector<char>& body,
                                const std::string& source_filename,
                                const std::string& ppid,
                                unsigned long long source_modified_ms,
                                OutboxJob& job);
    static bool move_to_failed(const std::string& path);

    static bool send_all(SOCKET socket_handle, const char* data, size_t length);
    static bool recv_all(SOCKET socket_handle, char* data, size_t length);
    static std::string json_escape(const std::string& value);
    static std::string json_value(const std::string& json, const std::string& key);
    FileChannelResult exchange_bytes(const std::string& frame_type,
                                     const std::vector<char>& body,
                                     const std::string& source_filename,
                                     const std::string& ppid,
                                     unsigned long long source_modified_ms,
                                     bool wait_for_connection);
};
