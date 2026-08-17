import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate/browser'
import {
  MAX_PACKAGE_BYTES, MAX_WALLPAPER_BYTES, MAX_VIDEO_BYTES, MAX_FONT_BYTES, MAX_VISUAL_ASSET_BYTES, decodeSkinManifest,
  type AssetKind, type SkinAssetDescriptor, type SkinManifestV1,
} from './model.ts'

export class SkinPackageError extends Error {
  constructor(public readonly code: 'too-large' | 'invalid-zip' | 'invalid-manifest' | 'missing-asset' | 'invalid-asset' | 'hash-mismatch') {
    super(code)
    this.name = 'SkinPackageError'
  }
}

const MIME_EXTENSIONS: Record<SkinAssetDescriptor['mimeType'], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'font/woff2': 'woff2',
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes))
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export function sniffMime(bytes: Uint8Array): SkinAssetDescriptor['mimeType'] | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 12 && strFromU8(bytes.subarray(0, 4)) === 'RIFF' && strFromU8(bytes.subarray(8, 12)) === 'WEBP') return 'image/webp'
  if (bytes.length >= 12 && strFromU8(bytes.subarray(4, 8)) === 'ftyp') return 'video/mp4'
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm'
  if (bytes.length >= 4 && strFromU8(bytes.subarray(0, 4)) === 'wOF2') return 'font/woff2'
  return undefined
}

export async function describeAsset(id: string, kind: AssetKind, blob: Blob): Promise<SkinAssetDescriptor> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const mimeType = sniffMime(bytes)
  if (mimeType === undefined) throw new SkinPackageError('invalid-asset')
  const imageMime = mimeType.startsWith('image/')
  const videoMime = mimeType.startsWith('video/')
  const mediaKind = kind === 'wallpaper' || kind === 'component-media'
  if (mediaKind && !imageMime && !videoMime) throw new SkinPackageError('invalid-asset')
  if (kind === 'visual-asset' && !imageMime) throw new SkinPackageError('invalid-asset')
  if ((kind === 'ui-font' || kind === 'code-font') && mimeType !== 'font/woff2') throw new SkinPackageError('invalid-asset')
  const limit = kind === 'visual-asset' ? MAX_VISUAL_ASSET_BYTES : videoMime ? MAX_VIDEO_BYTES : mediaKind ? MAX_WALLPAPER_BYTES : MAX_FONT_BYTES
  if (bytes.byteLength > limit) throw new SkinPackageError('too-large')
  return {
    id,
    path: `assets/${id}.${MIME_EXTENSIONS[mimeType]}`,
    kind,
    mimeType,
    size: bytes.byteLength,
    sha256: await sha256(bytes),
  }
}

export async function exportSkinPackage(manifest: SkinManifestV1, assets: ReadonlyMap<string, Blob>): Promise<Blob> {
  const files: Record<string, Uint8Array> = {}
  for (const descriptor of manifest.assets) {
    const blob = assets.get(descriptor.id)
    if (blob === undefined) throw new SkinPackageError('missing-asset')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.byteLength !== descriptor.size || sniffMime(bytes) !== descriptor.mimeType) throw new SkinPackageError('invalid-asset')
    if (await sha256(bytes) !== descriptor.sha256) throw new SkinPackageError('hash-mismatch')
    files[descriptor.path] = bytes
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  const zipped = zipSync(files, { level: 0 })
  if (zipped.byteLength > MAX_PACKAGE_BYTES) throw new SkinPackageError('too-large')
  return new Blob([toArrayBuffer(zipped)], { type: 'application/zip' })
}

export interface ImportedSkinPackage {
  manifest: SkinManifestV1
  assets: Map<string, Blob>
}

export interface ImportSkinPackageOptions {
  allowedTokenNames?: ReadonlySet<string>
}

export async function importSkinPackage(file: Blob, options: ImportSkinPackageOptions = {}): Promise<ImportedSkinPackage> {
  if (file.size > MAX_PACKAGE_BYTES) throw new SkinPackageError('too-large')
  let files: Record<string, Uint8Array>
  try {
    let expandedBytes = 0
    files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
      if (entry.name !== 'manifest.json' && !/^assets\/[a-z0-9._-]+$/i.test(entry.name)) throw new SkinPackageError('invalid-asset')
      expandedBytes += entry.originalSize
      if (expandedBytes > MAX_PACKAGE_BYTES) throw new SkinPackageError('too-large')
      return true
    } })
  } catch (error) {
    if (error instanceof SkinPackageError) throw error
    throw new SkinPackageError('invalid-zip')
  }
  const manifestBytes = files['manifest.json']
  if (manifestBytes === undefined) throw new SkinPackageError('invalid-manifest')
  let parsed: unknown
  try {
    parsed = JSON.parse(strFromU8(manifestBytes))
  } catch {
    throw new SkinPackageError('invalid-manifest')
  }
  const manifest = decodeSkinManifest(parsed)
  if (manifest === undefined) throw new SkinPackageError('invalid-manifest')
  if (options.allowedTokenNames !== undefined && Object.keys(manifest.overrides).some(name => !options.allowedTokenNames!.has(name))) {
    throw new SkinPackageError('invalid-manifest')
  }
  const assets = new Map<string, Blob>()
  for (const descriptor of manifest.assets) {
    const bytes = files[descriptor.path]
    if (bytes === undefined) throw new SkinPackageError('missing-asset')
    if (bytes.byteLength !== descriptor.size || sniffMime(bytes) !== descriptor.mimeType) throw new SkinPackageError('invalid-asset')
    if (await sha256(bytes) !== descriptor.sha256) throw new SkinPackageError('hash-mismatch')
    assets.set(descriptor.id, new Blob([toArrayBuffer(bytes)], { type: descriptor.mimeType }))
  }
  const allowed = new Set(['manifest.json', ...manifest.assets.map(asset => asset.path)])
  if (Object.keys(files).some(path => !allowed.has(path) || path.includes('..') || path.startsWith('/'))) {
    throw new SkinPackageError('invalid-asset')
  }
  return { manifest, assets }
}
