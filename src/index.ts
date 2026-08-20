export {
  MAX_FONT_BYTES, MAX_PACKAGE_BYTES, MAX_TEXT_OVERRIDE_PATH_DEPTH, MAX_TEXT_OVERRIDE_RULES, MAX_TEXT_OVERRIDE_VALUE_LENGTH, MAX_VIDEO_BYTES, MAX_VISUAL_ASSET_BYTES, MAX_WALLPAPER_BYTES, MODES, PALETTE_ROLES, SIDEBAR_BRAND_LAYOUTS,
  SKIN_FORMAT, SKIN_FORMAT_VERSION, decodeSkinManifest, migrateSkinManifest, isHexColor, isSafeTokenName,
  type AdvancedTokenOverrides, type AssetKind, type FontReference, type ModeAppearance,
  type CopyOverrides, type LocalizedCopyOverride, type PaletteRole, type SemanticPalette, type SkinAppearance, type SkinAssetDescriptor,
  type SkinManifest, type SkinManifestV1, type SkinManifestV2, type SkinManifestV3, type SkinManifestV4, type SkinManifestV5,
  type SidebarBrandLayout, type SkinMode, type TextOverrideRule, type TextOverrideTarget, type TextTargetPathSegment, type ThemeTokenModes, type VisualAssetOverrides,
} from './model.ts'
export {
  COPY_SLOT_IDS, COPY_SLOTS, EDITABLE_COPY_SLOTS, SKIN_LOCALES, VISUAL_ASSET_SLOT_IDS, VISUAL_ASSET_SLOTS,
  type CopySlotDefinition, type CopySlotId, type SkinLocale,
  type VisualAssetSlotDefinition, type VisualAssetSlotId,
} from './skin-slots.ts'
export { contrastRatio, generateCounterpart, inspectContrast, relativeLuminance, type ContrastIssue } from './color.ts'
export { buildThemeTokenOverrides } from './tokens.ts'
export { exportSkinPackage, importSkinPackage, SkinPackageError, type ImportSkinPackageOptions } from './package-format.ts'

/** Browser-only plugin; the Host half exists so DSH can mount its client bundle. */
export function apply(_ctx: unknown): void {}
