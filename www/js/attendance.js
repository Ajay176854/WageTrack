// ── ATTENDANCE LOGIC ────────────────────────────────────────────────────────────

var currentAttendanceUnit = 'all'; // Track current unit filter

function openAttendance() {
  if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    if (currentProductionTab === 'all') {
      const hasAnyAttAccess = accessible.some(unit => hasActionPermission(unit, 'attendance'));
      if (!hasAnyAttAccess) {
        showToast('Permission Denied: No attendance access');
        return;
      }
    } else {
      if (!hasActionPermission(currentProductionTab, 'attendance')) {
        showToast('Permission Denied: No attendance access');
        return;
      }
    }
  }
  const attDate = document.getElementById('att-date');
  if (attDate) attDate.value = todayStr();
  
  // Set default unit based on supervisor access
  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    currentAttendanceUnit = accessible.length > 0 ? accessible[0] : 'all';
  } else {
    currentAttendanceUnit = 'all';
  }
  
  switchScreen('attendance');
  updateAttendanceUnitTabs();
  renderAttendanceList();
}

function closeAttendance() {
  currentAttendanceUnit = 'all';
  switchScreen('home', document.querySelector('.nav-btn'));
}

function switchAttendanceUnit(unit) {
  currentAttendanceUnit = unit;
  updateAttendanceUnitTabs();
  renderAttendanceList();
}

function updateAttendanceUnitTabs() {
  const units = ['all', 'unit1', 'unit2', 'unit3', 'unit4'];
  units.forEach(u => {
    const tab = document.getElementById(`att-tab-${u}`);
    if (tab) {
      tab.classList.toggle('active', u === currentAttendanceUnit);
      
      // Hide tabs for supervisors without access
      if (currentUser && currentUser.role === 'supervisor') {
        const accessible = getAccessibleProductions();
        if (u === 'all') {
          tab.style.display = accessible.length > 1 ? 'block' : 'none';
        } else {
          tab.style.display = accessible.includes(u) ? 'block' : 'none';
        }
      } else {
        tab.style.display = 'block'; // Admin sees all
      }
    }
  });
}

function renderAttendanceList() {
  const dateInput = document.getElementById('att-date');
  if (!dateInput) return;
  const date = dateInput.value;
  const list = document.getElementById('attendance-list');
  if (!list) return;
  
  const allEntries = getAllEntries();
  const allAttendance = getAllAttendance();
  const dEntries = allEntries.filter(e => normalizeDate(e.date) === date);

  let visibleWorkers = workers;
  
  // Filter by supervisor permissions
  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    visibleWorkers = workers.filter(w => {
      const prodKey = w.unit || getProdKey(w.type);
      return accessible.includes(prodKey) && (hasActionPermission(prodKey, 'attendance') || hasActionPermission(prodKey, 'payment'));
    });
  }
  
  // Filter by selected unit
  if (currentAttendanceUnit !== 'all') {
    visibleWorkers = visibleWorkers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.type);
      return workerUnit === currentAttendanceUnit;
    });
  }

  if (visibleWorkers.length === 0) {
    list.innerHTML = `<div class="empty">No workers in ${currentAttendanceUnit === 'all' ? 'your accessible sections' : currentAttendanceUnit.toUpperCase()}</div>`;
    return;
  }

  // Group workers by unit for better organization
  const workersByUnit = {
    unit1: [],
    unit2: [],
    unit3: [],
    unit4: []
  };
  
  visibleWorkers.forEach(w => {
    const workerUnit = w.unit || getProdKey(w.type);
    if (workersByUnit[workerUnit]) {
      workersByUnit[workerUnit].push(w);
    }
  });

  let html = '';
  
  // Render workers grouped by unit
  Object.keys(workersByUnit).forEach(unitKey => {
    const unitWorkers = workersByUnit[unitKey];
    if (unitWorkers.length === 0) return;
    
    // Only show unit header if viewing all units
    if (currentAttendanceUnit === 'all') {
      const unitLabels = {
        unit1: 'Unit 1',
        unit2: 'Unit 2',
        unit3: 'Unit 3',
        unit4: 'Unit 4'
      };
      html += `
        <div style="margin:16px 16px 12px; padding:8px 12px; background:var(--surface-raised); border-radius:10px; border-left:4px solid var(--accent);">
          <div style="font-size:11px; font-weight:800; color:var(--text-muted); letter-spacing:1px;">${unitLabels[unitKey]}</div>
          <div style="font-size:9px; color:var(--text-muted); font-family:var(--mono); margin-top:2px;">${unitWorkers.length} worker${unitWorkers.length !== 1 ? 's' : ''}</div>
        </div>
      `;
    }
    
    unitWorkers.forEach(w => {
      html += renderWorkerAttendanceCard(w, date, dEntries, allAttendance);
    });
  });

  list.innerHTML = html;
}

function renderWorkerAttendanceCard(w, date, dEntries, allAttendance) {
  let att = allAttendance.find(a => normalizeDate(a.date) === date && a.workerId === w.id);
  let status = att ? att.status : ''; // Default to empty string (not marked yet)
  const sColor = statusColor(status);
  let otHours = att && att.otHours ? att.otHours : 0;
  let otAmt = att ? (att.otAmount || 0) : 0;
  let adv = att ? att.advance : 0;
  let pieceWage = dEntries.filter(e => e.workerId === w.id).reduce((s, e) => s + e.wage, 0);

  let basePay = pieceWage;
  let baseLabel = 'Piece Wage';
  const isPresent = isWorking(status);
  const halfDay = isHalfDay(status);
  const multiplier = halfDay ? 0.5 : 1;
  const wCat = w.category || w.type || 'piece_work';

  if ((wCat === 'monthly_salary' || wCat === 'permanent') && isPresent) {
    basePay = Math.round(((w.salary || 0) / getMonthDays(date)) * multiplier);
    baseLabel = halfDay ? (status === 'forenoon' ? 'Forenoon Salary' : 'Afternoon Salary') : 'Daily Salary';
  } else if (wCat === 'daily_wages' && isPresent) {
    basePay = Math.round((w.dailyWage || 0) * multiplier);
    baseLabel = halfDay ? 'Half Day Wage' : 'Daily Wage';
  } else if ((wCat === 'bundle_packing' || wCat === 'cover_packing' || wCat === 'packing') && halfDay) {
    basePay = Math.round(pieceWage * 0.5);
    baseLabel = 'Half Day Pack';
  }

  let net = basePay + otAmt - adv;
  const otRateInfo = w.otRate ? `₹${w.otRate}/hr` : 'no rate';
  const prodKey = w.unit || getProdKey(w.type);
  const hasAttPerm = hasActionPermission(prodKey, 'attendance');
  const hasPayPerm = hasActionPermission(prodKey, 'payment');

  if (!hasAttPerm && !hasPayPerm) return '';

  const unitColors = {
    unit1: { color: 'var(--accent)', bg: 'rgba(240,192,64,0.12)', label: 'Unit 1' },
    unit2: { color: 'var(--accent2)', bg: 'rgba(74,222,128,0.12)', label: 'Unit 2' },
    unit3: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: 'Unit 3' },
    unit4: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)', label: 'Unit 4' }
  };
  const unitInfo = unitColors[prodKey] || unitColors.unit1;
  const unitTag = currentAttendanceUnit === 'all' ? ` <span style="font-size:9px;color:${unitInfo.color};text-transform:uppercase;background:${unitInfo.bg};padding:1px 6px;border-radius:4px;font-weight:800;margin-left:4px;">${unitInfo.label}</span>` : '';

  return `
    <div class="card" style="margin:0 16px 12px; padding:18px; border-left:4px solid ${sColor}; background:var(--surface); border-radius:18px; box-shadow:var(--shadow);">
      <div style="display:grid; grid-template-columns: 48px 1fr auto; align-items:center; gap:12px; margin-bottom:16px;">
        <div class="item-icon" style="background:var(--surface-raised); border-color:${sColor};">
          <span style="font-size:20px;">${w.emoji || '👷'}</span>
        </div>
        <div style="min-width:0;">
          <div style="font-size:15px; font-weight:700; color:var(--text-bright); display:flex; align-items:center;">
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">${w.name}</span>${unitTag}
          </div>
          <div style="font-size:9px; color:var(--text-muted); font-family:var(--mono);">${w.empId || ''} · ${unitInfo.label}</div>
        </div>
        <select class="form-input" aria-label="Attendance Status" style="padding:8px 12px; width:auto; font-size:12px; height:auto; border-radius:10px; font-weight:700; background:var(--surface-raised); border-color:var(--border);"
          ${!hasAttPerm ? 'disabled' : ''}
          onchange="updateAttendance('${date}', '${w.id}', 'status', this.value)">
          <option value="" disabled ${status === '' ? 'selected' : ''}>-- Select --</option>
          <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
          <option value="forenoon" ${status === 'forenoon' ? 'selected' : ''}>Forenoon</option>
          <option value="afternoon" ${status === 'afternoon' ? 'selected' : ''}>Afternoon</option>
          <option value="absent" ${status === 'absent' ? 'selected' : ''}>Absent</option>
        </select>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div>
          <label class="form-label" style="font-size:9px; margin-bottom:6px; display:block;">OT HOURS <span style="color:var(--accent);">(${otRateInfo})</span></label>
          <input type="number" class="form-input" value="${otHours > 0 ? otHours : ''}" placeholder="0" ${!hasPayPerm ? 'disabled' : ''} onchange="updateAttendance('${date}', '${w.id}', 'ot', this.value)" />
        </div>
        <div>
          <label class="form-label" style="font-size:9px; margin-bottom:6px; display:block;">ADVANCE (₹)</label>
          <input type="number" class="form-input" value="${adv === 0 ? '' : adv}" placeholder="0" ${!hasPayPerm ? 'disabled' : ''} onchange="updateAttendance('${date}', '${w.id}', 'advance', this.value)" />
        </div>
      </div>
      <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border); font-size:11px; display:flex; justify-content:space-between; align-items:center;">
        <div style="color:var(--text-muted); font-family:var(--mono);">${baseLabel}: ₹${basePay} ${otAmt > 0 ? `+ OT:₹${otAmt}` : ''}</div>
        <div style="color:var(--accent); font-weight:800; font-size:15px; font-family:var(--mono);">₹${net}</div>
      </div>
    </div>`;
}

function markAllPresent() {
  const dateInput = document.getElementById('att-date');
  if (!dateInput) return;
  const date = dateInput.value;

  let targetWorkers = workers;
  
  // Filter by supervisor permissions
  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    targetWorkers = workers.filter(w => {
      const prodKey = w.unit || getProdKey(w.type);
      return accessible.includes(prodKey) && hasActionPermission(prodKey, 'attendance');
    });
  }
  
  // Filter by selected unit
  if (currentAttendanceUnit !== 'all') {
    targetWorkers = targetWorkers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.type);
      return workerUnit === currentAttendanceUnit;
    });
  }

  if (targetWorkers.length === 0) {
    showToast('No workers with attendance access found');
    return;
  }

  targetWorkers.forEach(w => {
    const targetUnit = w.unit || getProdKey(w.type || 'daily');
    const targetAttendance = getUnitAttendance(targetUnit);
    
    let rec = targetAttendance.find(a => normalizeDate(a.date) === date && a.workerId === w.id);
    if (!rec) {
      targetAttendance.push({ date, workerId: w.id, status: 'present', otAmount: 0, otHours: 0, advance: 0 });
    } else { rec.status = 'present'; }
  });
  save();
  renderAttendanceList();
  renderTodayEntries();
  
  const unitLabel = currentAttendanceUnit === 'all' ? 'All accessible workers' : currentAttendanceUnit.toUpperCase();
  showToast(`✓ ${unitLabel} marked present (${targetWorkers.length} workers)`);
}

function updateAttendance(date, wid, field, val) {
  const w = workerById(wid);
  if (!w) return;
  const prodKey = w.unit || getProdKey(w.type);
  if (field === 'status') {
    if (!hasActionPermission(prodKey, 'attendance')) { showToast('Permission Denied: No attendance access'); return; }
  } else if (field === 'ot' || field === 'advance') {
    if (!hasActionPermission(prodKey, 'payment')) { showToast('Permission Denied: No payment access'); return; }
  }
  
  const targetUnit = w.unit || getProdKey(w.type || 'daily');
  const targetAttendance = getUnitAttendance(targetUnit);
  
  let rec = targetAttendance.find(a => normalizeDate(a.date) === date && a.workerId === wid);
  if (!rec) {
    rec = { date, workerId: wid, status: 'present', otAmount: 0, otHours: 0, advance: 0 };
    targetAttendance.push(rec);
  }
  if (field === 'status') rec.status = val;
  if (field === 'ot') {
    const hours = parseFloat(val) || 0;
    rec.otHours = hours;
    rec.otAmount = Math.round(hours * (w.otRate || 0));
  }
  if (field === 'advance') rec.advance = parseFloat(val) || 0;
  save();
  renderAttendanceList();
}
