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
if (client.includes('dsh-client-runtime')) {
  throw new Error('Client bundle still references the removed DSH client runtime.')
}
if (!/require\(["']@deepseek-ai\/dsh-client-store["']\)/.test(client)) {
  throw new Error('Client bundle is missing the alpha.3 store external.')
}
if (/require\(["']@deepseek-ai\/cordis["']\)/.test(client)) {
  throw new Error('Client bundle contains a runtime Cordis request for a type-only import.')
}
if (/require\(["'](?:module|worker_threads)["']\)/.test(client)) {
  throw new Error('Client bundle contains a forbidden Node runtime import.')
}

const host = await readFile('lib/index.js', 'utf8')
if (!host.includes('function apply')) throw new Error('Host bundle is missing apply().')
