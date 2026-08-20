import { describe, expect, it } from 'vitest'
import { BUILTIN_SKINS } from '../src/presets.ts'
import { decodeSkinManifest, isSafeTokenName, migrateSkinManifest } from '../src/model.ts'

describe('skin manifest', () => {
  it('decodes the shipped current manifest', () => {
    expect(decodeSkinManifest(BUILTIN_SKINS[0])).toEqual(BUILTIN_SKINS[0])
  })

  it('migrates v1 through v4 and rejects future versions', () => {
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
      formatVersion: 5,
      sidebarBrandLayout: 'split',
      visualAssetOverrides: {},
      copyOverrides: {},
      textOverrides: [],
    })
    const legacyV4 = structuredClone(BUILTIN_SKINS[0]!) as unknown as { formatVersion: number; sidebarBrandLayout?: unknown; textOverrides?: unknown }
    legacyV4.formatVersion = 4
    delete legacyV4.sidebarBrandLayout
    delete legacyV4.textOverrides
    expect(decodeSkinManifest(legacyV4)?.sidebarBrandLayout).toBe('split')
    expect(decodeSkinManifest(legacyV4)?.textOverrides).toEqual([])
    expect(decodeSkinManifest({ ...BUILTIN_SKINS[0], formatVersion: 6 })).toBeUndefined()
  })

  it('validates localized free-text targets and retains inactive legacy settings copy', () => {
    const skin = structuredClone(BUILTIN_SKINS[0]!)
    const target = {
      anchor: { tagName: 'button', role: null, classNames: ['abc_action'] },
      path: [{ childIndex: 0, tagName: 'span', role: null, classNames: ['abc_label'] }],
      property: 'text' as const,
      textNodeIndex: 0,
    }
    skin.copyOverrides['settings.title'] = { zh: '旧设置标题' }
    skin.textOverrides = [{ id: 'text-save', name: 'Save action', sample: 'Save', target, replacements: { zh: '保存', en: 'Save now' } }]
    const decoded = decodeSkinManifest(skin)
    expect(decoded?.copyOverrides['settings.title']?.zh).toBe('旧设置标题')
    expect(decoded?.textOverrides[0]?.replacements).toEqual({ zh: '保存', en: 'Save now' })

    const duplicate = structuredClone(skin)
    duplicate.textOverrides.push({ ...structuredClone(duplicate.textOverrides[0]!), id: 'text-save-again' })
    expect(decodeSkinManifest(duplicate)).toBeUndefined()

    const deep = structuredClone(skin)
    deep.textOverrides[0]!.target.path = Array.from({ length: 7 }, (_, childIndex) => ({ childIndex, tagName: 'span', role: null, classNames: [] }))
    expect(decodeSkinManifest(deep)).toBeUndefined()

    const unsafe = structuredClone(skin) as unknown as { textOverrides: Array<{ replacements: unknown; target: unknown }> }
    unsafe.textOverrides[0]!.replacements = { zh: '<script>\u0000</script>' }
    expect(decodeSkinManifest(unsafe)).toBeUndefined()
    unsafe.textOverrides[0]!.replacements = { zh: 'x' }
    unsafe.textOverrides[0]!.target = { selector: 'body *', property: 'textContent' }
    expect(decodeSkinManifest(unsafe)).toBeUndefined()

    const tooMany = structuredClone(BUILTIN_SKINS[0]!)
    tooMany.textOverrides = Array.from({ length: 129 }, (_, index) => ({
      id: `text-${index}`, name: `Text ${index}`, sample: `Sample ${index}`,
      target: { anchor: { tagName: 'span', role: null, classNames: [`text_${index}`] }, path: [], property: 'text' as const, textNodeIndex: 0 },
      replacements: {},
    }))
    expect(decodeSkinManifest(tooMany)).toBeUndefined()
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

    expect(decodeSkinManifest({ ...BUILTIN_SKINS[0], sidebarBrandLayout: 'overlap' })).toBeUndefined()
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
