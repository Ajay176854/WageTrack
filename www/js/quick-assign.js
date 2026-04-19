// ── QUICK ASSIGN LOGIC ──────────────────────────────────────────────────────────

function openQuickAssignMenu() {
  if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    const hasAnyPaymentPerm = accessible.some(prod => hasActionPermission(prod, 'payment'));
    if (!hasAnyPaymentPerm) { showToast('Permission Denied: No payment access'); return; }
  }
  const modal = document.getElementById('modal-quick-assign-menu');
  if (modal) modal.classList.add('open');
}

function openQuickAssign(type) {
  if (currentUser.role === 'supervisor' && !hasActionPermission(type, 'payment')) {
    showToast('Permission Denied: No payment access for this section');
    return;
  }
  closeModal('modal-quick-assign-menu');
  currentQuickAssignType = type;
  let targetWorkers = workers.filter(w => (w.type || 'daily') === type);
  if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    targetWorkers = targetWorkers.filter(w => accessible.includes(w.type || 'daily'));
  }
  if (targetWorkers.length === 0) {
    showToast(`No ${type === 'daily' ? 'Production 1' : 'Production 3'} workers to assign`);
    return;
  }
  
  const typeLabel = type === 'daily' ? 'Production 1 — Daily Wage' : 'Production 3 — Packing';
  const unitLabel = type === 'daily' ? 'kg' : 'items';
  const title = document.getElementById('qa-title');
  const sub = document.getElementById('qa-subtitle');
  if (title) title.textContent = `⚡ Quick Assign — ${typeLabel}`;
  if (sub) sub.textContent = `Assign work to all ${typeLabel} workers in one click.`;

  const weightInp = document.getElementById('qa-total-kg');
  const rateInp = document.getElementById('qa-rate');
  if (weightInp) {
    weightInp.previousElementSibling.textContent = type === 'daily' ? `WEIGHT PER WORKER (KG) — Applied to all` : `ITEMS PER WORKER — Applied to all`;
    weightInp.value = '';
  }
  if (rateInp) {
    rateInp.previousElementSibling.textContent = type === 'daily' ? `RATE PER KG (₹) — Applied to all` : `RATE PER ITEM (₹) — Applied to all`;
    rateInp.value = '';
    const isSup = currentUser.role === 'supervisor';
    rateInp.readOnly = isSup;
    rateInp.placeholder = isSup ? 'Rate set by Admin only' : (type === 'daily' ? 'e.g. 15' : 'e.g. 2');
  }
  
  const dateInp = document.getElementById('qa-date');
  if (dateInp) dateInp.value = todayStr();

  const list = document.getElementById('qa-workers-list');
  if (list) {
    list.innerHTML = targetWorkers.map(w => `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; background:var(--surface-raised); padding:12px; border-radius:12px; border:1px solid var(--border);">
        <div style="font-size:20px;">${w.emoji || '👷'}</div>
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:700; color:var(--text-bright);">${w.name}</div>
          <div style="font-size:10px; color:var(--text-muted); font-family:var(--mono);">${w.empId || ''}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="number" id="qa-kg-${w.id}" class="form-input" style="width:72px; padding:8px; font-size:13px; text-align:center; height:36px;" placeholder="${unitLabel}" oninput="updateQAPreview()" />
          <div style="font-size:12px; font-family:var(--mono); color:var(--accent); min-width:60px; text-align:right; font-weight:700;" id="qa-preview-${w.id}">₹0</div>
        </div>
      </div>`).join('');
  }
  const modal = document.getElementById('modal-quick-assign');
  if (modal) modal.classList.add('open');
}

function splitTotalKG() {
  const qtyPerWorker = parseFloat(document.getElementById('qa-total-kg').value) || 0;
  const targetWorkers = workers.filter(w => (w.type || 'daily') === currentQuickAssignType);
  if (qtyPerWorker <= 0 || targetWorkers.length === 0) return;
  targetWorkers.forEach(w => {
    const qtyEl = document.getElementById(`qa-kg-${w.id}`);
    if (qtyEl) qtyEl.value = qtyPerWorker;
  });
  updateQAPreview();
}

function updateQAPreview() {
  const rate = parseFloat(document.getElementById('qa-rate').value) || 0;
  const targetWorkers = workers.filter(w => (w.type || 'daily') === currentQuickAssignType);
  const unitLabel = currentQuickAssignType === 'daily' ? 'kg' : 'items';
  targetWorkers.forEach(w => {
    const qtyEl = document.getElementById(`qa-kg-${w.id}`);
    const prevEl = document.getElementById(`qa-preview-${w.id}`);
    if (!qtyEl || !prevEl) return;
    const qty = parseFloat(qtyEl.value) || 0;
    prevEl.textContent = rate > 0 && qty > 0 ? `₹${Math.round(qty * rate)}` : (qty > 0 ? `${qty} ${unitLabel}` : '₹0');
  });
}

function saveQuickAssign() {
  const dateInp = document.getElementById('qa-date');
  if (!dateInp) return;
  const date = dateInp.value;
  const isSup = currentUser.role === 'supervisor';
  const enteredRate = parseFloat(document.getElementById('qa-rate').value) || 0;

  if (!date) { showToast('Select a date'); return; }
  if (!isSup && enteredRate <= 0) { showToast('Enter rate'); return; }

  const targetWorkers = workers.filter(w => (w.type || 'daily') === currentQuickAssignType);
  let saved = 0;

  targetWorkers.forEach(w => {
    const qtyEl = document.getElementById(`qa-kg-${w.id}`);
    const qty = parseFloat(qtyEl ? qtyEl.value : 0) || 0;
    if (qty <= 0) return;

    const prevEntry = entries.filter(e => e.workerId === w.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    const rate = isSup ? (prevEntry ? prevEntry.rate : 0) : enteredRate;
    const wage = Math.round(qty * rate * 100) / 100;
    const existing = entries.findIndex(e => e.workerId === w.id && e.date === date);

    const entryData = {
      id: existing >= 0 ? entries[existing].id : uid(),
      workerId: w.id, date,
      assigned: qty, output: qty,
      mAssigned: currentQuickAssignType === 'daily' ? qty : 0,
      aAssigned: 0,
      notCompleted: 0, rate, wage,
      workDesc: ''
    };
    if (existing >= 0) entries[existing] = entryData;
    else entries.push(entryData);
    saved++;
  });

  if (saved === 0) { showToast('Enter quantity for at least one worker'); return; }
  save();
  closeModal('modal-quick-assign');
  renderAll();
  showToast(`✓ Assigned to ${saved} worker${saved > 1 ? 's' : ''}!`);
}
