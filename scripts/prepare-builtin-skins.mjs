import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { importSkinPackage } from '../lib/index.js'

const RELEASE_TIMESTAMP = '2026-08-20T06:30:00.000Z'
const EXPECTED = [
  ['ai', '\u5bae\u4e0b\u611b'],
  ['ayumu', '\u4e0a\u539f\u6b69\u5922'],
  ['emma', '\u30a8\u30de\u30fb\u30f4\u30a7\u30eb\u30c7'],
  ['group', '\u8679\u30f6\u54b2\u5b66\u5712\u30b9\u30af\u30fc\u30eb\u30a2\u30a4\u30c9\u30eb\u540c\u597d\u4f1a'],
  ['kanata', '\u8fd1\u6c5f\u5f7c\u65b9'],
  ['karin', '\u671d\u9999\u679c\u6797'],
  ['kasumi', '\u4e2d\u9808\u304b\u3059\u307f'],
  ['lanzhu', '\u9418\u5d50\u73e0'],
  ['mia', '\u30df\u30a2\u30fb\u30c6\u30a4\u30e9\u30fc'],
  ['rina', '\u5929\u738b\u5bfa\u7483\u5948'],
  ['setsuna', '\u512a\u6728\u305b\u3064\u83dc'],
  ['shioriko', '\u4e09\u8239\u681e\u5b50'],
  ['shizuku', '\u685c\u5742\u3057\u305a\u304f'],
  ['yu', '\u9ad8\u54b2\u4f91'],
]
const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'font/woff2': 'woff2',
}

function argument(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function convertImage(bytes, mimeType, options) {
  const work = mkdtempSync(join(tmpdir(), 'dsh-builtin-image-'))
  try {
    const input = join(work, `input.${EXTENSIONS[mimeType]}`)
    const output = join(work, 'output.webp')
    writeFileSync(input, bytes)
    const args = [input, '-strip']
    if (options.resize !== undefined) args.push('-resize', options.resize)
    args.push('-quality', String(options.quality), output)
    execFileSync('magick', args, { stdio: 'pipe' })
    return new Uint8Array(readFileSync(output))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

const sourceDirectory = argument('--source')
if (sourceDirectory === undefined) throw new Error('Usage: node scripts/prepare-builtin-skins.mjs --source <directory>')
const sourceRoot = resolve(sourceDirectory)
const catalog = []
const reports = []
for (const [slug, expectedName] of EXPECTED) {
  const inputPath = join(sourceRoot, `${slug}.dshskin`)
  const imported = await importSkinPackage(new Blob([readFileSync(inputPath)], { type: 'application/zip' }))
  if (imported.manifest.name !== expectedName) throw new Error(`Unexpected skin name in ${basename(inputPath)}`)
  if (imported.manifest.name.includes('\u81ea\u7528')) throw new Error(`Private skin cannot be bundled: ${imported.manifest.name}`)

  const files = unzipSync(new Uint8Array(readFileSync(inputPath)))
  const manifest = imported.manifest
  manifest.author = 'dsh-skin-studio'
  manifest.createdAt = RELEASE_TIMESTAMP
  manifest.updatedAt = RELEASE_TIMESTAMP
  for (const rule of manifest.appearance.componentMedia) {
    if (rule.target.classNames.includes('hHd-Xa_root')) rule.target.classNames = ['hHd-Xa_root']
  }
  const sidebarMarkId = manifest.visualAssetOverrides['sidebar-brand-mark']
  let sourceBytes = 0
  let outputBytes = 0

  for (const descriptor of manifest.assets) {
    const originalPath = descriptor.path
    const original = files[originalPath]
    if (original === undefined) throw new Error(`Missing ${originalPath}`)
    sourceBytes += original.byteLength
    let optimized = original
    let mimeType = descriptor.mimeType

    if (descriptor.kind === 'wallpaper' && descriptor.mimeType.startsWith('image/')) {
      const candidate = convertImage(original, descriptor.mimeType, { quality: 84 })
      if (candidate.byteLength < original.byteLength) {
        optimized = candidate
        mimeType = 'image/webp'
      }
    } else if (descriptor.id === sidebarMarkId && descriptor.mimeType.startsWith('image/')) {
      const candidate = convertImage(original, descriptor.mimeType, { quality: 90, resize: '192x192>' })
      if (candidate.byteLength < original.byteLength) {
        optimized = candidate
        mimeType = 'image/webp'
      }
    }

    const nextPath = `assets/${descriptor.id}.${EXTENSIONS[mimeType]}`
    if (nextPath !== originalPath) delete files[originalPath]
    files[nextPath] = optimized
    descriptor.path = nextPath
    descriptor.mimeType = mimeType
    descriptor.size = optimized.byteLength
    descriptor.sha256 = sha256(optimized)
    outputBytes += optimized.byteLength
  }

  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  const packageBytes = zipSync(files, { level: 0 })
  const verified = await importSkinPackage(new Blob([packageBytes], { type: 'application/zip' }))
  catalog.push({ slug, id: verified.manifest.id, name: verified.manifest.name, updatedAt: verified.manifest.updatedAt, base64: Buffer.from(packageBytes).toString('base64') })
  reports.push({ slug, name: verified.manifest.name, sourceBytes, outputBytes, packageBytes: packageBytes.byteLength })
}

const entries = catalog.map(entry => `  { id: ${JSON.stringify(entry.id)}, name: ${JSON.stringify(entry.name)}, updatedAt: ${JSON.stringify(entry.updatedAt)}, base64: ${JSON.stringify(entry.base64)} },`).join('\n')
writeFileSync('src/builtin-skins.generated.ts', `export interface GeneratedBundledSkinPackage { id: string; name: string; updatedAt: string; base64: string }\n\nexport const BUNDLED_SKIN_PACKAGES: readonly GeneratedBundledSkinPackage[] = [\n${entries}\n]\n`, 'utf8')

process.stdout.write(JSON.stringify({ count: reports.length, sourceBytes: reports.reduce((sum, report) => sum + report.sourceBytes, 0), outputBytes: reports.reduce((sum, report) => sum + report.outputBytes, 0), reports }, null, 2))
