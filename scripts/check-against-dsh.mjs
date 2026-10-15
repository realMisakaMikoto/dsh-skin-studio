#!/usr/bin/env node
/**
 * Report theme-token, slot and anchor drift between this plugin and the
 * installed app.
 *
 * The plugin writes a fixed token vocabulary and reads a fixed set of slot keys
 * and DOM anchors. All three can move under it. Rather than discover that in
 * production, this script derives the installed app's own vocabulary from
 * `app.asar` and diffs it against the plugin's, so a DSH upgrade produces a
 * concrete list instead of a mysterious-looking skin.
 *
 * The vocabulary must be harvested from the *whole* app, not just the shell
 * stylesheet: the `--dsw-*` tokens are split across the shell's base CSS, the
 * theme package's registry, and every UI package's component styles. A check
 * that reads only the first two reports two fifths of the plugin's tokens as
 * missing when they are simply defined elsewhere.
 *
 * The check is advisory for tokens by design: `overrideTokens` accepts names the
 * registry does not know, so a name the build does not define anywhere is a
 * *degraded* effect, not a broken one. Two things do fail the run:
 *
 * - a token the plugin writes that looks like a typo of one the build defines
 * - a slot key the plugin registers into that the build does not declare
 *
 * Usage:
 *   node scripts/check-against-dsh.mjs                 # mirror from %TEMP%
 *   DSKIN_DSH_ROOT=<dir> node scripts/check-against-dsh.mjs
 *   node scripts/check-against-dsh.mjs --extract       # build the mirror first
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')

/** Scanned extensions: styles plus scripts, where inline styles also live. */
const SCANNED_EXTENSIONS = new Set(['.css', '.js', '.mjs', '.cjs'])
/** Skip anything larger than this; a minified bundle bigger than this is vendor code. */
const MAX_FILE_BYTES = 2 * 1024 * 1024
/** A token name fragment used as a prefix rather than a whole name. */
const PREFIX_ONLY = /^--ds[w]?-[a-z0-9-]*-$/

/**
 * Extract the mirror when asked, so a fresh machine can run this in one step.
 *
 * @returns {string} the DSH root to read.
 */
function resolveDshRoot() {
  if (process.argv.includes('--extract')) {
    const destination = join(tmpdir(), 'dsh-desktop-mirror')
    execFileSync(process.execPath, [join(here, 'extract-asar.mjs'), destination], { stdio: 'inherit' })
    return join(destination, 'dsh')
  }
  if (typeof process.env.DSKIN_DSH_ROOT === 'string' && process.env.DSKIN_DSH_ROOT !== '') {
    return process.env.DSKIN_DSH_ROOT
  }
  return join(tmpdir(), 'dsh-desktop-mirror', 'dsh')
}

/**
 * Walk a tree, calling back for each scannable file.
 *
 * @param {string} directory - the root to walk.
 * @param {(path: string) => void} visit - called per file.
 * @returns {void}
 */
function walk(directory, visit) {
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch (error) {
    return
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(path, visit)
      continue
    }
    if (!entry.isFile()) continue
    if (!SCANNED_EXTENSIONS.has(extname(entry.name))) continue
    try {
      if (statSync(path).size > MAX_FILE_BYTES) continue
    } catch (error) {
      continue
    }
    visit(path)
  }
}

/**
 * Harvest every `--dsw-*` token the installed app mentions.
 *
 * @param {string} dshRoot - the extracted DSH root.
 * @returns {{tokens: Set<string>, files: number, perSource: Record<string, number>}} the vocabulary.
 */
function readInstalledVocabulary(dshRoot) {
  const tokens = new Set()
  const perSource = { css: 0, script: 0 }
  let files = 0

  walk(dshRoot, (path) => {
    files += 1
    let text
    try {
      text = readFileSync(path, 'utf8')
    } catch (error) {
      return
    }
    const isCss = extname(path) === '.css'
    let added = 0
    for (const match of text.matchAll(/--ds[w]?-[a-z0-9-]+/g)) {
      if (PREFIX_ONLY.test(match[0])) continue
      if (!tokens.has(match[0])) {
        tokens.add(match[0])
        added += 1
      }
    }
    if (isCss) perSource.css += added
    else perSource.script += added
  })

  return { tokens, files, perSource }
}

/**
 * Harvest every slot key the installed client packages declare.
 *
 * A slot is declared either as a child table entry (`children: { "a.b": … }`) or
 * as a registration target (`name: "a.b"`); both shapes are collected, so a key
 * is only reported missing when neither appears.
 *
 * @param {string} dshRoot - the extracted DSH root.
 * @returns {Set<string>} declared slot keys.
 */
function readInstalledSlots(dshRoot) {
  const keys = new Set()
  const packagesRoot = join(dshRoot, 'node_modules/@deepseek-ai')
  if (!existsSync(packagesRoot)) return keys

  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('dsh-client-')) continue
    const clientPath = join(packagesRoot, entry.name, 'lib/client.js')
    if (!existsSync(clientPath)) continue
    let text
    try {
      text = readFileSync(clientPath, 'utf8')
    } catch (error) {
      continue
    }
    for (const match of text.matchAll(/"([a-z][a-z0-9]*(?:\.[a-z0-9-]+)+)"\s*:\s*\{\s*kind:/g)) keys.add(match[1])
    for (const match of text.matchAll(/name:\s*"([a-z][a-z0-9]*(?:\.[a-z0-9-]+)+)"/g)) keys.add(match[1])
  }
  return keys
}

/**
 * Harvest every **client service key** the installed web packages publish.
 *
 * This is the vocabulary `dsh.client.inject` must be written in: the page's
 * plugin entry declares those names as required services, and the loader parks
 * the entry as `pending` until each one is provided. A package name is not a
 * service, so an entry naming one never activates and the desktop aborts the
 * whole page boot with `pending (waiting for service: <package name>)`.
 *
 * Services are published as `ctx.provide("key", …)`, and the reflect form is
 * used by the packages whose provider class writes its own registry entry.
 * A few are published by construction: a Cordis `Service` subclass registers
 * itself under the name it hands to `super`, which is how `slots` reaches the
 * registry.
 *
 * @param {string} dshRoot - the extracted DSH root.
 * @returns {Set<string>} published client service keys.
 */
function readInstalledClientServices(dshRoot) {
  const keys = new Set()
  const packagesRoot = join(dshRoot, 'node_modules/@deepseek-ai')
  if (!existsSync(packagesRoot)) return keys

  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('dsh-client-')) continue
    const clientPath = join(packagesRoot, entry.name, 'lib/client.js')
    if (!existsSync(clientPath)) continue
    let text
    try {
      text = readFileSync(clientPath, 'utf8')
    } catch (error) {
      continue
    }
    for (const match of text.matchAll(/(?:ctx|rootCtx)\.(?:reflect\.)?provide\(\s*"([A-Za-z][\w.]*)"/g)) keys.add(match[1])
    for (const match of text.matchAll(/\bsuper\(ctx,\s*"([A-Za-z][\w.]*)"/g)) keys.add(match[1])
  }
  return keys
}

/**
 * Read the client services the plugin declares it needs.
 *
 * @returns {string[]} the `dsh.client.inject` list.
 */
function readPluginClientInject() {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  return Array.isArray(manifest.dsh?.client?.inject) ? manifest.dsh.client.inject : []
}

/**
 * Read every token name the plugin writes.
 *
 * @returns {Set<string>} the plugin's vocabulary.
 */
function readPluginTokens() {
  const source = readFileSync(join(packageRoot, 'src/tokens.ts'), 'utf8')
  const tokens = new Set()
  for (const match of source.matchAll(/'(--ds[w]?-[a-z0-9-]+)'\s*:/g)) tokens.add(match[1])
  return tokens
}

/**
 * Read the slot keys and DOM anchors the plugin depends on.
 *
 * @returns {{slots: Set<string>, anchors: Set<string>}} the plugin's dependencies.
 */
function readPluginDependencies() {
  const slots = new Set()
  const anchors = new Set()

  slots.add('settings.general.item')
  slots.add('shell.overlay')

  for (const file of ['src/client/semantic-slots.ts', 'src/client/text-targets.ts', 'src/client/applier.ts']) {
    const source = readFileSync(join(packageRoot, file), 'utf8')
    for (const match of source.matchAll(/querySelector(?:All)?\('([^']+)'\)/g)) anchors.add(match[1])
    for (const match of source.matchAll(/closest\?\.\('([^']+)'\)/g)) anchors.add(match[1])
  }

  return { slots, anchors }
}

/**
 * Whether two strings are within one insert/delete/substitute.
 *
 * @param {string} a - first string.
 * @param {string} b - second string.
 * @returns {boolean} true when the edit distance is at most 1.
 */
function editDistanceAtMostOne(a, b) {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let indexA = 0
  let indexB = 0
  let edits = 0
  while (indexA < a.length && indexB < b.length) {
    if (a[indexA] === b[indexB]) {
      indexA += 1
      indexB += 1
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) indexA += 1
    else if (a.length < b.length) indexB += 1
    else {
      indexA += 1
      indexB += 1
    }
  }
  return true
}

const dshRoot = resolveDshRoot()
if (!existsSync(dshRoot)) {
  console.error(`check-against-dsh: no DSH root at ${dshRoot}`)
  console.error('  run with --extract, or set DSKIN_DSH_ROOT to a full app.asar mirror')
  process.exit(2)
}

const installed = readInstalledVocabulary(dshRoot)
const installedSlots = readInstalledSlots(dshRoot)
const installedServices = readInstalledClientServices(dshRoot)
const pluginTokens = readPluginTokens()
const pluginDeps = readPluginDependencies()
const pluginInject = readPluginClientInject()

console.log(`check-against-dsh: DSH root ${dshRoot}`)
console.log(`  scanned ${installed.files} files`)
console.log(`  installed --dsw-* vocabulary: ${installed.tokens.size} tokens`)
console.log(`  plugin token vocabulary:      ${pluginTokens.size}`)
console.log(`  installed slot keys:          ${installedSlots.size}`)
console.log(`  installed client services:    ${installedServices.size}`)
console.log('')

const missing = []
let exact = 0
for (const name of [...pluginTokens].sort()) {
  if (installed.tokens.has(name)) exact += 1
  else missing.push(name)
}

console.log(`plugin tokens this build defines: ${exact}/${pluginTokens.size}`)
if (missing.length > 0) {
  console.log(`not defined by this build: ${missing.length}`)
  for (const name of missing) console.log(`  - ${name}`)
}
console.log('')

// A name the plugin writes that looks like a typo of a defined name is a bug.
const suspicious = []
for (const name of missing) {
  const stem = name.replace(/^--ds[w]?-/, '')
  for (const installedName of installed.tokens) {
    const installedStem = installedName.replace(/^--ds[w]?-/, '')
    if (editDistanceAtMostOne(stem, installedStem)) suspicious.push(`${name} ≈ ${installedName}`)
  }
}

let exited = false
console.log('client services the plugin injects (dsh.client.inject)')
if (pluginInject.length === 0) {
  console.log('  (none declared)')
}
for (const name of pluginInject) {
  if (installedServices.has(name)) {
    console.log(`  ${name}: provided by this build`)
    continue
  }
  console.log(`  ${name}: NOT provided by any installed client package`)
  console.log('    the page entry would stay `pending (waiting for service: ' + name + ')`')
  console.log('    and the desktop aborts the boot. Use the service KEY a client package')
  console.log('    publishes with ctx.provide(...), not a package name.')
  exited = true
}
console.log('')

console.log('slot keys')
for (const key of pluginDeps.slots) {
  if (installedSlots.size === 0) {
    console.log(`  ${key}: could not read this build's declarations`)
    continue
  }
  if (installedSlots.has(key)) {
    console.log(`  ${key}: declared by this build`)
  } else {
    console.log(`  ${key}: NOT declared — the row would not register`)
    console.log('    inspect the installed declaration and update the native entry registration')
    exited = true
  }
}
console.log('')

console.log(`DOM anchors the plugin depends on: ${pluginDeps.anchors.size}`)
for (const anchor of [...pluginDeps.anchors].sort()) console.log(`  - ${anchor}`)
console.log('')
console.log('  An anchor that stops matching degrades one feature and is reported in the')
console.log('  studio\'s diagnostics; it is not detectable here, because the anchors are')
console.log('  matched against a live DOM rather than against shipped text.')

if (suspicious.length > 0) {
  console.error('')
  console.error('check-against-dsh: FAILED — token names that look like typos of defined tokens:')
  for (const entry of suspicious) console.error(`  - ${entry}`)
  process.exit(1)
}

if (exited) process.exit(1)
console.log('')
console.log('check-against-dsh: OK')
if (missing.length > 0) {
  console.log(`  ${missing.length} token(s) are not defined by this build; they are still applied as`)
  console.log('  dynamic overrides, so the affected surfaces fall back to the host style.')
}
