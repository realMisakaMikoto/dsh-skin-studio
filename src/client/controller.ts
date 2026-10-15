import type { DesktopContext } from './desktop-context.ts'
import { GUI_TOKEN_NAMES } from '../gui-tokens.ts'
import { loadAllBundledSkinPackages } from '../builtin-skins.ts'
import { decodeSkinManifest, makeSkinId, type SkinManifestV1 } from '../model.ts'
import { exportSkinPackage, importSkinPackage } from '../package-format.ts'
import { BUILTIN_SKINS, createBlankSkin } from '../presets.ts'
import { ACTIVE_SNAPSHOT_KEY, openSkinDatabase, readActiveSnapshot, SkinRepository, writeActiveSnapshot } from '../storage.ts'
import { SkinApplier } from './applier.ts'
import type { SkinStudioActions, SkinStudioStore } from './store.ts'

export type ConflictPolicy = 'keep' | 'replace' | 'cancel'

export interface SkinStudioController {
  create: () => SkinManifestV1
  duplicate: (id: string) => Promise<SkinManifestV1 | undefined>
  remove: (id: string) => Promise<void>
  preview: (skin: SkinManifestV1, assets: ReadonlyMap<string, Blob>) => Promise<void>
  cancelPreview: () => Promise<void>
  saveAndActivate: (skin: SkinManifestV1, assets: ReadonlyMap<string, Blob>) => Promise<void>
  activate: (id: string | null) => Promise<void>
  assets: (id: string) => Promise<Map<string, Blob>>
  importPackage: (file: Blob, policy: ConflictPolicy) => Promise<'imported' | 'conflict-cancelled'>
  exportPackage: (id: string) => Promise<Blob>
  tokenNames: readonly string[]
  activeLocale: () => 'zh' | 'en'
  initializationError?: () => string | null
  connectActions: (actions: SkinStudioActions) => void
}

export function createController(
  ctx: DesktopContext,
  store: SkinStudioStore,
): { controller: SkinStudioController; dispose: () => void; ready: Promise<void> } {
  const applier = new SkinApplier(ctx)
  let repository: SkinRepository | undefined
  let skins: SkinManifestV1[] = []
  const volatileAssets = new Map<string, Map<string, Blob>>()
  let active = readActiveSnapshot()
  let persistent = true
  let initialized = false
  let disposed = false
  let visualRevision = 0
  // Previews can supersede a pending paint, but never an explicit selection.
  let selectionRevision = 0
  let initializationError: string | null = null
  let actions = store.actions
  let broadcast: BroadcastChannel | undefined

  const publish = (): void => {
    if (!disposed) actions.sync({ skins, activeId: active?.id ?? null, ready: initialized, persistent })
  }
  const reload = async (): Promise<void> => {
    if (repository === undefined || disposed) return
    const loaded = await repository.list()
    if (disposed) return
    skins = loaded
    publish()
  }
  const loadAssets = async (id: string): Promise<Map<string, Blob>> => {
    const volatile = volatileAssets.get(id)
    if (volatile !== undefined) return new Map(volatile)
    return await repository?.assets(id) ?? new Map()
  }
  const applyActive = async (revision = ++visualRevision): Promise<void> => {
    const skin = active
    const assets = skin === null ? new Map<string, Blob>() : await loadAssets(skin.id)
    if (!disposed && revision === visualRevision) await applier.apply(skin, assets)
  }
  const announce = (): void => { if (!disposed) broadcast?.postMessage({ type: 'refresh' }) }
  const save = async (skin: SkinManifestV1, assets: ReadonlyMap<string, Blob>): Promise<void> => {
    if (disposed) return
    if (repository !== undefined && persistent) {
      try {
        await repository.save(skin, assets)
        await reload()
        volatileAssets.delete(skin.id)
        return
      } catch {
        persistent = false
      }
    }
    if (disposed) return
    skins = [...skins.filter(item => item.id !== skin.id), skin]
    volatileAssets.set(skin.id, new Map(assets))
    publish()
  }

  const start = async (): Promise<void> => {
    const revision = visualRevision
    try {
      const database = await openSkinDatabase()
      if (disposed) { database.close(); return }
      repository = new SkinRepository(database)
      if (revision === visualRevision) active = readActiveSnapshot()
      await reload()
      await repository.seed()
      await reload()
      if (disposed) return
      if (revision === visualRevision) {
        if (active !== null) active = await repository.get(active.id) ?? null
        await applyActive(revision)
      }
    } catch (error) {
      if (disposed) return
      initializationError = error instanceof Error ? error.message : String(error)
      persistent = false
      let bundled: Awaited<ReturnType<typeof loadAllBundledSkinPackages>> = []
      try { bundled = await loadAllBundledSkinPackages() }
      catch (bundledError) {
        initializationError += `; bundled skins: ${bundledError instanceof Error ? bundledError.message : String(bundledError)}`
      }
      if (disposed) return
      const retained = new Map(skins.map(skin => [skin.id, skin]))
      for (const skin of BUILTIN_SKINS) if (!retained.has(skin.id)) retained.set(skin.id, structuredClone(skin))
      for (const item of bundled) {
        if (!retained.has(item.manifest.id)) retained.set(item.manifest.id, item.manifest)
        if (!volatileAssets.has(item.manifest.id)) volatileAssets.set(item.manifest.id, item.assets)
      }
      if (active !== null && !retained.has(active.id)) retained.set(active.id, active)
      skins = [...retained.values()]
      if (revision === visualRevision) await applyActive(revision)
    }
    if (disposed) return
    initialized = true
    publish()
  }
  if (active !== null) void applier.apply(active)
  const ready = start()

  if (typeof BroadcastChannel !== 'undefined') {
    broadcast = new BroadcastChannel('dsh-desktop-skin-studio')
    broadcast.addEventListener('message', () => {
      if (!persistent || disposed) return
      void reload().catch(() => { persistent = false; publish() })
    })
  }
  const onStorage = (event: StorageEvent): void => {
    if (disposed || (event.key !== null && event.key !== ACTIVE_SNAPSHOT_KEY)) return
    ++selectionRevision
    active = readActiveSnapshot()
    void applyActive().then(publish).catch(() => { persistent = false; publish() })
  }
  window.addEventListener('storage', onStorage)
  const releaseTheme = ctx.on('theme/change', snapshot => { if (!disposed) applier.setMode(snapshot.active.colorScheme) })
  const releaseLocale = ctx.on('locale/change', snapshot => { if (!disposed) applier.setLocale(snapshot.active === 'zh' ? 'zh' : 'en') })

  const inspectedTokenNames = ctx.theme.exportInspectTokens()
    .filter(token => token.valueType.toLowerCase().includes('color'))
    .map(token => token.name)
    .filter(name => /^--ds(?:w)?-(?:alias|specific|static)-/.test(name))
  const tokenNames = [...new Set([...inspectedTokenNames, ...GUI_TOKEN_NAMES])].sort()
  const tokenNameSet = new Set(tokenNames)

  const controller: SkinStudioController = {
    create: () => createBlankSkin(),
    duplicate: async id => {
      const source = skins.find(skin => skin.id === id) ?? await repository?.get(id)
      if (source === undefined || disposed) return undefined
      const copy = structuredClone(source)
      copy.id = makeSkinId()
      copy.name = `${source.name.slice(0, 75)} copy`
      copy.createdAt = new Date().toISOString()
      copy.updatedAt = copy.createdAt
      await save(copy, await loadAssets(id))
      announce()
      return copy
    },
    remove: async id => {
      if (disposed) return
      const selection = active?.id === id ? ++selectionRevision : selectionRevision
      if (repository !== undefined && persistent) {
        try { await repository.delete(id); await reload() }
        catch { persistent = false; skins = skins.filter(skin => skin.id !== id) }
      } else skins = skins.filter(skin => skin.id !== id)
      if (disposed) return
      volatileAssets.delete(id)
      if (active?.id === id && selection === selectionRevision) {
        ++visualRevision
        active = null
        if (!writeActiveSnapshot(null)) persistent = false
        await applier.apply(null)
      }
      publish(); announce()
    },
    preview: async (skin, assets) => {
      if (disposed) return
      ++visualRevision
      await applier.apply(skin, assets)
    },
    cancelPreview: async () => { if (!disposed) await applyActive() },
    saveAndActivate: async (skin, assets) => {
      if (disposed) return
      const selection = ++selectionRevision
      ++visualRevision
      const decoded = decodeSkinManifest({ ...skin, updatedAt: new Date().toISOString() })
      if (decoded === undefined) throw new Error('Invalid skin')
      const mergedAssets = await loadAssets(decoded.id)
      for (const [id, blob] of assets) mergedAssets.set(id, blob)
      for (const id of mergedAssets.keys()) if (!decoded.assets.some(asset => asset.id === id)) mergedAssets.delete(id)
      await save(decoded, mergedAssets)
      if (disposed || selection !== selectionRevision) return
      active = decoded
      if (!writeActiveSnapshot(decoded)) persistent = false
      ++visualRevision
      await applier.apply(decoded, mergedAssets)
      publish(); announce()
    },
    activate: async id => {
      if (disposed) return
      const selection = ++selectionRevision
      ++visualRevision
      const skin = id === null ? null : skins.find(skin => skin.id === id) ?? await repository?.get(id) ?? null
      if (disposed || selection !== selectionRevision) return
      active = skin
      if (!writeActiveSnapshot(active)) persistent = false
      await applyActive()
      publish(); announce()
    },
    assets: loadAssets,
    importPackage: async (file, policy) => {
      const imported = await importSkinPackage(file, { allowedTokenNames: tokenNameSet })
      if (disposed) throw new Error('Skin studio is disposed')
      const existing = skins.find(skin => skin.id === imported.manifest.id) ?? await repository?.get(imported.manifest.id)
      if (existing !== undefined && policy === 'cancel') return 'conflict-cancelled'
      if (existing !== undefined && policy === 'keep') imported.manifest.id = makeSkinId()
      const replacesActive = active?.id === imported.manifest.id
      const selection = replacesActive ? ++selectionRevision : selectionRevision
      await save(imported.manifest, imported.assets)
      if (disposed) return 'imported'
      if (active?.id === imported.manifest.id && selection === selectionRevision) {
        active = imported.manifest
        if (!writeActiveSnapshot(active)) persistent = false
        await applyActive()
      }
      publish(); announce()
      return 'imported'
    },
    exportPackage: async id => {
      const skin = skins.find(item => item.id === id) ?? await repository?.get(id)
      if (skin === undefined) throw new Error('Skin not found')
      return await exportSkinPackage(skin, await loadAssets(id))
    },
    tokenNames,
    activeLocale: () => ctx.locale.getLocale().active === 'zh' ? 'zh' : 'en',
    initializationError: () => initializationError,
    connectActions: next => { actions = next; publish() },
  }

  return {
    controller,
    ready,
    dispose: () => {
      if (disposed) return
      disposed = true
      ++visualRevision
      window.removeEventListener('storage', onStorage)
      releaseTheme?.()
      releaseLocale?.()
      broadcast?.close()
      repository?.close()
      applier.dispose()
    },
  }
}
