const DB_NAME = 'anggaran-db';
const DB_VERSION = 2;
let dbPromise;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('projects')) {
        const projects = db.createObjectStore('projects', { keyPath: 'id' });
        projects.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('projectId', 'projectId');
      }
      if (!db.objectStoreNames.contains('realizations')) {
        const realizations = db.createObjectStore('realizations', { keyPath: 'id' });
        realizations.createIndex('itemId', 'itemId');
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
        transactions.createIndex('projectId', 'projectId');
        transactions.createIndex('date', 'date');
        transactions.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  const db = await openDB();
  return req(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
}

export async function getByIndex(storeName, indexName, value) {
  const db = await openDB();
  return req(db.transaction(storeName, 'readonly').objectStore(storeName).index(indexName).getAll(value));
}

export async function put(storeName, value) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function remove(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getSetting(key, fallback = null) {
  const db = await openDB();
  const result = await req(db.transaction('settings', 'readonly').objectStore('settings').get(key));
  return result?.value ?? fallback;
}

export async function setSetting(key, value) {
  return put('settings', { key, value });
}

export async function deleteProjectCascade(projectId) {
  const db = await openDB();
  const items = await getByIndex('items', 'projectId', projectId);
  const itemIds = new Set(items.map(item => item.id));
  const realizations = await getAll('realizations');
  const transactions = await getByIndex('transactions', 'projectId', projectId);

  const tx = db.transaction(['projects', 'items', 'realizations', 'transactions'], 'readwrite');
  tx.objectStore('projects').delete(projectId);
  for (const item of items) tx.objectStore('items').delete(item.id);
  for (const realization of realizations) {
    if (itemIds.has(realization.itemId)) tx.objectStore('realizations').delete(realization.id);
  }
  for (const transaction of transactions) tx.objectStore('transactions').delete(transaction.id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function exportDataSnapshot() {
  const [projects, transactions, items, realizations] = await Promise.all([
    getAll('projects'),
    getAll('transactions'),
    getAll('items'),
    getAll('realizations')
  ]);
  return {
    projects,
    transactions,
    legacy: { items, realizations }
  };
}

export async function restoreDataSnapshot(snapshot) {
  const db = await openDB();
  const stores = ['projects', 'transactions', 'items', 'realizations'];
  const tx = db.transaction(stores, 'readwrite');

  for (const storeName of stores) tx.objectStore(storeName).clear();

  for (const project of snapshot.projects || []) tx.objectStore('projects').put(project);
  for (const transaction of snapshot.transactions || []) tx.objectStore('transactions').put(transaction);
  for (const item of snapshot.legacy?.items || snapshot.items || []) tx.objectStore('items').put(item);
  for (const realization of snapshot.legacy?.realizations || snapshot.realizations || []) tx.objectStore('realizations').put(realization);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
