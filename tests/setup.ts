import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { Buffer } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => { cleanup() })

const compatibleSubtle = new Proxy(webcrypto.subtle, {
  get(target, property) {
    if (property === 'digest') {
      return async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data)
        return await target.digest(algorithm, Buffer.from(bytes))
      }
    }
    const value = Reflect.get(target, property, target) as unknown
    return typeof value === 'function' ? value.bind(target) : value
  },
})
const compatibleCrypto = new Proxy(webcrypto, {
  get(target, property) {
    if (property === 'subtle') return compatibleSubtle
    const value = Reflect.get(target, property, target) as unknown
    return typeof value === 'function' ? value.bind(target) : value
  },
}) as Crypto
Object.defineProperty(globalThis, 'crypto', { value: compatibleCrypto, configurable: true })

if (URL.createObjectURL === undefined) {
  URL.createObjectURL = () => `blob:test-${Math.random()}`
  URL.revokeObjectURL = () => {}
}
