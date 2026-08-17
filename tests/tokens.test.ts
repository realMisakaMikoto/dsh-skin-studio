import { describe, expect, it } from 'vitest'
import { BUILTIN_SKINS } from '../src/presets.ts'
import { buildThemeTokenOverrides } from '../src/tokens.ts'

describe('token derivation', () => {
  it('provides light and dark values for every generated token', () => {
    const tokens = buildThemeTokenOverrides(BUILTIN_SKINS[0]!)
    expect(Object.keys(tokens).length).toBeGreaterThan(20)
    for (const value of Object.values(tokens)) {
      expect(value.light).toBeTruthy()
      expect(value.dark).toBeTruthy()
    }
  })

  it('lets validated advanced values win', () => {
    const skin = structuredClone(BUILTIN_SKINS[0]!)
    skin.overrides['--dsw-alias-brand-primary'] = { light: '#112233', dark: '#ddeeff' }
    expect(buildThemeTokenOverrides(skin)['--dsw-alias-brand-primary']).toEqual({ light: '#112233', dark: '#ddeeff' })
  })

  it('uses the interface veil for wallpaper-backed surfaces', () => {
    const skin = structuredClone(BUILTIN_SKINS[0]!)
    skin.appearance.wallpaperAssetId = 'wallpaper'
    skin.appearance.light.surfaceOpacity = 0.4
    const tokens = buildThemeTokenOverrides(skin)
    expect(tokens['--dsw-alias-bg-base']?.light).toContain('40%')
    expect(tokens['--dsw-alias-bg-layer-1']?.light).toContain('52%')
    expect(tokens['--dsw-specific-sidebar-fill']?.light).toContain('50%')
    expect(tokens['--dsw-specific-input-major']?.light).toContain('70%')
  })
})
