#pragma once
#include <windows.h>

struct CsLock {
    CRITICAL_SECTION& cs;
    CsLock(CRITICAL_SECTION& c) : cs(c) { EnterCriticalSection(&cs); }
    ~CsLock() { LeaveCriticalSection(&cs); }
};
