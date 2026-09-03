#pragma once
#include <string>
#include <unordered_map>
#include <cstdint>

// Simple INI-file reader.
// Sections are ignored (all keys are global). Keys are case-insensitive.
class Config {
public:
    // Load from file. Returns true on success.
    bool load(const std::string& path);

    std::string get(const std::string& key, const std::string& default_val = "") const;
    int         get_int(const std::string& key, int default_val = 0) const;
    uint32_t    get_hex(const std::string& key, uint32_t default_val = 0) const;

private:
    std::unordered_map<std::string, std::string> m_map;

    static std::string to_lower(std::string s);
    static std::string trim(const std::string& s);
};
