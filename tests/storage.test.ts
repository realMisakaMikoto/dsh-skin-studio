import { afterEach, describe, expect, it } from 'vitest'
import { createBlankSkin } from '../src/presets.ts'
import { ACTIVE_SNAPSHOT_KEY, openSkinDatabase, readActiveSnapshot, SkinRepository, writeActiveSnapshot } from '../src/storage.ts'

afterEach(() => { localStorage.clear() })

describe('skin persistence', () => {
  it('seeds and stores manifests in IndexedDB', async () => {
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
