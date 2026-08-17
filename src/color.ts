import type { AdvancedTokenOverrides, SemanticPalette, SkinMode } from './model.ts'

interface RGB { r: number; g: number; b: number }
interface OKLCH { l: number; c: number; h: number }

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value))
const fromHex = (hex: string): RGB => ({
  r: Number.parseInt(hex.slice(1, 3), 16) / 255,
  g: Number.parseInt(hex.slice(3, 5), 16) / 255,
  b: Number.parseInt(hex.slice(5, 7), 16) / 255,
})
const channel = (value: number): number => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
const gamma = (value: number): number => value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
const hexByte = (value: number): string => Math.round(clamp(value) * 255).toString(16).padStart(2, '0')

export function mixHex(first: string, second: string, firstWeight: number): string {
  const one = fromHex(first)
  const two = fromHex(second)
  const weight = clamp(firstWeight)
  return `#${hexByte(one.r * weight + two.r * (1 - weight))}${hexByte(one.g * weight + two.g * (1 - weight))}${hexByte(one.b * weight + two.b * (1 - weight))}`
}

function rgbToOklch(hex: string): OKLCH {
  const rgb = fromHex(hex)
  const r = channel(rgb.r); const g = channel(rgb.g); const b = channel(rgb.b)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l3 = Math.cbrt(l); const m3 = Math.cbrt(m); const s3 = Math.cbrt(s)
  const L = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3
  const bb = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3
  const h = (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360
  return { l: L, c: Math.sqrt(a * a + bb * bb), h }
}

function oklchToHex({ l: L, c, h }: OKLCH): string {
  const radians = h * Math.PI / 180
  const a = c * Math.cos(radians); const b = c * Math.sin(radians)
  const l3 = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m3 = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s3 = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const r = gamma(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)
  const g = gamma(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)
  const blue = gamma(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3)
  return `#${hexByte(r)}${hexByte(g)}${hexByte(blue)}`
}

function remap(hex: string, lightness: number, chromaCap: number): string {
  const color = rgbToOklch(hex)
  return oklchToHex({ l: lightness, c: Math.min(color.c, chromaCap), h: color.h })
}

export function generateCounterpart(source: SemanticPalette, target: SkinMode): SemanticPalette {
  if (target === 'dark') {
    return {
      accent: remap(source.accent, 0.72, 0.18),
      background: remap(source.background, 0.13, 0.035),
      surface: remap(source.surface, 0.19, 0.04),
      foreground: remap(source.foreground, 0.94, 0.025),
      sidebar: remap(source.sidebar, 0.15, 0.045),
      code: remap(source.code, 0.21, 0.035),
    }
  }
  return {
    accent: remap(source.accent, 0.53, 0.19),
    background: remap(source.background, 0.985, 0.02),
    surface: remap(source.surface, 0.955, 0.025),
    foreground: remap(source.foreground, 0.17, 0.035),
    sidebar: remap(source.sidebar, 0.97, 0.03),
    code: remap(source.code, 0.93, 0.025),
  }
}

export function relativeLuminance(hex: string): number {
  const rgb = fromHex(hex)
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

export function contrastRatio(first: string, second: string): number {
  const one = relativeLuminance(first); const two = relativeLuminance(second)
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05)
}

export interface ContrastIssue {
  mode: SkinMode
  pair: 'text-background' | 'text-surface' | 'text-input' | 'text-sidebar' | 'text-code' | 'text-overlay' | 'accent-background' | 'button-label' | 'advanced-text' | 'status-background' | 'toast-label'
  ratio: number
  required: number
}

export function inspectContrast(palettes: Record<SkinMode, SemanticPalette>, overrides: AdvancedTokenOverrides = {}): ContrastIssue[] {
  const issues: ContrastIssue[] = []
  for (const mode of ['light', 'dark'] as const) {
    const p = palettes[mode]
    const value = (name: string, fallback: string): string => overrides[name]?.[mode] ?? fallback
    const foreground = value('--dsw-alias-label-primary', p.foreground)
    const background = value('--dsw-alias-bg-base', p.background)
    for (const [pair, first, second, required] of [
      ['text-background', foreground, background, 4.5],
      ['text-surface', foreground, value('--dsw-alias-bg-layer-1', p.surface), 4.5],
      ['text-input', foreground, value('--dsw-specific-input-major', p.background), 4.5],
      ['text-sidebar', foreground, value('--dsw-specific-sidebar-fill', p.sidebar), 4.5],
      ['text-code', foreground, value('--dsw-alias-markdown-code-block', p.code), 4.5],
      ['text-overlay', foreground, value('--dsw-alias-bg-overlay', p.surface), 4.5],
      ['accent-background', value('--dsw-alias-brand-primary', p.accent), background, 3],
      ['button-label', mode === 'light' ? '#ffffff' : '#0f1115', value('--dsw-alias-button-primary-fill', p.accent), 4.5],
    ] as const) {
      const ratio = contrastRatio(first, second)
      if (ratio < required) issues.push({ mode, pair, ratio, required })
    }
    for (const [name, token] of Object.entries(overrides)) {
      const color = token[mode]
      if (name.startsWith('--dsw-alias-label-') && name !== '--dsw-alias-label-primary') {
        const ratio = Math.min(contrastRatio(color, background), contrastRatio(color, value('--dsw-alias-bg-layer-1', p.surface)))
        if (ratio < 4.5) issues.push({ mode, pair: 'advanced-text', ratio, required: 4.5 })
      }
      if (name.startsWith('--dsw-alias-state-')) {
        const ratio = Math.min(contrastRatio(color, background), contrastRatio(color, value('--dsw-alias-bg-layer-1', p.surface)))
        if (ratio < 4.5) issues.push({ mode, pair: 'status-background', ratio, required: 4.5 })
      }
      if (name === '--dsw-alias-toast-bg' || name === '--dsw-alias-tooltip-bg') {
        const ratio = contrastRatio('#ffffff', color)
        if (ratio < 4.5) issues.push({ mode, pair: 'toast-label', ratio, required: 4.5 })
      }
    }
  }
  return issues
}
