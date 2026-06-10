// ── DEDUPLICATION HELPERS ───────────────────────────────────────────────────
function deduplicateAttendance(arr) {
  if (!Array.isArray(arr)) return [];
  const map = {};
  arr.forEach(item => {
    if (!item.workerId || !item.date) return;
    const dateStr = normalizeDate(item.date);
    item.date = dateStr; // Normalize the date property on the object
    const key = `${item.workerId}_${dateStr}`;
    map[key] = item;
  });
  return Object.values(map);
}

function deduplicateEntries(arr) {
  if (!Array.isArray(arr)) return [];
  const map = {};
  arr.forEach(item => {
    if (!item.workerId || !item.date) return;
    const dateStr = normalizeDate(item.date);
    item.date = dateStr; // Normalize the date property on the object
    const key = `${item.workerId}_${dateStr}`;
    const existing = map[key];
    if (!existing) {
      map[key] = item;
    } else {
      // Keep the one with a non-zero wage or rate
      const existingWage = parseFloat(existing.wage || existing.wageAmount || 0);
      const incomingWage = parseFloat(item.wage || item.wageAmount || 0);
      const existingRate = parseFloat(existing.rate || existing.packRate || 0);
      const incomingRate = parseFloat(item.rate || item.packRate || 0);
      
      if (incomingWage > existingWage || (incomingWage === existingWage && incomingRate > existingRate)) {
        map[key] = item;
      }
    }
  });
  return Object.values(map);
}

function deduplicateById(arr) {
  if (!Array.isArray(arr)) return [];
  const map = {};
  arr.forEach(item => {
    if (!item.id) return;
    map[item.id] = item;
  });
  return Object.values(map);
}

function cleanEntries(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(e => {
    if (!e) return e;

    // Normalize date
    if (e.date) {
      e.date = normalizeDate(e.date);
    }

    // Category mapping
    if (e.category && !e.homeCategory) {
      e.homeCategory = e.category;
    } else if (e.homeCategory && !e.category) {
      e.category = e.homeCategory;
    }

    // Assigned Total mapping
    if (e.assignedTotal !== undefined && e.assignedTotal !== null && e.assigned === undefined) {
      e.assigned = e.assignedTotal;
    } else if (e.assigned !== undefined && e.assigned !== null && e.assignedTotal === undefined) {
      e.assignedTotal = e.assigned;
    }

    // Assigned Morning mapping
    if (e.assignedMorning !== undefined && e.assignedMorning !== null && e.mAssigned === undefined) {
      e.mAssigned = e.assignedMorning;
    } else if (e.mAssigned !== undefined && e.mAssigned !== null && e.assignedMorning === undefined) {
      e.assignedMorning = e.mAssigned;
    }

    // Assigned Afternoon mapping
    if (e.assignedAfternoon !== undefined && e.assignedAfternoon !== null && e.aAssigned === undefined) {
      e.aAssigned = e.assignedAfternoon;
    } else if (e.aAssigned !== undefined && e.aAssigned !== null && e.assignedAfternoon === undefined) {
      e.assignedAfternoon = e.aAssigned;
    }

    // Pieces mapping (Packing workers support)
    if (e.pieces !== undefined && e.pieces !== null && (e.output === undefined || e.output === 0 || e.output === '')) {
      e.output = e.pieces;
      if (e.assigned === undefined || e.assigned === 0 || e.assigned === '') e.assigned = e.pieces;
      if (e.assignedTotal === undefined || e.assignedTotal === 0 || e.assignedTotal === '') e.assignedTotal = e.pieces;
      if (e.mAssigned === undefined || e.mAssigned === 0 || e.mAssigned === '') e.mAssigned = e.pieces;
      if (e.assignedMorning === undefined || e.assignedMorning === 0 || e.assignedMorning === '') e.assignedMorning = e.pieces;
    } else if (e.output !== undefined && e.output !== null && (e.pieces === undefined || e.pieces === 0 || e.pieces === '')) {
      e.pieces = e.output;
    }

    // PackRate mapping
    if (e.packRate !== undefined && e.packRate !== null && (e.rate === undefined || e.rate === 0 || e.rate === '')) {
      e.rate = e.packRate;
    } else if (e.rate !== undefined && e.rate !== null && (e.packRate === undefined || e.packRate === 0 || e.packRate === '')) {
      e.packRate = e.rate;
    }

    return e;
  });
}

// ── DATA & STATE ──────────────────────────────────────────────────────────
var workers = JSON.parse(localStorage.getItem('wt_workers') || '[]');
var unit1Entries = cleanEntries(deduplicateEntries(JSON.parse(localStorage.getItem('wt_unit1_entries') || '[]')));
var unit2Entries = cleanEntries(deduplicateEntries(JSON.parse(localStorage.getItem('wt_unit2_entries') || '[]')));
var unit3Entries = cleanEntries(deduplicateEntries(JSON.parse(localStorage.getItem('wt_unit3_entries') || '[]')));
var unit4Entries = cleanEntries(deduplicateEntries(JSON.parse(localStorage.getItem('wt_unit4_entries') || '[]')));
var unit1Attendance = deduplicateAttendance(JSON.parse(localStorage.getItem('wt_unit1_attendance') || '[]'));
var unit2Attendance = deduplicateAttendance(JSON.parse(localStorage.getItem('wt_unit2_attendance') || '[]'));
var unit3Attendance = deduplicateAttendance(JSON.parse(localStorage.getItem('wt_unit3_attendance') || '[]'));
var unit4Attendance = deduplicateAttendance(JSON.parse(localStorage.getItem('wt_unit4_attendance') || '[]'));
var maintenance = cleanEntries(deduplicateById(JSON.parse(localStorage.getItem('wt_maintenance') || '[]')));

// Silently save deduplicated data back to localStorage to clean local cache without pushing to cloud on startup
localStorage.setItem('wt_unit1_entries', JSON.stringify(unit1Entries));
localStorage.setItem('wt_unit2_entries', JSON.stringify(unit2Entries));
localStorage.setItem('wt_unit3_entries', JSON.stringify(unit3Entries));
localStorage.setItem('wt_unit4_entries', JSON.stringify(unit4Entries));
localStorage.setItem('wt_unit1_attendance', JSON.stringify(unit1Attendance));
localStorage.setItem('wt_unit2_attendance', JSON.stringify(unit2Attendance));
localStorage.setItem('wt_unit3_attendance', JSON.stringify(unit3Attendance));
localStorage.setItem('wt_unit4_attendance', JSON.stringify(unit4Attendance));
localStorage.setItem('wt_maintenance', JSON.stringify(maintenance));

var users = JSON.parse(localStorage.getItem('wt_users') || '[]');
var currentUser = JSON.parse(localStorage.getItem('wt_session') || 'null');
var currentProductionTab = 'all'; // Default to all for everyone initially

// Initialize Users if empty or corrupted
if (!Array.isArray(users) || users.length === 0) {
  users = [{ username: 'admin', password: 'admin123', gmail: 'admin@gmail.com', role: 'admin', access: {} }];
  localStorage.setItem('wt_users', JSON.stringify(users));
}

// Migration: Ensure all users and session user have parsed access property
let needsMigration = false;
users.forEach(u => {
  if (typeof u.access === 'string') {
    try {
      u.access = JSON.parse(u.access);
      needsMigration = true;
    } catch (e) {
      u.access = {};
      needsMigration = true;
    }
  }
  if (!u.access) {
    u.access = {};
    needsMigration = true;
  }
});
if (needsMigration) {
  localStorage.setItem('wt_users', JSON.stringify(users));
}

// Sanitize active session currentUser permissions
if (currentUser) {
  if (typeof currentUser.access === 'string') {
    try {
      currentUser.access = JSON.parse(currentUser.access);
      localStorage.setItem('wt_session', JSON.stringify(currentUser));
    } catch (e) {
      currentUser.access = {};
    }
  }
  if (!currentUser.access) {
    currentUser.access = {};
    localStorage.setItem('wt_session', JSON.stringify(currentUser));
  }
}

function save(preventSync = false) {
  localStorage.setItem('wt_workers', JSON.stringify(workers));
  localStorage.setItem('wt_unit1_entries', JSON.stringify(unit1Entries));
  localStorage.setItem('wt_unit2_entries', JSON.stringify(unit2Entries));
  localStorage.setItem('wt_unit3_entries', JSON.stringify(unit3Entries));
  localStorage.setItem('wt_unit4_entries', JSON.stringify(unit4Entries));
  localStorage.setItem('wt_unit1_attendance', JSON.stringify(unit1Attendance));
  localStorage.setItem('wt_unit2_attendance', JSON.stringify(unit2Attendance));
  localStorage.setItem('wt_unit3_attendance', JSON.stringify(unit3Attendance));
  localStorage.setItem('wt_unit4_attendance', JSON.stringify(unit4Attendance));
  localStorage.setItem('wt_maintenance', JSON.stringify(maintenance));
  localStorage.setItem('wt_users', JSON.stringify(users));

  // Auto-sync to cloud on every save
  if (!preventSync && window.syncAll) syncAll();
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function normalizeDate(dateStr) {
  if (!dateStr) return '';

  // Directly extract YYYY-MM-DD or YYYY/MM/DD if in string format (without time details) to prevent timezone shifts
  if (typeof dateStr === 'string' && !dateStr.includes('T') && !dateStr.includes('Z')) {
    const match = dateStr.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // Handle DD/MM/YYYY backup parsing if applicable
    if (typeof dateStr === 'string') {
      const matchDMY = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (matchDMY) {
        const day = matchDMY[1].padStart(2, '0');
        const month = matchDMY[2].padStart(2, '0');
        const year = matchDMY[3];
        return `${year}-${month}-${day}`;
      }
    }
    return String(dateStr).split('T')[0]; // Fallback for partials
  }

  // Force India Standard Time (IST) timezone formatting (Asia/Kolkata) to match factory location
  try {
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(d);
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

function todayStr() {
  const d = new Date();
  try {
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(d);
  } catch (e) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
}

function workerById(id) {
  if (!id) return null;
  return workers.find(w => String(w.id) === String(id));
}

function uid() {
  return Math.random().toString(36).substr(2, 9);
}

function isHalfDay(s) { return s === 'forenoon' || s === 'afternoon'; }
function isWorking(s) { return s === 'present' || s === 'forenoon' || s === 'afternoon'; }
function statusColor(s) {
  return {
    present: 'var(--accent2)',
    absent: 'var(--accent3)',
    forenoon: '#60a5fa',
    afternoon: '#fb923c'
  }[s] || 'var(--border)';
}

function getMonthDays(dateStr) {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function getUnitEntries(unit) {
  const map = {
    unit1: unit1Entries,
    unit2: unit2Entries,
    unit3: unit3Entries,
    unit4: unit4Entries
  };
  return map[unit] || unit1Entries;
}

function getUnitAttendance(unit) {
  const map = {
    unit1: unit1Attendance,
    unit2: unit2Attendance,
    unit3: unit3Attendance,
    unit4: unit4Attendance
  };
  return map[unit] || unit1Attendance;
}

function getAllEntries() {
  return [...unit1Entries, ...unit2Entries, ...unit3Entries, ...unit4Entries];
}

function getAllAttendance() {
  return [...unit1Attendance, ...unit2Attendance, ...unit3Attendance, ...unit4Attendance];
}

function getProdKey(input) {
  if (['unit1', 'unit2', 'unit3', 'unit4', 'maintenance'].includes(input)) return input;
  const map = {
    piece_work: 'unit1',
    daily: 'unit1',
    monthly_salary: 'unit2',
    permanent: 'unit2',
    bundle_packing: 'unit3',
    cover_packing: 'unit3',
    packing: 'unit3',
    daily_wages: 'unit4',
    other: 'unit4',
    maintenance: 'maintenance'
  };
  return map[input] || 'unit1';
}

function calcPaidLeaveBonus(worker, fromDate, toDate) {
  const att = getUnitAttendance(worker.unit || 'unit1');
  const monthDays = getMonthDays(fromDate);
  const perDay = Math.round((worker.salary || 0) / monthDays);

  // Calculate absent days, counting half-days as 0.5 absent
  const absentDays = att.filter(a =>
    a.workerId === worker.id &&
    a.date >= fromDate && a.date <= toDate &&
    a.status === 'absent'
  ).length;

  // Count half-days (forenoon/afternoon) as 0.5 absent each
  const halfDayAbsent = att.filter(a =>
    a.workerId === worker.id &&
    a.date >= fromDate && a.date <= toDate &&
    (a.status === 'forenoon' || a.status === 'afternoon')
  ).length * 0.5;

  const totalAbsent = absentDays + halfDayAbsent;
  const unused = Math.max(0, (worker.paidLeaves || 0) - totalAbsent);

  return { bonus: Math.round(unused * perDay), unused, perDay, monthDays };
}

// ── RBAC HELPERS ─────────────────────────────────────────────────────────────
function hasProductionAccess(prodType) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  const prodKey = getProdKey(prodType);
  return currentUser.access && currentUser.access[prodKey] && currentUser.access[prodKey].length > 0;
}

function hasActionPermission(prodType, action) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  const prodKey = getProdKey(prodType);
  return currentUser.access && currentUser.access[prodKey] && currentUser.access[prodKey].includes(action);
}

function hasFullUnitAccess(unit) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  const prodKey = getProdKey(unit);
  return currentUser.access &&
    currentUser.access[prodKey] &&
    currentUser.access[prodKey].includes('attendance') &&
    currentUser.access[prodKey].includes('work') &&
    currentUser.access[prodKey].includes('payment');
}

function hasMaintenancePermission() {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  return currentUser.access && currentUser.access.maintenance && currentUser.access.maintenance.length > 0;
}

function getAccessibleProductions() {
  if (!currentUser) return [];
  if (currentUser.role === 'admin') return ['unit1', 'unit2', 'unit3', 'unit4'];
  const accessible = [];
  if (currentUser.access) {
    Object.keys(currentUser.access).forEach(prodKey => {
      if (currentUser.access[prodKey].length > 0 && ['unit1', 'unit2', 'unit3', 'unit4'].includes(prodKey)) {
        accessible.push(prodKey);
      }
    });
  }
  return accessible;
}
