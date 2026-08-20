import {
  COPY_SLOT_SET, COPY_SLOTS, SKIN_LOCALES, VISUAL_ASSET_SLOT_SET,
  type CopySlotId, type SkinLocale, type VisualAssetSlotId,
} from './skin-slots.ts'

export const SKIN_FORMAT = 'dsh-skin-studio' as const
export const SKIN_FORMAT_VERSION = 5 as const
export const MAX_PACKAGE_BYTES = 128 * 1024 * 1024
export const MAX_WALLPAPER_BYTES = 15 * 1024 * 1024
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024
export const MAX_FONT_BYTES = 5 * 1024 * 1024
export const MAX_VISUAL_ASSET_BYTES = 5 * 1024 * 1024
export const MAX_TEXT_OVERRIDE_RULES = 128
export const MAX_TEXT_OVERRIDE_PATH_DEPTH = 6
export const MAX_TEXT_OVERRIDE_VALUE_LENGTH = 300

export const MODES = ['light', 'dark'] as const
export type SkinMode = (typeof MODES)[number]

export const SIDEBAR_BRAND_LAYOUTS = ['split', 'single'] as const
export type SidebarBrandLayout = (typeof SIDEBAR_BRAND_LAYOUTS)[number]

export const PALETTE_ROLES = [
  'accent', 'background', 'surface', 'foreground', 'sidebar', 'code',
] as const
export type PaletteRole = (typeof PALETTE_ROLES)[number]

export interface SemanticPalette {
  accent: string
  background: string
  surface: string
  foreground: string
  sidebar: string
  code: string
}

export interface ThemeTokenModes {
  light: string
  dark: string
}

export type AdvancedTokenOverrides = Record<string, ThemeTokenModes>

export interface ModeAppearance {
  wallpaperOpacity: number
  scrimOpacity: number
  surfaceOpacity: number
}

export interface FontReference {
  kind: 'system' | 'asset'
  assetId: string | null
  family: string
}

export interface SkinAppearance {
  wallpaperAssetId: string | null
  wallpaperBlurPx: number
  light: ModeAppearance
  dark: ModeAppearance
  uiFont: FontReference
  codeFont: FontReference
  componentMedia: ComponentMediaRule[]
}

export interface ComponentTarget {
  tagName: string
  role: string | null
  classNames: string[]
}

export interface ComponentMediaMode {
  opacity: number
  scrimOpacity: number
}

export interface ComponentMediaRule {
  id: string
  name: string
  target: ComponentTarget
  assetId: string | null
  blurPx: number
  light: ComponentMediaMode
  dark: ComponentMediaMode
}

export type AssetKind = 'wallpaper' | 'component-media' | 'visual-asset' | 'ui-font' | 'code-font'

export interface SkinAssetDescriptor {
  id: string
  path: string
  kind: AssetKind
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'video/mp4' | 'video/webm' | 'font/woff2'
  size: number
  sha256: string
}

export type VisualAssetOverrides = Partial<Record<VisualAssetSlotId, string>>
export type LocalizedCopyOverride = Partial<Record<SkinLocale, string>>
export type CopyOverrides = Partial<Record<CopySlotId, LocalizedCopyOverride>>

export interface TextTargetPathSegment extends ComponentTarget {
  childIndex: number
}

export type TextOverrideTarget = {
  anchor: ComponentTarget
  path: TextTargetPathSegment[]
  property: 'text'
  textNodeIndex: number
} | {
  anchor: ComponentTarget
  path: TextTargetPathSegment[]
  property: 'placeholder'
}

export interface TextOverrideRule {
  id: string
  name: string
  sample: string
  target: TextOverrideTarget
  replacements: LocalizedCopyOverride
}

/** Current public manifest stored as manifest.json inside a .dshskin ZIP container. */
export interface SkinManifestV5 {
  format: typeof SKIN_FORMAT
  formatVersion: typeof SKIN_FORMAT_VERSION
  id: string
  name: string
  author: string
  description: string
  createdAt: string
  updatedAt: string
  palettes: Record<SkinMode, SemanticPalette>
  overrides: AdvancedTokenOverrides
  appearance: SkinAppearance
  sidebarBrandLayout: SidebarBrandLayout
  visualAssetOverrides: VisualAssetOverrides
  copyOverrides: CopyOverrides
  textOverrides: TextOverrideRule[]
  assets: SkinAssetDescriptor[]
}

export type SkinManifest = SkinManifestV5
/** @deprecated Import SkinManifest or SkinManifestV5 for the current schema. */
export type SkinManifestV4 = SkinManifestV5
/** @deprecated Import SkinManifest or SkinManifestV5 for the current schema. */
export type SkinManifestV3 = SkinManifestV5
/** @deprecated Import SkinManifest or SkinManifestV5 for the current schema. */
export type SkinManifestV2 = SkinManifestV5
/** @deprecated Import SkinManifest or SkinManifestV5 for the current schema. */
export type SkinManifestV1 = SkinManifestV5

export interface StoredAsset {
  skinId: string
  assetId: string
  blob: Blob
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,95}$/i
const SAFE_TOKEN = /^--ds(?:w)?-(?:alias|specific|static)-[a-z0-9-]+$/
const SHA256 = /^[0-9a-f]{64}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:/
const ALLOWED_MIME = new Set<SkinAssetDescriptor['mimeType']>([
  'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'font/woff2',
])
const ALLOWED_KIND = new Set<AssetKind>(['wallpaper', 'component-media', 'visual-asset', 'ui-font', 'code-font'])
const ASSET_EXTENSION: Record<SkinAssetDescriptor['mimeType'], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'font/woff2': 'woff2',
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

export function isSafeTokenName(value: unknown): value is string {
  return typeof value === 'string' && SAFE_TOKEN.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Upgrade a supported manifest to the current schema. */
export function migrateSkinManifest(value: unknown): unknown {
  if (!isRecord(value) || value.format !== SKIN_FORMAT || !Number.isInteger(value.formatVersion)) return undefined
  const version = value.formatVersion as number
  if (version < 1 || version > SKIN_FORMAT_VERSION) return undefined
  if (version < SKIN_FORMAT_VERSION) {
    const migrated = structuredClone(value)
    if (!isRecord(migrated.appearance)) return undefined
    if (version === 1) {
      for (const mode of MODES) {
        const appearance = migrated.appearance[mode]
        if (!isRecord(appearance)) return undefined
        appearance.surfaceOpacity = mode === 'light' ? 0.52 : 0.48
      }
    }
    if (version < 3) migrated.appearance.componentMedia = []
    if (version < 4) {
      migrated.visualAssetOverrides = {}
      migrated.copyOverrides = {}
    }
    if (migrated.sidebarBrandLayout === undefined) migrated.sidebarBrandLayout = 'split'
    if (version < 5) migrated.textOverrides = []
    migrated.formatVersion = SKIN_FORMAT_VERSION
    return migrated
  }
  return value
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return clean.length <= max ? clean : undefined
}

function decodePalette(value: unknown): SemanticPalette | undefined {
  if (!isRecord(value)) return undefined
  const palette = {} as Record<PaletteRole, string>
  for (const role of PALETTE_ROLES) {
    if (!isHexColor(value[role])) return undefined
    palette[role] = value[role].toLowerCase()
  }
  return palette
}

function decodeModeAppearance(value: unknown): ModeAppearance | undefined {
  if (!isRecord(value)) return undefined
  const wallpaperOpacity = value.wallpaperOpacity
  const scrimOpacity = value.scrimOpacity
  const surfaceOpacity = value.surfaceOpacity
  if (typeof wallpaperOpacity !== 'number' || wallpaperOpacity < 0 || wallpaperOpacity > 1) return undefined
  if (typeof scrimOpacity !== 'number' || scrimOpacity < 0 || scrimOpacity > 1) return undefined
  if (typeof surfaceOpacity !== 'number' || surfaceOpacity < 0 || surfaceOpacity > 1) return undefined
  return { wallpaperOpacity, scrimOpacity, surfaceOpacity }
}

function decodeFont(value: unknown): FontReference | undefined {
  if (!isRecord(value) || (value.kind !== 'system' && value.kind !== 'asset')) return undefined
  const family = cleanText(value.family, 80)
  if (family === undefined) return undefined
  if (value.kind === 'system') return { kind: 'system', assetId: null, family }
  if (typeof value.assetId !== 'string' || !SAFE_ID.test(value.assetId)) return undefined
  return { kind: 'asset', assetId: value.assetId, family }
}

function decodeComponentTarget(value: unknown): ComponentTarget | undefined {
  if (!isRecord(value) || typeof value.tagName !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(value.tagName)) return undefined
  if (value.role !== null && (typeof value.role !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(value.role))) return undefined
  if (!Array.isArray(value.classNames) || value.classNames.length > 4) return undefined
  const classNames = value.classNames.filter(item => typeof item === 'string' && /^[a-z0-9_-]{1,96}$/i.test(item)) as string[]
  if (classNames.length !== value.classNames.length || new Set(classNames).size !== classNames.length) return undefined
  return { tagName: value.tagName, role: value.role, classNames }
}

function decodeTextTargetPathSegment(value: unknown): TextTargetPathSegment | undefined {
  if (!isRecord(value) || !Number.isInteger(value.childIndex) || (value.childIndex as number) < 0 || (value.childIndex as number) > 255) return undefined
  const target = decodeComponentTarget(value)
  return target === undefined ? undefined : { ...target, childIndex: value.childIndex as number }
}

function decodeTextOverrideTarget(value: unknown): TextOverrideTarget | undefined {
  if (!isRecord(value)) return undefined
  const anchor = decodeComponentTarget(value.anchor)
  const path = Array.isArray(value.path) ? value.path.map(decodeTextTargetPathSegment) : undefined
  if (anchor === undefined || path === undefined || path.length > MAX_TEXT_OVERRIDE_PATH_DEPTH || path.some(segment => segment === undefined)) return undefined
  const decodedPath = path as TextTargetPathSegment[]
  if (value.property === 'text') {
    if (!Number.isInteger(value.textNodeIndex) || (value.textNodeIndex as number) < 0 || (value.textNodeIndex as number) > 255) return undefined
    return { anchor, path: decodedPath, property: 'text', textNodeIndex: value.textNodeIndex as number }
  }
  if (value.property === 'placeholder' && value.textNodeIndex === undefined) {
    return { anchor, path: decodedPath, property: 'placeholder' }
  }
  return undefined
}

function decodeTextReplacements(value: unknown): LocalizedCopyOverride | undefined {
  if (!isRecord(value) || Object.keys(value).some(locale => !SKIN_LOCALES.includes(locale as SkinLocale))) return undefined
  const replacements: LocalizedCopyOverride = {}
  for (const locale of SKIN_LOCALES) {
    const input = value[locale]
    if (input === undefined) continue
    if (typeof input !== 'string' || /[\u0000-\u001f\u007f]/.test(input)) return undefined
    const clean = input.trim()
    if (clean === '' || clean.length > MAX_TEXT_OVERRIDE_VALUE_LENGTH) return undefined
    replacements[locale] = clean
  }
  return replacements
}

export function textOverrideTargetKey(target: TextOverrideTarget): string {
  const part = (value: ComponentTarget): string => `${value.tagName}|${value.role ?? ''}|${[...value.classNames].sort().join('.')}`
  const path = target.path.map(segment => `${segment.childIndex}:${part(segment)}`).join('/')
  return `${part(target.anchor)}>${path}#${target.property}:${target.property === 'text' ? target.textNodeIndex : ''}`
}

function decodeTextOverrideRule(value: unknown): TextOverrideRule | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || !SAFE_ID.test(value.id)) return undefined
  if (typeof value.name !== 'string' || /[\u0000-\u001f\u007f]/.test(value.name)) return undefined
  if (typeof value.sample !== 'string' || /[\u0000-\u001f\u007f]/.test(value.sample)) return undefined
  const name = value.name.trim()
  const sample = value.sample.trim()
  const target = decodeTextOverrideTarget(value.target)
  const replacements = decodeTextReplacements(value.replacements)
  if (name === '' || name.length > 80 || sample === '' || sample.length > MAX_TEXT_OVERRIDE_VALUE_LENGTH || target === undefined || replacements === undefined) return undefined
  return { id: value.id, name, sample, target, replacements }
}

function decodeComponentMediaMode(value: unknown): ComponentMediaMode | undefined {
  if (!isRecord(value)) return undefined
  const opacity = value.opacity
  const scrimOpacity = value.scrimOpacity
  if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) return undefined
  if (typeof scrimOpacity !== 'number' || scrimOpacity < 0 || scrimOpacity > 1) return undefined
  return { opacity, scrimOpacity }
}

function decodeComponentMediaRule(value: unknown): ComponentMediaRule | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || !SAFE_ID.test(value.id)) return undefined
  const name = cleanText(value.name, 80)
  const target = decodeComponentTarget(value.target)
  const light = decodeComponentMediaMode(value.light)
  const dark = decodeComponentMediaMode(value.dark)
  if (name === undefined || target === undefined || light === undefined || dark === undefined) return undefined
  if (typeof value.blurPx !== 'number' || value.blurPx < 0 || value.blurPx > 40) return undefined
  if (value.assetId !== null && (typeof value.assetId !== 'string' || !SAFE_ID.test(value.assetId))) return undefined
  return { id: value.id, name, target, assetId: value.assetId, blurPx: value.blurPx, light, dark }
}

function decodeAppearance(value: unknown): SkinAppearance | undefined {
  if (!isRecord(value)) return undefined
  const light = decodeModeAppearance(value.light)
  const dark = decodeModeAppearance(value.dark)
  const uiFont = decodeFont(value.uiFont)
  const codeFont = decodeFont(value.codeFont)
  const wallpaperBlurPx = value.wallpaperBlurPx
  const wallpaperAssetId = value.wallpaperAssetId
  const componentMedia = Array.isArray(value.componentMedia) ? value.componentMedia.map(decodeComponentMediaRule) : undefined
  if (light === undefined || dark === undefined || uiFont === undefined || codeFont === undefined) return undefined
  if (componentMedia === undefined || componentMedia.length > 64 || componentMedia.some(rule => rule === undefined)) return undefined
  const decodedComponentMedia = componentMedia as ComponentMediaRule[]
  if (new Set(decodedComponentMedia.map(rule => rule.id)).size !== decodedComponentMedia.length) return undefined
  if (typeof wallpaperBlurPx !== 'number' || wallpaperBlurPx < 0 || wallpaperBlurPx > 40) return undefined
  if (wallpaperAssetId !== null && (typeof wallpaperAssetId !== 'string' || !SAFE_ID.test(wallpaperAssetId))) return undefined
  return { wallpaperAssetId, wallpaperBlurPx, light, dark, uiFont, codeFont, componentMedia: decodedComponentMedia }
}

function decodeOverrides(value: unknown): AdvancedTokenOverrides | undefined {
  if (!isRecord(value)) return undefined
  const overrides: AdvancedTokenOverrides = {}
  for (const [name, modes] of Object.entries(value)) {
    if (!isSafeTokenName(name) || !isRecord(modes) || !isHexColor(modes.light) || !isHexColor(modes.dark)) return undefined
    overrides[name] = { light: modes.light.toLowerCase(), dark: modes.dark.toLowerCase() }
  }
  return overrides
}

function decodeVisualAssetOverrides(value: unknown): VisualAssetOverrides | undefined {
  if (!isRecord(value)) return undefined
  const overrides: VisualAssetOverrides = {}
  for (const [slot, assetId] of Object.entries(value)) {
    if (!VISUAL_ASSET_SLOT_SET.has(slot) || typeof assetId !== 'string' || !SAFE_ID.test(assetId)) return undefined
    overrides[slot as VisualAssetSlotId] = assetId
  }
  return overrides
}

function decodeCopyOverrides(value: unknown): CopyOverrides | undefined {
  if (!isRecord(value)) return undefined
  const overrides: CopyOverrides = {}
  for (const [slotId, localized] of Object.entries(value)) {
    if (!COPY_SLOT_SET.has(slotId) || !isRecord(localized)) return undefined
    if (Object.keys(localized).some(locale => !SKIN_LOCALES.includes(locale as SkinLocale))) return undefined
    const slot = COPY_SLOTS.find(candidate => candidate.id === slotId)!
    const decoded: LocalizedCopyOverride = {}
    for (const locale of SKIN_LOCALES) {
      const input = localized[locale]
      if (input === undefined) continue
      if (typeof input !== 'string' || /[\u0000-\u001f\u007f]/.test(input)) return undefined
      const clean = input.trim()
      if (clean === '' || clean.length > slot.maxLength) return undefined
      decoded[locale] = clean
    }
    if (Object.keys(decoded).length === 0) return undefined
    overrides[slotId as CopySlotId] = decoded
  }
  return overrides
}

function decodeAsset(value: unknown): SkinAssetDescriptor | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || !SAFE_ID.test(value.id)) return undefined
  if (typeof value.path !== 'string' || !/^assets\/[a-z0-9._-]+$/i.test(value.path)) return undefined
  if (!ALLOWED_KIND.has(value.kind as AssetKind) || !ALLOWED_MIME.has(value.mimeType as SkinAssetDescriptor['mimeType'])) return undefined
  if (typeof value.size !== 'number' || !Number.isInteger(value.size) || value.size < 0) return undefined
  if (typeof value.sha256 !== 'string' || !SHA256.test(value.sha256)) return undefined
  const kind = value.kind as AssetKind
  const mimeType = value.mimeType as SkinAssetDescriptor['mimeType']
  if (value.path !== `assets/${value.id}.${ASSET_EXTENSION[mimeType]}`) return undefined
  const imageMime = mimeType.startsWith('image/')
  const videoMime = mimeType.startsWith('video/')
  const mediaKind = kind === 'wallpaper' || kind === 'component-media'
  const limit = kind === 'visual-asset' ? MAX_VISUAL_ASSET_BYTES : videoMime ? MAX_VIDEO_BYTES : mediaKind ? MAX_WALLPAPER_BYTES : MAX_FONT_BYTES
  if (value.size > limit) return undefined
  if (mediaKind && !imageMime && !videoMime) return undefined
  if (kind === 'visual-asset' && !imageMime) return undefined
  if ((kind === 'ui-font' || kind === 'code-font') && mimeType !== 'font/woff2') return undefined
  return { id: value.id, path: value.path, kind, mimeType, size: value.size, sha256: value.sha256 }
}

export function decodeSkinManifest(value: unknown): SkinManifestV5 | undefined {
  value = migrateSkinManifest(value)
  if (!isRecord(value) || value.formatVersion !== SKIN_FORMAT_VERSION) return undefined
  const id = typeof value.id === 'string' && SAFE_ID.test(value.id) ? value.id : undefined
  const name = cleanText(value.name, 80)
  const author = cleanText(value.author, 80)
  const description = cleanText(value.description, 300)
  const palettes = isRecord(value.palettes) ? {
    light: decodePalette(value.palettes.light),
    dark: decodePalette(value.palettes.dark),
  } : undefined
  const overrides = decodeOverrides(value.overrides)
  const appearance = decodeAppearance(value.appearance)
  const sidebarBrandLayout = SIDEBAR_BRAND_LAYOUTS.includes(value.sidebarBrandLayout as SidebarBrandLayout)
    ? value.sidebarBrandLayout as SidebarBrandLayout
    : undefined
  const visualAssetOverrides = decodeVisualAssetOverrides(value.visualAssetOverrides)
  const copyOverrides = decodeCopyOverrides(value.copyOverrides)
  const textOverrides = Array.isArray(value.textOverrides) ? value.textOverrides.map(decodeTextOverrideRule) : undefined
  const assets = Array.isArray(value.assets) ? value.assets.map(decodeAsset) : undefined
  if (id === undefined || name === undefined || author === undefined || description === undefined) return undefined
  if (!ISO_DATE.test(String(value.createdAt)) || !ISO_DATE.test(String(value.updatedAt))) return undefined
  if (palettes?.light === undefined || palettes.dark === undefined || overrides === undefined || appearance === undefined || sidebarBrandLayout === undefined || visualAssetOverrides === undefined || copyOverrides === undefined) return undefined
  if (textOverrides === undefined || textOverrides.length > MAX_TEXT_OVERRIDE_RULES || textOverrides.some(rule => rule === undefined)) return undefined
  const decodedTextOverrides = textOverrides as TextOverrideRule[]
  if (new Set(decodedTextOverrides.map(rule => rule.id)).size !== decodedTextOverrides.length) return undefined
  if (new Set(decodedTextOverrides.map(rule => textOverrideTargetKey(rule.target))).size !== decodedTextOverrides.length) return undefined
  if (assets === undefined || assets.some(asset => asset === undefined)) return undefined
  const decodedAssets = assets as SkinAssetDescriptor[]
  if (new Set(decodedAssets.map(asset => asset.id)).size !== decodedAssets.length) return undefined
  if (new Set(decodedAssets.map(asset => asset.path)).size !== decodedAssets.length) return undefined
  const singletonAssets = decodedAssets.filter(asset => asset.kind === 'wallpaper' || asset.kind === 'ui-font' || asset.kind === 'code-font')
  if (new Set(singletonAssets.map(asset => asset.kind)).size !== singletonAssets.length) return undefined
  if (decodedAssets.reduce((total, asset) => total + asset.size, 0) > MAX_PACKAGE_BYTES) return undefined
  const assetsById = new Map(decodedAssets.map(asset => [asset.id, asset]))
  if (appearance.wallpaperAssetId !== null && assetsById.get(appearance.wallpaperAssetId)?.kind !== 'wallpaper') return undefined
  if (appearance.uiFont.assetId !== null && assetsById.get(appearance.uiFont.assetId)?.kind !== 'ui-font') return undefined
  if (appearance.codeFont.assetId !== null && assetsById.get(appearance.codeFont.assetId)?.kind !== 'code-font') return undefined
  if (appearance.componentMedia.some(rule => rule.assetId !== null && assetsById.get(rule.assetId)?.kind !== 'component-media')) return undefined
  if (Object.values(visualAssetOverrides).some(assetId => assetsById.get(assetId)?.kind !== 'visual-asset')) return undefined
  return {
    format: SKIN_FORMAT,
    formatVersion: SKIN_FORMAT_VERSION,
    id,
    name,
    author,
    description,
    createdAt: String(value.createdAt),
    updatedAt: String(value.updatedAt),
    palettes: { light: palettes.light, dark: palettes.dark },
    overrides,
    appearance,
    sidebarBrandLayout,
    visualAssetOverrides,
    copyOverrides,
    textOverrides: decodedTextOverrides,
    assets: decodedAssets,
  }
}

export function makeSkinId(prefix = 'skin'): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}-${random.toLowerCase()}`
}

export function cloneManifest(manifest: SkinManifestV1, name = `${manifest.name} copy`): SkinManifestV1 {
  const now = new Date().toISOString()
  const copy = structuredClone({ ...manifest, id: makeSkinId(), name, createdAt: now, updatedAt: now, assets: [] })
  copy.appearance.wallpaperAssetId = null
  copy.appearance.componentMedia = []
  copy.sidebarBrandLayout = 'split'
  copy.visualAssetOverrides = {}
  if (copy.appearance.uiFont.kind === 'asset') copy.appearance.uiFont = { kind: 'system', assetId: null, family: 'sans-serif' }
  if (copy.appearance.codeFont.kind === 'asset') copy.appearance.codeFont = { kind: 'system', assetId: null, family: 'monospace' }
  return copy
}
