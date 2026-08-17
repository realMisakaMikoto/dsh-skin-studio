import type { AdvancedTokenOverrides, SemanticPalette, SkinManifestV1, ThemeTokenModes } from './model.ts'

const mix = (first: string, amount: number, second: string): string =>
  `color-mix(in oklch, ${first} ${amount}%, ${second})`

export function buildThemeTokenOverrides(skin: SkinManifestV1): Record<string, ThemeTokenModes> {
  const light = skin.palettes.light
  const dark = skin.palettes.dark
  const pair = (get: (palette: SemanticPalette) => string): ThemeTokenModes => ({ light: get(light), dark: get(dark) })
  const hasWallpaper = skin.appearance.wallpaperAssetId !== null
  const translucent = (color: string, opacity: number): string =>
    hasWallpaper ? `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)` : color
  const surfacePair = (get: (palette: SemanticPalette) => string, extra = 0): ThemeTokenModes => ({
    light: translucent(get(light), Math.min(1, skin.appearance.light.surfaceOpacity + extra)),
    dark: translucent(get(dark), Math.min(1, skin.appearance.dark.surfaceOpacity + extra)),
  })
  const generated: Record<string, ThemeTokenModes> = {
    '--dsw-alias-bg-base': surfacePair(p => p.background),
    '--dsw-alias-bg-layer-1': surfacePair(p => p.surface, 0.12),
    '--dsw-alias-bg-layer-2': surfacePair(p => mix(p.foreground, 5, p.surface), 0.2),
    '--dsw-alias-bg-layer-3': surfacePair(p => mix(p.foreground, 9, p.surface), 0.28),
    '--dsw-alias-bg-module-platform': surfacePair(p => mix(p.foreground, 5, p.surface), 0.18),
    '--dsw-alias-bg-multi-select': surfacePair(p => mix(p.foreground, 5, p.surface), 0.18),
    '--dsw-alias-bg-overlay': surfacePair(p => p.surface, 0.32),
    '--dsw-alias-border-l1': pair(p => mix(p.foreground, 14, p.background)),
    '--dsw-alias-border-l2': pair(p => mix(p.foreground, 22, p.background)),
    '--dsw-alias-border-l3': pair(p => mix(p.foreground, 30, p.background)),
    '--dsw-alias-border-l4': pair(p => mix(p.foreground, 38, p.background)),
    '--dsw-alias-brand-primary': pair(p => p.accent),
    '--dsw-alias-brand-text': pair(p => p.accent),
    '--dsw-alias-button-primary-fill': pair(p => p.accent),
    '--dsw-alias-button-primary-hover': pair(p => mix(p.foreground, 14, p.accent)),
    '--dsw-alias-button-primary-dimmed': pair(p => mix(p.foreground, 7, p.surface)),
    '--dsw-alias-button-info-fill': pair(p => p.accent),
    '--dsw-alias-button-info-hover': pair(p => mix(p.foreground, 14, p.accent)),
    '--dsw-alias-button-elevated-fill': surfacePair(p => p.surface, 0.3),
    '--dsw-alias-button-floating-fill': surfacePair(p => p.surface, 0.3),
    '--dsw-alias-button-floating-hover': pair(p => mix(p.foreground, 7, p.surface)),
    '--dsw-alias-button-ghost-active-border': pair(p => mix(p.foreground, 28, p.background)),
    '--dsw-alias-button-ghost-active-fill': pair(p => mix(p.foreground, 8, p.surface)),
    '--dsw-alias-button-ghost-active-hover': pair(p => mix(p.foreground, 12, p.surface)),
    '--dsw-alias-label-primary': pair(p => p.foreground),
    '--dsw-alias-label-secondary': pair(p => mix(p.foreground, 65, p.background)),
    '--dsw-alias-label-tertiary': pair(p => mix(p.foreground, 50, p.background)),
    '--dsw-alias-label-caption': pair(p => mix(p.foreground, 42, p.background)),
    '--dsw-alias-label-dimmed': pair(p => mix(p.foreground, 30, p.background)),
    '--dsw-alias-markdown-inline-code': surfacePair(p => p.code, 0.25),
    '--dsw-alias-markdown-code-block': surfacePair(p => p.code, 0.22),
    '--dsw-alias-markdown-code-block-banner': surfacePair(p => mix(p.foreground, 5, p.code), 0.28),
    '--dsw-alias-markdown-code-segment-selected': pair(p => p.surface),
    '--dsw-alias-markdown-code-segment-unselected': pair(p => p.code),
    '--dsw-alias-markdown-placeholder': pair(p => mix(p.foreground, 5, p.background)),
    '--dsw-alias-markdown-tag': pair(p => mix(p.accent, 9, p.background)),
    '--dsw-alias-interactive-bg-hover': pair(p => mix(p.foreground, 6, p.background)),
    '--dsw-alias-interactive-bg-hover-solid': pair(p => mix(p.foreground, 7, p.surface)),
    '--dsw-alias-interactive-bg-active': pair(p => mix(p.foreground, 11, p.background)),
    '--dsw-specific-sidebar-fill': surfacePair(p => p.sidebar, 0.1),
    '--dsw-specific-sidebar-nav-item-active-accent': pair(p => mix(p.accent, 16, p.sidebar)),
    '--dsw-specific-sidebar-nav-item-active': pair(p => mix(p.foreground, 10, p.sidebar)),
    '--dsw-specific-sidebar-nav-item-hover': pair(p => mix(p.foreground, 6, p.sidebar)),
    '--dsw-specific-bubble': surfacePair(p => mix(p.accent, 12, p.background), 0.2),
    '--dsw-specific-bubble-highlight': surfacePair(p => mix(p.accent, 22, p.background), 0.24),
    '--dsw-specific-input-major': surfacePair(p => p.background, 0.3),
    '--dsw-specific-menu': surfacePair(p => p.surface, 0.34),
    '--dsw-specific-selector': surfacePair(p => mix(p.foreground, 5, p.surface), 0.28),
    '--dsw-specific-tip': surfacePair(p => mix(p.foreground, 5, p.surface), 0.3),
    '--dsw-static-deepseek-500': pair(p => p.accent),
  }
  return { ...generated, ...sanitizeAdvancedOverrides(skin.overrides) }
}

export function sanitizeAdvancedOverrides(overrides: AdvancedTokenOverrides): AdvancedTokenOverrides {
  return Object.fromEntries(Object.entries(overrides).filter(([name, value]) =>
    /^--ds(?:w)?-(?:alias|specific|static)-[a-z0-9-]+$/.test(name)
    && /^#[0-9a-f]{6}$/i.test(value.light)
    && /^#[0-9a-f]{6}$/i.test(value.dark)))
}
