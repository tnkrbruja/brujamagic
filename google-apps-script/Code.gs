/**
 * TnkrBruja immutable order ledger.
 *
 * Append-only, hash-chained log: each row stores SHA-256(prevHash + row fields), so editing or
 * deleting any historical row breaks every hash after it. Run `verifyLedger` to audit the chain.
 *
 * Setup:
 *   1. Bind this script to a Google Sheet (Extensions > Apps Script) or push it with clasp.
 *   2. Project Settings > Script Properties: add LEDGER_SECRET (same value as GAS_LEDGER_SECRET in Vercel).
 *   3. Run `setupLedger` once from the editor to create and protect the sheet.
 *   4. Deploy > New deployment > Web app: Execute as "Me", access "Anyone". Copy the /exec URL
 *      into GAS_LEDGER_URL.
 */

var SHEET_NAME = 'Ledger';
var HEADERS = ['seq', 'ledgerId', 'timestamp', 'eventType', 'orderId', 'idempotencyKey', 'payload', 'prevHash', 'hash'];
var GENESIS_HASH = '0'.repeat(64);
var ALLOWED_EVENTS = ['ORDER_SUBMITTED', 'NOTION_LINKED'];
var MAX_PAYLOAD_CHARS = 40000;

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return respond_({ ok: false, error: 'invalid_json' });
  }

  if (!isAuthorized_(body.secret)) return respond_({ ok: false, error: 'unauthorized' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return respond_({ ok: false, error: 'busy' });

  try {
    var sheet = getSheet_();
    if (body.action === 'append') return respond_(append_(sheet, body));
    if (body.action === 'find') return respond_({ ok: true, entry: findEntry_(sheet, body.idempotencyKey, body.eventType) });
    if (body.action === 'verify') return respond_(verifyChain_(sheet));
    return respond_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    console.error(err);
    return respond_({ ok: false, error: 'internal_error' });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return respond_({ ok: true, service: 'tnkrbruja-ledger' });
}

function append_(sheet, body) {
  var eventType = String(body.eventType || '');
  var orderId = String(body.orderId || '');
  var key = String(body.idempotencyKey || '');
  var payload = String(body.payload || '');

  if (ALLOWED_EVENTS.indexOf(eventType) === -1) return { ok: false, error: 'invalid_event' };
  if (!/^TB-\d{8}-[0-9A-F]{6}$/.test(orderId)) return { ok: false, error: 'invalid_order_id' };
  if (!/^[0-9a-f-]{36}$/i.test(key)) return { ok: false, error: 'invalid_idempotency_key' };
  if (payload.length === 0 || payload.length > MAX_PAYLOAD_CHARS) return { ok: false, error: 'invalid_payload' };

  var existing = findEntry_(sheet, key, eventType);
  if (existing) return { ok: true, entry: existing, duplicate: true };

  var lastRow = sheet.getLastRow();
  var prev = lastRow > 1 ? rowToEntry_(sheet.getRange(lastRow, 1, 1, HEADERS.length).getValues()[0]) : null;
  var seq = prev ? prev.seq + 1 : 1;
  var prevHash = prev ? prev.hash : GENESIS_HASH;

  var entry = {
    seq: seq,
    ledgerId: Utilities.getUuid(),
    timestamp: new Date().toISOString(),
    eventType: eventType,
    orderId: orderId,
    idempotencyKey: key,
    payload: payload,
    prevHash: prevHash,
  };
  entry.hash = hashEntry_(entry);

  // Force plain-text so payload strings can never be interpreted as formulas.
  var range = sheet.getRange(lastRow + 1, 1, 1, HEADERS.length);
  range.setNumberFormat('@');
  range.setValues([HEADERS.map(function (h) { return String(entry[h]); })]);
  SpreadsheetApp.flush();

  return { ok: true, entry: entry, duplicate: false };
}

function findEntry_(sheet, key, eventType) {
  if (!key || sheet.getLastRow() < 2) return null;
  var keyCol = HEADERS.indexOf('idempotencyKey') + 1;
  var matches = sheet.getRange(2, keyCol, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(key)).matchEntireCell(true).findAll();

  for (var i = 0; i < matches.length; i++) {
    var row = sheet.getRange(matches[i].getRow(), 1, 1, HEADERS.length).getValues()[0];
    var entry = rowToEntry_(row);
    if (entry.eventType === eventType) return entry;
  }
  return null;
}

function verifyChain_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, valid: true, rows: 0 };
  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var prevHash = GENESIS_HASH;

  for (var i = 0; i < rows.length; i++) {
    var entry = rowToEntry_(rows[i]);
    if (entry.seq !== i + 1 || entry.prevHash !== prevHash || hashEntry_(entry) !== entry.hash) {
      return { ok: true, valid: false, rows: rows.length, brokenAtSeq: entry.seq || i + 1 };
    }
    prevHash = entry.hash;
  }
  return { ok: true, valid: true, rows: rows.length, headHash: prevHash };
}

function hashEntry_(entry) {
  var material = [
    entry.seq, entry.ledgerId, entry.timestamp, entry.eventType,
    entry.orderId, entry.idempotencyKey, entry.payload, entry.prevHash,
  ].join('|');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, material, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function rowToEntry_(row) {
  var entry = {};
  HEADERS.forEach(function (h, i) { entry[h] = String(row[i]); });
  entry.seq = Number(entry.seq);
  return entry;
}

function isAuthorized_(provided) {
  var expected = PropertiesService.getScriptProperties().getProperty('LEDGER_SECRET');
  if (!expected || typeof provided !== 'string' || provided.length !== expected.length) return false;
  var diff = 0;
  for (var i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

function getSheet_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Run setupLedger() first.');
  return sheet;
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor. Creates the sheet and locks it so only the script owner can write. */
function setupLedger() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var protection = sheet.protect().setDescription('Immutable ledger - append only via web app');
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
}

/** Run from the editor to audit the hash chain. */
function verifyLedger() {
  var result = verifyChain_(getSheet_());
  console.log(JSON.stringify(result));
  return result;
}
