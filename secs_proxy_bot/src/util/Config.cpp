#include "Config.h"
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <cstdint>

bool Config::load(const std::string& path) {
    std::ifstream f(path);
    if (!f.is_open()) return false;

    std::string line;
    while (std::getline(f, line)) {
        line = trim(line);
        // Skip comments and section headers
        if (line.empty() || line[0] == ';' || line[0] == '#' || line[0] == '[')
            continue;

        auto eq = line.find('=');
        if (eq == std::string::npos) continue;

        std::string key = to_lower(trim(line.substr(0, eq)));
        std::string val = trim(line.substr(eq + 1));

        // Strip inline comments
        auto sc = val.find(';');
        if (sc != std::string::npos) val = trim(val.substr(0, sc));

        m_map[key] = val;
    }
    return true;
}

std::string Config::get(const std::string& key, const std::string& default_val) const {
    auto it = m_map.find(to_lower(key));
    return (it != m_map.end()) ? it->second : default_val;
}

int Config::get_int(const std::string& key, int default_val) const {
    auto it = m_map.find(to_lower(key));
    if (it == m_map.end()) return default_val;
    const std::string& s = it->second;
    if (s.empty()) return default_val;
    char* end = nullptr;
    long v = std::strtol(s.c_str(), &end, 10);
    return (end != s.c_str() && *end == '\0') ? static_cast<int>(v) : default_val;
}

uint32_t Config::get_hex(const std::string& key, uint32_t default_val) const {
    auto it = m_map.find(to_lower(key));
    if (it == m_map.end()) return default_val;
    std::string val = it->second;
    if (val.empty()) return default_val;
    const char* start = val.c_str();
    if (val.size() > 2 && val[0] == '0' && (val[1] == 'x' || val[1] == 'X'))
        start += 2;
    char* end = nullptr;
    unsigned long v = std::strtoul(start, &end, 16);
    return (end != start && *end == '\0') ? static_cast<uint32_t>(v) : default_val;
}

std::string Config::to_lower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c){ return std::tolower(c); });
    return s;
}

std::string Config::trim(const std::string& s) {
    auto start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    auto end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}
