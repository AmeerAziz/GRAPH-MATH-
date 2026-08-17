/**
 * db.js — IndexedDB transaction log (mirrors Python's SQLite ledger)
 * Table: ledger { id, equation_id, expression, expr_type, result_text, date_logged }
 */

const DB = (() => {
  const DB_NAME    = 'MathEngineVault';
  const DB_VERSION = 1;
  const STORE      = 'ledger';
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('equation_id', 'equation_id', { unique: false });
          store.createIndex('date_logged', 'date_logged', { unique: false });
        }
      };
      req.onsuccess  = e => { _db = e.target.result; resolve(_db); };
      req.onerror    = e => reject(e.target.error);
    });
  }

  async function log(equation_id, expression, expr_type, result_text = '') {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite');
      const rec = {
        equation_id,
        expression,
        expr_type,
        result_text,
        date_logged: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };
      const req = tx.objectStore(STORE).add(rec);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function fetchHistory(limit = 40) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE, 'readonly');
      const store   = tx.objectStore(STORE);
      const results = [];
      const req     = store.openCursor(null, 'prev');
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = e => reject(e.target.error);
    });
  }

  async function exportCSV() {
    const rows = await fetchHistory(1000);
    const header = 'id,equation_id,expression,expr_type,result_text,date_logged';
    const lines  = rows.map(r =>
      [r.id, r.equation_id, `"${r.expression}"`, r.expr_type, `"${r.result_text}"`, r.date_logged].join(',')
    );
    return [header, ...lines].join('\n');
  }

  return { log, fetchHistory, exportCSV };
})();
