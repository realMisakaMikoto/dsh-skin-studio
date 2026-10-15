import { BUILTIN_SKINS } from './presets.ts'
import { BUNDLED_SKIN_PACKAGES, loadBundledSkinPackage } from './builtin-skins.ts'
import { decodeSkinManifest, type SkinManifestV1 } from './model.ts'
import { COPY_SLOTS } from './skin-slots.ts'

const DB_NAME = 'dsh-desktop-skin-studio'
const DB_VERSION = 2
const SKINS = 'skins'
const ASSETS = 'assets'
const BACKUPS = 'migration-backups'
export const ACTIVE_SNAPSHOT_KEY = 'dsh-desktop-skin-studio/active/v1'

interface AssetRow { key: string; skinId: string; assetId: string; blob: Blob }
interface MigrationBackup {
  id: 'desktop-v1'
  skins: unknown[]
  assets: unknown[]
  snapshot: string | null
  report: MigrationReport
}

export interface MigrationReport {
  fromVersion: number | null
  migratedIds: string[]
  skipped: Array<{ id: string; message: string }>
  snapshotWarning: string | null
}

let migrationReport: MigrationReport = emptyMigrationReport()

function emptyMigrationReport(): MigrationReport {
  return { fromVersion: null, migratedIds: [], skipped: [], snapshotWarning: null }
}

/** Available after openSkinDatabase resolves; skipped records remain backed up and unchanged. */
export function getMigrationReport(): MigrationReport { return structuredClone(migrationReport) }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function shorten(record: Record<string, unknown>, field: string, length: number): void {
  const value = record[field]
  if (typeof value === 'string') record[field] = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, length)
}

/** Adapt the previous desktop implementation without changing identifiers or media bytes. */
function migrateDesktopSkin(value: unknown): SkinManifestV1 | undefined {
  if (!isRecord(value)) return undefined
  const skin = structuredClone(value)
  shorten(skin, 'name', 80)
  shorten(skin, 'author', 80)
  shorten(skin, 'description', 300)
  const appearance = skin.appearance
  if (isRecord(appearance)) {
    if (typeof appearance.wallpaperBlurPx === 'number') appearance.wallpaperBlurPx = Math.min(40, Math.max(0, appearance.wallpaperBlurPx))
    for (const field of ['uiFont', 'codeFont']) {
      const font = appearance[field]
      if (isRecord(font)) shorten(font, 'family', 80)
    }
    if (Array.isArray(appearance.componentMedia)) {
      for (const rule of appearance.componentMedia) {
        if (!isRecord(rule)) continue
        shorten(rule, 'name', 80)
        if (typeof rule.blurPx === 'number') rule.blurPx = Math.min(40, Math.max(0, rule.blurPx))
        for (const mode of ['light', 'dark']) {
          const modes = rule[mode]
          if (!isRecord(modes)) continue
          if (modes.opacity === undefined) modes.opacity = modes.wallpaperOpacity
          delete modes.wallpaperOpacity
          delete modes.surfaceOpacity
        }
      }
    }
  }
  if (isRecord(skin.copyOverrides)) {
    for (const slot of COPY_SLOTS) {
      const localized = skin.copyOverrides[slot.id]
      if (!isRecord(localized)) continue
      for (const locale of ['zh', 'en']) {
        shorten(localized, locale, slot.maxLength)
        if (localized[locale] === '') delete localized[locale]
      }
      if (Object.keys(localized).length === 0) delete skin.copyOverrides[slot.id]
    }
  }
  if (Array.isArray(skin.textOverrides)) {
    for (const rule of skin.textOverrides) {
      if (!isRecord(rule)) continue
      shorten(rule, 'name', 80)
      shorten(rule, 'sample', 300)
      if (isRecord(rule.replacements)) {
        for (const locale of ['zh', 'en']) {
          shorten(rule.replacements, locale, 300)
          if (rule.replacements[locale] === '') delete rule.replacements[locale]
        }
      }
    }
  }
  return decodeSkinManifest(skin)
}

function migrateAssetRow(value: unknown, skin: SkinManifestV1): AssetRow {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.assetId !== 'string') throw new Error('Invalid legacy asset row')
  if (value.blob instanceof Blob) return { key: value.key, skinId: skin.id, assetId: value.assetId, blob: value.blob }
  const bytes = value.bytes
  const buffer = ArrayBuffer.isView(bytes)
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice().buffer
    : bytes instanceof ArrayBuffer ? bytes : Array.isArray(bytes) ? new Uint8Array(bytes).buffer : undefined
  if (buffer === undefined) throw new Error(`Asset ${value.assetId} has no readable bytes`)
  const mimeType = skin.assets.find(asset => asset.id === value.assetId)?.mimeType
    ?? (typeof value.mimeType === 'string' ? value.mimeType : 'application/octet-stream')
  return { key: value.key, skinId: skin.id, assetId: value.assetId, blob: new Blob([buffer as ArrayBuffer], { type: mimeType }) }
}

function snapshotStorage(): Storage | undefined {
  try { return globalThis.localStorage } catch { return undefined }
}

function rawSnapshot(): string | null {
  try { return snapshotStorage()?.getItem(ACTIVE_SNAPSHOT_KEY) ?? null } catch { return null }
}

function upgradeDesktopData(transaction: IDBTransaction, snapshot: string | null): void {
  const skinsRequest = transaction.objectStore(SKINS).getAll()
  const assetsRequest = transaction.objectStore(ASSETS).getAll()
  let ready = 0
  const run = (): void => {
    if (++ready !== 2) return
    const skins = skinsRequest.result as unknown[]
    const assets = assetsRequest.result as unknown[]
    const report: MigrationReport = { ...emptyMigrationReport(), fromVersion: 1 }
    for (const original of skins) {
      const id = isRecord(original) && typeof original.id === 'string' ? original.id : '(unknown)'
      const skin = migrateDesktopSkin(original)
      if (skin === undefined) {
        report.skipped.push({ id, message: 'The original skin was preserved because its manifest cannot be converted.' })
        continue
      }
      let convertedAssets: AssetRow[]
      try {
        convertedAssets = assets.filter(row => isRecord(row) && row.skinId === skin.id).map(row => migrateAssetRow(row, skin))
      } catch (error) {
        report.skipped.push({ id, message: `${String(error)}; the original skin and assets were preserved.` })
        continue
      }
      transaction.objectStore(SKINS).put(skin)
      for (const row of convertedAssets) transaction.objectStore(ASSETS).put(row)
      report.migratedIds.push(skin.id)
    }
    const backup: MigrationBackup = { id: 'desktop-v1', skins, assets, snapshot, report }
    transaction.objectStore(BACKUPS).add(backup)
  }
  const migrate = (): void => {
    try { run() } catch { transaction.abort() }
  }
  skinsRequest.onsuccess = migrate
  assetsRequest.onsuccess = migrate
}

async function restoreMigrationSnapshot(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction([BACKUPS, SKINS], 'readonly')
  const backup = await requestValue(transaction.objectStore(BACKUPS).get('desktop-v1')) as MigrationBackup | undefined
  migrationReport = backup?.report ?? emptyMigrationReport()
  if (backup?.snapshot === null || backup === undefined || rawSnapshot() !== backup.snapshot) return
  let id: unknown
  try { id = (JSON.parse(backup.snapshot) as { id?: unknown }).id } catch {
    migrationReport.snapshotWarning = 'The original active snapshot is invalid and was preserved in the migration backup.'
    return
  }
  const skin = typeof id === 'string'
    ? decodeSkinManifest(await requestValue(transaction.objectStore(SKINS).get(id))) : undefined
  if (skin === undefined) {
    migrationReport.snapshotWarning = 'The previous active skin cannot be restored; its original snapshot was preserved.'
  } else {
    const storage = snapshotStorage()
    if (storage === undefined || !writeActiveSnapshot(skin, storage)) migrationReport.snapshotWarning = 'Skins were migrated, but the active snapshot could not be updated. It remains backed up.'
  }
}

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
  migrationReport = emptyMigrationReport()
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const database = request.result
      if (!database.objectStoreNames.contains(SKINS)) database.createObjectStore(SKINS, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(ASSETS)) {
        const store = database.createObjectStore(ASSETS, { keyPath: 'key' })
        store.createIndex('skinId', 'skinId')
      }
      if (!database.objectStoreNames.contains(BACKUPS)) database.createObjectStore(BACKUPS, { keyPath: 'id' })
      const transaction = request.transaction!
      const assets = transaction.objectStore(ASSETS)
      if (!assets.indexNames.contains('skinId')) assets.createIndex('skinId', 'skinId')
      if (event.oldVersion === 1) upgradeDesktopData(transaction, rawSnapshot())
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close() }
      resolve(request.result)
    }
    request.onerror = () => { reject(request.error ?? new Error('Unable to open IndexedDB')) }
  })
  try { await restoreMigrationSnapshot(database) } catch (error) {
    database.close()
    throw error
  }
  return database
}

export class SkinRepository {
  constructor(private readonly database: IDBDatabase) {}

  async seed(): Promise<void> {
    for (const skin of BUILTIN_SKINS) {
      const original = await this.readRaw(skin.id)
      const current = decodeSkinManifest(original)
      const untouchedBuiltin = current?.author === 'dsh-skin-studio' && current.createdAt === current.updatedAt
      if (original === undefined || untouchedBuiltin) await this.save(structuredClone(skin))
    }
    for (const entry of BUNDLED_SKIN_PACKAGES) {
      const original = await this.readRaw(entry.id)
      const current = decodeSkinManifest(original)
      const untouchedBuiltin = current?.author === 'dsh-skin-studio' && current.createdAt === current.updatedAt
      const needsRefresh = untouchedBuiltin && current.updatedAt !== entry.updatedAt
      if (original === undefined || needsRefresh) {
        const imported = await loadBundledSkinPackage(entry)
        await this.save(imported.manifest, imported.assets)
      }
    }
  }

  async list(): Promise<SkinManifestV1[]> {
    const transaction = this.database.transaction(SKINS, 'readonly')
    const values = await requestValue(transaction.objectStore(SKINS).getAll()) as unknown[]
    return values.map(decodeSkinManifest).filter((value): value is SkinManifestV1 => value !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async get(id: string): Promise<SkinManifestV1 | undefined> {
    return decodeSkinManifest(await this.readRaw(id))
  }

  private async readRaw(id: string): Promise<unknown> {
    const transaction = this.database.transaction(SKINS, 'readonly')
    return await requestValue(transaction.objectStore(SKINS).get(id))
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
