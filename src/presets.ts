import { SKIN_FORMAT, SKIN_FORMAT_VERSION, type SemanticPalette, type SkinManifestV1 } from './model.ts'
import { generateCounterpart } from './color.ts'

const systemFont = (family: string) => ({ kind: 'system' as const, assetId: null, family })

function preset(id: string, name: string, light: SemanticPalette, description: string): SkinManifestV1 {
  const now = '2026-08-16T00:00:00.000Z'
  return {
    format: SKIN_FORMAT,
    formatVersion: SKIN_FORMAT_VERSION,
    id,
    name,
    author: 'dsh-skin-studio',
    description,
    createdAt: now,
    updatedAt: now,
    palettes: { light, dark: generateCounterpart(light, 'dark') },
    overrides: {},
    appearance: {
      wallpaperAssetId: null,
      wallpaperBlurPx: 0,
      light: { wallpaperOpacity: 1, scrimOpacity: 0.08, surfaceOpacity: 0.52 },
      dark: { wallpaperOpacity: 0.9, scrimOpacity: 0.2, surfaceOpacity: 0.48 },
      uiFont: systemFont('-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'),
      codeFont: systemFont('"SFMono-Regular", Consolas, "Liberation Mono", monospace'),
      componentMedia: [],
    },
    assets: [],
  }
}

export const BUILTIN_SKINS: readonly SkinManifestV1[] = [
  preset('builtin-bright-studio', 'Bright Studio', {
    accent: '#0b7598', background: '#ffffff', surface: '#f7fafb', foreground: '#17272b', sidebar: '#f2f7f8', code: '#f0f5f6',
  }, 'A bright neutral canvas with clear inputs, quiet surfaces, and a lightly tinted sidebar.'),
  preset('builtin-tidal-paper', 'Tidal Paper', {
    accent: '#136f8a', background: '#f7faf9', surface: '#edf4f2', foreground: '#152624', sidebar: '#e5efec', code: '#e1ece9',
  }, 'Quiet teal surfaces with a crisp editorial canvas.'),
  preset('builtin-high-contrast', 'High Contrast', {
    accent: '#004fd7', background: '#ffffff', surface: '#f2f2f2', foreground: '#050505', sidebar: '#e9e9e9', code: '#e2e2e2',
  }, 'A restrained palette designed to keep text and controls distinct.'),
] as const

export function createBlankSkin(name = 'Untitled skin'): SkinManifestV1 {
  const base = structuredClone(BUILTIN_SKINS[0]!)
  const now = new Date().toISOString()
  base.id = `skin-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
  base.name = name
  base.author = ''
  base.description = ''
  base.createdAt = now
  base.updatedAt = now
  return base
}
