/**
 * PNG metadata injection utilities.
 *
 * HTML Canvas .toBlob('image/png') produces PNGs without DPI or ICC profile
 * metadata. These functions post-process the PNG binary to inject:
 *   - pHYs chunk: embeds physical pixel dimensions (DPI)
 *   - iCCP chunk: embeds an ICC color profile
 *
 * PNG format reference: https://www.w3.org/TR/png/
 * All multi-byte values in PNG are big-endian.
 */

// ─── CRC32 lookup table (IEEE polynomial) ──────────────────────────────

const crcTable: Uint32Array = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG chunk helpers ─────────────────────────────────────────────────

/**
 * Build a complete PNG chunk: [length(4)] [type(4)] [data(N)] [crc(4)]
 * CRC covers type + data.
 */
function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);

  // Length (4 bytes BE) — data length only, excludes type and CRC
  view.setUint32(0, data.length, false);

  // Type (4 bytes ASCII)
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }

  // Data
  chunk.set(data, 8);

  // CRC32 over type + data
  const crcInput = chunk.slice(4, 8 + data.length);
  view.setUint32(8 + data.length, crc32(crcInput), false);

  return chunk;
}

/**
 * Find the byte offset of the first IDAT chunk in a PNG buffer.
 * Returns the offset of the 4-byte length field of the IDAT chunk.
 * We insert metadata chunks (pHYs, iCCP) before the first IDAT.
 */
function findFirstIDAT(png: Uint8Array): number {
  let offset = 8; // skip PNG signature
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);

  while (offset < png.length) {
    const chunkLen = view.getUint32(offset, false);
    const type = String.fromCharCode(
      png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]
    );

    if (type === 'IDAT') {
      return offset;
    }

    // Move to next chunk: length(4) + type(4) + data(chunkLen) + crc(4)
    offset += 12 + chunkLen;
  }

  throw new Error('PNG has no IDAT chunk');
}

/**
 * Check if a PNG already contains a chunk of the given type.
 */
function hasChunk(png: Uint8Array, targetType: string): boolean {
  let offset = 8;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);

  while (offset < png.length) {
    const chunkLen = view.getUint32(offset, false);
    const type = String.fromCharCode(
      png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]
    );

    if (type === targetType) return true;
    if (type === 'IEND') return false;

    offset += 12 + chunkLen;
  }
  return false;
}

/**
 * Insert a chunk into a PNG buffer before the first IDAT chunk.
 */
function insertChunkBeforeIDAT(png: Uint8Array, chunk: Uint8Array): Uint8Array {
  const idatOffset = findFirstIDAT(png);
  const result = new Uint8Array(png.length + chunk.length);
  result.set(png.subarray(0, idatOffset), 0);
  result.set(chunk, idatOffset);
  result.set(png.subarray(idatOffset), idatOffset + chunk.length);
  return result;
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Inject a pHYs chunk into a PNG to embed DPI metadata.
 *
 * The pHYs chunk specifies pixel density. Printers and image editors
 * (Photoshop, GIMP, IrfanView) read this to determine physical print size.
 *
 * @param pngBuffer - Raw PNG file bytes
 * @param dpi - Desired resolution in dots per inch
 * @returns New PNG buffer with pHYs chunk embedded
 */
export function injectPngDpi(pngBuffer: ArrayBuffer, dpi: number): ArrayBuffer {
  let png: Uint8Array = new Uint8Array(pngBuffer);

  // Remove existing pHYs chunk if present
  if (hasChunk(png, 'pHYs')) {
    png = removeChunk(png, 'pHYs');
  }

  // pHYs data: 13 bytes
  //   pixels_per_unit_x (4 bytes BE)
  //   pixels_per_unit_y (4 bytes BE)
  //   unit_specifier (1 byte): 1 = meter
  const ppm = Math.round(dpi * 39.3700787402); // inches to pixels per meter
  const phys = new Uint8Array(13);
  const physView = new DataView(phys.buffer);
  physView.setUint32(0, ppm, false);  // X pixels per meter
  physView.setUint32(4, ppm, false);  // Y pixels per meter
  phys[8] = 1;                         // unit = meter

  // Pad remaining 4 bytes are already 0 — wait, pHYs is exactly 9 bytes
  // Actually pHYs data is 9 bytes: uint32 + uint32 + byte
  const physData = new Uint8Array(9);
  const physDataView = new DataView(physData.buffer);
  physDataView.setUint32(0, ppm, false);
  physDataView.setUint32(4, ppm, false);
  physData[8] = 1;

  const physChunk = buildChunk('pHYs', physData);
  const result = insertChunkBeforeIDAT(png, physChunk);
  return result.buffer as ArrayBuffer;
}

/**
 * Inject an iCCP chunk into a PNG to embed an ICC color profile.
 *
 * The iCCP chunk contains a compressed ICC profile. Per the PNG spec,
 * the profile data must be zlib-compressed (deflate).
 *
 * @param pngBuffer - Raw PNG file bytes
 * @param iccProfile - Raw ICC profile bytes
 * @param profileName - Profile name (e.g., "sRGB IEC61966-2.1")
 * @returns New PNG buffer with iCCP chunk embedded
 */
export function injectPngIcc(
  pngBuffer: ArrayBuffer,
  iccProfile: Uint8Array,
  profileName: string = 'sRGB'
): ArrayBuffer {
  let png: Uint8Array = new Uint8Array(pngBuffer);

  // Remove existing iCCP or sRGB chunks (they're mutually exclusive per PNG spec)
  if (hasChunk(png, 'iCCP')) {
    png = removeChunk(png, 'iCCP');
  }
  if (hasChunk(png, 'sRGB')) {
    png = removeChunk(png, 'sRGB');
  }

  // iCCP data format:
  //   profile_name (1-79 bytes, Latin-1) + null separator (1 byte)
  //   compression_method (1 byte): 0 = deflate
  //   compressed_profile (remaining bytes)

  // Compress the ICC profile using browser's CompressionStream API
  // Since this is synchronous, we use a simple deflate approach:
  // We'll use the raw profile without compression method 0 trick
  // Actually, for simplicity and browser compat, store with deflate via canvas hack
  // The simplest reliable approach: use a basic DEFLATE wrapper

  // Use uncompressed deflate blocks (store blocks) for simplicity.
  // This is valid zlib/deflate — just not compressed. Printers don't care about PNG size.
  const compressed = deflateStore(iccProfile);

  const nameBytes = new TextEncoder().encode(profileName);
  const data = new Uint8Array(nameBytes.length + 1 + 1 + compressed.length);
  data.set(nameBytes, 0);
  data[nameBytes.length] = 0;     // null separator
  data[nameBytes.length + 1] = 0; // compression method = deflate
  data.set(compressed, nameBytes.length + 2);

  const iccpChunk = buildChunk('iCCP', data);
  const result = insertChunkBeforeIDAT(png, iccpChunk);
  return result.buffer as ArrayBuffer;
}

// ─── Internal helpers ──────────────────────────────────────────────────

/**
 * Remove all chunks of a given type from a PNG.
 */
function removeChunk(png: Uint8Array, targetType: string): Uint8Array {
  const pieces: Uint8Array[] = [];
  pieces.push(png.subarray(0, 8)); // signature

  let offset = 8;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);

  while (offset < png.length) {
    const chunkLen = view.getUint32(offset, false);
    const type = String.fromCharCode(
      png[offset + 4], png[offset + 5], png[offset + 6], png[offset + 7]
    );
    const totalChunkSize = 12 + chunkLen;

    if (type !== targetType) {
      pieces.push(png.subarray(offset, offset + totalChunkSize));
    }

    offset += totalChunkSize;
  }

  // Concatenate
  const totalLen = pieces.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const piece of pieces) {
    result.set(piece, pos);
    pos += piece.length;
  }
  return result;
}

/**
 * Minimal zlib deflate "store" (no actual compression).
 * Wraps raw data in valid zlib format using non-compressed blocks.
 * This is valid per the deflate spec (RFC 1951) and zlib spec (RFC 1950).
 */
function deflateStore(input: Uint8Array): Uint8Array {
  // zlib header: CMF=0x78 (deflate, window 32K), FLG=0x01 (no dict, check bits)
  // The FLG byte must satisfy (CMF*256 + FLG) % 31 === 0
  // 0x78 * 256 + 0x01 = 30721, 30721 % 31 = 0 ✓

  const maxBlockSize = 65535;
  const blockCount = Math.ceil(input.length / maxBlockSize) || 1;

  // Calculate total size: zlib header(2) + blocks + adler32(4)
  let totalSize = 2 + 4; // header + adler32
  for (let i = 0; i < blockCount; i++) {
    const remaining = input.length - i * maxBlockSize;
    const blockLen = Math.min(remaining, maxBlockSize);
    totalSize += 5 + blockLen; // BFINAL(1) + LEN(2) + NLEN(2) + data
  }

  const output = new Uint8Array(totalSize);
  let pos = 0;

  // zlib header
  output[pos++] = 0x78;
  output[pos++] = 0x01;

  // Deflate stored blocks
  for (let i = 0; i < blockCount; i++) {
    const blockStart = i * maxBlockSize;
    const remaining = input.length - blockStart;
    const blockLen = Math.min(remaining, maxBlockSize);
    const isLast = i === blockCount - 1;

    output[pos++] = isLast ? 0x01 : 0x00; // BFINAL bit
    output[pos++] = blockLen & 0xFF;
    output[pos++] = (blockLen >> 8) & 0xFF;
    output[pos++] = ~blockLen & 0xFF;
    output[pos++] = (~blockLen >> 8) & 0xFF;
    output.set(input.subarray(blockStart, blockStart + blockLen), pos);
    pos += blockLen;
  }

  // Adler-32 checksum
  let a = 1, b = 0;
  for (let i = 0; i < input.length; i++) {
    a = (a + input[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = ((b << 16) | a) >>> 0;
  output[pos++] = (adler >> 24) & 0xFF;
  output[pos++] = (adler >> 16) & 0xFF;
  output[pos++] = (adler >> 8) & 0xFF;
  output[pos++] = adler & 0xFF;

  return output;
}
