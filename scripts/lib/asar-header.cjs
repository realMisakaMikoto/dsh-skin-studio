/**
 * Read an Electron `app.asar` header.
 *
 * The container is a Chromium Pickle followed by a JSON index, then the file
 * payloads. The pickle preamble is four little-endian UInt32 fields:
 *
 *   0..3    payload size, counted from offset 4 (ignored here)
 *   4..7    string length in UTF-16 code units (ignored here)
 *   8..11   header-JSON byte length including this 16-byte preamble
 *   12..15  header offset, equal to 16 in every observed archive
 *   16..    header JSON, padded to a 4-byte boundary
 *
 * File offsets in the index are relative to the end of the padded header.
 */

'use strict'

const { readSync } = require('node:fs')

/** Bytes before the header JSON: four UInt32 pickle fields. */
const JSON_START = 16
/** The field holding the JSON byte length plus its own 4 bytes. */
const SIZE_FIELD_OFFSET = 8
/** Bytes to subtract from that field: the size field itself. */
const SIZE_FIELD_BYTES = 4
const MAX_HEADER_BYTES = 64 * 1024 * 1024

/**
 * Parse the asar index from an open file descriptor.
 *
 * @param {number} fd - open descriptor positioned anywhere in the archive.
 * @returns {{header: object, baseOffset: number}} the parsed index and the
 *   absolute offset where payloads begin.
 */
function parse(fd) {
  const preamble = Buffer.alloc(JSON_START)
  readSyncExactly(fd, preamble, 0)

  const declared = preamble.readUInt32LE(SIZE_FIELD_OFFSET)
  const headerSize = declared - SIZE_FIELD_BYTES
  if (headerSize <= 0 || headerSize > MAX_HEADER_BYTES) {
    throw new Error(`asar: implausible header size ${declared} (JSON length ${headerSize})`)
  }

  const headerBytes = Buffer.alloc(headerSize)
  readSyncExactly(fd, headerBytes, JSON_START)

  return { header: JSON.parse(headerBytes.toString('utf8')), baseOffset: JSON_START + headerSize }
}

/**
 * Read exactly `buffer.length` bytes at `offset`.
 *
 * @param {number} fd - open descriptor.
 * @param {Buffer} buffer - destination.
 * @param {number} offset - absolute byte offset.
 * @returns {void}
 */
function readSyncExactly(fd, buffer, offset) {
  let read = 0
  while (read < buffer.length) {
    const chunk = readSync(fd, buffer, read, buffer.length - read, offset + read)
    if (chunk === 0) throw new Error('asar: unexpected end of archive')
    read += chunk
  }
}

module.exports = { parse, JSON_START, SIZE_FIELD_BYTES }
