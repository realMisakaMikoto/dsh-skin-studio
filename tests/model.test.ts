import { describe, expect, it } from 'vitest'
import { BUILTIN_SKINS } from '../src/presets.ts'
import { decodeSkinManifest, isSafeTokenName, migrateSkinManifest } from '../src/model.ts'

describe('skin manifest', () => {
  it('decodes the shipped current manifest', () => {
    expect(decodeSkinManifest(BUILTIN_SKINS[0])).toEqual(BUILTIN_SKINS[0])
  })

  it('migrates v1 through v3 and rejects future versions', () => {
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
    const legacyV3 = structuredClone(BUILTIN_SKINS[0]!) as unknown as {
      formatVersion: number
      visualAssetOverrides?: unknown
      copyOverrides?: unknown
    }
    legacyV3.formatVersion = 3
    delete legacyV3.visualAssetOverrides
    delete legacyV3.copyOverrides
    expect(decodeSkinManifest(legacyV3)).toMatchObject({
      formatVersion: 4,
      visualAssetOverrides: {},
      copyOverrides: {},
    })
    expect(decodeSkinManifest({ ...BUILTIN_SKINS[0], formatVersion: 5 })).toBeUndefined()
  })

  it('rejects unknown semantic slots, missing visual assets, and invalid copy', () => {
    const unknownVisual = structuredClone(BUILTIN_SKINS[0]!) as typeof BUILTIN_SKINS[number] & {
      visualAssetOverrides: Record<string, string>
    }
    unknownVisual.visualAssetOverrides['attacker-selector'] = 'asset-one'
    expect(decodeSkinManifest(unknownVisual)).toBeUndefined()

    const missingAsset = structuredClone(BUILTIN_SKINS[0]!)
    missingAsset.visualAssetOverrides['hero-whale-logo'] = 'missing'
    expect(decodeSkinManifest(missingAsset)).toBeUndefined()

    const unknownCopy = structuredClone(BUILTIN_SKINS[0]!) as typeof BUILTIN_SKINS[number] & {
      copyOverrides: Record<string, unknown>
    }
    unknownCopy.copyOverrides['document.querySelector'] = { zh: '不安全' }
    expect(decodeSkinManifest(unknownCopy)).toBeUndefined()

    const tooLong = structuredClone(BUILTIN_SKINS[0]!)
    tooLong.copyOverrides['welcome.title'] = { zh: '长'.repeat(161) }
    expect(decodeSkinManifest(tooLong)).toBeUndefined()
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
