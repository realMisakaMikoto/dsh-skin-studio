import { describe, expect, it } from 'vitest'
import { contrastRatio, generateCounterpart, inspectContrast } from '../src/color.ts'
import type { SemanticPalette } from '../src/model.ts'
import { BUILTIN_SKINS } from '../src/presets.ts'

const light: SemanticPalette = {
  accent: '#136f8a', background: '#f7faf9', surface: '#edf4f2', foreground: '#152624', sidebar: '#e5efec', code: '#e1ece9',
}

describe('color engine', () => {
  it('generates a deterministic dark counterpart with readable text', () => {
    const first = generateCounterpart(light, 'dark')
    expect(first).toEqual(generateCounterpart(light, 'dark'))
    expect(contrastRatio(first.foreground, first.background)).toBeGreaterThanOrEqual(4.5)
  })

  it('reports low contrast without rejecting the palette', () => {
    const bad = { ...light, foreground: '#f8f8f8' }
    const issues = inspectContrast({ light: bad, dark: generateCounterpart(light, 'dark') })
    expect(issues.some(issue => issue.mode === 'light' && issue.pair === 'text-background')).toBe(true)
  })

  it('includes component token overrides in the contrast report', () => {
    const dark = generateCounterpart(light, 'dark')
    const issues = inspectContrast({ light, dark }, {
      '--dsw-specific-input-major': { light: light.foreground, dark: dark.background },
      '--dsw-alias-label-secondary': { light: light.background, dark: dark.foreground },
      '--dsw-alias-state-success-primary': { light: light.background, dark: dark.background },
    })
    expect(issues.some(issue => issue.mode === 'light' && issue.pair === 'text-input')).toBe(true)
    expect(issues.some(issue => issue.mode === 'light' && issue.pair === 'advanced-text')).toBe(true)
    expect(issues.some(issue => issue.mode === 'light' && issue.pair === 'status-background')).toBe(true)
  })

  it('keeps every built-in skin above the warning thresholds', () => {
    for (const skin of BUILTIN_SKINS) expect(inspectContrast(skin.palettes, skin.overrides)).toEqual([])
  })
})
