import { BUNDLED_SKIN_PACKAGES } from './builtin-skins.generated.ts'
import { importSkinPackage, type ImportedSkinPackage } from './package-format.ts'

export { BUNDLED_SKIN_PACKAGES }
export type BundledSkinPackage = (typeof BUNDLED_SKIN_PACKAGES)[number]

const cache = new Map<string, Promise<ImportedSkinPackage>>()

function decodeBase64(base64: string): Uint8Array {
  const binary = globalThis.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function loadBundledSkinPackage(entry: BundledSkinPackage): Promise<ImportedSkinPackage> {
  const existing = cache.get(entry.id)
  if (existing !== undefined) return existing
  const bytes = decodeBase64(entry.base64)
  const buffer = bytes.slice().buffer as ArrayBuffer
  const loading = importSkinPackage(new Blob([buffer], { type: 'application/zip' }))
  cache.set(entry.id, loading)
  return loading
}

export async function loadAllBundledSkinPackages(): Promise<ImportedSkinPackage[]> {
  return await Promise.all(BUNDLED_SKIN_PACKAGES.map(loadBundledSkinPackage))
}
