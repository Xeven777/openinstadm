"use client";

/**
 * IndexedDB-backed Persister for the TanStack Query cache.
 *
 * We persist the query cache in IndexedDB (not localStorage/sessionStorage) so
 * larger payloads (post libraries, inbox threads, overviews) can be restored on
 * a same-browser revisit without blocking the main thread. The persisted blob
 * is a single record under a stable key, so writes are one transaction and the
 * table never grows unbounded.
 */

import type { Persister, PersistedClient } from "@tanstack/query-persist-client-core";

const DB_NAME = "openinstadm-query";
const STORE = "queries";
const KEY = "react-query-cache";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getItem(): Promise<PersistedClient | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result as PersistedClient | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function setItem(value: PersistedClient): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeItem(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Creates a TanStack Query `Persister` backed by IndexedDB. Persisting and
 * restoring are best-effort: any IndexedDB failure (private mode, quota, etc.)
 * is swallowed so it can never break the page — the query cache simply falls
 * back to in-memory only.
 */
export function createIndexedDbPersister(): Persister {
  return {
    persistClient: async (client) => {
      try {
        await setItem(client);
      } catch {
        // best-effort — the cache just won't survive a reload
      }
    },
    restoreClient: async () => {
      try {
        return await getItem();
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await removeItem();
      } catch {
        // best-effort
      }
    },
  };
}
