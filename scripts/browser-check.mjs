#!/usr/bin/env node
/**
 * Load the desktop Host's own page in a headless browser and report what the
 * renderer logged.
 *
 * This is the reproduction harness for Client-half failures: the Host prints an
 * authenticated URL on startup, the browser loads it exactly as the shell's
 * renderer does, and the renderer's console — including the plugin's own crash
 * line — is written to a file.
 *
 * Usage:
 *   node scripts/browser-check.mjs [--port 19380] [--grep "skin-studio"]
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESOURCES, DSH_ROOT, DSH_HOME, EDGE } from './lib/desktop-paths.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const at = argv.indexOf(name)
  return at >= 0 ? argv[at + 1] : fallback
}

const port = Number(arg('--port', '19380'))
const grep = arg('--grep', 'skin-studio')

const HOST_ENTRY = join(DSH_ROOT, 'node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js')

/** The Host entry hardcodes its port; emit a disposable variant that reads it. */
function hostEntryForPort() {
  const source = readFileSync(HOST_ENTRY, 'utf8')
  const variant = join(dirname(HOST_ENTRY), 'index.browser-check.mjs')
  writeFileSync(variant, source.replace(/"19387"/, 'String(process.env.DSKIN_HOST_PORT ?? "19387")'))
  return variant
}

const workdir = mkdtempSync(join(tmpdir(), 'dskin-browser-'))
const host = spawn(
  process.execPath,
  [
    hostEntryForPort(),
    DSH_ROOT,
    join(DSH_HOME, 'profiles', 'desktop'),
    join(RESOURCES, 'runtime/primary-runtime'),
    join(RESOURCES, 'runtime/pnpm/bin/pnpm.mjs'),
    join(RESOURCES, 'runtime/bin'),
  ],
  {
    env: {
      ...process.env,
      DSKIN_HOST_PORT: String(port),
      DSH_CLIENT_VERSION: '0.2.0-rc.2',
      DSH_PRODUCT_ANALYTICS_OTLP_URL: 'http://127.0.0.1:4318/v1/logs',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)

let hostOut = ''
host.stdout.on('data', (chunk) => {
  hostOut += chunk
})
host.stderr.on('data', (chunk) => {
  hostOut += chunk
})

const stop = () => {
  if (host.exitCode === null) host.kill('SIGKILL')
}

try {
  let url = null
  const deadline = Date.now() + 90000
  while (url === null && Date.now() < deadline) {
    const found = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[\w-]+)/.exec(hostOut)
    if (found !== null) url = found[1]
    else await new Promise((r) => setTimeout(r, 300))
  }
  if (url === null) throw new Error(`Host never printed its URL:\n${hostOut.slice(-1500)}`)
  console.log(`browser-check: host up on ${port}`)

  const browser = spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${join(workdir, 'profile')}`,
      '--enable-logging=stderr',
      '--v=0',
      '--virtual-time-budget=12000',
      url,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )

  let consoleOut = ''
  browser.stderr.on('data', (chunk) => {
    consoleOut += chunk
  })
  browser.stdout.on('data', (chunk) => {
    consoleOut += chunk
  })

  await new Promise((resolve) => {
    const poll = setInterval(() => {
      if (browser.exitCode !== null) {
        clearInterval(poll)
        resolve()
      }
    }, 400)
    setTimeout(() => {
      clearInterval(poll)
      if (browser.exitCode === null) browser.kill('SIGKILL')
      resolve()
    }, 120000)
  })

  const logPath = join(workdir, 'renderer-console.log')
  writeFileSync(logPath, consoleOut)
  const lines = consoleOut
    .split('\n')
    .filter((line) => grep === null || line.toLowerCase().includes(grep.toLowerCase()))
    .slice(0, 40)
  console.log(`browser-check: renderer console ${consoleOut.length} bytes -> ${logPath}`)
  if (lines.length === 0) console.log(`  no line matches ${JSON.stringify(grep)}`)
  for (const line of lines) console.log(`  ${line.trim().slice(0, 500)}`)
} finally {
  stop()
  await new Promise((r) => setTimeout(r, 200))
  console.log(`browser-check: artifacts in ${workdir}`)
}
