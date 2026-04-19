// ── UI HELPERS & MODALS ───────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function switchScreen(name, btn) {
  try {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById('screen-' + name);
    if (target) {
      target.classList.add('active');
    } else {
      console.error('Target screen not found:', name);
      const home = document.getElementById('screen-home');
      if (home) home.classList.add('active');
    }

    if (btn) btn.classList.add('active');

    if (name === 'reports') {
      if (typeof buildWorkerFilterChips === 'function') buildWorkerFilterChips();
      if (typeof renderReport === 'function') renderReport();
    }
  } catch (e) {
    console.error('SwitchScreen error:', e);
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function toggleWorkerTypeFields(type) {
  const group = document.getElementById('w-salary-group');
  if (!group) return;
  if (type === 'permanent') group.classList.remove('hidden');
  else group.classList.add('hidden');
}

function toggleEntryFields(workerType) {
  const fieldIds = [
    'e-kg-fields', 'e-kg-fields-2', 'e-kg-sync-row', 'e-rate-field',
    'e-packing-pieces', 'e-work-desc', 'e-payment-field'
  ];
  
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  if (workerType === 'daily' || workerType === 'permanent') {
    ['e-kg-fields', 'e-kg-fields-2', 'e-kg-sync-row', 'e-rate-field'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    });
  } else if (workerType === 'packing') {
    ['e-packing-pieces', 'e-rate-field'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    });
  } else if (workerType === 'other') {
    ['e-work-desc', 'e-payment-field'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    });
  }
}

function checkAuth() {
  const loginScreen = document.getElementById('screen-login');
  const mainHeader = document.getElementById('main-header');
  const bottomNav = document.querySelector('.bottom-nav');

  if (currentUser) {
    if (loginScreen) loginScreen.classList.remove('active');
    if (mainHeader) mainHeader.classList.remove('hidden');
    if (bottomNav) bottomNav.classList.remove('hidden');

    const activeScreens = document.querySelectorAll('.screen.active');
    if (activeScreens.length === 0) {
      switchScreen('home', document.querySelector('.nav-btn'));
    }
  } else {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (loginScreen) loginScreen.classList.add('active');
    if (mainHeader) mainHeader.classList.add('hidden');
    if (bottomNav) bottomNav.classList.add('hidden');
  }
}

// Add CSS for rotation
const style = document.createElement('style');
style.innerHTML = `
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .rotating svg {
    animation: rotate 1s linear infinite;
  }
`;
document.head.appendChild(style);

// Overlay click to close modals
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
});
