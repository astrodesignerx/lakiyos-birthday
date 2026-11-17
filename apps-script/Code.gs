/**
 * Ivy's Birthday — Paid Guest List (Google Apps Script)
 *
 * Setup:
 * 1. Open a new Google Sheet (e.g. "Ivy's Birthday — Guest List").
 * 2. Go to Extensions -> Apps Script, delete any starter code, and paste this file.
 * 3. (Optional) Set SHARED_SECRET below (or in Project Settings -> Script Properties as SHEET_SECRET)
 *    and set the same value as GSHEET_WEBHOOK_SECRET in Vercel.
 * 4. Click Deploy -> New deployment -> Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL and add it in Vercel as GSHEET_WEBHOOK_URL.
 */

const SHEET_NAME = 'Guests';
const SHARED_SECRET = ''; // Optional: must match GSHEET_WEBHOOK_SECRET in Vercel if set

const HEADERS = [
  'Timestamp',
  'Name',
  'Phone',
  'Method',
  'Status',
  'Reference',
  'M-Pesa Receipt / Code',
  'Amount (KES)',
];

function getExpectedSecret_() {
  if (SHARED_SECRET) return SHARED_SECRET;
  try {
    return PropertiesService.getScriptProperties().getProperty('SHEET_SECRET') || '';
  } catch (err) {
    return '';
  }
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    const first = ss.getSheets()[0];
    if (first && first.getLastRow() === 0) {
      first.setName(SHEET_NAME);
      sheet = first;
    } else {
      sheet = ss.insertSheet(SHEET_NAME);
    }
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#111827');
    headerRange.setFontColor('#ffffff');
    sheet.setColumnWidths(1, HEADERS.length, 160);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(5, 160);
    sheet.setColumnWidth(6, 210);
  }
  return sheet;
}

function styleStatusCell_(cell, status) {
  if (status === 'Paid') {
    cell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold');
  } else if (status === 'Pending Verification') {
    cell.setBackground('#fef3c7').setFontColor('#92400e').setFontWeight('bold');
  } else {
    cell.setBackground(null).setFontColor('#111827').setFontWeight('normal');
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    const expectedSecret = getExpectedSecret_();
    if (expectedSecret && String(data.secret || '') !== expectedSecret) {
      return jsonOut_({ ok: false, error: 'Unauthorized' });
    }

    const sheet = getOrCreateSheet_();
    const reference = String(data.reference || '').trim();
    const name = String(data.name || 'Guest').trim();
    const phone = String(data.phone || '').trim();
    const method = String(data.method || '').trim();
    const status = String(data.status || 'Paid').trim();
    const code = String(data.code || '').trim();
    const amount = Number(data.amount) || 1000;
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

    // Deduplicate by Reference (column 6) so verify polling + webhook never add duplicate rows
    if (reference && sheet.getLastRow() > 1) {
      const refRange = sheet.getRange(2, 6, sheet.getLastRow() - 1, 1);
      const refs = refRange.getValues();
      for (let i = 0; i < refs.length; i++) {
        if (String(refs[i][0] || '').trim() === reference) {
          const rowNum = i + 2;
          const existing = sheet.getRange(rowNum, 1, 1, HEADERS.length).getValues()[0];
          const updatedRow = [
            existing[0] || timestamp,
            name || existing[1],
            phone || existing[2],
            method || existing[3],
            status === 'Paid' ? 'Paid' : (existing[4] || status),
            reference,
            code || existing[6],
            amount || existing[7],
          ];
          sheet.getRange(rowNum, 1, 1, HEADERS.length).setValues([updatedRow]);
          styleStatusCell_(sheet.getRange(rowNum, 5), updatedRow[4]);
          return jsonOut_({ ok: true, action: 'updated', row: rowNum, reference: reference });
        }
      }
    }

    sheet.appendRow([timestamp, name, phone, method, status, reference, code, amount]);
    const newRow = sheet.getLastRow();
    styleStatusCell_(sheet.getRange(newRow, 5), status);
    sheet.getRange(newRow, 1).setNumberFormat('yyyy-mm-dd hh:mm');

    return jsonOut_({ ok: true, action: 'appended', row: newRow, reference: reference });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const sheet = getOrCreateSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return jsonOut_({ ok: true, count: 0, guests: [] });
  }

  const expectedSecret = getExpectedSecret_();
  const providedSecret = (e && e.parameter && e.parameter.secret) ? String(e.parameter.secret) : '';
  const isAdmin = Boolean(expectedSecret && providedSecret === expectedSecret);

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const guests = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const status = String(row[4] || '').trim();
    if (isAdmin) {
      guests.push({
        timestamp: row[0],
        name: row[1],
        phone: row[2],
        method: row[3],
        status: status,
        reference: row[5],
        code: row[6],
        amount: row[7],
      });
    } else if (status === 'Paid') {
      // Public-safe view: never expose phone numbers, references, or M-Pesa codes
      guests.push({
        name: String(row[1] || '').trim(),
        paidAt: row[0],
      });
    }
  }

  return jsonOut_({ ok: true, count: guests.length, guests: guests });
}
