#!/usr/bin/env node
/**
 * Validate that the package is installable as a DSH bundle and that its built
 * artifacts exist and agree with the manifest.
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const failures = []

/**
 * Record one failed assertion.
 *
 * @param {string} message - what failed.
 * @returns {void}
 */
function fail(message) {
  failures.push(message)
}

/** Read and parse a JSON file, recording a failure instead of throwing. */
function readJson(relative) {
  const path = join(root, relative)
  if (!existsSync(path)) {
    fail(`missing file: ${relative}`)
    return null
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`invalid JSON in ${relative}: ${error.message}`)
    return null
  }
}

const pkg = readJson('package.json')
const patch = existsSync(join(root, 'cordis.patch.yml')) ? readFileSync(join(root, 'cordis.patch.yml'), 'utf8') : null

if (patch === null) fail('missing file: cordis.patch.yml')
if (!existsSync(join(root, 'client.js'))) fail('missing built artifact: client.js')
if (!existsSync(join(root, 'index.js'))) fail('missing Host half: index.js')

if (pkg) {
  const name = pkg.name
  const exportsMap = pkg.exports ?? {}
  if (typeof name !== 'string' || name.length === 0) fail('package.json: name must be a non-empty string')
  if (exportsMap['./client'] !== './client.js') fail(`package.json: exports["./client"] must be "./client.js"`)
  if (exportsMap['.'] !== './index.js') fail(`package.json: exports["."] must be "./index.js"`)

  // Every declared file is shipped by `npm pack` and copied by an install from
  // the directory; a name listed but absent is a packaging bug that only
  // surfaces in the consumer's tree.
  for (const entry of pkg.files ?? []) {
    if (typeof entry !== 'string' || entry.length === 0) {
      fail(`package.json: files entries must be non-empty strings, got ${JSON.stringify(entry)}`)
      continue
    }
    if (!existsSync(join(root, entry))) fail(`package.json: files lists "${entry}", which does not exist`)
  }

  const dsh = pkg.dsh ?? {}
  if (dsh.bundle?.patch !== './cordis.patch.yml') fail('package.json: dsh.bundle.patch must be "./cordis.patch.yml"')

  const client = dsh.client
  if (!client) fail('package.json: dsh.client is required for a browser plugin')
  else {
    if (client.platform !== 'web') fail('package.json: dsh.client.platform must be "web"')
    if (Array.isArray(client.external) && client.external.length > 0) {
      fail(
        'package.json: dsh.client.external must stay empty — this plugin imports no @deepseek-ai/* package, and every entry here is one more resolution that can fail',
      )
    }
    for (const dep of client.inject ?? []) {
      // `dsh.client.inject` names the **client services** the page's plugin
      // entry requires. The loader parks that entry as `pending` until each
      // name is provided, and the desktop then refuses to start with
      // `pending (waiting for service: <name>)` — so a package name here is a
      // hard boot failure. Service keys are lowerCamelC identifiers.
      if (typeof dep !== 'string' || !/^[a-z][A-Za-z0-9]*$/.test(dep)) {
        fail(
          `package.json: dsh.client.inject entries must be client service keys (e.g. "slots", "theme"), got ${JSON.stringify(dep)} — ` +
            'the page entry would stay pending on that name and the desktop boot would abort',
        )
      }
    }
  }

  // The bundle must not reference Harness Client packages as runtime modules.
  if (existsSync(join(root, 'client.js'))) {
    const bundle = readFileSync(join(root, 'client.js'), 'utf8')
    const requireCalls = [...bundle.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1])
    for (const spec of new Set(requireCalls)) {
      if (!['react', 'react/jsx-runtime'].includes(spec)) {
        fail(`client.js requires "${spec}" — only the React baseline imports are allowed`)
      }
    }
    if (!bundle.includes('__ModuleLoader__.load')) fail('client.js does not register a factory with window.__ModuleLoader__')
    if (!bundle.includes(name)) fail(`client.js does not contain the package id "${name}"`)
  }

  if (patch !== null) {
    if (!patch.includes(name)) fail(`cordis.patch.yml does not name the package "${name}"`)
    if (!/^- insert:/m.test(patch)) fail('cordis.patch.yml has no top-level `- insert:` entry')
  }
}

/**
 * Read the patch file's top-level rows without a YAML dependency.
 *
 * The file is a handful of lines of one known shape, so a strict line reader
 * keeps the package dependency-free. Nesting is read from indentation:
 *
 * ```
 * - insert:                                  # column 0
 *     - id: <loader row id>                  # column 4
 *       name: '<package name>'               # column 6
 * ```
 *
 * Anything that does not fit that shape is ignored rather than guessed at, so
 * this only ever asserts on rows it understood completely.
 *
 * @returns {{inserts: Array<{id: string, name: string, indent: number}>}} parsed insert rows.
 */
function readPatchRows() {
  const inserts = []
  if (patch === null) return { inserts }
  let inInsert = false
  let current = null
  for (const raw of patch.split(/\r?\n/)) {
    if (raw.trim().startsWith('#') || raw.trim().length === 0) continue
    const indent = raw.length - raw.trimStart().length
    const text = raw.trim()

    if (indent === 0) {
      // A top-level patch key ends any insert list that was open.
      inInsert = /^-\s*insert:\s*$/.test(text)
      current = null
      continue
    }
    if (!inInsert) continue

    const entry = /^-\s*id:\s*(\S+)\s*$/.exec(text)
    if (entry !== null) {
      current = { id: entry[1], name: '', indent }
      inserts.push(current)
      continue
    }
    const rowName = /^name:\s*(.+?)\s*$/.exec(text)
    if (rowName !== null && current !== null && indent > current.indent) {
      current.name = rowName[1].replace(/^['"]|['"]$/g, '')
    }
  }
  return { inserts }
}

if (pkg && patch !== null) {
  // The bundle patch is what actually mounts the Host half: DSH turns each
  // `insert` row into one Loader entry named by `name`. A row naming anything
  // other than this package is skipped at boot, and a substring match on the
  // file text would not notice.
  const { inserts } = readPatchRows()
  const own = inserts.filter((row) => row.name === pkg.name)
  if (own.length !== 1) {
    fail(
      `cordis.patch.yml must insert exactly one row named "${pkg.name}"; found ${own.length}` +
        (inserts.length === 0 ? ' (no insert rows parsed)' : ` among [${inserts.map((row) => row.name || row.id).join(', ')}]`),
    )
  }
  for (const row of own) {
    if (row.id.length === 0) fail(`cordis.patch.yml: the insert row for ${pkg.name} has an empty id`)
  }
}

if (failures.length > 0) {
  console.error('validate-package: FAILED')
  for (const message of failures) console.error(`  - ${message}`)
  process.exit(1)
}

const size = statSync(join(root, 'client.js')).size
console.log(`validate-package: OK (client.js ${size} bytes)`)
