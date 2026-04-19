// ── DATA & STATE ──────────────────────────────────────────────────────────
let workers = JSON.parse(localStorage.getItem('wt_workers') || '[]');
let entries = JSON.parse(localStorage.getItem('wt_entries') || '[]');
let attendance = JSON.parse(localStorage.getItem('wt_attendance') || '[]');
let users = JSON.parse(localStorage.getItem('wt_users') || '[]');
let currentUser = JSON.parse(localStorage.getItem('wt_session') || 'null');
let currentProductionTab = 'daily';

// Initialize Users if empty or corrupted
if (!Array.isArray(users) || users.length === 0) {
  users = [{ username: 'admin', password: 'admin123', gmail: 'admin@gmail.com', role: 'admin', access: {} }];
  localStorage.setItem('wt_users', JSON.stringify(users));
}

// Migration: Ensure all users have access property
let needsMigration = false;
users.forEach(u => {
  if (!u.access) {
    u.access = {};
    needsMigration = true;
  }
});
if (needsMigration) {
  localStorage.setItem('wt_users', JSON.stringify(users));
}

function save() {
  localStorage.setItem('wt_workers', JSON.stringify(workers));
  localStorage.setItem('wt_entries', JSON.stringify(entries));
  localStorage.setItem('wt_attendance', JSON.stringify(attendance));
  localStorage.setItem('wt_users', JSON.stringify(users));
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function workerById(id) {
  return workers.find(w => w.id === id);
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

// ── RBAC HELPERS ─────────────────────────────────────────────────────────────
function hasProductionAccess(prodType) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  const prodKey = { daily: 'prod1', permanent: 'prod2', packing: 'prod3', other: 'prod4' }[prodType];
  return currentUser.access && currentUser.access[prodKey] && currentUser.access[prodKey].length > 0;
}

function hasActionPermission(prodType, action) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  const prodKey = { daily: 'prod1', permanent: 'prod2', packing: 'prod3', other: 'prod4' }[prodType];
  return currentUser.access && currentUser.access[prodKey] && currentUser.access[prodKey].includes(action);
}

function getAccessibleProductions() {
  if (!currentUser) return [];
  if (currentUser.role === 'admin') return ['daily', 'permanent', 'packing', 'other'];
  const accessible = [];
  const mapping = { prod1: 'daily', prod2: 'permanent', prod3: 'packing', prod4: 'other' };
  if (currentUser.access) {
    Object.keys(currentUser.access).forEach(prodKey => {
      if (currentUser.access[prodKey].length > 0) {
        accessible.push(mapping[prodKey]);
      }
    });
  }
  return accessible;
}
