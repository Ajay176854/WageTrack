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

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function toggleWorkerTypeFields(type) {
  const salGroup = document.getElementById('w-salary-group');
  const packGroup = document.getElementById('w-packing-group');
  const dailyGroup = document.getElementById('w-daily-group');

  if (salGroup) salGroup.classList.add('hidden');
  if (packGroup) packGroup.classList.add('hidden');
  if (dailyGroup) dailyGroup.classList.add('hidden');

  if (type === 'permanent') {
    if (salGroup) salGroup.classList.remove('hidden');
  } else if (type === 'packing') {
    if (packGroup) packGroup.classList.remove('hidden');
  } else if (type === 'daily') {
    if (dailyGroup) dailyGroup.classList.remove('hidden');
  }
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

  updateAdminVisibility();

  if (currentUser) {
    if (loginScreen) loginScreen.classList.remove('active');
    if (mainHeader) mainHeader.classList.remove('hidden');
    if (bottomNav) bottomNav.classList.remove('hidden');

    // Admin defaults to 'all' production tab
    if (currentUser.role === 'admin') {
      currentProductionTab = 'all';
    }

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

function updateAdminVisibility() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    if (isAdmin) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
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

// ── PDF PREVIEW & DOWNLOAD HELPERS ──────────────────────────────────────────

let currentPdfDoc = null;

async function saveAndSharePDF(doc, filename) {
  const viewer = document.getElementById('pdf-viewer-overlay');
  const loading = document.getElementById('pdf-loading');
  const canvasContainer = document.getElementById('pdf-canvas-container');
  const title = document.getElementById('pdf-viewer-title');

  if (!viewer) return;

  viewer.style.display = 'flex';
  loading.style.display = 'flex';
  canvasContainer.innerHTML = '';
  title.textContent = filename;

  try {
    const pdfDataUri = doc.output('datauristring');
    const pdfData = atob(pdfDataUri.split(',')[1]);
    const uint8Array = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
      uint8Array[i] = pdfData.charCodeAt(i);
    }

    currentPdfDoc = doc; // Store globally for download

    // Use PDF.js to render preview
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    loading.style.display = 'none';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = '100%';
      canvas.style.marginBottom = '10px';
      canvas.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';

      canvasContainer.appendChild(canvas);

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
    }
  } catch (err) {
    console.error('PDF Preview Error:', err);
    showToast('Failed to generate preview. Downloading directly...');
    doc.save(filename);
    closePDFViewer();
  }
}

function downloadPDF() {
  if (currentPdfDoc) {
    const title = document.getElementById('pdf-viewer-title').textContent || 'Report.pdf';

    // Check if running on mobile via Capacitor
    if (window.Capacitor && window.Capacitor.isNativePlatform) {
        handleNativePdfDownload(currentPdfDoc, title);
    } else {
        currentPdfDoc.save(title);
        showToast('Download started');
    }
  }
}

async function handleNativePdfDownload(doc, filename) {
    try {
        const { Filesystem, Share } = Capacitor.Plugins;
        const pdfBase64 = doc.output('datauristring').split(',')[1];

        // Save to cache directory first
        const savedFile = await Filesystem.writeFile({
            path: filename,
            data: pdfBase64,
            directory: 'CACHE'
        });

        // Trigger native share/save sheet
        await Share.share({
            title: filename,
            url: savedFile.uri,
            dialogTitle: 'Save or Share PDF'
        });
    } catch (err) {
        console.error('Native PDF Error:', err);
        showToast('Native Save Failed: ' + err.message);
    }
}

function closePDFViewer() {
  const viewer = document.getElementById('pdf-viewer-overlay');
  if (viewer) viewer.style.display = 'none';
  currentPdfDoc = null;
}

// Overlay click to close modals
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
});
