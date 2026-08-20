import { afterEach, describe, expect, it } from 'vitest'
import { BUNDLED_SKIN_PACKAGES } from '../src/builtin-skins.ts'
import { createBlankSkin } from '../src/presets.ts'
import { ACTIVE_SNAPSHOT_KEY, openSkinDatabase, readActiveSnapshot, SkinRepository, writeActiveSnapshot } from '../src/storage.ts'

afterEach(() => { localStorage.clear() })

describe('skin persistence', () => {
  it('seeds and stores manifests in IndexedDB', async () => {
    const bundled = BUNDLED_SKIN_PACKAGES[0]!
    expect(bundled.base64.startsWith('UEsDB')).toBe(true)
    const repository = new SkinRepository(await openSkinDatabase())
    await repository.seed()
    expect((await repository.list()).length).toBeGreaterThanOrEqual(2)
    const skin = createBlankSkin('Saved')
    await repository.save(skin)
    expect((await repository.get(skin.id))?.name).toBe('Saved')
    await repository.delete(skin.id)
    expect(await repository.get(skin.id)).toBeUndefined()
    repository.close()
  })

  it('seeds every bundled skin with assets, excludes the private skin, and preserves edits', async () => {
    const repository = new SkinRepository(await openSkinDatabase())
    await repository.seed()
    const skins = await repository.list()
    expect(BUNDLED_SKIN_PACKAGES).toHaveLength(14)
    expect(skins.some(skin => skin.name.includes('自用'))).toBe(false)
    for (const entry of BUNDLED_SKIN_PACKAGES) {
      expect(entry.base64.startsWith('UEsDB')).toBe(true)
      const skin = skins.find(candidate => candidate.id === entry.id)
      expect(skin?.name).toBe(entry.name)
      expect(skin?.appearance.componentMedia.find(rule => rule.target.classNames.includes('hHd-Xa_root'))?.target.classNames).toEqual(['hHd-Xa_root'])
      expect((await repository.assets(entry.id)).size).toBe(skin?.assets.length)
    }

    const count = skins.length
    await repository.seed()
    expect(await repository.list()).toHaveLength(count)

    const entry = BUNDLED_SKIN_PACKAGES[0]!
    const skin = (await repository.get(entry.id))!
    const assets = await repository.assets(entry.id)
    skin.description = 'User-edited bundled skin'
    skin.updatedAt = new Date(Date.parse(skin.updatedAt) + 1000).toISOString()
    await repository.save(skin, assets)
    await repository.seed()
    expect((await repository.get(entry.id))?.description).toBe('User-edited bundled skin')
    repository.close()
  })

  it('falls back from corrupt active snapshots', () => {
    localStorage.setItem(ACTIVE_SNAPSHOT_KEY, '{bad')
    expect(readActiveSnapshot()).toBeNull()
    const skin = createBlankSkin('Active')
    expect(writeActiveSnapshot(skin)).toBe(true)
    expect(readActiveSnapshot()?.id).toBe(skin.id)
    expect(writeActiveSnapshot(null)).toBe(true)
    expect(readActiveSnapshot()).toBeNull()
  })
})
