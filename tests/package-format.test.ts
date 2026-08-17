// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { createBlankSkin } from '../src/presets.ts'
import { describeAsset, exportSkinPackage, importSkinPackage, sniffMime } from '../src/package-format.ts'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const mp4 = new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0])
const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81])

describe('.dshskin packages', () => {
  it('round-trips a manifest and its binary asset', async () => {
    const skin = createBlankSkin('Portable')
    const blob = new Blob([png], { type: 'image/png' })
    const descriptor = await describeAsset('wallpaper', 'wallpaper', blob)
    skin.assets = [descriptor]
    skin.appearance.wallpaperAssetId = descriptor.id
    const exported = await exportSkinPackage(skin, new Map([[descriptor.id, blob]]))
    const imported = await importSkinPackage(exported)
    expect(imported.manifest.name).toBe('Portable')
    expect(imported.assets.get('wallpaper')?.size).toBe(png.byteLength)
  })

  it('accepts MP4 and WebM background signatures', async () => {
    expect(sniffMime(mp4)).toBe('video/mp4')
    expect(sniffMime(webm)).toBe('video/webm')
    const skin = createBlankSkin('Motion')
    const blob = new Blob([mp4], { type: 'video/mp4' })
    const descriptor = await describeAsset('motion', 'wallpaper', blob)
    skin.assets = [descriptor]
    skin.appearance.wallpaperAssetId = descriptor.id
    const imported = await importSkinPackage(await exportSkinPackage(skin, new Map([[descriptor.id, blob]])))
    expect(imported.manifest.assets[0]?.mimeType).toBe('video/mp4')
    expect(imported.assets.get('motion')?.type).toBe('video/mp4')
  })

  it('round-trips media assigned to an arbitrary component type', async () => {
    const skin = createBlankSkin('Components')
    const blob = new Blob([png], { type: 'image/png' })
    const descriptor = await describeAsset('input-media', 'component-media', blob)
    skin.assets = [descriptor]
    skin.appearance.componentMedia = [{
      id: 'component-input', name: 'composer',
      target: { tagName: 'div', role: null, classNames: ['abc_composer'] },
      assetId: descriptor.id, blurPx: 2,
      light: { opacity: 0.8, scrimOpacity: 0.1 }, dark: { opacity: 0.7, scrimOpacity: 0.2 },
    }]
    const imported = await importSkinPackage(await exportSkinPackage(skin, new Map([[descriptor.id, blob]])))
    expect(imported.manifest.appearance.componentMedia[0]?.target.classNames).toEqual(['abc_composer'])
    expect(imported.assets.get('input-media')?.type).toBe('image/png')
  })

  it('round-trips semantic visual assets and localized copy overrides', async () => {
    const skin = createBlankSkin('Semantic slots')
    const blob = new Blob([png], { type: 'image/png' })
    const descriptor = await describeAsset('hero-mark', 'visual-asset', blob)
    skin.assets = [descriptor]
    skin.visualAssetOverrides['hero-whale-logo'] = descriptor.id
    skin.copyOverrides['welcome.title'] = { zh: '今天一起写代码', en: 'Let us build today' }
    const imported = await importSkinPackage(await exportSkinPackage(skin, new Map([[descriptor.id, blob]])))
    expect(imported.manifest.visualAssetOverrides['hero-whale-logo']).toBe('hero-mark')
    expect(imported.manifest.copyOverrides['welcome.title']?.en).toBe('Let us build today')
    expect(imported.assets.get('hero-mark')?.type).toBe('image/png')
  })

  it('rejects additional script files', async () => {
    const skin = createBlankSkin('Unsafe')
    const file = new Blob([zipSync({
      'manifest.json': strToU8(JSON.stringify(skin)),
      'assets/run.js': strToU8('alert(1)'),
    })])
    await expect(importSkinPackage(file)).rejects.toMatchObject({ code: 'invalid-asset' })
  })

  it('rejects hash mismatches and tokens outside the runtime allowlist', async () => {
    const blob = new Blob([png], { type: 'image/png' })
    const skin = createBlankSkin('Tampered')
    const descriptor = await describeAsset('wallpaper', 'wallpaper', blob)
    descriptor.sha256 = '0'.repeat(64)
    skin.assets = [descriptor]
    skin.appearance.wallpaperAssetId = descriptor.id
    const tampered = new Blob([zipSync({
      'manifest.json': strToU8(JSON.stringify(skin)),
      [descriptor.path]: png,
    })])
    await expect(importSkinPackage(tampered)).rejects.toMatchObject({ code: 'hash-mismatch' })

    const unknownToken = createBlankSkin('Unknown token')
    unknownToken.overrides['--dsw-alias-not-from-runtime'] = { light: '#112233', dark: '#ddeeff' }
    const tokenPackage = new Blob([zipSync({ 'manifest.json': strToU8(JSON.stringify(unknownToken)) })])
    await expect(importSkinPackage(tokenPackage, { allowedTokenNames: new Set(['--dsw-alias-bg-base']) }))
      .rejects.toMatchObject({ code: 'invalid-manifest' })
  })

  it('rejects malformed ZIP data', async () => {
    await expect(importSkinPackage(new Blob([strToU8('not a zip')]))).rejects.toMatchObject({ code: 'invalid-zip' })
  })
})
