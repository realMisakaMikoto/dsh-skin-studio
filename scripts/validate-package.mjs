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
const required = [
  'LICENSE', 'README.md', 'README.zh.md', 'cordis.patch.yml', 'package.json',
  'lib/index.js', 'lib/index.d.ts', 'lib/client.js', 'lib/client.js.map', 'lib/client.d.ts',
  'docs/screenshots/skin-library.png', 'docs/screenshots/skin-editor.png', 'docs/screenshots/skin-editor-mobile.png',
  'docs/skin-format-v4.md',
]

for (const path of required) {
  if (!files.has(path)) throw new Error(`Missing package file: ${path}`)
}

const allowed = /^(?:LICENSE|README(?:\.zh)?\.md|cordis\.patch\.yml|package\.json|lib\/(?:index|client)\.(?:js|d\.ts|js\.map)|docs\/(?:skin-format-v4\.md|screenshots\/skin-(?:library|editor|editor-mobile)\.png))$/
for (const path of files) {
  if (!allowed.test(path)) throw new Error(`Unexpected package file: ${path}`)
}

process.stdout.write(`Package contents verified: ${files.size} files\n`)
