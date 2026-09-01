import type { Context } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { GUI_TOKEN_NAMES } from '../gui-tokens.ts'
import { loadAllBundledSkinPackages } from '../builtin-skins.ts'
import { decodeSkinManifest, makeSkinId, type SkinManifestV1 } from '../model.ts'
import { exportSkinPackage, importSkinPackage } from '../package-format.ts'
import { BUILTIN_SKINS, createBlankSkin } from '../presets.ts'
import { ACTIVE_SNAPSHOT_KEY, openSkinDatabase, readActiveSnapshot, SkinRepository, writeActiveSnapshot } from '../storage.ts'
import { SkinApplier } from './applier.ts'
import type { createSkinStudioStore } from './store.ts'

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
  connectActions: (actions: BoundActions<ReturnType<typeof createSkinStudioStore>>) => void
}

export function createController(
  ctx: Context,
  store: ReturnType<typeof createSkinStudioStore>,
): { controller: SkinStudioController; dispose: () => void } {
  const applier = new SkinApplier(ctx)
  let repository: SkinRepository | undefined
  let skins: SkinManifestV1[] = []
  const volatileAssets = new Map<string, Map<string, Blob>>()
  let active = readActiveSnapshot()
  let persistent = true
  let actions: BoundActions<ReturnType<typeof createSkinStudioStore>> | undefined
  let broadcast: BroadcastChannel | undefined

  const publish = (): void => {
    actions?.sync({ skins, activeId: active?.id ?? null, ready: repository !== undefined, persistent })
  }
  const reload = async (): Promise<void> => {
    if (repository === undefined) return
    skins = await repository.list()
    publish()
  }
  const loadAssets = async (id: string): Promise<Map<string, Blob>> => {
    const volatile = volatileAssets.get(id)
    if (volatile !== undefined) return new Map(volatile)
    return await repository?.assets(id) ?? new Map()
  }
  const applyActive = async (): Promise<void> => {
    const assets = active === null ? new Map<string, Blob>() : await loadAssets(active.id)
    await applier.apply(active, assets)
  }
  const announce = (): void => { broadcast?.postMessage({ type: 'refresh' }) }

  const start = async (): Promise<void> => {
    try {
      repository = new SkinRepository(await openSkinDatabase())
      await repository.seed()
      await reload()
      if (active !== null) active = await repository.get(active.id) ?? null
      await applyActive()
    } catch {
      persistent = false
      const bundled = await loadAllBundledSkinPackages().catch(() => [])
      skins = [...BUILTIN_SKINS.map(skin => structuredClone(skin)), ...bundled.map(item => item.manifest)]
      for (const item of bundled) volatileAssets.set(item.manifest.id, item.assets)
      if (active !== null && !skins.some(skin => skin.id === active!.id)) skins.push(active)
    }
    publish()
  }
  if (active !== null) void applier.apply(active)
  void start()

  if (typeof BroadcastChannel !== 'undefined') {
    broadcast = new BroadcastChannel('dsh-skin-studio')
    broadcast.addEventListener('message', () => { if (persistent) void reload() })
  }
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== null && event.key !== ACTIVE_SNAPSHOT_KEY) return
    active = readActiveSnapshot()
    void applyActive().then(publish)
  }
  window.addEventListener('storage', onStorage)

  ctx.on('theme/change', snapshot => { applier.setMode(snapshot.active.colorScheme) })
  ctx.on('locale/change', snapshot => { applier.setLocale(snapshot.active === 'zh' ? 'zh' : 'en') })

  const inspectedTokenNames = ctx.theme.exportInspectTokens()
    .filter(token => token.valueType.toLowerCase().includes('color'))
    .map(token => token.name)
    .filter(name => /^--ds(?:w)?-(?:alias|specific|static)-/.test(name))
  const tokenNames = [...new Set([...inspectedTokenNames, ...GUI_TOKEN_NAMES])]
    .sort()
  const tokenNameSet = new Set(tokenNames)

  const controller: SkinStudioController = {
    create: () => createBlankSkin(),
    duplicate: async (id) => {
      const source = skins.find(skin => skin.id === id) ?? await repository?.get(id)
      if (source === undefined) return undefined
      const copy = structuredClone(source)
      copy.id = makeSkinId()
      copy.name = `${source.name} copy`
      copy.createdAt = new Date().toISOString()
      copy.updatedAt = copy.createdAt
      const sourceAssets = await loadAssets(id)
      if (repository !== undefined && persistent) {
        try {
          await repository.save(copy, sourceAssets)
          await reload()
        } catch {
          persistent = false
          skins = [...skins, copy]
          volatileAssets.set(copy.id, sourceAssets)
          publish()
        }
      } else {
        skins = [...skins, copy]
        volatileAssets.set(copy.id, sourceAssets)
        publish()
      }
      announce()
      return copy
    },
    remove: async (id) => {
      if (repository !== undefined && persistent) {
        try { await repository.delete(id); await reload() } catch { persistent = false; skins = skins.filter(skin => skin.id !== id) }
      } else skins = skins.filter(skin => skin.id !== id)
      volatileAssets.delete(id)
      if (active?.id === id) {
        active = null
        writeActiveSnapshot(null)
        await applier.apply(null)
      }
      publish(); announce()
    },
    preview: async (skin, assets) => { await applier.apply(skin, assets) },
    cancelPreview: async () => { await applyActive() },
    saveAndActivate: async (skin, assets) => {
      const decoded = decodeSkinManifest({ ...skin, updatedAt: new Date().toISOString() })
      if (decoded === undefined) throw new Error('Invalid skin')
      if (repository !== undefined && persistent) {
        try {
          await repository.save(decoded, assets)
          await reload()
        } catch {
          persistent = false
          skins = [...skins.filter(item => item.id !== decoded.id), decoded]
          volatileAssets.set(decoded.id, new Map(assets))
        }
      } else {
        skins = [...skins.filter(item => item.id !== decoded.id), decoded]
        volatileAssets.set(decoded.id, new Map(assets))
      }
      active = decoded
      if (!writeActiveSnapshot(decoded)) persistent = false
      await applier.apply(decoded, assets)
      publish(); announce()
    },
    activate: async (id) => {
      active = id === null ? null : await repository?.get(id) ?? skins.find(skin => skin.id === id) ?? null
      if (!writeActiveSnapshot(active)) persistent = false
      await applyActive(); publish(); announce()
    },
    assets: loadAssets,
    importPackage: async (file, policy) => {
      const imported = await importSkinPackage(file, { allowedTokenNames: tokenNameSet })
      const existing = skins.find(skin => skin.id === imported.manifest.id) ?? await repository?.get(imported.manifest.id)
      if (existing !== undefined && policy === 'cancel') return 'conflict-cancelled'
      if (existing !== undefined && policy === 'keep') {
        imported.manifest.id = makeSkinId()
      }
      if (repository !== undefined && persistent) {
        try {
          if (existing !== undefined && policy === 'replace') await repository.delete(existing.id)
          await repository.save(imported.manifest, imported.assets)
          await reload()
        } catch {
          persistent = false
          skins = [...skins.filter(skin => skin.id !== imported.manifest.id), imported.manifest]
          volatileAssets.set(imported.manifest.id, imported.assets)
          publish()
        }
      } else {
        skins = [...skins.filter(skin => skin.id !== imported.manifest.id), imported.manifest]
        volatileAssets.set(imported.manifest.id, imported.assets)
        publish()
      }
      announce()
      return 'imported'
    },
    exportPackage: async (id) => {
      const skin = skins.find(item => item.id === id) ?? await repository?.get(id)
      if (skin === undefined) throw new Error('Skin not found')
      return await exportSkinPackage(skin, await loadAssets(id))
    },
    tokenNames,
    activeLocale: () => ctx.locale.getLocale().active === 'zh' ? 'zh' : 'en',
    connectActions: next => {
      actions = next
      publish()
    },
  }

  return {
    controller,
    dispose: () => {
      window.removeEventListener('storage', onStorage)
      broadcast?.close()
      repository?.close()
      applier.dispose()
    },
  }
}
