import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

if (!('withResolvers' in Promise)) {
  Object.assign(Promise, {
    withResolvers<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
      })
      return { promise, resolve, reject }
    },
  })
}

const PACKAGE_ID = 'dsh-skin-studio'
const CLIENT_EXTERNALS = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-runtime/client', '@deepseek-ai/dsh-client-ui-primitives',
] as const
const CSS_PREFIX = '\0dsh-skin-css:'
const CSS_SUFFIX = '.mjs'

const cssModulesInline = {
  name: 'dsh-skin-css-modules-inline',
  resolveId(source: string, importer: string | undefined) {
    if (!source.endsWith('.module.css') || importer === undefined) return null
    return `${CSS_PREFIX}${resolvePath(dirname(importer), source)}${CSS_SUFFIX}`
  },
  async load(this: { addWatchFile: (id: string) => void }, id: string) {
    if (!id.startsWith(CSS_PREFIX)) return null
    const filename = id.slice(CSS_PREFIX.length, -CSS_SUFFIX.length)
    this.addWatchFile(filename)
    const result = transform({ filename, code: await readFile(filename), cssModules: { pattern: '[hash]_[local]' }, minify: true })
    const classes = Object.fromEntries(Object.entries(result.exports ?? {}).map(([local, value]) => [local, value.name]))
    return [
      `const css=${JSON.stringify(result.code.toString())};`,
      `const id=${JSON.stringify(`${PACKAGE_ID}/${basename(filename)}`)};`,
      "if(typeof document!=='undefined'&&!document.querySelector('style[data-plugin-css='+JSON.stringify(id)+']')){",
      "const tag=document.createElement('style');tag.dataset.pluginCss=id;tag.textContent=css;document.head.appendChild(tag);}",
      `export default ${JSON.stringify(classes)};`,
    ].join('\n')
  },
}

const nodeConfig: UserConfig = {
  name: PACKAGE_ID,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: { neverBundle: true },
}

const clientConfig: UserConfig = {
  name: `${PACKAGE_ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  copy: [{ from: 'types/client.d.ts' }],
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: [/^fflate(?:\/|$)/],
    onlyBundle: [/^fflate(?:\/|$)/],
  },
  plugins: [cssModulesInline],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [nodeConfig, clientConfig]
