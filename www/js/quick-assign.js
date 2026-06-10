// ── QUICK ASSIGN LOGIC ──────────────────────────────────────────────────────────

function openQuickAssignMenu() {
  if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    const hasAnyAccess = accessible.some(prod => hasActionPermission(prod, 'work') || hasActionPermission(prod, 'payment'));
    if (!hasAnyAccess) { showToast('Permission Denied'); return; }
    
    // Filter buttons based on supervisor access
    const modal = document.getElementById('modal-quick-assign-menu');
    if (modal) {
      const buttons = modal.querySelectorAll('button[onclick*="openQuickAssign"]');
      buttons.forEach(btn => {
        const match = btn.getAttribute('onclick').match(/openQuickAssign\('([^']+)',\s*'([^']+)'\)/);
        if (match) {
          const unit = match[1];
          if (accessible.includes(unit)) {
            btn.style.display = 'block';
          } else {
            btn.style.display = 'none';
          }
        }
      });
      
      // Hide unit headers if no buttons visible in that unit
      ['unit1', 'unit2', 'unit3', 'unit4'].forEach(unit => {
        const unitDiv = modal.querySelector(`div:has(> button[onclick*="'${unit}'"])`);
        if (unitDiv) {
          const visibleButtons = Array.from(unitDiv.querySelectorAll('button[onclick*="openQuickAssign"]'))
            .filter(btn => btn.style.display !== 'none');
          if (visibleButtons.length === 0) {
            unitDiv.style.display = 'none';
          } else {
            unitDiv.style.display = 'block';
          }
        }
      });
    }
  }
  const modal = document.getElementById('modal-quick-assign-menu');
  if (modal) modal.classList.add('open');
}

function openQuickAssign(unitType, category) {
  if (currentUser.role === 'supervisor' && !hasActionPermission(unitType, 'work') && !hasActionPermission(unitType, 'payment')) {
    showToast('Permission Denied for this unit');
    return;
  }
  closeModal('modal-quick-assign-menu');
  currentQuickAssignType = unitType;
  currentQuickAssignCategory = category;
  
  // Filter workers by unit AND category
  let targetWorkers = workers.filter(w => {
    const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
    const workerCategory = w.category || 'piece_work';
    
    // Legacy type mapping
    let mappedCategory = workerCategory;
    if (!w.category && w.type) {
      const typeMap = {
        'daily': 'piece_work',
        'permanent': 'monthly_salary',
        'packing': 'bundle_packing',
        'other': 'daily_wages'
      };
      mappedCategory = typeMap[w.type] || 'piece_work';
    }
    
    return workerUnit === unitType && mappedCategory === category;
  });
  
  if (currentUser.role === 'supervisor') {
    const accessible = getAccessibleProductions();
    targetWorkers = targetWorkers.filter(w => {
      const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
      return accessible.includes(workerUnit);
    });
  }
  
  if (targetWorkers.length === 0) {
    const categoryLabels = {
      piece_work: 'Piece Work',
      bundle_packing: 'Bundle Packing',
      cover_packing: 'Cover Packing',
      daily_wages: 'Daily Wages',
      monthly_salary: 'Monthly Salary'
    };
    showToast(`No ${categoryLabels[category] || category} workers in ${unitType.toUpperCase()}`);
    return;
  }
  
  const categoryInfo = {
    piece_work: { label: 'Piece Work', unit: 'kg' },
    bundle_packing: { label: 'Bundle Packing', unit: 'items' },
    cover_packing: { label: 'Cover Packing', unit: 'items' },
    daily_wages: { label: 'Daily Wages', unit: 'items' },
    monthly_salary: { label: 'Monthly Salary', unit: 'kg' }
  };
  
  const typeInfo = categoryInfo[category] || categoryInfo['piece_work'];
  const typeLabel = typeInfo.label;
  const unitLabel = typeInfo.unit;
  const unitNum = unitType.replace('unit', '');
  
  const title = document.getElementById('qa-title');
  const sub = document.getElementById('qa-subtitle');
  if (title) title.textContent = `⚡ Quick Assign — Unit ${unitNum} · ${typeLabel}`;
  if (sub) sub.textContent = `Assign work to all ${typeLabel} workers in Unit ${unitNum}.`;

  const weightInp = document.getElementById('qa-total-kg');
  const rateInp = document.getElementById('qa-rate');
  const hasPaymentPerm = hasActionPermission(unitType, 'payment');

  if (weightInp) {
    weightInp.previousElementSibling.textContent = unitLabel === 'kg' ? `WEIGHT PER WORKER (KG) — Applied to all` : `ITEMS PER WORKER — Applied to all`;
    weightInp.value = '';
  }
  if (rateInp) {
    rateInp.previousElementSibling.textContent = unitLabel === 'kg' ? `RATE PER KG (₹) — Applied to all` : `RATE PER ITEM (₹) — Applied to all`;
    rateInp.value = '';
    rateInp.readOnly = !hasPaymentPerm;
    rateInp.placeholder = !hasPaymentPerm ? 'Rate set by Admin only' : (unitLabel === 'kg' ? 'e.g. 15' : 'e.g. 2');
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
          <div style="font-size:10px; color:var(--text-muted); font-family:var(--mono);">${w.empId || ''} · ${w.category || w.type || 'piece_work'}</div>
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
  const targetWorkers = workers.filter(w => {
    const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
    const workerCategory = w.category || 'piece_work';
    
    // Legacy type mapping
    let mappedCategory = workerCategory;
    if (!w.category && w.type) {
      const typeMap = {
        'daily': 'piece_work',
        'permanent': 'monthly_salary',
        'packing': 'bundle_packing',
        'other': 'daily_wages'
      };
      mappedCategory = typeMap[w.type] || 'piece_work';
    }
    
    return workerUnit === currentQuickAssignType && mappedCategory === currentQuickAssignCategory;
  });
  if (qtyPerWorker <= 0 || targetWorkers.length === 0) return;
  targetWorkers.forEach(w => {
    const qtyEl = document.getElementById(`qa-kg-${w.id}`);
    if (qtyEl) qtyEl.value = qtyPerWorker;
  });
  updateQAPreview();
}

function updateQAPreview() {
  const rate = parseFloat(document.getElementById('qa-rate').value) || 0;
  const targetWorkers = workers.filter(w => {
    const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
    const workerCategory = w.category || 'piece_work';
    
    // Legacy type mapping
    let mappedCategory = workerCategory;
    if (!w.category && w.type) {
      const typeMap = {
        'daily': 'piece_work',
        'permanent': 'monthly_salary',
        'packing': 'bundle_packing',
        'other': 'daily_wages'
      };
      mappedCategory = typeMap[w.type] || 'piece_work';
    }
    
    return workerUnit === currentQuickAssignType && mappedCategory === currentQuickAssignCategory;
  });
  
  const categoryInfo = {
    piece_work: { label: 'Piece Work', unit: 'kg' },
    bundle_packing: { label: 'Bundle Packing', unit: 'items' },
    cover_packing: { label: 'Cover Packing', unit: 'items' },
    daily_wages: { label: 'Daily Wages', unit: 'items' },
    monthly_salary: { label: 'Monthly Salary', unit: 'kg' }
  };
  
  const typeInfo = categoryInfo[currentQuickAssignCategory] || categoryInfo['piece_work'];
  const unitLabel = typeInfo.unit;
  
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
  const hasPaymentPerm = hasActionPermission(currentQuickAssignType, 'payment');
  const enteredRate = parseFloat(document.getElementById('qa-rate').value) || 0;

  if (!date) { showToast('Select a date'); return; }
  // Only require rate if user is admin OR supervisor with payment permission
  if ((!isSup || hasPaymentPerm) && enteredRate <= 0) { showToast('Enter rate'); return; }

  const targetWorkers = workers.filter(w => {
    const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
    const workerCategory = w.category || 'piece_work';
    
    // Legacy type mapping
    let mappedCategory = workerCategory;
    if (!w.category && w.type) {
      const typeMap = {
        'daily': 'piece_work',
        'permanent': 'monthly_salary',
        'packing': 'bundle_packing',
        'other': 'daily_wages'
      };
      mappedCategory = typeMap[w.type] || 'piece_work';
    }
    
    return workerUnit === currentQuickAssignType && mappedCategory === currentQuickAssignCategory;
  });
  let saved = 0;

  targetWorkers.forEach(w => {
    const qtyEl = document.getElementById(`qa-kg-${w.id}`);
    const qty = parseFloat(qtyEl ? qtyEl.value : 0) || 0;
    if (qty <= 0) return;

    // Route to correct unit using worker's unit field
    const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
    const targetEntries = getUnitEntries(workerUnit);

    const prevEntry = targetEntries.filter(e => e.workerId === w.id).sort((a, b) => normalizeDate(b.date).localeCompare(normalizeDate(a.date)))[0];
    // Determine rate based on user role and permissions:
    // - Admin: always use entered rate
    // - Supervisor with payment permission: use entered rate
    // - Supervisor without payment permission: use previous entry rate or worker's default otRate
    const rate = (isSup && !hasPaymentPerm) ? (prevEntry ? prevEntry.rate : (w.flatAmount || w.salary || w.dailyWage || 0)) : enteredRate;
    const wage = Math.round(qty * rate);
    const existingIdx = targetEntries.findIndex(e => e.workerId === w.id && normalizeDate(e.date) === date);

    const entryData = {
      id: existingIdx >= 0 ? targetEntries[existingIdx].id : uid(),
      workerId: w.id,
      workerName: w.name,
      homeUnit: w.unit || getProdKey(w.category || w.type || 'daily'),
      homeCategory: w.category || w.type || 'piece_work',
      category: w.category || w.type || 'piece_work',
      date,
      assigned: qty,
      assignedTotal: qty,
      output: qty,
      mAssigned: qty,
      assignedMorning: qty,
      aAssigned: 0,
      assignedAfternoon: 0,
      notCompleted: 0,
      rate,
      wage,
      wageAmount: wage,
      workDesc: '',
      workDescription: '',
      otHours: 0,
      otAmount: 0,
      advance: 0
    };
    if (existingIdx >= 0) targetEntries[existingIdx] = entryData;
    else targetEntries.push(entryData);
    saved++;
  });

  if (saved === 0) { showToast('Enter quantity for at least one worker'); return; }
  save();
  closeModal('modal-quick-assign');
  renderAll();
  showToast(`✓ Assigned to ${saved} worker${saved > 1 ? 's' : ''}!`);
}
