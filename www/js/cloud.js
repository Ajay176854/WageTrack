// ── CENTRAL CLOUD SYNC ENGINE v3.2 ─────────────────────────────────────────────

async function cloudSync(action = 'sync_all') {
  if (!currentUser && action !== 'fetch_all') return;

  const statusDot = document.getElementById('cloud-status-dot');
  if (statusDot) {
    statusDot.style.background = '#f1c40f'; // Yellow: Processing
  }

  let syncData = {};
  if (action === 'sync_all') {
    if (currentUser.role === 'admin') {
      syncData = {
        role: 'admin',
        authorizedUnits: ['unit1', 'unit2', 'unit3', 'unit4', 'maintenance', 'users'],
        workers,
        unit1Entries, unit2Entries, unit3Entries, unit4Entries,
        unit1Attendance, unit2Attendance, unit3Attendance, unit4Attendance,
        maintenance, users
      };
    } else {
      // Supervisor: Only send data they are authorized to modify
      const authorizedUnits = getAccessibleProductions() || [];
      const hasMaint = hasMaintenancePermission();
      if (hasMaint) {
        authorizedUnits.push('maintenance');
      }

      // Filter workers list to only include those belonging to authorized units
      const supervisorWorkers = workers.filter(w => {
        const workerUnit = w.unit || getProdKey(w.category || w.type || 'daily');
        return authorizedUnits.includes(workerUnit);
      });

      syncData = {
        role: 'supervisor',
        authorizedUnits: authorizedUnits,
        workers: supervisorWorkers
      };

      // Only package entry and attendance data for authorized units
      if (authorizedUnits.includes('unit1')) {
        syncData.unit1Entries = unit1Entries;
        syncData.unit1Attendance = unit1Attendance;
      }
      if (authorizedUnits.includes('unit2')) {
        syncData.unit2Entries = unit2Entries;
        syncData.unit2Attendance = unit2Attendance;
      }
      if (authorizedUnits.includes('unit3')) {
        syncData.unit3Entries = unit3Entries;
        syncData.unit3Attendance = unit3Attendance;
      }
      if (authorizedUnits.includes('unit4')) {
        syncData.unit4Entries = unit4Entries;
        syncData.unit4Attendance = unit4Attendance;
      }
      if (hasMaint) {
        syncData.maintenance = maintenance;
      }
      // Supervisors never upload/modify user accounts
    }
  }

  const payload = {
    action: action,
    data: syncData
  };

  try {
    const response = await fetch(CLOUD_CONFIG.gasUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const result = await response.json();
    if (result.success) {
      if (action === 'fetch_all') {
        if (result.data) {
          const d = result.data;
          
          // Symmetric Safeguards: Only overwrite if fields are explicitly returned from cloud
          if (d.workers !== undefined && d.workers !== null) {
            window.workers = d.workers || [];
          }

          if (d.unit1Entries !== undefined && d.unit1Entries !== null) window.unit1Entries = cleanEntries(deduplicateEntries(d.unit1Entries || []));
          if (d.unit2Entries !== undefined && d.unit2Entries !== null) window.unit2Entries = cleanEntries(deduplicateEntries(d.unit2Entries || []));
          if (d.unit3Entries !== undefined && d.unit3Entries !== null) window.unit3Entries = cleanEntries(deduplicateEntries(d.unit3Entries || []));
          if (d.unit4Entries !== undefined && d.unit4Entries !== null) window.unit4Entries = cleanEntries(deduplicateEntries(d.unit4Entries || []));

          if (d.unit1Attendance !== undefined && d.unit1Attendance !== null) window.unit1Attendance = deduplicateAttendance(d.unit1Attendance || []);
          if (d.unit2Attendance !== undefined && d.unit2Attendance !== null) window.unit2Attendance = deduplicateAttendance(d.unit2Attendance || []);
          if (d.unit3Attendance !== undefined && d.unit3Attendance !== null) window.unit3Attendance = deduplicateAttendance(d.unit3Attendance || []);
          if (d.unit4Attendance !== undefined && d.unit4Attendance !== null) window.unit4Attendance = deduplicateAttendance(d.unit4Attendance || []);

          if (d.maintenance !== undefined && d.maintenance !== null) window.maintenance = cleanEntries(deduplicateById(d.maintenance || []));

          // Always ensure at least the default admin exists to prevent lockout.
          // Note: Only overwrite the users array if it was returned and is non-empty,
          // OR if the current user is an admin.
          if (d.users !== undefined && d.users !== null && (d.users.length > 0 || (currentUser && currentUser.role === 'admin'))) {
            window.users = d.users.map(u => {
              if (typeof u.access === 'string') {
                try { u.access = JSON.parse(u.access); } catch(e) { u.access = {}; }
              }
              if (!u.access) u.access = {};
              return u;
            });
            if (window.users.length === 0) {
              window.users = [{ username: 'admin', password: 'admin123', gmail: 'admin@gmail.com', role: 'admin', access: {} }];
            }
          }

          // Call save with preventSync=true to avoid redundant sync request loops
          if (typeof window.save === 'function') window.save(true);
        }
      }

      localStorage.setItem('wt_last_sync', new Date().toLocaleString());
      localStorage.setItem('wt_pending_sync', 'false');
      if (statusDot) statusDot.style.background = '#2ecc71'; // Green: Success
      if (window.renderAll) renderAll();
      return true;
    }
    throw new Error(result.message || 'Unknown Cloud Error');
  } catch (err) {
    console.error('Cloud Sync Error:', err);
    localStorage.setItem('wt_pending_sync', 'true');
    if (statusDot) statusDot.style.background = '#e74c3c'; // Red: Error
    return false;
  }
}

async function sendCloudEmail({ subject, body, filename, base64Data, jsonContent }) {
  try {
    const attachments = [];
    if (filename && base64Data) {
      const data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      attachments.push({ name: filename, data: data, type: 'application/pdf' });
    }
    if (jsonContent) {
      const jsonStr = JSON.stringify(jsonContent, null, 2);
      const jsonBase64 = btoa(unescape(encodeURIComponent(jsonStr)));
      attachments.push({ name: `WageTrack_Backup_${new Date().getTime()}.json`, data: jsonBase64, type: 'application/json' });
    }

    const payload = {
      action: 'send_email',
      subject: subject || "WageTrack Cloud Update",
      body: body || "Please find the attached WageTrack report.",
      attachments: attachments
    };

    const response = await fetch(CLOUD_CONFIG.gasUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Server Error: ${response.status}. ${errorText.substring(0, 50)}`);
    }

    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'GAS failed to process request');

    return true;
  } catch (err) {
    console.error('Email Error Detail:', err);
    // Alert the user to the specific error
    if (err.message.includes('Unexpected token')) {
       showToast('❌ GAS returned HTML instead of JSON. Check script authorization.');
    } else {
       showToast('❌ ' + err.message);
    }
    return false;
  }
}


async function uploadToDrive() {
  if (!currentUser) return;
  const btn = event ? event.currentTarget : null;
  const originalContent = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="rotating" style="display:inline-block;">↻</span> Sending...`;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Header
    doc.setFillColor(13, 17, 23);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(240, 192, 64);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("WageTrack Workers List", 14, 18);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Exported by: ${currentUser.username} (${currentUser.role})`, 14, 28);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, 34);

    const tableData = workers.map(w => [w.empId || w.id, w.name, (w.type || 'daily').toUpperCase()]);

    doc.autoTable({
      startY: 45,
      head: [['EMP ID', 'Worker Name', 'Type']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [240, 192, 64], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    const pdfDataUri = doc.output('datauristring');

    const success = await sendCloudEmail({
      subject: `WageTrack: Workers List (${new Date().toLocaleDateString()})`,
      body: `Please find the attached Workers List backup.\n\nSent by: ${currentUser.username}`,
      filename: `Workers_List_${new Date().getTime()}.pdf`,
      base64Data: pdfDataUri
    });

    if (success) {
      showToast('✓ Backup sent to your Google Drive/Email');
    }
    // Generic error toast removed to allow specific errors from sendCloudEmail to show

  } catch (err) {
    console.error('Drive Upload Error:', err);
    showToast('Error: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }
}

async function syncAll() {
  const success = await cloudSync('sync_all');
  if (!success) showToast('Working Offline - Changes queued');
}

async function fetchAll() {
  const success = await cloudSync('fetch_all');
  if (success) showToast('✓ Cloud Data Updated');
  else showToast('⚠ Offline Mode');
}

setInterval(() => {
  if (localStorage.getItem('wt_pending_sync') === 'true' && navigator.onLine && currentUser) {
    cloudSync('sync_all');
  }
}, 30000);

// ── CLOUD REPAIR DIAGNOSTICS & COPY UTILITIES ──────────────────────────────

function copyScriptToClipboard() {
  const scriptText = `// WageTrack Pro API v6.0 - Selective Unit-wise Sync & Data Preservation
// ======================================================================

const CLIENT_EMAIL = "arutselvan1807@gmail.com";
const ADMIN_EMAIL = "arutselvan.secure.ai.architect@gmail.com";
const FOLDER_ID = "15hCtDpvG5H1Wl-lmdca9fWS_nk16Rrks";
const SPREADSHEET_ID = "1d0x1FohzNhaDRgUQGDZ-XXBg03oxWgeWv1h66YgooTw";

const SHEETS = {
  workers:      'Workers',
  unit1Entry:   'Unit1_Entries',
  unit2Entry:   'Unit2_Entries',
  unit3Entry:   'Unit3_Entries',
  unit4Entry:   'Unit4_Entries',
  unit1Att:     'Unit1_Attendance',
  unit2Att:     'Unit2_Attendance',
  unit3Att:     'Unit3_Attendance',
  unit4Att:     'Unit4_Attendance',
  maintenance:  'Maintenance',
  users:        'Users'
};

function getEntrySheet(unit) {
  const map = {
    unit1: SHEETS.unit1Entry,
    unit2: SHEETS.unit2Entry,
    unit3: SHEETS.unit3Entry,
    unit4: SHEETS.unit4Entry
  };
  return map[unit] || SHEETS.unit1Entry;
}

function getAttendanceSheet(unit) {
  const map = {
    unit1: SHEETS.unit1Att,
    unit2: SHEETS.unit2Att,
    unit3: SHEETS.unit3Att,
    unit4: SHEETS.unit4Att
  };
  return map[unit] || SHEETS.unit1Att;
}

function getWorkerUnit(w) {
  var unit = w.unit || '';
  if (['unit1', 'unit2', 'unit3', 'unit4', 'maintenance'].indexOf(unit) !== -1) {
    return unit;
  }
  var cat = w.category || w.type || '';
  var map = {
    'piece_work': 'unit1',
    'daily': 'unit1',
    'monthly_salary': 'unit2',
    'permanent': 'unit2',
    'bundle_packing': 'unit3',
    'cover_packing': 'unit3',
    'packing': 'unit3',
    'daily_wages': 'unit4',
    'other': 'unit4',
    'maintenance': 'maintenance'
  };
  return map[cat] || 'unit1';
}

function doGet(e) {
  return HtmlService.createHtmlOutput(
    "<h1>WageTrack Pro Cloud: ONLINE</h1>" +
    "<p>Version: 6.0 | Units: 1-4 Active | Maintenance: Active | Selective Sync Enabled</p>" +
    "<p>Sheets: Workers, Unit1-4 Entries, Unit1-4 Attendance, Maintenance, Users</p>"
  );
}

function doPost(e) {
  const result = { success: false, message: '' };
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;
    const data    = payload.data;
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === 'cloud_login') {
      const allUsers = getSheetData(ss, SHEETS.users);
      const found = allUsers.find(u =>
        u.username && u.username.toString().toLowerCase() === data.username.toLowerCase() &&
        u.password && u.password.toString() === data.password.toString()
      );
      if (found) {
        result.success = true;
        result.user    = found;
        result.data    = fetchAllData(ss);
        result.message = 'Cloud Authentication Successful';
      } else {
        result.success = false;
        result.message = 'Invalid Cloud Credentials';
      }
    }

    else if (action === 'sync_all') {
      const role = data.role || 'admin';
      const authorizedUnits = data.authorizedUnits || ['unit1', 'unit2', 'unit3', 'unit4', 'maintenance', 'users'];

      if (role === 'admin' || authorizedUnits.indexOf('users') !== -1) {
        saveToSheet(ss, SHEETS.users, data.users || []);
      }

      if (role === 'admin') {
        saveToSheet(ss, SHEETS.workers, data.workers || []);
      } else {
        const incomingWorkers = data.workers || [];
        if (incomingWorkers.length > 0) {
          const existingWorkers = getSheetData(ss, SHEETS.workers);
          const filteredExisting = existingWorkers.filter(w => {
            const wUnit = getWorkerUnit(w);
            return authorizedUnits.indexOf(wUnit) === -1;
          });
          const mergedWorkers = filteredExisting.concat(incomingWorkers);
          saveToSheet(ss, SHEETS.workers, mergedWorkers);
        }
      }

      if (role === 'admin' || authorizedUnits.indexOf('unit1') !== -1) {
        saveToSheet(ss, SHEETS.unit1Entry, data.unit1Entries || []);
      }
      if (role === 'admin' || authorizedUnits.indexOf('unit2') !== -1) {
        saveToSheet(ss, SHEETS.unit2Entry, data.unit2Entries || []);
      }
      if (role === 'admin' || authorizedUnits.indexOf('unit3') !== -1) {
        saveToSheet(ss, SHEETS.unit3Entry, data.unit3Entries || []);
      }
      if (role === 'admin' || authorizedUnits.indexOf('unit4') !== -1) {
        saveToSheet(ss, SHEETS.unit4Entry, data.unit4Entries || []);
      }

      if (role === 'admin' || authorizedUnits.indexOf('unit1') !== -1) {
        saveToSheet(ss, SHEETS.unit1Att, data.unit1Attendance || []);
      }
      if (role === 'admin' || authorizedUnits.indexOf('unit2') !== -1) {
        saveToSheet(ss, SHEETS.unit2Att, data.unit2Attendance || []);
      }
      if (role === 'admin' || authorizedUnits.indexOf('unit3') !== -1) {
        saveToSheet(ss, SHEETS.unit3Att, data.unit3Attendance || []);
      }
      if (role === 'admin' || authorizedUnits.indexOf('unit4') !== -1) {
        saveToSheet(ss, SHEETS.unit4Att, data.unit4Attendance || []);
      }

      if (role === 'admin' || authorizedUnits.indexOf('maintenance') !== -1) {
        saveToSheet(ss, SHEETS.maintenance, data.maintenance || []);
      }

      result.success = true;
      result.message = 'Sync Successful — Role: ' + role;
    }

    else if (action === 'fetch_all') {
      result.data    = fetchAllData(ss);
      result.success = true;
      result.message = 'Fetch Successful — All Units';
    }

    else if (action === 'sync_unit') {
      const unit = data.unit;
      saveToSheet(ss, getEntrySheet(unit),      data.entries     || []);
      saveToSheet(ss, getAttendanceSheet(unit),  data.attendance  || []);
      result.success = true;
      result.message = 'Unit Sync Successful: ' + unit;
    }

    else if (action === 'sync_maintenance') {
      saveToSheet(ss, SHEETS.maintenance, data.maintenance || []);
      result.success = true;
      result.message = 'Maintenance Sync Successful';
    }

    else if (action === 'send_email') {
      const attachments = (payload.attachments || []).map(att =>
        Utilities.newBlob(
          Utilities.base64Decode(att.data),
          att.type,
          att.name
        )
      );
      MailApp.sendEmail({
        to:          CLIENT_EMAIL + ',' + ADMIN_EMAIL,
        subject:     payload.subject,
        body:        payload.body,
        attachments: attachments
      });
      try {
        const folder = DriveApp.getFolderById(FOLDER_ID);
        attachments.forEach(blob => folder.createFile(blob));
      } catch (driveErr) {
        console.error('Drive error: ' + driveErr);
      }
      result.success = true;
      result.message = 'Backup Successful';
    }

    else {
      result.message = 'Unknown action: ' + action;
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    result.message = err.toString();
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function fetchAllData(ss) {
  return {
    workers:          getSheetData(ss, SHEETS.workers),
    unit1Entries:     getSheetData(ss, SHEETS.unit1Entry),
    unit2Entries:     getSheetData(ss, SHEETS.unit2Entry),
    unit3Entries:     getSheetData(ss, SHEETS.unit3Entry),
    unit4Entries:     getSheetData(ss, SHEETS.unit4Entry),
    unit1Attendance:  getSheetData(ss, SHEETS.unit1Att),
    unit2Attendance:  getSheetData(ss, SHEETS.unit2Att),
    unit3Attendance:  getSheetData(ss, SHEETS.unit3Att),
    unit4Attendance:  getSheetData(ss, SHEETS.unit4Att),
    maintenance:      getSheetData(ss, SHEETS.maintenance),
    users:            getSheetData(ss, SHEETS.users)
  };
}

function saveToSheet(ss, sheetName, dataArray) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  const numericFields = [
    'salary', 'otRate', 'flatAmount', 'dailyWage', 'paidLeaves',
    'wage', 'rate', 'pieces', 'packRate',
    'assigned', 'assignedTotal', 'assignedMorning', 'assignedAfternoon',
    'output', 'notCompleted', 'otHours', 'otAmount', 'advance',
    'wageAmount'
  ];

  let headers = [];
  if (sheet.getLastColumn() > 0) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].filter(function(h) { return h !== ''; });
  }

  // Expand headers with any new fields present in the incoming data
  if (dataArray && dataArray.length > 0) {
    dataArray.forEach(function(obj) {
      Object.keys(obj).forEach(function(k) {
        if (headers.indexOf(k) === -1) headers.push(k);
      });
    });
    if (sheet.getLastColumn() === 0) {
      sheet.appendRow(headers);
    } else {
      // Rewrite the header row to include any newly added columns
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  if (sheet.getLastRow() > 1 && headers.length > 0) {
    var lastDataRow = sheet.getLastRow() - 1;
    var lastDataCol = Math.max(headers.length, sheet.getLastColumn());
    sheet.getRange(2, 1, lastDataRow, lastDataCol).clearContent();
  }

  if (!dataArray || dataArray.length === 0) return;

  const rows = dataArray.map(function(obj) {
    return headers.map(function(h) {
      let val = obj[h];
      if (numericFields.indexOf(h) !== -1 && (val === undefined || val === null || val === '')) return 0;
      if (val && typeof val === 'object') return JSON.stringify(val);
      return (val !== undefined && val !== null) ? val : '';
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const numericFields = [
    'salary', 'otRate', 'flatAmount', 'dailyWage', 'paidLeaves',
    'wage', 'rate', 'pieces', 'packRate',
    'assigned', 'assignedTotal', 'assignedMorning', 'assignedAfternoon',
    'output', 'notCompleted', 'otHours', 'otAmount', 'advance',
    'wageAmount'
  ];
  return data.slice(1)
    .filter(function(row) { return row.some(function(cell) { return cell !== '' && cell !== null; }); })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) {
        let val = row[i];
        if (val instanceof Date || (val && typeof val.getMonth === 'function')) {
          val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
        }
        try {
          if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            val = JSON.parse(val);
          }
        } catch (e) {}
        // Convert empty-string numeric fields to 0 so calculations don't get NaN
        if (numericFields.indexOf(h) !== -1 && (val === '' || val === null || val === undefined)) {
          val = 0;
        }
        obj[h] = val;
      });
      return obj;
    });
}`;

  navigator.clipboard.writeText(scriptText).then(() => {
    showToast('✓ Script v6.0 copied to clipboard!');
  }).catch(err => {
    console.error('Clipboard copy failed:', err);
    showToast('Error copying to clipboard');
  });
}

async function runInAppDiagnostics() {
  const textEl = document.getElementById('cloud-status-text');
  if (textEl) {
    textEl.style.color = 'var(--warning)';
    textEl.textContent = 'Testing connection...';
  }
  
  try {
    const start = Date.now();
    const response = await fetch(CLOUD_CONFIG.gasUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      body: JSON.stringify({ action: 'fetch_all', data: {} }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const res = await response.json();
    const duration = Date.now() - start;
    
    if (res.success) {
      if (textEl) {
        textEl.style.color = 'var(--accent2)';
        textEl.textContent = `ONLINE (${duration}ms)`;
      }
      showToast('✓ Cloud connection healthy!');
    } else {
      throw new Error(res.message || 'Unknown response');
    }
  } catch (err) {
    console.error('Diagnostic error:', err);
    if (textEl) {
      textEl.style.color = '#e74c3c';
      textEl.textContent = 'OFFLINE/ERROR';
    }
    showToast('❌ Diagnostics failed: ' + err.message);
  }
}

// Hook openModal to automatically trigger diagnostics when repair modal is opened
if (window.openModal) {
  const originalOpenModal = window.openModal;
  window.openModal = function(modalId) {
    originalOpenModal(modalId);
    if (modalId === 'modal-cloud-repair') {
      runInAppDiagnostics();
    }
  };
}
