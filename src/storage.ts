import { BUILTIN_SKINS } from './presets.ts'
import { decodeSkinManifest, type SkinManifestV1 } from './model.ts'

const DB_NAME = 'dsh-skin-studio'
const DB_VERSION = 1
const SKINS = 'skins'
const ASSETS = 'assets'
export const ACTIVE_SNAPSHOT_KEY = 'dsh-skin-studio/active/v1'

interface AssetRow { key: string; skinId: string; assetId: string; blob: Blob }

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(request.error ?? new Error('IndexedDB request failed')) }
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { resolve() }
    transaction.onerror = () => { reject(transaction.error ?? new Error('IndexedDB transaction failed')) }
    transaction.onabort = () => { reject(transaction.error ?? new Error('IndexedDB transaction aborted')) }
  })
}

export async function openSkinDatabase(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(SKINS)) database.createObjectStore(SKINS, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(ASSETS)) {
        const store = database.createObjectStore(ASSETS, { keyPath: 'key' })
        store.createIndex('skinId', 'skinId')
      }
    }
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(request.error ?? new Error('Unable to open IndexedDB')) }
  })
}

export class SkinRepository {
  constructor(private readonly database: IDBDatabase) {}

  async seed(): Promise<void> {
    for (const skin of BUILTIN_SKINS) {
      const current = await this.get(skin.id)
      const untouchedBuiltin = current?.author === 'dsh-skin-studio' && current.createdAt === current.updatedAt
      if (current === undefined || untouchedBuiltin) await this.save(structuredClone(skin))
    }
  }

  async list(): Promise<SkinManifestV1[]> {
    const transaction = this.database.transaction(SKINS, 'readonly')
    const values = await requestValue(transaction.objectStore(SKINS).getAll()) as unknown[]
    return values.map(decodeSkinManifest).filter((value): value is SkinManifestV1 => value !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async get(id: string): Promise<SkinManifestV1 | undefined> {
    const transaction = this.database.transaction(SKINS, 'readonly')
    return decodeSkinManifest(await requestValue(transaction.objectStore(SKINS).get(id)))
  }

  async save(skin: SkinManifestV1, assets: ReadonlyMap<string, Blob> = new Map()): Promise<void> {
    const decoded = decodeSkinManifest(skin)
    if (decoded === undefined) throw new Error('Invalid skin manifest')
    const transaction = this.database.transaction([SKINS, ASSETS], 'readwrite')
    transaction.objectStore(SKINS).put(decoded)
    const assetStore = transaction.objectStore(ASSETS)
    const existingKeys = await requestValue(assetStore.index('skinId').getAllKeys(skin.id))
    const retainedKeys = new Set(decoded.assets.map(asset => `${skin.id}:${asset.id}`))
    for (const key of existingKeys) {
      if (!retainedKeys.has(String(key))) assetStore.delete(key)
    }
    for (const [assetId, blob] of assets) {
      const row: AssetRow = { key: `${skin.id}:${assetId}`, skinId: skin.id, assetId, blob }
      assetStore.put(row)
    }
    await transactionDone(transaction)
  }

  async delete(id: string): Promise<void> {
    const transaction = this.database.transaction([SKINS, ASSETS], 'readwrite')
    transaction.objectStore(SKINS).delete(id)
    const index = transaction.objectStore(ASSETS).index('skinId')
    const keys = await requestValue(index.getAllKeys(id))
    for (const key of keys) transaction.objectStore(ASSETS).delete(key)
    await transactionDone(transaction)
  }

  async assets(id: string): Promise<Map<string, Blob>> {
    const transaction = this.database.transaction(ASSETS, 'readonly')
    const rows = await requestValue(transaction.objectStore(ASSETS).index('skinId').getAll(id)) as AssetRow[]
    return new Map(rows.map(row => [row.assetId, row.blob]))
  }

  close(): void { this.database.close() }
}

export function readActiveSnapshot(storage: Storage = localStorage): SkinManifestV1 | null {
  try {
    const raw = storage.getItem(ACTIVE_SNAPSHOT_KEY)
    return raw === null ? null : decodeSkinManifest(JSON.parse(raw)) ?? null
  } catch {
    return null
  }
}

export function writeActiveSnapshot(skin: SkinManifestV1 | null, storage: Storage = localStorage): boolean {
  try {
    if (skin === null) storage.removeItem(ACTIVE_SNAPSHOT_KEY)
    else storage.setItem(ACTIVE_SNAPSHOT_KEY, JSON.stringify(skin))
    return true
  } catch {
    return false
  }
}
