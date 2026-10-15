#!/usr/bin/env node
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({ options: { source: { type: 'string' }, output: { type: 'string' } } })
const source = resolve(values.source ?? root)
const output = resolve(values.output ?? join(root, 'output/releases'))
const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
const localId = '@local/dsh-desktop-skin-studio'
const publicId = 'dsh-skin-studio'
if (manifest.name !== localId) throw new Error('Expected the original desktop package identity.')
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Expected a stable release version.')
if (!process.env.npm_execpath) throw new Error('Run this script through npm run release:pack.')

const staging = mkdtempSync(join(tmpdir(), 'dskin-public-release-'))
const textExtensions = new Set(['.js', '.mjs', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml', '.cmd'])
function rewrite(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) rewrite(path)
    else if (textExtensions.has(extname(entry.name))) {
      const original = readFileSync(path, 'utf8')
      const updated = original.replaceAll(localId, publicId)
      if (updated !== original) writeFileSync(path, updated)
    }
  }
}
function run(args, cwd, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Command failed: ${args[0]}`)
  return result.stdout
}
try {
  for (const entry of manifest.files) {
    const path = resolve(source, entry)
    if (!path.startsWith(source + sep)) throw new Error(`Package entry escapes source: ${entry}`)
    cpSync(path, join(staging, entry), { recursive: true })
  }
  // Use current distribution instructions, while taking all runtime code from the release tag.
  for (const filename of ['README.md', 'README.zh.md']) cpSync(join(root, filename), join(staging, filename))
  rewrite(staging)
  manifest.name = publicId
  delete manifest.private
  manifest.publishConfig = { access: 'public', provenance: true }
  writeFileSync(join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  process.stdout.write(run([join(staging, 'scripts/validate-package.mjs')], staging))
  process.stdout.write(run([join(staging, 'scripts/verify-client-boot.mjs')], staging, {
    ...process.env, NODE_PATH: join(source, 'node_modules'),
  }))
  mkdirSync(output, { recursive: true })
  const packed = JSON.parse(run([process.env.npm_execpath, 'pack', '--ignore-scripts', '--json', '--pack-destination', output], staging))[0]
  if (packed.name !== publicId || packed.version !== manifest.version) throw new Error('Packed identity mismatch.')
  console.log(JSON.stringify({ name: packed.name, version: packed.version, filename: packed.filename, integrity: packed.integrity, files: packed.files.length }, null, 2))
} finally {
  const target = resolve(staging)
  if (!target.startsWith(resolve(tmpdir()) + sep) || !target.includes('dskin-public-release-')) throw new Error('Unsafe staging cleanup.')
  rmSync(target, { recursive: true, force: true })
}
