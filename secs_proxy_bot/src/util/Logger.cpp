#include "Logger.h"
#include <sstream>
#include <iomanip>

Logger& Logger::instance() {
    static Logger inst;
    return inst;
}

Logger::Logger()  { InitializeCriticalSection(&m_cs); }
Logger::~Logger() { DeleteCriticalSection(&m_cs); }

void Logger::init(const std::string& filepath, LogLevel min_level) {
    CsLock lk(m_cs);
    m_min_level = min_level;
    if (!filepath.empty()) m_file.open(filepath, std::ios::app);
}

static std::string timestamp_now() {
    SYSTEMTIME st;
    GetLocalTime(&st);
    char buf[32];
    // Format: YYYY-MM-DD HH:MM:SS
    wsprintfA(buf, "%04d-%02d-%02d %02d:%02d:%02d",
        (int)st.wYear, (int)st.wMonth, (int)st.wDay,
        (int)st.wHour, (int)st.wMinute, (int)st.wSecond);
    return buf;
}

const char* Logger::level_str(LogLevel l) {
    switch (l) {
        case LogLevel::DEBUG:  return "DEBUG";
        case LogLevel::INFO:   return "INFO ";
        case LogLevel::WARN:   return "WARN ";
        case LogLevel::ERROR_: return "ERROR";
        default:               return "?????";
    }
}

void Logger::log(LogLevel level, const std::string& msg) {
    if (level < m_min_level) return;
    std::string line = "[" + timestamp_now() + "] [" + level_str(level) + "] " + msg;
    CsLock lk(m_cs);
    if (m_file.is_open()) {
        m_file << line << "\n";
        m_file.flush();
    }
}
