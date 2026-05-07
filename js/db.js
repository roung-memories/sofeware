/* ============================================
   IndexedDB wrapper - materials + recordings
   ============================================ */

const DB = (() => {
  const DB_NAME = 'chinese_reader_db';
  const DB_VERSION = 1;
  let _db = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('materials')) {
          const s = db.createObjectStore('materials', { keyPath: 'id', autoIncrement: true });
          s.createIndex('generated_date', 'generated_date', { unique: true });
        }
        if (!db.objectStoreNames.contains('recordings')) {
          const s = db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
          s.createIndex('material_id', 'material_id', { unique: false });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function storeTx(name, mode) {
    return openDB().then((db) => {
      const tx = db.transaction(name, mode);
      return { tx, store: tx.objectStore(name) };
    });
  }

  return {
    // ── Materials ──

    materials: {
      getByDate(dateStr) {
        return storeTx('materials', 'readonly').then(({ tx, store }) => {
          const idx = store.index('generated_date');
          return new Promise((resolve, reject) => {
            const req = idx.get(dateStr);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          });
        });
      },

      getById(id) {
        return storeTx('materials', 'readonly').then(({ tx, store }) => {
          return new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          });
        });
      },

      getAll(page, perPage) {
        return openDB().then((db) => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction('materials', 'readonly');
            const store = tx.objectStore('materials');
            const idx = store.index('generated_date');

            const countReq = store.count();
            countReq.onsuccess = () => {
              const total = countReq.result;
              const items = [];
              let skipped = 0;
              const skip = (page - 1) * perPage;

              const cursorReq = idx.openCursor(null, 'prev');
              cursorReq.onsuccess = () => {
                const cursor = cursorReq.result;
                if (cursor) {
                  if (skipped < skip) {
                    skipped++;
                    cursor.continue();
                  } else if (items.length < perPage) {
                    items.push(cursor.value);
                    cursor.continue();
                  }
                }
                // Resolve when cursor is done or we have enough
                if (!cursorReq.result || items.length >= perPage) {
                  resolve({ items, total });
                }
              };
              cursorReq.onerror = () => reject(cursorReq.error);
            };
            countReq.onerror = () => reject(countReq.error);
          });
        });
      },

      create(data) {
        return storeTx('materials', 'readwrite').then(({ tx, store }) => {
          return new Promise((resolve, reject) => {
            const req = store.add(data);
            req.onsuccess = () => {
              data.id = req.result;
              resolve(data);
            };
            req.onerror = () => reject(req.error);
          });
        });
      },

      delete(id) {
        return storeTx('materials', 'readwrite').then(({ tx, store }) => {
          return new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        });
      },
    },

    // ── Recordings ──

    recordings: {
      getByMaterialId(materialId) {
        return storeTx('recordings', 'readonly').then(({ tx, store }) => {
          const idx = store.index('material_id');
          return new Promise((resolve, reject) => {
            const items = [];
            const req = idx.openCursor(IDBKeyRange.only(materialId), 'prev');
            req.onsuccess = () => {
              const cursor = req.result;
              if (cursor) {
                items.push(cursor.value);
                cursor.continue();
              } else {
                resolve(items);
              }
            };
            req.onerror = () => reject(req.error);
          });
        });
      },

      getById(id) {
        return storeTx('recordings', 'readonly').then(({ tx, store }) => {
          return new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
          });
        });
      },

      create(data) {
        return storeTx('recordings', 'readwrite').then(({ tx, store }) => {
          return new Promise((resolve, reject) => {
            const req = store.add(data);
            req.onsuccess = () => {
              data.id = req.result;
              resolve(data);
            };
            req.onerror = () => reject(req.error);
          });
        });
      },

      delete(id) {
        return storeTx('recordings', 'readwrite').then(({ tx, store }) => {
          return new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        });
      },

      deleteByMaterialId(materialId) {
        return storeTx('recordings', 'readwrite').then(({ tx, store }) => {
          const idx = store.index('material_id');
          return new Promise((resolve, reject) => {
            const req = idx.openCursor(IDBKeyRange.only(materialId));
            req.onsuccess = () => {
              const cursor = req.result;
              if (cursor) {
                cursor.delete();
                cursor.continue();
              } else {
                resolve();
              }
            };
            req.onerror = () => reject(req.error);
          });
        });
      },
    },
  };
})();
