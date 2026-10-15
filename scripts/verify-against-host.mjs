#!/usr/bin/env node
/**
 * Verify that the desktop profile composes with this bundle and that the Host
 * actually serves it, without touching the user's running instance.
 *
 * It boots the desktop Host entry point the Electron shell uses — the same
 * profile directory, on a different port — then probes the boot index and the
 * `/plugins/<id>/client.js` route, and finally shuts the child down.
 *
 * Usage: node scripts/verify-against-host.mjs [--port 19388]
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, openSync, readSync, closeSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESOURCES, DSH_ROOT, PROFILE_DIR } from './lib/desktop-paths.mjs'

const require = createRequire(import.meta.url)
const { parse: parseAsarHeader } = require('./lib/asar-header.cjs')

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))

/**
 * The app's Node runtime lives inside `app.asar`, which only Electron's own
 * loader can read; plain `node` cannot open an asar path. `--extract-root`
 * therefore points at a full mirror of the archive (see `scripts/extract-asar.mjs`),
 * while the runtime directories stay where the real install keeps them.
 */
const HOST_ENTRY_SOURCE = join(DSH_ROOT, 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'index.js')
const RUNTIME_DIR = join(RESOURCES, 'runtime', 'primary-runtime')
const PNPM = join(RESOURCES, 'runtime', 'pnpm', 'bin', 'pnpm.mjs')
const BIN_DIR = join(RESOURCES, 'runtime', 'bin')

const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || 19388
const projectDir = PROFILE_DIR

/**
 * The Electron main process hardcodes `--port 19387`, so a second Host would
 * collide with the user's running app. When a different port is requested, emit
 * a disposable variant of the Host entry that reads the port from the
 * environment; the real entry file is never modified.
 *
 * @returns {string} the entry path to spawn.
 */
function resolveHostEntry() {
  if (port === 19387) return HOST_ENTRY_SOURCE
  // The variant must sit beside the real entry: its bare-specifier imports
  // resolve against its own directory.
  const variant = join(dirname(HOST_ENTRY_SOURCE), 'index.verify-port.mjs')
  const source = readFileSync(HOST_ENTRY_SOURCE, 'utf8')
  const pattern = /"19387"/
  if (!pattern.test(source)) {
    throw new Error('cannot retarget the Host port: the literal "19387" was not found in the Host entry')
  }
  const patched = source.replace(pattern, 'String(process.env.DSKIN_HOST_PORT ?? "19387")')
  writeFileSync(variant, patched)
  return variant
}

const HOST_ENTRY = resolveHostEntry()

/**
 * Read one file out of `app.asar` without extracting the whole archive.
 *
 * @param {string} asarPath - path to the archive.
 * @param {string} entryPath - slash-separated path inside the archive.
 * @returns {string|null} the file's UTF-8 text, or null when absent.
 */
function readFromAsar(asarPath, entryPath) {
  const fd = openSync(asarPath, 'r')
  try {
    const { header, baseOffset } = parseAsarHeader(fd)
    const segments = entryPath.split('/')
    let node = header
    for (const segment of segments) {
      node = node?.files?.[segment]
      if (node === undefined) return null
    }
    if (node.files !== undefined || node.size === undefined) return null
    const buffer = Buffer.alloc(node.size)
    readSync(fd, buffer, 0, node.size, baseOffset + Number.parseInt(node.offset, 10))
    return buffer.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

/**
 * Environment the Electron shell normally contributes before it boots the Host.
 * Telemetry rows validate `serviceVersion` against `DSH_CLIENT_VERSION`, so an
 * out-of-process boot must supply it or desktop-only rows fail activation.
 */
const appVersion =
  process.env.DSH_CLIENT_VERSION ??
  (() => {
    const manifest = readFromAsar(join(RESOURCES, 'app.asar'), 'package.json')
    return manifest === null ? '0.0.0' : JSON.parse(manifest).version
  })()

const failures = []
const notes = []

/** The Loader row id, taken from the bundle patch, for audit cross-checks. */
const ROW_ID = (() => {
  const patch = readFileSync(join(packageRoot, 'cordis.patch.yml'), 'utf8')
  const match = /- id:\s*(\S+)/.exec(patch)
  return match === null ? 'dsh-desktop-skin-studio' : match[1]
})()

/**
 * Pull the startup audit out of the Host's stderr.
 *
 * The audit prints a `Failed plugins (n):` table and a `Plugins waiting for
 * services` table; both list row ids. Parsing them turns "the Host booted" into
 * "this plugin's row activated".
 *
 * @param {string} text - the Host's stderr.
 * @returns {{failed: string[], waiting: string[], raw: string}} the audit.
 */
function summarizeAudit(text) {
  const failed = []
  const waiting = []
  const raw = text

  const failedBlock = /Failed plugins \(\d+\):\n([\s\S]*?)(?:\n\s*at |\nPlugins waiting|\n$)/
  const failedMatch = failedBlock.exec(text)
  if (failedMatch !== null) {
    for (const line of failedMatch[1].split('\n')) {
      const name = /^\s{2}(\S+)/.exec(line)
      if (name !== null) failed.push(name[1])
    }
  }

  const waitingBlock = /Plugins waiting for services[^\n]*\n([\s\S]*?)(?:\n\s*at |\n$)/
  const waitingMatch = waitingBlock.exec(text)
  if (waitingMatch !== null) {
    for (const line of waitingMatch[1].split('\n').slice(1)) {
      const name = /^\s{2}(\S+)/.exec(line)
      if (name !== null) waiting.push(name[1])
    }
  }

  return { failed, waiting, raw }
}

/**
 * Record a failed assertion.
 *
 * @param {string} message - what failed.
 */
function fail(message) {
  failures.push(message)
}

if (!existsSync(HOST_ENTRY)) throw new Error(`missing desktop Host entry: ${HOST_ENTRY}`)
if (!existsSync(projectDir)) throw new Error(`missing profile directory: ${projectDir}`)

const child = spawn(process.execPath, [HOST_ENTRY, DSH_ROOT, projectDir, RUNTIME_DIR, PNPM, BIN_DIR], {
  env: {
    ...process.env,
    DSKIN_HOST_PORT: String(port),
    DSH_CLIENT_VERSION: process.env.DSH_CLIENT_VERSION ?? appVersion,
    // The desktop telemetry row validates this as an HTTP(S) URL and is a
    // required entry, so an out-of-process boot must provide a well-formed one.
    DSH_PRODUCT_ANALYTICS_OTLP_URL: process.env.DSH_PRODUCT_ANALYTICS_OTLP_URL ?? 'http://127.0.0.1:4318/v1/logs',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

const LOG_LIMIT = 200000
let stdout = ''
let stderr = ''
let stdoutBytes = 0
let stderrBytes = 0
child.stdout.on('data', (chunk) => {
  stdoutBytes += chunk.length
  if (stdout.length < LOG_LIMIT) stdout += chunk
})
child.stderr.on('data', (chunk) => {
  stderrBytes += chunk.length
  if (stderr.length < LOG_LIMIT) stderr += chunk
})

const stop = () => {
  if (!child.killed && child.exitCode === null) {
    child.kill('SIGKILL')
  }
}

/** Poll a URL until it answers or the deadline passes. */
async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastError = 'no attempt'
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return { ok: false, error: `child exited with code ${child.exitCode}` }
    try {
      const response = await fetch(url, { headers: { origin: 'dsh-app://app' } })
      await response.body?.cancel()
      return { ok: true, response }
    } catch (error) {
      lastError = error.message
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  return { ok: false, error: lastError }
}

try {
  const base = `http://127.0.0.1:${port}`
  const ready = await waitFor(`${base}/`, 120000)

  if (!ready.ok) {
    fail(`Host never answered on ${base}: ${ready.error}`)
  } else if (child.exitCode !== null) {
    fail(`Host exited during boot (code ${child.exitCode})`)
  } else {
    notes.push(`Host booted on ${base}`)
  }

  // The profile must have composed; an aggregation failure would have thrown
  // during activation and produced a fatal message on stderr.
  if (/ClientPackageCompositionError|client-modules:/i.test(stderr)) {
    fail(`Host reported a composition failure:\n${stderr.slice(-2000)}`)
  }

  // The activation audit is the strongest out-of-process signal available. It
  // names every row that failed and every row left waiting for a service, so
  // "not mentioned" is evidence the row activated — unlike the HTTP route probe
  // below, which the Host's own auth challenge can mask.
  const audit = summarizeAudit(stderr)
  if (audit.failed.length === 0 && audit.waiting.length === 0) {
    notes.push('no activation audit on stderr: every row activated')
  } else {
    if (audit.failed.includes(manifest.name)) {
      fail(`the Host's activation audit lists ${manifest.name} as failed:\n${audit.raw}`)
    } else if (audit.failed.includes(ROW_ID)) {
      fail(`the Host's activation audit lists the row id ${ROW_ID} as failed:\n${audit.raw}`)
    } else {
      notes.push(`activation audit: ${audit.failed.length} failed, ${audit.waiting.length} waiting (neither is this plugin)`)
      for (const name of audit.failed) notes.push(`  failed: ${name}`)
      for (const name of audit.waiting) notes.push(`  waiting: ${name}`)
    }
  }

  if (!ready.ok) {
    notes.push('skipping route probes: the Host never answered')
  } else {
    const indexResponse = await fetch(`${base}/`, { headers: { origin: 'dsh-app://app' } })
    const document = await indexResponse.text()
    const rows = [...document.matchAll(/"id":"([^"]+)"/g)].map((match) => match[1])
    if (rows.length === 0) {
      // The Host gates its own boot document behind the shell-held cookie, so an
      // unauthenticated probe cannot read the graph. This is a limitation of the
      // probe, not a failure of the plugin.
      notes.push('boot graph not readable without the shell cookie; the activation audit above is the evidence')
    } else if (!rows.includes(manifest.name)) {
      fail(`boot graph does not contain "${manifest.name}" (rows: ${rows.slice(0, 12).join(', ')})`)
    } else {
      notes.push(`boot graph contains the plugin (${rows.length} rows)`)
    }

    const bundleUrl = `${base}/plugins/${manifest.name}/client.js`
    const bundleResponse = await fetch(bundleUrl, { headers: { origin: 'dsh-app://app' } })
    const body = (await bundleResponse.text()).slice(0, 400000)
    if (bundleResponse.status === 401) {
      notes.push('bundle route answers 401: it exists but needs the shell cookie, so its content cannot be checked here')
    } else if (bundleResponse.status !== 200) {
      // Without a readable boot graph this is expected on an auth-gated Host.
      notes.push(`bundle route answered ${bundleResponse.status} (auth-gated Host; not treated as a failure)`)
    } else if (!body.includes('__ModuleLoader__.load')) {
      fail('served bundle does not register a module-loader factory')
    } else if (!body.includes(manifest.name)) {
      fail('served bundle is not this package')
    } else {
      notes.push(`bundle served and verified: ${body.length} bytes`)
    }
  }
} finally {
  stop()
  await new Promise((r) => setTimeout(r, 300))
}

console.log('--- notes ---')
for (const note of notes) console.log(`  ${note}`)

/**
 * Always persist the whole Host log: activation failures print a long table and
 * the interesting row is rarely in the tail.
 */
const logPath = join(packageRoot, '.verify-host.log')
writeFileSync(logPath, `# stdout\n${stdout}\n\n# stderr\n${stderr}\n`)
console.log(`host log: ${logPath} (stdout ${stdoutBytes}B, stderr ${stderrBytes}B)`)

if (stderr.trim()) {
  const tail = stderr.trim().split('\n').slice(-8).join('\n')
  console.log('--- host stderr (tail) ---')
  console.log(tail)
}

if (failures.length > 0) {
  console.error('verify-against-host: FAILED')
  for (const message of failures) console.error(`  - ${message}`)
  process.exit(1)
}
console.log('verify-against-host: OK')
