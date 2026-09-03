// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// i18n
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const i18n = {
  EN: {
    sys_id: "RATS-PTT-001",
    version: "v1.0",
    page_title: "RECIPE AUTOMATED TRANSFER SYSTEM",
    page_subtitle: "SECS/GEM COMMUNICATION CONTROL",
    scan_label: "MACHINE BARCODE / SERIAL",
    scan_placeholder: "Scan or type serial number...",
    scan_hint: "ENTER or scan barcode to query",
    scan_confirm: "IDENTIFY",
    scan_another: "Scan next machine...",
    clear_btn: "RELEASE",
    log_title: "SYSTEM EVENT LOG",
    live_tag: "LIVE",
    clear_log_btn: "PURGE",
    debug_title: "SYSTEM DIAGNOSTICS",
    debug_transport: "TRANSPORT",
    debug_recipe_server: "RECIPE SERVER",
    debug_gem_host: "GEM HOST",
    card_current_program: "LOADED PROGRAM",
    card_new_program: "TARGET PROGRAM",
    card_new_program_placeholder: "Scan or type program name",
    card_link: "LINK",
    card_port: "PORT",
    card_mode: "MODE",
    card_push: "PUSH",
    card_pull: "PULL / SYNC",
    card_check: "CHECK LINK",
    card_pulling: "SYNCING...",
    card_pushing: "PUSHING...",
    card_checking: "CHECKING...",
    card_status_idle: "IDLE",
    card_status_syncing: "SYNCING",
    card_status_pushing: "PUSHING",
    card_status_checking: "CHECKING",
    not_found_title: "MACHINE NOT FOUND",
    not_found_msg: "No machine registered for serial",
    machine_panel: "MACHINE CONTROL",
    awaiting_title: "AWAITING SCAN",
    awaiting_sub: "Point barcode scanner at machine label or enter serial manually",
    no_program: "â€” NO PROGRAM LOADED â€”",
    awaiting_events: "AWAITING SYSTEM EVENTS",
    loading_text: "LOADING...",
    no_recipes: "NO .PWB RECIPES FOUND",
    load_failed: "FAILED TO LOAD",
    events_label: "EVENTS",
    link_online: "ONLINE",
    link_offline: "OFFLINE",
    browse_recipes: "Browse recipes",
  },
  TH: {
    sys_id: "RATS-PTT-001",
    version: "v1.0",
    page_title: "RECIPE AUTOMATED TRANSFER SYSTEM",
    page_subtitle: "à¸£à¸°à¸šà¸šà¸ªà¸·à¹ˆà¸­à¸ªà¸²à¸£ SECS/GEM",
    scan_label: "à¸šà¸²à¸£à¹Œà¹‚à¸„à¹‰à¸” / à¸‹à¸µà¹€à¸£à¸µà¸¢à¸¥à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ˆà¸±à¸à¸£",
    scan_placeholder: "à¸ªà¹à¸à¸™à¸«à¸£à¸·à¸­à¸žà¸´à¸¡à¸žà¹Œà¸«à¸¡à¸²à¸¢à¹€à¸¥à¸‚à¸‹à¸µà¹€à¸£à¸µà¸¢à¸¥...",
    scan_hint: "à¸à¸” ENTER à¸«à¸£à¸·à¸­à¸ªà¹à¸à¸™à¸šà¸²à¸£à¹Œà¹‚à¸„à¹‰à¸”",
    scan_confirm: "à¸£à¸°à¸šà¸¸à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡",
    scan_another: "à¸ªà¹à¸à¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸–à¸±à¸”à¹„à¸›...",
    clear_btn: "à¸¢à¸à¹€à¸¥à¸´à¸",
    log_title: "à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸«à¸•à¸¸à¸à¸²à¸£à¸“à¹Œà¸£à¸°à¸šà¸š",
    live_tag: "à¸ªà¸”",
    clear_log_btn: "à¸¥à¹‰à¸²à¸‡à¸šà¸±à¸™à¸—à¸¶à¸",
    debug_title: "à¸à¸²à¸£à¸§à¸´à¸™à¸´à¸ˆà¸‰à¸±à¸¢à¸£à¸°à¸šà¸š",
    debug_transport: "à¸à¸²à¸£à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸•à¹ˆà¸­",
    debug_recipe_server: "à¹€à¸‹à¸´à¸£à¹Œà¸Ÿà¹€à¸§à¸­à¸£à¹Œà¸ªà¸¹à¸•à¸£",
    debug_gem_host: "GEM HOST",
    card_current_program: "à¹‚à¸›à¸£à¹à¸à¸£à¸¡à¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸”à¸­à¸¢à¸¹à¹ˆ",
    card_new_program: "à¹‚à¸›à¸£à¹à¸à¸£à¸¡à¹€à¸›à¹‰à¸²à¸«à¸¡à¸²à¸¢",
    card_new_program_placeholder: "à¸ªà¹à¸à¸™à¸«à¸£à¸·à¸­à¸žà¸´à¸¡à¸žà¹Œà¸Šà¸·à¹ˆà¸­à¹‚à¸›à¸£à¹à¸à¸£à¸¡",
    card_link: "à¸ªà¸–à¸²à¸™à¸°à¸¥à¸´à¸‡à¸à¹Œ",
    card_port: "à¸žà¸­à¸£à¹Œà¸•",
    card_mode: "à¹‚à¸«à¸¡à¸”",
    card_push: "à¸ªà¹ˆà¸‡à¸ªà¸¹à¸•à¸£",
    card_pull: "à¸”à¸¶à¸‡à¸ªà¸¹à¸•à¸£ / à¸‹à¸´à¸‡à¸„à¹Œ",
    card_check: "à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸¥à¸´à¸‡à¸à¹Œ",
    card_pulling: "à¸à¸³à¸¥à¸±à¸‡à¸‹à¸´à¸‡à¸„à¹Œ...",
    card_pushing: "à¸à¸³à¸¥à¸±à¸‡à¸ªà¹ˆà¸‡...",
    card_checking: "à¸à¸³à¸¥à¸±à¸‡à¹€à¸Šà¹‡à¸„...",
    card_status_idle: "à¸žà¸£à¹‰à¸­à¸¡",
    card_status_syncing: "à¸à¸³à¸¥à¸±à¸‡à¸‹à¸´à¸‡à¸„à¹Œ",
    card_status_pushing: "à¸à¸³à¸¥à¸±à¸‡à¸ªà¹ˆà¸‡",
    card_status_checking: "à¸à¸³à¸¥à¸±à¸‡à¹€à¸Šà¹‡à¸„",
    not_found_title: "à¹„à¸¡à¹ˆà¸žà¸šà¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ˆà¸±à¸à¸£",
    not_found_msg: "à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ˆà¸±à¸à¸£à¸—à¸µà¹ˆà¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸”à¹‰à¸§à¸¢à¸‹à¸µà¹€à¸£à¸µà¸¢à¸¥",
    machine_panel: "à¸„à¸§à¸šà¸„à¸¸à¸¡à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ˆà¸±à¸à¸£",
    awaiting_title: "à¸£à¸­à¸à¸²à¸£à¸ªà¹à¸à¸™",
    awaiting_sub: "à¸Šà¸µà¹‰à¸ªà¹à¸à¸™à¹€à¸™à¸­à¸£à¹Œà¸—à¸µà¹ˆà¸‰à¸¥à¸²à¸à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ˆà¸±à¸à¸£ à¸«à¸£à¸·à¸­à¸žà¸´à¸¡à¸žà¹Œà¸«à¸¡à¸²à¸¢à¹€à¸¥à¸‚à¸‹à¸µà¹€à¸£à¸µà¸¢à¸¥",
    no_program: "â€” à¹„à¸¡à¹ˆà¸¡à¸µà¹‚à¸›à¸£à¹à¸à¸£à¸¡à¸—à¸µà¹ˆà¹‚à¸«à¸¥à¸” â€”",
    awaiting_events: "à¸£à¸­à¹€à¸«à¸•à¸¸à¸à¸²à¸£à¸“à¹Œà¸£à¸°à¸šà¸š",
    loading_text: "à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”...",
    no_recipes: "à¹„à¸¡à¹ˆà¸žà¸šà¹„à¸Ÿà¸¥à¹Œà¸ªà¸¹à¸•à¸£ .PWB",
    load_failed: "à¹‚à¸«à¸¥à¸”à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ",
    events_label: "à¹€à¸«à¸•à¸¸à¸à¸²à¸£à¸“à¹Œ",
    link_online: "à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸•à¹ˆà¸­à¹à¸¥à¹‰à¸§",
    link_offline: "à¸­à¸­à¸Ÿà¹„à¸¥à¸™à¹Œ",
    browse_recipes: "à¹€à¸¥à¸·à¸­à¸à¸ªà¸¹à¸•à¸£",
  },
};

let currentLang = "TH";

function t(key) { return i18n[currentLang][key] || key; }

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (i18n[currentLang][key]) el.textContent = i18n[currentLang][key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (i18n[currentLang][key]) el.placeholder = i18n[currentLang][key];
  });
  // Force full re-render for language change
  machinePanelRenderedId = null;
  renderScanArea();
  renderLeftPanel();
}

document.getElementById("langToggle").addEventListener("click", () => {
  currentLang = currentLang === "EN" ? "TH" : "EN";
  document.getElementById("langLabel").textContent = currentLang;
  applyI18n();
  renderEvents();
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Theme Toggle (Light / Dark)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("rats-theme", theme);

  // Update meta theme-color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content = theme === "dark" ? "#0b0d0f" : "#f4f6f8";
  }
}

// Initialize theme from localStorage (default: light)
(function initTheme() {
  const saved = localStorage.getItem("rats-theme") || "light";
  setTheme(saved);
})();

document.getElementById("themeToggle").addEventListener("click", () => {
  const next = getTheme() === "light" ? "dark" : "light";
  setTheme(next);
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// State
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let activeMachine = null;
let newProgramValue = "";
let events = [];
let pendingRecipes = [];
let socket;
let wsConnected = false;
let wsLabel = "CONNECTING";
let connStatus = "connecting"; // "connecting" | "online" | "polling" | "error"
let pollIntervalId = null;
let scanError = null;
let diagOpen = false;
let dropdownOpen = false;
let lastLeftPanelSnapshot = "";
let lastEventsJson = "";

const scanArea = document.getElementById("scanArea");
const leftPanel = document.getElementById("leftPanel");
const eventLogEl = document.getElementById("eventLog");
const connDot = document.getElementById("connDot");
const connText = document.getElementById("connText");

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Clock
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function updateClock() {
  const time = new Date().toLocaleTimeString("en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  document.getElementById("clock").textContent = time;
  const fc = document.getElementById("footerClock");
  if (fc) fc.textContent = time;
}
updateClock();
setInterval(updateClock, 1000);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Helpers
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

// Strip emoji from messages
function cleanMsg(msg) {
  return String(msg).replace(/[\u{1F000}-\u{1FFFF}]|[\u2600-\u27FF]/gu, "").trim();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Connection Status
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function setConn(status, label) {
  connStatus = status;
  wsLabel = label;

  const dotClass = {
    connecting: "bg-warn pulse-warn",
    online: "bg-ok pulse-ok",
    polling: "bg-warn pulse-warn",
    error: "bg-danger pulse-danger",
  }[status] || "bg-warn pulse-warn";

  const colorClass = {
    connecting: "text-warn",
    online: "text-ok",
    polling: "text-warn",
    error: "text-danger",
  }[status] || "text-warn";

  connDot.className = `conn-dot ${dotClass}`;
  connText.className = `conn-label ${colorClass}`;
  connText.textContent = `WS:${label}`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Scan Area Rendering
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderScanArea() {
  if (activeMachine) {
    scanArea.classList.remove("full-width");
    scanArea.innerHTML = `
      <div class="subbar-scan-active">
        <div class="scan-input" style="min-width:200px">
          <span class="prefix">&gt;_</span>
          <input id="scanInputSmall" type="text"
            data-i18n-placeholder="scan_another"
            placeholder="${escapeHtml(t('scan_another'))}"
            autocomplete="off" />
          <button id="scanConfirmBtnSmall" class="confirm-btn">GO</button>
        </div>
        <button id="clearScanBtn" class="release-btn" data-i18n="clear_btn">${escapeHtml(t('clear_btn'))}</button>
      </div>
    `;
    // Bind events
    const smallInput = document.getElementById("scanInputSmall");
    const smallBtn = document.getElementById("scanConfirmBtnSmall");
    const clearBtn = document.getElementById("clearScanBtn");

    smallInput.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && smallInput.value.trim()) {
        e.preventDefault();
        lookupMachine(smallInput.value.trim());
      }
    });
    smallBtn.addEventListener("click", () => {
      if (smallInput.value.trim()) lookupMachine(smallInput.value.trim());
    });
    clearBtn.addEventListener("click", clearScan);
  } else {
    scanArea.classList.add("full-width");
    scanArea.innerHTML = `
      <div class="scan-input" style="width:100%">
        <span class="prefix">&gt;_</span>
        <input id="scanInputMain" type="text"
          data-i18n-placeholder="scan_placeholder"
          placeholder="${escapeHtml(t('scan_placeholder'))}"
          autocomplete="off" autofocus />
        <button id="scanConfirmBtnMain" class="confirm-btn" data-i18n="scan_confirm">${escapeHtml(t('scan_confirm'))}</button>
      </div>
    `;
    // Bind events
    const mainInput = document.getElementById("scanInputMain");
    const mainBtn = document.getElementById("scanConfirmBtnMain");

    mainInput.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && mainInput.value.trim()) {
        e.preventDefault();
        lookupMachine(mainInput.value.trim());
      }
    });
    mainBtn.addEventListener("click", () => {
      if (mainInput.value.trim()) lookupMachine(mainInput.value.trim());
    });

    // Auto-focus
    setTimeout(() => mainInput.focus(), 50);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Left Panel Rendering
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function renderLeftPanel() {
  if (activeMachine) {
    renderMachinePanel();
  } else {
    renderAwaitingState();
  }
  renderFooterMachineInfo();
}

function renderFooterMachineInfo() {
  const el = document.getElementById("footerMachineInfo");
  if (!el) return;
  if (activeMachine) {
    el.innerHTML = `
      <span class="divider" style="color:var(--border)">|</span>
      <span class="label-xs" style="color:var(--primary)">${escapeHtml(activeMachine.id)}</span>
      <span class="divider" style="color:var(--border)">|</span>
      <span class="label-xs">${escapeHtml(activeMachine.name)}</span>
    `;
  } else {
    el.innerHTML = "";
  }
}

function renderAwaitingState() {
  let errorHtml = "";
  if (scanError) {
    errorHtml = `
      <div class="scan-error-card">
        <p class="error-title">${escapeHtml(t('not_found_title'))}</p>
        <p class="error-msg">${escapeHtml(t('not_found_msg'))}: <span class="error-serial">${escapeHtml(scanError)}</span></p>
      </div>
    `;
  }

  // Diagnostics panel
  const diagContentHtml = diagOpen ? `
    <div class="diag-content">
      <div class="diag-row">
        <span class="diag-key">${escapeHtml(t('debug_transport'))}</span>
        <span class="diag-val ${connStatus === 'online' ? 'text-ok' : 'text-warn'}">WS:${escapeHtml(wsLabel)}</span>
      </div>
      <div class="diag-row">
        <span class="diag-key">${escapeHtml(t('debug_recipe_server'))}</span>
        <span class="diag-val text-ok">ONLINE</span>
      </div>
      <div class="diag-row">
        <span class="diag-key">${escapeHtml(t('debug_gem_host'))}</span>
        <span class="diag-val text-ok">ONLINE</span>
      </div>
    </div>
  ` : "";

  leftPanel.innerHTML = `
    <div class="awaiting-state">
      <!-- Scan target graphic -->
      <div class="scan-target">
        <div class="outer">
          <div class="inner">
            <div class="dot pulse-lime"></div>
          </div>
        </div>
        <span class="corner tl"></span>
        <span class="corner tr"></span>
        <span class="corner bl"></span>
        <span class="corner br"></span>
      </div>

      <div style="text-align:center">
        <p class="await-title">${escapeHtml(t('awaiting_title'))}</p>
        <p class="await-sub">${escapeHtml(t('awaiting_sub'))}</p>
      </div>

      ${errorHtml}

      <!-- System diagnostics panel -->
      <div class="diag-panel">
        <button id="diagToggle" class="diag-toggle">
          <span class="diag-label label-sm text-muted-foreground">
            <svg style="width:14px;height:14px" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            ${escapeHtml(t('debug_title'))}
          </span>
          <svg class="chevron ${diagOpen ? 'open' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        ${diagContentHtml}
      </div>
    </div>
  `;

  // Bind diagnostics toggle
  const diagBtn = document.getElementById("diagToggle");
  if (diagBtn) {
    diagBtn.addEventListener("click", () => {
      diagOpen = !diagOpen;
      renderAwaitingState();
    });
  }
}

// Track whether the machine panel has been fully rendered at least once
let machinePanelRenderedId = null;

function renderMachinePanel() {
  const machine = activeMachine;

  // If the panel already exists for this machine, do an in-place update
  if (machinePanelRenderedId === machine.id && document.getElementById("targetProgramInput")) {
    updateMachinePanelInPlace();
    return;
  }

  // Full render (first time or machine changed)
  machinePanelRenderedId = machine.id;
  fullRenderMachinePanel();
}

// â”€â”€ Surgical in-place update: only touches elements that change â”€â”€
function updateMachinePanelInPlace() {
  const machine = activeMachine;
  const isBusy = machine.status !== "IDLE";
  const loaded = machine.current_program && machine.current_program !== "None"
    ? machine.current_program : null;

  // Status pill
  const statusMap = {
    IDLE: { label: t('card_status_idle'), cls: "idle", dotPulse: "pulse-ok" },
    SYNCING: { label: t('card_status_syncing'), cls: "syncing", dotPulse: "pulse-warn" },
    PUSHING: { label: t('card_status_pushing'), cls: "pushing", dotPulse: "pulse-warn" },
    CHECKING: { label: t('card_status_checking'), cls: "checking", dotPulse: "" },
  };
  const st = statusMap[machine.status] || statusMap.IDLE;

  // Update status pill
  const pill = leftPanel.querySelector(".status-pill");
  if (pill) {
    pill.className = `status-pill ${st.cls}`;
    const dot = pill.querySelector(".dot");
    if (dot) dot.className = `dot ${st.dotPulse}`;
    // Update the text node (the label after the dot)
    const textNodes = Array.from(pill.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
    if (textNodes.length > 0) {
      textNodes[textNodes.length - 1].textContent = `\n            ${st.label}\n          `;
    }
  }

  // Update loaded program display
  const programDisplay = leftPanel.querySelector(".program-display");
  if (programDisplay) {
    programDisplay.className = `program-display ${loaded ? 'loaded' : 'empty'}`;
    programDisplay.textContent = loaded ? loaded : t('no_program');
  }

  // Update loaded program section label (for i18n)
  const programLabel = leftPanel.querySelector(".program-section .label-xs");
  if (programLabel) programLabel.textContent = t('card_current_program');

  // Update link badge
  const linkCell = leftPanel.querySelector(".telemetry-grid .data-cell:first-child .value");
  if (linkCell) {
    if (machine.link_status === "ONLINE") {
      linkCell.innerHTML = `<span class="link-online">${escapeHtml(t('link_online'))}</span>`;
    } else if (machine.link_status === "OFFLINE") {
      linkCell.innerHTML = `<span class="link-offline">${escapeHtml(t('link_offline'))}</span>`;
    } else if (machine.link_status === "CHECKING") {
      linkCell.innerHTML = '<span class="link-checking"><span class="spinner spin"></span><span>...</span></span>';
    } else {
      linkCell.innerHTML = '<span style="color:var(--muted-foreground);font-size:14px;font-family:var(--font-mono)">â€”</span>';
    }
  }

  // Update port value
  const portCell = leftPanel.querySelector(".telemetry-grid .data-cell:nth-child(2) .value");
  if (portCell) portCell.textContent = String(machine.port || 'â€”');

  // Update target input disabled state (do NOT change value â€” user may be typing)
  const targetInput = document.getElementById("targetProgramInput");
  if (targetInput) {
    targetInput.disabled = isBusy;
  }

  // Update dropdown toggle disabled state
  const dropdownToggle = document.getElementById("recipeDropdownToggle");
  if (dropdownToggle) {
    dropdownToggle.disabled = isBusy;
  }

  // Update action buttons
  const checkBtn = document.getElementById("checkMachineBtn");
  const pullBtn = document.getElementById("pullProgramBtn");
  const pushBtn = document.getElementById("pushProgramBtn");

  const checkVariant = isBusy && machine.status === "CHECKING" ? "warn" : !isBusy ? "warn" : "ghost";
  const pullVariant = isBusy && machine.status === "SYNCING" ? "ok" : !isBusy ? "ok" : "ghost";
  const pushVariant = newProgramValue.trim() && !isBusy ? "lime" : "ghost";

  const checkLabel = isBusy && machine.status === "CHECKING" ? t('card_checking') : t('card_check');
  const pullLabel = isBusy && machine.status === "SYNCING" ? t('card_pulling') : t('card_pull');
  const pushLabel = isBusy && machine.status === "PUSHING" ? t('card_pushing') : t('card_push');

  const checkLoading = isBusy && machine.status === "CHECKING";
  const pullLoading = isBusy && machine.status === "SYNCING";
  const pushLoading = isBusy && machine.status === "PUSHING";

  if (checkBtn) {
    checkBtn.className = `cmd-btn ${checkVariant}`;
    checkBtn.disabled = isBusy;
    checkBtn.innerHTML = (checkLoading ? '<span class="btn-spinner spin"></span>' : '') + escapeHtml(checkLabel);
  }
  if (pullBtn) {
    pullBtn.className = `cmd-btn ${pullVariant}`;
    pullBtn.disabled = isBusy;
    pullBtn.innerHTML = (pullLoading ? '<span class="btn-spinner spin"></span>' : '') + escapeHtml(pullLabel);
  }
  if (pushBtn) {
    pushBtn.className = `cmd-btn ${pushVariant}`;
    pushBtn.disabled = !newProgramValue.trim() || isBusy;
    pushBtn.innerHTML = (pushLoading ? '<span class="btn-spinner spin"></span>' : '') + escapeHtml(pushLabel);
  }

  // Update faceplate header info (for i18n or machine change)
  const faceplateLabel = leftPanel.querySelector(".machine-faceplate .label-xs");
  if (faceplateLabel) faceplateLabel.textContent = `${t('machine_panel')} // ${machine.id}`;
  const nameEl = leftPanel.querySelector(".machine-faceplate .name");
  if (nameEl) nameEl.textContent = machine.name;
  const addrEl = leftPanel.querySelector(".machine-faceplate .addr");
  if (addrEl) addrEl.textContent = `${machine.ip || 'â€”'}:${String(machine.port || 'â€”')}`;
}

// â”€â”€ Full innerHTML render (first time only or when machine changes) â”€â”€
function fullRenderMachinePanel() {
  const machine = activeMachine;
  const isBusy = machine.status !== "IDLE";
  const loaded = machine.current_program && machine.current_program !== "None"
    ? machine.current_program : null;

  // Status pill
  const statusMap = {
    IDLE: { label: t('card_status_idle'), cls: "idle", dotPulse: "pulse-ok" },
    SYNCING: { label: t('card_status_syncing'), cls: "syncing", dotPulse: "pulse-warn" },
    PUSHING: { label: t('card_status_pushing'), cls: "pushing", dotPulse: "pulse-warn" },
    CHECKING: { label: t('card_status_checking'), cls: "checking", dotPulse: "" },
  };
  const st = statusMap[machine.status] || statusMap.IDLE;

  // Link badge
  let linkHtml = '<span style="color:var(--muted-foreground);font-size:14px;font-family:var(--font-mono)">â€”</span>';
  if (machine.link_status === "ONLINE") {
    linkHtml = `<span class="link-online">${escapeHtml(t('link_online'))}</span>`;
  } else if (machine.link_status === "OFFLINE") {
    linkHtml = `<span class="link-offline">${escapeHtml(t('link_offline'))}</span>`;
  } else if (machine.link_status === "CHECKING") {
    linkHtml = '<span class="link-checking"><span class="spinner spin"></span><span>...</span></span>';
  }

  // Button variants
  const checkVariant = isBusy && machine.status === "CHECKING" ? "warn" : !isBusy ? "warn" : "ghost";
  const pullVariant = isBusy && machine.status === "SYNCING" ? "ok" : !isBusy ? "ok" : "ghost";
  const pushVariant = newProgramValue.trim() && !isBusy ? "lime" : "ghost";

  const checkLabel = isBusy && machine.status === "CHECKING" ? t('card_checking') : t('card_check');
  const pullLabel = isBusy && machine.status === "SYNCING" ? t('card_pulling') : t('card_pull');
  const pushLabel = isBusy && machine.status === "PUSHING" ? t('card_pushing') : t('card_push');

  const checkLoading = isBusy && machine.status === "CHECKING";
  const pullLoading = isBusy && machine.status === "SYNCING";
  const pushLoading = isBusy && machine.status === "PUSHING";

  leftPanel.innerHTML = `
    <div class="machine-panel">
      <!-- Faceplate header -->
      <div class="machine-faceplate">
        <div class="accent-bar"></div>
        <div class="info">
          <div>
            <p class="label-xs" style="margin-bottom:4px">${escapeHtml(t('machine_panel'))} // ${escapeHtml(machine.id)}</p>
            <h2 class="name">${escapeHtml(machine.name)}</h2>
            <p class="addr">${escapeHtml(machine.ip || 'â€”')}:${escapeHtml(String(machine.port || 'â€”'))}</p>
          </div>
          <span class="status-pill ${st.cls}">
            <span class="dot ${st.dotPulse}"></span>
            ${st.label}
          </span>
        </div>
      </div>

      <!-- Body -->
      <div class="machine-body">

        <!-- Loaded program -->
        <div class="program-section">
          <p class="label-xs" style="margin-bottom:8px">${escapeHtml(t('card_current_program'))}</p>
          <div class="program-display ${loaded ? 'loaded' : 'empty'}">
            ${loaded ? escapeHtml(loaded) : escapeHtml(t('no_program'))}
          </div>
        </div>

        <!-- Target program -->
        <div class="target-section">
          <label class="label-xs" style="margin-bottom:8px;display:block">${escapeHtml(t('card_new_program'))}</label>
          <div class="target-input-wrapper">
            <div class="target-input-row ${dropdownOpen ? 'dropdown-open' : ''}">
              <span class="input-prefix">&gt;</span>
              <input id="targetProgramInput" type="text"
                value="${escapeHtml(newProgramValue)}"
                placeholder="${escapeHtml(t('card_new_program_placeholder'))}"
                autocomplete="off"
                ${isBusy ? 'disabled' : ''} />
              <button id="recipeDropdownToggle" class="dropdown-toggle ${dropdownOpen ? 'open' : ''}"
                title="${escapeHtml(t('browse_recipes'))}" ${isBusy ? 'disabled' : ''}>
                <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
            <div id="recipeDropdownMenu" class="recipe-dropdown" style="${dropdownOpen ? '' : 'display:none'}">
              <div class="loading">
                <span class="spinner spin" style="width:12px;height:12px;border:1px solid rgba(90,98,112,.3);border-top-color:var(--muted-foreground);border-radius:50%"></span>
                ${escapeHtml(t('loading_text'))}
              </div>
            </div>
          </div>
        </div>

        <!-- Telemetry grid -->
        <div class="telemetry-grid">
          <div class="data-cell">
            <span class="label-xs">${escapeHtml(t('card_link'))}</span>
            <div class="value">${linkHtml}</div>
          </div>
          <div class="data-cell">
            <span class="label-xs">${escapeHtml(t('card_port'))}</span>
            <div class="value" style="color:var(--foreground)">${escapeHtml(String(machine.port || 'â€”'))}</div>
          </div>
          <div class="data-cell">
            <span class="label-xs">${escapeHtml(t('card_mode'))}</span>
            <div class="value" style="color:var(--primary)">AUTO</div>
          </div>
        </div>

      </div>

      <!-- Action strip -->
      <div class="action-strip">
        <button id="checkMachineBtn" class="cmd-btn ${checkVariant}" ${isBusy ? 'disabled' : ''}>
          ${checkLoading ? '<span class="btn-spinner spin"></span>' : ''}${escapeHtml(checkLabel)}
        </button>
        <button id="pullProgramBtn" class="cmd-btn ${pullVariant}" ${isBusy ? 'disabled' : ''}>
          ${pullLoading ? '<span class="btn-spinner spin"></span>' : ''}${escapeHtml(pullLabel)}
        </button>
        <button id="pushProgramBtn" class="cmd-btn ${pushVariant}" ${!newProgramValue.trim() || isBusy ? 'disabled' : ''}>
          ${pushLoading ? '<span class="btn-spinner spin"></span>' : ''}${escapeHtml(pushLabel)}
        </button>
      </div>
    </div>
  `;

  // â”€â”€ Bind machine panel events â”€â”€
  bindMachinePanelEvents();
}

// â”€â”€ Bind all interactive event handlers for the machine panel â”€â”€
function bindMachinePanelEvents() {
  const machine = activeMachine;
  const isBusy = machine.status !== "IDLE";

  // Target program input
  const targetInput = document.getElementById("targetProgramInput");
  const pushBtn = document.getElementById("pushProgramBtn");
  const pullBtn = document.getElementById("pullProgramBtn");
  const checkBtn = document.getElementById("checkMachineBtn");

  if (targetInput) {
    targetInput.addEventListener("input", () => {
      newProgramValue = targetInput.value;
      refreshPushButton();
    });
    targetInput.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && targetInput.value.trim()) {
        e.preventDefault();
        pushProgram(machine.id, targetInput.value.trim());
      }
    });
  }

  // Push button refresh
  function refreshPushButton() {
    const hasProgram = newProgramValue.trim().length > 0 && !isBusy;
    pushBtn.disabled = !hasProgram;
    pushBtn.className = `cmd-btn ${hasProgram ? 'lime' : 'ghost'}`;
  }

  if (pushBtn) {
    pushBtn.addEventListener("click", () => {
      if (newProgramValue.trim()) pushProgram(machine.id, newProgramValue.trim());
    });
  }
  if (pullBtn) {
    pullBtn.addEventListener("click", () => pullProgram(machine.id));
  }
  if (checkBtn) {
    checkBtn.addEventListener("click", () => checkMachine(machine.id));
  }

  // Recipe dropdown
  const dropdownToggle = document.getElementById("recipeDropdownToggle");
  const dropdownMenu = document.getElementById("recipeDropdownMenu");

  if (dropdownToggle && dropdownMenu) {
    dropdownToggle.addEventListener("click", async (e) => {
      e.stopPropagation();
      dropdownOpen = !dropdownOpen;
      if (dropdownOpen) {
        dropdownMenu.style.display = "";
        dropdownToggle.classList.add("open");
        document.querySelector(".target-input-row").classList.add("dropdown-open");
        await fetchMachineRecipes(machine.id, dropdownMenu);
      } else {
        dropdownMenu.style.display = "none";
        dropdownToggle.classList.remove("open");
        document.querySelector(".target-input-row").classList.remove("dropdown-open");
      }
    });

    // Close on outside click
    document.addEventListener("mousedown", (e) => {
      const wrapper = document.querySelector(".target-input-wrapper");
      if (wrapper && !wrapper.contains(e.target)) {
        dropdownOpen = false;
        dropdownMenu.style.display = "none";
        dropdownToggle.classList.remove("open");
        const row = document.querySelector(".target-input-row");
        if (row) row.classList.remove("dropdown-open");
      }
    });
  }
}

// â”€â”€ Fetch recipes for dropdown â”€â”€
async function fetchMachineRecipes(machineId, menuEl) {
  menuEl.innerHTML = `
    <div class="loading">
      <span class="spinner spin" style="width:12px;height:12px;border:1px solid rgba(90,98,112,.3);border-top-color:var(--muted-foreground);border-radius:50%"></span>
      ${escapeHtml(t('loading_text'))}
    </div>
  `;
  try {
    const res = await fetch(`/api/machines/${encodeURIComponent(machineId)}/recipes`);
    const data = await res.json();
    const recipes = data.recipes || [];
    if (recipes.length === 0) {
      menuEl.innerHTML = `<div class="empty">${escapeHtml(t('no_recipes'))}</div>`;
      return;
    }
    menuEl.innerHTML = "";
    recipes.forEach((name) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "recipe-item";
      btn.textContent = name;
      btn.addEventListener("click", () => {
        const input = document.getElementById("targetProgramInput");
        if (input) {
          input.value = name;
          newProgramValue = name;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
        }
        dropdownOpen = false;
        menuEl.style.display = "none";
        const toggle = document.getElementById("recipeDropdownToggle");
        if (toggle) toggle.classList.remove("open");
        const row = document.querySelector(".target-input-row");
        if (row) row.classList.remove("dropdown-open");
      });
      menuEl.appendChild(btn);
    });
  } catch (err) {
    console.error("Failed to fetch recipes:", err);
    menuEl.innerHTML = `<div class="empty">${escapeHtml(t('load_failed'))}</div>`;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Terminal Event Log Rendering
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function renderEvents() {
  const evJson = JSON.stringify(events) + currentLang;
  if (evJson === lastEventsJson) return;
  lastEventsJson = evJson;

  // Update footer event count
  const fc = document.getElementById("footerEventCount");
  if (fc) fc.textContent = `${events.length} ${t('events_label')}`;

  let html = '';

  // Column header
  html += `
    <div class="terminal-col-header">
      <span class="col-num">#</span>
      <span class="col-time">TIME</span>
      <span class="col-level">LEVEL</span>
      <span>MESSAGE</span>
    </div>
  `;

  if (events.length === 0) {
    html += `
      <div class="terminal-empty">
        <span style="color:var(--primary)" class="blink">_</span>
        <span>${escapeHtml(t('awaiting_events'))}</span>
      </div>
    `;
  } else {
    events.forEach((ev, i) => {
      const ts = ev.timestamp
        ? new Date(ev.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : new Date().toLocaleTimeString("en-US", { hour12: false });

      const colorMap = {
        ALERT: "#f43f5e",
        SUCCESS: "#4ade80",
        WARN: "#fbbf24",
        INFO: "#5a6270",
      };
      const color = colorMap[ev.level] || "#5a6270";

      const prefixMap = {
        ALERT: "ERR ",
        SUCCESS: "OK  ",
        WARN: "WARN",
        INFO: "INFO",
      };
      const prefix = prefixMap[ev.level] || "INFO";

      const lineNum = String(i + 1).padStart(3, " ");
      const msgData = ev.message;
      let msgStr = typeof msgData === "object" && msgData !== null
        ? (msgData[currentLang] || msgData.EN || "")
        : String(msgData);
      const msg = cleanMsg(msgStr);

      html += `
        <div class="terminal-line">
          <span class="line-num">${lineNum}</span>
          <span class="line-time">${escapeHtml(ts)}</span>
          <span class="line-level" style="color:${color}">[${prefix}]</span>
          <span class="line-msg">${escapeHtml(msg)}</span>
        </div>
      `;
    });
  }

  // Blinking cursor at end
  html += `
    <div class="terminal-cursor">
      <span class="blink">_</span>
    </div>
  `;

  eventLogEl.innerHTML = html;
  eventLogEl.scrollTop = eventLogEl.scrollHeight;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UI State Transitions
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function clearScan() {
  activeMachine = null;
  newProgramValue = "";
  scanError = null;
  diagOpen = false;
  dropdownOpen = false;
  lastLeftPanelSnapshot = "";
  machinePanelRenderedId = null;
  renderScanArea();
  renderLeftPanel();
  setTimeout(() => {
    const mainInput = document.getElementById("scanInputMain");
    if (mainInput) mainInput.focus();
  }, 50);
}

function showMachineMode(machine) {
  activeMachine = machine;
  newProgramValue = "";
  scanError = null;
  dropdownOpen = false;
  lastLeftPanelSnapshot = "";
  machinePanelRenderedId = null;
  renderScanArea();
  renderLeftPanel();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// API Calls
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function lookupMachine(serial) {
  const trimmed = serial.trim();
  if (!trimmed) return;
  scanError = null;

  try {
    const res = await fetch(`/api/lookup/${encodeURIComponent(trimmed)}`);
    const data = await res.json();
    if (res.ok) {
      events = data.events || [];
      showMachineMode(data.machine);
      renderEvents();
    } else {
      events = data.events || events;
      scanError = trimmed;
      activeMachine = null;
      renderScanArea();
      renderLeftPanel();
      renderEvents();
    }
  } catch (err) {
    console.error("Lookup failed:", err);
  }
}

async function checkMachine(machineId) {
  if (!activeMachine) return;
  activeMachine.status = "CHECKING";
  renderMachinePanel();

  try {
    const res = await fetch(`/api/machines/${encodeURIComponent(machineId)}/check`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      activeMachine = data.machine;
      events = data.events || [];
      renderMachinePanel();
      renderEvents();
    } else {
      activeMachine.status = "IDLE";
      renderMachinePanel();
    }
  } catch (err) {
    console.error("Check failed:", err);
    activeMachine.status = "IDLE";
    renderMachinePanel();
  }
}

async function pullProgram(machineId) {
  if (!activeMachine) return;
  activeMachine.status = "SYNCING";
  renderMachinePanel();

  try {
    const res = await fetch(`/api/machines/${encodeURIComponent(machineId)}/pull`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      activeMachine = data.machine;
      events = data.events || [];
      renderMachinePanel();
      renderEvents();
    } else {
      activeMachine.status = "IDLE";
      renderMachinePanel();
    }
  } catch (err) {
    console.error("Pull failed:", err);
    activeMachine.status = "IDLE";
    renderMachinePanel();
  }
}

async function pushProgram(machineId, programName) {
  if (!activeMachine || !programName) return;
  activeMachine.status = "PUSHING";
  renderMachinePanel();

  try {
    const res = await fetch(`/api/machines/${encodeURIComponent(machineId)}/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program_name: programName }),
    });
    const data = await res.json();
    if (res.ok) {
      activeMachine = data.machine;
      newProgramValue = "";
      events = data.events || [];
      renderMachinePanel();
      renderEvents();
    } else {
      activeMachine.status = "IDLE";
      renderMachinePanel();
    }
  } catch (err) {
    console.error("Push failed:", err);
    activeMachine.status = "IDLE";
    renderMachinePanel();
  }
}

async function fetchStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    events = data.events || [];
    pendingRecipes = data.pending_recipes || [];
    renderPendingAlerts();
    renderEvents();
    if (activeMachine) {
      const updated = data.machines.find(m => m.id === activeMachine.id);
      if (updated) {
        activeMachine = updated;
        renderMachinePanel();
      }
    }
  } catch (err) {
    console.error("Status fetch failed:", err);
  }
}

// Clear log
const clearLogBtn = document.getElementById("clearLogBtn");
if (clearLogBtn) {
  clearLogBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/logs/clear", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        events = data.events || [];
        lastEventsJson = "";
        renderEvents();
      }
    } catch (err) {
      console.error("Failed to clear log:", err);
    }
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WebSocket
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function startPolling() {
  stopPolling();
  pollIntervalId = setInterval(fetchStatus, 10000);
}

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

function connectWS() {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${scheme}://${location.host}/ws`);

  socket.addEventListener("open", () => {
    setConn("online", "ONLINE");
    wsConnected = true;
    stopPolling();
  });

  socket.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);
    events = data.events || [];
    pendingRecipes = data.pending_recipes || [];
    renderPendingAlerts();
    renderEvents();
    if (activeMachine) {
      const updated = data.machines.find(m => m.id === activeMachine.id);
      if (updated) {
        activeMachine = updated;
        renderMachinePanel();
      }
    }
  });

  socket.addEventListener("close", () => {
    setConn("polling", "POLLING");
    wsConnected = false;
    startPolling();
    setTimeout(connectWS, 2000);
  });

  socket.addEventListener("error", () => {
    setConn("error", "ERROR");
    socket.close();
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Init
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
applyI18n();
renderScanArea();
renderLeftPanel();
renderEvents();
connectWS();
fetchStatus();
startPolling();



async function approveRecipe(recipeName) {
  try {
    const res = await fetch('/api/recipes/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_name: recipeName })
    });
    if (!res.ok) console.error('Approve failed');
  } catch (err) { console.error(err); }
}

async function rejectRecipe(recipeName) {
  try {
    const res = await fetch('/api/recipes/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_name: recipeName })
    });
    if (!res.ok) console.error('Reject failed');
  } catch (err) { console.error(err); }
}

function renderPendingAlerts() {
  let container = document.getElementById('pendingAlertArea');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pendingAlertArea';
    const split = document.querySelector('.body-split');
    if (split) { split.parentNode.insertBefore(container, split); }
  }
  
  if (!pendingRecipes || pendingRecipes.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  let html = '';
  pendingRecipes.forEach(recipe => {
    html += `
      <div style="background-color: var(--warn); color: var(--warn-foreground); padding: 12px 16px; margin-bottom: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div>
          <strong>Duplicate Recipe Detected:</strong> ${escapeHtml(recipe)} already exists on the Host.
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="approveRecipe('${escapeHtml(recipe)}')" style="background-color: var(--ok); color: var(--ok-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Approve Update</button>
          <button onclick="rejectRecipe('${escapeHtml(recipe)}')" style="background-color: var(--error); color: var(--error-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Reject</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}
