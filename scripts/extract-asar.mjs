#!/usr/bin/env node
/**
 * Extract `app.asar` into a plain directory.
 *
 * The desktop app's Node runtime (including every `@deepseek-ai/*` package and
 * the `dsh-desktop-host` entry point) lives inside `app.asar`, which only
 * Electron's loader can read. Plain `node` cannot open an asar path, so any
 * out-of-process boot — such as `scripts/verify-against-host.mjs` — needs a
 * real directory mirror.
 *
 * Usage: node scripts/extract-asar.mjs [destination]
 * Default destination: %TEMP%\dsh-desktop-mirror
 */

import { createRequire } from 'node:module'
import { mkdirSync, openSync, readSync, closeSync, writeFileSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { RESOURCES } from './lib/desktop-paths.mjs'

const require = createRequire(import.meta.url)
const { parse } = require('./lib/asar-header.cjs')

const DEFAULT_ARCHIVE = join(RESOURCES, 'app.asar')
const archive = process.env.DSKIN_ASAR ?? DEFAULT_ARCHIVE
const unpackedRoot = `${archive}.unpacked`
const destination = resolve(process.argv[2] ?? join(tmpdir(), 'dsh-desktop-mirror'))

/**
 * Copy every file under the sibling `app.asar.unpacked` tree over the mirror.
 *
 * Native addons and other unpacked payloads are referenced by the archive index
 * but their bytes live only in that sibling tree, so a mirror built from the
 * archive alone cannot load them.
 *
 * @returns {number} number of files copied.
 */
function mergeUnpackedTree() {
  if (!existsSync(unpackedRoot)) return 0
  let copied = 0
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const source = join(directory, entry.name)
      const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) {
        walk(source, relativePath)
        continue
      }
      if (!entry.isFile()) continue
      const target = join(destination, relativePath)
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(source, target)
      copied += 1
    }
  }
  walk(unpackedRoot, '')
  return copied
}

const fd = openSync(archive, 'r')
let count = 0
let unpacked = 0

try {
  const { header, baseOffset } = parse(fd)

  /** Walk the asar header, materializing every file entry. */
  const walk = (node, prefix) => {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const path = `${prefix}/${name}`
      if (entry.files) {
        walk(entry, path)
        continue
      }
      if (entry.size === undefined || entry.offset === undefined) continue
      const target = join(destination, path)
      mkdirSync(dirname(target), { recursive: true })
      // `unpacked: true` entries hold no payload in the archive; the real bytes
      // live beside it under `<archive>.unpacked/<same path>`.
      if (entry.unpacked === true) {
        const source = join(unpackedRoot, path)
        if (existsSync(source)) {
          copyFileSync(source, target)
          unpacked += 1
        } else {
          writeFileSync(target, '')
        }
      } else {
        const buffer = Buffer.alloc(entry.size)
        readSync(fd, buffer, 0, entry.size, baseOffset + Number.parseInt(entry.offset, 10))
        writeFileSync(target, buffer)
      }
      count += 1
    }
  }

  walk(header, '')
} finally {
  closeSync(fd)
}

const mergedUnpacked = mergeUnpackedTree()

console.log(
  `extract-asar: wrote ${count} archived files + ${mergedUnpacked} unpacked files to ${destination}`,
)
if (unpacked > 0) console.log(`extract-asar: ${unpacked} archive entries were marked unpacked`)
