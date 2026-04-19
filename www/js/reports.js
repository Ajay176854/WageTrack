// ── REPORT & STATS LOGIC ───────────────────────────────────────────────────

let reportState = {
  fromDate: todayStr(),
  toDate: todayStr(),
  workerFilter: 'all',
  productionFilter: 'all',
  label: 'Today'
};

function switchReportProductionTab(type) {
  reportState.productionFilter = type;
  document.querySelectorAll('#screen-reports .report-tab').forEach(t => t.classList.remove('active'));
  const tabIds = { all: 'report-prod-all', daily: 'report-prod-1', permanent: 'report-prod-2', packing: 'report-prod-3', other: 'report-prod-4' };
  const target = document.getElementById(tabIds[type]);
  if (target) target.classList.add('active');
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
    visibleWorkers = workers.filter(w => getAccessibleProductions().includes(w.type || 'daily'));
  }
  sel.innerHTML = '<option value="all">All Workers</option>' +
    visibleWorkers.map(w => `<option value="${w.id}">${w.emoji || ''} ${w.name}</option>`).join('');
  if (current && [...sel.options].some(o => o.value === current)) sel.value = current;
  else sel.value = reportState.workerFilter;
}

function renderReport() {
  const content = document.getElementById('report-content');
  if (!content) return;
  const { fromDate, toDate, workerFilter, productionFilter } = reportState;

  let filtered = entries.filter(e => e.date >= fromDate && e.date <= toDate);
  let attFiltered = attendance.filter(a => a.date >= fromDate && a.date <= toDate);

  const workerMap = {};
  workers.forEach(w => {
    if (currentUser && currentUser.role === 'supervisor') {
      const accessible = getAccessibleProductions();
      if (!accessible.includes(w.type || 'daily')) return;
    }
    if (workerFilter === 'all' || w.id === workerFilter) {
      workerMap[w.id] = { kg: 0, assigned: 0, wage: 0, ot: 0, advance: 0, net: 0, days: 0, daily: {}, name: w.name, emoji: w.emoji };
    }
  });

  filtered.forEach(e => {
    if (!workerMap[e.workerId]) return;
    if (productionFilter !== 'all') {
        if (productionFilter === 'other') { if (!e.workDesc) return; }
        else { const w = workerById(e.workerId); if (!w || (w.type || 'daily') !== productionFilter || e.workDesc) return; }
    }
    workerMap[e.workerId].kg += e.output;
    workerMap[e.workerId].assigned += e.assigned;
    workerMap[e.workerId].wage += e.wage;
    if (!workerMap[e.workerId].daily[e.date]) workerMap[e.workerId].daily[e.date] = { piece: 0, ot: 0, adv: 0, output: 0, assigned: 0, net: 0, status: 'present' };
    workerMap[e.workerId].daily[e.date].piece += e.wage;
    workerMap[e.workerId].daily[e.date].output += e.output;
    workerMap[e.workerId].daily[e.date].assigned += e.assigned;
  });

  attFiltered.forEach(a => {
    if (!workerMap[a.workerId]) return;
    const wInfo = workerById(a.workerId);
    if (productionFilter !== 'all' && (wInfo.type || 'daily') !== productionFilter) return;
    
    workerMap[a.workerId].ot += a.otAmount;
    workerMap[a.workerId].advance += a.advance;
    if (!workerMap[a.workerId].daily[a.date]) workerMap[a.workerId].daily[a.date] = { piece: 0, ot: 0, adv: 0, output: 0, assigned: 0, net: 0, status: 'present' };
    workerMap[a.workerId].daily[a.date].ot += a.otAmount;
    workerMap[a.workerId].daily[a.date].adv += a.advance;
    workerMap[a.workerId].daily[a.date].status = a.status;
  });

  let totalWage = 0, totalKg = 0, totalWorkersActive = 0, totalDaysActive = new Set();
  let totalAssigned = 0;

  Object.keys(workerMap).forEach(wid => {
    let w = workerMap[wid];
    const workerInfo = workerById(wid);
    const activeDates = new Set([ ...Object.keys(w.daily), ...attFiltered.filter(a => a.workerId === wid && isWorking(a.status)).map(a => a.date) ]);
    w.days = activeDates.size;

    if (workerInfo.type === 'permanent') {
      const daysPresent = attFiltered.filter(a => a.workerId === wid && isWorking(a.status)).reduce((acc, a) => acc + (isHalfDay(a.status) ? 0.5 : 1), 0);
      w.wage += Math.round(((workerInfo.salary || 0) / 30) * daysPresent);
    }
    w.net = w.wage + w.ot - w.advance;
    if (w.days === 0 && w.ot === 0 && w.advance === 0 && w.wage === 0) {
      delete workerMap[wid];
    } else {
      totalWage += w.net;
      totalKg += w.kg;
      totalAssigned += w.assigned;
      totalWorkersActive++;
      Object.keys(w.daily).forEach(d => {
        totalDaysActive.add(d);
        if (workerInfo.type === 'permanent') {
          const att = attFiltered.find(a => a.workerId === wid && a.date === d);
          if (att && isWorking(att.status)) w.daily[d].piece += Math.round((workerInfo.salary || 0) / 30 * (isHalfDay(att.status) ? 0.5 : 1));
        }
        w.daily[d].net = w.daily[d].piece + w.daily[d].ot - w.daily[d].adv;
      });
    }
  });

  if (totalWorkersActive === 0) {
    content.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">No entries found.</div></div>`;
    return;
  }

  const tableRows = Object.entries(workerMap).map(([wid, data]) => {
    const dailyRows = Object.keys(data.daily).sort().map(d => {
      const dd = data.daily[d];
      const statusDot = dd.status === 'absent' ? '✕' : isHalfDay(dd.status) ? '½' : '✓';
      return `<tr style="border-bottom:1px solid var(--border);font-size:11px;">
        <td style="padding:5px;">${statusDot} ${new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
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
          <div style="font-size:10px;color:var(--text-muted);">${data.kg} kg · ${data.days} days</div>
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
  }).join('');

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
        <div style="font-size:16px;font-weight:800;font-family:var(--mono);color:var(--accent2);">₹${totalWage.toLocaleString()}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">TOTAL PAY</div>
      </div>
    </div>
    ${tableRows}`;
}

async function exportReportPDF(autoCloud = false) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const { fromDate, toDate, workerFilter, productionFilter, label } = reportState;
  
  let filtered = entries.filter(e => e.date >= fromDate && e.date <= toDate);
  let attFiltered = attendance.filter(a => a.date >= fromDate && a.date <= toDate);

  const workerMap = {};
  filtered.forEach(e => {
    if (!workerMap[e.workerId]) workerMap[e.workerId] = { wage: 0, ot: 0, advance: 0, net: 0, output: 0, assigned: 0 };
    if (productionFilter !== 'all') {
        if (productionFilter === 'other') { if (!e.workDesc) return; }
        else { const w = workerById(e.workerId); if (!w || (w.type || 'daily') !== productionFilter || e.workDesc) return; }
    }
    workerMap[e.workerId].wage += e.wage;
    workerMap[e.workerId].output += e.output;
    workerMap[e.workerId].assigned += e.assigned;
  });
  
  attFiltered.forEach(a => {
    if (!workerMap[a.workerId]) return;
    const w = workerById(a.workerId);
    if (productionFilter !== 'all' && (w.type || 'daily') !== productionFilter) return;
    workerMap[a.workerId].ot += a.otAmount;
    workerMap[a.workerId].advance += a.advance;
  });

  // Add permanent worker wages
  Object.keys(workerMap).forEach(wid => {
    const w = workerById(wid);
    if (w && w.type === 'permanent') {
      const daysPresent = attFiltered.filter(a => a.workerId === wid && isWorking(a.status)).reduce((acc, a) => acc + (isHalfDay(a.status) ? 0.5 : 1), 0);
      workerMap[wid].wage += Math.round(((w.salary || 0) / 30) * daysPresent);
    }
    workerMap[wid].net = workerMap[wid].wage + workerMap[wid].ot - workerMap[wid].advance;
  });

  if (Object.keys(workerMap).length === 0) { showToast('No data to export'); return; }

  // Header
  doc.setFillColor(13, 17, 23);
  doc.rect(0, 0, 210, 45, 'F');
  doc.setTextColor(240, 192, 64);
  doc.setFontSize(24); doc.setFont("helvetica", "bold");
  doc.text("WageTrack Report", 15, 22);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Period: ${label}`, 15, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 36);

  // Totals Calculation
  let tAsg = 0, tOut = 0, tWage = 0, tOt = 0, tAdv = 0, tNet = 0;
  const tableData = Object.entries(workerMap).map(([wid, data]) => {
    const w = workerById(wid);
    tAsg += data.assigned; tOut += data.output; tWage += data.wage; tOt += data.ot; tAdv += data.advance; tNet += data.net;
    return [w ? w.name : 'Unknown', data.assigned, data.output, data.wage.toLocaleString(), data.ot.toLocaleString(), data.advance.toLocaleString(), data.net.toLocaleString()];
  });

  // Summary Grid
  doc.setFillColor(22, 27, 34); doc.rect(15, 52, 180, 20, 'F');
  doc.setTextColor(240, 192, 64); doc.setFontSize(8); doc.text("TOTAL WORKERS", 20, 58); doc.text("TOTAL OUTPUT", 60, 58); doc.text("TOTAL PAYROLL", 110, 58);
  doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text(String(Object.keys(workerMap).length), 20, 66); doc.text(tOut.toLocaleString() + " kg", 60, 66); doc.text("₹" + tNet.toLocaleString(), 110, 66);

  doc.autoTable({
    startY: 80,
    head: [['Worker', 'Assigned', 'Output', 'Wage', 'OT', 'Advance', 'Net']],
    body: [...tableData, [
      { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', fillColor: [240, 192, 64], textColor: [0, 0, 0] } },
      { content: tAsg.toLocaleString(), styles: { fontStyle: 'bold' } },
      { content: tOut.toLocaleString(), styles: { fontStyle: 'bold' } },
      { content: tWage.toLocaleString(), styles: { fontStyle: 'bold' } },
      { content: tOt.toLocaleString(), styles: { fontStyle: 'bold' } },
      { content: tAdv.toLocaleString(), styles: { fontStyle: 'bold' } },
      { content: tNet.toLocaleString(), styles: { fontStyle: 'bold', textColor: [63, 185, 80] } }
    ]],
    headStyles: { fillColor: [13, 17, 23], textColor: [240, 192, 64] },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    margin: { top: 80 }
  });

  if (autoCloud) {
    const pdfDataUri = doc.output('datauristring');
    return await sendCloudEmail({
      subject: `WageTrack Report: ${label}`,
      body: `Cloud backup of report for ${label}.`,
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
  if (period === 'weekly') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    from = start.toISOString().split('T')[0];
  } else if (period === 'monthly') {
    from = now.toISOString().substr(0, 7) + '-01';
  }

  const map = {};
  entries.filter(e => e.date >= from && e.date <= today).forEach(e => {
    const w = workerById(e.workerId);
    if (!w || (w.type && w.type !== 'daily')) return;
    map[e.workerId] = (map[e.workerId] || 0) + e.output;
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
          <div class="item-sub">${kg} kg completed</div>
        </div>
        <div class="item-right"><div style="font-size:18px; font-weight:800; color:var(--accent);">${kg}</div></div>
      </div>`;
  }).join('');
}
