import { mixHex } from './color.ts'
import type { SemanticPalette, SkinManifestV1, SkinMode, ThemeTokenModes } from './model.ts'

export type GuiTokenGroupId = 'surfaces' | 'inputs' | 'buttons' | 'sidebar' | 'conversation' | 'borders' | 'status'

export interface GuiTokenSpec {
  name: string
  label: string
}

export interface GuiTokenGroup {
  id: GuiTokenGroupId
  tokens: readonly GuiTokenSpec[]
}

export const GUI_TOKEN_GROUPS: readonly GuiTokenGroup[] = [
  { id: 'surfaces', tokens: [
    { name: '--dsw-alias-bg-base', label: 'canvas' },
    { name: '--dsw-alias-bg-layer-1', label: 'panel' },
    { name: '--dsw-alias-bg-layer-2', label: 'raised' },
    { name: '--dsw-alias-bg-layer-3', label: 'floating' },
    { name: '--dsw-alias-bg-overlay', label: 'overlay' },
    { name: '--dsw-specific-menu', label: 'menu' },
  ] },
  { id: 'inputs', tokens: [
    { name: '--dsw-specific-input-major', label: 'input' },
    { name: '--dsw-specific-selector', label: 'selector' },
    { name: '--dsw-alias-interactive-bg-hover', label: 'hover' },
    { name: '--dsw-alias-interactive-bg-active', label: 'active' },
    { name: '--dsw-alias-interactive-bg-hover-solid', label: 'hoverSolid' },
  ] },
  { id: 'buttons', tokens: [
    { name: '--dsw-alias-button-primary-fill', label: 'buttonPrimary' },
    { name: '--dsw-alias-button-primary-hover', label: 'buttonPrimaryHover' },
    { name: '--dsw-alias-button-info-fill', label: 'buttonInfo' },
    { name: '--dsw-alias-button-info-hover', label: 'buttonInfoHover' },
    { name: '--dsw-alias-button-elevated-fill', label: 'buttonElevated' },
    { name: '--dsw-alias-button-floating-fill', label: 'buttonFloating' },
  ] },
  { id: 'sidebar', tokens: [
    { name: '--dsw-specific-sidebar-fill', label: 'sidebar' },
    { name: '--dsw-specific-sidebar-nav-item-active', label: 'sidebarActive' },
    { name: '--dsw-specific-sidebar-nav-item-active-accent', label: 'sidebarAccent' },
    { name: '--dsw-specific-sidebar-nav-item-hover', label: 'sidebarHover' },
  ] },
  { id: 'conversation', tokens: [
    { name: '--dsw-specific-bubble', label: 'bubble' },
    { name: '--dsw-specific-bubble-highlight', label: 'bubbleHighlight' },
    { name: '--dsw-alias-markdown-code-block', label: 'codeBlock' },
    { name: '--dsw-alias-markdown-code-block-banner', label: 'codeBanner' },
    { name: '--dsw-alias-markdown-inline-code', label: 'inlineCode' },
    { name: '--dsw-alias-markdown-tag', label: 'tag' },
  ] },
  { id: 'borders', tokens: [
    { name: '--dsw-alias-border-l1', label: 'borderSubtle' },
    { name: '--dsw-alias-border-l2', label: 'borderDefault' },
    { name: '--dsw-alias-border-l3', label: 'borderStrong' },
    { name: '--dsw-alias-border-l4', label: 'borderEmphasis' },
    { name: '--dsw-alias-button-ghost-active-border', label: 'borderControl' },
  ] },
  { id: 'status', tokens: [
    { name: '--dsw-alias-state-business-primary', label: 'statusInfo' },
    { name: '--dsw-alias-state-success-primary', label: 'statusSuccess' },
    { name: '--dsw-alias-state-warn-primary', label: 'statusWarning' },
    { name: '--dsw-alias-state-error-primary', label: 'statusError' },
    { name: '--dsw-alias-toast-bg', label: 'toast' },
    { name: '--dsw-alias-tooltip-bg', label: 'tooltip' },
  ] },
] as const

export const GUI_TOKEN_NAMES: readonly string[] = [...new Set(GUI_TOKEN_GROUPS.flatMap(group => group.tokens.map(token => token.name)))]

function suggestedValue(name: string, palette: SemanticPalette, mode: SkinMode): string {
  const dark = mode === 'dark'
  if (name.includes('state-success')) return '#22c55e'
  if (name.includes('state-warn')) return '#f59e0b'
  if (name.includes('state-error')) return dark ? '#f25a5a' : '#ec1313'
  if (name.includes('state-business') || name.includes('button-info')) return palette.accent
  if (name.includes('toast')) return dark ? '#43454a' : '#353638'
  if (name.includes('tooltip')) return dark ? '#43454a' : '#2c2c2e'
  if (name.includes('border')) {
    const amount = name.includes('button-ghost') ? 0.28 : name.includes('l4') ? 0.38 : name.includes('l3') ? 0.3 : name.includes('l2') ? 0.22 : 0.14
    return mixHex(palette.foreground, palette.background, amount)
  }
  if (name.includes('label')) return palette.foreground
  if (name.includes('sidebar')) {
    if (name.includes('accent')) return mixHex(palette.accent, palette.sidebar, 0.16)
    if (name.includes('active')) return mixHex(palette.foreground, palette.sidebar, 0.1)
    if (name.includes('hover')) return mixHex(palette.foreground, palette.sidebar, 0.06)
    return palette.sidebar
  }
  if (name.includes('bubble')) return mixHex(palette.accent, palette.background, name.includes('highlight') ? 0.22 : 0.12)
  if (name.includes('markdown')) return palette.code
  if (name.includes('button-primary')) return name.includes('hover') ? mixHex(palette.foreground, palette.accent, 0.14) : palette.accent
  if (name.includes('button-elevated') || name.includes('button-floating')) return palette.surface
  if (name.includes('input-major')) return palette.background
  if (name.includes('selector')) return mixHex(palette.foreground, palette.surface, 0.05)
  if (name.includes('menu')) return palette.surface
  if (name.includes('interactive')) return mixHex(palette.foreground, name.includes('solid') ? palette.surface : palette.background, name.includes('active') ? 0.11 : name.includes('solid') ? 0.07 : 0.06)
  if (name.includes('bg-base')) return palette.background
  if (name.includes('bg-layer-1')) return palette.surface
  if (name.includes('bg-layer-2')) return mixHex(palette.foreground, palette.surface, 0.05)
  if (name.includes('bg-layer-3')) return mixHex(palette.foreground, palette.surface, 0.09)
  if (name.includes('bg-overlay')) return palette.surface
  return palette.accent
}

export function suggestTokenModes(name: string, skin: SkinManifestV1): ThemeTokenModes {
  return {
    light: suggestedValue(name, skin.palettes.light, 'light'),
    dark: suggestedValue(name, skin.palettes.dark, 'dark'),
  }
}
