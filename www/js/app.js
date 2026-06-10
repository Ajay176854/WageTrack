// ── MAIN APPLICATION LOGIC ───────────────────────────────────────────────────

const emojis = ['👷', '🧑‍🏭', '👩‍🏭', '🧑‍🌾', '👩‍🌾', '🧑', '👩', '🧑‍💼'];
let editingWorkerId = null;

// ── INITIALIZATION ───────────────────────────────────────────────────────────
function renderAll() {
  if (!currentUser) return;
  renderWorkers();
  renderTodayEntries();
  buildWorkerFilterChips();
  renderReport();
  if (currentUser.role === 'admin') renderUsers();

  // Filter worker count based on supervisor access
  let visibleWorkerCount = workers.length;
  if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    visibleWorkerCount = workers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
      return accessible.includes(workerUnit);
    }).length;
  }
  const badge = document.getElementById('worker-count-badge');
  if (badge) badge.textContent = visibleWorkerCount + ' worker' + (visibleWorkerCount !== 1 ? 's' : '');

  // Apply RBAC UI adjustments
  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    if (isAdmin) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  // Hide/show production tabs based on supervisor access
  if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    if (document.getElementById('prod-tab-1')) document.getElementById('prod-tab-1').style.display = accessible.includes('unit1') ? 'flex' : 'none';
    if (document.getElementById('prod-tab-2')) document.getElementById('prod-tab-2').style.display = accessible.includes('unit2') ? 'flex' : 'none';
    if (document.getElementById('prod-tab-3')) document.getElementById('prod-tab-3').style.display = accessible.includes('unit3') ? 'flex' : 'none';
    if (document.getElementById('prod-tab-4')) document.getElementById('prod-tab-4').style.display = accessible.includes('unit4') ? 'flex' : 'none';

    // Show maintenance tab only if supervisor has maintenance permission
    if (document.getElementById('prod-tab-maintenance')) {
      document.getElementById('prod-tab-maintenance').style.display = hasMaintenancePermission() ? 'flex' : 'none';
    }

    if (document.getElementById('prod-tab-all')) document.getElementById('prod-tab-all').style.display = accessible.length > 1 ? 'flex' : 'none';

    if (!accessible.includes(currentProductionTab) && currentProductionTab !== 'all' && currentProductionTab !== 'maintenance') {
      if (accessible.length > 0) switchProductionTab(accessible[0]);
    } else if (currentProductionTab === 'all' && accessible.length === 1) {
      switchProductionTab(accessible[0]);
    } else if (currentProductionTab === 'maintenance' && !hasMaintenancePermission()) {
      // If on maintenance tab but no permission, switch to first accessible unit
      if (accessible.length > 0) switchProductionTab(accessible[0]);
    }
  } else {
    // Admin sees all tabs
    ['all', '1', '2', '3', '4', 'maintenance'].forEach(id => {
      const el = document.getElementById(id === 'all' ? 'prod-tab-all' : id === 'maintenance' ? 'prod-tab-maintenance' : 'prod-tab-' + id);
      if (el) el.style.display = 'flex';
    });
  }
  updateActionButtons();
}

function updateActionButtons() {
  if (!currentUser || currentUser.role === 'admin') {
    document.querySelectorAll('[onclick*="openAttendance"]').forEach(el => el.style.display = 'flex');
    document.querySelectorAll('[onclick*="openQuickAssignMenu"]').forEach(el => el.style.display = 'flex');
    document.querySelectorAll('[onclick*="openAddEntry"]').forEach(el => el.style.display = 'flex');
    return;
  }

  const accessible = getAccessibleProductions();
  if (currentProductionTab === 'all') {
    const hasAnyAttendance = accessible.some(prod => hasActionPermission(prod, 'attendance'));
    const hasAnyWork = accessible.some(prod => hasActionPermission(prod, 'work'));
    const hasAnyPayment = accessible.some(prod => hasActionPermission(prod, 'payment'));

    document.querySelectorAll('[onclick*="openAttendance"]').forEach(el => el.style.display = hasAnyAttendance ? 'flex' : 'none');
    document.querySelectorAll('[onclick*="openQuickAssignMenu"]').forEach(el => el.style.display = hasAnyWork ? 'flex' : 'none');
    document.querySelectorAll('[onclick*="openAddEntry"]').forEach(el => el.style.display = (hasAnyWork || hasAnyPayment) ? 'flex' : 'none');
  } else {
    const hasAttendancePerm = hasActionPermission(currentProductionTab, 'attendance');
    const hasWorkPerm = hasActionPermission(currentProductionTab, 'work');
    const hasPaymentPerm = hasActionPermission(currentProductionTab, 'payment');

    document.querySelectorAll('[onclick*="openAttendance"]').forEach(el => el.style.display = hasAttendancePerm ? 'flex' : 'none');
    document.querySelectorAll('[onclick*="openQuickAssignMenu"]').forEach(el => el.style.display = hasWorkPerm ? 'flex' : 'none');
    document.querySelectorAll('[onclick*="openAddEntry"]').forEach(el => el.style.display = (hasWorkPerm || hasPaymentPerm) ? 'flex' : 'none');
  }
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
async function requestCloudAuth(username, password) {
  try {
    const response = await fetch(CLOUD_CONFIG.gasUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'cloud_login',
        data: { username, password }
      })
    });
    return await response.json();
  } catch (err) {
    console.error('Cloud Auth Error:', err);
    return { success: false, message: 'Connection Error' };
  }
}

async function doLogin() {
  try {
    const userEl = document.getElementById('l-user');
    const passEl = document.getElementById('l-pass');
    const btn = document.querySelector('#screen-login button');

    if (!userEl || !passEl) return;
    const user = userEl.value.trim();
    const pass = passEl.value.trim();

    if (!user || !pass) {
      showToast('Please enter both username and password');
      return;
    }

    // 1. Try Cloud Login First (Priority)
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; }
    showToast('Connecting to cloud...');

    const cloudResult = await requestCloudAuth(user, pass);

    if (btn) { btn.disabled = false; btn.textContent = 'Login'; }

    if (cloudResult && cloudResult.success) {
      // POPULATE DATA FROM CLOUD (with robust undefined data field safeguards)
      const d = cloudResult.data || {};
      if (d.workers !== undefined && d.workers !== null) {
        window.workers = d.workers || [];
      }
      if (d.unit1Entries !== undefined && d.unit1Entries !== null) window.unit1Entries = cleanEntries(deduplicateById(d.unit1Entries || []));
      if (d.unit2Entries !== undefined && d.unit2Entries !== null) window.unit2Entries = cleanEntries(deduplicateById(d.unit2Entries || []));
      if (d.unit3Entries !== undefined && d.unit3Entries !== null) window.unit3Entries = cleanEntries(deduplicateById(d.unit3Entries || []));
      if (d.unit4Entries !== undefined && d.unit4Entries !== null) window.unit4Entries = cleanEntries(deduplicateById(d.unit4Entries || []));
      if (d.unit1Attendance !== undefined && d.unit1Attendance !== null) window.unit1Attendance = deduplicateAttendance(d.unit1Attendance || []);
      if (d.unit2Attendance !== undefined && d.unit2Attendance !== null) window.unit2Attendance = deduplicateAttendance(d.unit2Attendance || []);
      if (d.unit3Attendance !== undefined && d.unit3Attendance !== null) window.unit3Attendance = deduplicateAttendance(d.unit3Attendance || []);
      if (d.unit4Attendance !== undefined && d.unit4Attendance !== null) window.unit4Attendance = deduplicateAttendance(d.unit4Attendance || []);
      if (d.maintenance !== undefined && d.maintenance !== null) window.maintenance = cleanEntries(deduplicateById(d.maintenance || []));

      // Clean and parse all fetched supervisor permissions to prevent UI crashes.
      // Only overwrite the local users array if it was returned and is non-empty,
      // or if the logging in user is the admin.
      const isLoggingInAdmin = cloudResult.user && cloudResult.user.role === 'admin';
      if (d.users !== undefined && d.users !== null && (d.users.length > 0 || isLoggingInAdmin)) {
        window.users = d.users.map(u => {
          if (typeof u.access === 'string') {
            try { u.access = JSON.parse(u.access); } catch (e) { u.access = {}; }
          }
          if (!u.access) u.access = {};
          return u;
        });
        if (window.users.length === 0) {
          window.users = [{ username: 'admin', password: 'admin123', gmail: 'admin@gmail.com', role: 'admin', access: {} }];
        }
      }

      currentUser = cloudResult.user;
      if (currentUser) {
        if (typeof currentUser.access === 'string') {
          try { currentUser.access = JSON.parse(currentUser.access); } catch (e) { currentUser.access = {}; }
        }
        if (!currentUser.access) currentUser.access = {};
      }

      // Save to local storage (passing true to preventSync to avoid redundant loops)
      if (typeof window.save === 'function') window.save(true);

      finishLogin(currentUser);
      showToast('✓ Cloud Login Successful');
      return;
    }

    // 2. Fallback to Local Login (Offline Mode)
    showToast('Cloud unavailable, checking local credentials...');
    const found = users.find(u => u.username.toLowerCase() === user.toLowerCase() && u.password === pass);
    if (found) {
      currentUser = found;
      finishLogin(found);
      showToast('✓ Offline Mode - Using cached data');
      return;
    }

    // 3. Both failed
    const msg = cloudResult ? (cloudResult.message || 'Invalid credentials') : 'Connection Error';
    showToast('❌ ' + msg);
  } catch (e) {
    console.error('Login error:', e);
    showToast('Login Error: ' + e.message);
  }
}

function finishLogin(userObj) {
  localStorage.setItem('wt_session', JSON.stringify(userObj));
  document.body.classList.add('logged-in');

  if (window.checkAuth) checkAuth();
  try { renderAll(); } catch (e) { console.error('renderAll error:', e); }
  switchScreen('home', document.querySelector('.nav-btn'));
  showToast(`Welcome back, ${userObj.username}!`);
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('wt_session');
  document.body.classList.remove('logged-in');

  const loginUser = document.getElementById('l-user');
  const loginPass = document.getElementById('l-pass');
  if (loginUser) loginUser.value = '';
  if (loginPass) loginPass.value = '';

  checkAuth();
  showToast('Logged out');
}

// ── WORKERS ──────────────────────────────────────────────────────────────────
function renderWorkers() {
  const list = document.getElementById('workers-list');
  if (!list) return;
  const searchVal = (document.getElementById('worker-search')?.value || '').toLowerCase().trim();

  let visibleWorkers = workers;
  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    visibleWorkers = workers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
      return accessible.includes(workerUnit);
    });
  }

  if (searchVal) {
    visibleWorkers = visibleWorkers.filter(w =>
      (w.name && w.name.toLowerCase().includes(searchVal)) ||
      (w.empId || '').toLowerCase().includes(searchVal)
    );
  }

  if (visibleWorkers.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">${searchVal ? 'No workers match "' + searchVal + '"' : 'No workers in this section.'}</div></div>`;
    return;
  }

  const allEntries = getAllEntries();
  const allAttendance = getAllAttendance();

  list.innerHTML = visibleWorkers.map((w, index) => {
    const now = new Date();
    const monthStr = now.toISOString().substr(0, 7);
    const monthDays = getMonthDays(monthStr + '-01'); // Get actual days in current month
    const pieceTotal = allEntries.filter(e => e.workerId === w.id && normalizeDate(e.date).startsWith(monthStr)).reduce((s, e) => s + Number(e.wage || 0), 0);
    const monthAtt = allAttendance.filter(a => a.workerId === w.id && normalizeDate(a.date).startsWith(monthStr));
    const otTotal = monthAtt.reduce((s, a) => s + Number(a.otAmount || 0), 0);
    const daysPresent = monthAtt.filter(a => isWorking(a.status)).reduce((acc, a) => acc + (isHalfDay(a.status) ? 0.5 : 1), 0);
    let basePay = pieceTotal;
    if (w.category === 'monthly_salary' || w.type === 'permanent') basePay = Math.round(((Number(w.salary || 0)) / monthDays) * daysPresent);
    const monthGrandTotal = basePay + otTotal;
    const todayAtt = allAttendance.find(a => a.workerId === w.id && normalizeDate(a.date) === todayStr());
    const todayOT = todayAtt ? Number(todayAtt.otAmount || 0) : 0;
    const todayPiece = allEntries.filter(e => e.workerId === w.id && normalizeDate(e.date) === todayStr()).reduce((s, e) => s + Number(e.wage || 0), 0);
    let todayEarned = todayPiece + todayOT;
    if ((w.category === 'monthly_salary' || w.type === 'permanent') && todayAtt && isWorking(todayAtt.status)) {
      const mult = isHalfDay(todayAtt.status) ? 0.5 : 1;
      todayEarned = Math.round((w.salary || 0) / monthDays * mult) + todayOT;
    }
    if (w.category === 'daily_wages' && todayAtt && isWorking(todayAtt.status)) {
      const mult = isHalfDay(todayAtt.status) ? 0.5 : 1;
      todayEarned = Math.round((w.dailyWage || 0) * mult) + todayOT;
    }

    const typeColors = {
      piece_work: { color: 'var(--accent)', bg: 'rgba(184,134,11,0.12)', label: 'Piece Work' },
      bundle_packing: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: 'Bundle Pack' },
      cover_packing: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Cover Pack' },
      monthly_salary: { color: 'var(--accent2)', bg: 'rgba(30,126,52,0.12)', label: 'Monthly' },
      daily_wages: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)', label: 'Daily Wages' },
      daily: { color: 'var(--accent)', bg: 'rgba(184,134,11,0.12)', label: 'Piece Work' },
      permanent: { color: 'var(--accent2)', bg: 'rgba(30,126,52,0.12)', label: 'Monthly' },
      packing: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: 'Packing' },
      other: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)', label: 'Other' }
    };
    const typeInfo = typeColors[w.category] || typeColors[w.type] || typeColors['piece_work'];
    const typeTag = `<span style="font-size:9px;color:${typeInfo.color};text-transform:uppercase;background:${typeInfo.bg};padding:1px 6px;border-radius:4px;font-weight:800;">${typeInfo.label}</span>`;
    const delay = (index % 10) * 0.05;

    return `
      <div class="list-item reveal" style="animation-delay: ${delay}s" onclick="showWorkerDetails('${w.id}')">
        <div class="item-icon">${w.emoji || '👷'}</div>
        <div class="item-main">
          <div class="item-title" style="font-weight:700; color:var(--text-bright);">${w.name} ${typeTag}</div>
          <div class="item-sub" style="font-size:11px; color:var(--text-muted);">${w.empId || ''} ${w.phone ? '· ' + w.phone : ''}</div>
          <div class="item-sub" style="color:var(--accent2); font-weight:700; font-size:11px;">₹${monthGrandTotal.toLocaleString()} this month</div>
        </div>
        <div class="item-right">
          <div class="item-value" style="font-size:18px; font-weight:800; color:var(--accent);">${todayEarned > 0 ? '₹' + todayEarned.toLocaleString() : '—'}</div>
          <div class="item-label" style="font-size:9px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">today</div>
        </div>
      </div>`;
  }).join('');
}

function showWorkerDetails(wid) {
  const w = workerById(wid);
  if (!w) return;

  const nameEl = document.getElementById('w360-name');
  if (nameEl) nameEl.textContent = w.name + "'s Profile";

  const historyCont = document.getElementById('w360-content');
  if (historyCont) {
    const unitLabel = (w.unit || 'unit1').toUpperCase().replace('UNIT', 'Unit ');
    const categoryLabels = {
      piece_work: 'Piece Work',
      bundle_packing: 'Bundle Packing',
      cover_packing: 'Cover Packing',
      monthly_salary: 'Monthly Salary',
      daily_wages: 'Daily Wages'
    };
    const categoryLabel = categoryLabels[w.category] || categoryLabels[w.type === 'permanent' ? 'monthly_salary' : w.type === 'packing' ? 'bundle_packing' : w.type === 'other' ? 'daily_wages' : 'piece_work'];
    const typeLabel = `${unitLabel} · ${categoryLabel}`;

    const now = new Date();
    const monthStr = now.toISOString().substr(0, 7);
    const allEntries = getAllEntries();
    const allAttendance = getAllAttendance();
    const mEntries = allEntries.filter(e => e.workerId === wid && normalizeDate(e.date).startsWith(monthStr));
    const mAtt = allAttendance.filter(a => a.workerId === wid && normalizeDate(a.date).startsWith(monthStr));
    const wageEarned = mEntries.reduce((s, e) => s + Number(e.wage || 0), 0);
    const advanceTotal = mAtt.reduce((s, a) => s + Number(a.advance || 0), 0);

    let rowsHtml = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const dayAtt = mAtt.find(a => normalizeDate(a.date) === ds);
      const dayEntries = mEntries.filter(e => normalizeDate(e.date) === ds);
      if (dayAtt || dayEntries.length > 0) {
        const status = dayAtt ? dayAtt.status : 'N/A';
        const wage = dayEntries.reduce((s, e) => s + Number(e.wage || 0), 0);
        const ot = dayAtt ? Number(dayAtt.otAmount || 0) : 0;
        rowsHtml += `
            <div style="background:var(--surface-raised); border:1px solid var(--border); border-radius:10px; padding:10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div>
                <div style="font-size:12px; font-weight:700; color:var(--text-bright);">${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                <div style="font-size:10px; color:var(--text-muted);">${status.toUpperCase()} ${wage > 0 ? '· Piece:₹' + wage : ''} ${ot > 0 ? '· OT:₹' + ot : ''}</div>
              </div>
              <div style="font-size:13px; font-weight:700; color:var(--accent);">₹${wage + ot}</div>
            </div>`;
      }
    }

    historyCont.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
        <div class="item-icon" style="width:64px; height:64px; font-size:32px; flex-shrink:0;">${w.emoji || '👷'}</div>
        <div>
          <div style="font-size:20px; font-weight:800; color:var(--text-bright);">${w.name}</div>
          <div style="font-size:12px; color:var(--text-muted);">${w.empId || 'No ID'} · ${typeLabel}</div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
        <div class="card" style="padding:16px; background:var(--surface-raised);">
           <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.5px;">WAGE THIS MONTH</div>
           <div style="font-size:22px; font-weight:800; color:var(--accent2); font-family:var(--mono);">₹${wageEarned.toLocaleString()}</div>
        </div>
        <div class="card" style="padding:16px; background:var(--surface-raised);">
           <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.5px;">ADVANCE TAKEN</div>
           <div style="font-size:22px; font-weight:800; color:var(--accent); font-family:var(--mono);">₹${advanceTotal.toLocaleString()}</div>
        </div>
      </div>
      <div style="font-size:11px; font-weight:800; color:var(--text-muted); letter-spacing:1px; margin-bottom:12px;">RECENT ACTIVITY</div>
      ${rowsHtml || '<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:10px;">No recent activity</div>'}
    `;
  }

  const editBtn = document.getElementById('w360-edit-btn');
  if (editBtn) {
    const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
    const hasAccess = currentUser.role === 'admin' || (currentUser.role === 'supervisor' && hasFullUnitAccess(workerUnit));
    if (hasAccess) {
      editBtn.style.display = 'block';
      editBtn.onclick = () => { closeModal('modal-worker-360'); editWorker(wid); };
    } else {
      editBtn.style.display = 'none';
    }
  }

  const modal = document.getElementById('modal-worker-360');
  if (modal) modal.classList.add('open');
}

function openAddWorker() {
  // Check if supervisor has full access to at least one unit
  if (currentUser.role === 'supervisor') {
    const hasAnyFullAccess = ['unit1', 'unit2', 'unit3', 'unit4'].some(unit => hasFullUnitAccess(unit));
    if (!hasAnyFullAccess) {
      showToast('Permission Denied: Full unit access required to add workers');
      return;
    }
  } else if (currentUser.role !== 'admin') {
    showToast('Permission Denied: Admins only');
    return;
  }

  editingWorkerId = null;
  const modal = document.getElementById('modal-worker');
  if (!modal) return;
  modal.querySelector('.modal-title span').textContent = 'Add Worker';
  const nextNum = String(workers.length + 1).padStart(3, '0');
  document.getElementById('w-empid').value = `EMP${nextNum}`;
  document.getElementById('w-phone').value = '';
  document.getElementById('w-name').value = '';


  // Reset fields
  ['w-salary', 'w-ot-rate', 'w-flat-amount', 'w-ot-rate-pack', 'w-ot-rate-daily'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const unitEl = document.getElementById('w-unit');
  const catEl = document.getElementById('w-category');
  const plEl = document.getElementById('w-paid-leaves');
  const dwEl = document.getElementById('w-daily-wage');

  // For supervisors, set default unit to first accessible unit with full access
  if (currentUser.role === 'supervisor') {
    const fullAccessUnits = ['unit1', 'unit2', 'unit3', 'unit4'].filter(unit => hasFullUnitAccess(unit));
    if (unitEl && fullAccessUnits.length > 0) {
      unitEl.value = fullAccessUnits[0];
      // Disable unit selection if only one unit has full access
      if (fullAccessUnits.length === 1) {
        unitEl.disabled = true;
      } else {
        unitEl.disabled = false;
        // Filter unit options to show only units with full access
        Array.from(unitEl.options).forEach(option => {
          if (option.value && !fullAccessUnits.includes(option.value)) {
            option.disabled = true;
            option.style.display = 'none';
          } else {
            option.disabled = false;
            option.style.display = '';
          }
        });
      }
    }
  } else {
    // Admin can select any unit
    if (unitEl) {
      unitEl.value = 'unit1';
      unitEl.disabled = false;
      Array.from(unitEl.options).forEach(option => {
        option.disabled = false;
        option.style.display = '';
      });
    }
  }

  if (catEl) catEl.value = 'piece_work';
  if (plEl) plEl.value = '';
  if (dwEl) dwEl.value = '';

  toggleWorkerTypeFields('piece_work');
  modal.classList.add('open');
}

function saveWorker() {
  const empId = document.getElementById('w-empid').value.trim();
  const phone = document.getElementById('w-phone').value.trim();
  const name = document.getElementById('w-name').value.trim();

  const unitEl = document.getElementById('w-unit');
  const catEl = document.getElementById('w-category');
  const plEl = document.getElementById('w-paid-leaves');
  const dwEl = document.getElementById('w-daily-wage');

  const unit = unitEl ? unitEl.value : 'unit1';
  const category = catEl ? catEl.value : 'piece_work';
  const paidLeaves = parseFloat(plEl ? plEl.value : 0) || 0;
  const dailyWage = parseFloat(dwEl ? dwEl.value : 0) || 0;

  // Permission check for supervisors
  if (currentUser.role === 'supervisor') {
    if (!hasFullUnitAccess(unit)) {
      showToast('Permission Denied: Full access to ' + unit.toUpperCase() + ' required');
      return;
    }
  }

  let salary = 0;
  let otRate = 0;
  let flatAmount = 0;

  if (category === 'monthly_salary') {
    salary = parseFloat(document.getElementById('w-salary').value) || 0;
    otRate = parseFloat(document.getElementById('w-ot-rate').value) || 0;
  } else if (category === 'bundle_packing' || category === 'cover_packing') {
    otRate = parseFloat(document.getElementById('w-ot-rate-pack').value) || 0;
    flatAmount = parseFloat(document.getElementById('w-flat-amount').value) || 0;
  } else {
    otRate = parseFloat(document.getElementById('w-ot-rate-daily').value) || 0;
  }

  if (!name) { showToast('ERROR: Worker name is required'); return; }
  if (category === 'monthly_salary' && salary <= 0) { showToast('ERROR: Monthly salary required for monthly salary workers'); return; }
  if (!empId) { showToast('ERROR: Employee ID is required'); return; }
  const dupId = workers.find(w => w.empId && w.empId.toLowerCase() === empId.toLowerCase() && w.id !== editingWorkerId);
  if (dupId) { showToast(`ERROR: Employee ID ${empId} is already taken!`); return; }

  if (editingWorkerId) {
    const idx = workers.findIndex(w => w.id === editingWorkerId);
    if (idx !== -1) {
      workers[idx] = { ...workers[idx], empId, phone, name, salary, otRate, flatAmount, unit, category, paidLeaves, dailyWage };
      showToast('Worker profile updated! ✓');
    }
  } else {
    workers.push({ id: uid(), empId, phone, name, salary, otRate, flatAmount, emoji: emojis[workers.length % emojis.length], unit, category, paidLeaves, dailyWage });
    showToast(`New worker "${name}" added! ✓`);
  }
  save();
  closeModal('modal-worker');
  renderAll();
}

function editWorker(wid) {
  const w = workerById(wid);
  if (!w) return;

  // Permission check for supervisors
  if (currentUser.role === 'supervisor') {
    const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
    if (!hasFullUnitAccess(workerUnit)) {
      showToast('Permission Denied: Full access to worker\'s unit required');
      return;
    }
  }

  editingWorkerId = wid;
  const modal = document.getElementById('modal-worker');
  if (!modal) return;
  modal.querySelector('.modal-title span').textContent = 'Edit Worker';
  document.getElementById('w-empid').value = w.empId || '';
  document.getElementById('w-phone').value = w.phone || '';
  document.getElementById('w-name').value = w.name || '';
  const category = w.category || (w.type === 'permanent' ? 'monthly_salary' : w.type === 'packing' ? 'bundle_packing' : w.type === 'other' ? 'daily_wages' : 'piece_work');
  document.getElementById('w-salary').value = w.salary || '';

  if (category === 'monthly_salary') {
    document.getElementById('w-ot-rate').value = w.otRate || '';
  } else if (category === 'bundle_packing' || category === 'cover_packing') {
    document.getElementById('w-ot-rate-pack').value = w.otRate || '';
    document.getElementById('w-flat-amount').value = w.flatAmount || '';
  } else {
    document.getElementById('w-ot-rate-daily').value = w.otRate || '';
  }

  const unitEl = document.getElementById('w-unit');
  const catEl = document.getElementById('w-category');
  const plEl = document.getElementById('w-paid-leaves');
  const dwEl = document.getElementById('w-daily-wage');
  if (unitEl) {
    unitEl.value = w.unit || 'unit1';
    // For supervisors, restrict unit changes to only units they have full access to
    if (currentUser.role === 'supervisor') {
      const fullAccessUnits = ['unit1', 'unit2', 'unit3', 'unit4'].filter(unit => hasFullUnitAccess(unit));
      Array.from(unitEl.options).forEach(option => {
        if (option.value && !fullAccessUnits.includes(option.value)) {
          option.disabled = true;
          option.style.display = 'none';
        } else {
          option.disabled = false;
          option.style.display = '';
        }
      });
    } else {
      // Admin can change to any unit
      Array.from(unitEl.options).forEach(option => {
        option.disabled = false;
        option.style.display = '';
      });
    }
  }
  if (catEl) catEl.value = w.category || 'piece_work';
  if (plEl) plEl.value = w.paidLeaves || '';
  if (dwEl) dwEl.value = w.dailyWage || '';

  toggleWorkerTypeFields(category);
  document.getElementById('w-delete-btn').classList.remove('hidden');
  modal.classList.add('open');
}

function deleteWorker() {
  if (!editingWorkerId) return;
  const w = workerById(editingWorkerId);
  if (!w) return;

  const workerEntries    = getAllEntries().filter(e => e.workerId === w.id);
  const workerAttendance = getAllAttendance().filter(a => a.workerId === w.id);
  const workerMaintenance = maintenance.filter(m => m.workerId === w.id);
  const totalRecords = workerEntries.length + workerAttendance.length + workerMaintenance.length;

  // Step 1: warn — CSV downloads now, PDF will follow separately
  const proceed = confirm(
    `⚠ DELETE WORKER: ${w.name} (${w.empId || w.id})\n\n` +
    `This will permanently remove:\n` +
    `  • ${workerEntries.length} work entries\n` +
    `  • ${workerAttendance.length} attendance records\n` +
    `  • ${workerMaintenance.length} maintenance records\n\n` +
    `CSV + PDF backups will be saved to your downloads.\n` +
    `Click OK to continue.`
  );
  if (!proceed) return;

  // CSV downloads immediately (synchronous, in this user-gesture context)
  downloadWorkerBackup(w, workerEntries, workerAttendance, workerMaintenance);

  // Step 2: final confirm
  const confirmDelete = confirm(
    `CSV backup downloaded for ${w.name}.\n\n` +
    `FINAL CONFIRMATION — permanently delete this worker and all ${totalRecords} records?\n\n` +
    `This cannot be undone.`
  );
  if (!confirmDelete) return;

  workers = workers.filter(x => x.id !== editingWorkerId);
  unit1Entries    = unit1Entries.filter(x => x.workerId !== editingWorkerId);
  unit2Entries    = unit2Entries.filter(x => x.workerId !== editingWorkerId);
  unit3Entries    = unit3Entries.filter(x => x.workerId !== editingWorkerId);
  unit4Entries    = unit4Entries.filter(x => x.workerId !== editingWorkerId);
  unit1Attendance = unit1Attendance.filter(x => x.workerId !== editingWorkerId);
  unit2Attendance = unit2Attendance.filter(x => x.workerId !== editingWorkerId);
  unit3Attendance = unit3Attendance.filter(x => x.workerId !== editingWorkerId);
  unit4Attendance = unit4Attendance.filter(x => x.workerId !== editingWorkerId);
  maintenance     = maintenance.filter(x => x.workerId !== editingWorkerId);

  save();
  closeModal('modal-worker');
  renderAll();
  showToast(`${w.name} deleted. PDF backup downloading...`);

  // PDF downloads in a new task — browser allows only one programmatic download
  // per synchronous execution, so we defer this with setTimeout
  setTimeout(() => downloadWorkerBackupPDF(w, workerEntries, workerAttendance, workerMaintenance), 300);
}

function downloadWorkerBackup(w, entries, attendance, maintenanceRecs) {
  const lines = [];

  // Worker profile
  lines.push('=== WORKER PROFILE ===');
  lines.push('id,empId,phone,name,unit,category,salary,paidLeaves,dailyWage,flatAmount,otRate');
  lines.push([
    w.id, w.empId || '', w.phone || '',
    '"' + (w.name || '').replace(/"/g, '""') + '"',
    w.unit || '', w.category || '',
    w.salary || 0, w.paidLeaves || 0, w.dailyWage || 0, w.flatAmount || 0, w.otRate || 0
  ].join(','));

  // Work entries
  lines.push('');
  lines.push('=== WORK ENTRIES (' + entries.length + ' records) ===');
  lines.push('id,date,category,assignedMorning,assignedAfternoon,assignedTotal,output,notCompleted,rate,pieces,packRate,wage');
  entries.forEach(e => {
    lines.push([
      e.id, e.date, e.category || '',
      e.assignedMorning || 0, e.assignedAfternoon || 0, e.assignedTotal || 0,
      e.output || 0, e.notCompleted || 0, e.rate || 0, e.pieces || 0, e.packRate || 0, e.wage || 0
    ].join(','));
  });

  // Attendance
  lines.push('');
  lines.push('=== ATTENDANCE (' + attendance.length + ' records) ===');
  lines.push('id,date,status,otHours,otAmount,advance');
  attendance.forEach(a => {
    lines.push([a.id || '', a.date, a.status || '', a.otHours || 0, a.otAmount || 0, a.advance || 0].join(','));
  });

  // Maintenance
  if (maintenanceRecs.length > 0) {
    lines.push('');
    lines.push('=== MAINTENANCE RECORDS (' + maintenanceRecs.length + ' records) ===');
    lines.push('id,date,homeUnit,homeCategory,workDescription,wageAmount,otHours,otAmount,advance');
    maintenanceRecs.forEach(m => {
      lines.push([
        m.id || '', m.date, m.homeUnit || '', m.homeCategory || '',
        '"' + (m.workDescription || '').replace(/"/g, '""') + '"',
        m.wageAmount || 0, m.otHours || 0, m.otAmount || 0, m.advance || 0
      ].join(','));
    });
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'backup_' + (w.name || w.id).replace(/\s+/g, '_') + '_' + (w.empId || w.id) + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadWorkerBackupPDF(w, entries, attendance, maintenanceRecs) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('PDF library not ready — CSV backup was saved');
    return;
  }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const catLabels = {
      piece_work: 'Piece Work', monthly_salary: 'Monthly Salary',
      bundle_packing: 'Bundle Packing', cover_packing: 'Cover Packing', daily_wages: 'Daily Wages'
    };
    const unitLabels = { unit1: 'Unit 1', unit2: 'Unit 2', unit3: 'Unit 3', unit4: 'Unit 4' };

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFillColor(241, 243, 244);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(184, 134, 11);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('WageTrack — Worker Backup', 15, 20);
    doc.setTextColor(60, 64, 67);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(
      (w.name || '') + '  |  ' + (w.empId || w.id) + '  |  ' +
      (unitLabels[w.unit] || w.unit || '') + '  |  ' + (catLabels[w.category] || w.category || ''),
      15, 29
    );
    doc.text('Backup Generated: ' + new Date().toLocaleString(), 15, 36);

    let yPos = 50;

    // ── Worker Profile ───────────────────────────────────────────────────────
    doc.setFillColor(255, 255, 255); doc.setDrawColor(218, 220, 224);
    doc.rect(15, yPos, 180, 20, 'FD');
    const profileCols = [
      ['SALARY',      w.salary     ? 'Rs.' + w.salary.toLocaleString()    : '—', 20],
      ['DAILY WAGE',  w.dailyWage  ? 'Rs.' + w.dailyWage + '/day'         : '—', 57],
      ['OT RATE',     w.otRate     ? 'Rs.' + w.otRate + '/hr'             : '—', 97],
      ['PAID LEAVES', w.paidLeaves ? w.paidLeaves + ' days'               : '—', 133],
      ['PHONE',       w.phone      || '—',                                       168]
    ];
    profileCols.forEach(([label, val, x]) => {
      doc.setTextColor(184, 134, 11); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(label, x, yPos + 6);
      doc.setTextColor(32, 33, 36); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(String(val), x, yPos + 14);
    });
    yPos += 26;

    // ── Summary totals ───────────────────────────────────────────────────────
    const totalWage  = entries.reduce((s, e) => s + Number(e.wage || 0), 0);
    const totalOT    = attendance.reduce((s, a) => s + Number(a.otAmount || 0), 0);
    const totalAdv   = attendance.reduce((s, a) => s + Number(a.advance || 0), 0);
    const totalMaint = maintenanceRecs.reduce((s, m) => s + Number(m.wageAmount || 0), 0);
    const totalNet   = totalWage + totalOT + totalMaint - totalAdv;
    const presentDays = attendance.filter(a => isWorking(a.status)).length;

    doc.setFillColor(255, 255, 255); doc.setDrawColor(218, 220, 224);
    doc.rect(15, yPos, 180, 18, 'FD');
    [
      ['WORK ENTRIES',    String(entries.length),    20],
      ['ATTENDANCE DAYS', String(attendance.length), 62],
      ['PRESENT DAYS',    String(presentDays),       104],
      ['TOTAL EARNINGS',  'Rs.' + totalNet.toLocaleString(), 148]
    ].forEach(([label, val, x]) => {
      doc.setTextColor(184, 134, 11); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(label, x, yPos + 6);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      if (label === 'TOTAL EARNINGS') doc.setTextColor(30, 126, 52);
      else doc.setTextColor(32, 33, 36);
      doc.text(val, x, yPos + 14);
    });
    yPos += 24;

    const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

    // ── Attendance Table ─────────────────────────────────────────────────────
    if (attendance.length > 0) {
      doc.setTextColor(184, 134, 11);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('ATTENDANCE RECORD', 15, yPos); yPos += 4;
      const statusLabel = { present: 'Present', absent: 'Absent', forenoon: 'Forenoon', afternoon: 'Afternoon' };
      doc.autoTable({
        startY: yPos,
        head: [['Date', 'Status', 'OT Hours', 'OT Amount', 'Advance']],
        body: [...attendance]
          .sort((a, b) => normalizeDate(a.date) > normalizeDate(b.date) ? 1 : -1)
          .map(a => [
            fmtDate(a.date),
            statusLabel[a.status] || a.status || '',
            a.otHours  ? a.otHours + ' hrs' : '—',
            a.otAmount ? 'Rs.' + a.otAmount  : '—',
            a.advance  ? 'Rs.' + a.advance   : '—'
          ]),
        margin: { left: 15, right: 15 },
        headStyles: { fillColor: [184, 134, 11], textColor: [255, 255, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7, textColor: [60, 64, 67] },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        styles: { lineColor: [218, 220, 224], lineWidth: 0.1, cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 32 }, 2: { cellWidth: 28 }, 3: { cellWidth: 32 }, 4: { cellWidth: 30 } },
        theme: 'grid'
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // ── Work Entries Table ───────────────────────────────────────────────────
    if (entries.length > 0) {
      if (yPos > 230) { doc.addPage(); yPos = 20; }
      doc.setTextColor(184, 134, 11);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('WORK ENTRIES', 15, yPos); yPos += 4;
      doc.autoTable({
        startY: yPos,
        head: [['Date', 'Category', 'Assigned', 'Output', 'Not Done', 'Rate', 'Wage']],
        body: [...entries]
          .sort((a, b) => normalizeDate(a.date) > normalizeDate(b.date) ? 1 : -1)
          .map(e => [
            fmtDate(e.date),
            catLabels[e.category] || e.category || '',
            e.assignedTotal || e.assigned || 0,
            e.output || 0,
            e.notCompleted || 0,
            e.rate ? 'Rs.' + e.rate : '—',
            'Rs.' + (e.wage || 0).toLocaleString()
          ]),
        margin: { left: 15, right: 15 },
        headStyles: { fillColor: [184, 134, 11], textColor: [255, 255, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7, textColor: [60, 64, 67] },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        styles: { lineColor: [218, 220, 224], lineWidth: 0.1, cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 36 }, 2: { cellWidth: 22 }, 3: { cellWidth: 22 }, 4: { cellWidth: 20 }, 5: { cellWidth: 24 }, 6: { cellWidth: 24 } },
        theme: 'grid'
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // ── Maintenance Table ────────────────────────────────────────────────────
    if (maintenanceRecs.length > 0) {
      if (yPos > 230) { doc.addPage(); yPos = 20; }
      doc.setTextColor(251, 146, 60);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('MAINTENANCE RECORDS', 15, yPos); yPos += 4;
      doc.autoTable({
        startY: yPos,
        head: [['Date', 'Work Description', 'OT', 'Payment']],
        body: [...maintenanceRecs]
          .sort((a, b) => normalizeDate(a.date) > normalizeDate(b.date) ? 1 : -1)
          .map(m => [
            fmtDate(m.date),
            m.workDescription || '—',
            m.otHours ? m.otHours + ' hrs' : '—',
            'Rs.' + (m.wageAmount || 0).toLocaleString()
          ]),
        margin: { left: 15, right: 15 },
        headStyles: { fillColor: [251, 146, 60], textColor: [255, 255, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7, textColor: [60, 64, 67] },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        styles: { lineColor: [218, 220, 224], lineWidth: 0.1, cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 95 }, 2: { cellWidth: 22 }, 3: { cellWidth: 27 } },
        theme: 'grid'
      });
      yPos = doc.lastAutoTable.finalY + 8;
    }

    // ── Total bar ────────────────────────────────────────────────────────────
    if (yPos > 265) { doc.addPage(); yPos = 20; }
    doc.setFillColor(184, 134, 11);
    doc.rect(15, yPos, 180, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    const breakdown = 'Wage: Rs.' + totalWage.toLocaleString() +
      '  +OT: Rs.' + totalOT.toLocaleString() +
      (totalMaint ? '  +Maint: Rs.' + totalMaint.toLocaleString() : '') +
      '  −Adv: Rs.' + totalAdv.toLocaleString() +
      '  =  NET: Rs.' + totalNet.toLocaleString();
    doc.text(breakdown, 20, yPos + 7);

    const filename = 'backup_' + (w.name || w.id).replace(/\s+/g, '_') + '_' + (w.empId || w.id) + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
    doc.save(filename);
  } catch (err) {
    console.error('PDF backup failed:', err);
    showToast('PDF generation failed — CSV backup was saved');
  }
}

function toggleWorkerTypeFields(type) {
  // If no type passed, read from w-category dropdown
  if (!type) {
    const catEl = document.getElementById('w-category');
    type = catEl ? catEl.value : 'piece_work';
  }

  // Hide all groups first
  const groups = ['w-salary-group', 'w-daily-group', 'w-packing-group'];
  groups.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Show correct group based on category
  if (type === 'monthly_salary') {
    const el = document.getElementById('w-salary-group');
    if (el) el.classList.remove('hidden');
  } else if (type === 'bundle_packing' || type === 'cover_packing') {
    const el = document.getElementById('w-packing-group');
    if (el) el.classList.remove('hidden');
  } else if (type === 'piece_work' || type === 'daily_wages') {
    const el = document.getElementById('w-daily-group');
    if (el) el.classList.remove('hidden');
  }
}

// ── ENTRIES ──────────────────────────────────────────────────────────────────
function switchProductionTab(type) {
  currentProductionTab = type;
  document.querySelectorAll('#screen-home .report-tab').forEach(t => t.classList.remove('active'));
  const tabIds = {
    all: 'prod-tab-all',
    unit1: 'prod-tab-1',
    unit2: 'prod-tab-2',
    unit3: 'prod-tab-3',
    unit4: 'prod-tab-4',
    maintenance: 'prod-tab-maintenance'
  };
  const target = document.getElementById(tabIds[type]);
  if (target) target.classList.add('active');
  updateActionButtons();
  renderTodayEntries();
}

function renderTodayEntries() {
  const list = document.getElementById('today-entries-list');
  if (!list) return;
  list.innerHTML = '';

  const today = todayStr();
  const workerDailyMap = {};

  const allEntries = getAllEntries();
  const allAttendance = getAllAttendance();

  // 1. Collect all active workers for the current tab
  let activeWorkers = [];
  if (currentProductionTab === 'maintenance') {
    // Maintenance tab shows workers who have maintenance entries today
    const workersWithMaintenance = new Set(
      maintenance.filter(e => normalizeDate(e.date) === today).map(e => e.workerId)
    );
    activeWorkers = workers.filter(w => workersWithMaintenance.has(w.id));
  } else if (currentProductionTab === 'all') {
    // Show only workers who have attendance or entries today
    const workersWithActivity = new Set([
      ...allAttendance.filter(a => normalizeDate(a.date) === today).map(a => a.workerId),
      ...allEntries.filter(e => normalizeDate(e.date) === today).map(e => e.workerId)
    ]);
    activeWorkers = workers.filter(w => workersWithActivity.has(w.id));
  } else {
    // Unit 1, 2, 3, 4 tabs show workers assigned to that unit
    activeWorkers = workers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
      return workerUnit === currentProductionTab;
    });
  }

  // 2. Process each active worker
  activeWorkers.forEach(w => {
    // For maintenance tab, show maintenance entries
    if (currentProductionTab === 'maintenance') {
      const maintenanceEntries = maintenance.filter(e => e.workerId === w.id && normalizeDate(e.date) === today);

      maintenanceEntries.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'list-item reveal';
        card.innerHTML = `
          <div class="item-icon">🔧</div>
          <div class="item-main">
            <div class="item-title" style="font-weight:700; color:var(--text-bright);">${w.name} <span class="badge" style="background:rgba(251,146,60,0.2); color:#fb923c;">MAINTENANCE</span></div>
            <div class="item-sub" style="font-size:11px; color:var(--text-muted);">${entry.workDescription || entry.workDesc || 'No description'}</div>
            <div style="margin-top:4px; display:flex; gap:8px;">
              <span class="badge-mini">Home: ${(entry.homeUnit || 'unit1').replace('unit', 'Unit ')}</span>
            </div>
          </div>
          <div class="item-right">
            <div class="item-value" style="font-size:18px; font-weight:800; color:var(--accent);">₹${entry.wageAmount || entry.wage || 0}</div>
            <div class="item-label" style="font-size:9px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">amount</div>
          </div>
        `;
        card.onclick = () => editEntry(entry.id);
        list.appendChild(card);
      });
      return;
    }

    const att = allAttendance.find(a => a.workerId === w.id && normalizeDate(a.date) === today);
    const wEntries = allEntries.filter(e => e.workerId === w.id && normalizeDate(e.date) === today);

    // Filter entries based on tab
    let filteredEntries = wEntries;
    if (currentProductionTab !== 'all') {
      filteredEntries = wEntries.filter(e => !e.workDesc);
    }

    const pieceWage = filteredEntries.reduce((s, e) => s + (e.wage || 0), 0);
    const otAmount = att ? (att.otAmount || 0) : 0;
    const advance = att ? (att.advance || 0) : 0;
    const status = att ? att.status : 'absent';

    let baseSalary = 0;
    if ((w.category === 'monthly_salary' || w.type === 'permanent') && isWorking(status)) {
      const monthDays = getMonthDays(today);
      baseSalary = Math.round(((w.salary || 0) / monthDays) * (isHalfDay(status) ? 0.5 : 1));
    }
    if (w.category === 'daily_wages' && isWorking(status)) {
      baseSalary = Math.round((w.dailyWage || 0) * (isHalfDay(status) ? 0.5 : 1));
    }

    const total = baseSalary + pieceWage + otAmount;

    // Show if there is any financial activity or they are marked present
    if (total > 0 || advance > 0 || isWorking(status) || currentProductionTab !== 'all') {
      const card = document.createElement('div');
      card.className = 'list-item reveal';
      const categoryLabel = (w.category || w.type || 'piece_work').replace('_', ' ').toUpperCase();
      card.innerHTML = `
        <div class="item-icon">${w.emoji || '👷'}</div>
        <div class="item-main">
          <div class="item-title" style="font-weight:700; color:var(--text-bright);">${w.name} <span class="badge ${status}">${status.toUpperCase()}</span></div>
          <div class="item-sub" style="font-size:11px; color:var(--text-muted);">${w.empId} · ${(w.unit || 'unit1').toUpperCase()} · ${categoryLabel}</div>
          <div style="margin-top:4px; display:flex; gap:8px;">
            ${baseSalary > 0 ? `<span class="badge-mini">Sal: ₹${baseSalary}</span>` : ''}
            ${pieceWage > 0 ? `<span class="badge-mini">Work: ₹${pieceWage}</span>` : ''}
            ${otAmount > 0 ? `<span class="badge-mini">OT: ₹${otAmount}</span>` : ''}
          </div>
        </div>
        <div class="item-right">
          <div class="item-value" style="font-size:18px; font-weight:800; color:var(--accent);">₹${total}</div>
          ${advance > 0 ? `<div class="item-label" style="color:var(--accent); font-size:9px; text-transform:uppercase; font-weight:700;">Adv: ₹${advance}</div>` : '<div class="item-label" style="font-size:9px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">total</div>'}
        </div>
      `;
      card.onclick = () => editWorkForToday(w.id);
      list.appendChild(card);
    }
  });

  if (list.innerHTML === '') {
    list.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:12px;">No activity for this section today</div>';
  }

  // Update Dashboard
  let totalKg = 0, totalNetWage = 0;
  let activeCount = 0;

  workers.forEach(w => {
    const att = allAttendance.find(a => a.workerId === w.id && normalizeDate(a.date) === today);
    const wEntries = allEntries.filter(e => e.workerId === w.id && normalizeDate(e.date) === today);

    if (att || wEntries.length > 0) {
      activeCount++;
      const pieceWage = wEntries.reduce((s, e) => s + (e.wage || 0), 0);
      const otAmount = att ? (att.otAmount || 0) : 0;
      const advance = att ? (att.advance || 0) : 0;
      const status = att ? att.status : 'absent';

      let baseSalary = 0;
      if ((w.category === 'monthly_salary' || w.type === 'permanent') && isWorking(status)) {
        const monthDays = getMonthDays(today);
        baseSalary = Math.round(((w.salary || 0) / monthDays) * (isHalfDay(status) ? 0.5 : 1));
      }
      if (w.category === 'daily_wages' && isWorking(status)) {
        baseSalary = Math.round((w.dailyWage || 0) * (isHalfDay(status) ? 0.5 : 1));
      }

      totalNetWage += (baseSalary + pieceWage + otAmount - advance);

      if ((w.category !== 'bundle_packing' && w.category !== 'cover_packing' && w.type !== 'packing') && w.type !== 'other') {
        wEntries.forEach(e => { if (!e.workDesc) totalKg += (e.output || 0); });
      }
    }
  });

  const dashW = document.getElementById('dash-active-workers'), dashOut = document.getElementById('dash-total-kg'), dashWage = document.getElementById('dash-total-wage');
  if (dashW) dashW.textContent = `${activeCount} / ${workers.length}`;
  if (dashOut) dashOut.textContent = totalKg > 0 ? totalKg.toLocaleString() + ' kg' : '0';
  if (dashWage) dashWage.innerHTML = `<span style="font-size: 14px; color: var(--accent2);">₹</span>${totalNetWage.toLocaleString()}`;
}


function editWorkForToday(wid) {
  const today = todayStr();
  const entry = getAllEntries().find(e => normalizeDate(e.date) === today && e.workerId === wid);
  if (entry) {
    editEntry(entry.id);
  } else {
    const w = workerById(wid);
    if (!w) return;

    openAddEntry();

    // 1. Get worker unit & category
    const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
    const workerCat = w.category || (w.type === 'permanent' ? 'monthly_salary' : w.type === 'packing' ? 'bundle_packing' : w.type === 'other' ? 'daily_wages' : 'piece_work');

    // 2. Select Unit
    const unitSel = document.getElementById('e-unit-type');
    if (unitSel) {
      unitSel.value = workerUnit;
      unitSel.dispatchEvent(new Event('change'));
    }

    // 3. Select Category
    const catSel = document.getElementById('e-category');
    if (catSel) {
      catSel.value = workerCat;
      catSel.dispatchEvent(new Event('change'));
    }

    // 4. Select Worker
    const workerSel = document.getElementById('e-worker');
    if (workerSel) {
      workerSel.value = wid;
      workerSel.dispatchEvent(new Event('change'));
    }
  }
}

function populateUnitDropdown() {
  const unitTypeSelect = document.getElementById('e-unit-type');
  if (!unitTypeSelect) return;
  unitTypeSelect.innerHTML = '<option value="">-- Select Unit --</option>';

  if (currentUser.role === 'admin') {
    unitTypeSelect.innerHTML += `
      <option value="unit1">Unit 1</option>
      <option value="unit2">Unit 2</option>
      <option value="unit3">Unit 3</option>
      <option value="unit4">Unit 4</option>
      <option value="maintenance">Maintenance</option>
    `;
  } else if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    accessible.forEach(unit => {
      const unitNum = unit.replace('unit', '');
      unitTypeSelect.innerHTML += `<option value="${unit}">Unit ${unitNum}</option>`;
    });
    if (hasMaintenancePermission()) {
      unitTypeSelect.innerHTML += `<option value="maintenance">Maintenance</option>`;
    }
  }
}

function openAddEntry() {
  if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    if (currentProductionTab === 'all') {
      const hasAnyAccess = accessible.some(unit => hasActionPermission(unit, 'payment') || hasActionPermission(unit, 'work'));
      if (!hasAnyAccess) {
        showToast('Permission Denied');
        return;
      }
    } else {
      if (!hasActionPermission(currentProductionTab, 'payment') && !hasActionPermission(currentProductionTab, 'work')) {
        showToast('Permission Denied');
        return;
      }
    }
  }
  addEntry();
}

function addEntry() {
  document.getElementById('e-id').value = '';
  document.getElementById('e-delete-btn').classList.add('hidden');
  document.getElementById('entry-modal-title').textContent = 'Add Daily Entry';

  // Clear all fields
  ['e-assigned-morning', 'e-assigned-afternoon', 'e-output-kg', 'e-not-completed', 'e-rate', 'e-pack-pieces', 'e-pack-rate', 'e-pack-amount', 'e-work-name', 'e-payment'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Setup unit type dropdown based on permissions
  populateUnitDropdown();

  const unitTypeSelect = document.getElementById('e-unit-type');
  if (unitTypeSelect) {
    unitTypeSelect.disabled = false;
    unitTypeSelect.value = '';
  }

  // Clear category dropdown & hide category group
  const categorySelect = document.getElementById('e-category');
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    categorySelect.disabled = true;
  }
  const categoryGroup = document.getElementById('e-category-group');
  if (categoryGroup) categoryGroup.classList.add('hidden');

  // Clear worker dropdown
  const workerSelect = document.getElementById('e-worker');
  if (workerSelect) {
    workerSelect.innerHTML = '<option value="">-- Select Worker --</option>';
    workerSelect.disabled = true;
  }

  document.getElementById('e-date').value = todayStr();

  // Hide all entry fields initially
  ['e-kg-fields', 'e-kg-fields-2', 'e-kg-sync-row', 'e-rate-field', 'e-packing-pieces', 'e-work-desc', 'e-payment-field'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  document.getElementById('modal-entry').classList.add('open');
}

function onUnitTypeChange() {
  const selectedUnit = document.getElementById('e-unit-type').value;
  const categorySelect = document.getElementById('e-category');
  const categoryGroup = document.getElementById('e-category-group');
  const workerSelect = document.getElementById('e-worker');

  // Reset dependents
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    categorySelect.disabled = true;
  }
  if (workerSelect) {
    workerSelect.innerHTML = '<option value="">-- Select Worker --</option>';
    workerSelect.disabled = true;
  }

  // Hide details fields initially
  ['e-kg-fields', 'e-kg-fields-2', 'e-kg-sync-row', 'e-rate-field', 'e-packing-pieces', 'e-work-desc', 'e-payment-field'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  if (!selectedUnit) {
    if (categoryGroup) categoryGroup.classList.add('hidden');
    return;
  }

  if (selectedUnit === 'maintenance') {
    if (categoryGroup) categoryGroup.classList.add('hidden');

    // For maintenance, show all workers from all units directly
    const unitWorkers = workers;
    workerSelect.innerHTML = '<option value="" selected disabled>-- Select Worker --</option>' + unitWorkers.map(w => {
      const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
      const unitLabel = workerUnit.toUpperCase().replace('UNIT', 'Unit ');
      return `<option value="${w.id}">${w.name} (${w.empId} · ${unitLabel})</option>`;
    }).join('');
    workerSelect.disabled = false;

    // Toggle maintenance fields
    toggleEntryFields('maintenance');

    const hasPaymentPerm = currentUser.role === 'admin' || hasActionPermission('maintenance', 'payment');
    const paymentField = document.getElementById('e-payment');
    if (paymentField) paymentField.readOnly = !hasPaymentPerm;

    calcPreview();
  } else {
    // Show category group
    if (categoryGroup) categoryGroup.classList.remove('hidden');
    if (categorySelect) {
      categorySelect.disabled = false;

      const allCats = [
        { value: 'piece_work', label: 'Piece Work' },
        { value: 'bundle_packing', label: 'Bundle Packing' },
        { value: 'cover_packing', label: 'Cover Packing' },
        { value: 'daily_wages', label: 'Daily Wages' },
        { value: 'monthly_salary', label: 'Monthly Salary' }
      ];
      categorySelect.innerHTML = '<option value="">-- Select Category --</option>' +
        allCats.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    }
  }
}

function onCategoryChange() {
  const selectedUnit = document.getElementById('e-unit-type').value;
  const selectedCategory = document.getElementById('e-category').value;
  const workerSelect = document.getElementById('e-worker');

  if (!workerSelect) return;

  if (!selectedCategory) {
    workerSelect.innerHTML = '<option value="">-- Select Worker --</option>';
    workerSelect.disabled = true;

    // Hide details fields
    ['e-kg-fields', 'e-kg-fields-2', 'e-kg-sync-row', 'e-rate-field', 'e-packing-pieces', 'e-work-desc', 'e-payment-field'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    return;
  }

  // Filter workers by both unit and category
  const unitWorkers = workers.filter(w => {
    const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
    const wCat = w.category || (w.type === 'permanent' ? 'monthly_salary' : w.type === 'packing' ? 'bundle_packing' : w.type === 'other' ? 'daily_wages' : 'piece_work');
    return workerUnit === selectedUnit && wCat === selectedCategory;
  });

  if (unitWorkers.length === 0) {
    workerSelect.innerHTML = '<option value="">No workers in this category</option>';
    workerSelect.disabled = true;

    // Hide details fields
    ['e-kg-fields', 'e-kg-fields-2', 'e-kg-sync-row', 'e-rate-field', 'e-packing-pieces', 'e-work-desc', 'e-payment-field'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    showToast('No workers found for this category');
    return;
  }

  workerSelect.innerHTML = '<option value="" selected disabled>-- Select Worker --</option>' + unitWorkers.map(w => {
    return `<option value="${w.id}">${w.name} (${w.empId})</option>`;
  }).join('');
  workerSelect.disabled = false;

  // Toggle the details fields based on selected category
  toggleEntryFields(selectedCategory);

  // Set readonly based on payment permission for the selected unit
  const hasPaymentPerm = currentUser.role === 'admin' || hasActionPermission(selectedUnit, 'payment');
  const rateField = document.getElementById('e-rate');
  const packRateField = document.getElementById('e-pack-rate');
  const packAmountField = document.getElementById('e-pack-amount');
  const paymentField = document.getElementById('e-payment');

  if (rateField) rateField.readOnly = !hasPaymentPerm;
  if (packRateField) packRateField.readOnly = !hasPaymentPerm;
  if (packAmountField) packAmountField.readOnly = !hasPaymentPerm;
  if (paymentField) paymentField.readOnly = !hasPaymentPerm;

  // Auto-select first worker if only one
  if (unitWorkers.length === 1) {
    workerSelect.value = unitWorkers[0].id;
    onWorkerChange();
  } else {
    calcPreview();
  }
}

function onWorkerChange() {
  const workerSelect = document.getElementById('e-worker');
  const w = workerById(workerSelect.value);
  if (!w) return;

  const selectedCategory = document.getElementById('e-category').value || w.category || 'piece_work';

  // Auto-populate defaults based on category
  if (selectedCategory === 'bundle_packing' || selectedCategory === 'cover_packing' || selectedCategory === 'packing') {
    const rateInput = document.getElementById('e-pack-rate');
    const amountInput = document.getElementById('e-pack-amount');
    if (rateInput && amountInput) {
      rateInput.value = w.flatAmount || '';
      amountInput.value = '';
    }
  } else {
    const rateInput = document.getElementById('e-rate');
    if (rateInput && (w.category === 'piece_work' || w.category === 'monthly_salary' || w.type === 'daily' || w.type === 'permanent')) {
      rateInput.value = w.flatAmount || w.salary || w.dailyWage || '';
    }
  }
  calcPreview();
}

function editEntry(id) {
  const allEntries = [...getAllEntries(), ...maintenance];
  const e = allEntries.find(x => x.id === id);
  if (!e) return;
  const w = workerById(e.workerId);
  if (!w) return;

  document.getElementById('e-id').value = e.id;
  document.getElementById('entry-modal-title').textContent = 'Update Work Entry';

  // Setup unit type dropdown first
  populateUnitDropdown();

  // Determine if this is a maintenance entry
  const isMaintenance = maintenance.some(m => m.id === id);

  // Set unit type
  const workerUnit = isMaintenance ? 'maintenance' : (w.unit || getProdKey(w.category || w.type || 'daily'));
  const unitTypeSelect = document.getElementById('e-unit-type');
  if (unitTypeSelect) {
    unitTypeSelect.value = workerUnit;
    unitTypeSelect.disabled = true;
  }

  // Determine entry type
  let entryType = 'piece_work';
  if (isMaintenance) {
    entryType = 'maintenance';
  } else {
    entryType = e.homeCategory || w.category || 'piece_work';
    if (!w.category && w.type) {
      const typeMap = {
        'daily': 'piece_work',
        'permanent': 'monthly_salary',
        'packing': 'bundle_packing',
        'other': 'daily_wages'
      };
      entryType = typeMap[w.type] || 'piece_work';
    }
  }

  const categorySelect = document.getElementById('e-category');
  const categoryGroup = document.getElementById('e-category-group');

  if (isMaintenance) {
    if (categoryGroup) categoryGroup.classList.add('hidden');
  } else {
    if (categoryGroup) {
      categoryGroup.classList.remove('hidden');
      if (categorySelect) {
        categorySelect.disabled = true; // Disable selection when editing

        const allCats = [
          { value: 'piece_work', label: 'Piece Work' },
          { value: 'bundle_packing', label: 'Bundle Packing' },
          { value: 'cover_packing', label: 'Cover Packing' },
          { value: 'daily_wages', label: 'Daily Wages' },
          { value: 'monthly_salary', label: 'Monthly Salary' }
        ];

        categorySelect.innerHTML = allCats.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        categorySelect.value = entryType;
      }
    }
  }

  // Set worker
  const sel = document.getElementById('e-worker');
  const unitLabel = workerUnit.toUpperCase().replace('UNIT', 'Unit ');
  sel.innerHTML = `<option value="${w.id}">${w.name} (${w.empId} · ${unitLabel})</option>`;
  sel.value = w.id;
  sel.disabled = true; // Don't allow changing worker when editing

  document.getElementById('e-date').value = e.date;

  toggleEntryFields(entryType);

  if (entryType === 'bundle_packing' || entryType === 'cover_packing') {
    document.getElementById('e-pack-pieces').value = e.output || '';
    document.getElementById('e-pack-rate').value = e.rate || '';

    // Check if it was a flat amount (wage doesn't match pieces * rate)
    const pieces = e.output || 0;
    const rate = e.rate || 0;
    const calcWage = Math.round(pieces * rate);
    if (e.wage && Math.round(e.wage) !== calcWage) {
      document.getElementById('e-pack-amount').value = e.wage;
    } else {
      document.getElementById('e-pack-amount').value = '';
    }
  } else if (entryType === 'other' || entryType === 'daily_wages' || entryType === 'maintenance') {
    document.getElementById('e-work-name').value = e.workDesc || e.workDescription || '';
    document.getElementById('e-payment').value = e.wage || e.wageAmount || '';
  } else {
    document.getElementById('e-assigned-morning').value = e.mAssigned || '';
    document.getElementById('e-assigned-afternoon').value = e.aAssigned || '';
    document.getElementById('e-output-kg').value = e.output || '';
    document.getElementById('e-not-completed').value = e.notCompleted !== undefined ? e.notCompleted : (e.assigned - e.output);
    document.getElementById('e-rate').value = e.rate || '';
  }

  document.getElementById('e-delete-btn').classList.remove('hidden');
  calcPreview();
  document.getElementById('modal-entry').classList.add('open');
}

function deleteEntry() {
  const entryId = document.getElementById('e-id').value;
  if (!entryId) return;

  if (confirm('Delete this entry?')) {
    // Check if it's a maintenance entry
    const maintenanceEntry = maintenance.find(e => e.id === entryId);
    if (maintenanceEntry) {
      maintenance = maintenance.filter(e => e.id !== entryId);
      save();
      closeModal('modal-entry');
      renderAll();
      showToast('Maintenance entry deleted');
      return;
    }

    // Otherwise, it's a regular entry
    const allEntries = getAllEntries();
    const entry = allEntries.find(e => e.id === entryId);
    if (entry) {
      const w = workerById(entry.workerId);
      const targetUnit = w ? (w.unit || getProdKey(w.type || 'daily')) : 'unit1';

      // Remove from the correct unit array
      if (targetUnit === 'unit1') {
        unit1Entries = unit1Entries.filter(e => e.id !== entryId);
      } else if (targetUnit === 'unit2') {
        unit2Entries = unit2Entries.filter(e => e.id !== entryId);
      } else if (targetUnit === 'unit3') {
        unit3Entries = unit3Entries.filter(e => e.id !== entryId);
      } else if (targetUnit === 'unit4') {
        unit4Entries = unit4Entries.filter(e => e.id !== entryId);
      }
    }
    save();
    closeModal('modal-entry');
    renderAll();
    showToast('Entry deleted');
  }
}

function toggleEntryFields(entryType) {
  ['e-kg-fields', 'e-kg-fields-2', 'e-kg-sync-row', 'e-rate-field', 'e-packing-pieces', 'e-work-desc', 'e-payment-field'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  if (entryType === 'piece_work') {
    // Piece work: show KG fields and rate
    document.getElementById('e-kg-fields').classList.remove('hidden');
    document.getElementById('e-kg-fields-2').classList.remove('hidden');
    document.getElementById('e-kg-sync-row').classList.remove('hidden');
    document.getElementById('e-rate-field').classList.remove('hidden');
  } else if (entryType === 'monthly_salary') {
    // Monthly salary: show KG fields and rate (for tracking output)
    document.getElementById('e-kg-fields').classList.remove('hidden');
    document.getElementById('e-kg-fields-2').classList.remove('hidden');
    document.getElementById('e-kg-sync-row').classList.remove('hidden');
    document.getElementById('e-rate-field').classList.remove('hidden');
  } else if (entryType === 'bundle_packing' || entryType === 'cover_packing') {
    // Packing: show pieces, rate, and flat amount fields
    document.getElementById('e-packing-pieces').classList.remove('hidden');
  } else if (entryType === 'daily_wages' || entryType === 'other') {
    // Daily wages or other: show work description and payment
    document.getElementById('e-work-desc').classList.remove('hidden');
    document.getElementById('e-payment-field').classList.remove('hidden');
  } else if (entryType === 'maintenance') {
    // Maintenance: show work description and payment
    document.getElementById('e-work-desc').classList.remove('hidden');
    document.getElementById('e-payment-field').classList.remove('hidden');
  }

  // Legacy support for old 'type' field
  if (entryType === 'daily' || entryType === 'permanent') {
    document.getElementById('e-kg-fields').classList.remove('hidden');
    document.getElementById('e-kg-fields-2').classList.remove('hidden');
    document.getElementById('e-kg-sync-row').classList.remove('hidden');
    document.getElementById('e-rate-field').classList.remove('hidden');
  } else if (entryType === 'packing') {
    document.getElementById('e-packing-pieces').classList.remove('hidden');
  }
}

function syncKgFromAssigned() {
  const m = parseFloat(document.getElementById('e-assigned-morning').value) || 0;
  const a = parseFloat(document.getElementById('e-assigned-afternoon').value) || 0;
  const total = m + a;
  const output = parseFloat(document.getElementById('e-output-kg').value) || 0;
  document.getElementById('e-not-completed').value = Math.max(0, total - output);
  calcPreview();
}

function syncKgFromOutput() {
  syncKgFromAssigned();
}

function syncKgFromBalance() {
  const m = parseFloat(document.getElementById('e-assigned-morning').value) || 0;
  const a = parseFloat(document.getElementById('e-assigned-afternoon').value) || 0;
  const total = m + a;
  const balance = parseFloat(document.getElementById('e-not-completed').value) || 0;
  document.getElementById('e-output-kg').value = Math.max(0, total - balance);
  calcPreview();
}

function calcPreview() {
  const preview = document.getElementById('wage-preview');
  const workerId = document.getElementById('e-worker').value;
  const w = workerById(workerId);
  if (!w) { preview.style.display = 'none'; return; }

  // Check if maintenance type is selected
  const selectedUnit = document.getElementById('e-unit-type').value;

  // Determine entry type based on worker's category
  let entryType = 'piece_work';
  if (selectedUnit === 'maintenance') {
    entryType = 'maintenance';
  } else {
    entryType = w.category || 'piece_work';
    if (!w.category && w.type) {
      // Legacy type mapping
      const typeMap = {
        'daily': 'piece_work',
        'permanent': 'monthly_salary',
        'packing': 'bundle_packing',
        'other': 'daily_wages'
      };
      entryType = typeMap[w.type] || 'piece_work';
    }
  }

  let wage = 0, text = '';

  if (entryType === 'bundle_packing' || entryType === 'cover_packing') {
    const pieces = parseFloat(document.getElementById('e-pack-pieces').value) || 0;
    let rate = parseFloat(document.getElementById('e-pack-rate').value) || 0;
    let flatAmount = parseFloat(document.getElementById('e-pack-amount').value) || 0;

    // Use worker profile default if UI fields are empty
    if (rate <= 0 && flatAmount <= 0 && w.flatAmount > 0) {
      rate = w.flatAmount;
    }

    if (flatAmount > 0) {
      wage = flatAmount;
      text = `Flat Amount: ₹${flatAmount}`;
    } else {
      wage = pieces * rate;
      text = `${pieces} items × ₹${rate}`;
    }
  } else if (entryType === 'other' || entryType === 'daily_wages' || entryType === 'maintenance') {
    wage = parseFloat(document.getElementById('e-payment').value) || 0;
    text = entryType === 'maintenance' ? 'Maintenance Payment' : 'Custom Payment';
  } else {
    // piece_work or monthly_salary
    const m = parseFloat(document.getElementById('e-assigned-morning').value) || 0;
    const a = parseFloat(document.getElementById('e-assigned-afternoon').value) || 0;
    const bal = parseFloat(document.getElementById('e-not-completed').value) || 0;
    const out = (m + a) - bal;
    const rate = parseFloat(document.getElementById('e-rate').value) || 0;
    wage = out * rate;
    text = `${out} kg × ₹${rate}`;
  }

  if (wage > 0) {
    document.getElementById('preview-amount').textContent = '₹' + Math.round(wage);
    document.getElementById('preview-calc').textContent = text;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

function saveEntry() {
  const entryId = document.getElementById('e-id').value;
  const workerId = document.getElementById('e-worker').value;
  const dateFromUI = document.getElementById('e-date').value;
  const selectedUnit = document.getElementById('e-unit-type').value;

  if (!selectedUnit) {
    showToast('Please select a unit type');
    return;
  }

  if (!workerId) {
    showToast('Please select a worker');
    return;
  }

  const w = workerById(workerId);
  if (!w) return;

  // Use the selected unit from dropdown
  const targetUnit = selectedUnit;

  // Check permissions
  if (targetUnit === 'maintenance') {
    // Check maintenance permission
    if (currentUser.role === 'supervisor' && !hasMaintenancePermission()) {
      showToast('Permission Denied: Maintenance access required');
      return;
    }
  } else {
    // Check unit permissions
    if (!hasActionPermission(targetUnit, 'payment') && !hasActionPermission(targetUnit, 'work')) {
      showToast('Permission Denied');
      return;
    }
  }

  // Determine entry type based on selected unit or category dropdown
  let entryType = 'piece_work';
  if (targetUnit === 'maintenance') {
    entryType = 'maintenance';
  } else {
    entryType = document.getElementById('e-category').value || w.category || 'piece_work';
    if (!document.getElementById('e-category').value && !w.category && w.type) {
      // Legacy type mapping
      const typeMap = {
        'daily': 'piece_work',
        'permanent': 'monthly_salary',
        'packing': 'bundle_packing',
        'other': 'daily_wages'
      };
      entryType = typeMap[w.type] || 'piece_work';
    }
  }

  let wage, assigned, output, rate, mAssigned, aAssigned, notCompleted, workDesc = '';

  if (entryType === 'bundle_packing' || entryType === 'cover_packing') {
    const pieces = parseFloat(document.getElementById('e-pack-pieces').value) || 0;
    let packRate = parseFloat(document.getElementById('e-pack-rate').value) || 0;
    let flatAmount = parseFloat(document.getElementById('e-pack-amount').value) || 0;

    // Default to worker's flatAmount if no entry rate/amount provided
    if (packRate <= 0 && flatAmount <= 0 && w.flatAmount > 0) {
      packRate = w.flatAmount;
    }

    wage = flatAmount > 0 ? Math.round(flatAmount) : Math.round(pieces * packRate);
    assigned = output = mAssigned = pieces;
    aAssigned = notCompleted = 0;
    rate = packRate;
  } else if (entryType === 'other' || entryType === 'daily_wages' || entryType === 'maintenance') {
    workDesc = document.getElementById('e-work-name').value.trim();
    wage = parseFloat(document.getElementById('e-payment').value) || 0;
    assigned = output = rate = mAssigned = aAssigned = notCompleted = 0;
  } else {
    // piece_work or monthly_salary
    mAssigned = parseFloat(document.getElementById('e-assigned-morning').value) || 0;
    aAssigned = parseFloat(document.getElementById('e-assigned-afternoon').value) || 0;
    assigned = mAssigned + aAssigned;
    notCompleted = parseFloat(document.getElementById('e-not-completed').value) || 0;
    output = Math.max(0, assigned - notCompleted);
    rate = parseFloat(document.getElementById('e-rate').value) || 0;
    wage = Math.round(output * rate);
  }

  const allEntries = getAllEntries();
  const existingEntry = allEntries.find(x => x.id === entryId);

  // For maintenance entries, use the exact database column names
  const entryData = {
    id: entryId || uid(),
    workerId,
    workerName: w.name,
    homeUnit: w.unit || getProdKey(w.category || w.type || 'daily'),
    homeCategory: w.category || (w.type === 'permanent' ? 'monthly_salary' : w.type === 'packing' ? 'bundle_packing' : w.type === 'other' ? 'daily_wages' : 'piece_work'),
    category: targetUnit === 'maintenance' ? 'maintenance' : (document.getElementById('e-category').value || w.category || w.type || 'piece_work'),
    date: entryId ? normalizeDate(existingEntry?.date || dateFromUI || todayStr()) : normalizeDate(dateFromUI || todayStr()),
    assigned,
    assignedTotal: assigned,
    output,
    rate,
    wage,
    wageAmount: wage, // Alias for maintenance compatibility
    mAssigned,
    assignedMorning: mAssigned,
    aAssigned,
    assignedAfternoon: aAssigned,
    notCompleted,
    workDescription: workDesc, // For maintenance
    workDesc, // Keep for backward compatibility
    otHours: 0,
    otAmount: 0,
    advance: 0
  };

  // Update the correct unit array based on selected unit
  if (targetUnit === 'maintenance') {
    const existingIdx = maintenance.findIndex(e => e.id === entryData.id);
    if (existingIdx >= 0) maintenance[existingIdx] = entryData;
    else maintenance.push(entryData);
  } else if (targetUnit === 'unit1') {
    const existingIdx = unit1Entries.findIndex(e => e.id === entryData.id);
    if (existingIdx >= 0) unit1Entries[existingIdx] = entryData;
    else unit1Entries.push(entryData);
  } else if (targetUnit === 'unit2') {
    const existingIdx = unit2Entries.findIndex(e => e.id === entryData.id);
    if (existingIdx >= 0) unit2Entries[existingIdx] = entryData;
    else unit2Entries.push(entryData);
  } else if (targetUnit === 'unit3') {
    const existingIdx = unit3Entries.findIndex(e => e.id === entryData.id);
    if (existingIdx >= 0) unit3Entries[existingIdx] = entryData;
    else unit3Entries.push(entryData);
  } else if (targetUnit === 'unit4') {
    const existingIdx = unit4Entries.findIndex(e => e.id === entryData.id);
    if (existingIdx >= 0) unit4Entries[existingIdx] = entryData;
    else unit4Entries.push(entryData);
  }

  save();
  closeModal('modal-entry');
  renderAll();
  showToast('Entry saved successfully ✓');
}

// ── SYNC ─────────────────────────────────────────────────────────────────────
async function syncData() {
  const btn = document.getElementById('sync-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="rotating" style="display:inline-block;">↻</span>`;
  }
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      version: '2.2',
      data: {
        workers,
        unit1Entries, unit2Entries, unit3Entries, unit4Entries,
        unit1Attendance, unit2Attendance, unit3Attendance, unit4Attendance,
        maintenance,
        users
      }
    };
    const success = await sendCloudEmail({
      subject: "WageTrack Full Data Backup: " + new Date().toLocaleString(),
      body: "Complete system backup.",
      jsonContent: backup
    });
    if (success) showToast('✓ Sync Successful');
  } catch (err) {
    showToast('Sync Error: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 12c0-4.4 3.6-8 8-8 3.3 0 6.2 2 7.4 5M22 12c0 4.4-3.6 8-8 8-3.3 0-6.2-2-7.4-5" /></svg>'; }
  }
}

// ── USER MGMT ────────────────────────────────────────────────────────────────
function renderUsers() {
  const list = document.getElementById('users-list');
  if (!list) return;
  const sups = users.filter(u => u.role === 'supervisor');
  if (sups.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">👥</div><div class="empty-text">No supervisors created.<br>Admins can add supervisors here.</div></div>`;
    return;
  }
  list.innerHTML = sups.map(u => {
    const accessSummary = [];
    if (u.access) {
      const unitNames = { unit1: 'Unit 1', unit2: 'Unit 2', unit3: 'Unit 3', unit4: 'Unit 4' };
      Object.keys(u.access).forEach(unit => {
        if (unit === 'maintenance') {
          if (u.access[unit].length > 0) {
            accessSummary.push('🔧 Maintenance');
          }
        } else if (u.access[unit].length > 0) {
          const hasAll = u.access[unit].includes('attendance') && u.access[unit].includes('work') && u.access[unit].includes('payment');
          if (hasAll) {
            accessSummary.push(`${unitNames[unit]}(Full)`);
          } else {
            const perms = u.access[unit].map(p => p === 'attendance' ? 'Att' : p === 'work' ? 'Work' : 'Pay').join('+');
            accessSummary.push(`${unitNames[unit]}(${perms})`);
          }
        }
      });
    }
    const accessText = accessSummary.length > 0 ? accessSummary.join(' · ') : 'No access';

    // Check if user has full access to all units (admin-level)
    const hasFullAccessToAll = u.access &&
      ['unit1', 'unit2', 'unit3', 'unit4'].every(unit =>
        u.access[unit] &&
        u.access[unit].includes('attendance') &&
        u.access[unit].includes('work') &&
        u.access[unit].includes('payment')
      );

    const roleDisplay = hasFullAccessToAll ? 'Supervisor (Admin-level)' : 'Supervisor';

    return `
    <div class="list-item">
      <div class="item-icon">${hasFullAccessToAll ? '👑' : '👤'}</div>
      <div class="item-main">
        <div class="item-title">${u.username}</div>
        <div class="item-sub">${u.gmail || 'No email'} · ${roleDisplay}</div>
        <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">Access: ${accessText}</div>
      </div>
      <button class="pill-btn secondary" onclick="editUser('${u.username}')">Edit</button>
    </div>`;
  }).join('');
}

function openAddUser() {
  document.getElementById('u-username').value = '';
  document.getElementById('u-gmail').value = '';
  document.getElementById('u-password').value = '';
  const perms = document.getElementById('u-perms-list');
  perms.innerHTML = ['unit1', 'unit2', 'unit3', 'unit4'].map((unit, i) => {
    const label = `Unit ${i + 1}`;
    return `
            <div style="margin-bottom:12px; padding:8px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--border);">
                <div style="font-size:12px; font-weight:800; color:var(--accent); margin-bottom:6px;">${label}</div>
                <div style="display:flex; gap:15px; flex-wrap:wrap;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                        <input type="checkbox" class="u-perm-cb u-perm-full" data-prod="${unit}" data-action="full" onchange="toggleFullAccess('${unit}', this.checked)"> <strong>Full Access</strong>
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                        <input type="checkbox" class="u-perm-cb u-perm-individual" data-prod="${unit}" data-action="attendance"> Attendance
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                        <input type="checkbox" class="u-perm-cb u-perm-individual" data-prod="${unit}" data-action="work"> Work
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                        <input type="checkbox" class="u-perm-cb u-perm-individual" data-prod="${unit}" data-action="payment"> Payment
                    </label>
                </div>
            </div>
        `;
  }).join('') + `
        <div style="margin-bottom:12px; padding:8px; background:rgba(251,146,60,0.1); border-radius:8px; border:1px solid rgba(251,146,60,0.3);">
            <div style="font-size:12px; font-weight:800; color:#fb923c; margin-bottom:6px;">🔧 Maintenance Access</div>
            <div style="display:flex; gap:15px; flex-wrap:wrap;">
                <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                    <input type="checkbox" class="u-perm-cb u-perm-maintenance" data-prod="maintenance" data-action="maintenance"> Allow Maintenance Operations
                </label>
            </div>
        </div>
    `;
  document.getElementById('modal-user').classList.add('open');
}

function editUser(username) {
  const u = users.find(x => x.username === username);
  if (!u) return;
  document.getElementById('u-username').value = u.username;
  document.getElementById('u-gmail').value = u.gmail || '';
  document.getElementById('u-password').value = u.password || '';
  const perms = document.getElementById('u-perms-list');
  perms.innerHTML = ['unit1', 'unit2', 'unit3', 'unit4'].map((unit, i) => {
    const label = `Unit ${i + 1}`;
    const hasAtt = u.access && u.access[unit] && u.access[unit].includes('attendance');
    const hasWork = u.access && u.access[unit] && u.access[unit].includes('work');
    const hasPay = u.access && u.access[unit] && u.access[unit].includes('payment');
    const hasFull = hasAtt && hasWork && hasPay;
    return `
            <div style="margin-bottom:12px; padding:8px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--border);">
                <div style="font-size:12px; font-weight:800; color:var(--accent); margin-bottom:6px;">${label}</div>
                <div style="display:flex; gap:15px; flex-wrap:wrap;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                        <input type="checkbox" class="u-perm-cb u-perm-full" data-prod="${unit}" data-action="full" ${hasFull ? 'checked' : ''} onchange="toggleFullAccess('${unit}', this.checked)"> <strong>Full Access</strong>
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                        <input type="checkbox" class="u-perm-cb u-perm-individual" data-prod="${unit}" data-action="attendance" ${hasAtt ? 'checked' : ''}> Attendance
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                        <input type="checkbox" class="u-perm-cb u-perm-individual" data-prod="${unit}" data-action="work" ${hasWork ? 'checked' : ''}> Work
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                        <input type="checkbox" class="u-perm-cb u-perm-individual" data-prod="${unit}" data-action="payment" ${hasPay ? 'checked' : ''}> Payment
                    </label>
                </div>
            </div>
        `;
  }).join('') + `
        <div style="margin-bottom:12px; padding:8px; background:rgba(251,146,60,0.1); border-radius:8px; border:1px solid rgba(251,146,60,0.3);">
            <div style="font-size:12px; font-weight:800; color:#fb923c; margin-bottom:6px;">🔧 Maintenance Access</div>
            <div style="display:flex; gap:15px; flex-wrap:wrap;">
                <label style="display:flex; align-items:center; gap:6px; font-size:11px;">
                    <input type="checkbox" class="u-perm-cb u-perm-maintenance" data-prod="maintenance" data-action="maintenance" ${u.access && u.access.maintenance && u.access.maintenance.includes('maintenance') ? 'checked' : ''}> Allow Maintenance Operations
                </label>
            </div>
        </div>
    `;
  document.getElementById('modal-user').classList.add('open');
}

function toggleFullAccess(unit, isChecked) {
  // Get all individual permission checkboxes for this unit
  const individualCheckboxes = document.querySelectorAll(`.u-perm-individual[data-prod="${unit}"]`);

  if (isChecked) {
    // Check all individual permissions
    individualCheckboxes.forEach(cb => {
      cb.checked = true;
      cb.disabled = true;
    });
  } else {
    // Enable individual permissions for manual selection
    individualCheckboxes.forEach(cb => {
      cb.disabled = false;
    });
  }
}

function saveUser() {
  const username = document.getElementById('u-username').value.trim();
  const gmail = document.getElementById('u-gmail').value.trim();
  const password = document.getElementById('u-password').value.trim();
  if (!username || !password) { showToast('Username and Password required'); return; }

  const access = {};

  // Process each unit
  ['unit1', 'unit2', 'unit3', 'unit4'].forEach(unit => {
    const fullAccessCb = document.querySelector(`.u-perm-full[data-prod="${unit}"]`);
    const isFullAccess = fullAccessCb && fullAccessCb.checked;

    if (isFullAccess) {
      // Grant all permissions for this unit
      access[unit] = ['attendance', 'work', 'payment'];
    } else {
      // Collect only checked individual permissions
      const checkedPerms = [];
      document.querySelectorAll(`.u-perm-individual[data-prod="${unit}"]:checked`).forEach(cb => {
        checkedPerms.push(cb.dataset.action);
      });
      if (checkedPerms.length > 0) {
        access[unit] = checkedPerms;
      }
    }
  });

  // Process maintenance permission
  const maintenanceCb = document.querySelector('.u-perm-maintenance[data-prod="maintenance"]');
  if (maintenanceCb && maintenanceCb.checked) {
    access.maintenance = ['maintenance'];
  }

  const idx = users.findIndex(u => u.username === username);
  if (idx !== -1) {
    users[idx] = { ...users[idx], gmail, password, access };
    showToast('User updated ✓');
  } else {
    if (users.find(u => u.username === username)) { showToast('Username already exists'); return; }
    users.push({ username, gmail, password, role: 'supervisor', access });
    showToast('User added ✓');
  }
  save();
  closeModal('modal-user');
  renderUsers();
}

// ── STARTUP ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  if (currentUser) {
    // Self-healing: if local storage cache was cleared but session persists, auto-fetch from cloud
    if (!workers || workers.length === 0) {
      console.log('Local workers cache is empty. Performing automatic cloud fetch recovery...');
      fetchAll();
    } else {
      renderAll();
    }
  }
});
