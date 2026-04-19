// ── IN-APP PDF VIEWER & CLOUD RELAY ─────────────────────────────────────────────
let _currentPdfBlob = null;
let _currentPdfFilename = 'WageTrack_Report.pdf';

async function sendCloudEmail({ subject, body, filename, base64Data, jsonContent }) {
  try {
    if (window.showToast) showToast('Sending to Cloud Relay...');

    const attachments = [];
    if (filename && base64Data) {
      // Stripping data URL prefix if present
      const cleanData = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;
      attachments.push({ name: filename, data: cleanData, type: 'application/pdf' });
    }
    if (jsonContent) {
      const jsonStr = JSON.stringify(jsonContent, null, 2);
      const jsonBase64 = btoa(unescape(encodeURIComponent(jsonStr)));
      attachments.push({ name: `WageTrack_Backup_${new Date().getTime()}.json`, data: jsonBase64, type: 'application/json' });
    }

    const payload = {
      to: SMTP_CONFIG.target,
      subject: (subject || "WageTrack Cloud Update").trim(),
      body: (body || "Please find the attached WageTrack files.").trim(),
      attachments: attachments
    };

    // Diagnostics
    console.log('Sending payload to:', SMTP_CONFIG.gasUrl);
    console.log('Target Email:', SMTP_CONFIG.target);

    await fetch(SMTP_CONFIG.gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    if (window.showToast) showToast('✓ Request Sent to Cloud');
    return true;

  } catch (e) {
    console.error('Relay Error:', e);
    if (window.showToast) showToast('Cloud Error: ' + e.message);
    return false;
  }
}

function saveAndSharePDF(doc, filename) {
  try {
    const pdfBlob = doc.output('blob');
    _currentPdfFilename = filename || 'WageTrack_Report.pdf';
    _currentPdfBlob = pdfBlob;
    openPDFViewer(pdfBlob, _currentPdfFilename);
  } catch (e) {
    console.error('PDF Error:', e);
    if (window.showToast) showToast('PDF Error: ' + e.message);
  }
}

async function openPDFViewer(pdfBlob, filename) {
  const overlay = document.getElementById('pdf-viewer-overlay');
  const container = document.getElementById('pdf-canvas-container');
  const title = document.getElementById('pdf-viewer-title');
  const loading = document.getElementById('pdf-loading');

  if (title) title.textContent = filename;
  if (container) container.innerHTML = '';
  if (loading) loading.style.display = 'flex';
  if (overlay) overlay.style.display = 'flex';

  try {
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const arrayBuffer = await pdfBlob.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: window.devicePixelRatio || 2 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';
        canvas.style.display = 'block';
        canvas.style.marginBottom = '8px';
        canvas.style.background = '#fff';
        container.appendChild(canvas);

        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      }
    } else {
      if (container) container.innerHTML = '<p style="color:#fff;padding:20px;text-align:center;">PDF.js failed to load. Please check your internet connection.</p>';
    }
  } catch (err) {
    console.error('PDF.js render error:', err);
    if (container) container.innerHTML = '<p style="color:#f85149;padding:20px;text-align:center;">Could not render PDF: ' + err.message + '</p>';
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

function closePDFViewer() {
  const overlay = document.getElementById('pdf-viewer-overlay');
  const container = document.getElementById('pdf-canvas-container');
  if (overlay) overlay.style.display = 'none';
  if (container) container.innerHTML = '';
}

async function downloadPDF() {
  if (!_currentPdfBlob) {
    if (window.showToast) showToast('Error: No report data found');
    return;
  }

  try {
    if (window.showToast) showToast('Saving report...');

    const reader = new FileReader();
    const base64Data = await new Promise((resolve, reject) => {
      reader.readAsDataURL(_currentPdfBlob);
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
    });

    const Plugins = window.Capacitor && window.Capacitor.Plugins;
    const Filesystem = Plugins && Plugins.Filesystem;
    const Share = Plugins && Plugins.Share;

    if (Filesystem && window.Capacitor.isNativePlatform()) {
      const fileName = 'WageTrack_Report.pdf';
      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: 'CACHE',
        encoding: 'base64'
      });
      const { uri } = await Filesystem.getUri({ path: fileName, directory: 'CACHE' });
      if (Share) {
        await Share.share({ files: [uri] });
      } else {
        if (window.showToast) showToast('✅ Saved to app cache');
      }
    } else {
      const blobUrl = URL.createObjectURL(_currentPdfBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = _currentPdfFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      if (window.showToast) showToast('Download triggered!');
    }
  } catch (e) {
    console.error('Export error:', e);
    if (window.showToast) showToast('Export Error: ' + e.message);
  }
}

// ── CLOUD HELPERS ───────────────────────────────────────────────────────────
async function uploadToDrive() {
  if (!currentUser) return;
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.text("WageTrack Workers List", 14, 20);
    const tableData = workers.map(w => [w.id, w.name, (w.type || 'daily').toUpperCase()]);
    doc.autoTable({
      startY: 25,
      head: [['ID', 'Name', 'Type']],
      body: tableData
    });
    const pdfDataUri = doc.output('datauristring');
    await sendCloudEmail({
      subject: `WageTrack: Workers List Backup`,
      body: `Full worker list backup.`,
      filename: `Workers_Backup_${new Date().getTime()}.pdf`,
      base64Data: pdfDataUri
    });
  } catch (err) {
    showToast('Drive Error: ' + err.message);
  }
}

async function cloudSyncReport() {
    if (!currentUser) return;
    try {
        await exportReportPDF(true);
    } catch (err) {
        showToast('Report Sync Error: ' + err.message);
    }
}

async function testCloudConnection() {
  try {
    showToast('🚀 Diagnostic Pulse Sent...');
    const success = await sendCloudEmail({
      subject: "Diagnostic Pulse: Connection Test",
      body: "If you received this email, your WageTrack Cloud Relay is working perfectly. \n\nTimestamp: " + new Date().toLocaleString(),
      jsonContent: { diagnostic: true, timestamp: new Date().toISOString() }
    });
    if (success) showToast('✓ Pulse Sent! Check Gmail in 2 mins.');
  } catch (e) {
    showToast('Diagnostics Error: ' + e.message);
  }
}

async function openCloudDiagnostics() {
  try {
    const url = SMTP_CONFIG.gasUrl;
    const Plugins = window.Capacitor && window.Capacitor.Plugins;
    const Browser = Plugins && Plugins.Browser;

    if (Browser && window.Capacitor.isNativePlatform()) {
      await Browser.open({ url: url });
    } else {
      window.open(url, '_blank');
    }
    showToast('Opening Remote Diagnostics...');
  } catch (e) {
    showToast('Error opening diagnostics');
  }
}

function openCloudRepairModal() {
  document.getElementById("modal-cloud-repair").classList.add("open");
  runInAppDiagnostics(true);
}

async function runInAppDiagnostics(silent = false) {
  const statusText = document.getElementById("cloud-status-text");
  if (statusText) statusText.textContent = "Testing...";
  
  try {
    const success = await sendCloudEmail({
      subject: "In-App Diagnostic Test",
      body: "Verifying POST connectivity.",
      jsonContent: { diagnostic: true }
    });
    
    if (success) {
      if(statusText) { statusText.textContent = "CONNECTED"; statusText.style.color = "var(--accent2)"; }
      if(!silent) showToast("✓ Cloud is REACHABLE");
    } else {
      if(statusText) { statusText.textContent = "UNREACHABLE"; statusText.style.color = "var(--danger)"; }
    }
  } catch (e) {
    if(statusText) { statusText.textContent = "OFFLINE"; statusText.style.color = "var(--danger)"; }
  }
}

function copyScriptToClipboard() {
  const scriptCode = `/**
 * WageTrack Google Apps Script Relay (v2.5)
 */
function doGet(e) {
  return HtmlService.createHtmlOutput("<html><body><h1>Relay: ONLINE</h1><p>v2.5</p></body></html>");
}
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  try {
    var data = JSON.parse(e.postData.contents);
    GmailApp.sendEmail(data.to, data.subject, data.body, { attachments: [], name: "WageTrack" });
    props.setProperty("LAST_STATUS", "Success at " + new Date());
    return ContentService.createTextOutput("SUCCESS");
  } catch (err) {
    props.setProperty("LAST_ERROR", err.toString());
    return ContentService.createTextOutput("ERROR: " + err.toString());
  }
}`;

  const el = document.createElement("textarea");
  el.value = scriptCode;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
  showToast("📋 Script copied to clipboard!");
}
