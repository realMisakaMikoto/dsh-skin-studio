// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('desktop install diagnostics', () => {
  it('accepts the YAML list dumped by the native plugin manager and rejects mapping roots', () => {
    const profile = mkdtempSync(join(tmpdir(), 'dskin-install-test-'))
    try {
      mkdirSync(join(profile, 'node_modules/@local'), { recursive: true })
      symlinkSync(root, join(profile, 'node_modules/@local/dsh-desktop-skin-studio'), 'junction')
      writeFileSync(join(profile, 'package.json'), JSON.stringify({
        dependencies: { '@local/dsh-desktop-skin-studio': `link:${root}` },
        dsh: { profile: { bundles: ['@local/dsh-desktop-skin-studio'] } },
      }))
      const check = () => spawnSync(process.execPath, [join(root, 'scripts/check-install.mjs'), '--profile', profile], { encoding: 'utf8' })
      writeFileSync(join(profile, 'cordis.yml'), "- id: existing-plugin\n  name: '@local/existing-plugin'\n")
      expect(check().status).toBe(0)
      writeFileSync(join(profile, 'cordis.yml'), 'invalid: mapping\n')
      expect(check().status).toBe(1)
    } finally {
      const target = resolve(profile)
      if (!target.startsWith(resolve(tmpdir()) + sep) || !target.includes('dskin-install-test-')) throw new Error('Unsafe fixture cleanup path')
      rmSync(target, { recursive: true, force: true })
    }
  })
})
