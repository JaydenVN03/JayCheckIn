const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const HEADER_ROW = ['attendance_date', 'saved_at'].concat(
  Array.from({ length: 88 }, (_, index) => `SV${String(index + 1).padStart(3, '0')}`),
);

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents || '{}');
    const configuredToken = PropertiesService.getScriptProperties()
      .getProperty('ATTENDANCE_API_TOKEN');

    if (!configuredToken || request.token !== configuredToken) {
      return jsonResponse({ ok: false, code: 'UNAUTHORIZED', message: 'Không được phép truy cập.' });
    }

    if (
      typeof request.spreadsheetId !== 'string' ||
      !/^[A-Za-z0-9_-]{25,}$/.test(request.spreadsheetId)
    ) {
      return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Spreadsheet ID không hợp lệ.' });
    }

    if (request.action === 'today') {
      return jsonResponse({ ok: true, data: readToday(request.spreadsheetId) });
    }

    if (request.action === 'save') {
      return jsonResponse({ ok: true, data: saveAttendance(request) });
    }

    return jsonResponse({ ok: false, code: 'VALIDATION_ERROR', message: 'Thao tác không hợp lệ.' });
  } catch (error) {
    console.error(error);
    const code = error && error.code === 'ATTENDANCE_ALREADY_SAVED'
      ? 'ATTENDANCE_ALREADY_SAVED'
      : error && error.code === 'VALIDATION_ERROR'
        ? 'VALIDATION_ERROR'
        : 'SHEETS_UNAVAILABLE';
    const message = code === 'ATTENDANCE_ALREADY_SAVED'
      ? 'Ngày này đã được lưu.'
      : code === 'VALIDATION_ERROR'
        ? error.message
        : 'Không thể đọc hoặc ghi Google Sheets.';
    return jsonResponse({ ok: false, code, message });
  }
}

function readToday(spreadsheetId) {
  const today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  const sheet = getMonthlySheet(spreadsheetId, today);
  const rowNumber = findAttendanceRow(sheet, today);

  if (!rowNumber) {
    return { date: today, saved: false, attendance: [] };
  }

  const values = sheet.getRange(rowNumber, 1, 1, HEADER_ROW.length).getValues()[0];
  const attendance = HEADER_ROW.slice(2).map((studentId, index) => {
    const status = values[index + 2];
    if (status !== 'PRESENT' && status !== 'ABSENT') {
      throw new Error(`Invalid status stored for ${studentId}.`);
    }
    return { studentId: studentId, status: status };
  });

  return {
    date: today,
    saved: true,
    savedAt: String(values[1]),
    attendance: attendance,
  };
}

function saveAttendance(request) {
  const today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  if (request.date !== today) {
    throw codedError('VALIDATION_ERROR', 'Chỉ cho phép điểm danh ngày hiện tại.');
  }

  validateAttendance(request.attendance);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getMonthlySheet(request.spreadsheetId, today);
    if (findAttendanceRow(sheet, today)) {
      throw codedError('ATTENDANCE_ALREADY_SAVED', 'Ngày này đã được lưu.');
    }

    const savedAt = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
    const statusById = {};
    request.attendance.forEach(function (entry) {
      statusById[entry.studentId] = entry.status;
    });
    const row = [today, savedAt].concat(
      HEADER_ROW.slice(2).map(function (studentId) {
        return statusById[studentId];
      }),
    );
    sheet.appendRow(row);

    return { savedAt: savedAt };
  } finally {
    lock.releaseLock();
  }
}

function validateAttendance(attendance) {
  if (!Array.isArray(attendance) || attendance.length !== HEADER_ROW.length - 2) {
    throw codedError('VALIDATION_ERROR', 'Danh sách học viên không hợp lệ.');
  }

  const expectedIds = new Set(HEADER_ROW.slice(2));
  const receivedIds = new Set();
  attendance.forEach(function (entry) {
    if (
      !entry ||
      !expectedIds.has(entry.studentId) ||
      receivedIds.has(entry.studentId) ||
      (entry.status !== 'PRESENT' && entry.status !== 'ABSENT')
    ) {
      throw codedError('VALIDATION_ERROR', 'Mã học viên hoặc trạng thái không hợp lệ.');
    }
    receivedIds.add(entry.studentId);
  });
}

function getMonthlySheet(spreadsheetId, date) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const monthName = date.slice(0, 7);
  let sheet = spreadsheet.getSheetByName(monthName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(monthName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setFontWeight('bold');
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 170);
    sheet.setColumnWidths(3, HEADER_ROW.length - 2, 110);
  } else {
    const headers = sheet.getRange(1, 1, 1, HEADER_ROW.length).getDisplayValues()[0];
    if (HEADER_ROW.some(function (header, index) { return headers[index] !== header; })) {
      throw new Error(`Unexpected header row in sheet ${monthName}.`);
    }
  }

  return sheet;
}

function findAttendanceRow(sheet, date) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index][0];
    const savedDate = value instanceof Date
      ? Utilities.formatDate(value, TIME_ZONE, 'yyyy-MM-dd')
      : String(value);
    if (savedDate === date) {
      return index + 2;
    }
  }
  return 0;
}

function createNextMonthTab() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty('ATTENDANCE_SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('Set ATTENDANCE_SPREADSHEET_ID in Script Properties first.');
  }

  const nextMonth = new Date();
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const date = Utilities.formatDate(nextMonth, TIME_ZONE, 'yyyy-MM-dd');
  getMonthlySheet(spreadsheetId, date);
}

function installMonthlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'createNextMonthTab') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('createNextMonthTab')
    .timeBased()
    .onMonthDay(1)
    .atHour(0)
    .create();
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
