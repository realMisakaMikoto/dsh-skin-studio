import { access, readFile } from 'node:fs/promises'

const required = ['lib/index.js', 'lib/index.d.ts', 'lib/client.js', 'lib/client.d.ts', 'lib/client.js.map']
await Promise.all(required.map(file => access(file)))

const client = await readFile('lib/client.js', 'utf8')
if (!/window\.__ModuleLoader__\.load\(\{\s*id:\s*["']dsh-skin-studio["']/.test(client)) {
  throw new Error('Client bundle is missing the DSH module loader wrapper.')
}
if (!client.includes('data-plugin-css')) {
  throw new Error('Client bundle is missing its inlined CSS module.')
}
if (/require\(["'](?:module|worker_threads)["']\)/.test(client)) {
  throw new Error('Client bundle contains a forbidden Node runtime import.')
}

const host = await readFile('lib/index.js', 'utf8')
if (!host.includes('function apply')) throw new Error('Host bundle is missing apply().')
