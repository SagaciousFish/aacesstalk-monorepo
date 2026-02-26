// IndexedDB-based implementation for react-native-blob-util
// Provides persistent file storage that works like native

const DB_NAME = 'aacesstalk_blob';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';

let db = null;

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'path' });
      }
    };
  });
}

const fs = {
  dirs: {
    DocumentDir: function() { return '/documents'; },
    CacheDir: function() { return '/cache'; },
    ExternalDir: function() { return '/external'; },
    ExternalStorageDir: function() { return '/external'; },
    PictureDir: function() { return '/pictures'; },
    MusicDir: function() { return '/music'; },
    MovieDir: function() { return '/movies'; },
    DownloadDir: function() { return '/downloads'; },
    TempDir: function() { return '/temp'; },
  },

  // Read file
  readFile: async function(path, encoding) {
    await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(path);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          reject(new Error(`File not found: ${path}`));
          return;
        }

        if (encoding === 'base64') {
          resolve(result.data);
        } else {
          const byteCharacters = atob(result.data);
          resolve(byteCharacters);
        }
      };

      request.onerror = () => reject(request.error);
    });
  },

  // Write file
  writeFile: async function(path, content, encoding) {
    await initDB();
    return new Promise((resolve, reject) => {
      let data = content;

      if (encoding === 'base64') {
        data = content;
      } else if (typeof content === 'string') {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(content);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        data = btoa(binary);
      }

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ path: path, data: data, timestamp: Date.now() });

      request.onsuccess = () => resolve(path);
      request.onerror = () => reject(request.error);
    });
  },

  // Delete file
  unlink: async function(path) {
    await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(path);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // Check if file exists
  exists: async function(path) {
    await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(path);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  },

  mkdir: async function() { return true; },
  ls: async function() { return []; },

  stat: async function(path) {
    await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(path);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          reject(new Error(`File not found: ${path}`));
          return;
        }

        resolve({
          size: Math.ceil(result.data.length * 0.75),
          type: 'file',
          lastModified: result.timestamp,
        });
      };

      request.onerror = () => reject(request.error);
    });
  },
};

// Fetch and optionally cache
async function fetchBlob(method, url, headers, body) {
  await initDB();

  const response = await fetch(url, {
    method: method,
    headers: headers,
    body: body,
  });

  const blob = await response.blob();

  // Convert blob to base64 for storage
  const reader = new FileReader();
  const base64Promise = new Promise((resolve) => {
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });

  const base64 = await base64Promise;

  return {
    info: function() {
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        redirected: response.redirected,
        url: response.url,
      };
    },
    text: function() { return blob.text(); },
    json: function() { return blob.json(); },
    base64: function() { return Promise.resolve(base64); },
    blob: function() { return Promise.resolve(blob); },
    flush: function() { return Promise.resolve(); },
  };
}

const ReactNativeBlobUtil = {
  fs: fs,
  fetch: fetchBlob,
  config: function() { return this; },
  stream: function() {
    return {
      on: function() {},
      cancel: function() {},
    };
  },
  enableProgress: function() {
    return { cancel: function() {} };
  },
  session: function() {
    return { add: function() {}, terminate: function() {} };
  },
};

export default ReactNativeBlobUtil;
