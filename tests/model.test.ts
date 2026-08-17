import { describe, expect, it } from 'vitest'
import { BUILTIN_SKINS } from '../src/presets.ts'
import { decodeSkinManifest, isSafeTokenName, migrateSkinManifest } from '../src/model.ts'

describe('skin manifest', () => {
  it('decodes the shipped current manifest', () => {
    expect(decodeSkinManifest(BUILTIN_SKINS[0])).toEqual(BUILTIN_SKINS[0])
  })

  it('migrates v1 appearance controls and rejects future versions', () => {
    expect(migrateSkinManifest(BUILTIN_SKINS[0])).toBe(BUILTIN_SKINS[0])
    const legacy = structuredClone(BUILTIN_SKINS[0]!) as unknown as {
      formatVersion: number
      appearance: { light: { surfaceOpacity?: number }; dark: { surfaceOpacity?: number } }
    }
    legacy.formatVersion = 1
    delete legacy.appearance.light.surfaceOpacity
    delete legacy.appearance.dark.surfaceOpacity
    expect(decodeSkinManifest(legacy)?.appearance).toMatchObject({
      light: { surfaceOpacity: 0.52 }, dark: { surfaceOpacity: 0.48 },
      componentMedia: [],
    })
    const legacyV2 = structuredClone(BUILTIN_SKINS[0]!) as unknown as { formatVersion: number; appearance: { componentMedia?: unknown[] } }
    legacyV2.formatVersion = 2
    delete legacyV2.appearance.componentMedia
    expect(decodeSkinManifest(legacyV2)?.appearance.componentMedia).toEqual([])
    expect(decodeSkinManifest({ ...BUILTIN_SKINS[0], formatVersion: 4 })).toBeUndefined()
  })

  it('rejects unsafe asset paths', () => {
    const unsafe = structuredClone(BUILTIN_SKINS[0]!)
    unsafe.assets.push({ id: 'bad', path: '../bad.svg', kind: 'wallpaper', mimeType: 'image/png', size: 0, sha256: '0'.repeat(64) })
    expect(decodeSkinManifest(unsafe)).toBeUndefined()
  })

  it('cleans control characters from user-facing metadata', () => {
    const skin = structuredClone(BUILTIN_SKINS[0]!)
    skin.name = '  Clean\u0000 name  '
    expect(decodeSkinManifest(skin)?.name).toBe('Clean name')
  })

  it('allows only official color token namespaces', () => {
    expect(isSafeTokenName('--dsw-alias-bg-base')).toBe(true)
    expect(isSafeTokenName('--attacker-url')).toBe(false)
  })
})
