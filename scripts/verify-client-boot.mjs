#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const args = process.argv.slice(2)
const at = args.indexOf('--bundle')
const source = readFileSync(at < 0 ? new URL('../client.js', import.meta.url) : args[at + 1], 'utf8')
const queue = []
const window = { __ModuleLoader__: { mode: 'queue', load: registration => queue.push(registration) } }
new Function('window', source)(window)
assert.equal(queue.length, 1)
assert.equal(queue[0].id, pkg.name)
const requests = []
const exported = queue[0].factory(spec => {
  requests.push(spec)
  assert.ok(['react', 'react/jsx-runtime'].includes(spec), `Unexpected platform import: ${spec}`)
  return require(spec)
})
assert.equal(typeof exported.apply, 'function')
assert.deepEqual(exported.inject, [])
const waits = []
const disposers = []
exported.apply({
  inject: (keys, callback) => { waits.push({ keys, callback }); return () => {} },
  effect: callback => { const dispose = callback(); if (dispose) disposers.push(dispose); return dispose },
})
assert.ok(waits.some(wait => ['slots', 'theme', 'locale'].every(key => wait.keys.includes(key))))
for (const dispose of disposers.reverse()) dispose()
console.log(`verify-client: OK; factory ${pkg.name}`)
console.log(`  platform imports: ${[...new Set(requests)].join(', ')}`)
console.log('  parent entry has no required services; scoped service wait registered')
console.log('  desktop interaction checks verify rendered tabs and effects')
