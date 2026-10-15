#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'
import { PROFILE_DIR, RESOURCES } from './lib/desktop-paths.mjs'

const { values } = parseArgs({ options: {
  profile: { type: 'string' }, resources: { type: 'string' },
  'dry-run': { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
} })

if (values.help) {
  console.log('Usage: node scripts/install-desktop.mjs [--profile DIR] [--resources DIR] [--dry-run]')
} else {
  const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const profile = resolve(values.profile ?? PROFILE_DIR)
  const manifestPath = join(profile, 'package.json')
  const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  const pnpm = join(resolve(values.resources ?? RESOURCES), 'runtime', 'pnpm', 'bin', 'pnpm.mjs')
  if (!existsSync(join(source, 'client.js'))) throw new Error('Missing client.js. Download the complete release archive or run npm run build.')
  if (!existsSync(manifestPath)) throw new Error(`Desktop profile not found: ${profile}. Start DSH desktop once, or pass --profile.`)
  const current = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!Array.isArray(current.dsh?.profile?.bundles)) throw new Error('The selected directory is not a DSH desktop profile.')
  if (!existsSync(pnpm)) throw new Error(`Bundled pnpm not found: ${pnpm}. Pass --resources with your DSH resources directory.`)
  if (values['dry-run']) {
    console.log(JSON.stringify({ package: manifest.name, version: manifest.version, source, profile, pnpm, action: 'install-and-enable', dryRun: true }, null, 2))
  } else {
    const backup = join(profile, '.skin-studio-backups', new Date().toISOString().replace(/[:.]/g, '-'))
    mkdirSync(backup, { recursive: true })
    for (const filename of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml', 'cordis.yml']) {
      const path = join(profile, filename)
      if (existsSync(path)) copyFileSync(path, join(backup, filename))
    }
    console.log(`Profile backup: ${backup}`)
    const result = spawnSync(process.execPath, [pnpm, '--dir', profile, 'add', '--workspace-root', `link:${source.replaceAll('\\', '/')}`, '--ignore-scripts'], { stdio: 'inherit' })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`Package installation failed. Original profile files are backed up at ${backup}.`)
    const updated = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const bundles = updated.dsh?.profile?.bundles
    if (!Array.isArray(bundles)) throw new Error('The profile changed during installation. Restore its backup and retry.')
    if (!bundles.includes(manifest.name)) {
      bundles.push(manifest.name)
      writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + '\n')
    }
    console.log(`Installed and enabled ${manifest.name}@${manifest.version}.`)
    console.log('Fully quit and reopen DSH desktop after saving your current work.')
    console.log('Open Settings > General > Custom skins > Open skin studio.')
    console.log('Keep this source directory: the desktop profile links to it.')
  }
}
