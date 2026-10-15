// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageId = '@local/dsh-desktop-skin-studio'

function fixture(run: (profile: string, resources: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'dskin-installer-test-'))
  try {
    const profile = join(directory, 'profile')
    const resources = join(directory, 'resources')
    mkdirSync(profile)
    mkdirSync(join(resources, 'runtime/pnpm/bin'), { recursive: true })
    writeFileSync(join(profile, 'package.json'), JSON.stringify({ dependencies: { existing: 'file:../existing' }, dsh: { profile: { bundles: ['existing'] } } }))
    writeFileSync(join(profile, 'cordis.patch.yml'), '- id: existing\n  config: { enabled: true }\n')
    writeFileSync(join(resources, 'runtime/pnpm/bin/pnpm.mjs'), [
      "import{readFileSync,writeFileSync}from'node:fs';import{join}from'node:path';",
      "const a=process.argv.slice(2),p=join(a[a.indexOf('--dir')+1],'package.json'),j=JSON.parse(readFileSync(p,'utf8'));",
      `j.dependencies[${JSON.stringify(packageId)}]=a.find(x=>x.startsWith('link:'));writeFileSync(p,JSON.stringify(j));`,
    ].join('\n'))
    run(profile, resources)
  } finally {
    const target = resolve(directory)
    if (!target.startsWith(resolve(tmpdir()) + sep) || !target.includes('dskin-installer-test-')) throw new Error('Unsafe fixture cleanup')
    rmSync(target, { recursive: true, force: true })
  }
}

describe('public desktop installer', () => {
  it('dry-runs without writing profile files or backups', () => fixture((profile, resources) => {
    const path = join(profile, 'package.json')
    const before = readFileSync(path, 'utf8')
    const result = spawnSync(process.execPath, [join(root, 'scripts/install-desktop.mjs'), '--profile', profile, '--resources', resources, '--dry-run'], { encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).dryRun).toBe(true)
    expect(readFileSync(path, 'utf8')).toBe(before)
    expect(readdirSync(profile)).toEqual(['cordis.patch.yml', 'package.json'])
  }))

  it('backs up, installs and enables idempotently while preserving other plugins', () => fixture((profile, resources) => {
    const original = readFileSync(join(profile, 'package.json'), 'utf8')
    const patch = readFileSync(join(profile, 'cordis.patch.yml'), 'utf8')
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = spawnSync(process.execPath, [join(root, 'scripts/install-desktop.mjs'), '--profile', profile, '--resources', resources], { encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
    }
    const installed = JSON.parse(readFileSync(join(profile, 'package.json'), 'utf8'))
    expect(installed.dependencies.existing).toBe('file:../existing')
    expect(installed.dependencies[packageId]).toContain('link:')
    expect(installed.dsh.profile.bundles).toEqual(['existing', packageId])
    expect(readFileSync(join(profile, 'cordis.patch.yml'), 'utf8')).toBe(patch)
    const backups = join(profile, '.skin-studio-backups')
    expect(readdirSync(backups)).toHaveLength(2)
    expect(readFileSync(join(backups, readdirSync(backups)[0]!, 'package.json'), 'utf8')).toBe(original)
  }))
})
