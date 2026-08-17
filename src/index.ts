export {
  MAX_FONT_BYTES, MAX_PACKAGE_BYTES, MAX_VIDEO_BYTES, MAX_WALLPAPER_BYTES, MODES, PALETTE_ROLES,
  SKIN_FORMAT, SKIN_FORMAT_VERSION, decodeSkinManifest, migrateSkinManifest, isHexColor, isSafeTokenName,
  type AdvancedTokenOverrides, type AssetKind, type FontReference, type ModeAppearance,
  type PaletteRole, type SemanticPalette, type SkinAppearance, type SkinAssetDescriptor,
  type SkinManifest, type SkinManifestV1, type SkinManifestV2, type SkinMode, type ThemeTokenModes,
} from './model.ts'
export { contrastRatio, generateCounterpart, inspectContrast, relativeLuminance, type ContrastIssue } from './color.ts'
export { buildThemeTokenOverrides } from './tokens.ts'
export { exportSkinPackage, importSkinPackage, SkinPackageError, type ImportSkinPackageOptions } from './package-format.ts'

/** Browser-only plugin; the Host half exists so DSH can mount its client bundle. */
export function apply(_ctx: unknown): void {}
