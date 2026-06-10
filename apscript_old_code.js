// WageTrack Pro API v6.0 - Selective Unit-wise Sync & Data Preservation
// ======================================================================

// 1. SETTINGS — update SPREADSHEET_ID with your spreadsheet ID
const CLIENT_EMAIL = "arutselvan1807@gmail.com";
const ADMIN_EMAIL = "arutselvan.secure.ai.architect@gmail.com";
const FOLDER_ID = "15hCtDpvG5H1Wl-lmdca9fWS_nk16Rrks";
const SPREADSHEET_ID = "1d0x1FohzNhaDRgUQGDZ-XXBg03oxWgeWv1h66YgooTw";

// 2. SHEET NAME MAP — single source of truth
const SHEETS = {
    workers: 'Workers',
    unit1Entry: 'Unit1_Entries',
    unit2Entry: 'Unit2_Entries',
    unit3Entry: 'Unit3_Entries',
    unit4Entry: 'Unit4_Entries',
    unit1Att: 'Unit1_Attendance',
    unit2Att: 'Unit2_Attendance',
    unit3Att: 'Unit3_Attendance',
    unit4Att: 'Unit4_Attendance',
    maintenance: 'Maintenance',
    users: 'Users'
};

// 3. UNIT ROUTING — maps worker unit value to sheet names
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

// Helper to determine a worker's unit
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

// 4. HEALTH CHECK
function doGet(e) {
    return HtmlService.createHtmlOutput(
        "<h1>WageTrack Pro Cloud: ONLINE</h1>" +
        "<p>Version: 6.2 | Units: 1-4 Active | Maintenance: Active | Selective Sync Enabled</p>" +
        "<p>Sheets: Workers, Unit1-4 Entries, Unit1-4 Attendance, Maintenance, Users</p>" +
        "<p>v6.2: Strict column schemas — no dynamic expansion, extra app fields ignored, old columns cleaned on write</p>"
    );
}

// 5. MAIN REQUEST HANDLER
function doPost(e) {
    const result = { success: false, message: '' };
    try {
        const payload = JSON.parse(e.postData.contents);
        const action = payload.action;
        const data = payload.data;
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

        // ── ACTION: CLOUD_LOGIN ──────────────────────────────────
        if (action === 'cloud_login') {
            const allUsers = getSheetData(ss, SHEETS.users);
            const found = allUsers.find(u =>
                u.username && u.username.toString().toLowerCase() === data.username.toLowerCase() &&
                u.password && u.password.toString() === data.password.toString()
            );
            if (found) {
                result.success = true;
                result.user = found;
                result.data = fetchAllData(ss);
                result.message = 'Cloud Authentication Successful';
            } else {
                result.success = false;
                result.message = 'Invalid Cloud Credentials';
            }
        }

        // ── ACTION: SYNC_ALL ─────────────────────────────────────
        else if (action === 'sync_all') {
            const role = data.role || 'admin';
            const authorizedUnits = data.authorizedUnits || ['unit1', 'unit2', 'unit3', 'unit4', 'maintenance', 'users'];

            // 1. Users sheet: Only update if authorized (Admin only)
            if (role === 'admin' || authorizedUnits.indexOf('users') !== -1) {
                saveToSheet(ss, SHEETS.users, data.users || []);
            }

            // 2. Workers sheet:
            if (role === 'admin') {
                saveToSheet(ss, SHEETS.workers, data.workers || []);
            } else {
                // Supervisors: preserve other units' workers
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

            // 3. Entries sheets: Only overwrite if unit is in authorizedUnits
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

            // 4. Attendance sheets: Only overwrite if unit is in authorizedUnits
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

            // 5. Maintenance sheet: Only overwrite if 'maintenance' is in authorizedUnits
            if (role === 'admin' || authorizedUnits.indexOf('maintenance') !== -1) {
                saveToSheet(ss, SHEETS.maintenance, data.maintenance || []);
            }

            result.success = true;
            result.message = 'Sync Successful — Role: ' + role;
        }

        // ── ACTION: FETCH_ALL ────────────────────────────────────
        else if (action === 'fetch_all') {
            result.data = fetchAllData(ss);
            result.success = true;
            result.message = 'Fetch Successful — All Units';
        }

        // ── ACTION: SYNC_UNIT (sync one unit only) ───────────────
        else if (action === 'sync_unit') {
            const unit = data.unit;
            saveToSheet(ss, getEntrySheet(unit), data.entries || []);
            saveToSheet(ss, getAttendanceSheet(unit), data.attendance || []);
            result.success = true;
            result.message = 'Unit Sync Successful: ' + unit;
        }

        // ── ACTION: SYNC_MAINTENANCE ─────────────────────────────
        else if (action === 'sync_maintenance') {
            saveToSheet(ss, SHEETS.maintenance, data.maintenance || []);
            result.success = true;
            result.message = 'Maintenance Sync Successful';
        }

        // ── ACTION: SEND_EMAIL & DRIVE BACKUP ────────────────────
        else if (action === 'send_email') {
            const attachments = (payload.attachments || []).map(att =>
                Utilities.newBlob(
                    Utilities.base64Decode(att.data),
                    att.type,
                    att.name
                )
            );
            MailApp.sendEmail({
                to: CLIENT_EMAIL + ',' + ADMIN_EMAIL,
                subject: payload.subject,
                body: payload.body,
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

// 6. FETCH ALL DATA — used by cloud_login and fetch_all
function fetchAllData(ss) {
    return {
        workers: getSheetData(ss, SHEETS.workers),
        unit1Entries: getSheetData(ss, SHEETS.unit1Entry),
        unit2Entries: getSheetData(ss, SHEETS.unit2Entry),
        unit3Entries: getSheetData(ss, SHEETS.unit3Entry),
        unit4Entries: getSheetData(ss, SHEETS.unit4Entry),
        unit1Attendance: getSheetData(ss, SHEETS.unit1Att),
        unit2Attendance: getSheetData(ss, SHEETS.unit2Att),
        unit3Attendance: getSheetData(ss, SHEETS.unit3Att),
        unit4Attendance: getSheetData(ss, SHEETS.unit4Att),
        maintenance: getSheetData(ss, SHEETS.maintenance),
        users: getSheetData(ss, SHEETS.users)
    };
}

// 7. SAVE TO SHEET — strict predefined column schemas, no dynamic expansion
// Extra fields sent by the app (assigned, mAssigned, workerName, homeUnit, type, etc.)
// are silently ignored. Old extra columns are wiped when the sheet is rewritten.
function saveToSheet(ss, sheetName, dataArray) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);

    // Authoritative column order per sheet — matches Google Sheets headers exactly.
    // 'type' is intentionally absent from Workers (legacy field replaced by unit+category).
    // 'workDesc' is kept in Entries for compatibility but should always be '' for unit entries
    // (maintenance work goes to the Maintenance sheet, not unit entry sheets).
    var STRICT_HEADERS = {
        'Workers':          ['id','empId','phone','name','unit','category','emoji','salary','paidLeaves','dailyWage','flatAmount','otRate'],
        'Unit1_Entries':    ['id','workerId','date','category','assignedMorning','assignedAfternoon','assignedTotal','output','notCompleted','rate','pieces','packRate','wage','workDesc'],
        'Unit2_Entries':    ['id','workerId','date','category','assignedMorning','assignedAfternoon','assignedTotal','output','notCompleted','rate','pieces','packRate','wage','workDesc'],
        'Unit3_Entries':    ['id','workerId','date','category','assignedMorning','assignedAfternoon','assignedTotal','output','notCompleted','rate','pieces','packRate','wage','workDesc'],
        'Unit4_Entries':    ['id','workerId','date','category','assignedMorning','assignedAfternoon','assignedTotal','output','notCompleted','rate','pieces','packRate','wage','workDesc'],
        'Unit1_Attendance': ['id','date','workerId','status','otHours','otAmount','advance'],
        'Unit2_Attendance': ['id','date','workerId','status','otHours','otAmount','advance'],
        'Unit3_Attendance': ['id','date','workerId','status','otHours','otAmount','advance'],
        'Unit4_Attendance': ['id','date','workerId','status','otHours','otAmount','advance'],
        'Maintenance':      ['id','date','workerId','workerName','homeUnit','homeCategory','workDescription','wageAmount','otHours','otAmount','advance'],
        'Users':            ['username','password','gmail','role','access']
    };

    var headers = STRICT_HEADERS[sheetName];
    if (!headers) {
        console.log('saveToSheet: unknown sheet "' + sheetName + '" — skipped');
        return;
    }

    var numericFields = [
        'salary','otRate','flatAmount','dailyWage','paidLeaves',
        'wage','rate','pieces','packRate',
        'assignedTotal','assignedMorning','assignedAfternoon',
        'output','notCompleted','otHours','otAmount','advance','wageAmount'
    ];

    // Clear ALL existing content (header row + data rows, all columns).
    // This removes old extra columns like 'type', 'assigned', 'workerName' etc.
    var existingCols = sheet.getLastColumn();
    var existingRows = sheet.getLastRow();
    var clearCols = Math.max(existingCols, headers.length);
    if (existingRows > 0 && clearCols > 0) {
        sheet.getRange(1, 1, existingRows, clearCols).clearContent();
    }

    // Write strict header row
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    if (!dataArray || dataArray.length === 0) return;

    // Write data rows — only columns in headers; unknown fields are ignored
    var rows = dataArray.map(function(obj) {
        return headers.map(function(h) {
            var val = obj[h];
            if (numericFields.indexOf(h) !== -1 && (val === undefined || val === null || val === '')) return 0;
            if (val && typeof val === 'object') return JSON.stringify(val);
            return (val !== undefined && val !== null) ? val : '';
        });
    });

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

// 8. GET SHEET DATA — reads named sheet, returns array of objects
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
                } catch (e) { }
                // Convert empty-string numeric fields to 0 so calculations don't get NaN
                if (numericFields.indexOf(h) !== -1 && (val === '' || val === null || val === undefined)) {
                    val = 0;
                }
                obj[h] = val;
            });
            return obj;
        });
}
