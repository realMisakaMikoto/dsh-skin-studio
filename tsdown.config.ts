import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve, relative } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const PACKAGE_ID = '@local/dsh-desktop-skin-studio'
const CSS_PREFIX = '\0desktop-skin-css:'
const cssModulesInline = {
  name: 'desktop-skin-css-modules',
  resolveId(source: string, importer: string | undefined) {
    if (!source.endsWith('.module.css') || importer === undefined) return null
    const path = relative(process.cwd(), resolve(dirname(importer), source)).replaceAll('\\', '/')
    return `${CSS_PREFIX}${path}.mjs`
  },
  async load(this: { addWatchFile(id: string): void }, id: string) {
    if (!id.startsWith(CSS_PREFIX)) return null
    const modulePath = id.slice(CSS_PREFIX.length, -4)
    const filename = resolve(modulePath)
    this.addWatchFile(filename)
    const result = transform({ filename: modulePath, code: await readFile(filename), cssModules: { pattern: 'dskin_[local]_[hash]' }, minify: true })
    const classes = Object.fromEntries(Object.entries(result.exports ?? {}).map(([key, value]) => [key, value.name]))
    return [
      `const css=${JSON.stringify(result.code.toString())};`,
      `const id=${JSON.stringify(`${PACKAGE_ID}/${basename(filename)}`)};`,
      'export function installStyles(ctx){ctx.effect(()=>{const tag=document.createElement("style");tag.dataset.pluginCss=id;tag.textContent=css;document.head.appendChild(tag);return()=>tag.remove();},"skin studio styles");}',
      `export default ${JSON.stringify(classes)};`,
    ].join('\n')
  },
}

const config: UserConfig = {
  entry: { client: 'src/client/index.ts' },
  outDir: '.',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: false,
  clean: false,
  deps: { neverBundle: ['react', 'react/jsx-runtime'], alwaysBundle: [/^fflate(?:\/|$)/], onlyBundle: [/^fflate(?:\/|$)/] },
  plugins: [cssModulesInline],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({id:${JSON.stringify(PACKAGE_ID)},factory:(require)=>{`,
    intro: 'var module={exports:{}};var exports=module.exports;',
    footer: 'return module.exports;}});',
  },
}
export default config
