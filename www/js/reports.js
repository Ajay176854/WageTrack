// ── REPORT & STATS LOGIC ───────────────────────────────────────────────────

let reportState = {
  fromDate: todayStr(),
  toDate: todayStr(),
  workerFilter: 'all',
  productionFilter: 'all',
  label: 'Today'
};

var reportCategoryFilter = 'all';

function switchReportProductionTab(type) {
  reportState.productionFilter = type;

  document.querySelectorAll('#screen-reports .report-tab').forEach(t => t.classList.remove('active'));
  const tabIds = {
    all: 'report-prod-all',
    unit1: 'report-prod-1',
    unit2: 'report-prod-2',
    unit3: 'report-prod-3',
    unit4: 'report-prod-4'
  };
  const target = document.getElementById(tabIds[type]);
  if (target) target.classList.add('active');
  renderReport();
}

function getNormalizedCategory(w) {
  if (!w) return '';
  const cat = w.category || w.type || '';
  if (cat === 'daily') return 'piece_work';
  if (cat === 'permanent') return 'monthly_salary';
  if (cat === 'packing') return 'bundle_packing';
  if (cat === 'other') return 'daily_wages';
  return cat;
}

function onCategoryFilterChange(cat) {
  reportCategoryFilter = cat;
  renderReport();
}

function applyQuick(type, el) {
  document.querySelectorAll('.quick-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  const now = new Date();
  const box = document.getElementById('custom-range-box');

  if (type === 'custom') {
    if (box) box.style.display = 'block';
    if (!document.getElementById('r-from').value) {
      document.getElementById('r-from').value = todayStr();
      document.getElementById('r-to').value = todayStr();
    }
    applyCustomRange();
    return;
  }
  if (box) box.style.display = 'none';

  let from, to, label;
  if (type === 'today') { from = to = todayStr(); label = 'Today'; }
  else if (type === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    from = start.toISOString().split('T')[0];
    to = todayStr(); label = 'This Week';
  } else if (type === 'month') {
    from = now.toISOString().substr(0, 7) + '-01';
    to = todayStr(); label = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  reportState.fromDate = from;
  reportState.toDate = to;
  reportState.label = label;
  const badge = document.getElementById('period-badge');
  if (badge) badge.textContent = label;
  renderReport();
}

function applyCustomRange() {
  const from = document.getElementById('r-from').value;
  const to = document.getElementById('r-to').value;
  if (!from || !to) return;
  if (from > to) { showToast('From date must be before To date'); return; }
  const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  reportState.fromDate = from;
  reportState.toDate = to;
  reportState.label = fmtDate(from) + ' – ' + fmtDate(to);
  const badge = document.getElementById('period-badge');
  if (badge) badge.textContent = reportState.label;
  renderReport();
}

function onWorkerFilterChange(wid) {
  reportState.workerFilter = wid;
  renderReport();
}

function buildWorkerFilterChips() {
  const sel = document.getElementById('worker-filter-select');
  if (!sel) return;
  const current = sel.value;
  let visibleWorkers = workers;

  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    visibleWorkers = workers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.type);
      return accessible.includes(workerUnit);
    });
  }

  // Filter by selected unit tab
  const prodFilter = reportState.productionFilter || 'all';
  if (prodFilter !== 'all') {
    visibleWorkers = visibleWorkers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.type);
      return workerUnit === prodFilter;
    });
  }

  // Filter by selected category filter
  if (reportCategoryFilter !== 'all') {
    visibleWorkers = visibleWorkers.filter(w => getNormalizedCategory(w) === reportCategoryFilter);
  }

  sel.innerHTML = '<option value="all">All Workers</option>' +
    visibleWorkers.map(w => {
      const workerUnit = (w.unit || getProdKey(w.category || w.type || 'daily')).toUpperCase().replace('UNIT', 'Unit ');
      return `<option value="${w.id}">${w.emoji || ''} ${w.name} (${w.empId} · ${workerUnit})</option>`;
    }).join('');

  if (visibleWorkers.some(w => w.id === reportState.workerFilter)) {
    sel.value = reportState.workerFilter;
  } else {
    reportState.workerFilter = 'all';
    sel.value = 'all';
  }
}

function renderReport() {
  const content = document.getElementById('report-content');
  if (!content) return;

  // Sync worker select list to reflect active unit and category filters
  buildWorkerFilterChips();

  const { fromDate, toDate, workerFilter, productionFilter } = reportState;

  let filtered = getAllEntries().filter(e => normalizeDate(e.date) >= fromDate && normalizeDate(e.date) <= toDate);
  let attFiltered = getAllAttendance().filter(a => normalizeDate(a.date) >= fromDate && normalizeDate(a.date) <= toDate);
  let maintenanceFiltered = maintenance.filter(m => normalizeDate(m.date) >= fromDate && normalizeDate(m.date) <= toDate);

  // Filter workers by production tab (unit-based)
  let filteredWorkers = [...workers];
  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    filteredWorkers = filteredWorkers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.type);
      return accessible.includes(workerUnit);
    });
  }

  const prodFilter = productionFilter || 'all';
  if (prodFilter !== 'all') {
    filteredWorkers = filteredWorkers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.type);
      return workerUnit === prodFilter;
    });
    maintenanceFiltered = maintenanceFiltered.filter(m => m.homeUnit === prodFilter);
  }

  // Apply category filter
  if (reportCategoryFilter !== 'all') {
    filteredWorkers = filteredWorkers.filter(w => getNormalizedCategory(w) === reportCategoryFilter);
  }

  // Apply worker filter
  if (workerFilter !== 'all') {
    filteredWorkers = filteredWorkers.filter(w => w.id === workerFilter);
    maintenanceFiltered = maintenanceFiltered.filter(m => m.workerId === workerFilter);
  }

  const workerMap = {};
  filteredWorkers.forEach(w => {
    workerMap[w.id] = { kg: 0, assigned: 0, wage: 0, ot: 0, advance: 0, net: 0, days: 0, daily: {}, name: w.name, emoji: w.emoji, workerId: w.id };
  });

  filtered.forEach(e => {
    if (!workerMap[e.workerId]) return;
    workerMap[e.workerId].kg = Number((workerMap[e.workerId].kg + Number(e.output || 0)).toFixed(2));
    workerMap[e.workerId].assigned = Number((workerMap[e.workerId].assigned + Number(e.assigned || 0)).toFixed(2));
    workerMap[e.workerId].wage += Number(e.wage || 0);
    const eDate = normalizeDate(e.date);
    if (!workerMap[e.workerId].daily[eDate]) workerMap[e.workerId].daily[eDate] = { piece: 0, ot: 0, adv: 0, output: 0, assigned: 0, net: 0, status: 'present' };
    workerMap[e.workerId].daily[eDate].piece += Number(e.wage || 0);
    workerMap[e.workerId].daily[eDate].output += Number(e.output || 0);
    workerMap[e.workerId].daily[eDate].assigned += Number(e.assigned || 0);
  });

  attFiltered.forEach(a => {
    if (!workerMap[a.workerId]) return;
    workerMap[a.workerId].ot += Number(a.otAmount || 0);
    workerMap[a.workerId].advance += Number(a.advance || 0);
    const aDate = normalizeDate(a.date);
    if (!workerMap[a.workerId].daily[aDate]) workerMap[a.workerId].daily[aDate] = { piece: 0, ot: 0, adv: 0, output: 0, assigned: 0, net: 0, status: 'present' };
    workerMap[a.workerId].daily[aDate].ot += Number(a.otAmount || 0);
    workerMap[a.workerId].daily[aDate].adv += Number(a.advance || 0);
    workerMap[a.workerId].daily[aDate].status = a.status;
  });

  let totalWage = 0, totalKg = 0, totalWorkersActive = 0, totalDaysActive = new Set();
  let totalAssigned = 0;

  Object.keys(workerMap).forEach(wid => {
    let w = workerMap[wid];
    const workerInfo = workerById(wid);
    if (!workerInfo) { delete workerMap[wid]; return; }
    const activeDates = new Set([...Object.keys(w.daily), ...attFiltered.filter(a => a.workerId === wid && isWorking(a.status)).map(a => normalizeDate(a.date))]);
    w.days = activeDates.size;

    const wCat = workerInfo.category || workerInfo.type || '';
    if (wCat === 'permanent' || wCat === 'monthly_salary') {
      const daysPresent = attFiltered.filter(a => a.workerId === wid && isWorking(a.status)).reduce((acc, a) => acc + (isHalfDay(a.status) ? 0.5 : 1), 0);
      w.wage += Math.round(((workerInfo.salary || 0) / getMonthDays(fromDate)) * daysPresent);
    } else if (wCat === 'daily_wages') {
      const daysPresent = attFiltered.filter(a => a.workerId === wid && isWorking(a.status)).reduce((acc, a) => acc + (isHalfDay(a.status) ? 0.5 : 1), 0);
      w.wage += Math.round((workerInfo.dailyWage || 0) * daysPresent);
    }

    // Add paid leave bonus for monthly salary workers
    let paidLeaveBonus = 0;
    let unusedLeaves = 0;
    let perDaySalary = 0;
    if (wCat === 'monthly_salary' || wCat === 'permanent') {
      const bonus = calcPaidLeaveBonus(workerInfo, fromDate, toDate);
      if (bonus.bonus > 0) {
        w.wage += bonus.bonus;
        paidLeaveBonus = bonus.bonus;
        unusedLeaves = bonus.unused;
        perDaySalary = bonus.perDay;
      }
    }
    w.paidLeaveBonus = paidLeaveBonus;
    w.unusedLeaves = unusedLeaves;
    w.perDaySalary = perDaySalary;

    w.net = w.wage + w.ot - w.advance;
    if (w.days === 0 && w.ot === 0 && w.advance === 0 && w.wage === 0) {
      delete workerMap[wid];
    } else {
      totalWage += w.net;
      totalKg = Number((totalKg + w.kg).toFixed(2));
      totalAssigned = Number((totalAssigned + w.assigned).toFixed(2));
      totalWorkersActive++;
      Object.keys(w.daily).forEach(d => {
        totalDaysActive.add(d);
        if (wCat === 'permanent' || wCat === 'monthly_salary') {
          const att = attFiltered.find(a => a.workerId === wid && normalizeDate(a.date) === d);
          if (att && isWorking(att.status)) w.daily[d].piece += Math.round((workerInfo.salary || 0) / getMonthDays(fromDate) * (isHalfDay(att.status) ? 0.5 : 1));
        } else if (wCat === 'daily_wages') {
          const att = attFiltered.find(a => a.workerId === wid && normalizeDate(a.date) === d);
          if (att && isWorking(att.status)) w.daily[d].piece += Math.round((workerInfo.dailyWage || 0) * (isHalfDay(att.status) ? 0.5 : 1));
        }
        w.daily[d].net = w.daily[d].piece + w.daily[d].ot - w.daily[d].adv;
      });
    }
  });

  if (totalWorkersActive === 0) {
    content.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">No entries found.</div></div>`;
    return;
  }

  // Group by unit if productionFilter is 'all'
  let html = '';
  const unitOrder = ['unit1', 'unit2', 'unit3', 'unit4'];

  if (prodFilter === 'all') {
    const grouped = {};
    unitOrder.forEach(u => grouped[u] = []);

    Object.entries(workerMap).forEach(([wid, data]) => {
      const workerInfo = workerById(wid);
      if (!workerInfo) return;
      const u = workerInfo.unit || getProdKey(workerInfo.type) || 'unit1';
      if (grouped[u]) grouped[u].push({ wid, data });
    });

    unitOrder.forEach(unit => {
      if (grouped[unit].length === 0) return;
      const unitLabel = { unit1: 'Unit 1', unit2: 'Unit 2', unit3: 'Unit 3', unit4: 'Unit 4' }[unit];

      html += `<div style="background:var(--surface-raised);padding:10px 16px; font-weight:800; font-size:12px;color:var(--accent); border-radius:10px; margin:8px 16px;text-transform:uppercase; letter-spacing:1px;">${unitLabel} — ${grouped[unit].length} workers</div>`;

      // Group unit workers by category
      const catGroup = {};
      grouped[unit].forEach(item => {
        const workerInfo = workerById(item.wid);
        if (!workerInfo) return;
        const cat = getNormalizedCategory(workerInfo) || 'piece_work';
        if (!catGroup[cat]) catGroup[cat] = [];
        catGroup[cat].push(item);
      });

      const categoryLabels = {
        piece_work: 'Piece Work',
        monthly_salary: 'Monthly Salary',
        bundle_packing: 'Bundle Packing',
        cover_packing: 'Cover Packing',
        daily_wages: 'Daily Wages'
      };

      Object.entries(catGroup).forEach(([cat, workers]) => {
        const catLabel = categoryLabels[cat] || cat;
        const catTotal = workers.reduce((sum, { data }) => sum + (data.net || 0), 0);
        html += `<div style="font-size:11px; font-weight:700; color:var(--text-muted); margin:12px 16px 6px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border); padding-bottom:4px;">
          <span>${catLabel} (${workers.length} workers)</span>
          <span style="color:var(--accent2); font-weight:800;">Subtotal: ₹${catTotal.toLocaleString()}</span>
        </div>`;
        workers.forEach(({ wid, data }) => {
          html += buildWorkerCard(wid, data);
        });
      });

      const unitTotal = grouped[unit].reduce((sum, { data }) => sum + (data.net || 0), 0);
      html += `<div style="text-align:right; padding:8px 16px;font-size:13px; font-weight:700; color:var(--accent2);border-top:1px solid var(--border); margin:0 16px 8px;">${unitLabel} Total: ₹${unitTotal.toLocaleString()}</div>`;
    });
  } else {
    // If a specific unit is filtered, we still group by category
    const catGroup = {};
    Object.entries(workerMap).forEach(([wid, data]) => {
      const workerInfo = workerById(wid);
      if (!workerInfo) return;
      const cat = getNormalizedCategory(workerInfo) || 'piece_work';
      if (!catGroup[cat]) catGroup[cat] = [];
      catGroup[cat].push({ wid, data });
    });

    const categoryLabels = {
      piece_work: 'Piece Work',
      monthly_salary: 'Monthly Salary',
      bundle_packing: 'Bundle Packing',
      cover_packing: 'Cover Packing',
      daily_wages: 'Daily Wages'
    };

    Object.entries(catGroup).forEach(([cat, workers]) => {
      const catLabel = categoryLabels[cat] || cat;
      const catTotal = workers.reduce((sum, { data }) => sum + (data.net || 0), 0);
      html += `<div style="font-size:11px; font-weight:700; color:var(--text-muted); margin:12px 16px 6px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border); padding-bottom:4px;">
        <span>${catLabel} (${workers.length} workers)</span>
        <span style="color:var(--accent2); font-weight:800;">Subtotal: ₹${catTotal.toLocaleString()}</span>
      </div>`;
      workers.forEach(({ wid, data }) => {
        html += buildWorkerCard(wid, data);
      });
    });
  }

  let maintHtml = '';
  let maintenanceTotal = 0;
  if (maintenanceFiltered.length > 0) {
    maintenanceTotal = maintenanceFiltered.reduce((sum, m) => sum + Number(m.wage || m.wageAmount || 0), 0);

    maintHtml += `<div style="background:var(--surface-raised);padding:10px 16px; font-weight:800; font-size:12px;color:var(--accent); border-radius:10px; margin:24px 16px 8px;text-transform:uppercase; letter-spacing:1px; display:flex; justify-content:space-between; align-items:center;">
      <span>Maintenance Work — ${maintenanceFiltered.length} entries</span>
    </div>`;

    maintenanceFiltered.forEach(m => {
      const dateLabel = new Date(m.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      maintHtml += `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin:0 16px 12px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text-bright);">${m.workerName || 'Worker'} <span class="badge" style="background:rgba(251,146,60,0.12); color:#fb923c; font-size:9px; padding:1px 6px; border-radius:4px; font-weight:800; text-transform:uppercase;">MAINTENANCE</span></div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${m.workDescription || m.workDesc || 'No description'} · ${dateLabel}</div>
            <div style="font-size:9px;color:var(--text-muted);margin-top:4px;text-transform:uppercase;font-weight:700;">Home Unit: ${(m.homeUnit || 'unit1').toUpperCase()}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:16px;font-weight:800;color:var(--accent);">₹${Number(m.wage || m.wageAmount || 0).toLocaleString()}</div>
            <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">amount</div>
          </div>
        </div>`;
    });

    maintHtml += `<div style="text-align:right; padding:8px 16px;font-size:13px; font-weight:700; color:var(--accent2);border-top:1px solid var(--border); margin:0 16px 24px;">Maintenance Total: ₹${maintenanceTotal.toLocaleString()}</div>`;
  }

  const grandTotalWage = totalWage + maintenanceTotal;

  content.innerHTML = `
    <div style="margin:0 16px 12px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:16px;font-weight:800;font-family:var(--mono);color:var(--accent);">${totalWorkersActive}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">WORKERS</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:16px;font-weight:800;font-family:var(--mono);color:var(--accent);">${totalKg}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">KG OUT</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:16px;font-weight:800;font-family:var(--mono);color:var(--accent);">${totalAssigned}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">ASSIGNED</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:16px;font-weight:800;font-family:var(--mono);color:var(--accent2);">₹${grandTotalWage.toLocaleString()}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">TOTAL PAY</div>
      </div>
    </div>
    ${html}
    ${maintHtml}`;
}

function buildWorkerCard(wid, data) {
  const dailyRows = Object.keys(data.daily).sort().map(d => {
    const dd = data.daily[d];
    const statusDot = dd.status === 'absent' ? '✕' : isHalfDay(dd.status) ? '½' : '✓';
    return `<tr style="border-bottom:1px solid var(--border);font-size:11px;">
      <td style="padding:5px;">${statusDot} ${new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
      <td style="text-align:right;">${dd.assigned || '—'}</td>
      <td style="text-align:right;">${dd.output || '—'}</td>
      <td style="text-align:right;">₹${dd.piece.toLocaleString()}</td>
      <td style="text-align:right;">₹${dd.net.toLocaleString()}</td>
    </tr>`;
  }).join('');

  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin:0 16px 12px;overflow:hidden;">
      <div style="padding:12px;display:flex;justify-content:space-between;align-items:center;background:var(--surface-raised);" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text-bright);">${data.emoji || '👷'} ${data.name}</div>
          <div style="font-size:10px;color:var(--text-muted);">${Number(data.kg).toFixed(2)} kg · ${data.days} days</div>
          ${data.paidLeaveBonus > 0 ? `<div style="font-size:11px; color:var(--accent2); margin-top:4px;">Paid Leave Bonus: +₹${data.paidLeaveBonus} (${data.unusedLeaves} unused × ₹${data.perDaySalary}/day)</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:16px;font-weight:800;color:var(--accent);">₹${data.net.toLocaleString()}</div>
          <div style="font-size:9px;color:var(--text-muted);">TAP TO EXPAND</div>
        </div>
      </div>
      <div style="display:none;padding:8px;">
        <table style="width:100%;font-size:10px;">
          <thead><tr style="color:var(--text-muted);"><th>Date</th><th style="text-align:right;">Asg</th><th style="text-align:right;">Out</th><th style="text-align:right;">Wage</th><th style="text-align:right;">Net</th></tr></thead>
          <tbody>${dailyRows}</tbody>
        </table>
      </div>
    </div>`;
}

async function exportReportPDF(autoCloud = false) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const { fromDate, toDate, workerFilter, productionFilter, label } = reportState;

  // Collect all data
  let filtered = getAllEntries().filter(e => normalizeDate(e.date) >= fromDate && normalizeDate(e.date) <= toDate);
  let attFiltered = getAllAttendance().filter(a => normalizeDate(a.date) >= fromDate && normalizeDate(a.date) <= toDate);
  let maintenanceFiltered = maintenance.filter(m => normalizeDate(m.date) >= fromDate && normalizeDate(m.date) <= toDate);

  // Filter workers
  let filteredWorkers = [...workers];
  if (currentUser && currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    filteredWorkers = filteredWorkers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.type);
      return accessible.includes(workerUnit);
    });
  }

  const prodFilter = productionFilter || 'all';
  if (prodFilter !== 'all') {
    filteredWorkers = filteredWorkers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.type);
      return workerUnit === prodFilter;
    });
    // Don't include maintenance when a specific unit is selected
    maintenanceFiltered = [];
  }

  if (reportCategoryFilter !== 'all') {
    filteredWorkers = filteredWorkers.filter(w => getNormalizedCategory(w) === reportCategoryFilter);
  }

  if (workerFilter !== 'all') {
    filteredWorkers = filteredWorkers.filter(w => w.id === workerFilter);
    // Don't include maintenance when a specific worker is selected
    maintenanceFiltered = [];
  }

  // Build worker map with daily breakdown
  const workerMap = {};
  filteredWorkers.forEach(w => {
    workerMap[w.id] = {
      kg: 0, assigned: 0, wage: 0, baseWage: 0, ot: 0, advance: 0, net: 0, days: 0,
      name: w.name, daily: {}, paidLeaveBonus: 0, unusedLeaves: 0, perDaySalary: 0
    };
  });

  // Aggregate entries
  filtered.forEach(e => {
    if (!workerMap[e.workerId]) return;
    workerMap[e.workerId].kg = Number((workerMap[e.workerId].kg + Number(e.output || 0)).toFixed(2));
    workerMap[e.workerId].assigned = Number((workerMap[e.workerId].assigned + Number(e.assigned || 0)).toFixed(2));
    workerMap[e.workerId].wage += Number(e.wage || 0);

    const eDate = normalizeDate(e.date);
    if (!workerMap[e.workerId].daily[eDate]) {
      workerMap[e.workerId].daily[eDate] = { piece: 0, ot: 0, adv: 0, output: 0, assigned: 0, status: 'present' };
    }
    workerMap[e.workerId].daily[eDate].piece += Number(e.wage || 0);
    workerMap[e.workerId].daily[eDate].output += Number(e.output || 0);
    workerMap[e.workerId].daily[eDate].assigned += Number(e.assigned || 0);
  });

  // Aggregate attendance
  attFiltered.forEach(a => {
    if (!workerMap[a.workerId]) return;
    workerMap[a.workerId].ot += Number(a.otAmount || 0);
    workerMap[a.workerId].advance += Number(a.advance || 0);

    const aDate = normalizeDate(a.date);
    if (!workerMap[a.workerId].daily[aDate]) {
      workerMap[a.workerId].daily[aDate] = { piece: 0, ot: 0, adv: 0, output: 0, assigned: 0, status: 'present' };
    }
    workerMap[a.workerId].daily[aDate].ot += Number(a.otAmount || 0);
    workerMap[a.workerId].daily[aDate].adv += Number(a.advance || 0);
    workerMap[a.workerId].daily[aDate].status = a.status;
  });

  // Calculate days, permanent wages, and paid leave bonus
  Object.keys(workerMap).forEach(wid => {
    const w = workerById(wid);
    if (!w) { delete workerMap[wid]; return; }
    const activeDates = new Set([
      ...filtered.filter(e => e.workerId === wid).map(e => normalizeDate(e.date)),
      ...attFiltered.filter(a => a.workerId === wid && isWorking(a.status)).map(a => normalizeDate(a.date))
    ]);
    workerMap[wid].days = activeDates.size;
    workerMap[wid].baseWage = workerMap[wid].wage;

    const wCat = w.category || w.type || '';
    if (wCat === 'permanent' || wCat === 'monthly_salary') {
      const daysPresent = attFiltered.filter(a => a.workerId === wid && isWorking(a.status)).reduce((acc, a) => acc + (isHalfDay(a.status) ? 0.5 : 1), 0);
      const salaryWage = Math.round(((w.salary || 0) / getMonthDays(fromDate)) * daysPresent);
      workerMap[wid].wage += salaryWage;
      workerMap[wid].baseWage += salaryWage;

      // Calculate paid leave bonus
      const bonus = calcPaidLeaveBonus(w, fromDate, toDate);
      if (bonus.bonus > 0) {
        workerMap[wid].wage += bonus.bonus;
        workerMap[wid].paidLeaveBonus = bonus.bonus;
        workerMap[wid].unusedLeaves = bonus.unused;
        workerMap[wid].perDaySalary = bonus.perDay;
      }

      // Add salary to daily breakdown
      Object.keys(workerMap[wid].daily).forEach(d => {
        const att = attFiltered.find(a => a.workerId === wid && normalizeDate(a.date) === d);
        if (att && isWorking(att.status)) {
          workerMap[wid].daily[d].piece += Math.round((w.salary || 0) / getMonthDays(fromDate) * (isHalfDay(att.status) ? 0.5 : 1));
        }
      });
    } else if (wCat === 'daily_wages') {
      const daysPresent = attFiltered.filter(a => a.workerId === wid && isWorking(a.status)).reduce((acc, a) => acc + (isHalfDay(a.status) ? 0.5 : 1), 0);
      const dailyWageTotal = Math.round((w.dailyWage || 0) * daysPresent);
      workerMap[wid].wage += dailyWageTotal;
      workerMap[wid].baseWage += dailyWageTotal;

      // Add daily wage to daily breakdown
      Object.keys(workerMap[wid].daily).forEach(d => {
        const att = attFiltered.find(a => a.workerId === wid && normalizeDate(a.date) === d);
        if (att && isWorking(att.status)) {
          workerMap[wid].daily[d].piece += Math.round((w.dailyWage || 0) * (isHalfDay(att.status) ? 0.5 : 1));
        }
      });
    }

    // Calculate daily net
    Object.keys(workerMap[wid].daily).forEach(d => {
      workerMap[wid].daily[d].net = workerMap[wid].daily[d].piece + workerMap[wid].daily[d].ot - workerMap[wid].daily[d].adv;
    });

    workerMap[wid].net = workerMap[wid].wage + workerMap[wid].ot - workerMap[wid].advance;

    // Filter out workers with no activity
    if (workerMap[wid].days === 0 && workerMap[wid].ot === 0 && workerMap[wid].advance === 0 && workerMap[wid].wage === 0) {
      delete workerMap[wid];
    }
  });

  if (Object.keys(workerMap).length === 0 && maintenanceFiltered.length === 0) {
    showToast('No data to export');
    return;
  }

  // PDF Header
  doc.setFillColor(241, 243, 244);
  doc.rect(0, 0, 210, 45, 'F');
  doc.setTextColor(184, 134, 11);
  doc.setFontSize(24); doc.setFont("helvetica", "bold");
  doc.text("WageTrack Detailed Report", 15, 22);
  doc.setTextColor(60, 64, 67);
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Period: ${label}`, 15, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 36);

  let yPos = 50;

  // Calculate grand totals
  let grandTotalWorkers = Object.keys(workerMap).length;
  let grandTotalOutput = 0, grandTotalPayroll = 0, grandTotalDays = 0;
  Object.values(workerMap).forEach(data => {
    grandTotalOutput += data.kg;
    grandTotalPayroll += data.net;
    grandTotalDays += data.days;
  });

  // Add maintenance to grand total
  maintenanceFiltered.forEach(m => {
    grandTotalPayroll += Number(m.wage || m.wageAmount || 0);
  });

  // Summary Grid
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(218, 220, 224);
  doc.rect(15, yPos, 180, 18, 'FD');
  doc.setTextColor(184, 134, 11); doc.setFontSize(7);
  doc.text("WORKERS", 20, yPos + 6);
  doc.text("TOTAL OUTPUT", 65, yPos + 6);
  doc.text("TOTAL PAYROLL", 115, yPos + 6);
  doc.text("DAYS WORKED", 165, yPos + 6);

  doc.setTextColor(32, 33, 36); doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text(String(grandTotalWorkers), 20, yPos + 14);
  doc.text(grandTotalOutput.toFixed(2) + " kg", 65, yPos + 14);
  doc.text("Rs. " + grandTotalPayroll.toLocaleString(), 115, yPos + 14);
  doc.text(String(grandTotalDays), 165, yPos + 14);

  yPos += 25;

  // Group by unit and category
  const unitOrder = ['unit1', 'unit2', 'unit3', 'unit4'];
  const categoryLabels = {
    piece_work: 'Piece Work',
    monthly_salary: 'Monthly Salary',
    permanent: 'Permanent',
    bundle_packing: 'Bundle Packing',
    cover_packing: 'Cover Packing',
    daily_wages: 'Daily Wages',
    other: 'Other Work'
  };

  const grouped = {};
  unitOrder.forEach(u => grouped[u] = {});

  Object.entries(workerMap).forEach(([wid, data]) => {
    const workerInfo = workerById(wid);
    const unit = workerInfo.unit || getProdKey(workerInfo.type) || 'unit1';
    const category = getNormalizedCategory(workerInfo) || 'piece_work';

    if (!grouped[unit][category]) grouped[unit][category] = [];
    grouped[unit][category].push({ wid, data, workerInfo });
  });

  // Render each unit
  unitOrder.forEach(unit => {
    const unitData = grouped[unit];
    const categories = Object.keys(unitData);
    if (categories.length === 0) return;

    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Unit Header
    const unitLabel = { unit1: 'UNIT 1', unit2: 'UNIT 2', unit3: 'UNIT 3', unit4: 'UNIT 4' }[unit];
    doc.setFillColor(184, 134, 11);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(unitLabel, 20, yPos + 5.5);
    yPos += 12;

    let unitTotal = 0;

    // Render each category within unit
    categories.forEach(category => {
      const workers = unitData[category];
      if (workers.length === 0) return;

      // Category Header
      doc.setTextColor(184, 134, 11);
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      const catTotal = workers.reduce((sum, w) => sum + (w.data.net || 0), 0);
      doc.text(`${categoryLabels[category] || category} (${workers.length} workers) — Subtotal: Rs.${catTotal.toLocaleString()}`, 20, yPos);
      yPos += 6;

      // Render each worker
      workers.forEach(({ wid, data, workerInfo }) => {
        // Check page break
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }

        // Worker summary
        doc.setTextColor(60, 64, 67);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text(data.name, 25, yPos);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(`Days: ${data.days}`, 80, yPos);
        doc.text(`Output: ${data.kg.toFixed(2)} kg`, 105, yPos);
        doc.text(`Assigned: ${data.assigned.toFixed(2)}`, 135, yPos);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 126, 52);
        doc.text(`Net: Rs.${data.net.toLocaleString()}`, 170, yPos);
        yPos += 5;

        // Show paid leave bonus if applicable
        if (data.paidLeaveBonus > 0) {
          doc.setTextColor(184, 134, 11);
          doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
          doc.text(`Paid Leave Bonus: +Rs.${data.paidLeaveBonus} (${data.unusedLeaves} unused leaves x Rs.${data.perDaySalary}/day)`, 30, yPos);
          yPos += 4;
        }

        // Daily breakdown table
        const dailyData = Object.keys(data.daily).sort().map(d => {
          const dd = data.daily[d];
          const statusDot = dd.status === 'absent' ? 'X' : isHalfDay(dd.status) ? 'H' : 'P';
          const dateStr = new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          return [
            statusDot + ' ' + dateStr,
            dd.assigned ? dd.assigned.toFixed(1) : '-',
            dd.output ? dd.output.toFixed(1) : '-',
            'Rs.' + dd.piece.toLocaleString(),
            dd.ot ? 'Rs.' + dd.ot : '-',
            dd.adv ? 'Rs.' + dd.adv : '-',
            'Rs.' + dd.net.toLocaleString()
          ];
        });

        if (dailyData.length > 0) {
          doc.autoTable({
            startY: yPos,
            head: [['Date', 'Asg', 'Out', 'Wage', 'OT', 'Adv', 'Net']],
            body: dailyData,
            margin: { left: 30, right: 15 },
            headStyles: { fillColor: [241, 243, 244], textColor: [60, 64, 67], fontSize: 6 },
            bodyStyles: { fontSize: 6, textColor: [60, 64, 67] },
            alternateRowStyles: { fillColor: [252, 252, 252] },
            styles: { lineColor: [218, 220, 224], lineWidth: 0.1, cellPadding: 1 },
            theme: 'grid'
          });
          yPos = doc.lastAutoTable.finalY + 3;
        }

        unitTotal += data.net;
      });

      yPos += 2;
    });

    // Unit Total
    doc.setDrawColor(184, 134, 11);
    doc.setLineWidth(0.5);
    doc.line(15, yPos, 195, yPos);
    yPos += 5;
    doc.setTextColor(184, 134, 11);
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(`${unitLabel} Total: Rs.${unitTotal.toLocaleString()}`, 20, yPos);
    yPos += 10;
  });

  // Maintenance Section
  if (maintenanceFiltered.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    // Maintenance Header
    doc.setFillColor(251, 146, 60);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`MAINTENANCE WORK (${maintenanceFiltered.length} entries)`, 20, yPos + 5.5);
    yPos += 12;

    const maintenanceData = maintenanceFiltered.map(m => {
      const w = workerById(m.workerId);
      const dateStr = new Date(m.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return [
        dateStr,
        w ? w.name : 'Unknown',
        m.workDescription || m.workDesc || 'No description',
        'Rs.' + (m.wage || m.wageAmount || 0).toLocaleString()
      ];
    });

    const maintenanceTotal = maintenanceFiltered.reduce((sum, m) => sum + Number(m.wage || m.wageAmount || 0), 0);

    doc.autoTable({
      startY: yPos,
      head: [['Date', 'Worker', 'Work Description', 'Payment']],
      body: [...maintenanceData, [
        { content: 'MAINTENANCE TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: 'Rs.' + maintenanceTotal.toLocaleString(), styles: { fontStyle: 'bold', textColor: [30, 126, 52] } }
      ]],
      margin: { left: 15, right: 15 },
      headStyles: { fillColor: [251, 146, 60], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 7, textColor: [60, 64, 67] },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      styles: { lineColor: [218, 220, 224], lineWidth: 0.1, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 85 },
        3: { cellWidth: 30, halign: 'right' }
      },
      theme: 'grid'
    });
    yPos = doc.lastAutoTable.finalY + 5;
  }

  // Grand Total
  if (yPos > 270) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(184, 134, 11);
  doc.rect(15, yPos, 180, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text(`GRAND TOTAL: Rs.${grandTotalPayroll.toLocaleString()}`, 20, yPos + 7);

  // Save or send
  if (autoCloud) {
    const pdfDataUri = doc.output('datauristring');
    return await sendCloudEmail({
      subject: `WageTrack Report: ${label}`,
      body: `Detailed report for ${label}. Includes unit-wise, category-wise breakdown with daily details, paid leave bonus, and maintenance work.`,
      filename: `Report_${new Date().getTime()}.pdf`,
      base64Data: pdfDataUri
    });
  } else {
    saveAndSharePDF(doc, `Report_${label.replace(/ /g, '_')}.pdf`);
  }
}


// ── LEADERBOARD ───────────────────────────────────────────────────────────
function openLeaderboard() {
  switchScreen('leaderboard');
  renderLeaderboard('daily');
}
function closeLeaderboard() {
  switchScreen('workers', document.querySelectorAll('.nav-btn')[1]);
}
function renderLeaderboard(period) {
  currentLeaderboardPeriod = period;
  document.querySelectorAll('#screen-leaderboard .report-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('lb-tab-' + period).classList.add('active');

  const now = new Date();
  const today = todayStr();
  let from = today;
  let label = 'Today';

  if (period === 'weekly') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    from = start.toISOString().split('T')[0];
    label = 'This Week';
  } else if (period === 'monthly') {
    from = now.toISOString().substr(0, 7) + '-01';
    label = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  const map = {};
  getAllEntries().filter(e => normalizeDate(e.date) >= from && normalizeDate(e.date) <= today).forEach(e => {
    const w = workerById(e.workerId);
    if (!w) return;
    const category = w.category || (w.type === 'permanent' ? 'monthly_salary' : w.type === 'packing' ? 'bundle_packing' : w.type === 'other' ? 'daily_wages' : 'piece_work');
    if (category !== 'piece_work') return;
    map[e.workerId] = Number(((Number(map[e.workerId] || 0)) + Number(e.output || 0)).toFixed(2));
  });

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const content = document.getElementById('leaderboard-content');
  if (sorted.length === 0) {
    content.innerHTML = `<div class="empty">No data for this period.</div>`;
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  content.innerHTML = sorted.map(([wid, kg], i) => {
    const w = workerById(wid);
    let rank = i < 3 ? `<div style="font-size:24px;">${medals[i]}</div>` : `<div style="font-size:14px; font-weight:800; color:var(--text-muted);">#${i + 1}</div>`;
    return `
      <div class="list-item" style="margin-bottom:8px;">
        <div style="width:40px; display:flex; justify-content:center;">${rank}</div>
        <div class="item-main">
          <div class="item-title">${w ? w.name : 'Unknown'}</div>
          <div class="item-sub">${Number(kg).toFixed(2)} kg completed</div>
        </div>
        <div class="item-right"><div style="font-size:18px; font-weight:800; color:var(--accent);">${Number(kg).toFixed(2)}</div></div>
      </div>`;
  }).join('');
}

async function exportLeaderboardPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const period = currentLeaderboardPeriod || 'daily';

  const now = new Date();
  const today = todayStr();
  let from = today;
  let label = 'Today';

  if (period === 'weekly') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    from = start.toISOString().split('T')[0];
    label = 'This Week';
  } else if (period === 'monthly') {
    from = now.toISOString().substr(0, 7) + '-01';
    label = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  const map = {};
  getAllEntries().filter(e => normalizeDate(e.date) >= from && normalizeDate(e.date) <= today).forEach(e => {
    const w = workerById(e.workerId);
    if (!w) return;
    const category = w.category || (w.type === 'permanent' ? 'monthly_salary' : w.type === 'packing' ? 'bundle_packing' : w.type === 'other' ? 'daily_wages' : 'piece_work');
    if (category !== 'piece_work') return;
    map[e.workerId] = Number(((Number(map[e.workerId] || 0)) + Number(e.output || 0)).toFixed(2));
  });

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) { showToast('No data to export'); return; }

  // Header
  doc.setFillColor(241, 243, 244);
  doc.rect(0, 0, 210, 45, 'F');
  doc.setTextColor(184, 134, 11);
  doc.setFontSize(24); doc.setFont("helvetica", "bold");
  doc.text("Top Performers", 15, 22);
  doc.setTextColor(60, 64, 67);
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Period: ${label} (Prod 1)`, 15, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 36);

  const tableData = sorted.map(([wid, kg], i) => {
    const w = workerById(wid);
    return [i + 1, w ? w.name : 'Unknown', kg.toLocaleString() + " kg"];
  });

  doc.autoTable({
    startY: 55,
    head: [['Rank', 'Worker Name', 'Output (KG)']],
    body: tableData,
    headStyles: { fillColor: [241, 243, 244], textColor: [184, 134, 11] },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    margin: { top: 55 },
    styles: { fontSize: 10, lineColor: [218, 220, 224], lineWidth: 0.1 }
  });

  saveAndSharePDF(doc, `Top_Performers_${label.replace(/ /g, '_')}.pdf`);
}

async function cloudSyncReport() {
  if (!currentUser) return;
  const btn = event ? event.currentTarget : null;
  const originalContent = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="rotating" style="display:inline-block;">↻</span> Sending...`;
  }

  try {
    const success = await exportReportPDF(true);
    if (success) {
      showToast('✓ Report sent to your Google Drive/Email');
    }
  } catch (err) {
    console.error('Report Cloud Error:', err);
    showToast('Error: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }
}
