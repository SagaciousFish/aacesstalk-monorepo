// IndexedDB-based file system implementation for react-native-file-access
// Provides persistent storage that works like native file system

const DB_NAME = 'aacesstalk_files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

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

// File operations
const FileSystem = {
  // Read file as text or base64
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
          resolve(result.data); // Already stored as base64
        } else {
          // Convert base64 to text
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

      // Convert text to base64 if needed
      if (encoding !== 'base64' && typeof content === 'string') {
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

  // Create directory (no-op in IndexedDB, directories are virtual)
  mkdir: async function(path) {
    await initDB();
    return Promise.resolve(true);
  },

  // List files in directory
  ls: async function(path) {
    await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result
          .filter(f => f.path.startsWith(path))
          .map(f => f.path.replace(path, '').split('/').filter(Boolean)[0]);
        resolve([...new Set(files)]); // Unique
      };

      request.onerror = () => reject(request.error);
    });
  },

  // Copy file
  cp: async function(src, dest) {
    const content = await FileSystem.readFile(src, 'base64');
    await FileSystem.writeFile(dest, content, 'base64');
    return dest;
  },

  // Move file
  mv: async function(src, dest) {
    await FileSystem.cp(src, dest);
    await FileSystem.unlink(src);
    return dest;
  },

  // Get file info
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
          size: Math.ceil(result.data.length * 0.75), // Approximate base64 to bytes
          mtime: new Date(result.timestamp),
          ctime: new Date(result.timestamp),
          isFile: () => true,
          isDirectory: () => false,
        });
      };

      request.onerror = () => reject(request.error);
    });
  },

  // Fetch URL and save to file
  fetch: async function(url, options = {}) {
    await initDB();
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers,
      });

      const blob = await response.blob();

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });

      const base64 = await base64Promise;
      const path = options.path || url.split('/').pop() || 'file';

      // Save to IndexedDB
      if (options.path) {
        await FileSystem.writeFile(path, base64, 'base64');
      }

      return {
        path: path,
        data: blob,
        headers: Object.fromEntries(response.headers.entries()),
        statusCode: response.status,
      };
    } catch (error) {
      throw error;
    }
  },
};

// Directory paths (virtual)
const Dirs = {
  DocumentDir: () => '/documents',
  CacheDir: () => '/cache',
  ExternalDir: () => '/external',
  ExternalCacheDir: () => '/external/cache',
  ExternalFilesDir: () => '/external/files',
  FilesDir: () => '/files',
  LibraryDir: () => '/library',
  MainBundleDir: () => '/bundle',
  MoviePath: () => '/movies',
  MusicPath: () => '/music',
  PicturePath: () => '/pictures',
  PodcastPath: () => '/podcasts',
  RingtonePath: () => '/ringtones',
};

// ManagedFetchResult class
class ManagedFetchResult {
  constructor(data) {
    this.path = data.path;
    this.data = data.data;
    this.headers = data.headers;
    this.statusCode = data.statusCode;
  }
}

export { Dirs, FileSystem, ManagedFetchResult };
export default { Dirs, FileSystem };
