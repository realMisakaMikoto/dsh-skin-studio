#!/usr/bin/env node
/**
 * Check that the desktop profile actually mounts this plugin.
 *
 * Being present in the profile's `dependencies` is not enough: DSH's launcher
 * composes the plugin tree from `dsh.profile.bundles` only, so a package that
 * is installed but absent from that list loads nothing at all. This script
 * reads the profile manifest and reports both halves of the install, plus
 * whether the linked directory is really this package.
 *
 * Usage:
 *   node scripts/check-install.mjs                 # default desktop profile
 *   node scripts/check-install.mjs --profile <dir> # any profile directory
 *   node scripts/check-install.mjs --quiet         # exit code only
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))

const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet')
const profileIndex = argv.indexOf('--profile')
const profileDir =
  profileIndex >= 0
    ? resolve(argv[profileIndex + 1])
    : resolve(process.env.DSH_PROFILE_DIR ?? join(process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? '', '.dsh'), 'profiles', 'desktop'))

const failures = []
const notes = []

/** Report one failed assertion. */
function fail(message) {
  failures.push(message)
}

/** Report one observation that does not fail the run. */
function note(message) {
  notes.push(message)
}

if (!existsSync(profileDir)) {
  fail(`no profile directory at ${profileDir} — pass --profile <dir> or set DSH_PROFILE_DIR`)
} else {
  const manifestPath = join(profileDir, 'package.json')
  if (!existsSync(manifestPath)) {
    fail(`no profile manifest at ${manifestPath}`)
  } else {
    let profile = null
    try {
      profile = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch (error) {
      fail(`profile manifest is not valid JSON: ${error.message}`)
    }

    if (profile !== null) {
      const spec = profile.dependencies?.[manifest.name]
      const bundles = profile.dsh?.profile?.bundles ?? []

      if (spec === undefined) {
        fail(`${manifest.name} is not a dependency of the profile — install it (settings → 插件, or 'pnpm install') first`)
      } else {
        note(`dependencies: ${manifest.name} = ${spec}`)
        const target = spec.startsWith('link:')
          ? resolve(spec.slice('link:'.length))
          : spec.startsWith('file:')
            ? resolve(profileDir, spec.slice('file:'.length))
            : null
        if (target === null) {
          note(`spec is "${spec}"; bundle checks below assume the profile's node_modules copy`)
        } else if (!existsSync(target)) {
          fail(`the "${spec}" target does not exist: ${target}`)
        } else if (resolve(target) !== packageRoot) {
          note(`the dependency resolves to ${target}, not this checkout (${packageRoot}) — checking that copy's manifest instead`)
          const linked = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
          if (linked.name !== manifest.name) fail(`${target}/package.json is "${linked.name}", expected "${manifest.name}"`)
        }
      }

      if (!bundles.includes(manifest.name)) {
        fail(
          `${manifest.name} is not in dsh.profile.bundles — the profile would compose without it, so nothing would appear in 设置 → 通用设置.\n` +
            `      add it: "bundles": [${[...bundles, manifest.name].map((name) => `"${name}"`).join(', ')}]`,
        )
      } else {
        note(`bundles: enabled at position ${bundles.indexOf(manifest.name) + 1} of ${bundles.length}`)
      }

      const patchPath = join(profileDir, 'cordis.patch.yml')
      if (!existsSync(patchPath)) {
        note('no profile cordis.patch.yml: the user layer is empty, so nothing overrides this bundle')
      } else if (/\binsert:\s*\n(?:\s+- id:[^\n]*\n)?\s*name:\s*['"]?dsh-desktop-skin-studio['"]?/.test(readFileSync(patchPath, 'utf8'))) {
        note('the profile patch layer also inserts a dsh-desktop-skin-studio row: two rows with one id are a loader conflict')
      }

      const rootPath = join(profileDir, 'cordis.yml')
      if (!existsSync(rootPath)) {
        note('no cordis.yml root: dsh writes the empty (`[]`) root template on the next boot')
      } else {
        // The template is always the empty list: the tree is composed from the
        // bundles' patches and the profile patch layer over that empty root. A
        // root that is neither a list nor the template is a hand-edited config
        // that replaces the composition — the one shape that silently unmounts
        // every bundle. (A populated list, as written by a config dump, is
        // reported instead of failed: several tools print the composed tree.)
        const root = readFileSync(rootPath, 'utf8').replace(/#[^\n]*/g, '').trim()
        if (!root.startsWith('[') && !/^-\s/.test(root)) {
          fail(`the profile's cordis.yml root is not a list (${JSON.stringify(root.slice(0, 40))}): the tree is composed from bundles + patches, so a mapping root replaces what mounts`)
        } else if (root !== '[]' && root !== '[ ]') {
          note(`cordis.yml contains a populated list (${root.length} chars); the desktop plugin manager writes this diagnostic dump after a bundle toggle, while profile composition reads bundles and patches`)
        } else {
          note('cordis.yml root is the empty template, as composed profiles require')
        }
      }

      // The copy the launcher will actually resolve: profile node_modules first.
      const installedDir = join(profileDir, 'node_modules', manifest.name)
      if (!existsSync(installedDir)) {
        fail(`the profile has no node_modules/${manifest.name} — run 'pnpm install' in ${profileDir}`)
      } else {
        const stats = statSync(installedDir)
        const installedManifest = join(installedDir, 'package.json')
        if (!existsSync(installedManifest)) {
          fail(`node_modules/${manifest.name} has no package.json (a broken link?)`)
        } else {
          const installed = JSON.parse(readFileSync(installedManifest, 'utf8'))
          if (installed.name !== manifest.name) fail(`node_modules/${manifest.name}/package.json is "${installed.name}"`)
          if (installed.dsh?.bundle?.patch === undefined) fail(`node_modules/${manifest.name} declares no dsh.bundle.patch — the launcher would skip it`)
          if (installed.dsh?.client?.platform !== 'web') fail(`node_modules/${manifest.name} declares no dsh.client.platform "web" — no client bundle would be served`)
          note(`node_modules/${manifest.name}: ${installed.version}${stats.isSymbolicLink?.() ? ' (link)' : ''}`)
        }
      }

      const upstream = profile.dependencies?.['dsh-skin-studio']
      if (upstream !== undefined && bundles.includes('dsh-skin-studio')) {
        note('dsh-skin-studio is also enabled: both plugins write the same --dsw-* tokens, so only enable one skin at a time')
      }
    }
  }
}

if (!quiet) {
  console.log(`check-install: profile ${profileDir}`)
  for (const message of notes) console.log(`  ${message}`)
}

if (failures.length > 0) {
  console.error('check-install: FAILED')
  for (const message of failures) console.error(`  - ${message}`)
  console.error('  the plugin is not fully mounted by this profile')
  process.exit(1)
}

if (!quiet) console.log('check-install: OK — the profile declares this package as an active bundle')
