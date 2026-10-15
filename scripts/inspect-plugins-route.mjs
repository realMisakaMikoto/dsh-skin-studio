#!/usr/bin/env node
/**
 * Boot the desktop Host on a spare port straight from its mirror, probe the
 * `/plugins` route for several packages, then shut it down. Unlike
 * `verify-against-host.mjs` this makes no pass/fail judgement about this
 * package — it answers "is the route alive at all, and which rows serve?".
 *
 * Usage: node scripts/inspect-plugins-route.mjs [--port 19388]
 */

import { spawn } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { RESOURCES, DSH_ROOT, PROFILE_DIR } from './lib/desktop-paths.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')

const SOURCE_ENTRY = join(DSH_ROOT, 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'index.js')
const RUNTIME_DIR = join(RESOURCES, 'runtime', 'primary-runtime')
const PNPM = join(RESOURCES, 'runtime', 'pnpm', 'bin', 'pnpm.mjs')
const BIN_DIR = join(RESOURCES, 'runtime', 'bin')

const portIndex = process.argv.indexOf('--port')
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 19388
const projectDir = PROFILE_DIR

if (!existsSync(SOURCE_ENTRY)) throw new Error(`missing Host entry: ${SOURCE_ENTRY}\nSet DSKIN_DSH_ROOT to a full app.asar mirror.`)

const source = readFileSync(SOURCE_ENTRY, 'utf8')
if (!/"19387"/.test(source)) throw new Error('cannot retarget the Host port: "19387" not found')
const variant = join(dirname(SOURCE_ENTRY), 'index.inspect-port.mjs')
writeFileSync(variant, source.replace(/"19387"/, 'String(process.env.DSKIN_HOST_PORT ?? "19387")'))

const child = spawn(process.execPath, [variant, DSH_ROOT, projectDir, RUNTIME_DIR, PNPM, BIN_DIR], {
  env: {
    ...process.env,
    DSKIN_HOST_PORT: String(port),
    DSH_CLIENT_VERSION: process.env.DSH_CLIENT_VERSION ?? '0.2.0-rc.2',
    DSH_PRODUCT_ANALYTICS_OTLP_URL: process.env.DSH_PRODUCT_ANALYTICS_OTLP_URL ?? 'http://127.0.0.1:4318/v1/logs',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let log = ''
child.stdout.on('data', (chunk) => {
  log += chunk
})
child.stderr.on('data', (chunk) => {
  log += chunk
})

const stop = () => {
  if (child.exitCode === null) child.kill('SIGKILL')
}

const base = `http://127.0.0.1:${port}`
const deadline = Date.now() + 120000
let up = false
let lastError = 'no attempt made'
while (Date.now() < deadline) {
  if (child.exitCode !== null) {
    lastError = `host exited with code ${child.exitCode}`
    break
  }
  try {
    const response = await fetch(`${base}/`, { headers: { origin: 'dsh-app://app' } })
    await response.body?.cancel()
    up = response.status === 401 || response.ok
    if (up) break
    lastError = `status ${response.status}`
  } catch (error) {
    lastError = error.message
  }
  await new Promise((r) => setTimeout(r, 500))
}

try {
  if (!up) {
    console.log(`Host did not come up (exit ${child.exitCode}, last: ${lastError})`)
    console.log(log.split('\n').slice(-25).join('\n'))
  } else {
    const paths = [
      '/plugins/',
      '/plugins/@local/dsh-desktop-skin-studio/client.js',
      '/plugins/@deepseek-ai/dsh-client-ui-theme/client.js',
      '/plugins/@deepseek-ai/dsh-client-ui-settings-general/client.js',
      '/plugins/@deepseek-ai/dsh-client-modules/client.js',
    ]
    for (const path of paths) {
      const response = await fetch(new URL(path, base), { headers: { origin: 'dsh-app://app' } })
      const body = await response.text()
      console.log(`${String(response.status).padEnd(4)} ${path}`)
      console.log(`     len=${body.length} moduleLoader=${body.includes('__ModuleLoader__')} type=${response.headers.get('content-type') ?? '(none)'}`)
    }
  }
} finally {
  stop()
  const logPath = join(packageRoot, '.inspect-host.log')
  writeFileSync(logPath, log)
  console.log(`host log: ${logPath} (${log.length}B)`)
}
