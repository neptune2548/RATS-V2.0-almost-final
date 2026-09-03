#pragma once
#include <windows.h>
#include <string>
#include <fstream>
#include "Win32Sync.h"

enum class LogLevel { DEBUG = 0, INFO, WARN, ERROR_ };

class Logger {
public:
    static Logger& instance();
    void init(const std::string& filepath, LogLevel min_level = LogLevel::INFO);
    void log(LogLevel level, const std::string& msg);
    void debug(const std::string& msg) { log(LogLevel::DEBUG, msg); }
    void info (const std::string& msg) { log(LogLevel::INFO,  msg); }
    void warn (const std::string& msg) { log(LogLevel::WARN,  msg); }
    void error(const std::string& msg) { log(LogLevel::ERROR_, msg); }
private:
    Logger();
    ~Logger();
    CRITICAL_SECTION m_cs;
    std::ofstream    m_file;
    LogLevel         m_min_level{LogLevel::INFO};
    static const char* level_str(LogLevel l);
};

#define LOG_DEBUG(msg) Logger::instance().debug(msg)
#define LOG_INFO(msg)  Logger::instance().info(msg)
#define LOG_WARN(msg)  Logger::instance().warn(msg)
#define LOG_ERROR(msg) Logger::instance().error(msg)
