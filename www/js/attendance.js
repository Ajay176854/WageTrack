// ── ATTENDANCE LOGIC ────────────────────────────────────────────────────────────

function openAttendance() {
  if (currentUser.role === 'supervisor' && !hasActionPermission(currentProductionTab, 'attendance')) {
    showToast('Permission Denied: No attendance access');
    return;
  }
  const attDate = document.getElementById('att-date');
  if (attDate) attDate.value = todayStr();
  switchScreen('attendance');
  renderAttendanceList();
}

function closeAttendance() {
  switchScreen('home', document.querySelector('.nav-btn'));
}

function renderAttendanceList() {
  const dateInput = document.getElementById('att-date');
  if (!dateInput) return;
  const date = dateInput.value;
  const list = document.getElementById('attendance-list');
  if (!list) return;
  
  const dEntries = entries.filter(e => e.date === date);

  let visibleWorkers = workers;
  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    visibleWorkers = workers.filter(w => accessible.includes(w.type || 'daily'));
  }

  if (visibleWorkers.length === 0) {
    list.innerHTML = `<div class="empty">No workers in your accessible sections</div>`;
    return;
  }
  
  list.innerHTML = visibleWorkers.map(w => {
    let att = attendance.find(a => a.date === date && a.workerId === w.id);
    let status = att ? att.status : 'present';
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

    if (w.type === 'permanent' && isPresent) {
      basePay = Math.round(((w.salary || 0) / 30) * multiplier);
      baseLabel = halfDay ? (status === 'forenoon' ? 'Forenoon Salary' : 'Afternoon Salary') : 'Daily Salary';
    } else if (w.type === 'daily' && halfDay) {
      basePay = Math.round(pieceWage * 0.5);
      baseLabel = status === 'forenoon' ? 'Forenoon Wage' : 'Afternoon Wage';
    }

    let net = basePay + otAmt - adv;
    const otRateInfo = w.otRate ? `₹${w.otRate}/hr` : 'no rate';
    const typeLabels = { daily: 'P1', permanent: 'P2', packing: 'P3', other: 'P4' };
    const typeTag = `<span style="font-size:8px; font-weight:800; color:var(--text-muted); border:1px solid var(--border); padding:1px 4px; border-radius:4px; margin-left:4px;">${typeLabels[w.type || 'daily']}</span>`;

    const hasEditPerm = (currentUser.role === 'admin') || (currentUser.role === 'supervisor' && hasActionPermission(w.type || 'daily', 'payment'));
    const otDisabled = !hasEditPerm ? 'disabled' : '';
    const advDisabled = !hasEditPerm ? 'disabled' : '';
    const sectionMap = { daily: 'Prod 1', permanent: 'Prod 2', packing: 'Prod 3', other: 'Prod 4' };

    return `
      <div class="card" style="margin:0 16px 12px; padding:18px; border-left:4px solid ${sColor}; background:var(--surface); border-radius:18px; box-shadow:var(--shadow);">
        <div style="display:grid; grid-template-columns: 48px 1fr auto; align-items:center; gap:12px; margin-bottom:16px;">
          <div class="item-icon" style="background:var(--surface-raised); border-color:${sColor};">
            <span style="font-size:20px;">${w.emoji || '👷'}</span>
          </div>
          <div style="min-width:0;">
            <div style="font-size:15px; font-weight:700; color:var(--text-bright); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${w.name}${typeTag}
            </div>
            <div style="font-size:9px; color:var(--text-muted); font-family:var(--mono);">${w.empId || ''} · ${sectionMap[w.type || 'daily']}</div>
          </div>
          <select class="form-input" aria-label="Attendance Status" style="padding:8px 12px; width:auto; font-size:12px; height:auto; border-radius:10px; font-weight:700; background:var(--surface-raised); border-color:var(--border);" onchange="updateAttendance('${date}', '${w.id}', 'status', this.value)">
            <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
            <option value="forenoon" ${status === 'forenoon' ? 'selected' : ''}>Forenoon</option>
            <option value="afternoon" ${status === 'afternoon' ? 'selected' : ''}>Afternoon</option>
            <option value="absent" ${status === 'absent' ? 'selected' : ''}>Absent</option>
          </select>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div>
            <label class="form-label" style="font-size:9px; margin-bottom:6px; display:block;">OT HOURS <span style="color:var(--accent);">(${otRateInfo})</span></label>
            <input type="number" class="form-input" value="${otHours > 0 ? otHours : ''}" placeholder="0" ${otDisabled} onchange="updateAttendance('${date}', '${w.id}', 'ot', this.value)" />
          </div>
          <div>
            <label class="form-label" style="font-size:9px; margin-bottom:6px; display:block;">ADVANCE (₹)</label>
            <input type="number" class="form-input" value="${adv === 0 ? '' : adv}" placeholder="0" ${advDisabled} onchange="updateAttendance('${date}', '${w.id}', 'advance', this.value)" />
          </div>
        </div>
        <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border); font-size:11px; display:flex; justify-content:space-between; align-items:center;">
          <div style="color:var(--text-muted); font-family:var(--mono);">${baseLabel}: ₹${basePay} ${otAmt > 0 ? `+ OT:₹${otAmt}` : ''}</div>
          <div style="color:var(--accent); font-weight:800; font-size:15px; font-family:var(--mono);">₹${net}</div>
        </div>
      </div>`;
  }).join('');
}

function markAllPresent() {
  if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    const hasAnyAttendancePerm = accessible.some(prod => hasActionPermission(prod, 'attendance'));
    if (!hasAnyAttendancePerm) { showToast('Permission Denied: No attendance access'); return; }
  }
  const dateInput = document.getElementById('att-date');
  if (!dateInput) return;
  const date = dateInput.value;
  let targetWorkers = workers;
  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    targetWorkers = workers.filter(w => accessible.includes(w.type || 'daily') && hasActionPermission(w.type || 'daily', 'attendance'));
  }
  targetWorkers.forEach(w => {
    let rec = attendance.find(a => a.date === date && a.workerId === w.id);
    if (!rec) {
      attendance.push({ date, workerId: w.id, status: 'present', otAmount: 0, otHours: 0, advance: 0 });
    } else { rec.status = 'present'; }
  });
  save();
  renderAttendanceList();
  renderTodayEntries();
  showToast('All accessible workers marked present ✓');
}

function updateAttendance(date, wid, field, val) {
  const w = workerById(wid);
  if (!w) return;
  const prodType = w.type || 'daily';
  if (field === 'status') {
    if (!hasActionPermission(prodType, 'attendance')) { showToast('Permission Denied: No attendance access'); return; }
  } else if (field === 'ot' || field === 'advance') {
    if (!hasActionPermission(prodType, 'payment')) { showToast('Permission Denied: No payment access'); return; }
  }
  let rec = attendance.find(a => a.date === date && a.workerId === wid);
  if (!rec) {
    rec = { date, workerId: wid, status: 'present', otAmount: 0, otHours: 0, advance: 0 };
    attendance.push(rec);
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
