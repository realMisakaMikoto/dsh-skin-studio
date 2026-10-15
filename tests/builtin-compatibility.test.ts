// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BUNDLED_SKIN_PACKAGES, loadBundledSkinPackage } from '../src/builtin-skins.ts'
import { BUILTIN_SKINS } from '../src/presets.ts'
import { decodeSkinManifest } from '../src/model.ts'
import { exportSkinPackage, importSkinPackage, sha256 } from '../src/package-format.ts'

describe('pinned upstream skin compatibility', () => {
  it('provides seventeen complete presets with all embedded resources', async () => {
    expect(BUILTIN_SKINS.length + BUNDLED_SKIN_PACKAGES.length).toBe(17)
    for (const entry of BUNDLED_SKIN_PACKAGES) {
      const original = await loadBundledSkinPackage(entry)
      expect(original.manifest.id).toBe(entry.id)
      expect(original.manifest.appearance.componentMedia).toHaveLength(8)
      expect(original.assets.size).toBe(13)
      expect(original.manifest.appearance.uiFont.family).toContain('"Segoe UI"')
      expect(original.manifest.appearance.componentMedia[0]?.light).toHaveProperty('opacity')
      const exported = await exportSkinPackage(original.manifest, original.assets)
      const roundtrip = await importSkinPackage(exported)
      expect(decodeSkinManifest(roundtrip.manifest)).toEqual(original.manifest)
      for (const asset of original.manifest.assets) {
        const bytes = new Uint8Array(await roundtrip.assets.get(asset.id)!.arrayBuffer())
        expect(await sha256(bytes)).toBe(asset.sha256)
      }
    }
  }, 30000)
})
