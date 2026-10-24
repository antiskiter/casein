import type { BuildingObject, RoomPlan, StoredPhoto } from '../types'

const DB_NAME = 'case-in-digital-trail'
const DB_VERSION = 2
const OBJECTS = 'objects'
const PLANS = 'plans'
const PHOTOS = 'photos'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OBJECTS)) db.createObjectStore(OBJECTS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PLANS)) db.createObjectStore(PLANS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Object-level storage for the current nested project model. Existing v1 stores are preserved. */
export const objectStorage = {
  getAll: () => requestResult<BuildingObject[]>(OBJECTS, 'readonly', (store) => store.getAll()),
  get: (id: string) => requestResult<BuildingObject | undefined>(OBJECTS, 'readonly', (store) => store.get(id)),
  put: (object: BuildingObject) => requestResult<IDBValidKey>(OBJECTS, 'readwrite', (store) => store.put(object)),
  delete: (id: string) => requestResult<undefined>(OBJECTS, 'readwrite', (store) => store.delete(id)),
}

async function requestResult<T>(store: string, mode: IDBTransactionMode, run: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const request = run(tx.objectStore(store))
    let result!: T
    request.onsuccess = () => { result = request.result }
    request.onerror = () => { db.close(); reject(request.error) }
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('IndexedDB transaction aborted')) }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('IndexedDB transaction failed')) }
  })
}

export const planStorage = {
  getAll: () => requestResult<RoomPlan[]>(PLANS, 'readonly', (store) => store.getAll()),
  put: (plan: RoomPlan) => requestResult<IDBValidKey>(PLANS, 'readwrite', (store) => store.put(plan)),
  delete: (id: string) => requestResult<undefined>(PLANS, 'readwrite', (store) => store.delete(id)),
}

export const photoStorage = {
  get: (id: string) => requestResult<StoredPhoto | undefined>(PHOTOS, 'readonly', (store) => store.get(id)),
  getAll: () => requestResult<StoredPhoto[]>(PHOTOS, 'readonly', (store) => store.getAll()),
  put: (photo: StoredPhoto) => requestResult<IDBValidKey>(PHOTOS, 'readwrite', (store) => store.put(photo)),
  delete: (id: string) => requestResult<undefined>(PHOTOS, 'readwrite', (store) => store.delete(id)),
}
