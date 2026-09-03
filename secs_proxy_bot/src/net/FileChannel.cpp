#include "FileChannel.h"
#include "../util/Logger.h"

#include <ws2tcpip.h>
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <sstream>
#include <utility>

namespace {

const char kChannelMagic[8] = {'A','R','C','F','B','O','T','1'};
const char kJobMagic[8] = {'A','R','C','J','O','B','1','\0'};

bool parse_ipv4(const std::string& ip, in_addr& output) {
    sockaddr_in address{};
    address.sin_family = AF_INET;
    int size = sizeof(address);
    if (WSAStringToAddressA(const_cast<char*>(ip.c_str()), AF_INET, nullptr,
                            reinterpret_cast<sockaddr*>(&address), &size) == 0) {
        output = address.sin_addr;
        return true;
    }
    output.s_addr = inet_addr(ip.c_str());
    return output.s_addr != INADDR_NONE;
}

bool write_u32(std::ofstream& output, std::uint32_t value) {
    const unsigned long encoded = htonl(static_cast<unsigned long>(value));
    output.write(reinterpret_cast<const char*>(&encoded), sizeof(encoded));
    return output.good();
}

bool read_u32(std::ifstream& input, std::uint32_t& value) {
    unsigned long encoded = 0;
    input.read(reinterpret_cast<char*>(&encoded), sizeof(encoded));
    if (!input) return false;
    value = static_cast<std::uint32_t>(ntohl(encoded));
    return true;
}

} // namespace

FileChannel::FileChannel(Config config) : m_config(std::move(config)) {
    if (m_config.outbox_dir.empty()) m_config.outbox_dir = ".\\recipe_outbox";
    InitializeCriticalSection(&m_socket_cs);
    InitializeCriticalSection(&m_exchange_cs);
    InitializeCriticalSection(&m_queue_cs);
}

FileChannel::~FileChannel() {
    stop();
    DeleteCriticalSection(&m_queue_cs);
    DeleteCriticalSection(&m_exchange_cs);
    DeleteCriticalSection(&m_socket_cs);
}

bool FileChannel::start(CompletionCallback completion_callback) {
    if (InterlockedExchange(&m_running, 1) != 0) return true;
    m_completion_callback = std::move(completion_callback);

    if (!CreateDirectoryA(m_config.outbox_dir.c_str(), nullptr) &&
        GetLastError() != ERROR_ALREADY_EXISTS) {
        LOG_ERROR("FileChannel: Cannot create durable outbox '" + m_config.outbox_dir + "'.");
        stop();
        return false;
    }

    m_connected_event = CreateEvent(nullptr, TRUE, FALSE, nullptr);
    m_stop_event = CreateEvent(nullptr, TRUE, FALSE, nullptr);
    m_sender_wake_event = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    m_server_socket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (m_server_socket == INVALID_SOCKET || !m_connected_event ||
        !m_stop_event || !m_sender_wake_event) {
        LOG_ERROR("FileChannel: Cannot create listener resources.");
        stop();
        return false;
    }

    int reuse = 1;
    setsockopt(m_server_socket, SOL_SOCKET, SO_REUSEADDR,
               reinterpret_cast<const char*>(&reuse), sizeof(reuse));
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(static_cast<u_short>(m_config.listen_port));
    if (!parse_ipv4(m_config.listen_ip, address.sin_addr) ||
        bind(m_server_socket, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR ||
        listen(m_server_socket, 2) == SOCKET_ERROR) {
        LOG_ERROR("FileChannel: Cannot listen on " + m_config.listen_ip + ":" +
                  std::to_string(m_config.listen_port) + " (error " +
                  std::to_string(WSAGetLastError()) + ").");
        stop();
        return false;
    }

    load_outbox();
    m_sender_thread = CreateThread(nullptr, 0, &FileChannel::sender_thread_proc, this, 0, nullptr);
    m_accept_thread = CreateThread(nullptr, 0, &FileChannel::accept_thread_proc, this, 0, nullptr);
    if (!m_sender_thread || !m_accept_thread) {
        LOG_ERROR("FileChannel: Cannot create channel worker threads.");
        stop();
        return false;
    }

    LOG_INFO("FileChannel: Listening for RATS host on " + m_config.listen_ip + ":" +
             std::to_string(m_config.listen_port));
    return true;
}

void FileChannel::stop() {
    InterlockedExchange(&m_running, 0);
    if (m_stop_event) SetEvent(m_stop_event);
    if (m_sender_wake_event) SetEvent(m_sender_wake_event);

    if (m_server_socket != INVALID_SOCKET) {
        shutdown(m_server_socket, SD_BOTH);
        closesocket(m_server_socket);
        m_server_socket = INVALID_SOCKET;
    }
    {
        CsLock lock(m_socket_cs);
        close_auth_socket_locked();
        close_host_socket_locked();
    }

    // Closing the listener/authentication/client sockets unblocks every
    // synchronous Winsock call. Never destroy this object while either worker
    // can still access it.
    if (m_accept_thread) {
        WaitForSingleObject(m_accept_thread, INFINITE);
        CloseHandle(m_accept_thread);
        m_accept_thread = nullptr;
    }
    if (m_sender_thread) {
        WaitForSingleObject(m_sender_thread, INFINITE);
        CloseHandle(m_sender_thread);
        m_sender_thread = nullptr;
    }

    if (m_connected_event) {
        CloseHandle(m_connected_event);
        m_connected_event = nullptr;
    }
    if (m_stop_event) {
        CloseHandle(m_stop_event);
        m_stop_event = nullptr;
    }
    if (m_sender_wake_event) {
        CloseHandle(m_sender_wake_event);
        m_sender_wake_event = nullptr;
    }
}

bool FileChannel::is_host_connected() const {
    CsLock lock(m_socket_cs);
    return m_host_socket != INVALID_SOCKET;
}

DWORD WINAPI FileChannel::accept_thread_proc(LPVOID parameter) {
    static_cast<FileChannel*>(parameter)->accept_loop();
    return 0;
}

DWORD WINAPI FileChannel::sender_thread_proc(LPVOID parameter) {
    static_cast<FileChannel*>(parameter)->sender_loop();
    return 0;
}

void FileChannel::accept_loop() {
    while (m_running) {
        SOCKET incoming = accept(m_server_socket, nullptr, nullptr);
        if (incoming == INVALID_SOCKET) {
            if (m_running) Sleep(250);
            continue;
        }

        const int timeout_ms = 30000;
        setsockopt(incoming, SOL_SOCKET, SO_SNDTIMEO,
                   reinterpret_cast<const char*>(&timeout_ms), sizeof(timeout_ms));
        setsockopt(incoming, SOL_SOCKET, SO_RCVTIMEO,
                   reinterpret_cast<const char*>(&timeout_ms), sizeof(timeout_ms));

        {
            CsLock lock(m_socket_cs);
            if (!m_running) {
                shutdown(incoming, SD_BOTH);
                closesocket(incoming);
                break;
            }
            m_auth_socket = incoming;
        }

        const bool accepted = authenticate(incoming);
        bool still_owns_socket = false;
        {
            CsLock lock(m_socket_cs);
            if (m_auth_socket == incoming) {
                m_auth_socket = INVALID_SOCKET;
                still_owns_socket = true;
            }
        }
        // stop() may already have closed this socket. Do not close a numeric
        // SOCKET value twice because Winsock could reuse it on another thread.
        if (!still_owns_socket) continue;

        if (!accepted) {
            LOG_WARN("FileChannel: Rejected unauthenticated host connection.");
            shutdown(incoming, SD_BOTH);
            closesocket(incoming);
            continue;
        }
        int keepalive = 1;
        setsockopt(incoming, SOL_SOCKET, SO_KEEPALIVE,
                   reinterpret_cast<const char*>(&keepalive), sizeof(keepalive));
        if (!replace_host_socket(incoming)) {
            shutdown(incoming, SD_BOTH);
            closesocket(incoming);
            continue;
        }
        LOG_INFO("FileChannel: Authenticated RATS host connected.");
    }
    LOG_INFO("FileChannel: Accept thread stopped.");
}

bool FileChannel::authenticate(SOCKET socket_handle) const {
    char magic[8]{};
    if (!recv_all(socket_handle, magic, sizeof(magic)) ||
        std::memcmp(magic, kChannelMagic, sizeof(kChannelMagic)) != 0) return false;
    unsigned short network_length = 0;
    if (!recv_all(socket_handle, reinterpret_cast<char*>(&network_length), sizeof(network_length))) return false;
    const unsigned short length = ntohs(network_length);
    if (length == 0 || length > 512) return false;
    std::vector<char> token(length);
    if (!recv_all(socket_handle, token.data(), token.size())) return false;
    const bool accepted = std::string(token.begin(), token.end()) == m_config.token;
    const char answer = accepted ? '\x01' : '\x00';
    send_all(socket_handle, &answer, 1);
    return accepted;
}

bool FileChannel::replace_host_socket(SOCKET socket_handle) {
    // Do not replace a socket while an exchange is using it.
    CsLock exchange_lock(m_exchange_cs);
    CsLock socket_lock(m_socket_cs);
    if (!m_running) return false;
    close_host_socket_locked();
    m_host_socket = socket_handle;
    SetEvent(m_connected_event);
    SetEvent(m_sender_wake_event);
    return true;
}

void FileChannel::close_host_socket_locked() {
    if (m_host_socket != INVALID_SOCKET) {
        shutdown(m_host_socket, SD_BOTH);
        closesocket(m_host_socket);
        m_host_socket = INVALID_SOCKET;
    }
    if (m_connected_event) ResetEvent(m_connected_event);
}

void FileChannel::close_auth_socket_locked() {
    if (m_auth_socket != INVALID_SOCKET) {
        shutdown(m_auth_socket, SD_BOTH);
        closesocket(m_auth_socket);
        m_auth_socket = INVALID_SOCKET;
    }
}

FileChannelResult FileChannel::queue_recipe(const std::vector<char>& body,
                                            const std::string& source_filename,
                                            const std::string& ppid) {
    OutboxJob job;
    FileChannelResult result = write_job(body, source_filename, ppid, job);
    if (!result.ok) return result;
    {
        CsLock lock(m_queue_cs);
        m_jobs.push_back(job);
    }
    SetEvent(m_sender_wake_event);
    return result;
}

FileChannelResult FileChannel::check_recipe(const std::vector<char>& body,
                                            const std::string& source_filename,
                                            const std::string& ppid) {
    return exchange_bytes("check", body, source_filename, ppid, true);
}

FileChannelResult FileChannel::write_job(const std::vector<char>& body,
                                         const std::string& source_filename,
                                         const std::string& ppid,
                                         OutboxJob& job) {
    FileChannelResult result;
    if (body.empty()) {
        result.message = "Recipe file is empty";
        return result;
    }
    if (body.size() > m_config.max_file_bytes ||
        source_filename.empty() || source_filename.size() > 4096 ||
        ppid.empty() || ppid.size() > 4096) {
        result.message = "Recipe cannot be placed in the durable outbox";
        return result;
    }

    const LONG sequence = InterlockedIncrement(&m_job_sequence);
    std::ostringstream name;
    name << m_config.outbox_dir << "\\" << GetCurrentProcessId() << "-"
         << GetTickCount() << "-" << sequence;
    const std::string temporary_path = name.str() + ".tmp";
    const std::string final_path = name.str() + ".job";

    std::ofstream output(temporary_path, std::ios::binary | std::ios::trunc);
    if (!output.is_open()) {
        result.message = "Cannot create durable recipe outbox file";
        return result;
    }
    output.write(kJobMagic, sizeof(kJobMagic));
    const bool header_ok =
        write_u32(output, static_cast<std::uint32_t>(source_filename.size())) &&
        write_u32(output, static_cast<std::uint32_t>(ppid.size())) &&
        write_u32(output, static_cast<std::uint32_t>(body.size()));
    if (header_ok) {
        output.write(source_filename.data(), static_cast<std::streamsize>(source_filename.size()));
        output.write(ppid.data(), static_cast<std::streamsize>(ppid.size()));
        output.write(body.data(), static_cast<std::streamsize>(body.size()));
    }
    output.flush();
    const bool write_ok = header_ok && output.good();
    output.close();
    if (!write_ok || !MoveFileExA(temporary_path.c_str(), final_path.c_str(),
                                  MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        DeleteFileA(temporary_path.c_str());
        result.message = "Cannot commit durable recipe outbox file";
        return result;
    }

    job.path = final_path;
    job.source_filename = source_filename;
    job.ppid = ppid;
    result.ok = true;
    result.server_status = "queued";
    result.message = "Recipe safely queued for host transfer";
    LOG_INFO("FileChannel: Durably queued PPID='" + ppid + "' as " + final_path);
    return result;
}

bool FileChannel::read_job(const std::string& path, OutboxJob& job,
                           std::vector<char>& body) const {
    std::ifstream input(path, std::ios::binary);
    if (!input.is_open()) return false;
    char magic[8]{};
    input.read(magic, sizeof(magic));
    if (!input || std::memcmp(magic, kJobMagic, sizeof(kJobMagic)) != 0) return false;

    std::uint32_t source_length = 0;
    std::uint32_t ppid_length = 0;
    std::uint32_t body_length = 0;
    if (!read_u32(input, source_length) || !read_u32(input, ppid_length) ||
        !read_u32(input, body_length) || source_length == 0 || source_length > 4096 ||
        ppid_length == 0 || ppid_length > 4096 || body_length == 0 ||
        body_length > m_config.max_file_bytes) return false;

    std::vector<char> source(source_length);
    std::vector<char> ppid(ppid_length);
    body.resize(body_length);
    input.read(source.data(), static_cast<std::streamsize>(source.size()));
    input.read(ppid.data(), static_cast<std::streamsize>(ppid.size()));
    input.read(body.data(), static_cast<std::streamsize>(body.size()));
    if (!input) return false;

    job.path = path;
    job.source_filename.assign(source.begin(), source.end());
    job.ppid.assign(ppid.begin(), ppid.end());
    return true;
}

bool FileChannel::load_outbox() {
    std::vector<std::string> paths;
    WIN32_FIND_DATAA entry{};
    const std::string pattern = m_config.outbox_dir + "\\*.job";
    HANDLE search = FindFirstFileA(pattern.c_str(), &entry);
    if (search != INVALID_HANDLE_VALUE) {
        do {
            if ((entry.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) == 0) {
                paths.push_back(m_config.outbox_dir + "\\" + entry.cFileName);
            }
        } while (FindNextFileA(search, &entry));
        FindClose(search);
    }
    std::sort(paths.begin(), paths.end());

    for (const std::string& path : paths) {
        OutboxJob job;
        std::vector<char> body;
        if (!read_job(path, job, body)) {
            LOG_ERROR("FileChannel: Invalid durable outbox job moved aside: " + path);
            move_to_failed(path);
            continue;
        }
        m_jobs.push_back(job);
    }
    if (!m_jobs.empty()) {
        LOG_INFO("FileChannel: Recovered " + std::to_string(m_jobs.size()) +
                 " pending recipe transfer(s) from the durable outbox.");
    }
    return true;
}

bool FileChannel::move_to_failed(const std::string& path) {
    const std::string failed_path = path + ".failed";
    return MoveFileExA(path.c_str(), failed_path.c_str(), MOVEFILE_REPLACE_EXISTING) != FALSE;
}

void FileChannel::sender_loop() {
    HANDLE waits[2] = {m_stop_event, m_sender_wake_event};
    while (m_running) {
        const DWORD wait_result = WaitForMultipleObjects(2, waits, FALSE, INFINITE);
        if (wait_result == WAIT_OBJECT_0 || !m_running) break;

        while (m_running) {
            OutboxJob job;
            {
                CsLock lock(m_queue_cs);
                if (m_jobs.empty()) break;
                job = m_jobs.front();
            }
            if (!is_host_connected()) break;

            std::vector<char> body;
            OutboxJob loaded;
            FileChannelResult result;
            if (!read_job(job.path, loaded, body)) {
                result.message = "Durable recipe outbox file is damaged";
                result.server_status = "error";
            } else {
                result = exchange_bytes("recipe", body, loaded.source_filename,
                                        loaded.ppid, false);
                job = loaded;
            }

            if (result.retryable) {
                LOG_WARN("FileChannel: Transfer interrupted; PPID='" + job.ppid +
                         "' remains in outbox until the host reconnects.");
                break;
            }

            {
                CsLock lock(m_queue_cs);
                if (!m_jobs.empty() && m_jobs.front().path == job.path) m_jobs.pop_front();
            }
            if (result.ok) {
                if (!DeleteFileA(job.path.c_str())) {
                    LOG_WARN("FileChannel: Sent job could not be deleted; a later resend will be harmless: " + job.path);
                }
            } else {
                move_to_failed(job.path);
            }
            if (m_completion_callback) m_completion_callback(job.ppid, result);
        }
    }
    LOG_INFO("FileChannel: Sender thread stopped.");
}

FileChannelResult FileChannel::exchange_bytes(const std::string& frame_type,
                                              const std::vector<char>& body,
                                              const std::string& source_filename,
                                              const std::string& ppid,
                                              bool wait_for_connection) {
    FileChannelResult result;
    if (body.empty() || body.size() > m_config.max_file_bytes) {
        result.message = body.empty() ? "Recipe file is empty" : "Recipe file is too large";
        return result;
    }

    if (wait_for_connection) {
        HANDLE waits[2] = {m_connected_event, m_stop_event};
        const DWORD connected = WaitForMultipleObjects(2, waits, FALSE, 30000);
        if (connected != WAIT_OBJECT_0) {
            result.retryable = true;
            result.message = "RATS host is not connected to Recipe Bot port " +
                             std::to_string(m_config.listen_port);
            return result;
        }
    } else if (WaitForSingleObject(m_connected_event, 0) != WAIT_OBJECT_0) {
        result.retryable = true;
        result.message = "RATS host is not connected";
        return result;
    }

    std::ostringstream metadata;
    metadata << "{\"type\":\"" << json_escape(frame_type)
             << "\",\"machine_id\":\"" << json_escape(m_config.machine_id)
             << "\",\"ppid\":\"" << json_escape(ppid)
             << "\",\"source_filename\":\"" << json_escape(source_filename)
             << "\",\"size\":" << body.size() << "}";
    const std::string header = metadata.str();
    const unsigned long network_header_length = htonl(static_cast<unsigned long>(header.size()));

    CsLock exchange_lock(m_exchange_cs);
    SOCKET socket_handle = INVALID_SOCKET;
    {
        CsLock socket_lock(m_socket_cs);
        socket_handle = m_host_socket;
    }
    if (socket_handle == INVALID_SOCKET) {
        result.retryable = true;
        result.message = "RATS host disconnected before transfer";
        return result;
    }

    const auto disconnect = [&]() {
        CsLock socket_lock(m_socket_cs);
        if (m_host_socket == socket_handle) close_host_socket_locked();
    };

    if (!send_all(socket_handle, reinterpret_cast<const char*>(&network_header_length), 4) ||
        !send_all(socket_handle, header.data(), header.size()) ||
        !send_all(socket_handle, body.data(), body.size())) {
        disconnect();
        result.retryable = true;
        result.message = "Recipe channel disconnected while sending file";
        return result;
    }

    unsigned long network_response_length = 0;
    if (!recv_all(socket_handle, reinterpret_cast<char*>(&network_response_length), 4)) {
        disconnect();
        result.retryable = true;
        result.message = "Recipe channel disconnected before server response";
        return result;
    }
    const unsigned long response_length = ntohl(network_response_length);
    if (response_length < 2 || response_length > 65536) {
        disconnect();
        result.retryable = true;
        result.message = "Invalid response from RATS host";
        return result;
    }
    std::vector<char> response_bytes(response_length);
    if (!recv_all(socket_handle, response_bytes.data(), response_bytes.size())) {
        disconnect();
        result.retryable = true;
        result.message = "Recipe channel disconnected during server response";
        return result;
    }

    const std::string response(response_bytes.begin(), response_bytes.end());
    result.server_status = json_value(response, "status");
    result.ok = response.find("\"ok\":true") != std::string::npos;
    if (result.ok) {
        if (result.server_status == "saved_new") result.message = "New recipe saved on server";
        else if (result.server_status == "identical") result.message = "Recipe is already synchronized";
        else if (result.server_status == "pending_approval") result.message = "Recipe update is waiting for server approval";
        else result.message = "Recipe accepted by server";
    } else {
        result.message = json_value(response, "detail");
        if (result.message.empty()) result.message = "RATS host rejected recipe file";
    }
    return result;
}

bool FileChannel::send_all(SOCKET socket_handle, const char* data, size_t length) {
    size_t done = 0;
    while (done < length) {
        const int chunk = static_cast<int>((length - done) > 0x7fffffffU ? 0x7fffffffU : length - done);
        const int sent = send(socket_handle, data + done, chunk, 0);
        if (sent <= 0) return false;
        done += static_cast<size_t>(sent);
    }
    return true;
}

bool FileChannel::recv_all(SOCKET socket_handle, char* data, size_t length) {
    size_t done = 0;
    while (done < length) {
        const size_t remaining = length - done;
        const int chunk = static_cast<int>(remaining > 0x7fffffffU ? 0x7fffffffU : remaining);
        const int received = recv(socket_handle, data + done, chunk, 0);
        if (received <= 0) return false;
        done += static_cast<size_t>(received);
    }
    return true;
}

std::string FileChannel::json_escape(const std::string& value) {
    std::string output;
    for (unsigned char c : value) {
        if (c == '\\' || c == '"') {
            output.push_back('\\');
            output.push_back(static_cast<char>(c));
        } else if (c >= 0x20) {
            output.push_back(static_cast<char>(c));
        }
    }
    return output;
}

std::string FileChannel::json_value(const std::string& json, const std::string& key) {
    const std::string marker = "\"" + key + "\"";
    size_t position = json.find(marker);
    if (position == std::string::npos) return {};
    position = json.find(':', position + marker.size());
    if (position == std::string::npos) return {};
    position = json.find('"', position + 1);
    if (position == std::string::npos) return {};
    const size_t end = json.find('"', position + 1);
    return end == std::string::npos ? std::string() : json.substr(position + 1, end - position - 1);
}
