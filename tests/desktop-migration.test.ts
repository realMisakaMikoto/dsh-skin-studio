import { Blob as NodeBlob } from 'node:buffer'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlankSkin } from '../src/presets.ts'
import {
  ACTIVE_SNAPSHOT_KEY, getMigrationReport, openSkinDatabase, readActiveSnapshot, SkinRepository,
} from '../src/storage.ts'

const DATABASE = 'dsh-desktop-skin-studio'
const connections: IDBDatabase[] = []

function value<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(request.error) }
  })
}

function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => { resolve() }
    transaction.onabort = () => { reject(transaction.error) }
    transaction.onerror = () => { reject(transaction.error) }
  })
}

async function openLegacy(name = DATABASE): Promise<IDBDatabase> {
  const request = indexedDB.open(name, 1)
  request.onupgradeneeded = () => {
    request.result.createObjectStore('skins', { keyPath: 'id' })
    request.result.createObjectStore('assets', { keyPath: 'key' }).createIndex('skinId', 'skinId')
  }
  const database = await value(request)
  connections.push(database)
  return database
}

function legacySkin(id = 'legacy-custom'): Record<string, any> {
  const skin: Record<string, any> = structuredClone(createBlankSkin('Legacy custom'))
  skin.id = id
  skin.description = 'x'.repeat(350)
  skin.appearance.wallpaperBlurPx = 78
  skin.appearance.uiFont.family = 'x'.repeat(100)
  skin.appearance.componentMedia = [{
    id: 'legacy-rule', name: 'Legacy pane', target: { tagName: 'div', role: null, classNames: ['pane'] },
    assetId: 'legacy-image', blurPx: 72,
    light: { wallpaperOpacity: 0.8, scrimOpacity: 0.2, surfaceOpacity: 0.9 },
    dark: { wallpaperOpacity: 0.6, scrimOpacity: 0.4, surfaceOpacity: 0.7 },
  }]
  skin.assets = [{
    id: 'legacy-image', path: 'assets/legacy-image.png', kind: 'component-media',
    mimeType: 'image/png', size: 4, sha256: 'a'.repeat(64),
  }]
  skin.copyOverrides = { 'welcome.badge': { en: 'b'.repeat(80) } }
  return skin
}

async function populate(skins: unknown[], assets: unknown[] = [], databaseName = DATABASE): Promise<void> {
  const database = await openLegacy(databaseName)
  const transaction = database.transaction(['skins', 'assets'], 'readwrite')
  for (const skin of skins) transaction.objectStore('skins').put(skin)
  for (const asset of assets) transaction.objectStore('assets').put(asset)
  await committed(transaction)
  database.close()
}

function assetRow(skinId: string): Record<string, unknown> {
  return { key: `${skinId}:legacy-image`, skinId, assetId: 'legacy-image', bytes: new Uint8Array([1, 2, 3, 4]), mimeType: 'image/jpeg' }
}

function expectOriginalAsset(actual: Record<string, unknown>, original: Record<string, unknown>): void {
  expect({ ...actual, bytes: Array.from(actual.bytes as Uint8Array) })
    .toEqual({ ...original, bytes: Array.from(original.bytes as Uint8Array) })
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('Blob', NodeBlob)
  localStorage.clear()
})

afterEach(() => {
  for (const connection of connections.splice(0)) connection.close()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('desktop database migration', () => {
  it('backs up v1 data, converts modes and asset bytes, and restores the active custom skin', async () => {
    const original = legacySkin()
    const originalAsset = assetRow(original.id)
    const oldSnapshot = JSON.stringify({ id: original.id, palettes: original.palettes, appearance: original.appearance })
    localStorage.setItem(ACTIVE_SNAPSHOT_KEY, oldSnapshot)
    await populate([original], [originalAsset])

    const database = await openSkinDatabase()
    connections.push(database)
    const repository = new SkinRepository(database)
    const skin = (await repository.get(original.id))!
    expect(database.version).toBe(2)
    expect(skin.id).toBe(original.id)
    expect(skin.description).toHaveLength(300)
    expect(skin.appearance.wallpaperBlurPx).toBe(40)
    expect(skin.appearance.uiFont.family).toHaveLength(80)
    expect(skin.appearance.componentMedia[0]?.blurPx).toBe(40)
    expect(skin.appearance.componentMedia[0]?.light).toEqual({ opacity: 0.8, scrimOpacity: 0.2 })
    expect(skin.appearance.componentMedia[0]?.dark).toEqual({ opacity: 0.6, scrimOpacity: 0.4 })
    expect(skin.copyOverrides['welcome.badge']?.en).toHaveLength(40)
    const blob = (await repository.assets(original.id)).get('legacy-image')!
    expect(blob.type).toBe('image/png')
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3, 4])
    expect(readActiveSnapshot()).toEqual(skin)
    const backup = await value(database.transaction('migration-backups').objectStore('migration-backups').get('desktop-v1'))
    expect(backup.skins).toEqual([original])
    expect(backup.assets).toHaveLength(1)
    expectOriginalAsset(backup.assets[0], originalAsset)
    expect(backup.snapshot).toBe(oldSnapshot)
    expect(getMigrationReport()).toMatchObject({ fromVersion: 1, migratedIds: [original.id], skipped: [], snapshotWarning: null })

    const changed = createBlankSkin('New active skin')
    localStorage.setItem(ACTIVE_SNAPSHOT_KEY, JSON.stringify(changed))
    database.close()
    const reopened = await openSkinDatabase()
    connections.push(reopened)
    expect(readActiveSnapshot()?.id).toBe(changed.id)
    expect(await value(reopened.transaction('migration-backups').objectStore('migration-backups').count())).toBe(1)
  })

  it('preserves an unconvertible manifest and assets while migrating other skins', async () => {
    const invalid = legacySkin('builtin-bright-studio')
    invalid.palettes.light.accent = 'invalid-color'
    const valid = legacySkin('valid-custom')
    const invalidAsset = assetRow(invalid.id)
    await populate([invalid, valid], [invalidAsset, assetRow(valid.id)])
    localStorage.setItem(ACTIVE_SNAPSHOT_KEY, JSON.stringify({ id: invalid.id }))

    const database = await openSkinDatabase()
    connections.push(database)
    const repository = new SkinRepository(database)
    expect((await repository.list()).map(skin => skin.id)).toEqual([valid.id])
    expect(await value(database.transaction('skins').objectStore('skins').get(invalid.id))).toEqual(invalid)
    expectOriginalAsset(await value(database.transaction('assets').objectStore('assets').get(String(invalidAsset.key))), invalidAsset)
    expect(getMigrationReport().skipped).toEqual([{ id: invalid.id, message: expect.stringContaining('preserved') }])
    expect(getMigrationReport().snapshotWarning).toContain('cannot be restored')
    expect(localStorage.getItem(ACTIVE_SNAPSHOT_KEY)).toBe(JSON.stringify({ id: invalid.id }))
    await repository.seed()
    expect(await value(database.transaction('skins').objectStore('skins').get(invalid.id))).toEqual(invalid)
  })

  it('rolls back the version upgrade and converted records if the backup write fails', async () => {
    const original = legacySkin()
    const originalAsset = assetRow(original.id)
    const snapshot = JSON.stringify({ id: original.id })
    localStorage.setItem(ACTIVE_SNAPSHOT_KEY, snapshot)
    await populate([original], [originalAsset])
    const add = IDBObjectStore.prototype.add
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, data: unknown, key?: IDBValidKey) {
      if (this.name === 'migration-backups') throw new DOMException('Backup quota exceeded', 'QuotaExceededError')
      return add.call(this, data, key)
    })
    await expect(openSkinDatabase()).rejects.toBeDefined()
    vi.restoreAllMocks()

    const database = await value(indexedDB.open(DATABASE))
    connections.push(database)
    expect(database.version).toBe(1)
    expect(database.objectStoreNames.contains('migration-backups')).toBe(false)
    expect(await value(database.transaction('skins').objectStore('skins').get(original.id))).toEqual(original)
    expectOriginalAsset(await value(database.transaction('assets').objectStore('assets').get(String(originalAsset.key))), originalAsset)
    expect(localStorage.getItem(ACTIVE_SNAPSHOT_KEY)).toBe(snapshot)
  })

  it('reports a snapshot write failure without losing committed skins or the original snapshot', async () => {
    const original = legacySkin()
    await populate([original], [assetRow(original.id)])
    const snapshot = JSON.stringify({ id: original.id })
    localStorage.setItem(ACTIVE_SNAPSHOT_KEY, snapshot)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError') })
    const database = await openSkinDatabase()
    connections.push(database)
    expect(await new SkinRepository(database).get(original.id)).toBeDefined()
    expect(localStorage.getItem(ACTIVE_SNAPSHOT_KEY)).toBe(snapshot)
    expect(getMigrationReport().snapshotWarning).toContain('could not be updated')
    vi.restoreAllMocks()
    database.close()
    const reopened = await openSkinDatabase()
    connections.push(reopened)
    expect(readActiveSnapshot()?.id).toBe(original.id)
    expect(getMigrationReport().snapshotWarning).toBeNull()
  })

  it('preserves edited builtin skins and leaves the upstream database untouched', async () => {
    const edited = structuredClone(createBlankSkin('Edited builtin'))
    edited.id = 'builtin-bright-studio'
    edited.author = 'dsh-skin-studio'
    edited.createdAt = '2026-01-01T00:00:00.000Z'
    edited.updatedAt = '2026-09-01T00:00:00.000Z'
    await populate([edited])
    const upstream = createBlankSkin('Separate upstream library')
    await populate([upstream], [], 'dsh-skin-studio')

    const database = await openSkinDatabase()
    connections.push(database)
    const repository = new SkinRepository(database)
    await repository.seed()
    expect(await repository.get(edited.id)).toEqual(edited)
    const upstreamDatabase = await value(indexedDB.open('dsh-skin-studio'))
    connections.push(upstreamDatabase)
    expect(upstreamDatabase.version).toBe(1)
    expect(await value(upstreamDatabase.transaction('skins').objectStore('skins').getAll())).toEqual([upstream])
  })
})
