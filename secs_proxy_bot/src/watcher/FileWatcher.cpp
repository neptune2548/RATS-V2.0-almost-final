#include "FileWatcher.h"
#include "../util/Logger.h"
#include <algorithm>
#include <cctype>
#include <vector>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <iterator>
#include <utility>
#include <zlib.h>
#include <cstdint>

static std::string to_upper(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c){ return (char)std::toupper((unsigned char)c); });
    return s;
}

static std::string wstr_to_str(const std::wstring& ws) {
    if (ws.empty()) return {};
    int sz = WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), -1, nullptr, 0, nullptr, nullptr);
    if (sz <= 1) return {};
    std::string result(static_cast<size_t>(sz), '\0');
    WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), -1, result.data(), sz, nullptr, nullptr);
    result.resize(static_cast<size_t>(sz - 1));
    return result;
}

FileWatcher::FileWatcher(std::string watch_dir, std::string file_ext, Callback callback)
    : m_watch_dir(std::move(watch_dir))
    , m_file_ext(to_upper(std::move(file_ext)))
    , m_callback(std::move(callback))
{
    InitializeCriticalSection(&m_callback_cs);
    InitializeCriticalSection(&m_fingerprint_cs);
}

FileWatcher::~FileWatcher() {
    stop();
    DeleteCriticalSection(&m_fingerprint_cs);
    DeleteCriticalSection(&m_callback_cs);
}

void FileWatcher::start() {
    if (InterlockedExchange(&m_running, 1) != 0) return;
    m_stop_event = CreateEvent(nullptr, TRUE, FALSE, nullptr);
    m_callback_event = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    if (!m_stop_event || !m_callback_event) {
        LOG_ERROR("FileWatcher: Failed to create worker events.");
        stop();
        return;
    }
    m_thread = CreateThread(nullptr, 0, &FileWatcher::watch_thread_proc, this, 0, nullptr);
    m_callback_thread = CreateThread(nullptr, 0, &FileWatcher::callback_thread_proc, this, 0, nullptr);
    if (!m_thread || !m_callback_thread) {
        LOG_ERROR("FileWatcher: Failed to create worker threads.");
        stop();
        return;
    }
    LOG_INFO("FileWatcher: Watching '" + m_watch_dir + "' for *" + m_file_ext + " files.");
}

void FileWatcher::stop() {
    InterlockedExchange(&m_running, 0);
    if (m_stop_event) SetEvent(m_stop_event);
    if (m_callback_event) SetEvent(m_callback_event);
    if (m_thread) {
        WaitForSingleObject(m_thread, INFINITE);
        CloseHandle(m_thread);
        m_thread = nullptr;
    }
    if (m_callback_thread) {
        WaitForSingleObject(m_callback_thread, INFINITE);
        CloseHandle(m_callback_thread);
        m_callback_thread = nullptr;
    }
    if (m_stop_event) {
        CloseHandle(m_stop_event);
        m_stop_event = nullptr;
    }
    if (m_callback_event) {
        CloseHandle(m_callback_event);
        m_callback_event = nullptr;
    }
    LOG_INFO("FileWatcher: Stopped.");
}

DWORD WINAPI FileWatcher::watch_thread_proc(LPVOID param) {
    auto self = static_cast<FileWatcher*>(param);
    self->watch_loop();
    return 0;
}

DWORD WINAPI FileWatcher::callback_thread_proc(LPVOID param) {
    auto self = static_cast<FileWatcher*>(param);
    self->callback_loop();
    return 0;
}

void FileWatcher::enqueue_callback(CallbackJob job) {
    {
        CsLock lock(m_callback_cs);
        m_callback_jobs.push_back(std::move(job));
    }
    SetEvent(m_callback_event);
}

void FileWatcher::callback_loop() {
    HANDLE waits[2] = {m_stop_event, m_callback_event};
    while (m_running) {
        const DWORD wait_result = WaitForMultipleObjects(2, waits, FALSE, INFINITE);
        if (wait_result == WAIT_OBJECT_0 || !m_running) break;
        for (;;) {
            CallbackJob job;
            {
                CsLock lock(m_callback_cs);
                if (m_callback_jobs.empty()) break;
                job = std::move(m_callback_jobs.front());
                m_callback_jobs.pop_front();
            }
            const bool handled = m_callback &&
                m_callback(job.path, job.ppid, job.content);
            if (!handled) {
                CsLock lock(m_fingerprint_cs);
                auto seen = m_last_fingerprints.find(job.fingerprint_key);
                if (seen != m_last_fingerprints.end() && seen->second == job.fingerprint) {
                    m_last_fingerprints.erase(seen);
                }
            }
        }
    }
    LOG_INFO("FileWatcher: Recipe callback thread stopped.");
}

std::string FileWatcher::extract_ppid(const std::string& filename) const {
    std::string up = to_upper(filename);
    if (up.size() < m_file_ext.size()) return {};
    if (up.substr(up.size() - m_file_ext.size()) != m_file_ext) return {};
    std::string stem = up.substr(0, up.size() - m_file_ext.size());
    if (stem.size() <= 4 || stem.substr(0, 4) != "NPGM") return {};
    for (size_t i = 4; i < stem.size(); ++i) {
        if (!std::isdigit(static_cast<unsigned char>(stem[i]))) return {};
    }
    return filename.substr(0, filename.size() - m_file_ext.size());
}

std::string FileWatcher::extract_ppid_from_file(const std::string& filepath, const std::string& fallback) const {
    (void)fallback;
    gzFile file = gzopen(filepath.c_str(), "rb");
    if (!file) return {};
    std::vector<char> buffer;
    char chunk[4096];
    int bytes_read;
    while ((bytes_read = gzread(file, chunk, sizeof(chunk))) > 0) {
        buffer.insert(buffer.end(), chunk, chunk + bytes_read);
    }
    gzclose(file);
    if (buffer.empty()) return {};
    std::string content(buffer.begin(), buffer.end());
    size_t pos = content.find("Program Name");
    if (pos != std::string::npos) {
        pos += 12;
        while (pos < content.size() && (content[pos] == ':' || content[pos] == ' ')) pos++;
        size_t end = pos;
        while (end < content.size() && (std::isalnum((unsigned char)content[end]) || content[end] == '_' || content[end] == '-' || content[end] == '.' || content[end] == ' ')) end++;
        std::string ppid = content.substr(pos, end - pos);
        size_t endpos = ppid.find_last_not_of(" ");
        if (std::string::npos != endpos) ppid = ppid.substr(0, endpos + 1);
        if (ppid.length() >= 3) return ppid;
    }
    return {};
}

bool FileWatcher::wait_file_stable(const std::string& full_path, int settle_ms) {
    Sleep(static_cast<DWORD>(settle_ms / 2));
    WIN32_FILE_ATTRIBUTE_DATA a1{}, a2{};
    if (!GetFileAttributesExA(full_path.c_str(), GetFileExInfoStandard, &a1)) return false;
    Sleep(static_cast<DWORD>(settle_ms / 2));
    if (!GetFileAttributesExA(full_path.c_str(), GetFileExInfoStandard, &a2)) return false;
    bool size_same = (a1.nFileSizeLow == a2.nFileSizeLow && a1.nFileSizeHigh == a2.nFileSizeHigh);
    bool non_empty = (a2.nFileSizeLow > 0 || a2.nFileSizeHigh > 0);
    return size_same && non_empty;
}

std::string FileWatcher::content_fingerprint(const std::string& filepath) {
    gzFile file = gzopen(filepath.c_str(), "rb");
    if (!file) return {};
    uLong checksum = crc32(0L, Z_NULL, 0);
    unsigned long long total = 0;
    unsigned char chunk[8192];
    int bytes_read = 0;
    while ((bytes_read = gzread(file, chunk, sizeof(chunk))) > 0) {
        checksum = crc32(checksum, chunk, static_cast<uInt>(bytes_read));
        total += static_cast<unsigned long long>(bytes_read);
    }
    const int gz_error = gzclose(file);
    if (bytes_read < 0 || gz_error != Z_OK) return {};

    std::ostringstream value;
    value << std::hex << std::setw(8) << std::setfill('0') << static_cast<unsigned long>(checksum)
          << ":" << std::dec << total;
    return value.str();
}

bool FileWatcher::read_snapshot(const std::string& filepath, std::vector<char>& content) {
    std::ifstream input(filepath, std::ios::binary);
    if (!input.is_open()) return false;
    content.assign(std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>());
    return !content.empty() && (input.eof() || input.good());
}

void FileWatcher::watch_loop() {
    m_dir_handle = CreateFileA(m_watch_dir.c_str(), FILE_LIST_DIRECTORY, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OVERLAPPED, nullptr);
    if (m_dir_handle == INVALID_HANDLE_VALUE) {
        LOG_ERROR("FileWatcher: Cannot open directory '" + m_watch_dir + "'");
        InterlockedExchange(&m_running, 0);
        return;
    }
    constexpr size_t BUF_SIZE = 65536;
    alignas(DWORD) uint8_t buffer[BUF_SIZE];
    OVERLAPPED ov{};
    ov.hEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);
    if (!ov.hEvent) {
        LOG_ERROR("FileWatcher: Failed to create overlapped event.");
        CloseHandle(m_dir_handle);
        m_dir_handle = INVALID_HANDLE_VALUE;
        InterlockedExchange(&m_running, 0);
        return;
    }
    HANDLE wait_handles[2] = { ov.hEvent, m_stop_event };
    while (m_running) {
        ResetEvent(ov.hEvent);
        DWORD bytes_returned = 0;
        BOOL ok = ReadDirectoryChangesW(m_dir_handle, buffer, BUF_SIZE, FALSE, FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE, &bytes_returned, &ov, nullptr);
        if (!ok && GetLastError() != ERROR_IO_PENDING) break;
        DWORD result = WaitForMultipleObjects(2, wait_handles, FALSE, INFINITE);
        if (result != WAIT_OBJECT_0) break;
        if (!GetOverlappedResult(m_dir_handle, &ov, &bytes_returned, FALSE)) continue;
        if (bytes_returned == 0) continue;
        const uint8_t* ptr = buffer;
        while (ptr < buffer + bytes_returned) {
            auto* info = reinterpret_cast<const FILE_NOTIFY_INFORMATION*>(ptr);
            if (info->Action == FILE_ACTION_ADDED ||
                info->Action == FILE_ACTION_RENAMED_NEW_NAME ||
                info->Action == FILE_ACTION_MODIFIED) {
                std::wstring wname(info->FileName, info->FileNameLength / sizeof(wchar_t));
                std::string fname = wstr_to_str(wname);
                std::string ppid_stem = extract_ppid(fname);
                if (!ppid_stem.empty()) {
                    std::string full_path = m_watch_dir + "\\" + fname;
                    LOG_INFO("FileWatcher: Detected new or updated machine recipe slot: " + fname);
                    if (wait_file_stable(full_path, 1000)) {
                        std::string real_ppid = extract_ppid_from_file(full_path, ppid_stem);
                        if (real_ppid.empty()) {
                            LOG_WARN("FileWatcher: Program Name/PPID not found inside " + fname + "; upload skipped.");
                            if (info->NextEntryOffset == 0) break;
                            ptr += info->NextEntryOffset;
                            continue;
                        }
                        std::string fingerprint = content_fingerprint(full_path);
                        if (fingerprint.empty()) {
                            LOG_WARN("FileWatcher: Could not fingerprint recipe file: " + fname);
                            if (info->NextEntryOffset == 0) break;
                            ptr += info->NextEntryOffset;
                            continue;
                        }
                        std::vector<char> snapshot;
                        if (!read_snapshot(full_path, snapshot)) {
                            LOG_WARN("FileWatcher: Could not preserve recipe snapshot: " + fname);
                            if (info->NextEntryOffset == 0) break;
                            ptr += info->NextEntryOffset;
                            continue;
                        }
                        std::string ppid_key = to_upper(real_ppid);
                        bool duplicate = false;
                        {
                            CsLock lock(m_fingerprint_cs);
                            auto seen = m_last_fingerprints.find(ppid_key);
                            duplicate = seen != m_last_fingerprints.end() && seen->second == fingerprint;
                            if (!duplicate) m_last_fingerprints[ppid_key] = fingerprint;
                        }
                        if (duplicate) {
                            LOG_DEBUG("FileWatcher: Duplicate write notification suppressed for PPID='" + real_ppid + "'.");
                            if (info->NextEntryOffset == 0) break;
                            ptr += info->NextEntryOffset;
                            continue;
                        }
                        LOG_INFO("FileWatcher: Stable content change detected for real PPID='" + real_ppid + "'.");
                        CallbackJob job;
                        job.path = full_path;
                        job.ppid = real_ppid;
                        job.fingerprint_key = ppid_key;
                        job.fingerprint = fingerprint;
                        job.content = std::move(snapshot);
                        enqueue_callback(std::move(job));
                    } else {
                        LOG_WARN("FileWatcher: File '" + fname + "' appears empty or unstable — skipping.");
                    }
                }
            }
            if (info->NextEntryOffset == 0) break;
            ptr += info->NextEntryOffset;
        }
    }
    if (m_dir_handle != INVALID_HANDLE_VALUE) {
        // CancelIo must be called by the thread that issued the overlapped
        // request on Windows XP. This keeps the stack buffer alive until the
        // pending ReadDirectoryChangesW has been cancelled.
        CancelIo(m_dir_handle);
        CloseHandle(m_dir_handle);
        m_dir_handle = INVALID_HANDLE_VALUE;
    }
    CloseHandle(ov.hEvent);
    LOG_INFO("FileWatcher: Watch loop exited.");
}
