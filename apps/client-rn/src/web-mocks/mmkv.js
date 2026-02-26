// IndexedDB-based implementation for react-native-mmkv
// Provides synchronous-like API with persistent storage
// Uses localStorage as synchronous fallback for immediate reads

const DB_NAME = 'aacesstalk_mmkv';
const DB_VERSION = 1;

// localStorage key prefix for this MMKV instance
const LS_PREFIX = 'mmkv_';

class MMKV {
  constructor(id = 'default') {
    this.id = id;
    this.cache = {};
    this.initialized = false;
    this.loadPromise = null;

    // Try to load from localStorage synchronously first (fast path)
    this.loadFromLocalStorage();

    // Then load from IndexedDB in background for persistence
    this.ensureInitialized();
  }

  // Synchronous load from localStorage
  loadFromLocalStorage() {
    try {
      const prefix = LS_PREFIX + this.id + '_';
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const realKey = key.substring(prefix.length);
          this.cache[realKey] = localStorage.getItem(key);
        }
      }
    } catch (e) {
      // localStorage not available
    }
  }

  // Sync localStorage set
  setLocalStorage(key, value) {
    try {
      localStorage.setItem(LS_PREFIX + this.id + '_' + key, value);
    } catch (e) {
      // localStorage not available
    }
  }

  // Sync localStorage get
  getLocalStorage(key) {
    try {
      return localStorage.getItem(LS_PREFIX + this.id + '_' + key);
    } catch (e) {
      return null;
    }
  }

  // Sync localStorage delete
  deleteLocalStorage(key) {
    try {
      localStorage.removeItem(LS_PREFIX + this.id + '_' + key);
    } catch (e) {
      // localStorage not available
    }
  }

  async ensureInitialized() {
    if (this.initialized) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          // IndexedDB not available, use localStorage only
          this.initialized = true;
          resolve();
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.initialized = true;
          // Load from IndexedDB after initialization
          this.loadFromIndexedDB().then(resolve);
        };

        request.onupgradeneeded = (event) => {
          const database = event.target.result;
          const storeName = `mmkv_${this.id}`;
          if (!database.objectStoreNames.contains(storeName)) {
            database.createObjectStore(storeName, { keyPath: 'key' });
          }
        };
      } catch (e) {
        this.initialized = true;
        resolve();
      }
    });

    return this.loadPromise;
  }

  async loadFromIndexedDB() {
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([this.getStoreName()], 'readonly');
        const store = transaction.objectStore(this.getStoreName());
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result;
          results.forEach(item => {
            // Only update if not already in cache from localStorage
            if (!(item.key in this.cache)) {
              this.cache[item.key] = item.value;
            }
          });
          resolve();
        };

        request.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  getStoreName() {
    return `mmkv_${this.id}`;
  }

  // Synchronous methods - use in-memory cache
  getString(key) {
    return this.cache[key];
  }

  setString(key, value) {
    this.cache[key] = value;
    // Persist to both localStorage (sync) and IndexedDB (async)
    this.setLocalStorage(key, value);
    this.persist(key, value, 'string');
  }

  // Alias for setItem compatibility with redux-persist
  set(key, value) {
    if (typeof value === 'string') {
      this.setString(key, value);
    } else if (typeof value === 'number') {
      this.setNumber(key, value);
    } else if (typeof value === 'boolean') {
      this.setBoolean(key, value);
    } else {
      this.setString(key, JSON.stringify(value));
    }
  }

  getNumber(key) {
    const value = this.cache[key];
    if (value === undefined) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  setNumber(key, value) {
    const str = String(value);
    this.cache[key] = str;
    this.setLocalStorage(key, str);
    this.persist(key, str, 'number');
  }

  getBoolean(key) {
    const value = this.cache[key];
    if (value === undefined) return undefined;
    return value === 'true';
  }

  setBoolean(key, value) {
    const str = String(value);
    this.cache[key] = str;
    this.setLocalStorage(key, str);
    this.persist(key, str, 'boolean');
  }

  getObject(key) {
    const value = this.cache[key];
    if (value === undefined) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  setObject(key, value) {
    try {
      const str = JSON.stringify(value);
      this.cache[key] = str;
      this.setLocalStorage(key, str);
      this.persist(key, str, 'object');
    } catch (e) {
      console.error('MMKV setObject error:', e);
    }
  }

  // Persist to IndexedDB
  persist(key, value, type) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.getStoreName()], 'readwrite');
      const store = transaction.objectStore(this.getStoreName());
      store.put({ key: key, value: value, type: type, timestamp: Date.now() });
    } catch (e) {
      // Ignore - we have localStorage fallback
    }
  }

  delete(key) {
    delete this.cache[key];
    this.deleteLocalStorage(key);
    this.removeFromDB(key);
  }

  removeFromDB(key) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.getStoreName()], 'readwrite');
      const store = transaction.objectStore(this.getStoreName());
      store.delete(key);
    } catch (e) {
      // Ignore
    }
  }

  contains(key) {
    return key in this.cache;
  }

  getAllKeys() {
    return Object.keys(this.cache);
  }

  clearAll() {
    this.cache = {};
    // Clear localStorage
    try {
      const prefix = LS_PREFIX + this.id + '_';
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      // Ignore
    }
    this.clearDB();
  }

  clearDB() {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.getStoreName()], 'readwrite');
      const store = transaction.objectStore(this.getStoreName());
      store.clear();
    } catch (e) {
      // Ignore
    }
  }

  getAll() {
    return { ...this.cache };
  }

  addOnValueChangedListener(callback) {
    console.warn('MMKV: addOnValueChangedListener is not supported');
  }

  // Sync aliases
  getStringSync(key) { return this.getString(key); }
  getNumberSync(key) { return this.getNumber(key); }
  getBooleanSync(key) { return this.getBoolean(key); }
  getObjectSync(key) { return this.getObject(key); }

  flush() {
    // No-op, already persisted
  }
}

// Export as a class constructor for "new MMKV()" usage
const MMKVConstructor = function(config) {
  const id = config?.id || 'default';
  return new MMKV(id);
};

export { MMKVConstructor as MMKV };
export default MMKVConstructor;
