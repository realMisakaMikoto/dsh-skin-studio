import { spawnSync } from 'node:child_process'

const command = process.platform === 'win32' ? process.env.ComSpec : 'npm'
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npm pack --dry-run --json --ignore-scripts']
  : ['pack', '--dry-run', '--json', '--ignore-scripts']
const result = spawnSync(command, args, {
  encoding: 'utf8',
})

if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const report = JSON.parse(result.stdout)[0]
const files = new Set(report.files.map(file => file.path))
const skinScreenshots = [
  'ai', 'ayumu', 'emma', 'kanata', 'karin', 'kasumi', 'lanzhu',
  'mia', 'rina', 'setsuna', 'shioriko', 'shizuku', 'yu',
].map(name => `docs/screenshots/skins/${name}.webp`)
const required = [
  'LICENSE', 'README.md', 'README.zh.md', 'THIRD_PARTY_ASSETS.md', 'cordis.patch.yml', 'package.json',
  'lib/index.js', 'lib/index.d.ts', 'lib/client.js', 'lib/client.js.map', 'lib/client.d.ts',
  'docs/skin-format-v4.md', 'docs/skin-format-v5.md', ...skinScreenshots,
]

for (const path of required) {
  if (!files.has(path)) throw new Error(`Missing package file: ${path}`)
}

const allowed = /^(?:LICENSE|README(?:\.zh)?\.md|THIRD_PARTY_ASSETS\.md|cordis\.patch\.yml|package\.json|lib\/(?:index|client)\.(?:js|d\.ts|js\.map)|docs\/(?:skin-format-v[45]\.md|screenshots\/skins\/(?:ai|ayumu|emma|kanata|karin|kasumi|lanzhu|mia|rina|setsuna|shioriko|shizuku|yu)\.webp))$/
for (const path of files) {
  if (!allowed.test(path)) throw new Error(`Unexpected package file: ${path}`)
}

process.stdout.write(`Package contents verified: ${files.size} files\n`)
