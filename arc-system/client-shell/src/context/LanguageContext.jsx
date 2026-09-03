import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const TRANSLATIONS = {
  TH: {
    // Navbar
    mems_dashboard: 'แดชบอร์ด MEMS',
    rats_command: 'ระบบ RATS',
    system_status: 'สถานะระบบ',
    role: 'สิทธิ์: ',
    guest: 'ผู้เยี่ยมชม (Guest)',
    operator: 'พนักงานปฏิบัติการ (Operator)',
    technician: 'ช่างเทคนิค (Technician)',
    administrator: 'ผู้ดูแลระบบ (Admin)',
    developer: 'นักพัฒนา (Developer)',
    switch_lang: 'ภาษา',

    // RATS View
    rats_header_title: 'ควบคุมระบบโอนย้ายสูตร RATS',
    rats_sub_title: 'ระบบส่งถ่ายสูตรการผลิตอัตโนมัติสำหรับเครื่องเชื่อมสายทอง',
    python_online: 'ระบบ PYTHON ออนไลน์',
    python_offline: 'ระบบ PYTHON ออฟไลน์',
    rats_offline_banner: 'ระบบ RATS Python ออฟไลน์อยู่: กรุณาเปิดไฟล์ start_command_center.bat หรือ python client-rats/main.py เพื่อเชื่อมต่อเครื่องจักร',
    scan_placeholder: 'สแกนบาร์โค้ด / ซีเรียลนัมเบอร์',
    scan_btn: 'สแกน',
    bonder_fleet: 'รายการเครื่อง Wire Bonder',
    production_section: 'ส่วนการผลิต',
    wb_advanced_section: 'WB – ไลน์ผลิต Advanced',
    ic_wire_bond_section: 'IC – Wire Bond',
    unassigned_section: 'เครื่องที่ยังไม่กำหนดไลน์',
    section_event_log: 'บันทึกเหตุการณ์ประจำส่วนการผลิต',
    factory_map: 'แผนผังเครื่องจักร',
    factory_map_hint: 'กดที่เครื่องจักรเพื่อเปิดรายละเอียด หรือสแกน QR ด้านบน',
    schematic_map: 'แผนผังตำแหน่งเบื้องต้น',
    expand_machine: 'เปิดรายละเอียดเครื่อง',
    collapse_details: 'ปิดรายละเอียด',
    guest_read_only_title: 'โหมด Guest',
    guest_read_only_message: 'ดูแผนผังและสถานะเครื่องจักรได้ แต่ไม่มีสิทธิ์สั่งงานเครื่อง',
    access_insufficient: 'สิทธิ์การเข้าถึงไม่เพียงพอ กรุณาเข้าสู่ระบบเพื่อสั่งงานเครื่องจักร',
    machines_count: ' เครื่อง',
    selected_machine: 'เครื่องที่เลือก: ',
    protocol_hsms: 'การเชื่อมต่อ: แอคทีฟ',
    machine_status: 'สถานะเครื่องจักร',
    bot_status: 'สถานะ Recipe Bot',
    current_recipe: 'สูตรการผลิตปัจจุบัน',
    link_status: 'สถานะการเชื่อมต่อ',
    test_link: '1. ทดสอบการเชื่อมต่อ',
    pull_recipe: '2. ดึงสูตรการผลิต',
    push_recipe: '3. ส่งสูตรการผลิต',
    push_req_permission: 'จำเป็นต้องเข้าสู่ระบบด้วยสิทธิ์พนักงานปฏิบัติการ (Operator) ขึ้นไป เพื่อส่งสูตรการผลิต',
    target_push: 'สูตรการผลิตที่จะส่งไปยังเครื่อง:',
    custom_recipe_placeholder: 'หรือพิมพ์ชื่อสูตรที่ต้องการ...',
    event_log_title: 'บันทึกเหตุการณ์ระบบ (ตรวจสอบแบบเรียลไทม์)',
    purge_log: 'ล้างบันทึก',
    no_logs: 'ยังไม่มีบันทึกเหตุการณ์',
    deploy_bot_title: 'ส่งไฟล์ Recipe Bot ไปยังเครื่อง',
    deploy_bot_description: 'ส่ง secs_proxy_bot.exe และ config.ini ผ่าน TCP โดยตรงไปยัง Deployment Receiver ของเครื่องที่เลือก',
    deploy_send_button: 'ส่งไฟล์ไปยังเครื่อง',
    deploy_sending: 'กำลังส่งไฟล์',
    deploy_complete: 'ส่งไฟล์สำเร็จไปยัง',
    deploy_failed: 'ส่งไฟล์ไม่สำเร็จ',
    deploy_select_required: 'กรุณาเลือก secs_proxy_bot.exe หรือ config.ini ก่อน',
    deploy_only_allowed_files: 'อนุญาตเฉพาะไฟล์ชื่อ secs_proxy_bot.exe และ config.ini เท่านั้น',

    // MEMS View
    mems_title: 'แดชบอร์ดประสิทธิภาพเครื่องจักร MEMS',
    mems_sub: 'ระบบติดตาม OEE ประสิทธิภาพ และสถานะการทำงานแบบเรียลไทม์',
    oee_overall: 'ภาพรวม OEE',
    active_machines: 'เครื่องจักรที่ทำงานอยู่',
    total_output: 'ผลผลิตรวม',

    // System View
    system_title: 'สถานะและการตั้งค่าระบบ ARC',
    security_level: 'ระดับความปลอดภัยและสิทธิ์การใช้งาน',
    roles_permissions: 'ตารางสิทธิ์ผู้ใช้งาน',

    // Common
    online: 'ออนไลน์',
    offline: 'ออฟไลน์',
    checking: 'กำลังตรวจสอบ...',
    unchecked: 'ยังไม่ได้ตรวจสอบ',
    none: 'ไม่มี',

    // Logoff Modal
    logoff_title: 'ยืนยันการออกจากระบบ',
    logoff_confirm_text: 'คุณต้องการออกจากระบบและกลับสู่โหมดผู้เยี่ยมชม (Guest) หรือไม่?',
    cancel: 'ยกเลิก',
    confirm_logoff: 'ยืนยันออกจากระบบ',

    // Popup modals
    logoff_question: 'ออกจากสิทธิ์ผู้ใช้ปัจจุบันหรือไม่?',
    logoff_role_text: 'ขณะนี้คุณเข้าสู่ระบบด้วยสิทธิ์',
    logoff_return_guest: 'คุณต้องการออกจากระบบและกลับสู่โหมดผู้เยี่ยมชมหรือไม่?',
    login_title: 'เข้าสู่ระบบ',
    authorization_required: 'จำเป็นต้องยืนยันสิทธิ์',
    role_or_higher: 'ขึ้นไป',
    username: 'ชื่อผู้ใช้',
    username_placeholder: 'กรอกชื่อผู้ใช้',
    employee_number: 'รหัสพนักงาน (Employee Number)',
    employee_number_placeholder: 'กรอกรหัสพนักงาน เช่น 32340',
    employee_number_required: 'กรุณากรอกรหัสพนักงานก่อนเข้าสู่ระบบ',
    password: 'รหัสผ่าน',
    password_placeholder: 'กรอกรหัสผ่าน',
    login: 'เข้าสู่ระบบ',
    invalid_credentials: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
    login_server_unavailable: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เข้าสู่ระบบได้',
    session_expired: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
    recipe_update_title: 'ต้องอนุมัติการอัปเดตสูตร',
    recipe_update_description: 'สูตรที่ Recipe Bot ส่งมามี PPID เดียวกับสูตรในโฮสต์ แต่เนื้อหาไฟล์แตกต่างกัน',
    machine: 'เครื่องจักร',
    machine_file: 'ไฟล์จากเครื่องจักร',
    host_file: 'ไฟล์ในโฮสต์',
    incoming_size: 'ขนาดไฟล์ใหม่',
    current_size: 'ขนาดไฟล์ปัจจุบัน',
    bytes: 'ไบต์',
    recipe_update_explanation: 'เมื่อยอมรับ ระบบจะเก็บไฟล์เดิมไว้ในคลังก่อนติดตั้งไฟล์ใหม่ หากปฏิเสธ สูตรเดิมในโฮสต์จะไม่เปลี่ยนแปลง',
    update_auth_required: 'ต้องใช้สิทธิ์ช่างเทคนิคหรือผู้ดูแลระบบเพื่อตัดสินใจการอัปเดตนี้',
    reject_update: 'ปฏิเสธการอัปเดต',
    accept_update: 'ยอมรับการอัปเดต',
    processing: 'กำลังดำเนินการ…',
    confirm_deletion: 'ยืนยันการลบ',
    delete_recipe_question: 'ลบสูตรนี้หรือไม่?',
    delete_recipe_text_before: 'คุณแน่ใจหรือไม่ว่าต้องการลบสูตร',
    delete_recipe_text_after: 'ออกจากเครื่องอย่างถาวร? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
    confirm_delete: 'ยืนยันการลบ',
    recipe_not_found: 'ไม่พบสูตร',
    recipe_not_found_before: 'ไม่พบสูตร',
    recipe_not_found_after: 'ในระบบ แต่พบสูตรที่มีชื่อใกล้เคียงกันบนเซิร์ฟเวอร์',
    did_you_mean: 'คุณหมายถึง:',
    accept_and_push: 'ยอมรับและส่งสูตร',
    session_timeout_title: 'เซสชันกำลังจะหมดอายุ',
    session_timeout_message: 'ระบบจะออกจากระบบอัตโนมัติเนื่องจากไม่มีการใช้งานในอีก',
    seconds: 'วินาที',
    session_timeout_help: 'กดปุ่มด้านล่างเพื่อคงสถานะการเข้าสู่ระบบ',
    stay_signed_in: 'คงสถานะการเข้าสู่ระบบ',
    guest_auth_title: 'จำเป็นต้องยืนยันสิทธิ์',
    guest_auth_access_before: 'การเข้าใช้งาน',
    guest_auth_access_after: 'จำเป็นต้องเข้าสู่ระบบด้วยสิทธิ์ที่ได้รับอนุญาต',
    guest_auth_instruction: 'กรุณาเข้าสู่ระบบด้วยข้อมูลประจำตัวที่ได้รับอนุญาตเพื่อดำเนินการต่อ',
    login_authenticate: 'เข้าสู่ระบบ / ยืนยันสิทธิ์',
  },
  EN: {
    // Navbar
    mems_dashboard: 'MEMS DASHBOARD',
    rats_command: 'RATS COMMAND',
    system_status: 'SYSTEM STATUS',
    role: 'ROLE: ',
    guest: 'Guest',
    operator: 'Operator',
    technician: 'Technician',
    administrator: 'Administrator',
    developer: 'Developer',
    switch_lang: 'Language',

    // RATS View
    rats_header_title: 'RATS Recipe Control',
    rats_sub_title: 'Recipe Automated Transfer System for Wire Bonder Fleet',
    python_online: 'PYTHON BACKEND ONLINE',
    python_offline: 'PYTHON BACKEND OFFLINE',
    rats_offline_banner: 'RATS Python Engine is offline: Start the backend server by running start_command_center.bat or python client-rats/main.py to connect to live wire bonders.',
    scan_placeholder: 'Scan Barcode / Serial Number',
    scan_btn: 'SCAN',
    bonder_fleet: 'WIRE BONDER FLEET',
    production_section: 'PRODUCTION SECTION',
    wb_advanced_section: 'WB – ADVANCED LINE',
    ic_wire_bond_section: 'IC – WIRE BOND',
    unassigned_section: 'UNASSIGNED MACHINES',
    section_event_log: 'PRODUCTION SECTION EVENT LOG',
    factory_map: 'MACHINE FLOOR MAP',
    factory_map_hint: 'Select a machine to expand its details, or scan its QR code above.',
    schematic_map: 'SCHEMATIC LAYOUT',
    expand_machine: 'EXPAND MACHINE',
    collapse_details: 'COLLAPSE DETAILS',
    guest_read_only_title: 'GUEST MODE',
    guest_read_only_message: 'Machine maps and status are visible, but machine commands are locked.',
    access_insufficient: 'Access level is insufficient. Sign in to operate this machine.',
    machines_count: ' MACHINES',
    selected_machine: 'SELECTED MACHINE: ',
    protocol_hsms: 'Connection: Active',
    machine_status: 'MACHINE STATUS',
    bot_status: 'RECIPE BOT STATUS',
    current_recipe: 'CURRENT RECIPE PROGRAM',
    link_status: 'LINK STATUS',
    test_link: '1. TEST LINK',
    pull_recipe: '2. PULL RECIPE',
    push_recipe: '3. PUSH RECIPE',
    push_req_permission: 'Operator role or higher required to execute Recipe Push.',
    target_push: 'Target Recipe Program to Push:',
    custom_recipe_placeholder: 'Or type custom program name...',
    event_log_title: 'SYSTEM EVENT LOG (REAL TIME AUDIT)',
    purge_log: 'PURGE LOG',
    no_logs: 'No event logs recorded yet.',
    deploy_bot_title: 'DEPLOY RECIPE BOT FILES',
    deploy_bot_description: 'Send secs_proxy_bot.exe and config.ini directly to the selected machine TCP Deployment Receiver.',
    deploy_send_button: 'SEND FILES TO MACHINE',
    deploy_sending: 'SENDING',
    deploy_complete: 'Deployment completed for',
    deploy_failed: 'Deployment failed',
    deploy_select_required: 'Select secs_proxy_bot.exe or config.ini first.',
    deploy_only_allowed_files: 'Only files named secs_proxy_bot.exe and config.ini are allowed.',

    // MEMS View
    mems_title: 'MEMS Machine Efficiency Monitor',
    mems_sub: 'Real-time OEE, Equipment Efficiency & Operation Telemetry',
    oee_overall: 'OVERALL OEE',
    active_machines: 'ACTIVE MACHINES',
    total_output: 'TOTAL OUTPUT',

    // System View
    system_title: 'ARC System Status & Configuration',
    security_level: 'Security Level & Access Control',
    roles_permissions: 'ROLES & PERMISSIONS TABLE',

    // Common
    online: 'ONLINE',
    offline: 'OFFLINE',
    checking: 'CHECKING...',
    unchecked: 'UNCHECKED',
    none: 'None',

    // Logoff Modal
    logoff_title: 'LOGOFF CONFIRMATION',
    logoff_confirm_text: 'Are you sure you want to log off and return to Guest mode?',
    cancel: 'CANCEL',
    confirm_logoff: 'CONFIRM LOGOFF',

    // Popup modals
    logoff_question: 'Log off current role?',
    logoff_role_text: 'You are currently logged in as',
    logoff_return_guest: 'Are you sure you want to log off and return to Guest mode?',
    login_title: 'SYSTEM LOGIN',
    authorization_required: 'Authorization required',
    role_or_higher: 'level or higher',
    username: 'Username',
    username_placeholder: 'Enter username',
    employee_number: 'Employee Number',
    employee_number_placeholder: 'Enter employee number, e.g. 32340',
    employee_number_required: 'Employee Number is required before login.',
    password: 'Password',
    password_placeholder: 'Enter password',
    login: 'LOGIN',
    invalid_credentials: 'Invalid username or password',
    login_server_unavailable: 'Login server unavailable',
    session_expired: 'Session expired. Please log in again.',
    recipe_update_title: 'Recipe Update Approval Required',
    recipe_update_description: 'A recipe sent by Recipe Bot has the same PPID as a host recipe, but its file content is different.',
    machine: 'Machine',
    machine_file: 'Machine file',
    host_file: 'Host file',
    incoming_size: 'Incoming size',
    current_size: 'Current size',
    bytes: 'bytes',
    recipe_update_explanation: 'Accepting archives the current host file before installing the incoming version. Rejecting preserves the host recipe unchanged.',
    update_auth_required: 'Technician or Administrator authentication is required to decide this update.',
    reject_update: 'REJECT UPDATE',
    accept_update: 'ACCEPT UPDATE',
    processing: 'PROCESSING…',
    confirm_deletion: 'CONFIRM DELETION',
    delete_recipe_question: 'Delete Recipe?',
    delete_recipe_text_before: 'Are you sure you want to permanently delete',
    delete_recipe_text_after: 'from the machine? This action cannot be undone.',
    confirm_delete: 'CONFIRM DELETE',
    recipe_not_found: 'RECIPE NOT FOUND',
    recipe_not_found_before: 'The exact recipe',
    recipe_not_found_after: 'was not found locally. However, a closely matching recipe exists on the server.',
    did_you_mean: 'Did you mean:',
    accept_and_push: 'Accept & Push',
    session_timeout_title: 'SESSION EXPIRING SOON',
    session_timeout_message: 'You will be logged off automatically due to inactivity in',
    seconds: 'seconds',
    session_timeout_help: 'Use the button below to remain signed in.',
    stay_signed_in: 'STAY SIGNED IN',
    guest_auth_title: 'Authorization Required',
    guest_auth_access_before: 'Access to the',
    guest_auth_access_after: 'requires an authenticated role.',
    guest_auth_instruction: 'Please log in with your authorized credentials to continue.',
    login_authenticate: 'Login / Authenticate',
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('arc_language') || 'TH';
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem('arc_language', lang);
  };

  const toggleLanguage = () => {
    const nextLang = language === 'TH' ? 'EN' : 'TH';
    setLanguage(nextLang);
  };

  const t = (key) => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.TH;
    return dict[key] || TRANSLATIONS.EN[key] || key;
  };

  useEffect(() => {
    document.documentElement.setAttribute('lang', language.toLowerCase());
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
