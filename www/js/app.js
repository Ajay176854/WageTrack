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
    visibleWorkerCount = workers.filter(w => accessible.includes(w.type || 'daily')).length;
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
    if (document.getElementById('prod-tab-1')) document.getElementById('prod-tab-1').style.display = accessible.includes('daily') ? 'flex' : 'none';
    if (document.getElementById('prod-tab-2')) document.getElementById('prod-tab-2').style.display = accessible.includes('permanent') ? 'flex' : 'none';
    if (document.getElementById('prod-tab-3')) document.getElementById('prod-tab-3').style.display = accessible.includes('packing') ? 'flex' : 'none';
    if (document.getElementById('prod-tab-4')) document.getElementById('prod-tab-4').style.display = accessible.includes('other') ? 'flex' : 'none';

    if (document.getElementById('prod-tab-all')) document.getElementById('prod-tab-all').style.display = accessible.length > 1 ? 'flex' : 'none';

    if (!accessible.includes(currentProductionTab) && currentProductionTab !== 'all') {
      if (accessible.length > 0) switchProductionTab(accessible[0]);
    } else if (currentProductionTab === 'all' && accessible.length === 1) {
      switchProductionTab(accessible[0]);
    }

    updateActionButtons();
  } else {
    // Admin sees all tabs
    ['all', '1', '2', '3', '4'].forEach(id => {
      const el = document.getElementById(id === 'all' ? 'prod-tab-all' : 'prod-tab-' + id);
      if (el) el.style.display = 'flex';
    });
  }
}

function updateActionButtons() {
  if (!currentUser || currentUser.role === 'admin') {
    document.querySelectorAll('[onclick*="openAttendance"]').forEach(el => el.style.display = '');
    document.querySelectorAll('[onclick*="openQuickAssignMenu"]').forEach(el => el.style.display = '');
    document.querySelectorAll('[onclick*="openAddEntry"]').forEach(el => el.style.display = '');
    return;
  }

  const accessible = getAccessibleProductions();
  if (currentProductionTab === 'all') {
    const hasAnyAttendance = accessible.some(prod => hasActionPermission(prod, 'attendance'));
    const hasAnyPayment = accessible.some(prod => hasActionPermission(prod, 'payment'));

    document.querySelectorAll('[onclick*="openAttendance"]').forEach(el => el.style.display = hasAnyAttendance ? '' : 'none');
    document.querySelectorAll('[onclick*="openQuickAssignMenu"]').forEach(el => el.style.display = hasAnyPayment ? '' : 'none');
    document.querySelectorAll('[onclick*="openAddEntry"]').forEach(el => el.style.display = hasAnyPayment ? '' : 'none');
  } else {
    const hasAttendancePerm = hasActionPermission(currentProductionTab, 'attendance');
    const hasPaymentPerm = hasActionPermission(currentProductionTab, 'payment');

    document.querySelectorAll('[onclick*="openAttendance"]').forEach(el => el.style.display = hasAttendancePerm ? '' : 'none');
    document.querySelectorAll('[onclick*="openQuickAssignMenu"]').forEach(el => el.style.display = hasPaymentPerm ? '' : 'none');
    document.querySelectorAll('[onclick*="openAddEntry"]').forEach(el => el.style.display = hasPaymentPerm ? '' : 'none');
  }
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
function doLogin() {
  try {
    const userEl = document.getElementById('l-user');
    const passEl = document.getElementById('l-pass');
    if (!userEl || !passEl) return;

    const user = userEl.value.trim();
    const pass = passEl.value.trim();

    if (!user || !pass) {
      showToast('Please enter both username and password');
      return;
    }

    const found = users.find(u => u.username.toLowerCase() === user.toLowerCase() && u.password === pass);
    if (found) {
      currentUser = found;
      localStorage.setItem('wt_session', JSON.stringify(currentUser));
      showToast(`Welcome back, ${found.username}!`);
      checkAuth();
      renderAll();
      switchScreen('home', document.querySelector('.nav-btn'));
    } else {
      showToast('Invalid username or password');
    }
  } catch (e) {
    console.error('Login error:', e);
    showToast('Login Error: ' + e.message);
  }
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('wt_session');
  checkAuth();
}

// ── WORKERS ──────────────────────────────────────────────────────────────────
function renderWorkers() {
  const list = document.getElementById('workers-list');
  if (!list) return;
  const searchVal = (document.getElementById('worker-search')?.value || '').toLowerCase().trim();

  let visibleWorkers = workers;
  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    visibleWorkers = workers.filter(w => accessible.includes(w.type || 'daily'));
  }

  if (searchVal) {
    visibleWorkers = visibleWorkers.filter(w =>
      w.name.toLowerCase().includes(searchVal) ||
      (w.empId || '').toLowerCase().includes(searchVal)
    );
  }

  if (visibleWorkers.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">${searchVal ? 'No workers match "' + searchVal + '"' : 'No workers in this section.'}</div></div>`;
    return;
  }

  list.innerHTML = visibleWorkers.map((w, index) => {
    const now = new Date();
    const monthStr = now.toISOString().substr(0, 7);
    const pieceTotal = entries.filter(e => e.workerId === w.id && e.date.startsWith(monthStr)).reduce((s, e) => s + e.wage, 0);
    const monthAtt = attendance.filter(a => a.workerId === w.id && a.date.startsWith(monthStr));
    const otTotal = monthAtt.reduce((s, a) => s + (a.otAmount || 0), 0);
    const daysPresent = monthAtt.filter(a => isWorking(a.status)).length;
    let basePay = pieceTotal;
    if (w.type === 'permanent') basePay = Math.round(((w.salary || 0) / 30) * daysPresent);
    const monthGrandTotal = basePay + otTotal;
    const todayAtt = attendance.find(a => a.workerId === w.id && a.date === todayStr());
    const todayOT = todayAtt ? (todayAtt.otAmount || 0) : 0;
    const todayPiece = entries.filter(e => e.workerId === w.id && e.date === todayStr()).reduce((s, e) => s + e.wage, 0);
    let todayEarned = todayPiece + todayOT;
    if (w.type === 'permanent' && todayAtt && isWorking(todayAtt.status)) {
      const mult = isHalfDay(todayAtt.status) ? 0.5 : 1;
      todayEarned = Math.round((w.salary || 0) / 30 * mult) + todayOT;
    }

    const typeColors = {
      daily: { color: 'var(--accent)', bg: 'rgba(240,192,64,0.12)', label: 'Prod 1' },
      permanent: { color: 'var(--accent2)', bg: 'rgba(74,222,128,0.12)', label: 'Prod 2' },
      packing: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: 'Prod 3' },
      other: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)', label: 'Prod 4' }
    };
    const typeInfo = typeColors[w.type || 'daily'];
    const typeTag = `<span style="font-size:9px;color:${typeInfo.color};text-transform:uppercase;background:${typeInfo.bg};padding:1px 6px;border-radius:4px;font-weight:800;">${typeInfo.label}</span>`;
    const delay = (index % 10) * 0.05;

    return `
      <div class="list-item reveal" style="animation-delay: ${delay}s" onclick="showWorkerDetails('${w.id}')">
        <div class="item-icon">${w.emoji || '👷'}</div>
        <div class="item-main">
          <div class="item-title">${w.name} ${typeTag}</div>
          <div class="item-sub">${w.empId || ''} ${w.phone ? '· ' + w.phone : ''}</div>
          <div class="item-sub" style="color:var(--accent2); font-weight:700;">₹${monthGrandTotal.toLocaleString()} this month</div>
        </div>
        <div class="item-right">
          <div class="item-value">${todayEarned > 0 ? '₹' + todayEarned.toLocaleString() : '—'}</div>
          <div class="item-label">today</div>
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
    const typeLabel = { daily: 'Prod 1 (Daily)', permanent: 'Prod 2 (Fixed)', packing: 'Prod 3 (Packing)', other: 'Prod 4 (Other)' }[w.type || 'daily'];
    
    const now = new Date();
    const monthStr = now.toISOString().substr(0, 7);
    const mEntries = entries.filter(e => e.workerId === wid && e.date.startsWith(monthStr));
    const mAtt = attendance.filter(a => a.workerId === wid && a.date.startsWith(monthStr));
    const wageEarned = mEntries.reduce((s, e) => s + e.wage, 0);
    const advanceTotal = mAtt.reduce((s, a) => s + (a.advance || 0), 0);

    let rowsHtml = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const dayAtt = mAtt.find(a => a.date === ds);
        const dayEntries = mEntries.filter(e => e.date === ds);
        if (dayAtt || dayEntries.length > 0) {
          const status = dayAtt ? dayAtt.status : 'N/A';
          const wage = dayEntries.reduce((s, e) => s + e.wage, 0);
          const ot = dayAtt ? (dayAtt.otAmount || 0) : 0;
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
    if (currentUser.role === 'admin') {
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
  if (currentUser.role !== 'admin') {
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
  document.getElementById('w-type').value = 'daily';
  document.getElementById('w-salary').value = '';
  const sag = document.getElementById('w-salary-group');
  if (sag) sag.classList.add('hidden');
  modal.classList.add('open');
}

function saveWorker() {
  const empId = document.getElementById('w-empid').value.trim();
  const phone = document.getElementById('w-phone').value.trim();
  const name = document.getElementById('w-name').value.trim();
  const type = document.getElementById('w-type').value;
  const salary = parseFloat(document.getElementById('w-salary').value) || 0;

  if (!name) { showToast('ERROR: Worker name is required'); return; }
  const dupName = workers.find(w => w.name.toLowerCase() === name.toLowerCase() && w.id !== editingWorkerId);
  if (dupName) { showToast(`ERROR: Worker "${name}" already exists!`); return; }
  if (type === 'permanent' && salary <= 0) { showToast('ERROR: Monthly salary required for permanent staff'); return; }
  if (!empId) { showToast('ERROR: Employee ID is required'); return; }
  const dupId = workers.find(w => w.empId.toLowerCase() === empId.toLowerCase() && w.id !== editingWorkerId);
  if (dupId) { showToast(`ERROR: Employee ID ${empId} is already taken!`); return; }

  if (editingWorkerId) {
    const idx = workers.findIndex(w => w.id === editingWorkerId);
    if (idx !== -1) {
      workers[idx] = { ...workers[idx], empId, phone, name, type, salary };
      showToast('Worker profile updated! ✓');
    }
  } else {
    workers.push({ id: uid(), empId, phone, name, type, salary, emoji: emojis[workers.length % emojis.length] });
    showToast(`New worker "${name}" added! ✓`);
  }
  save();
  closeModal('modal-worker');
  renderAll();
}

function editWorker(wid) {
  const w = workerById(wid);
  if (!w) return;
  editingWorkerId = wid;
  const modal = document.getElementById('modal-worker');
  if (!modal) return;
  modal.querySelector('.modal-title span').textContent = 'Edit Worker';
  document.getElementById('w-empid').value = w.empId || '';
  document.getElementById('w-phone').value = w.phone || '';
  document.getElementById('w-name').value = w.name || '';
  document.getElementById('w-type').value = w.type || 'daily';
  document.getElementById('w-salary').value = w.salary || '';
  toggleWorkerTypeFields(w.type || 'daily');
  document.getElementById('w-delete-btn').classList.remove('hidden');
  modal.classList.add('open');
}

function deleteWorker() {
  if (!editingWorkerId) return;
  const w = workerById(editingWorkerId);
  if (!w) return;

  if (confirm(`Are you sure you want to delete ${w.name}? All their attendance and work entries will be lost forever.`)) {
    workers = workers.filter(x => x.id !== editingWorkerId);
    entries = entries.filter(x => x.workerId !== editingWorkerId);
    attendance = attendance.filter(x => x.workerId !== editingWorkerId);
    save();
    closeModal('modal-worker');
    renderAll();
    showToast(`Worker ${w.name} deleted.`);
  }
}

function toggleWorkerTypeFields(type) {
    document.getElementById('w-delete-btn').classList.add('hidden');
    const group = document.getElementById('w-salary-group');
    if (type === 'permanent') group.classList.remove('hidden');
    else group.classList.add('hidden');
}

// ── ENTRIES ──────────────────────────────────────────────────────────────────
function switchProductionTab(type) {
  if (currentUser && currentUser.role === 'supervisor') {
    if (type === 'all') {
      const accessible = getAccessibleProductions();
      if (accessible.length <= 1) return;
    } else if (!hasProductionAccess(type)) {
      showToast('Access denied to this production section');
      return;
    }
  }
  currentProductionTab = type;
  document.querySelectorAll('#screen-home .report-tab').forEach(t => t.classList.remove('active'));
  const tabIds = { all: 'prod-tab-all', daily: 'prod-tab-1', permanent: 'prod-tab-2', packing: 'prod-tab-3', other: 'prod-tab-4' };
  const target = document.getElementById(tabIds[type]);
  if (target) target.classList.add('active');
  if (currentUser && currentUser.role === 'supervisor') updateActionButtons();
  renderTodayEntries();
}

function renderTodayEntries() {
  const list = document.getElementById('today-entries-list');
  if (!list) return;
  const today = todayStr();
  const todayEntries = entries.filter(e => e.date === today);
  const todayAtt = attendance.filter(a => a.date === today);

  const workerDailyMap = {};

  todayAtt.forEach(a => {
    const w = workerById(a.workerId);
    if (!w) return;
    if (currentProductionTab !== 'all') {
      if (currentProductionTab !== 'other' && (w.type || 'daily') !== currentProductionTab) return;
    }
    if (!workerDailyMap[a.workerId]) {
      workerDailyMap[a.workerId] = { worker: w, piece: 0, ot: a.otAmount, adv: a.advance, status: a.status, entries: [], baseSalary: 0 };
    } else {
      workerDailyMap[a.workerId].ot += a.otAmount;
      workerDailyMap[a.workerId].adv += a.advance;
      workerDailyMap[a.workerId].status = a.status;
    }
    if (w.type === 'permanent' && isWorking(a.status)) {
      workerDailyMap[a.workerId].baseSalary = Math.round(((w.salary || 0) / 30) * (isHalfDay(a.status) ? 0.5 : 1));
    }
  });

  todayEntries.forEach(e => {
    const w = workerById(e.workerId);
    if (!w) return;
    if (currentProductionTab !== 'all') {
      if (currentProductionTab === 'other') { if (!e.workDesc) return; }
      else { if ((w.type || 'daily') !== currentProductionTab || !!e.workDesc) return; }
    }
    if (!workerDailyMap[e.workerId]) {
      workerDailyMap[e.workerId] = { worker: w, piece: e.wage, ot: 0, adv: 0, status: 'present', entries: [e], baseSalary: 0 };
    } else {
      workerDailyMap[e.workerId].piece += e.wage;
      workerDailyMap[e.workerId].entries.push(e);
    }
  });

  let totalKg = 0, totalNetWage = 0;
  const workerIds = Object.keys(workerDailyMap);
  workerIds.forEach(wid => {
    const d = workerDailyMap[wid];
    if (d.worker.type !== 'packing' && d.worker.type !== 'other') {
      d.entries.forEach(e => { if (!e.workDesc) totalKg += e.output; });
    }
    totalNetWage += (d.baseSalary + d.piece + d.ot - d.adv);
  });

  const dashW = document.getElementById('dash-active-workers'), dashOut = document.getElementById('dash-total-kg'), dashWage = document.getElementById('dash-total-wage');
  if (dashW) dashW.textContent = `${workerIds.length} / ${workers.length}`;
  if (dashOut) dashOut.textContent = totalKg > 0 ? totalKg.toLocaleString() + ' kg' : '0';
  if (dashWage) dashWage.innerHTML = `<span style="font-size: 14px; color: var(--accent2);">₹</span>${totalNetWage.toLocaleString()}`;

  if (workerIds.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No activity today.</div></div>`;
    return;
  }

  list.innerHTML = workerIds.map((wid, index) => {
    const d = workerDailyMap[wid], w = d.worker, net = d.baseSalary + d.piece + d.ot - d.adv;
    let activityHtml = '';
    if (w.type === 'permanent') activityHtml += `<div class="item-sub">Fixed: ${isHalfDay(d.status) ? 'Half Day' : 'Present'}</div>`;
    else if (d.status === 'absent') activityHtml += `<div class="item-sub" style="color:var(--danger)">Absent</div>`;
    d.entries.forEach(e => {
      if (e.workDesc) activityHtml += `<div class="item-sub" style="color:var(--info)">${e.workDesc} (₹${e.wage})</div>`;
      else if (w.type === 'packing') activityHtml += `<div class="item-sub">${e.output} items @ ₹${e.rate}</div>`;
      else activityHtml += `<div class="item-sub">${e.output}/${e.assigned} kg</div>`;
    });
    const statusCol = d.status === 'absent' ? 'var(--danger)' : (w.type === 'permanent' ? 'var(--accent2)' : 'var(--accent)');
    const delay = (index % 10) * 0.05;
    return `
      <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; animation-delay:${delay}s; padding:12px 14px; margin:0 16px 10px; background:var(--surface); border:1px solid var(--border); border-radius:12px;" onclick="editRecentEntry('${wid}')">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="font-size:20px;">${w.emoji || '👷'}</div>
          <div>
            <div style="font-size:14px; font-weight:700; color:var(--text-bright);">${w.name}</div>
            <div style="display:flex; gap:6px; margin-top:2px;">${activityHtml}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:16px; font-weight:800; color:${statusCol};">₹${net.toLocaleString()}</div>
          <div style="font-size:8px; color:var(--text-muted); opacity:0.6; text-transform:uppercase; letter-spacing:0.5px;">View Details</div>
        </div>
      </div>`;
  }).join('');
}

function editWorkForToday(wid) {
  const today = todayStr();
  const entry = entries.find(e => e.workerId === wid && e.date === today);
  if (entry) {
    editEntry(entry.id);
  } else {
    openAddEntry();
    const sel = document.getElementById('e-worker');
    if (sel) {
        sel.value = wid;
        sel.dispatchEvent(new Event('change'));
    }
  }
}

function openAddEntry() {
  if (currentUser.role === 'supervisor' && !hasActionPermission(currentProductionTab, 'payment')) {
    showToast('Permission Denied: No payment access');
    return;
  }
  document.getElementById('e-id').value = '';
  document.getElementById('e-delete-btn').classList.add('hidden');
  document.getElementById('entry-modal-title').textContent = 'Add Daily Entry';
  let availableWorkers = workers;
  if (currentProductionTab !== 'all' && currentProductionTab !== 'other') {
    availableWorkers = workers.filter(w => (w.type || 'daily') === currentProductionTab);
  }
  if (currentUser.role === 'supervisor' && currentProductionTab !== 'other') {
    availableWorkers = availableWorkers.filter(w => getAccessibleProductions().includes(w.type || 'daily'));
  }
  const sel = document.getElementById('e-worker');
  if (!sel) return;
  sel.innerHTML = availableWorkers.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
  sel.onchange = function () {
    const w = workerById(this.value);
    toggleEntryFields(currentProductionTab === 'other' ? 'other' : (w?.type || 'daily'));
    calcPreview();
  };
  
  // Clear fields
  ['e-assigned-morning', 'e-assigned-afternoon', 'e-output-kg', 'e-not-completed', 'e-rate', 'e-pack-pieces', 'e-work-name', 'e-payment'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
  });
  
  if (sel.value) sel.onchange();
  document.getElementById('e-date').value = todayStr();
  document.getElementById('modal-entry').classList.add('open');
}

function editEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  const w = workerById(e.workerId);
  if (!w) return;

  document.getElementById('e-id').value = e.id;
  document.getElementById('entry-modal-title').textContent = 'Update Work Entry';
  const sel = document.getElementById('e-worker');
  sel.innerHTML = `<option value="${w.id}">${w.name}</option>`;
  sel.value = w.id;
  
  document.getElementById('e-date').value = e.date;
  const workerType = e.workDesc ? 'other' : (w.type || 'daily');
  toggleEntryFields(workerType);

  if (workerType === 'packing') {
    document.getElementById('e-pack-pieces').value = e.output || '';
    document.getElementById('e-rate').value = e.rate || ''; 
  } else if (workerType === 'other') {
    document.getElementById('e-work-name').value = e.workDesc || '';
    document.getElementById('e-payment').value = e.wage || '';
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

function deleteEntry(id) {
    if (confirm('Delete this entry?')) {
        // Use Number() to match Date.now() strictly or use !=
        entries = entries.filter(e => e.id != id);
        save();
        closeModal('modal-entry');
        renderAll();
        showToast('Entry deleted');
    }
}

function toggleEntryFields(workerType) {
  ['e-kg-fields', 'e-kg-fields-2', 'e-kg-sync-row', 'e-rate-field', 'e-packing-pieces', 'e-work-desc', 'e-payment-field'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
  });

  if (workerType === 'daily' || workerType === 'permanent') {
    document.getElementById('e-kg-fields').classList.remove('hidden');
    document.getElementById('e-kg-fields-2').classList.remove('hidden');
    document.getElementById('e-kg-sync-row').classList.remove('hidden');
    document.getElementById('e-rate-field').classList.remove('hidden');
  } else if (workerType === 'packing') {
    document.getElementById('e-packing-pieces').classList.remove('hidden');
    document.getElementById('e-rate-field').classList.remove('hidden');
    const label = document.querySelector('#e-rate-field .form-label');
    if (label) label.textContent = 'Rate per Piece';
  } else if (workerType === 'other') {
    document.getElementById('e-work-desc').classList.remove('hidden');
    document.getElementById('e-payment-field').classList.remove('hidden');
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

  const workerType = currentProductionTab === 'other' ? 'other' : (w.type || 'daily');
  let wage = 0, text = '';

  if (workerType === 'packing') {
    const pieces = parseFloat(document.getElementById('e-pack-pieces').value) || 0;
    const rate = parseFloat(document.getElementById('e-rate').value) || 0;
    wage = pieces * rate;
    text = `${pieces} items × ₹${rate}`;
  } else if (workerType === 'other') {
    wage = parseFloat(document.getElementById('e-payment').value) || 0;
    text = 'Custom Payment';
  } else {
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
  const date = document.getElementById('e-date').value;
  const w = workerById(workerId);
  if (!w) return;
  const type = currentProductionTab === 'other' ? 'other' : (w.type || 'daily');
  if (!hasActionPermission(type, 'payment')) { showToast('Permission Denied'); return; }

  let wage, assigned, output, rate, mAssigned, aAssigned, notCompleted, workDesc = '';

  if (type === 'packing') {
    const pieces = parseFloat(document.getElementById('e-pack-pieces').value) || 0;
    const packRate = parseFloat(document.getElementById('e-rate').value) || 0;
    wage = Math.round(pieces * packRate);
    assigned = output = mAssigned = pieces;
    aAssigned = notCompleted = 0;
    rate = packRate;
  } else if (type === 'other') {
    workDesc = document.getElementById('e-work-name').value.trim();
    wage = parseFloat(document.getElementById('e-payment').value) || 0;
    assigned = output = rate = mAssigned = aAssigned = notCompleted = 0;
  } else {
    mAssigned = parseFloat(document.getElementById('e-assigned-morning').value) || 0;
    aAssigned = parseFloat(document.getElementById('e-assigned-afternoon').value) || 0;
    assigned = mAssigned + aAssigned;
    notCompleted = parseFloat(document.getElementById('e-not-completed').value) || 0;
    output = assigned - notCompleted;
    rate = parseFloat(document.getElementById('e-rate').value) || 0;
    wage = Math.round(output * rate);
  }

  if (entryId) {
    const idx = entries.findIndex(x => x.id === entryId);
    if (idx !== -1) entries[idx] = { ...entries[idx], workerId, date, assigned, output, rate, wage, mAssigned, aAssigned, notCompleted, workDesc };
  } else {
    entries.push({ id: uid(), workerId, date, assigned, output, rate, wage, mAssigned, aAssigned, notCompleted, workDesc });
  }
  save();
  closeModal('modal-entry');
  renderAll();
}

// ── SYNC ─────────────────────────────────────────────────────────────────────
async function syncData() {
  const btn = document.getElementById('sync-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="rotating" style="display:inline-block;">↻</span>`;
  }
  try {
    const backup = { timestamp: new Date().toISOString(), version: '2.2', data: { workers, entries, attendance, users } };
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
  list.innerHTML = sups.map(u => `
    <div class="list-item">
      <div class="item-icon">👤</div>
      <div class="item-main">
        <div class="item-title">${u.username}</div>
        <div class="item-sub">${u.gmail || 'No email'} · Supervisor</div>
      </div>
      <button class="pill-btn secondary" onclick="editUser('${u.username}')">Edit</button>
    </div>`).join('');
}

function openAddUser() {
    document.getElementById('u-username').value = '';
    document.getElementById('u-gmail').value = '';
    document.getElementById('u-password').value = '';
    const perms = document.getElementById('u-perms-list');
    perms.innerHTML = ['daily', 'permanent', 'packing', 'other'].map(p => `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <input type="checkbox" class="u-perm-cb" value="${p}" id="perm-${p}">
            <label for="perm-${p}" style="font-size:12px; font-weight:700;">Prod ${p === 'daily' ? '1' : p === 'permanent' ? '2' : p === 'packing' ? '3' : '4'}</label>
        </div>
    `).join('');
    document.getElementById('modal-user').classList.add('open');
}

function editUser(username) {
    const u = users.find(x => x.username === username);
    if (!u) return;
    document.getElementById('u-username').value = u.username;
    document.getElementById('u-gmail').value = u.gmail || '';
    document.getElementById('u-password').value = u.password || '';
    const perms = document.getElementById('u-perms-list');
    perms.innerHTML = ['daily', 'permanent', 'packing', 'other'].map(p => {
        const checked = u.access && u.access['prod' + (['daily', 'permanent', 'packing', 'other'].indexOf(p) + 1)];
        return `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <input type="checkbox" class="u-perm-cb" value="${p}" id="perm-${p}" ${checked ? 'checked' : ''}>
                <label for="perm-${p}" style="font-size:12px; font-weight:700;">Prod ${p === 'daily' ? '1' : p === 'permanent' ? '2' : p === 'packing' ? '3' : '4'}</label>
            </div>
        `;
    }).join('');
    document.getElementById('modal-user').classList.add('open');
}

function saveUser() {
    const username = document.getElementById('u-username').value.trim();
    const gmail = document.getElementById('u-gmail').value.trim();
    const password = document.getElementById('u-password').value.trim();
    if (!username || !password) { showToast('Username and Password required'); return; }
    
    const access = {};
    document.querySelectorAll('.u-perm-cb:checked').forEach(cb => {
        const prodId = 'prod' + (['daily', 'permanent', 'packing', 'other'].indexOf(cb.value) + 1);
        access[prodId] = ['attendance', 'payment'];
    });

    const idx = users.findIndex(u => u.username === username);
    if (idx !== -1) {
        users[idx] = { ...users[idx], gmail, password, access };
    } else {
        users.push({ username, gmail, password, role: 'supervisor', access });
    }
    save();
    closeModal('modal-user');
    renderUsers();
    showToast('User saved ✓');
}

// ── STARTUP ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  if (currentUser) renderAll();
});
